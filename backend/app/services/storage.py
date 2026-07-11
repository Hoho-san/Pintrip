import mimetypes
import uuid
from functools import lru_cache

from supabase import create_client, Client

from app.config import settings

BUCKET = "pintrip-photos"


@lru_cache(maxsize=1)
def _get_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)


def upload_photo(image_bytes: bytes, filename: str, user_id: str) -> tuple[str, str]:
    sb = _get_client()
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    storage_path = f"{user_id}/{unique_name}"
    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"
    sb.storage.from_(BUCKET).upload(
        path=storage_path,
        file=image_bytes,
        file_options={"content-type": content_type, "upsert": "false"},
    )
    file_url = sb.storage.from_(BUCKET).get_public_url(storage_path)
    return storage_path, file_url


def create_signed_photo_url(storage_path: str, expires_in: int = 3600) -> str:
    sb = _get_client()
    result = sb.storage.from_(BUCKET).create_signed_url(storage_path, expires_in)
    signed_url = result.get("signedURL") or result.get("signedUrl")
    if not signed_url:
        raise ValueError(f"Could not generate signed URL for: {storage_path}")
    return signed_url


def delete_photos(storage_paths: list[str]) -> None:
    if not storage_paths:
        return
    _get_client().storage.from_(BUCKET).remove(storage_paths)
