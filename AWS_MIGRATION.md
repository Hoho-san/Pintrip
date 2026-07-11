# Pintrip — AWS Migration Plan

## Current Stack
| Layer | Current | Target |
|---|---|---|
| Frontend | Vercel | **Keep Vercel** (free forever, no change) |
| Backend | Fly.io (FastAPI, Docker) | EC2 t2.micro (`api.hohosan.site`) |
| Database | Supabase PostgreSQL | RDS PostgreSQL (free tier) |
| Auth | Supabase Auth | AWS Cognito (free forever up to 50K MAU) |
| File Storage | Supabase Storage | S3 (free tier) |
| AI | Groq API | Keep (no change) |
| Domain | — | `hohosan.site` via Namecheap DNS |

> **Strategy**: Full migration off Supabase onto AWS. Do phases in order — EC2 first, then RDS, then S3, then Cognito last (auth affects user IDs everywhere).

## Migration Order
| # | Phase | Depends on |
|---|---|---|
| 0 | AWS account + billing alert | — ✅ done |
| 1 | EC2 backend (still pointing to Supabase temporarily) | — |
| 2 | RDS PostgreSQL + migrate schema/data | EC2 |
| 3 | S3 photo storage + migrate files | EC2 |
| 4 | Cognito auth + update frontend | RDS + S3 |
| 5 | Domain (`api.hohosan.site`) | EC2 |
| 6 | Decommission Supabase | All above |

---

## Phase 0 — AWS Account Setup

1. Create an AWS account at https://aws.amazon.com (requires a credit card, but free tier applies)
2. Enable MFA on the root account immediately
3. Create an IAM user with `AdministratorAccess` for day-to-day use — never use root
4. Set your default region to `ap-southeast-1` (Singapore) to match Fly.io's current `sin` region

---

## Phase 1 — Billing Alert (Do This First)

> **Goal**: Get notified by email when spend reaches $5 USD.

### 1.1 — Enable billing alerts
1. Go to **Billing and Cost Management** → **Billing preferences**
2. Check **Receive Free Tier Usage Alerts** (email)
3. Check **Receive Billing Alerts** and save

### 1.2 — Create a $5 Budget
1. Go to **AWS Budgets** → **Create budget**
2. Choose **Cost budget** → **Monthly**
3. Set budgeted amount: `5.00 USD`
4. Add alert: **80% of actual cost** → enter your email (`javierjojo.dev@gmail.com`)
5. Add a second alert: **100% of actual cost** → same email
6. Create budget

### 1.3 — CloudWatch billing alarm (backup)
```bash
# Run in AWS CLI after configuring credentials
aws cloudwatch put-metric-alarm \
  --alarm-name "billing-5usd" \
  --alarm-description "Alert when AWS charges exceed $5" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD \
  --evaluation-periods 1 \
  --alarm-actions <SNS_TOPIC_ARN> \
  --region us-east-1
```
> Note: EstimatedCharges metric is only available in `us-east-1`.

---

## Phase 2 — Frontend: Keep Vercel

No changes needed. Vercel stays as-is — it's free forever on the Hobby plan and auto-deploys on every git push.

The only update needed after the backend is on EC2 is changing `VITE_API_URL` in Vercel's environment variables:
1. Go to Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Update `VITE_API_URL` to `https://api.hohosan.site`
3. Redeploy

---

## Phase 3 — Backend: Fly.io → EC2 t2.micro

### Free tier coverage
- **EC2 t2.micro**: 750 hours/month — free 12 months (covers 1 instance 24/7)
- **EBS**: 30 GB — free 12 months
- **Data transfer out**: 1 GB/month — free

### 3.1 — Launch EC2 instance
1. Go to **EC2** → **Launch Instance**
2. Name: `pintrip-backend`
3. AMI: **Amazon Linux 2023** (free tier eligible)
4. Instance type: **t2.micro** (free tier eligible)
5. Key pair: Create new → download `.pem` file, store safely
6. Security group — add inbound rules:
   | Type | Port | Source |
   |---|---|---|
   | SSH | 22 | My IP |
   | Custom TCP | 8000 | 0.0.0.0/0 |
   | HTTPS | 443 | 0.0.0.0/0 |
