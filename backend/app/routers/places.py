"""CRUD router for travel places."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from app.services.storage import get_supabase_client, create_signed_photo_url

router = APIRouter()


class PlaceCreate(BaseModel):
    name: str
    country: Optional[str] = None
    lat: float
    lng: float
    visited_at: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = []
    cover_photo: Optional[str] = None   # store storage_path, not public URL


class PlaceUpdate(PlaceCreate):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


def _require_user(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    import base64, json
    token = authorization.split(" ")[1]
    try:
        payload_b64 = token.split(".")[1]
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Could not decode JWT")


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


@router.get("/")
def list_places(authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()
    res = (
        sb.table("places")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_with_signed_cover(row) for row in (res.data or [])]


@router.post("/", status_code=201)
def create_place(body: PlaceCreate, authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()
    row = body.model_dump()
    row["user_id"] = user_id
    res = sb.table("places").insert(row).execute()
    return _with_signed_cover(res.data[0])


@router.get("/{place_id}")
def get_place(place_id: UUID, authorization: Optional[str] = Header(None)):
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
    return _with_signed_cover(res.data)


@router.put("/{place_id}")
def update_place(place_id: UUID, body: PlaceUpdate, authorization: Optional[str] = Header(None)):
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
    return _with_signed_cover(res.data[0])


@router.delete("/{place_id}", status_code=204)
def delete_place(place_id: UUID, authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()

    photos_res = (
        sb.table("photos")
        .select("storage_path")
        .eq("place_id", str(place_id))
        .eq("user_id", user_id)
        .execute()
    )

    storage_paths = [row["storage_path"] for row in (photos_res.data or []) if row.get("storage_path")]
    if storage_paths:
        sb.storage.from_("pintrip-photos").remove(storage_paths)

    sb.table("places").delete().eq("id", str(place_id)).eq("user_id", user_id).execute()