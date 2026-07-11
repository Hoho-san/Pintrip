from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.database import get_db
from app.limiter import limiter
from app.models import Photo
from app.routers.places import _require_user
from app.services.gemini import generate_caption, generate_story, generate_chat_reply

router = APIRouter()


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


@router.post("/chat")
@limiter.limit("20/minute")
async def chat_endpoint(
    request: Request,
    body: ChatRequest,
    authorization: Optional[str] = Header(None),
):
    _require_user(authorization)
    try:
        reply = await generate_chat_reply(body.messages)
        return {"reply": reply}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
