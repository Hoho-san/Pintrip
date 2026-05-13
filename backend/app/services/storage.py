import mimetypes
import uuid
from functools import lru_cache

from supabase import create_client, Client

from app.config import settings

BUCKET = "pintrip-photos"


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)


def upload_photo(
    image_bytes: bytes,
    filename: str,
    user_id: str,
) -> tuple[str, str]:
    """
    Upload image_bytes to Supabase Storage under <user_id>/<uuid>.<ext>.
    Returns (storage_path, file_url).
    """
    sb = get_supabase_client()

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    storage_path = f"{user_id}/{unique_name}"

    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"

    sb.storage.from_(BUCKET).upload(
        path=storage_path,
        file=image_bytes,
        file_options={
            "content-type": content_type,
            "upsert": "false",
        },
    )

    # Keep a stable URL-like reference in DB.
    # For private buckets this is NOT directly fetchable by browsers unless bucket is public,
    # but we can derive the storage path from it later and create a signed URL server-side.
    file_url = sb.storage.from_(BUCKET).get_public_url(storage_path)

    return storage_path, file_url


def create_signed_photo_url(storage_path: str, expires_in: int = 60) -> str:
    """
    Create a signed URL for a private object.
    """
    sb = get_supabase_client()
    result = sb.storage.from_(BUCKET).create_signed_url(storage_path, expires_in)

    signed_url = result.get("signedURL") or result.get("signedUrl")
    if not signed_url:
        raise ValueError(f"Could not generate signed URL for: {storage_path}")

    return signed_url