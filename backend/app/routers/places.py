"""CRUD router for travel places."""
import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.auth import require_user
from app.database import get_db
from app.limiter import limiter
from app.models import Photo, Place
from app.services.storage import create_signed_photo_url, delete_photos

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=4)


class PlaceCreate(BaseModel):
    name: str
    country: Optional[str] = None
    lat: float
    lng: float
    visited_at: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    cover_photo: Optional[str] = None
    marker_style: Optional[str] = "photo"


class PlaceUpdate(PlaceCreate):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    marker_style: Optional[str] = None


def _require_user(authorization: Optional[str]) -> str:
    return require_user(authorization)


def _place_dict(place: Place) -> dict:
    return {
        "id": place.id,
        "user_id": place.user_id,
        "name": place.name,
        "country": place.country,
        "lat": place.lat,
        "lng": place.lng,
        "visited_at": place.visited_at,
        "notes": place.notes,
        "tags": place.tags or [],
        "cover_photo": place.cover_photo,
        "marker_style": place.marker_style,
        "created_at": place.created_at.isoformat() if place.created_at else None,
    }


def _with_signed_cover(place: Place) -> dict:
    d = _place_dict(place)
    cover_path = place.cover_photo
    if cover_path and "/" in cover_path:
        try:
            d["cover_signed_url"] = create_signed_photo_url(cover_path, expires_in=3600)
        except Exception:
            d["cover_signed_url"] = None
    else:
        d["cover_signed_url"] = None
    return d


async def _with_signed_cover_async(place: Place) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _with_signed_cover, place)


@router.get("/")
@limiter.limit("10/minute")
async def list_places(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    places = (
        db.query(Place)
        .filter(Place.user_id == user_id)
        .order_by(Place.created_at.desc())
        .all()
    )
    if not places:
        return []
    return await asyncio.gather(*[_with_signed_cover_async(p) for p in places])


@router.post("/", status_code=201)
@limiter.limit("10/minute")
async def create_place(
    request: Request,
    body: PlaceCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    place = Place(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=body.name,
        country=body.country,
        lat=body.lat,
        lng=body.lng,
        visited_at=body.visited_at,
        notes=body.notes,
        tags=body.tags or [],
        cover_photo=body.cover_photo,
        marker_style=body.marker_style or "photo",
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return await _with_signed_cover_async(place)


@router.get("/{place_id}")
@limiter.limit("10/minute")
async def get_place(
    request: Request,
    place_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    place = db.query(Place).filter(Place.id == place_id, Place.user_id == user_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    return await _with_signed_cover_async(place)


@router.put("/{place_id}")
@limiter.limit("10/minute")
async def update_place(
    request: Request,
    place_id: str,
    body: PlaceUpdate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    place = db.query(Place).filter(Place.id == place_id, Place.user_id == user_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(place, field, value)
    db.commit()
    db.refresh(place)
    return await _with_signed_cover_async(place)


@router.delete("/{place_id}", status_code=204)
@limiter.limit("10/minute")
def delete_place(
    request: Request,
    place_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    photos = (
        db.query(Photo)
        .filter(Photo.place_id == place_id, Photo.user_id == user_id)
        .all()
    )
    storage_paths = [p.storage_path for p in photos if p.storage_path]
    if storage_paths:
        delete_photos(storage_paths)
    db.query(Photo).filter(Photo.place_id == place_id, Photo.user_id == user_id).delete()
    db.query(Place).filter(Place.id == place_id, Place.user_id == user_id).delete()
    db.commit()
