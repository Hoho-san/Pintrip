"""
exif.py — Extract GPS coordinates from image bytes using Pillow.
Converts DMS (degrees, minutes, seconds) to decimal degrees.
"""
import io
from typing import Optional

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS


def _dms_to_decimal(dms: tuple, ref: str) -> float:
    """Convert a DMS tuple ((d,1),(m,1),(s,1)) and hemisphere ref to decimal degrees."""
    degrees   = dms[0][0] / dms[0][1]
    minutes   = dms[1][0] / dms[1][1]
    seconds   = dms[2][0] / dms[2][1]
    decimal   = degrees + minutes / 60 + seconds / 3600
    if ref in ("S", "W"):
        decimal = -decimal
    return round(decimal, 7)


def extract_gps(image_bytes: bytes) -> Optional[dict]:
    """
    Returns {"lat": float, "lng": float} if GPS EXIF data is present,
    otherwise returns None.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        exif_data = image._getexif()
        if not exif_data:
            return None

        # Map numeric tags → name
        tagged = {TAGS.get(k, k): v for k, v in exif_data.items()}
        gps_info_raw = tagged.get("GPSInfo")
        if not gps_info_raw:
            return None

        # Map GPS sub-tags
        gps = {GPSTAGS.get(k, k): v for k, v in gps_info_raw.items()}

        lat = _dms_to_decimal(gps["GPSLatitude"], gps["GPSLatitudeRef"])
        lng = _dms_to_decimal(gps["GPSLongitude"], gps["GPSLongitudeRef"])
        return {"lat": lat, "lng": lng}

    except Exception:
        return None
