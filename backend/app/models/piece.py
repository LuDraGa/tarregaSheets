"""Piece data models."""

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


class ParseError(BaseModel):
    """Structured parse error information."""

    line: int | None = Field(None, description="Line number in XML")
    measure: str | None = Field(None, description="Measure number/ID")
    element: str | None = Field(None, description="Element type (e.g., '<note>')")
    xpath: str | None = Field(None, description="Full XPath to problematic element")
    exception_type: str = Field(..., description="Exception class name")
    message: str = Field(..., description="Error message")
    suggestion: str | None = Field(None, description="Suggested fix")
    context_lines: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Context lines around error [{line_num, content}]"
    )


class SanitizationChange(BaseModel):
    """Record of a sanitization/auto-fix applied to MusicXML."""

    line: int | None = Field(None, description="Line number where change was made")
    from_text: str = Field(..., description="Original text")
    to_text: str = Field(..., description="Sanitized text")
    reason: str = Field(..., description="Why this change was made")
    change_type: Literal["discontinue_fix", "volta_normalization", "repeat_fix", "other"] = Field(
        ..., description="Category of sanitization"
    )


class MusicXMLVersion(BaseModel):
    """Version of MusicXML with edit history and approval workflow."""

    id: str = Field(..., description="Version ID")
    version_number: int = Field(..., description="Version number (1, 2, 3...)", ge=1)
    xml_content_file_id: str = Field(..., description="GridFS file ID for XML content")

    # Track sanitization changes
    sanitization_changes: list[SanitizationChange] = Field(
        default_factory=list,
        description="Auto-fixes applied during parsing"
    )

    # Version approval workflow: draft → approved → published
    status: Literal["draft", "approved", "published"] = Field(
        "draft",
        description="Workflow status (draft=edited but not reviewed, approved=reviewed, published=live)"
    )

    # Parse status and errors
    parse_status: Literal["success", "failed", "partial"] = Field(
        "success",
        description="Whether this version parses successfully"
    )
    parse_errors: list[ParseError] = Field(
        default_factory=list,
        description="Detailed parse error information"
    )

    # Metadata
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When this version was created"
    )
    created_by: str | None = Field(None, description="User who created this version")
    notes: str = Field("", description="User notes about this version")


class Asset(BaseModel):
    """Asset (file) associated with a version."""

    id: str = Field(..., description="Asset ID")
    kind: Literal["pdf", "musicxml", "mxl", "midi"] = Field(..., description="Asset type")
    url: str = Field(..., description="URL to file (GridFS or S3)")
    filename: str = Field(..., description="Original filename")
    notation_type: Literal["staff", "tab", "both"] | None = Field(
        None, description="Notation type (for MusicXML files)"
    )
    conversion_status: Literal["completed", "failed", "in_progress"] | None = Field(
        None, description="Conversion status (if this asset was generated via conversion)"
    )
    conversion_from: str | None = Field(
        None, description="Original notation type if converted (e.g., 'staff' → 'tab')"
    )


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

    # Notation type tracking
    original_notation: Literal["staff", "tab", "both"] | None = Field(
        None, description="Original notation type from uploaded file"
    )

    # Reprocessing support
    original_file_id: str | None = Field(
        None, description="GridFS file ID of original upload (for reprocessing)"
    )

    # Parse and MIDI generation status (legacy - use musicxml_versions for detailed tracking)
    parse_status: Literal["success", "failed", "partial", "pending"] = Field(
        "success", description="MusicXML parsing status"
    )
    midi_status: Literal["success", "failed", "partial", "pending"] = Field(
        "success", description="MIDI generation status"
    )

    # MusicXML version history and approval workflow
    musicxml_versions: list[MusicXMLVersion] = Field(
        default_factory=list,
        description="Edit history of MusicXML with approval workflow"
    )
    published_version_id: str | None = Field(
        None,
        description="Which MusicXML version is 'live' (used for MIDI, rendering, etc.)"
    )


class Piece(BaseModel):
    """A musical piece (song, study, composition)."""

    id: str = Field(..., description="Piece ID")
    title: str = Field(..., description="Piece title")
    composer: str = Field("", description="Composer name")
    tags: list[str] = Field(default_factory=list, description="Tags (e.g., 'classical', 'advanced')")
    tuning: str = Field("EADGBE", description="Guitar tuning (e.g., 'EADGBE', 'DADGAD')")
    capo: int = Field(0, description="Capo position (0-12)", ge=0, le=12)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Last update timestamp"
    )
    is_archived: bool = Field(
        False,
        description="Whether the piece is archived (soft deleted)"
    )
    archived_at: datetime | None = Field(
        None,
        description="When the piece was archived"
    )
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
