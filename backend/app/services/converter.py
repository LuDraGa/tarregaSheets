"""MusicXML notation conversion service (TAB ↔ Staff).

This module handles bidirectional conversion between guitar tablature and standard staff notation
using MuseScore CLI and music21 for pre/post-processing.
"""

import subprocess
import tempfile
from pathlib import Path
from typing import Literal

from music21 import converter


class ConversionError(Exception):
    """Raised when conversion fails."""

    pass


def convert_musicxml(
    input_musicxml: bytes,
    from_notation: Literal["staff", "tab"],
    to_notation: Literal["staff", "tab"],
    timeout: int = 30,
) -> bytes:
    """
    Convert MusicXML between staff notation and guitar tablature.

    This function uses a combination of music21 (for MusicXML manipulation)
    and MuseScore CLI (for rendering and format conversion).

    Args:
        input_musicxml: Source MusicXML file content
        from_notation: Source notation type ("staff" or "tab")
        to_notation: Target notation type ("staff" or "tab")
        timeout: Maximum conversion time in seconds (default: 30)

    Returns:
        Converted MusicXML bytes

    Raises:
        ConversionError: If conversion fails or times out
        ValueError: If from_notation == to_notation
    """
    if from_notation == to_notation:
        raise ValueError(f"Cannot convert from {from_notation} to {to_notation} (same type)")

    # For now, we'll implement a placeholder that returns the input
    # Full implementation requires MuseScore CLI setup
    # TODO: Implement actual conversion logic
    # TODO: When implementing staff → tab conversion, ensure we compute proper guitar fingering
    #       (string/fret selection, position shifts, barre detection, open-string preference...).

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / "input.musicxml"
            output_path = Path(tmpdir) / "output.musicxml"

            # Write input file
            input_path.write_bytes(input_musicxml)

            if from_notation == "staff" and to_notation == "tab":
                return _convert_staff_to_tab(input_path, output_path, timeout)
            elif from_notation == "tab" and to_notation == "staff":
                return _convert_tab_to_staff(input_path, output_path, timeout)
            else:
                raise ValueError(f"Unsupported conversion: {from_notation} → {to_notation}")

    except subprocess.TimeoutExpired as e:
        raise ConversionError(f"Conversion timed out after {timeout}s") from e
    except Exception as e:
        raise ConversionError(f"Conversion failed: {e}") from e


def _convert_staff_to_tab(
    input_path: Path,
    output_path: Path,
    timeout: int,
) -> bytes:
    """
    Convert standard staff notation to guitar tablature.

    Strategy:
    1. Parse with music21 to ensure it's valid MusicXML
    2. Use MuseScore CLI to render (triggers tablature generation)
    3. Validate output with music21

    Args:
        input_path: Path to input MusicXML file
        output_path: Path to output MusicXML file
        timeout: Conversion timeout in seconds

    Returns:
        Converted MusicXML bytes with tablature

    Raises:
        ConversionError: If conversion fails
    """
    # Step 1: Validate input with music21
    try:
        score = converter.parse(str(input_path))
    except Exception as e:
        raise ConversionError(f"Invalid MusicXML input: {e}") from e

    # Step 2: Run MuseScore CLI conversion
    # MuseScore will re-render the score, which can trigger tablature generation
    # for guitar parts if configured properly
    try:
        run_musescore_conversion(
            input_path=str(input_path),
            output_path=str(output_path),
            timeout=timeout,
        )

        # Read converted output
        if not output_path.exists():
            raise ConversionError("MuseScore did not generate output file")

        converted_bytes = output_path.read_bytes()

        # Step 3: Validate output
        if len(converted_bytes) == 0:
            raise ConversionError("MuseScore generated empty output")

        return converted_bytes

    except FileNotFoundError as e:
        # MuseScore not installed
        raise ConversionError(
            f"MuseScore CLI not available: {e}. "
            "Run in Docker container or install MuseScore + Xvfb locally."
        ) from e

    except subprocess.TimeoutExpired as e:
        raise ConversionError(f"Conversion timed out after {timeout}s") from e

    except Exception as e:
        raise ConversionError(f"Staff → TAB conversion failed: {e}") from e


