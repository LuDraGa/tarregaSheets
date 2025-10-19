"""File upload API endpoints."""

import time
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Body, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.config import settings
from app.services import parser, storage
from app.services import converter as notation_converter

router = APIRouter()


class ValidateMusicXMLRequest(BaseModel):
    """Request body for MusicXML validation."""

    xml_content: str


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

    conversion_checks: dict[str, dict] = {
        "midi": {"status": "pending"},
        "mxl_extract": {"status": "pending" if file_ext == ".mxl" else "skipped", "reason": None if file_ext == ".mxl" else "Source not compressed (.mxl)"},
        "staff_to_tab": {"status": "pending"},
        "tab_to_staff": {"status": "pending"},
        "pdf_to_mxl": {"status": "unavailable", "note": "Conversion not implemented yet"},
        "image_to_musicxml": {"status": "unavailable", "note": "Conversion not implemented yet"},
    }

    preview_assets: dict[str, str | None] = {
        "musicxml_file_id": None,
        "midi_file_id": None,
        "tab_musicxml_file_id": None,
        "staff_musicxml_file_id": None,
    }

    parse_status = "pending"
    parse_error: str | None = None
    parse_error_details: dict | None = None
    midi_status = "pending"
    midi_error: str | None = None
    midi_error_details: dict | None = None
    metadata: dict | None = None
    musicxml_file_id: str | None = None
    midi_file_id: str | None = None

    # Parse MusicXML and extract metadata (also get cleaned XML)
    cleaned_xml: bytes | None = None
    try:
        metadata, cleaned_xml = parser.parse_musicxml(content, filename)
        parse_status = "success"
        if file_ext == ".mxl":
            conversion_checks["mxl_extract"] = {"status": "success"}
    except parser.MusicXMLParseError as e:
        parse_status = "failed"
        parse_error = str(e)
        parse_error_details = e.details if hasattr(e, 'details') else None
        if file_ext == ".mxl":
            conversion_checks["mxl_extract"] = {
                "status": "failed",
                "error": str(e),
            }
    except Exception as e:  # Safety net for unexpected errors
        parse_status = "failed"
        parse_error = str(e)
        if file_ext == ".mxl":
            conversion_checks["mxl_extract"] = {
                "status": "failed",
                "error": str(e),
            }

    if parse_status == "success" and cleaned_xml:
        # Store cleaned MusicXML in GridFS (ensures OSMD/alphaTab compatibility)
        try:
            musicxml_file_id = await storage.upload_file(
                cleaned_xml,
                filename,
                "application/vnd.recordare.musicxml+xml",
                metadata={**(metadata or {})},
            )
            preview_assets["musicxml_file_id"] = musicxml_file_id
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Storage failed: {e}",
            ) from e

        # Generate MIDI from cleaned XML (use .xml extension since it's already extracted)
        try:
            midi_start = time.perf_counter()
            midi_content = parser.generate_midi(cleaned_xml, "cleaned.xml")
            midi_duration = int((time.perf_counter() - midi_start) * 1000)
            midi_status = "success"
            conversion_checks["midi"] = {"status": "success", "duration_ms": midi_duration}
        except parser.MusicXMLParseError as e:
            midi_status = "failed"
            midi_error = str(e)
            midi_error_details = e.details if hasattr(e, 'details') else None
            midi_content = None
            conversion_checks["midi"] = {"status": "failed", "error": midi_error}
        except Exception as e:
            midi_status = "failed"
            midi_error = str(e)
            midi_content = None
            conversion_checks["midi"] = {"status": "failed", "error": midi_error}

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
                preview_assets["midi_file_id"] = midi_file_id
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"MIDI storage failed: {e}",
                ) from e
        else:
            midi_file_id = None
    else:
        midi_status = "skipped"
        midi_error = "MIDI generation skipped due to parse failure"
        midi_error_details = None
        midi_file_id = None
        conversion_checks["midi"] = {"status": "skipped", "reason": "Parse failed"}

    preferred_file_id = musicxml_file_id or original_file_id
    response_metadata = metadata or {
        "title": filename.rsplit(".", 1)[0],
        "composer": "",
        "tempo": 120,
        "key": "C",
        "time_signature": "4/4",
        "has_tablature": False,
        "has_staff_notation": True,
        "notation_type": "staff",
    }

    notation_type = (metadata or {}).get("notation_type", "staff")
    has_staff = (metadata or {}).get("has_staff_notation", notation_type in ("staff", "both"))
    has_tab = (metadata or {}).get("has_tablature", notation_type in ("tab", "both"))

    base_filename = Path(filename).stem

    async def _attempt_conversion(
        check_key: str,
        from_notation: Literal["staff", "tab"],
        to_notation: Literal["staff", "tab"],
        output_suffix: str,
    ) -> str | None:
        if not cleaned_xml:
            conversion_checks[check_key] = {"status": "skipped", "reason": "No cleaned MusicXML available"}
            return None

        start_time = time.perf_counter()
        try:
            converted_bytes = notation_converter.convert_musicxml(
                cleaned_xml,
                from_notation=from_notation,
                to_notation=to_notation,
            )
            duration = int((time.perf_counter() - start_time) * 1000)
            try:
                converted_file_id = await storage.upload_file(
                    converted_bytes,
                    f"{base_filename}{output_suffix}",
                    "application/vnd.recordare.musicxml+xml",
                    metadata={
                        "kind": "converted",
                        "source_file_id": musicxml_file_id or original_file_id,
                        "from_notation": from_notation,
                        "to_notation": to_notation,
                    },
                )
                conversion_checks[check_key] = {
                    "status": "success",
                    "duration_ms": duration,
                }
                return converted_file_id
            except Exception as storage_error:
                conversion_checks[check_key] = {
                    "status": "failed",
                    "error": f"Storage failed: {storage_error}",
                }
                return None
        except notation_converter.ConversionError as conversion_error:
            error_message = str(conversion_error)
            status = "unavailable" if "MuseScore CLI not available" in error_message else "failed"
            conversion_checks[check_key] = {
                "status": status,
                "error": error_message,
            }
            return None
        except ValueError as conversion_error:
            conversion_checks[check_key] = {
                "status": "failed",
                "error": str(conversion_error),
            }
            return None
        except Exception as conversion_error:  # Catch any unexpected issues
            conversion_checks[check_key] = {
                "status": "failed",
                "error": str(conversion_error),
            }
            return None

    if parse_status == "success":
        if has_staff:
            tab_file_id = await _attempt_conversion(
                "staff_to_tab",
                from_notation="staff",
                to_notation="tab",
                output_suffix="__tab.musicxml",
            )
            if tab_file_id:
                preview_assets["tab_musicxml_file_id"] = tab_file_id
        else:
            conversion_checks["staff_to_tab"] = {
                "status": "skipped",
                "reason": "Source lacks staff notation",
            }

        if has_tab:
            staff_file_id = await _attempt_conversion(
                "tab_to_staff",
                from_notation="tab",
                to_notation="staff",
                output_suffix="__staff.musicxml",
            )
            if staff_file_id:
                preview_assets["staff_musicxml_file_id"] = staff_file_id
        else:
            conversion_checks["tab_to_staff"] = {
                "status": "skipped",
                "reason": "Source lacks tablature",
            }
    else:
        conversion_checks["staff_to_tab"] = {"status": "skipped", "reason": "Parse failed"}
        conversion_checks["tab_to_staff"] = {"status": "skipped", "reason": "Parse failed"}

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
        "parse_error_details": parse_error_details,  # NEW: Detailed error info
        "midi_status": midi_status,
        "midi_error": midi_error,
        "midi_error_details": midi_error_details,  # NEW: Detailed MIDI error info
        "conversion_checks": conversion_checks,
        "preview_assets": preview_assets,
    }


