"""Piece data models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Asset(BaseModel):
    """Asset (file) associated with a version."""

    id: str = Field(..., description="Asset ID")
    kind: Literal["pdf", "musicxml", "mxl", "midi"] = Field(..., description="Asset type")
    url: str = Field(..., description="URL to file (GridFS or S3)")
    filename: str = Field(..., description="Original filename")


class Version(BaseModel):
    """Version of a piece (different arrangements, keys, etc.)."""

    id: str = Field(..., description="Version ID")
    piece_id: str = Field(..., description="Parent piece ID")
    source_type: Literal["pdf", "musicxml", "mxl", "midi"] = Field(
        ..., description="Source file type"
    )
    tempo: int = Field(120, description="Tempo in BPM", ge=30, le=300)
    key: str = Field("C", description="Musical key (e.g., 'C', 'Am')")
    time_signature: str = Field("4/4", description="Time signature (e.g., '4/4', '3/4')")
    assets: list[Asset] = Field(default_factory=list, description="Associated files")


class Piece(BaseModel):
    """A musical piece (song, study, composition)."""

    id: str = Field(..., description="Piece ID")
    title: str = Field(..., description="Piece title")
    composer: str = Field("", description="Composer name")
    tags: list[str] = Field(default_factory=list, description="Tags (e.g., 'classical', 'advanced')")
    tuning: str = Field("EADGBE", description="Guitar tuning (e.g., 'EADGBE', 'DADGAD')")
    capo: int = Field(0, description="Capo position (0-12)", ge=0, le=12)
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    versions: list[Version] = Field(default_factory=list, description="Versions of this piece")


class PieceCreate(BaseModel):
    """Request model for creating a new piece."""

    title: str = Field(..., min_length=1)
    composer: str = ""
    tags: list[str] = []
    tuning: str = "EADGBE"
    capo: int = Field(0, ge=0, le=12)


class PieceUpdate(BaseModel):
    """Request model for updating a piece."""

    title: str | None = None
    composer: str | None = None
    tags: list[str] | None = None
    tuning: str | None = None
    capo: int | None = Field(None, ge=0, le=12)
