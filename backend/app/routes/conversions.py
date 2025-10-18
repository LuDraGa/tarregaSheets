"""Conversion API endpoints for TAB ↔ Staff conversion."""

from fastapi import APIRouter, HTTPException, Path

from app.models.conversion import ConversionCreate, ConversionJob
from app.services.conversion_queue import get_queue
from app.services.storage import get_file

router = APIRouter(prefix="/api/conversions", tags=["conversions"])


@router.post("/pieces/{piece_id}/convert", response_model=ConversionJob)
async def create_conversion(
    piece_id: str = Path(..., description="Piece ID"),
    version_id: str = Path(..., description="Version ID"),
    conversion_request: ConversionCreate = ...,
):
    """
    Create a new conversion job for TAB ↔ Staff conversion.

    This endpoint queues an async conversion job and returns immediately
    with the job ID for status polling.

    **Flow:**
    1. Client sends conversion request with from/to notation types
    2. Server validates request and queues conversion job
    3. Background worker processes conversion
    4. Client polls GET /conversions/{id} for status

    **Example:**
    ```
    POST /api/conversions/pieces/{piece_id}/convert?version_id={version_id}
    {
      "from_notation": "staff",
      "to_notation": "tab"
    }
    ```

    **Returns:**
    ```
    {
      "id": "uuid",
      "piece_id": "...",
      "version_id": "...",
      "from_notation": "staff",
      "to_notation": "tab",
      "status": "queued",
      "progress": 0,
      "created_at": "2025-01-17T12:00:00"
    }
    ```
    """
    # Validate conversion request
    if conversion_request.from_notation == conversion_request.to_notation:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot convert from {conversion_request.from_notation} to {conversion_request.to_notation} (same type)",
        )

    # TODO: Fetch version from database to get original MusicXML file
    # For now, this is a placeholder - needs DB integration
    # version = await get_version(piece_id, version_id)
    # if not version:
    #     raise HTTPException(status_code=404, detail="Version not found")

    # TODO: Get MusicXML file from storage
    # For now, this is a placeholder
    # musicxml_file_id = version.assets[0].id  # Get original MusicXML
    # musicxml_content = get_file(musicxml_file_id)

    # PLACEHOLDER: For MVP, we'll simulate with empty bytes
    # This will be replaced with actual DB/storage integration
    raise HTTPException(
        status_code=501,
        detail="Conversion endpoint requires MongoDB and GridFS integration (coming soon)",
    )

    # Future implementation:
    # queue = get_queue()
    # conversion_id = queue.queue_conversion(
    #     piece_id=piece_id,
    #     version_id=version_id,
    #     input_musicxml=musicxml_content,
    #     from_notation=conversion_request.from_notation,
    #     to_notation=conversion_request.to_notation,
    # )
    #
    # job = queue.get_job_status(conversion_id)
    # return job


@router.get("/{conversion_id}", response_model=ConversionJob)
async def get_conversion_status(
    conversion_id: str = Path(..., description="Conversion job ID"),
):
    """
    Get status of a conversion job.

    Poll this endpoint to check conversion progress. Typical polling interval: 2 seconds.

    **Status values:**
    - `queued`: Job is waiting in queue
    - `in_progress`: Conversion is running
    - `completed`: Conversion finished successfully
    - `failed`: Conversion failed (see error_message)

    **Progress:**
    - 0-100: Percentage complete

    **Example response:**
    ```
    {
      "id": "uuid",
      "status": "completed",
      "progress": 100,
      "output_musicxml_file_id": "grid_fs_id",
      "output_midi_file_id": "grid_fs_id",
      "completed_at": "2025-01-17T12:00:30"
    }
    ```
    """
    queue = get_queue()
    job = queue.get_job_status(conversion_id)

    if not job:
        raise HTTPException(status_code=404, detail="Conversion job not found")

    return job


@router.post("/{conversion_id}/retry", response_model=ConversionJob)
async def retry_conversion(
    conversion_id: str = Path(..., description="Conversion job ID"),
):
    """
    Retry a failed conversion job.

    Only works for jobs with status="failed".

    **Returns:**
    Updated job with status="queued" and progress=0
    """
    # TODO: Get original MusicXML from storage for retry
    # For now, this is a placeholder
    raise HTTPException(
        status_code=501,
        detail="Retry endpoint requires storage integration (coming soon)",
    )

    # Future implementation:
    # queue = get_queue()
    # job = queue.get_job_status(conversion_id)
    #
    # if not job:
    #     raise HTTPException(status_code=404, detail="Conversion job not found")
    #
    # if job.status != "failed":
    #     raise HTTPException(
    #         status_code=400,
    #         detail=f"Cannot retry job with status '{job.status}' (must be 'failed')"
    #     )
    #
    # # Get original MusicXML from storage
    # # original_musicxml = get_file(...)
    #
    # success = queue.retry_conversion(conversion_id, original_musicxml)
    # if not success:
    #     raise HTTPException(status_code=500, detail="Failed to retry conversion")
    #
    # return queue.get_job_status(conversion_id)