7. Storage: 8 GB gp2 (default, within free tier)
8. Launch

### 3.2 — Connect and install Docker
```bash
ssh -i pintrip-key.pem ec2-user@<your-ec2-public-ip>

# Install Docker
sudo yum update -y
sudo yum install -y docker git
sudo service docker start
sudo usermod -aG docker ec2-user
# Log out and back in so group takes effect
exit
ssh -i pintrip-key.pem ec2-user@<your-ec2-public-ip>
```

### 3.3 — Deploy backend
```bash
# Clone your repo (or use git pull if already there)
git clone https://github.com/your-username/Pintrip.git
cd Pintrip/backend

# Create .env
cat > .env << EOF
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
GROQ_API_KEY=your-groq-api-key
ALLOWED_ORIGINS=https://pintrip-your-project.vercel.app
EOF

# Build and run
docker build -t pintrip-backend .
docker run -d \
  --name pintrip-backend \
  --env-file .env \
  -p 8000:8000 \
  --restart unless-stopped \
  pintrip-backend
```

### 3.4 — Verify backend is running
```bash
curl http://<your-ec2-public-ip>:8000/health
# or whichever health-check endpoint you have
```

### 3.5 — Keep the container up across reboots
The `--restart unless-stopped` flag handles this. To confirm:
```bash
docker ps
```

### 3.6 — Update CORS in backend .env
Make sure `ALLOWED_ORIGINS` includes the CloudFront URL (done in 3.3 above).

---

## Phase 4 — Custom Domain (Namecheap + AWS)

**Domain**: `hohosan.site` (registered on Namecheap)

| Subdomain | Purpose | Points to |
|---|---|---|
| `pintrip.hohosan.site` | Pintrip frontend | CloudFront |
| `api.hohosan.site` | Pintrip backend API | EC2 Elastic IP |
| `hamorii.hohosan.site` | Hamorii project | Future (add record when ready) |
| `profile.hohosan.site` | Personal profile | Future (add record when ready) |

> **No Route 53 needed** — DNS is managed directly in Namecheap's dashboard (free). One wildcard cert `*.hohosan.site` covers every subdomain forever. You only do steps 4.1–4.4 once.

### 4.1 — Allocate an Elastic IP for the backend
1. Go to **EC2** → **Elastic IPs** → **Allocate Elastic IP address** → Allocate
2. Select the new IP → **Actions** → **Associate** → choose your `pintrip-backend` instance
3. Note the Elastic IP — this never changes even after reboots

### 4.2 — Request wildcard SSL certificate (ACM)
> CloudFront requires certs in `us-east-1` — switch to that region for this step only.

1. Switch AWS region to **US East (N. Virginia) — us-east-1**
2. Go to **Certificate Manager (ACM)** → **Request certificate**
3. Type: **Public certificate**
4. Add **both** domain names:
   - `hohosan.site`
   - `*.hohosan.site` ← covers ALL subdomains forever
5. Validation method: **DNS validation** → Request
6. Click into the pending cert — you'll see a CNAME validation record, e.g.:
   ```
   Name:  _abc123def456.hohosan.site
   Value: _xyz789ghi.acm-validations.aws
   ```

### 4.3 — Add ACM validation record in Namecheap
1. Log in to **Namecheap** → Domain List → **Manage** `hohosan.site` → **Advanced DNS**
2. Click **Add New Record**:
   | Type | Host | Value | TTL |
   |---|---|---|---|
   | CNAME | `_abc123def456` (strip `.hohosan.site` from the Name) | `_xyz789ghi.acm-validations.aws` | Automatic |
3. Save — wait ~5 minutes → ACM status changes to **Issued**

### 4.4 — Add all DNS records in Namecheap

Still in **Namecheap** → Advanced DNS → **Add New Record** for each:

**Pintrip frontend** → CloudFront
| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME Record | `pintrip` | `d1234abcd.cloudfront.net` | Automatic |

