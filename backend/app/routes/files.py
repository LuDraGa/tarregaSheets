"""File retrieval API endpoints."""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.services import storage

router = APIRouter()


@router.get("/{file_id}")
async def get_file(file_id: str):
    """
    Retrieve a file from GridFS storage.

    Args:
        file_id: GridFS file ID

    Returns:
        StreamingResponse with file content and correct Content-Type
    """
    try:
        content, filename, content_type = await storage.get_file(file_id)

        return StreamingResponse(
            iter([content]),
            media_type=content_type,
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )

    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
