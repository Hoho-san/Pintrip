"""
gemini.py — Groq Llama 4 Scout Vision for captions, Llama 3.3 for stories, chat.
"""
import asyncio
import base64
import io
import json
import mimetypes
import re
from urllib import response
from urllib.parse import urlparse

import httpx
from groq import Groq
from PIL import Image

from app.config import settings
from app.services.storage import create_signed_photo_url

client = Groq(api_key=settings.groq_api_key)

VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
TEXT_MODEL   = "llama-3.3-70b-versatile"

MAX_B64_BYTES = 3 * 1024 * 1024
MAX_DIMENSION = 1280


def _storage_path_from_url(file_url: str) -> str:
    parsed = urlparse(file_url)
    if parsed.scheme == "s3":
        # s3://bucket-name/user_id/file.jpg → user_id/file.jpg
        return parsed.path.lstrip("/")
    raise ValueError(f"Unsupported storage URL: {file_url}")


def _mime_type_from_path(storage_path: str) -> str:
    mime_type, _ = mimetypes.guess_type(storage_path)
    return mime_type or "image/jpeg"


async def _fetch_image_bytes(file_url: str) -> tuple[bytes, str]:
    parsed = urlparse(file_url)
    if parsed.scheme in ("http", "https"):
        # Already a fetchable URL (pre-signed S3 URL from frontend)
        fetch_url = file_url
        storage_path = parsed.path
    else:
        # s3:// URI — generate a signed URL first
        storage_path = _storage_path_from_url(file_url)
        fetch_url = create_signed_photo_url(storage_path, expires_in=120)

    mime_type = _mime_type_from_path(storage_path)
    async with httpx.AsyncClient(timeout=30) as c:
        resp = await c.get(fetch_url)
        resp.raise_for_status()
        return resp.content, mime_type


def _compress_image(image_bytes: bytes) -> tuple[bytes, str]:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    w, h = img.size
    if max(w, h) > MAX_DIMENSION:
        scale = MAX_DIMENSION / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    quality = 85
    while quality >= 40:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        raw = buf.getvalue()
        if len(base64.b64encode(raw)) <= MAX_B64_BYTES:
            return raw, "image/jpeg"
        quality -= 10

    raise ValueError("Image too large to compress under Groq's 4MB base64 limit.")


def _parse_caption_json(text: str) -> dict:
    raw = text.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"^```\s*",     "", raw)
    raw = re.sub(r"\s*```$",     "", raw)
    try:
        data = json.loads(raw)
        return {
            "caption": data.get("caption", "").strip(),
            "tags":    data.get("tags", []) if isinstance(data.get("tags"), list) else [],
        }
    except Exception:
        return {"caption": raw.strip(), "tags": []}


async def generate_caption(image_url: str) -> dict:
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is not configured.")

    image_bytes, _ = await _fetch_image_bytes(image_url)
    compressed, mime_type = _compress_image(image_bytes)

    b64_image = base64.standard_b64encode(compressed).decode("utf-8")
    data_url  = f"data:{mime_type};base64,{b64_image}"

    print(f"Image size after compression: {len(compressed) / 1024:.1f} KB")

    prompt = (
        "You are a travel writer. Look at this photo and respond ONLY with valid JSON:\n"
        '{"caption":"A vivid 1-2 sentence travel caption.","tags":["tag1","tag2","tag3"]}'
    )

    response = client.chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        max_completion_tokens=256,
        response_format={"type": "json_object"},
    )

    msg = response.choices[0].message
    content = msg.content

    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(item.get("text", ""))
            else:
                parts.append(str(item))
        text = "".join(parts).strip()
    else:
        text = str(content).strip()

    if not text:
        raise ValueError(f"Groq returned empty content: {response}")

    return _parse_caption_json(text)


async def generate_story(place_id: str, captions: list[str]) -> str:
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is not configured.")

    if not captions:
        return "I captured a few quiet moments here — each photo telling its own story."

    captions_text = "\n".join(f"- {c}" for c in captions if c.strip())

    prompt = (
        f"You are a travel diarist. Based on these photo captions from a single trip location:\n\n"
        f"{captions_text}\n\n"
        "Write a short personal travel diary entry (max 150 words). "
        "First person, past tense, no bullet points."
    )

    response = client.chat.completions.create(
        model=TEXT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_completion_tokens=300,
        temperature=0.9,
    )

    msg = response.choices[0].message
    content = msg.content

    if isinstance(content, str):
        text = content.strip()
    elif isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(item.get("text", ""))
            else:
                parts.append(str(item))
        text = "".join(parts).strip()
    else:
        text = str(content).strip()

    if not text:
        raise ValueError(f"Groq returned empty story response: {response}")

    return text


# ── AI Chat ───────────────────────────────────────────────────────────────────

async def generate_chat_reply(messages: list, travel_context: str | None = None) -> str:
    """Multi-turn travel assistant chat using Groq."""
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is not configured.")

    system_prompt = (
        "You are a friendly travel assistant for Pintrip, a travel photo map app. "
        "Help users plan trips, discover destinations, write travel captions, "
        "and get the most out of their travel memories. Keep replies concise and helpful."
    )
    if travel_context:
        system_prompt += (
            "\n\nHere is this user's travel history from their Pintrip map. "
            "Use it to personalize your answers — reference the places they've been, "
            "suggest destinations that fit their tastes, and answer questions about "
            "their own trips:\n" + travel_context
        )

    groq_messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    for msg in messages:
        role = msg.role if hasattr(msg, "role") else msg["role"]
        content = msg.content if hasattr(msg, "content") else msg["content"]
        # Groq uses "assistant" not "model"
        groq_messages.append({"role": role, "content": content})

    response = await asyncio.to_thread(
        client.chat.completions.create,
        model=TEXT_MODEL,
        messages=groq_messages,
        max_completion_tokens=400,
        temperature=0.7,
    )

    return response.choices[0].message.content.strip()          