**Pintrip backend API** → EC2
| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `api` | `<your-elastic-ip>` | Automatic |

**Future projects** — add when ready, same pattern:
| Type | Host | Value |
|---|---|---|
| CNAME Record | `hamorii` | wherever Hamorii is hosted |
| CNAME Record | `profile` | wherever profile site is hosted |

> Namecheap DNS changes propagate in under 30 minutes.

### 4.5 — Attach custom domain to CloudFront (Pintrip frontend)
1. Go to **CloudFront** → your Pintrip distribution → **Edit**
2. **Alternate domain names (CNAMEs)**: add `pintrip.hohosan.site`
3. **Custom SSL certificate**: select the `*.hohosan.site` cert from step 4.2
4. Save — wait ~10 minutes to deploy

### 4.7 — Add HTTPS to backend via Nginx + Let's Encrypt
SSH into your EC2 instance:
```bash
sudo yum install -y nginx certbot python3-certbot-nginx

# Nginx reverse proxy config for API
sudo tee /etc/nginx/conf.d/api.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name api.hohosan.site;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo systemctl start nginx
sudo systemctl enable nginx

# Issue cert (Certbot auto-adds HTTPS block to Nginx config)
sudo certbot --nginx -d api.hohosan.site --non-interactive --agree-tos -m javierjojo.dev@gmail.com

# Enable auto-renewal
sudo systemctl enable certbot-renew.timer
```

Update EC2 Security Group to allow inbound port **80** (needed for cert renewal challenges).

> **Adding future subdomains to the same EC2**: Create a new Nginx config file (e.g. `hamorii.conf`) and run `sudo certbot --nginx -d hamorii.hohosan.site`. No new cert request needed — certbot handles it.

### 4.8 — Update env vars

**Backend `.env` on EC2**:
```env
ALLOWED_ORIGINS=https://pintrip.hohosan.site
```
```bash
docker restart pintrip-backend
```

**Frontend `.env` (rebuild)**:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=https://api.hohosan.site
```
```bash
npm run build
aws s3 sync dist/ s3://pintrip-frontend --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

**Supabase dashboard** → Authentication → URL Configuration:
- Site URL: `https://pintrip.hohosan.site`
- Redirect URLs: `https://pintrip.hohosan.site/**`

### 4.9 — Verify all endpoints
```
https://pintrip.hohosan.site       → Pintrip frontend (CloudFront + S3)
https://api.hohosan.site           → FastAPI backend (EC2 via Nginx)
https://api.hohosan.site/docs      → FastAPI Swagger UI
```

Future (add DNS record + Nginx config when ready):
```
https://hamorii.hohosan.site       → Hamorii project
https://profile.hohosan.site       → Personal profile
```

> **Cost**: Namecheap DNS is free. Elastic IP free while attached to a running instance. ACM cert free. Each new subdomain = just a DNS record in Namecheap + Nginx config on EC2, no extra cost.

---

## Phase 5 — Migrate Supabase to AWS (Optional)

Supabase has three components in this project. Each can be migrated independently.

| Component | What it does in the code | AWS replacement | Effort |
|---|---|---|---|
| **Storage** | Photo upload/download with signed URLs (`storage.py`) | S3 + pre-signed URLs | Low |
| **Database** | `sb.table("places").select()` / `.insert()` etc. in all routers | RDS PostgreSQL + SQLAlchemy | Medium |
| **Auth** | JWT issue (frontend), JWT verify (backend `auth.py`) | Cognito | Medium-High |

> **Recommendation**: Migrate Storage first (least code change, S3 is already in your stack). Do DB and Auth together later — they're independent of Storage but coupled to each other.

---

### 5A — Storage: Supabase Storage → S3

**Free tier**: S3 5 GB storage, 20K GET, 2K PUT/month (12 months).

#### 5A.1 — Create a private S3 bucket for photos
1. Go to **S3** → **Create bucket**
2. Name: `pintrip-photos-hohosan`
3. Region: `ap-southeast-1`
4. Keep **Block all public access** ON (photos are private, served via pre-signed URLs)
5. Create bucket

