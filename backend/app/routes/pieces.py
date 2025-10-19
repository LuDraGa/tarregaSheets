"""Pieces API endpoints."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.db.connection import get_database
from app.models.piece import Piece, PieceCreate, PieceUpdate

router = APIRouter()


class BulkArchiveRequest(BaseModel):
    """Request payload for bulk archive/unarchive actions."""

    piece_ids: list[str] = Field(
        ...,
        min_length=1,
        description="IDs of pieces to update"
    )
    action: Literal["archive", "unarchive"] = Field(
        ...,
        description="Which archival action to apply"
    )


@router.post("/", response_model=Piece, status_code=status.HTTP_201_CREATED)
async def create_piece(piece_data: PieceCreate):
    """Create a new piece."""
    db = get_database()

    # Generate ID (use MongoDB ObjectId or UUID)
    from uuid import uuid4

    piece_id = str(uuid4())

    piece = Piece(
        id=piece_id,
        title=piece_data.title,
        composer=piece_data.composer,
        tags=piece_data.tags,
        tuning=piece_data.tuning,
        capo=piece_data.capo,
    )

    # Insert into MongoDB
    await db.pieces.insert_one(piece.model_dump())

    return piece


@router.get("/", response_model=list[Piece])
async def list_pieces(
    tag: str | None = None,
    composer: str | None = None,
    tuning: str | None = None,
    archived: str = "false",
):
    """List all pieces with optional filters."""
    db = get_database()

    archived_filter = (archived or "false").lower()
    if archived_filter not in {"true", "false", "all"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 'archived' filter. Use 'true', 'false', or 'all'."
        )

    # Build query
    query = {}
    if tag:
        query["tags"] = tag
    if composer:
        query["composer"] = {"$regex": composer, "$options": "i"}  # Case-insensitive search
    if tuning:
        query["tuning"] = tuning
    if archived_filter == "true":
        query["is_archived"] = True
    elif archived_filter == "false":
        query["is_archived"] = {"$ne": True}

    # Fetch pieces
    sort_field = "archived_at" if archived_filter == "true" else "created_at"
    cursor = db.pieces.find(query).sort(sort_field, -1)
    pieces = await cursor.to_list(length=100)

    return [Piece(**piece) for piece in pieces]


@router.get("/{piece_id}", response_model=Piece)
async def get_piece(piece_id: str):
    """Get a specific piece by ID."""
    db = get_database()

    piece = await db.pieces.find_one({"id": piece_id})
    if not piece:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piece not found")

    return Piece(**piece)


@router.put("/{piece_id}", response_model=Piece)
async def update_piece(piece_id: str, piece_data: PieceUpdate):
    """Update a piece's metadata."""
    db = get_database()

    # Build update dict (only include non-None fields)
    update_data = {k: v for k, v in piece_data.model_dump().items() if v is not None}

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update"
        )

    # Add updated_at timestamp
    update_data["updated_at"] = datetime.now(timezone.utc)

    # Update in MongoDB
    result = await db.pieces.update_one({"id": piece_id}, {"$set": update_data})

    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piece not found")

    # Fetch and return updated piece
    piece = await db.pieces.find_one({"id": piece_id})
    return Piece(**piece)


