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


def build_storage_path(filename: str, user_id: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"{user_id}/{uuid.uuid4().hex}.{ext}"


def public_url_for(storage_path: str) -> str:
    return f"s3://{settings.aws_s3_bucket}/{storage_path}"


def create_presigned_upload_url(storage_path: str, content_type: str, expires_in: int = 300) -> str:
    return _s3().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.aws_s3_bucket, "Key": storage_path, "ContentType": content_type},
        ExpiresIn=expires_in,
    )


def download_photo_bytes(storage_path: str) -> bytes:
    obj = _s3().get_object(Bucket=settings.aws_s3_bucket, Key=storage_path)
    return obj["Body"].read()


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
