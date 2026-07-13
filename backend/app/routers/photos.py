"""Photo upload and listing router."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.auth import require_user
from app.database import get_db
from app.limiter import limiter
from app.models import Photo
from app.services.exif import extract_gps
from app.services.storage import (
    build_storage_path,
    create_presigned_upload_url,
    create_signed_photo_url,
    delete_photos,
    download_photo_bytes,
    public_url_for,
)

router = APIRouter()


class PresignRequest(BaseModel):
    filename: str
    content_type: str
    place_id: str


class ConfirmRequest(BaseModel):
    storage_path: str
    place_id: str


def _require_user(authorization: Optional[str]) -> str:
    return require_user(authorization)


def _with_signed_url(photo: Photo) -> dict:
    return {
        "id": photo.id,
        "place_id": photo.place_id,
        "user_id": photo.user_id,
        "storage_path": photo.storage_path,
        "public_url": photo.public_url,
        "exif_lat": photo.exif_lat,
        "exif_lng": photo.exif_lng,
        "ai_caption": photo.ai_caption,
        "ai_tags": photo.ai_tags,
        "created_at": photo.created_at.isoformat() if photo.created_at else None,
        "signed_url": create_signed_photo_url(photo.storage_path, expires_in=3600) if photo.storage_path else None,
    }


@router.post("/presign")
@limiter.limit("10/minute")
def presign_upload(
    request: Request,
    body: PresignRequest,
    authorization: Optional[str] = Header(None),
):
    user_id = _require_user(authorization)
    if not body.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    storage_path = build_storage_path(body.filename, user_id)
    upload_url = create_presigned_upload_url(storage_path, body.content_type)
    return {"upload_url": upload_url, "storage_path": storage_path}


@router.post("/confirm", status_code=201)
@limiter.limit("10/minute")
def confirm_upload(
    request: Request,
    body: ConfirmRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    if not body.storage_path.startswith(f"{user_id}/"):
        raise HTTPException(status_code=403, detail="Invalid storage path")

    image_bytes = download_photo_bytes(body.storage_path)
    gps = extract_gps(image_bytes)

    photo = Photo(
        id=str(uuid.uuid4()),
        place_id=body.place_id,
        user_id=user_id,
        storage_path=body.storage_path,
        public_url=public_url_for(body.storage_path),
        exif_lat=gps.get("lat") if gps else None,
        exif_lng=gps.get("lng") if gps else None,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    result = _with_signed_url(photo)
    result["exif_gps"] = gps
    return result


@router.get("/{place_id}")
@limiter.limit("30/minute")
def list_photos(
    request: Request,
    place_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    photos = (
        db.query(Photo)
        .filter(Photo.place_id == place_id, Photo.user_id == user_id)
        .order_by(Photo.created_at)
        .all()
    )
    return [_with_signed_url(p) for p in photos]


@router.delete("/{photo_id}", status_code=204)
@limiter.limit("30/minute")
def delete_photo(
    request: Request,
    photo_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    photo = db.query(Photo).filter(Photo.id == photo_id, Photo.user_id == user_id).first()
    if photo:
        if photo.storage_path:
            delete_photos([photo.storage_path])
        db.delete(photo)
        db.commit()
