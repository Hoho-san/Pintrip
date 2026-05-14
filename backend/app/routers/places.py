"""CRUD router for travel places."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from app.auth import require_user
from app.services.storage import get_supabase_client, create_signed_photo_url

router = APIRouter()

# Small thread pool for blocking signed URL generation calls
_executor = ThreadPoolExecutor(max_workers=4)


class PlaceCreate(BaseModel):
    name: str
    country: Optional[str] = None
    lat: float
    lng: float
    visited_at: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    cover_photo: Optional[str] = None   # store storage_path, not public URL
    marker_style: Optional[str] = "photo"  # photo | pin | flag


class PlaceUpdate(PlaceCreate):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    marker_style: Optional[str] = None


# Keep a thin shim so routers/photos.py and routers/ai.py can keep their
# existing `from app.routers.places import _require_user` import unchanged.
def _require_user(authorization: Optional[str]) -> str:
    return require_user(authorization)


def _with_signed_cover(place: dict) -> dict:
    place = dict(place)
    cover_path = place.get("cover_photo")
    if cover_path and "/" in cover_path:
        try:
            place["cover_signed_url"] = create_signed_photo_url(cover_path, expires_in=3600)
        except Exception:
            place["cover_signed_url"] = None
    else:
        place["cover_signed_url"] = None
    return place


async def _with_signed_cover_async(place: dict) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _with_signed_cover, place)


@router.get("/")
async def list_places(authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()

    res = (
        sb.table("places")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    rows = res.data or []
    if not rows:
        return []

    return await asyncio.gather(*[_with_signed_cover_async(row) for row in rows])


@router.post("/", status_code=201)
async def create_place(body: PlaceCreate, authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()

    row = body.model_dump()
    row["tags"] = row.get("tags") or []
    row["marker_style"] = row.get("marker_style") or "photo"
    row["user_id"] = user_id

    res = sb.table("places").insert(row).execute()
    return await _with_signed_cover_async(res.data[0])


@router.get("/{place_id}")
async def get_place(place_id: UUID, authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()

    res = (
        sb.table("places")
        .select("*")
        .eq("id", str(place_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Place not found")

    return await _with_signed_cover_async(res.data)


@router.put("/{place_id}")
async def update_place(
    place_id: UUID,
    body: PlaceUpdate,
    authorization: Optional[str] = Header(None),
):
    user_id = _require_user(authorization)
    sb = get_supabase_client()

    updates = {k: v for k, v in body.model_dump().items() if v is not None}

    res = (
        sb.table("places")
        .update(updates)
        .eq("id", str(place_id))
        .eq("user_id", user_id)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Place not found")

    return await _with_signed_cover_async(res.data[0])


@router.delete("/{place_id}", status_code=204)
async def delete_place(place_id: UUID, authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()

    photos_res = (
        sb.table("photos")
        .select("storage_path")
        .eq("place_id", str(place_id))
        .eq("user_id", user_id)
        .execute()
    )

    storage_paths = [
        row["storage_path"]
        for row in (photos_res.data or [])
        if row.get("storage_path")
    ]

    if storage_paths:
        sb.storage.from_("pintrip-photos").remove(storage_paths)

    sb.table("places").delete().eq("id", str(place_id)).eq("user_id", user_id).execute()