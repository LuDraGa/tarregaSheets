"""Conversion job models for TAB ↔ Staff conversion tracking."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ConversionJob(BaseModel):
    """
    Tracks a TAB ↔ Staff conversion job.

    Used for async conversion processing and status polling.
    """

    id: str = Field(..., description="Conversion job ID")
    piece_id: str = Field(..., description="Parent piece ID")
    version_id: str = Field(..., description="Version ID being converted")

    # Conversion parameters
    from_notation: Literal["staff", "tab"] = Field(..., description="Source notation type")
    to_notation: Literal["staff", "tab"] = Field(..., description="Target notation type")

    # Status tracking
    status: Literal["queued", "in_progress", "completed", "failed"] = Field(
        "queued", description="Conversion job status"
    )
    progress: int = Field(0, description="Progress percentage (0-100)", ge=0, le=100)
    error_message: str | None = Field(None, description="Error message if failed")

    # Result file IDs (if completed)
    output_musicxml_file_id: str | None = Field(None, description="Converted MusicXML file ID")
    output_midi_file_id: str | None = Field(None, description="Converted MIDI file ID")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now, description="Job creation time")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update time")
    completed_at: datetime | None = Field(None, description="Job completion time")


class ConversionCreate(BaseModel):
    """Request model for creating a conversion job."""

    from_notation: Literal["staff", "tab"] = Field(..., description="Source notation type")
    to_notation: Literal["staff", "tab"] = Field(..., description="Target notation type")