#### 5A.2 — Create IAM user for backend access
1. Go to **IAM** → **Users** → **Create user**
2. Name: `pintrip-backend`
3. Attach policy: **AmazonS3FullAccess** (or scope to just your bucket)
4. Create → **Security credentials** tab → **Create access key** → Application running on EC2
5. Save `Access Key ID` and `Secret Access Key`

#### 5A.3 — Rewrite `backend/app/services/storage.py`

Replace the entire file:
```python
import mimetypes
import uuid
import boto3
from functools import lru_cache
from app.config import settings

BUCKET = "pintrip-photos-hohosan"


@lru_cache(maxsize=1)
def _s3():
    return boto3.client(
        "s3",
        region_name="ap-southeast-1",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def upload_photo(image_bytes: bytes, filename: str, user_id: str) -> tuple[str, str]:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    storage_path = f"{user_id}/{unique_name}"

    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"

    _s3().put_object(
        Bucket=BUCKET,
        Key=storage_path,
        Body=image_bytes,
        ContentType=content_type,
    )

    file_url = f"s3://{BUCKET}/{storage_path}"
    return storage_path, file_url


def create_signed_photo_url(storage_path: str, expires_in: int = 3600) -> str:
    return _s3().generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": storage_path},
        ExpiresIn=expires_in,
    )


def delete_photos(storage_paths: list[str]) -> None:
    if not storage_paths:
        return
    _s3().delete_objects(
        Bucket=BUCKET,
        Delete={"Objects": [{"Key": p} for p in storage_paths]},
    )
```

#### 5A.4 — Update `backend/app/config.py`
Add the new fields:
```python
aws_access_key_id: str = ""
aws_secret_access_key: str = ""
```

#### 5A.5 — Update `backend/.env` on EC2
```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

#### 5A.6 — Update `backend/app/routers/photos.py`
The `delete_photo` route calls `sb.storage.from_(...).remove(...)` directly — replace with:
```python
from app.services.storage import delete_photos
# in delete_photo route:
if res.data:
    delete_photos([res.data["storage_path"]])
    sb.table("photos").delete().eq("id", str(photo_id)).execute()
```
And remove the `get_supabase_client` import from photos.py (still needed in places.py for DB queries until Phase 5B).

#### 5A.7 — Add boto3 to dependencies
```bash
pip install boto3
pip freeze > requirements.txt
```

#### 5A.8 — Migrate existing photos from Supabase Storage → S3
```python
# Run once locally as a migration script
import boto3
from supabase import create_client

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
s3 = boto3.client("s3", region_name="ap-southeast-1", ...)

files = sb.storage.from_("pintrip-photos").list()
for f in files:
    data = sb.storage.from_("pintrip-photos").download(f["name"])
    s3.put_object(Bucket="pintrip-photos-hohosan", Key=f["name"], Body=data)
```

---

### 5B — Database: Supabase (PostgREST) → RDS PostgreSQL

**Free tier**: RDS db.t3.micro, 20 GB, 750 hours/month (12 months).

> This is the biggest change — every `sb.table(...)` call in the routers gets replaced with SQLAlchemy queries. Plan a few hours for this.

#### 5B.1 — Create RDS instance
1. Go to **RDS** → **Create database**
2. Engine: **PostgreSQL 16**
3. Template: **Free tier**
4. Instance: `db.t3.micro`
5. DB name: `pintrip`, username: `pintrip_admin`, set a strong password
6. VPC: same as EC2 — set security group to allow port `5432` from EC2's security group only (not public)
7. Create — takes ~5 minutes, note the endpoint URL

#### 5B.2 — Migrate schema and data
```bash
# On your local machine — dump from Supabase
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --schema=public \
  --no-owner \
  --no-privileges \
  -f pintrip_dump.sql

# Restore into RDS (run from EC2 so it's within the same VPC)
psql "postgresql://pintrip_admin:[PASSWORD]@[RDS_ENDPOINT]:5432/pintrip" < pintrip_dump.sql
```

#### 5B.3 — Add SQLAlchemy to backend
```bash
pip install sqlalchemy asyncpg psycopg2-binary
```

Replace Supabase DB calls in all routers with SQLAlchemy. The pattern changes from:
```python
# Before (Supabase PostgREST)
sb.table("places").select("*").eq("user_id", user_id).execute()

