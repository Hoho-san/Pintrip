# TODO

## Infra / AWS

- [ ] **Apply S3 CORS policy** on `pintrip-photos-hohosan` so direct browser → S3 photo uploads (presigned PUT) work.

  Console: S3 → bucket → **Permissions** tab → **Cross-origin resource sharing (CORS)** → Edit → paste:

  ```json
  [
    {
      "AllowedOrigins": ["https://pintrip.hohosan.site", "http://localhost:5173"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["Content-Type"],
      "ExposeHeaders": [],
      "MaxAgeSeconds": 3000
    }
  ]
  ```

  CLI equivalent:
  ```bash
  aws s3api put-bucket-cors --bucket pintrip-photos-hohosan --cors-configuration file://cors.json
  ```

  Confirm actual frontend domain (`pintrip.hohosan.site` vs a `*.vercel.app` URL) and update `AllowedOrigins` to match — also update `ALLOWED_ORIGINS` in `backend/.env` accordingly, since it still has a placeholder value.

- [ ] Set `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY` on production deploy targets (EC2 env + Vercel project env vars) — currently only set in local `.env` files.

- [ ] Restrict EC2 security group (only 80/443 from internet, no direct 8000/uvicorn or SSH from `0.0.0.0/0`).
