from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.database import get_db
from app.limiter import limiter
from app.models import Photo, Place
from app.routers.places import _require_user
from app.services.gemini import generate_caption, generate_story, generate_chat_reply

router = APIRouter()


def _build_travel_context(db: Session, user_id: str) -> dict:
    """Everything the AI needs to know about the user's travels, as JSON."""
    places = (
        db.query(Place)
        .filter(Place.user_id == user_id)
        .order_by(Place.created_at)
        .all()
    )
    photos = db.query(Photo).filter(Photo.user_id == user_id).all()

    photos_by_place: dict[str, list[Photo]] = {}
    for photo in photos:
        photos_by_place.setdefault(photo.place_id, []).append(photo)

    place_entries = []
    for place in places:
        place_photos = photos_by_place.get(place.id, [])
        captions = [p.ai_caption for p in place_photos if p.ai_caption]
        photo_tags = sorted(
            {tag for p in place_photos if p.ai_tags for tag in p.ai_tags}
        )
        place_entries.append(
            {
                "name": place.name,
                "country": place.country,
                "lat": place.lat,
                "lng": place.lng,
                "visited_at": place.visited_at,
                "notes": place.notes,
                "tags": place.tags or [],
                "photo_count": len(place_photos),
                "photo_tags": photo_tags,
                "photo_captions": captions,
            }
        )

    countries = sorted({p.country for p in places if p.country})
    return {
        "total_places": len(places),
        "total_photos": len(photos),
        "countries": countries,
        "places": place_entries,
    }


def _format_travel_context(ctx: dict) -> str:
    """Compact plain-text version of the travel context for the chat system prompt."""
    if not ctx["total_places"]:
        return "The user hasn't pinned any places on their map yet."

    lines = [
        f"The user has pinned {ctx['total_places']} place(s) with "
        f"{ctx['total_photos']} photo(s) across {len(ctx['countries'])} "
        f"countr{'y' if len(ctx['countries']) == 1 else 'ies'}"
        + (f": {', '.join(ctx['countries'])}." if ctx["countries"] else ".")
    ]
    # Cap places and truncate free text so the prompt stays within token budget
    for place in ctx["places"][:50]:
        title = place["name"] + (f", {place['country']}" if place["country"] else "")
        bits = []
        if place["visited_at"]:
            bits.append(f"visited {place['visited_at']}")
        bits.append(f"{place['photo_count']} photo(s)")
        tags = (place["tags"] + place["photo_tags"])[:8]
        if tags:
            bits.append("tags: " + ", ".join(tags))
        if place["notes"]:
            bits.append("notes: " + place["notes"][:200])
        if place["photo_captions"]:
            bits.append(
                "photo captions: "
                + " | ".join(c[:120] for c in place["photo_captions"][:3])
            )
        lines.append(f"- {title} ({'; '.join(bits)})")
    return "\n".join(lines)


class CaptionRequest(BaseModel):
    image_url: str
    photo_id: Optional[str] = None


class StoryRequest(BaseModel):
    place_id: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("/caption")
@limiter.limit("10/minute")
async def caption_endpoint(
    request: Request,
    body: CaptionRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    _require_user(authorization)
    try:
        result = await generate_caption(body.image_url)
        if body.photo_id:
            photo = db.query(Photo).filter(Photo.id == body.photo_id).first()
            if photo:
                photo.ai_caption = result["caption"]
                photo.ai_tags = result["tags"]
                db.commit()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Caption generation failed: {str(e)}")


@router.post("/story")
@limiter.limit("10/minute")
async def story_endpoint(
    request: Request,
    body: StoryRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    photos = (
        db.query(Photo)
        .filter(Photo.place_id == body.place_id, Photo.user_id == user_id)
        .all()
    )
    if not photos:
        raise HTTPException(status_code=404, detail="No photos found for this place")
    captions = [p.ai_caption for p in photos if p.ai_caption]
    try:
        story = await generate_story(place_id=body.place_id, captions=captions)
        return {"story": story}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Story generation failed: {str(e)}")


@router.get("/context")
@limiter.limit("30/minute")
async def context_endpoint(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """The user's full travel profile — places, photos, tags, captions, stats."""
    user_id = _require_user(authorization)
    return _build_travel_context(db, user_id)


@router.post("/chat")
@limiter.limit("20/minute")
async def chat_endpoint(
    request: Request,
    body: ChatRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    user_id = _require_user(authorization)
    travel_context = _format_travel_context(_build_travel_context(db, user_id))
    try:
        reply = await generate_chat_reply(body.messages, travel_context=travel_context)
        return {"reply": reply}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
