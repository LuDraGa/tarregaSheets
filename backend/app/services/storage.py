"""GridFS file storage service for MongoDB."""

import io
from typing import BinaryIO

from bson import ObjectId
from gridfs import GridFS
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from app.db.connection import get_database


def get_gridfs() -> AsyncIOMotorGridFSBucket:
    """Get GridFS bucket instance."""
    db = get_database()
    return AsyncIOMotorGridFSBucket(db)


async def upload_file(
    content: bytes, filename: str, content_type: str, metadata: dict | None = None
) -> str:
    """
    Upload a file to GridFS.

    Args:
        content: File content as bytes
        filename: Original filename
        content_type: MIME type (e.g., 'application/xml')
        metadata: Optional metadata dict

    Returns:
        file_id as string
    """
    gridfs = get_gridfs()

    # Upload to GridFS
    file_id = await gridfs.upload_from_stream(
        filename,
        io.BytesIO(content),
        metadata={"contentType": content_type, **(metadata or {})},
    )

    return str(file_id)


async def get_file(file_id: str) -> tuple[bytes, str, str]:
    """
    Retrieve a file from GridFS.

    Args:
        file_id: GridFS file ID

    Returns:
        Tuple of (content_bytes, filename, content_type)

    Raises:
        FileNotFoundError: If file doesn't exist
    """
    gridfs = get_gridfs()

    try:
        # Convert string ID to ObjectId
        object_id = ObjectId(file_id)

        # Open GridFS file
        grid_out = await gridfs.open_download_stream(object_id)

        # Read content
        content = await grid_out.read()

        # Get metadata
        filename = grid_out.filename or "untitled"
        content_type = grid_out.metadata.get("contentType", "application/octet-stream")

        return content, filename, content_type

    except Exception as e:
        raise FileNotFoundError(f"File not found: {file_id}") from e


async def delete_file(file_id: str) -> bool:
    """
    Delete a file from GridFS.

    Args:
        file_id: GridFS file ID

    Returns:
        True if deleted successfully

    Raises:
        FileNotFoundError: If file doesn't exist
    """
    gridfs = get_gridfs()

    try:
        object_id = ObjectId(file_id)
        await gridfs.delete(object_id)
        return True
    except Exception as e:
        raise FileNotFoundError(f"File not found: {file_id}") from e


async def file_exists(file_id: str) -> bool:
    """
    Check if a file exists in GridFS.

    Args:
        file_id: GridFS file ID

    Returns:
        True if file exists, False otherwise
    """
    try:
        await get_file(file_id)
        return True
    except FileNotFoundError:
        return False
