# CI/CD Plan — Pintrip Backend (Docker + GitHub Actions + AWS EC2)

## Current state (confirmed from the repo)

- `backend/Dockerfile` already exists — multi-stage build, but no non-root user, no healthcheck, and it `COPY . .` (grabs `.venv`, `.env` etc. unless excluded — `.dockerignore` already excludes those correctly, good).
- No `.github/` directory — zero CI/CD today.
- No tests anywhere in `backend/`.
- Config is env-var driven via `pydantic-settings` (`app/config.py`), reads `DATABASE_URL`, AWS creds, JWT secret, Groq key, Turnstile key — already 12-factor-friendly.
- Deploy today is manual: a gitignored `deploy.sh` gets scp'd to the EC2 box.
- README is stale (says Fly.io/Supabase/Gemini) — actual stack is EC2 + Postgres (via `DATABASE_URL`) + S3 + Groq.

Goal: replace "scp a script and run it by hand" with "push to `main` → image builds → EC2 pulls and restarts."

---

## Part 1 — Harden the Dockerfile

Runtime stage needs:

1. **Non-root user** — right now the container runs as root.
2. **Healthcheck** — wire in the existing `/health` endpoint (`app/main.py`).

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY . .

RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`curl` isn't in `python:3.12-slim` — add `RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*` in the runtime stage, or swap the healthcheck for a small Python one-liner to avoid the extra package.

Add a `docker-compose.yml` for **local dev only** (app + Postgres), so tests and CI can spin up a real database instead of mocking it:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: pintrip
      POSTGRES_PASSWORD: pintrip
      POSTGRES_DB: pintrip
    ports: ["5432:5432"]
  api:
    build: .
    env_file: .env
    ports: ["8000:8000"]
    depends_on: [db]
```

---

## Part 2 — Add tests

Nothing exists yet, so start minimal and real:

1. `requirements-dev.txt` (or a `[dev]` extra): `pytest`, `pytest-asyncio`, `httpx`, `pytest-cov`.
2. `backend/tests/conftest.py` — spins up a `TestClient(app)` against a throwaway SQLite or a test Postgres DB (override `DATABASE_URL` via env before import, or override the `get_db` dependency).
3. Start with what's cheap and high-value:
   - `test_health.py` — hits `/health`, asserts 200. Trivial but proves the pipeline works end-to-end.
   - `test_auth.py` — register/login flow (Turnstile + JWT — highest-risk code).
   - `test_places.py` / `test_photos.py` — smoke tests for the CRUD routers.
4. Run locally: `pytest -v --cov=app` from `backend/`.

Don't aim for 100% coverage day one — auth and the health check are the two things that must never silently break; grow from there.

---

## Part 3 — CI workflow (runs on every push/PR)

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: pintrip
          POSTGRES_PASSWORD: pintrip
          POSTGRES_DB: pintrip
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
          cache-dependency-path: backend/requirements.txt
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: pytest -v --cov=app
        env:
          DATABASE_URL: postgresql://pintrip:pintrip@localhost:5432/pintrip
          JWT_SECRET: test-secret
          ENVIRONMENT: test

  docker-build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v6
        with:
          context: backend
          push: false   # build-only check on PRs, proves the image builds
```

This catches broken code and broken Docker builds before anything touches `main`.

---

## Part 4 — CD workflow (deploy to EC2 on merge to `main`)

Registry choice: **GHCR (GitHub Container Registry)** — free, no extra AWS IAM setup, auto-authenticated via `GITHUB_TOKEN`. (ECR is the alternative if you want everything inside AWS/IAM; more setup, no real benefit here since no other AWS container services are in play.)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        run: echo "tags=ghcr.io/${{ github.repository_owner }}/pintrip-backend:${{ github.sha }}" >> "$GITHUB_OUTPUT"
      - uses: docker/build-push-action@v6
        with:
          context: backend
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/pintrip-backend:${{ github.sha }}
            ghcr.io/${{ github.repository_owner }}/pintrip-backend:latest

  deploy:
    runs-on: ubuntu-latest
    needs: build-and-push
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            echo "${{ secrets.GHCR_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker pull ghcr.io/${{ github.repository_owner }}/pintrip-backend:latest
            docker stop pintrip-backend || true
            docker rm pintrip-backend || true
            docker run -d --name pintrip-backend \
              --restart unless-stopped \
              -p 8000:8000 \
              --env-file /home/${{ secrets.EC2_USER }}/pintrip/.env \
              ghcr.io/${{ github.repository_owner }}/pintrip-backend:latest
            docker image prune -f
```

This replaces `deploy.sh` entirely — no more manual scp.

---

## Part 5 — One-time EC2 setup

Do this once, by hand, on the instance:

1. Install Docker: `curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER` (relogin after).
2. Create `/home/<user>/pintrip/.env` on the box with the real production secrets (`DATABASE_URL`, `JWT_SECRET`, AWS keys, `GROQ_API_KEY`, `TURNSTILE_SECRET_KEY`, `ALLOWED_ORIGINS`, `ENVIRONMENT=production`) — this file **never** goes in git or GHCR, only lives on the server, matching what already happens with `.env`.
3. Generate a dedicated SSH keypair for GitHub Actions (`ssh-keygen -t ed25519 -f gh-deploy-key`), add the public key to the EC2 instance's `~/.ssh/authorized_keys`, keep the private key for GitHub Secrets.
4. Make sure the EC2 security group allows inbound on the port exposed (8000, or put Nginx/ALB in front on 80/443 — recommended if not already terminating TLS).

## Part 6 — GitHub repo secrets to add

`Settings → Secrets and variables → Actions`:
- `EC2_HOST` — instance public IP/DNS
- `EC2_USER` — e.g. `ubuntu`
- `EC2_SSH_KEY` — the private key from step 5.3
- `GHCR_TOKEN` — a PAT with `read:packages` scope (so the EC2 box can pull; `GITHUB_TOKEN` in the workflow itself is fine for push, but the remote `docker login` on the server needs a real PAT)

(`GITHUB_TOKEN` is auto-provided by Actions, no need to create it.)

---

## Suggested order of implementation

1. Harden Dockerfile + add `docker-compose.yml` for local dev.
2. Add `tests/` with the health-check + auth smoke tests, get `pytest` green locally.
3. Land `ci.yml`, confirm it's green on a PR.
4. Do the one-time EC2 prep (Docker, `.env`, SSH key, GHCR PAT).
5. Add the GitHub Secrets.
6. Land `deploy.yml`, merge to `main`, watch the first automated deploy, verify `/health` on the EC2 host.
