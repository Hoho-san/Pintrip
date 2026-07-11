import mimetypes
import uuid
from functools import lru_cache

import boto3

from app.config import settings


@lru_cache(maxsize=1)
def _s3():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def upload_photo(image_bytes: bytes, filename: str, user_id: str) -> tuple[str, str]:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    storage_path = f"{user_id}/{unique_name}"

    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"

    _s3().put_object(
        Bucket=settings.aws_s3_bucket,
        Key=storage_path,
        Body=image_bytes,
        ContentType=content_type,
    )

    return storage_path, f"s3://{settings.aws_s3_bucket}/{storage_path}"


def create_signed_photo_url(storage_path: str, expires_in: int = 3600) -> str:
    return _s3().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.aws_s3_bucket, "Key": storage_path},
        ExpiresIn=expires_in,
    )


def delete_photos(storage_paths: list[str]) -> None:
    if not storage_paths:
        return
    _s3().delete_objects(
        Bucket=settings.aws_s3_bucket,
        Delete={"Objects": [{"Key": p} for p in storage_paths]},
    )
