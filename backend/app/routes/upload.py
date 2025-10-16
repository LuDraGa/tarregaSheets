"""File upload API endpoints."""

from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.config import settings
from app.services import parser, storage

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_file(file: Annotated[UploadFile, File(...)]):
    """
    Upload a music file (MusicXML, MXL).

    Returns file metadata including parsed information and generated MIDI URL.
    """

    # Validate file size
    content = await file.read()
    if len(content) > settings.max_upload_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size: {settings.max_upload_size / 1024 / 1024} MB",
        )

    filename = file.filename or "untitled.xml"

    # Validate file extension (more reliable than content-type)
    from pathlib import Path

    file_ext = Path(filename).suffix.lower()
    if file_ext not in settings.allowed_file_extensions:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file extension: {file_ext}. Allowed: {', '.join(settings.allowed_file_extensions)}",
        )

    # Validate content type (lenient check since browsers vary)
    if file.content_type and file.content_type not in settings.allowed_file_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )

    content_type = file.content_type or "application/octet-stream"

    # Store the original upload first so we never lose the raw asset
    try:
        original_file_id = await storage.upload_file(
            content,
            filename,
            content_type,
            metadata={"kind": "original"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Original file storage failed: {e}",
        ) from e

    parse_status = "pending"
    parse_error: str | None = None
    midi_status = "pending"
    midi_error: str | None = None
    metadata: dict | None = None
    musicxml_file_id: str | None = None
    midi_file_id: str | None = None

    # Parse MusicXML and extract metadata (also get cleaned XML)
    cleaned_xml: bytes | None = None
    try:
        metadata, cleaned_xml = parser.parse_musicxml(content, filename)
        parse_status = "success"
    except parser.MusicXMLParseError as e:
        parse_status = "failed"
        parse_error = str(e)
    except Exception as e:  # Safety net for unexpected errors
        parse_status = "failed"
        parse_error = str(e)

    if parse_status == "success" and cleaned_xml:
        # Store cleaned MusicXML in GridFS (ensures OSMD/alphaTab compatibility)
        try:
            musicxml_file_id = await storage.upload_file(
                cleaned_xml,
                filename,
                "application/vnd.recordare.musicxml+xml",
                metadata={**(metadata or {})},
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Storage failed: {e}",
            ) from e

        # Generate MIDI from cleaned XML (use .xml extension since it's already extracted)
        try:
            midi_content = parser.generate_midi(cleaned_xml, "cleaned.xml")
            midi_status = "success"
        except parser.MusicXMLParseError as e:
            midi_status = "failed"
            midi_error = str(e)
            midi_content = None
        except Exception as e:
            midi_status = "failed"
            midi_error = str(e)
            midi_content = None

        if midi_status == "success" and midi_content:
            # Store MIDI in GridFS
            try:
                midi_filename = filename.rsplit(".", 1)[0] + ".mid"
                midi_file_id = await storage.upload_file(
                    midi_content,
                    midi_filename,
                    "audio/midi",
                    metadata={"source": musicxml_file_id},
                )
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"MIDI storage failed: {e}",
                ) from e
        elif midi_status != "success":
            midi_file_id = None
    else:
        midi_status = "skipped"
        midi_error = "MIDI generation skipped due to parse failure"

    preferred_file_id = musicxml_file_id or original_file_id
    response_metadata = metadata or {
        "title": filename.rsplit(".", 1)[0],
        "composer": "",
        "tempo": 120,
        "key": "C",
        "time_signature": "4/4",
        "has_tablature": False,
    }

    return {
        # Backwards compatible fields expected by the frontend
        "file_id": preferred_file_id,
        "midi_file_id": midi_file_id,
        "metadata": response_metadata,

        # Expanded metadata for diagnostics and raw access
        "original_file_id": original_file_id,
        "musicxml_file_id": musicxml_file_id,
        "filename": filename,
        "content_type": content_type,
        "size": len(content),
        "musicxml_url": f"/files/{musicxml_file_id}" if musicxml_file_id else None,
        "midi_url": f"/files/{midi_file_id}" if midi_file_id else None,
        "parse_status": parse_status,
        "parse_error": parse_error,
        "midi_status": midi_status,
        "midi_error": midi_error,
    }
