"""MusicXML parsing and MIDI generation using music21."""

import io
import re
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from lxml import etree
from music21 import converter, tempo


class MusicXMLParseError(Exception):
    """Raised when MusicXML parsing fails."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.details = details or {}


def extract_parse_error_details(xml_content: bytes, exception: Exception) -> dict[str, Any]:
    """
    Extract detailed error location and context from MusicXML parsing exception.

    Args:
        xml_content: Original MusicXML content
        exception: The exception that was raised during parsing

    Returns:
        dict with error details: line, measure, element, xpath, message, suggestion, context
    """
    details: dict[str, Any] = {
        "line": None,
        "measure": None,
        "element": None,
        "xpath": None,
        "exception_type": type(exception).__name__,
        "message": str(exception),
        "suggestion": None,
        "context_lines": [],
    }

    # Try to parse XML with lxml to get line numbers for elements
    try:
        parser = etree.XMLParser(recover=True)
        tree = etree.fromstring(xml_content, parser)

        # Extract measure ID and element info from exception message
        error_msg = str(exception).lower()
        exception_name = type(exception).__name__

        # Special handling for ExpanderException and repeat-related errors
        if exception_name == "ExpanderException" or "repeat" in error_msg or "barline" in error_msg:
            # Find all repeat elements in the score
            repeat_elements = tree.xpath("//barline/repeat")

            if repeat_elements:
                details["element"] = "<barline><repeat>"
                details["suggestion"] = (
                    "Found multiple repeat elements in the score. "
                    "Check that all forward/backward repeats are properly paired. "
                    "Common issues: missing forward repeat, mismatched repeat directions, "
                    "invalid ending numbers. Review all repeat locations below:"
                )

                # Collect all repeat locations
                repeat_locations = []
                for repeat_elem in repeat_elements:
                    # Get parent barline element
                    barline_elem = repeat_elem.getparent()
                    # Find the measure containing this barline
                    measure_elem = barline_elem.getparent()

                    measure_num = measure_elem.get("number", "?")
                    direction = repeat_elem.get("direction", "?")
                    line_num = barline_elem.sourceline

                    repeat_locations.append({
                        "line_num": line_num,
                        "measure": measure_num,
                        "direction": direction,
                        "content": f'<repeat direction="{direction}"/> in measure {measure_num}'
                    })

                # Use the context_lines field to show all repeat locations
                details["context_lines"] = repeat_locations

                # Set line to first repeat as a reference
                if repeat_locations:
                    details["line"] = repeat_locations[0]["line_num"]
                    details["measure"] = repeat_locations[0]["measure"]

                return details

        # Common music21 error patterns
        measure_match = re.search(r'measure[:\s]+(\d+)', error_msg, re.IGNORECASE)
        if measure_match:
            details["measure"] = measure_match.group(1)

        # Look for element types in error message
        element_patterns = [
            r'<(\w+)>',  # XML tag in error message
            r'in (\w+) element',
            r'(\w+) tag',
            r'invalid (\w+)',
        ]
        for pattern in element_patterns:
            elem_match = re.search(pattern, error_msg)
            if elem_match:
                details["element"] = f"<{elem_match.group(1)}>"
                break

        # Find the problematic element in XML tree
        problematic_elem = None

        # If we have a measure number, search within that measure
        if details["measure"]:
            # Find measure with matching number attribute
            measures = tree.xpath(f"//measure[@number='{details['measure']}']")
            if measures:
                measure_elem = measures[0]
                details["line"] = measure_elem.sourceline

                # Try to find specific element within measure
                if details["element"]:
                    elem_tag = details["element"].strip("<>")
                    elems = measure_elem.xpath(f".//{elem_tag}")
                    if elems:
                        problematic_elem = elems[0]

        # If no specific element found, try to find any mention in error
        if not problematic_elem and details["element"]:
            elem_tag = details["element"].strip("<>")
            elems = tree.xpath(f"//{elem_tag}")
            if elems:
                problematic_elem = elems[0]

        # Extract line number and build XPath
        if problematic_elem is not None:
            details["line"] = problematic_elem.sourceline
            details["xpath"] = tree.getpath(problematic_elem)

        # Get context lines around error
        if details["line"]:
            lines = xml_content.decode('utf-8', errors='ignore').split('\n')
            line_num = details["line"] - 1  # 0-indexed
            start = max(0, line_num - 3)
            end = min(len(lines), line_num + 4)
            details["context_lines"] = [
                {"line_num": i + 1, "content": lines[i].rstrip()}
                for i in range(start, end)
            ]

    except Exception as parse_error:
        # If lxml parsing fails, fall back to regex-based line extraction
        details["parsing_debug"] = f"lxml parsing failed: {parse_error}"

        # Try to extract line info from original exception
        line_match = re.search(r'line[:\s]+(\d+)', str(exception), re.IGNORECASE)
        if line_match:
            details["line"] = int(line_match.group(1))

            # Get context lines
            lines = xml_content.decode('utf-8', errors='ignore').split('\n')
            line_num = details["line"] - 1  # 0-indexed
            start = max(0, line_num - 3)
            end = min(len(lines), line_num + 4)
            details["context_lines"] = [
                {"line_num": i + 1, "content": lines[i].rstrip()}
                for i in range(start, end)
            ]

    # Add smart suggestions based on error patterns
    error_msg_lower = str(exception).lower()

    if "pitch" in error_msg_lower or "step" in error_msg_lower:
        details["suggestion"] = "Check <pitch><step> - must be A-G. Check <alter> for accidentals (sharps/flats)."
    elif "duration" in error_msg_lower:
        details["suggestion"] = "Check <duration> value - must be a positive integer representing divisions."
    elif "divisions" in error_msg_lower:
        details["suggestion"] = "Check <divisions> in <attributes> - must be set before using <duration>."
    elif "time" in error_msg_lower and "signature" in error_msg_lower:
        details["suggestion"] = "Check <time><beats> and <beat-type> - must be valid integers (e.g., 4/4)."
    elif "clef" in error_msg_lower:
        details["suggestion"] = "Check <clef><sign> and <line> - sign must be G/F/C/TAB, line must be valid."
    elif "fret" in error_msg_lower or "string" in error_msg_lower:
        details["suggestion"] = "Check <technical><fret> (0-24) and <string> (1-6 for guitar) values."
    elif "barline" in error_msg_lower or "repeat" in error_msg_lower:
        details["suggestion"] = "Check <barline><repeat> direction (forward/backward) and ending numbers."
    elif "unicode" in error_msg_lower or "encoding" in error_msg_lower:
        details["suggestion"] = "File may have encoding issues. Ensure UTF-8 encoding without BOM."
    elif "xml" in error_msg_lower and "syntax" in error_msg_lower:
        details["suggestion"] = "XML syntax error - check for unclosed tags, invalid characters, or malformed structure."
    else:
        details["suggestion"] = "Review the element structure and ensure it follows MusicXML 3.1+ specification."

    return details


def parse_musicxml(file_content: bytes, filename: str = "score.xml") -> tuple[dict, bytes]:
    """
    Parse MusicXML file and extract metadata.
    Also re-exports cleaned MusicXML for better compatibility with OSMD.

    Args:
        file_content: MusicXML or MXL file content as bytes
        filename: Original filename (to detect MXL compression)

    Returns:
        tuple: (metadata dict, cleaned MusicXML bytes)

    Raises:
        MusicXMLParseError: If parsing fails (with detailed error info in .details)
    """
    # Store original content for error reporting
    original_content = file_content

    try:
        # Handle compressed MXL files
        if filename.lower().endswith(".mxl"):
            file_content = _extract_mxl(file_content)
            original_content = file_content  # Update original after extraction

        # Normalize common MusicXML quirks
        file_content = _sanitize_musicxml(file_content)

        # music21 requires a file path, not BytesIO - use temporary file
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.musicxml', delete=False) as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name

        try:
            # Parse with music21 using file path (let it auto-detect format from extension)
            stream = converter.parse(tmp_path)

            # Extract metadata
            metadata = {
                "title": _get_title(stream),
                "composer": _get_composer(stream),
                "tempo": _get_tempo(stream),
                "key": _get_key(stream),
                "time_signature": _get_time_signature(stream),
                "has_tablature": _check_tablature(stream),
                "has_staff_notation": _check_staff_notation(stream),
                "notation_type": detect_notation_type(stream),
            }

            # Re-export cleaned MusicXML (this normalizes the file for OSMD compatibility)
            cleaned_xml_path = tmp_path.replace('.musicxml', '_cleaned.musicxml')
            stream.write('musicxml', fp=cleaned_xml_path)

            # Read cleaned XML
            with open(cleaned_xml_path, 'rb') as f:
                cleaned_xml = f.read()

            # Clean up cleaned file
            Path(cleaned_xml_path).unlink(missing_ok=True)

            return metadata, cleaned_xml
        finally:
            # Clean up temporary file
            Path(tmp_path).unlink(missing_ok=True)

    except MusicXMLParseError:
        # Re-raise MusicXMLParseError as-is (already formatted)
        raise
    except Exception as e:
        # Extract detailed error information
        error_details = extract_parse_error_details(original_content, e)
        raise MusicXMLParseError(
            f"Failed to parse MusicXML: {e}",
            details=error_details
        ) from e


def generate_midi(file_content: bytes, filename: str = "score.xml") -> bytes:
    """
    Generate MIDI from MusicXML file.

    Args:
        file_content: MusicXML or MXL file content as bytes
        filename: Original filename (to detect MXL compression)

    Returns:
        MIDI file content as bytes

    Raises:
        MusicXMLParseError: If MIDI generation fails (with detailed error info in .details)
    """
    # Store original content for error reporting
    original_content = file_content

    try:
        # Handle compressed MXL files
        if filename.lower().endswith(".mxl"):
            file_content = _extract_mxl(file_content)
            original_content = file_content  # Update original after extraction

        # Normalize common MusicXML quirks
        file_content = _sanitize_musicxml(file_content)

        # music21 requires a file path - use temporary file
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.musicxml', delete=False) as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name

        try:
            # Parse with music21 using file path (let it auto-detect format from extension)
            stream = converter.parse(tmp_path)

            # Generate MIDI to temporary file (music21 needs a path, not BytesIO)
            midi_tmp_path = tmp_path.replace('.musicxml', '.mid')
            stream.write("midi", fp=midi_tmp_path)

            # Read MIDI file content
            with open(midi_tmp_path, 'rb') as midi_file:
                midi_content = midi_file.read()

            # Clean up temporary MIDI file
            Path(midi_tmp_path).unlink(missing_ok=True)

            return midi_content
        finally:
            # Clean up temporary XML file
            Path(tmp_path).unlink(missing_ok=True)

    except MusicXMLParseError:
        # Re-raise MusicXMLParseError as-is (already formatted)
        raise
    except Exception as e:
        # Extract detailed error information
        error_details = extract_parse_error_details(original_content, e)
        raise MusicXMLParseError(
            f"Failed to generate MIDI: {e}",
            details=error_details
        ) from e


def _extract_mxl(mxl_content: bytes) -> bytes:
    """
    Extract MusicXML from compressed MXL file.

    MXL is a ZIP archive containing a MusicXML file.

    Args:
        mxl_content: MXL file content as bytes

    Returns:
        Extracted MusicXML content as bytes

    Raises:
        MusicXMLParseError: If extraction fails
    """
    try:
        with zipfile.ZipFile(io.BytesIO(mxl_content)) as zf:
            # Find the main MusicXML file (usually named *.xml or META-INF/container.xml points to it)
            xml_files = [name for name in zf.namelist() if name.endswith(".xml")]

            # Try to find the main score file (not META-INF)
            main_file = None
            for xml_file in xml_files:
                if not xml_file.startswith("META-INF"):
                    main_file = xml_file
                    break

            if not main_file:
                # Fallback: use first XML file
                main_file = xml_files[0] if xml_files else None

            if not main_file:
                raise MusicXMLParseError("No MusicXML file found in MXL archive")

            return zf.read(main_file)

    except Exception as e:
        raise MusicXMLParseError(f"Failed to extract MXL: {e}") from e


def _sanitize_musicxml(xml_content: bytes) -> bytes:
    """
    Apply defensive fixes for MusicXML quirks that commonly break music21.

    - Treat <ending type="discontinue"> as a stop marker (music21 expects stop).
    - Normalize volta number lists (e.g., "1, 2" -> "1 2") to avoid repeat expansion bugs.
    """

    try:
        text = xml_content.decode('utf-8')
    except UnicodeDecodeError:
        text = xml_content.decode('utf-8', errors='ignore')

    if 'type="discontinue"' in text:
        text = text.replace('type="discontinue"', 'type="stop"')

    if '<ending' in text:
        import re

        def _normalize_volta(match: re.Match[str]) -> str:
            numbers = match.group('numbers')
            if not numbers:
                return match.group(0)
            parts = [part.strip() for part in re.split(r'[\s,]+', numbers) if part.strip()]
            normalized = ' '.join(parts)
            return f'{match.group("prefix")}{normalized}{match.group("suffix")}'

        text = re.sub(
            r'(?P<prefix>number=")(?P<numbers>[^"<>]*?)(?P<suffix>")',
            _normalize_volta,
            text,
        )

    if 'repeat direction="backward"' in text and 'repeat direction="forward"' not in text:
        text = text.replace(
            '<barline location="left">',
            '<barline location="left">\n        <repeat direction="forward"/>',
            1,
        )

    return text.encode('utf-8')


def _get_title(stream) -> str:
    """Extract title from music21 stream."""
    if stream.metadata and stream.metadata.title:
        return stream.metadata.title
    return "Untitled"


def _get_composer(stream) -> str:
    """Extract composer from music21 stream."""
    if stream.metadata and stream.metadata.composer:
        return stream.metadata.composer
    return ""


def _get_tempo(stream) -> int:
    """
    Extract tempo (BPM) from music21 stream.

    Returns first tempo marking, or 120 as default.
    """
    # Search for tempo markings
    tempo_marks = stream.flatten().getElementsByClass(tempo.MetronomeMark)
    if tempo_marks:
        first_tempo = tempo_marks[0]

        def _coerce_tempo(value):
            if value is None:
                return None
            try:
                number = float(value)
                if number > 0:
                    return int(round(number))
            except (TypeError, ValueError):
                return None
            return None

        # Try getQuarterBPM() FIRST - it normalizes to quarter note BPM
        # regardless of the beat unit (e.g., 2/2 time uses half notes)
        candidates = []

        if hasattr(first_tempo, "getQuarterBPM"):
            try:
                candidates.append(first_tempo.getQuarterBPM())
            except Exception:
                pass

        # Fallback to raw number values (but these may be in different beat units!)
        candidates.extend([
            getattr(first_tempo, "number", None),
            getattr(first_tempo, "numberReal", None),
        ])

        for candidate in candidates:
            coerced = _coerce_tempo(candidate)
            if coerced is not None:
                return coerced

    return 120  # Default tempo


def _get_key(stream) -> str:
    """
    Extract key signature from music21 stream.

    Returns key as string (e.g., "C", "Am", "G").
    """
    from music21 import key

    keys = stream.flatten().getElementsByClass(key.KeySignature)
    if keys:
        first_key = keys[0]
        # Try to get tonic name
        if hasattr(first_key, "asKey"):
            return first_key.asKey().tonic.name
        return str(first_key)
    return "C"  # Default key


def _get_time_signature(stream) -> str:
    """
    Extract time signature from music21 stream.

    Returns time signature as string (e.g., "4/4", "3/4").
    """
    from music21 import meter

    time_sigs = stream.flatten().getElementsByClass(meter.TimeSignature)
    if time_sigs:
        first_ts = time_sigs[0]
        return first_ts.ratioString  # e.g., "4/4"
    return "4/4"  # Default time signature


def _check_tablature(stream) -> bool:
    """
    Check if MusicXML contains guitar tablature technical notation.

    Looks for:
    1. TabClef (TAB clef sign)
    2. <technical> tags with <string> and <fret> child elements

    Args:
        stream: music21 stream object

    Returns:
        True if tablature data is present, False otherwise
    """
    from music21 import clef

    # Check for tablature staff in parts
    for part in stream.parts:
        # Check for TAB clef (most reliable indicator)
        clefs = part.flatten().getElementsByClass(clef.Clef)
        for c in clefs:
            if isinstance(c, clef.TabClef):
                return True
            # Also check sign attribute for "TAB"
            if hasattr(c, 'sign') and c.sign == 'TAB':
                return True

        # Check for fret/string articulations on notes
        for element in part.flatten().notesAndRests:
            # Check if note has tablature articulations (fret/string info)
            if hasattr(element, "articulations"):
                for articulation in element.articulations:
                    # music21 represents TAB as StringIndication and FretIndication
                    if "String" in articulation.__class__.__name__ or "Fret" in articulation.__class__.__name__:
                        return True

    return False


def _check_staff_notation(stream) -> bool:
    """
    Check if MusicXML contains standard staff notation (not tablature).

    Looks for standard clefs (treble, bass, etc.) and measures with pitches.

    Args:
        stream: music21 stream object

    Returns:
        True if standard staff notation is present, False otherwise
    """
    from music21 import clef, note

    # Check for standard clefs (treble, bass, alto, tenor, etc.)
    for part in stream.parts:
        # Check for standard clefs
        clefs = part.flatten().getElementsByClass(clef.Clef)
        for c in clefs:
            # Explicitly exclude TAB clef and NoClef
            if isinstance(c, (clef.TabClef, clef.NoClef)):
                continue

            # Standard clefs (treble, bass, alto, tenor, etc.)
            if isinstance(c, (clef.TrebleClef, clef.BassClef, clef.AltoClef, clef.TenorClef)):
                return True

            # Check for any clef that's not TAB or none
            if hasattr(c, 'sign') and c.sign not in ('TAB', 'none'):
                return True

        # Also check if there are pitched notes (not just TAB fret numbers)
        notes = part.flatten().getElementsByClass(note.Note)
        if notes:
            # If we have notes with pitches, it's likely standard notation
            for n in notes:
                if hasattr(n, 'pitch') and n.pitch is not None:
                    return True

    return False


def detect_notation_type(stream) -> str:
    """
    Detect the type of musical notation present in the MusicXML.

    Analyzes the score to determine if it contains:
    - Standard staff notation only
    - Guitar tablature only
    - Both staff and tablature (linked staves)

    Args:
        stream: music21 stream object

    Returns:
        "staff" | "tab" | "both" - notation type detected
    """
    has_tab = _check_tablature(stream)
    has_staff = _check_staff_notation(stream)

    if has_tab and has_staff:
        return "both"
    elif has_tab:
        return "tab"
    elif has_staff:
        return "staff"
    else:
        # Fallback: if we can't detect either, assume staff notation
        return "staff"
