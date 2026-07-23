# Implementing "Sign in with Google" (OAuth) in Pintrip

This guide adds **Google sign-in** to Pintrip's existing auth, without disturbing the
current email/password flow.

## The approach (and why)

Pintrip already has its own auth: the backend mints a **Pintrip JWT** (`_create_token`
in `backend/app/routers/auth.py`, HS256, `aud="authenticated"`) and the frontend stores
the session in `localStorage` under `pintrip_session`. Every API call sends
`Authorization: Bearer <that token>`.

So we do **not** want Google to replace our sessions. We want:

1. The browser gets a **Google ID token** from Google Identity Services (GIS).
2. It POSTs that ID token to a new backend endpoint `POST /auth/google`.
3. The backend **verifies** the ID token against Google's public keys, finds-or-creates
   the user, and returns the **same session shape** the rest of the app already uses
   (`{ access_token, token_type, user: { id, email } }`).

Because step 3 reuses `_create_token` / `_session`, **nothing else in the app changes** —
`lib/api.js`, `App.jsx`, route gating, and `getAuthHeader` all keep working as-is.

```
Browser                         Backend (/auth/google)              Google
  │  click "Continue with Google"
  │ ───────────────────────────────────────────────────────────────▶ GIS popup
  │  ◀─────────── Google ID token (JWT) ────────────────────────────
  │  POST /auth/google { credential }
  │ ─────────────────────────▶ verify_oauth2_token(credential) ────▶ fetch certs
  │                            find-or-create User
  │  ◀── { access_token, user } ── mint Pintrip JWT (_session)
  │  store in localStorage as pintrip_session  →  app works exactly as before
```

**Good news:** `google-auth==2.52.0` is already in `backend/requirements.txt`, so the
backend needs **no new Python dependency**. And because we use the ID-token flow (not the
authorization-code flow), there is **no client secret** and **no redirect URI** to manage —
only a public Client ID, used by both frontend and backend.

---

## Step 1 — Google Cloud Console setup

1. Go to <https://console.cloud.google.com/> → create/select a project (e.g. `pintrip`).
2. **APIs & Services → OAuth consent screen**
   - User type: **External**.
   - App name: `Pintrip`, support email: your email.
   - Scopes: add `openid`, `email`, `profile` (these are the defaults GIS requests).
   - While the app is in **Testing**, add your Google account under **Test users** (only
     listed users can sign in). Click **Publish app** later to allow anyone.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**.
   - **Authorized JavaScript origins** (this is the important one for GIS):
     - `http://localhost:5173`
     - `https://pintrip.hohosan.site`
   - **Authorized redirect URIs**: leave empty — not needed for the ID-token flow.
4. Copy the **Client ID** (looks like `1234567890-abc123.apps.googleusercontent.com`).
   This single value goes into **both** the backend `.env` and the frontend `.env`.

> The **Client secret** shown on this screen is **not used** by this flow. Ignore it.

---

## Step 2 — Backend changes

### 2a. Config — `backend/app/config.py`

Add a setting for the Google client ID:

```python
    # Cloudflare Turnstile (bot protection on /auth/register)
    turnstile_secret_key: str | None = None

    # Google Sign-In (ID-token verification)
    google_client_id: str | None = None
```

### 2b. User model — `backend/app/models.py`

Google users have no password, and we key them by Google's stable subject id (`sub`).
Make `hashed_password` nullable and add a `google_sub` column:

