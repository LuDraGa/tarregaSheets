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


async def get_file_metadata(file_id: str) -> dict:
    """
    Get file metadata without downloading the entire file.

    Args:
        file_id: GridFS file ID

    Returns:
        Metadata dict including filename, contentType, and custom metadata

    Raises:
        FileNotFoundError: If file doesn't exist
    """
    gridfs = get_gridfs()

    try:
        object_id = ObjectId(file_id)
        grid_out = await gridfs.open_download_stream(object_id)

        metadata = {
            "filename": grid_out.filename,
            "content_type": grid_out.metadata.get("contentType", "application/octet-stream"),
            "length": grid_out.length,
            "upload_date": grid_out.upload_date,
            "metadata": grid_out.metadata or {},
        }

        await grid_out.close()
        return metadata

    except Exception as e:
        raise FileNotFoundError(f"File not found: {file_id}") from e


async def find_files_by_metadata(query: dict, limit: int = 100) -> list[dict]:
    """
    Find files by metadata query.

    Useful for finding converted files, notation-specific files, etc.

    Args:
        query: MongoDB query dict for metadata field
               Example: {"metadata.notation_type": "tab"}
        limit: Maximum number of results to return

    Returns:
        List of file metadata dicts with _id, filename, metadata

    Example:
        # Find all TAB notation files
        files = await find_files_by_metadata({"metadata.notation_type": "tab"})

        # Find files from a specific conversion job
        files = await find_files_by_metadata({"metadata.conversion_job_id": "abc123"})
    """
    db = get_database()

    # Query GridFS files collection
    cursor = db.fs.files.find(query).limit(limit)
    results = await cursor.to_list(length=limit)

    # Convert to simplified format
    files = []
    for doc in results:
        files.append({
            "file_id": str(doc["_id"]),
            "filename": doc.get("filename"),
            "length": doc.get("length"),
            "upload_date": doc.get("uploadDate"),
            "metadata": doc.get("metadata", {}),
        })

    return files


async def update_file_metadata(file_id: str, metadata_updates: dict) -> bool:
    """
    Update file metadata (merge with existing metadata).

    Args:
        file_id: GridFS file ID
        metadata_updates: Dict of metadata fields to update/add

    Returns:
        True if updated successfully

    Raises:
        FileNotFoundError: If file doesn't exist

    Example:
        # Mark a file as converted
        await update_file_metadata(
            file_id,
            {
                "converted": True,
                "conversion_date": datetime.now(),
                "conversion_job_id": "abc123"
            }
        )
    """
    db = get_database()

    try:
        object_id = ObjectId(file_id)

        # Check file exists
        file_doc = await db.fs.files.find_one({"_id": object_id})
        if not file_doc:
            raise FileNotFoundError(f"File not found: {file_id}")

        # Merge metadata (preserve existing, add new)
        existing_metadata = file_doc.get("metadata", {})
        merged_metadata = {**existing_metadata, **metadata_updates}

        # Update metadata
        await db.fs.files.update_one(
            {"_id": object_id},
            {"$set": {"metadata": merged_metadata}}
        )

        return True

    except FileNotFoundError:
        raise
    except Exception as e:
        raise Exception(f"Failed to update file metadata: {e}") from e
