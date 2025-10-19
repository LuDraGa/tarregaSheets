"""Tests for converter service conversion checks."""

import shutil

import pytest

from app.services import converter


MINIMAL_MUSICXML = b"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Music</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>
"""


def test_convert_musicxml_same_notation_raises_value_error():
    """Ensure we guard against redundant conversions."""
    with pytest.raises(ValueError):
        converter.convert_musicxml(MINIMAL_MUSICXML, from_notation="staff", to_notation="staff")


@pytest.mark.skipif(
    shutil.which("mscore-headless") is not None,
    reason="MuseScore CLI available; skip missing dependency check.",
)
def test_convert_musicxml_reports_missing_cli():
    """MuseScore CLI absence should raise ConversionError flagged as unavailable."""
    with pytest.raises(converter.ConversionError) as excinfo:
        converter.convert_musicxml(MINIMAL_MUSICXML, from_notation="staff", to_notation="tab")

    assert "MuseScore CLI not available" in str(excinfo.value)


def test_validate_conversion_output_accepts_basic_score():
    """Minimal MusicXML content should pass validation."""
    assert converter.validate_conversion_output(MINIMAL_MUSICXML) is True

