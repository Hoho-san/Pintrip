"""Photo upload and listing router."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, File, Form, Header, UploadFile
from starlette.requests import Request

from app.limiter import limiter
from app.services.exif import extract_gps
from app.services.storage import upload_photo, get_supabase_client, create_signed_photo_url
from app.routers.places import _require_user

router = APIRouter()


def _with_signed_url(row: dict) -> dict:
    row = dict(row)
    if row.get("storage_path"):
        row["signed_url"] = create_signed_photo_url(row["storage_path"], expires_in=3600)
    else:
        row["signed_url"] = None
    return row


@router.post("/upload", status_code=201)
@limiter.limit("10/minute")
async def upload_photo_endpoint(
    request: Request,
    file: UploadFile = File(...),
    place_id: str = Form(...),
    authorization: Optional[str] = Header(None),
):
    user_id = _require_user(authorization)
    image_bytes = await file.read()

    gps = extract_gps(image_bytes)

    storage_path, public_url = upload_photo(
        image_bytes=image_bytes,
        filename=file.filename or "photo.jpg",
        user_id=user_id,
    )

    sb = get_supabase_client()
    row = {
        "place_id": place_id,
        "user_id": user_id,
        "storage_path": storage_path,
        "public_url": public_url,
        "exif_lat": gps.get("lat") if gps else None,
        "exif_lng": gps.get("lng") if gps else None,
    }
    res = sb.table("photos").insert(row).execute()
    saved = res.data[0]
    saved["signed_url"] = create_signed_photo_url(storage_path, expires_in=3600)
    return {**saved, "exif_gps": gps}


@router.get("/{place_id}")
@limiter.limit("10/minute")
def list_photos(request: Request, place_id: UUID, authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()
    res = (
        sb.table("photos")
        .select("*")
        .eq("place_id", str(place_id))
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return [_with_signed_url(row) for row in (res.data or [])]


@router.delete("/{photo_id}", status_code=204)
@limiter.limit("10/minute")
def delete_photo(request: Request, photo_id: UUID, authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()
    res = (
        sb.table("photos")
        .select("storage_path")
        .eq("id", str(photo_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if res.data:
        sb.storage.from_("pintrip-photos").remove([res.data["storage_path"]])
        sb.table("photos").delete().eq("id", str(photo_id)).execute()