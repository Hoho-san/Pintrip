from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import places, photos, ai

app = FastAPI(
    title="Pintrip API",
    version="1.0.0",
    description="Backend for the Pintrip travel photo map app",
)

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(places.router, prefix="/places", tags=["Places"])
app.include_router(photos.router, prefix="/photos", tags=["Photos"])
app.include_router(ai.router, prefix="/ai", tags=["AI"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "pintrip-api"}