@router.post("/validate-musicxml")
async def validate_musicxml(request: ValidateMusicXMLRequest):
    """
    Validate edited MusicXML content without uploading or creating a version.

    This endpoint is used by the frontend editor to provide real-time validation feedback.
    It parses the XML and returns either:
    - Success: metadata extracted from the MusicXML
    - Failure: detailed error information with line numbers, suggestions, etc.

    Returns:
        {
            "valid": bool,
            "metadata": {...} | None,  # If valid
            "parse_error": str | None,  # If invalid
            "parse_error_details": {...} | None  # Detailed error info
        }
    """
    xml_content = request.xml_content.encode('utf-8')

    # Try to parse the MusicXML
    try:
        metadata, cleaned_xml = parser.parse_musicxml(xml_content, "validation.xml")
        return {
            "valid": True,
            "metadata": metadata,
            "parse_error": None,
            "parse_error_details": None,
        }
    except parser.MusicXMLParseError as e:
        return {
            "valid": False,
            "metadata": None,
            "parse_error": str(e),
            "parse_error_details": e.details if hasattr(e, 'details') else None,
        }
    except Exception as e:
        # Unexpected error - return generic error
        return {
            "valid": False,
            "metadata": None,
            "parse_error": f"Validation failed: {e}",
            "parse_error_details": None,
        }
