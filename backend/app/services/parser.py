"""MusicXML parsing and MIDI generation using music21."""

import io
import tempfile
import zipfile
from pathlib import Path

from music21 import converter, tempo


class MusicXMLParseError(Exception):
    """Raised when MusicXML parsing fails."""

    pass


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
        MusicXMLParseError: If parsing fails
    """
    try:
        # Handle compressed MXL files
        if filename.lower().endswith(".mxl"):
            file_content = _extract_mxl(file_content)

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

    except Exception as e:
        raise MusicXMLParseError(f"Failed to parse MusicXML: {e}") from e


def generate_midi(file_content: bytes, filename: str = "score.xml") -> bytes:
    """
    Generate MIDI from MusicXML file.

    Args:
        file_content: MusicXML or MXL file content as bytes
        filename: Original filename (to detect MXL compression)

    Returns:
        MIDI file content as bytes

    Raises:
        MusicXMLParseError: If MIDI generation fails
    """
    try:
        # Handle compressed MXL files
        if filename.lower().endswith(".mxl"):
            file_content = _extract_mxl(file_content)

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

    except Exception as e:
        raise MusicXMLParseError(f"Failed to generate MIDI: {e}") from e


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

        candidates = [
            getattr(first_tempo, "number", None),
            getattr(first_tempo, "numberReal", None),
        ]

        if hasattr(first_tempo, "getQuarterBPM"):
            try:
                candidates.append(first_tempo.getQuarterBPM())
            except Exception:
                candidates.append(None)

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
