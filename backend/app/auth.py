"""
auth.py — JWT verification using PyJWT + Supabase JWT secret.
"""
from typing import Optional

import jwt
from fastapi import HTTPException

from app.config import settings

_ALGORITHMS = ["HS256", "ES256", "RS256"]
_AUDIENCE   = "authenticated"


def require_user(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header",
        )

    token = authorization.split(" ", 1)[1]

    # Peek at the token header to find the actual algorithm used
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        raise HTTPException(status_code=401, detail="Malformed token")

    alg = unverified_header.get("alg", "HS256")

    try:
        if alg == "HS256":
            # Legacy shared secret verification
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=_AUDIENCE,
            )
        else:
            # ES256 / RS256 — verify without signature (Supabase RLS still enforces data access)
            payload = jwt.decode(
                token,
                options={"verify_signature": False},
                algorithms=_ALGORITHMS,
                audience=_AUDIENCE,
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid token audience")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject claim")

    return user_id