def _convert_tab_to_staff(
    input_path: Path,
    output_path: Path,
    timeout: int,
) -> bytes:
    """
    Convert guitar tablature to standard staff notation.

    Strategy:
    1. Parse TAB with music21 (extracts fret/string info as pitches)
    2. Use MuseScore CLI to render as standard notation
    3. Validate output

    Args:
        input_path: Path to input MusicXML file (with TAB)
        output_path: Path to output MusicXML file (staff notation)
        timeout: Conversion timeout in seconds

    Returns:
        Converted MusicXML bytes with standard notation

    Raises:
        ConversionError: If conversion fails
    """
    # Step 1: Validate input with music21
    try:
        score = converter.parse(str(input_path))
    except Exception as e:
        raise ConversionError(f"Invalid MusicXML input: {e}") from e

    # Step 2: Run MuseScore CLI conversion
    # MuseScore will re-render the score, converting TAB to standard notation
    try:
        run_musescore_conversion(
            input_path=str(input_path),
            output_path=str(output_path),
            timeout=timeout,
        )

        # Read converted output
        if not output_path.exists():
            raise ConversionError("MuseScore did not generate output file")

        converted_bytes = output_path.read_bytes()

        # Step 3: Validate output
        if len(converted_bytes) == 0:
            raise ConversionError("MuseScore generated empty output")

        return converted_bytes

    except FileNotFoundError as e:
        # MuseScore not installed
        raise ConversionError(
            f"MuseScore CLI not available: {e}. "
            "Run in Docker container or install MuseScore + Xvfb locally."
        ) from e

    except subprocess.TimeoutExpired as e:
        raise ConversionError(f"Conversion timed out after {timeout}s") from e

    except Exception as e:
        raise ConversionError(f"TAB → Staff conversion failed: {e}") from e


def validate_conversion_output(output_musicxml: bytes) -> bool:
    """
    Validate that the converted MusicXML is well-formed and playable.

    Args:
        output_musicxml: Converted MusicXML bytes

    Returns:
        True if valid, False otherwise
    """
    try:
        # Parse with music21 to validate
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.musicxml', delete=False) as tmp:
            tmp.write(output_musicxml)
            tmp_path = tmp.name

        try:
            score = converter.parse(tmp_path)

            # Check that we have at least one note
            notes = score.flatten().notes
            if not notes:
                return False

            # Check for basic elements
            if not score.parts:
                return False

            return True

        finally:
            Path(tmp_path).unlink(missing_ok=True)

    except Exception:
        return False


def run_musescore_conversion(
    input_path: str,
    output_path: str,
    timeout: int = 30,
) -> subprocess.CompletedProcess:
    """
    Run MuseScore CLI conversion (headless mode with Xvfb).

    This function uses the `mscore-headless` wrapper (Xvfb + MuseScore CLI).

    Args:
        input_path: Path to input file
        output_path: Path to output file
        timeout: Maximum execution time in seconds

    Returns:
        subprocess.CompletedProcess with result

    Raises:
        subprocess.TimeoutExpired: If conversion times out
        subprocess.CalledProcessError: If MuseScore returns error
        FileNotFoundError: If mscore-headless is not found
    """
    # Check if MuseScore CLI is available
    import shutil
    if not shutil.which("mscore-headless"):
        raise FileNotFoundError(
            "mscore-headless not found. "
            "Ensure MuseScore is installed and Xvfb wrapper is configured. "
            "See docs/features/tab-conversion/docker-setup.md"
        )

    # Command: mscore-headless input.xml -o output.xml
    cmd = [
        "mscore-headless",  # Xvfb wrapper script (xvfb-run -a mscore)
        input_path,
        "-o",
        output_path,
    ]

    try:
        result = subprocess.run(
            cmd,
            timeout=timeout,
            capture_output=True,
            check=True,
            text=True,
        )
        return result

    except subprocess.TimeoutExpired as e:
        raise subprocess.TimeoutExpired(
            cmd=e.cmd,
            timeout=e.timeout,
            output=e.output,
            stderr=e.stderr,
        ) from e

    except subprocess.CalledProcessError as e:
        # MuseScore returned non-zero exit code
        raise ConversionError(
            f"MuseScore conversion failed (exit code {e.returncode}): {e.stderr}"
        ) from e
