"""Practice statistics data models."""

from datetime import datetime

from pydantic import BaseModel, Field


class PracticeStat(BaseModel):
    """Practice statistics for a piece."""

    piece_id: str = Field(..., description="Piece ID")
    user_id: str = Field(..., description="User ID")
    bar_id: int = Field(..., description="Bar/measure number", ge=0)
    seconds_played: float = Field(..., description="Seconds spent on this bar", ge=0)
    avg_tempo: int = Field(..., description="Average tempo during practice", ge=30, le=300)
    last_played_at: datetime = Field(
        default_factory=datetime.now, description="Last practice timestamp"
    )


class PracticeStatCreate(BaseModel):
    """Request model for creating practice stats."""

    piece_id: str
    user_id: str
    bar_id: int = Field(..., ge=0)
    seconds_played: float = Field(..., ge=0)
    avg_tempo: int = Field(..., ge=30, le=300)
