from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from starlette.requests import Request

from app.limiter import limiter
from app.services.gemini import generate_caption, generate_story
from app.services.storage import get_supabase_client
from app.routers.places import _require_user

router = APIRouter()


class CaptionRequest(BaseModel):
    image_url: str
    photo_id: Optional[str] = None


class StoryRequest(BaseModel):
    place_id: str


@router.post("/caption")
@limiter.limit("10/minute")
async def caption_endpoint(request: Request, body: CaptionRequest, authorization: Optional[str] = Header(None)):
    _require_user(authorization)
    try:
        result = await generate_caption(body.image_url)

        if body.photo_id:
            sb = get_supabase_client()
            sb.table("photos").update({
                "ai_caption": result["caption"],
                "ai_tags": result["tags"],
            }).eq("id", body.photo_id).execute()

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Caption generation failed: {str(e)}")


@router.post("/story")
@limiter.limit("10/minute")
async def story_endpoint(request: Request, body: StoryRequest, authorization: Optional[str] = Header(None)):
    user_id = _require_user(authorization)
    sb = get_supabase_client()

    res = (
        sb.table("photos")
        .select("ai_caption, public_url")
        .eq("place_id", body.place_id)
        .eq("user_id", user_id)
        .execute()
    )
    photos = res.data or []
    if not photos:
        raise HTTPException(status_code=404, detail="No photos found for this place")

    captions = [p["ai_caption"] for p in photos if p.get("ai_caption")]

    try:
        story = await generate_story(place_id=body.place_id, captions=captions)
        return {"story": story}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Story generation failed: {str(e)}")