```python
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)   # null for Google-only users
    google_sub = Column(String(255), unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

> ⚠️ **`Base.metadata.create_all` in `main.py` does NOT alter existing tables** — it only
> creates missing ones. Your local WSL Postgres and the RDS database already have a
> `users` table, so you must run the migration in **Step 2c** on each of them, or the new
> column won't exist and `/auth/google` will error.

### 2c. Database migration (run on every existing DB)

Run this SQL against **local dev Postgres** and **prod RDS**. It's idempotent-ish and safe
to run once per database:

```sql
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) UNIQUE;
CREATE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub);
```

**Local (WSL Postgres)** — copy-paste into your terminal:

```bash
psql "postgresql://pintrip:pintrip@localhost:5432/pintrip" -c "ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;"
psql "postgresql://pintrip:pintrip@localhost:5432/pintrip" -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) UNIQUE;"
psql "postgresql://pintrip:pintrip@localhost:5432/pintrip" -c "CREATE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub);"
```

**Prod (RDS)** — run the same three statements against your RDS `DATABASE_URL` (from the
server, or any host that can reach RDS). Do this **before** deploying the new backend code.

### 2d. New endpoint — `backend/app/routers/auth.py`

Add these imports near the top (alongside the existing `import jwt`):

```python
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
```

Add the request model and endpoint (put it after `login`, before `me`):

```python
class GoogleAuthRequest(BaseModel):
    credential: str  # the Google ID token (JWT) from Google Identity Services


@router.post("/google")
@limiter.limit("10/minute")
def google_auth(request: Request, body: GoogleAuthRequest, db: Session = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured")

    # verify_oauth2_token checks the signature, expiry, issuer, and that the
    # token's audience matches our client id — raises ValueError on any failure.
    try:
        claims = google_id_token.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    if not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email not verified")

    google_sub = claims["sub"]
    email = claims["email"].lower()

    # Match on Google id first, then fall back to email (links an existing
    # password account to this Google identity on first Google sign-in).
    user = (
        db.query(User).filter(User.google_sub == google_sub).first()
        or db.query(User).filter(User.email == email).first()
    )

    if user is None:
        user = User(id=str(uuid.uuid4()), email=email, google_sub=google_sub)
        db.add(user)
    elif user.google_sub is None:
        user.google_sub = google_sub

    db.commit()
    db.refresh(user)
    return _session(user)
```

### 2e. Guard the password login against null-password accounts

A Google-only user now has `hashed_password = NULL`. The existing `login` would crash when
`_verify` calls `None.encode()`. One-line fix in `login`:

```python
@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, body: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.hashed_password or not _verify(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _session(user)
```

### 2f. Environment files

Add to `backend/.env` (and document it in `backend/.env.example`):

```bash
# Google Sign-In (same Client ID used by the frontend; NOT a secret)
GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
```

No `pip install` is required — `google-auth` is already pinned in `requirements.txt`.

---

## Step 3 — Frontend changes

### 3a. Load the Google Identity Services script — `frontend/index.html`

Add inside `<head>`:

```html
<script src="https://accounts.google.com/gsi/client" async></script>
```

### 3b. Auth helper — `frontend/src/lib/auth.js`

Add a method to the `authApi` object (mirrors `signIn`):

```js
  async signInWithGoogle(credential) {
    const session = await post('/auth/google', { credential })
    storeSession(session)
    return session
  },
```

### 3c. Google button on the auth page — `frontend/src/pages/AuthPage.jsx`

Near the top, read the client id:

```js
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
```

Inside the component, add a ref and an effect that initializes GIS and renders the button.
The poll mirrors the existing Turnstile pattern (the GIS script loads `async`):

```jsx
  const googleBtnRef = useRef(null)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    let cancelled = false
    function init() {
      if (cancelled || !googleBtnRef.current || !window.google) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError(null); setLoading(true)
          try {
            const session = await authApi.signInWithGoogle(credential)
            onSignIn(session)
          } catch (err) {
            setError(err.message)
          } finally {
            setLoading(false)
          }
        },
      })
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline', size: 'large', width: 320, text: 'continue_with',
      })
    }

    if (window.google) {
      init()
    } else {
      const interval = setInterval(() => {
        if (window.google) { clearInterval(interval); init() }
      }, 100)
      return () => { cancelled = true; clearInterval(interval) }
    }
    return () => { cancelled = true }
  }, [])
```

Then render the button + a divider inside the card, just **above** the `<form>`:

```jsx
          {GOOGLE_CLIENT_ID && (
            <>
              <div ref={googleBtnRef} className="flex justify-center mb-4" />
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border dark:bg-dark-border" />
                <span className="text-xs text-text-muted dark:text-dark-muted">or</span>
                <div className="h-px flex-1 bg-border dark:bg-dark-border" />
              </div>
            </>
          )}
