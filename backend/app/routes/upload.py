"""File upload API endpoints."""

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.config import settings

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile = File(...)):
    """Upload a music file (PDF, MusicXML, MXL, MIDI)."""

    # Validate file size
    content = await file.read()
    if len(content) > settings.max_upload_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size: {settings.max_upload_size / 1024 / 1024} MB",
        )

    # Validate file type
    if file.content_type not in settings.allowed_file_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )

    # TODO: Store file in MongoDB GridFS or S3
    # For now, return mock response
    file_id = "mock-file-id"
    file_url = f"/files/{file_id}"

    return {
        "id": file_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(content),
        "url": file_url,
    }