# After (SQLAlchemy)
session.execute(select(Place).where(Place.user_id == user_id)).scalars().all()
```

---

### 5C — Auth: Supabase Auth → AWS Cognito

**Free tier**: 50,000 MAU/month — free forever (no 12-month limit).

> Do this after 5B since auth user IDs (`sub` claim) are used as foreign keys in the DB. You'll need to migrate user IDs or use email as the join key.

#### 5C.1 — Create Cognito User Pool
1. Go to **Cognito** → **Create user pool**
2. Sign-in: **Email**
3. MFA: optional
4. App client: create one, note the **User Pool ID** and **Client ID**
5. Note the JWKS URL: `https://cognito-idp.ap-southeast-1.amazonaws.com/<USER_POOL_ID>/.well-known/jwks.json`

#### 5C.2 — Update backend `auth.py`
Replace the Supabase JWKS URL with Cognito's:
```python
jwks_url = f"https://cognito-idp.ap-southeast-1.amazonaws.com/{settings.cognito_user_pool_id}/.well-known/jwks.json"
# audience changes from "authenticated" to your Cognito Client ID
_AUDIENCE = settings.cognito_client_id
```

#### 5C.3 — Update frontend `supabase.js` → `auth.js`
Replace `@supabase/supabase-js` auth with `amazon-cognito-identity-js`:
```bash
npm install amazon-cognito-identity-js
```
Rewrite sign-up, sign-in, sign-out, and token retrieval calls to use the Cognito SDK.

#### 5C.4 — Migrate existing users
Supabase does not allow exporting password hashes. Options:
- **Force re-register**: simplest, users create a new account on Cognito
- **Magic link**: email all users a "click to migrate your account" link
- **Cognito import**: import users without passwords → they reset on first login

---

### 5D — Decommission Supabase
Only after all three components (5A + 5B + 5C) are verified on AWS:
1. Supabase dashboard → Settings → **Delete project**
2. Remove `SUPABASE_*` env vars from EC2 `.env`
3. Uninstall `supabase` Python package from `requirements.txt`
4. Uninstall `@supabase/supabase-js` from frontend

---

## Phase 6 — Decommission Old Services

Only do this after verifying AWS is working correctly:

1. **Fly.io**: `fly apps destroy pintrip-api`
2. **Vercel**: Keep — it's free and still hosts the frontend
3. **Supabase**: See Phase 5D (only if you completed the full migration)

---

## Free Tier Cheat Sheet

| Service | Free Tier Limit | Notes |
|---|---|---|
| EC2 t2.micro | 750 hrs/month | 12 months only |
| Elastic IP | Free when attached to running instance | Charged if unattached |
| RDS db.t3.micro | 750 hrs/month, 20 GB storage | 12 months only |
| S3 | 5 GB storage, 20K GET, 2K PUT/month | 12 months only |
| Cognito | 50,000 MAU/month | Free forever, no 12-month limit |
| ACM | Free forever | Wildcard cert for `*.hohosan.site` |
| Vercel | Free forever | Frontend stays here |

> After 12 months the free tier expires. At that point, a t2.micro costs ~$8.50/month. Consider switching to **Lightsail** (~$5/month) or **AWS App Runner** for a simpler managed option.

---

## Quick Reference — Key Commands

```bash
# Deploy frontend update
cd frontend && npm run build
aws s3 sync dist/ s3://pintrip-frontend --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"

# Deploy backend update
ssh -i pintrip-key.pem ec2-user@<elastic-ip>   # or: ssh -i pintrip-key.pem ec2-user@api.hohosan.site
cd Pintrip && git pull
cd backend
docker build -t pintrip-backend .
docker stop pintrip-backend && docker rm pintrip-backend
docker run -d --name pintrip-backend --env-file .env -p 8000:8000 --restart unless-stopped pintrip-backend

# Check logs
docker logs pintrip-backend -f
```
