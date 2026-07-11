from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.routers import places, photos, ai, auth as auth_router
from app.database import engine
from app import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Pintrip API",
    version="1.0.0",
    description="Backend for the Pintrip travel photo map app",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth_router.router, prefix="/auth", tags=["Auth"])
app.include_router(places.router, prefix="/places", tags=["Places"])
app.include_router(photos.router, prefix="/photos", tags=["Photos"])
app.include_router(ai.router, prefix="/ai", tags=["AI"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "pintrip-api"}
