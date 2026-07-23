from datetime import datetime, timedelta, timezone
from typing import Optional
import logging
import uuid

import bcrypt
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from starlette.requests import Request

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.auth import require_user
from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models import User
from app.services.turnstile import verify_turnstile_token

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(AuthRequest):
    # Optional so local dev works with the Turnstile widget disabled; when
    # TURNSTILE_SECRET_KEY is set, verify_turnstile_token rejects a missing token.
    turnstile_token: str | None = None


def _create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _session(user: User) -> dict:
    return {
        "access_token": _create_token(user.id, user.email),
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email},
    }


@router.post("/register", status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    if not await verify_turnstile_token(body.turnstile_token, request.client.host if request.client else None):
        raise HTTPException(status_code=400, detail="CAPTCHA verification failed")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        hashed_password=_hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _session(user)


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, body: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.hashed_password or not _verify(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _session(user)


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
            clock_skew_in_seconds=10,
        )
    except ValueError as exc:
        logger.warning("Google ID token verification failed: %s", exc)
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


@router.get("/me")
@limiter.limit("30/minute")
def me(request: Request, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    user_id = require_user(authorization)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "email": user.email}