```

(The button works for both "sign in" and "sign up" modes — Google sign-in creates the
account on first use automatically, so it needs no CAPTCHA.)

### 3d. Frontend env — `frontend/.env` and `frontend/.env.example`

```bash
VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
```

> Vite inlines `VITE_*` variables **at build time**. Setting it after building has no
> effect — you must rebuild the frontend for a new value to take.

---

## Step 4 — Test locally

1. Run the migration on local Postgres (Step 2c).
2. Backend: from `backend/` with the venv active — `uvicorn app.main:app --reload --port 8000`.
3. Frontend: from `frontend/` — `npm run dev` (opens `http://localhost:5173`).
4. Open `/auth`, click **Continue with Google**, pick your (test-user) account.
5. You should land in the app, and `localStorage.pintrip_session` should hold a Pintrip
   `access_token`. Check the backend created a row: `SELECT id, email, google_sub FROM users;`.
6. Sign out and back in — it should reuse the same user (matched by `google_sub`).

---

## Step 5 — Deploy

**Backend** (code is baked into the Docker image, so a redeploy is required):

1. Add `GOOGLE_CLIENT_ID=...` to the server file `~/Pintrip/backend/.env`.
2. Run the migration (Step 2c) against **RDS**.
3. Deploy on the EC2 box (`ssh aws`):

```bash
cd ~/Pintrip
git pull
docker build -t pintrip-backend ./backend
docker stop pintrip && docker rm pintrip
docker run -d --name pintrip --env-file ~/Pintrip/backend/.env -p 8000:8000 --restart unless-stopped pintrip-backend
```

(Or run `~/deploy.sh` if it already does the above.)

**Frontend**: set `VITE_GOOGLE_CLIENT_ID` in whatever builds `pintrip.hohosan.site`, then
rebuild (`npm run build`) and redeploy the static output.

**Google Console**: confirm `https://pintrip.hohosan.site` is in **Authorized JavaScript
origins**, and **Publish** the OAuth consent screen so non-test users can sign in.

---

## Security checklist

- ✅ The backend **verifies** the ID token (`verify_oauth2_token` checks signature, expiry,
  issuer `accounts.google.com`, and audience == your client id). Never trust the token
  client-side or skip verification.
- ✅ We require `email_verified` before creating/matching a user.
- ✅ `/auth/google` is rate-limited (`10/minute`) like `/auth/login`.
- ✅ The Pintrip JWT (not the Google token) is what the app stores and sends — the Google
  token is used once and discarded.
- ✅ CORS already allows `http://localhost:5173` and the prod origin (`ALLOWED_ORIGINS`).
- Keep `JWT_SECRET` secret and strong; the Google **Client ID is public** and safe to ship
  in the frontend bundle.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Button doesn't render | GIS script missing in `index.html`, or `VITE_GOOGLE_CLIENT_ID` unset at build time. |
| `The given origin is not allowed` (console) | Add the exact origin (scheme + host + port, no path) to **Authorized JavaScript origins**. |
| 401 `Invalid Google credential` | `GOOGLE_CLIENT_ID` on the backend ≠ the client id that minted the token, or token expired. |
| 500 `Google sign-in is not configured` | `GOOGLE_CLIENT_ID` missing from `backend/.env`. |
| `column users.google_sub does not exist` | Migration (Step 2c) not run on that database. |
| Can sign in but not with a test account | Consent screen still in **Testing** and account not in **Test users**, or app not published. |

---

## Alternative: Authorization-Code flow (not recommended here)

If you ever need Google **refresh tokens** or server-side access to Google APIs (Drive,
Calendar, etc.), you'd use the authorization-code flow (`Authlib`, a client **secret**, a
redirect URI like `https://api.hohosan.site/auth/google/callback`, and `state` handling).
It's more moving parts and unnecessary for plain login, so the ID-token flow above is the
right choice for Pintrip.
```
