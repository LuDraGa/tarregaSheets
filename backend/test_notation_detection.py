#!/usr/bin/env python3
"""Test script for notation type detection.

Run this from the backend/ directory:
    python test_notation_detection.py
"""

import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.parser import parse_musicxml, detect_notation_type
from music21 import converter


def test_notation_detection(file_path: str):
    """Test notation detection on a MusicXML file."""
    print(f"\n{'='*60}")
    print(f"Testing: {Path(file_path).name}")
    print(f"{'='*60}\n")

    # Read file
    with open(file_path, 'rb') as f:
        content = f.read()

    try:
        # Test parse_musicxml (full extraction)
        print("1. Testing parse_musicxml()...")
        metadata, cleaned_xml = parse_musicxml(content, Path(file_path).name)

        print("\n✅ Metadata extracted:")
        for key, value in metadata.items():
            print(f"   {key}: {value}")

        # Test direct detection with music21
        print("\n2. Testing detect_notation_type() directly...")
        stream = converter.parse(file_path)
        notation_type = detect_notation_type(stream)
        print(f"   Direct detection result: {notation_type}")

        # Verify consistency
        print("\n3. Verification:")
        if metadata['notation_type'] == notation_type:
            print(f"   ✅ Consistent: both methods report '{notation_type}'")
        else:
            print(f"   ⚠️  MISMATCH: metadata={metadata['notation_type']}, direct={notation_type}")

        # Print file structure details
        print("\n4. File structure:")
        print(f"   Parts: {len(stream.parts)}")
        for i, part in enumerate(stream.parts):
            print(f"   Part {i}:")

            # Check clefs
            clefs = part.flatten().getElementsByClass('Clef')
            print(f"      Clefs: {len(clefs)}")
            for clef in clefs[:3]:  # First 3 clefs
                print(f"         {clef.__class__.__name__}: {getattr(clef, 'sign', 'N/A')}")

            # Check notes
            notes = part.flatten().getElementsByClass('Note')
            print(f"      Notes: {len(notes)}")
            if notes:
                first_note = notes[0]
                print(f"         First note: {first_note.nameWithOctave if hasattr(first_note, 'nameWithOctave') else 'N/A'}")

                # Check for TAB articulations
                if hasattr(first_note, 'articulations') and first_note.articulations:
                    print(f"         Articulations: {[a.__class__.__name__ for a in first_note.articulations[:3]]}")
                else:
                    print(f"         Articulations: None")

        print("\n" + "="*60)
        return True

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Test with example file
    example_file = Path(__file__).parent.parent / "example_music" / "classical_guitar_shed" / "MusicXML 1760541941038763 from ACE Studio.musicxml"

    if not example_file.exists():
        print(f"❌ Example file not found: {example_file}")
        sys.exit(1)

    success = test_notation_detection(str(example_file))

    # If you have other test files, add them here
    # test_notation_detection("path/to/tab_file.musicxml")

    sys.exit(0 if success else 1)
