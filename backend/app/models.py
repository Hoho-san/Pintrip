from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, JSON, String

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)   # null for Google-only users
    google_sub = Column(String(255), unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Place(Base):
    __tablename__ = "places"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String, nullable=False)
    country = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    visited_at = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    tags = Column(JSON, default=list)
    cover_photo = Column(String, nullable=True)
    marker_style = Column(String, default="photo")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Photo(Base):
    __tablename__ = "photos"

    id = Column(String(36), primary_key=True)
    place_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    storage_path = Column(String, nullable=True)
    public_url = Column(String, nullable=True)
    exif_lat = Column(Float, nullable=True)
    exif_lng = Column(Float, nullable=True)
    ai_caption = Column(String, nullable=True)
    ai_tags = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