@router.delete("/{piece_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_piece(piece_id: str):
    """Delete a piece."""
    db = get_database()

    result = await db.pieces.delete_one({"id": piece_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piece not found")

    return None


@router.post("/{piece_id}/versions", response_model=Piece, status_code=status.HTTP_201_CREATED)
async def add_version(piece_id: str, version_data: dict):
    """
    Add a new version to a piece.

    Expected version_data:
    {
        "file_id": "gridfs_file_id",
        "midi_file_id": "gridfs_midi_file_id",
        "source_type": "musicxml",
        "metadata": {...}
    }
    """
    from uuid import uuid4

    from app.models.piece import Asset, Version

    db = get_database()

    # Check if piece exists
    piece = await db.pieces.find_one({"id": piece_id})
    if not piece:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piece not found")

    # Create version
    version_id = str(uuid4())
    metadata = version_data.get("metadata", {})

    # Create assets for MusicXML and MIDI
    assets = []

    # MusicXML asset
    if "file_id" in version_data:
        assets.append(
            Asset(
                id=version_data["file_id"],
                kind=version_data.get("source_type", "musicxml"),
                url=f"/files/{version_data['file_id']}",
                filename=version_data.get("filename", "score.xml"),
            )
        )

    # MIDI asset
    if "midi_file_id" in version_data:
        midi_filename = version_data.get("filename", "score").rsplit(".", 1)[0] + ".mid"
        assets.append(
            Asset(
                id=version_data["midi_file_id"],
                kind="midi",
                url=f"/files/{version_data['midi_file_id']}",
                filename=midi_filename,
            )
        )

    version = Version(
        id=version_id,
        piece_id=piece_id,
        source_type=version_data.get("source_type", "musicxml"),
        tempo=metadata.get("tempo", 120),
        key=metadata.get("key", "C"),
        time_signature=metadata.get("time_signature", "4/4"),
        assets=assets,
    )

    # Add version to piece and update timestamp
    from datetime import datetime, timezone

    await db.pieces.update_one(
        {"id": piece_id},
        {
            "$push": {"versions": version.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )

    # Return updated piece
    updated_piece = await db.pieces.find_one({"id": piece_id})
    return Piece(**updated_piece)


@router.post("/{piece_id}/archive", response_model=Piece)
async def archive_piece(piece_id: str):
    """Archive (soft delete) a piece."""
    db = get_database()

    now = datetime.now(timezone.utc)
    result = await db.pieces.update_one(
        {"id": piece_id},
        {"$set": {"is_archived": True, "archived_at": now, "updated_at": now}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piece not found")

    piece = await db.pieces.find_one({"id": piece_id})
    return Piece(**piece)


@router.post("/{piece_id}/unarchive", response_model=Piece)
async def unarchive_piece(piece_id: str):
    """Restore an archived piece."""
    db = get_database()

    now = datetime.now(timezone.utc)
    result = await db.pieces.update_one(
        {"id": piece_id},
        {"$set": {"is_archived": False, "archived_at": None, "updated_at": now}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piece not found")

    piece = await db.pieces.find_one({"id": piece_id})
    return Piece(**piece)


@router.post("/archive/bulk")
async def bulk_archive_pieces(request: BulkArchiveRequest):
    """Archive or unarchive multiple pieces."""
    db = get_database()

    # Pre-fetch existing piece IDs to avoid misleading updates
    cursor = db.pieces.find({"id": {"$in": request.piece_ids}}, {"id": 1, "_id": 0})
    existing_ids = [doc["id"] async for doc in cursor]
    if not existing_ids:
        return {"updated": []}

    now = datetime.now(timezone.utc)
    update_fields = {"updated_at": now}
    if request.action == "archive":
        update_fields["is_archived"] = True
        update_fields["archived_at"] = now
    else:
        update_fields["is_archived"] = False
        update_fields["archived_at"] = None

    await db.pieces.update_many({"id": {"$in": existing_ids}}, {"$set": update_fields})

    return {"updated": existing_ids}


@router.post("/{piece_id}/versions/{version_id}/reprocess", response_model=Piece)
async def reprocess_version(piece_id: str, version_id: str):
    """
    Reprocess a version from its original file.

    This endpoint is useful when:
    - Sanitization rules are updated and old files need reprocessing
    - MIDI generation failed and needs retry
    - Parse errors need fixing with updated logic

    **Flow:**
    1. Fetch version from database
    2. Download original_file_id from GridFS
    3. Re-run _sanitize_musicxml() with updated rules
    4. Re-parse with music21
    5. Re-generate MIDI
    6. Update MusicXML and MIDI assets
    7. Update parse_status and midi_status

    **Returns:**
    Updated piece with reprocessed version
    """
    db = get_database()

    # Check if piece exists
    piece = await db.pieces.find_one({"id": piece_id})
    if not piece:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Piece not found")

    # Find version
    version = next((v for v in piece.get("versions", []) if v["id"] == version_id), None)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    # Check if version has original_file_id
    original_file_id = version.get("original_file_id")
    if not original_file_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Version does not have original_file_id for reprocessing",
        )

    # TODO: Implement reprocessing logic
    # 1. Download original file from GridFS
    # 2. Re-run parse_musicxml() with updated sanitization
    # 3. Re-run generate_midi()
    # 4. Upload new files to GridFS
    # 5. Update version assets

    raise HTTPException(
        status_code=501,
        detail="Reprocessing endpoint requires GridFS integration (coming soon)",
    )

    # Future implementation:
    # from app.services.storage import get_file, upload_file
    # from app.services.parser import parse_musicxml, generate_midi
    #
    # # Download original file
    # original_content = get_file(original_file_id)
    #
    # # Re-parse
    # try:
    #     metadata, cleaned_xml = parse_musicxml(original_content, "reprocessed.musicxml")
    #     parse_status = "success"
    # except Exception as e:
    #     parse_status = "failed"
    #     # Update version with error
    #     await db.pieces.update_one(
    #         {"id": piece_id, "versions.id": version_id},
    #         {"$set": {"versions.$.parse_status": parse_status}}
    #     )
    #     raise HTTPException(status_code=500, detail=f"Parse failed: {e}")
    #
    # # Re-generate MIDI
    # try:
    #     midi_content = generate_midi(cleaned_xml, "reprocessed.musicxml")
    #     midi_status = "success"
    # except Exception as e:
    #     midi_status = "failed"
    #
    # # Upload new files
    # musicxml_file_id = upload_file(cleaned_xml, "reprocessed.musicxml", "application/vnd.recordare.musicxml+xml")
    # midi_file_id = upload_file(midi_content, "reprocessed.mid", "audio/midi") if midi_status == "success" else None
    #
    # # Update version
    # await db.pieces.update_one(
    #     {"id": piece_id, "versions.id": version_id},
    #     {"$set": {
    #         "versions.$.parse_status": parse_status,
    #         "versions.$.midi_status": midi_status,
    #         "versions.$.assets": [...],  # Update with new file IDs
    #     }}
    # )
    #
    # updated_piece = await db.pieces.find_one({"id": piece_id})
    # return Piece(**updated_piece)
