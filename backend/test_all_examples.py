#!/usr/bin/env python3
"""Test notation detection on all example files."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.services.parser import parse_musicxml


def test_file(file_path: Path):
    """Test notation detection on a single file."""
    try:
        with open(file_path, 'rb') as f:
            content = f.read()

        metadata, _ = parse_musicxml(content, file_path.name)

        return {
            "file": file_path.name,
            "notation_type": metadata["notation_type"],
            "has_tab": metadata["has_tablature"],
            "has_staff": metadata["has_staff_notation"],
            "title": metadata["title"],
            "composer": metadata["composer"],
            "status": "✅"
        }
    except Exception as e:
        return {
            "file": file_path.name,
            "status": "❌",
            "error": str(e)[:60]
        }


if __name__ == "__main__":
    # Find all music files
    example_dir = Path(__file__).parent.parent / "example_music"
    music_files = list(example_dir.rglob("*.musicxml")) + list(example_dir.rglob("*.mxl"))

    print(f"\n{'='*80}")
    print(f"Testing {len(music_files)} example files")
    print(f"{'='*80}\n")

    results = []
    for file_path in sorted(music_files):
        result = test_file(file_path)
        results.append(result)

    # Print summary table
    print(f"{'File':<50} {'Type':<8} {'TAB':<5} {'Staff':<6} {'Title':<20}")
    print("-" * 95)

    for r in results:
        if r["status"] == "✅":
            print(f"{r['file']:<50} {r['notation_type']:<8} {str(r['has_tab']):<5} {str(r['has_staff']):<6} {r['title'][:20]:<20}")
        else:
            print(f"{r['file']:<50} {'ERROR':<8} {r.get('error', '')[:35]}")

    # Statistics
    print("\n" + "="*80)
    print("Statistics:")
    print(f"  Total files: {len(results)}")
    print(f"  Successfully parsed: {sum(1 for r in results if r['status'] == '✅')}")
    print(f"  Errors: {sum(1 for r in results if r['status'] == '❌')}")

    # Breakdown by notation type
    if any(r['status'] == '✅' for r in results):
        print("\nNotation type breakdown:")
        staff_only = sum(1 for r in results if r['status'] == '✅' and r['notation_type'] == 'staff')
        tab_only = sum(1 for r in results if r['status'] == '✅' and r['notation_type'] == 'tab')
        both = sum(1 for r in results if r['status'] == '✅' and r['notation_type'] == 'both')
        print(f"  Staff only: {staff_only}")
        print(f"  TAB only: {tab_only}")
        print(f"  Both (staff + TAB): {both}")

    print("="*80 + "\n")
