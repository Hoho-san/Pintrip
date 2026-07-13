"""
turnstile.py — Cloudflare Turnstile CAPTCHA verification for /auth/register.
"""
import httpx

from app.config import settings

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile_token(token: str, remote_ip: str | None = None) -> bool:
    if not settings.turnstile_secret_key:
        return True

    if not token:
        return False

    data = {"secret": settings.turnstile_secret_key, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.post(VERIFY_URL, data=data)
            resp.raise_for_status()
        except httpx.HTTPError:
            return False

    return resp.json().get("success", False)
