"""Pieces API endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.db.connection import get_database
from app.models.piece import Piece, PieceCreate, PieceUpdate

router = APIRouter()


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
):
    """List all pieces with optional filters."""
    db = get_database()

    # Build query
    query = {}
    if tag:
        query["tags"] = tag
    if composer:
        query["composer"] = {"$regex": composer, "$options": "i"}  # Case-insensitive search
    if tuning:
        query["tuning"] = tuning

    # Fetch pieces
    cursor = db.pieces.find(query).sort("created_at", -1)
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

    # Add version to piece
    await db.pieces.update_one(
        {"id": piece_id}, {"$push": {"versions": version.model_dump()}}
    )

    # Return updated piece
    updated_piece = await db.pieces.find_one({"id": piece_id})
    return Piece(**updated_piece)
