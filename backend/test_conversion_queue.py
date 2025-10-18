#!/usr/bin/env python3
"""Test script for conversion queue without needing MuseScore.

Run this from the backend/ directory:
    python test_conversion_queue.py
"""

import sys
import time
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))

from app.services.conversion_queue import ConversionQueue


def mock_convert_musicxml(input_xml, from_notation, to_notation, timeout=30):
    """Mock converter that simulates conversion without MuseScore."""
    print(f"  [MOCK] Converting {from_notation} → {to_notation}")
    time.sleep(0.2)  # Simulate processing time

    # Return modified XML with a comment indicating conversion
    comment = f'<!-- CONVERTED: {from_notation} → {to_notation} -->\n'.encode('utf-8')
    converted = input_xml.replace(
        b'<?xml version="1.0"',
        b'<?xml version="1.0" encoding="UTF-8"?>\n' + comment + b'<?xml version="1.0"'
    )
    return converted


def mock_validate_conversion_output(output_xml):
    """Mock validator that always returns True."""
    print(f"  [MOCK] Validating output... OK")
    return True


def mock_generate_midi(xml_content, filename):
    """Mock MIDI generator."""
    print(f"  [MOCK] Generating MIDI")
    return b"MOCK_MIDI_DATA"


async def mock_upload_file(content, filename, content_type, metadata=None):
    """Mock upload that returns a fake file ID."""
    print(f"  [MOCK] Uploading {filename} ({len(content)} bytes)")
    import uuid
    return str(uuid.uuid4())


def test_conversion_queue():
    """Test the conversion queue workflow with mocked converter."""
    print("\n" + "="*60)
    print("Testing Conversion Queue")
    print("="*60 + "\n")

    # Patch the converter and storage functions
    with patch('app.services.conversion_queue.convert_musicxml', mock_convert_musicxml), \
         patch('app.services.conversion_queue.validate_conversion_output', mock_validate_conversion_output), \
         patch('app.services.conversion_queue.generate_midi', mock_generate_midi), \
         patch('app.services.storage.upload_file', mock_upload_file):

        # Create queue instance
        queue = ConversionQueue(max_workers=1)
        queue.start()
        print("✅ Queue started with 1 worker")

        # Test data - simple MusicXML fragment
        test_musicxml = b"""<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Test</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>"""

        # Queue a conversion job
        print("\n1. Queuing conversion job (staff → tab)")
        conversion_id = queue.queue_conversion(
            piece_id="test_piece_123",
            version_id="test_version_456",
            input_musicxml=test_musicxml,
            from_notation="staff",
            to_notation="tab",
        )
        print(f"   Job ID: {conversion_id}")

        # Check initial status
        job = queue.get_job_status(conversion_id)
        print(f"   Initial status: {job.status}, progress: {job.progress}%")
        assert job.status == "queued", f"Expected 'queued', got '{job.status}'"

        # Wait for processing to start
        print("\n2. Waiting for job to start...")
        time.sleep(0.5)
        job = queue.get_job_status(conversion_id)
        print(f"   Status: {job.status}, progress: {job.progress}%")

        # Wait for completion (mock is fast)
        print("\n3. Waiting for job to complete...")
        max_wait = 5  # seconds
        start_time = time.time()
        while job.status not in ("completed", "failed") and time.time() - start_time < max_wait:
            time.sleep(0.2)
            job = queue.get_job_status(conversion_id)
            print(f"   Status: {job.status}, progress: {job.progress}%")

        # Check final status
        print("\n4. Final status:")
        print(f"   Status: {job.status}")
        print(f"   Progress: {job.progress}%")

        if job.status == "completed":
            print(f"   ✅ Conversion completed successfully")
            print(f"   Output MusicXML ID: {job.output_musicxml_file_id}")
            print(f"   Output MIDI ID: {job.output_midi_file_id}")
        elif job.status == "failed":
            print(f"   ❌ Conversion failed: {job.error_message}")
        else:
            print(f"   ⚠️  Job still in progress after {max_wait}s")

        # Test retry mechanism
        if job.status == "failed":
            print("\n5. Testing retry mechanism...")
            retry_success = queue.retry_conversion(conversion_id, test_musicxml)
            print(f"   Retry queued: {retry_success}")

            if retry_success:
                time.sleep(1)
                job = queue.get_job_status(conversion_id)
                print(f"   Retry status: {job.status}")

        # Stop queue
        print("\n" + "="*60)
        queue.stop()
        print("✅ Queue stopped")
        print("="*60 + "\n")

        # Return success status
        return job.status == "completed"


if __name__ == "__main__":
    try:
        success = test_conversion_queue()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
