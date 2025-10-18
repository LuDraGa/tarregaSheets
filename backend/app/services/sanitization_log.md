# MusicXML Sanitization Log

**Purpose**: Track edge cases and fixes applied to MusicXML files to ensure compatibility with music21, OSMD, and alphaTab.

This log documents all sanitization rules applied in `parser.py::_sanitize_musicxml()` to handle malformed or non-standard MusicXML files.

---

## Current Sanitization Rules

### 1. Ending Type: `discontinue` → `stop`

**Issue**: Some MusicXML exporters use `<ending type="discontinue">` which is non-standard.
**Fix**: Replace with `type="stop"` which music21 expects.
**Date Added**: 2025-01-16
**Code Location**: `parser.py:184-185`

```python
if 'type="discontinue"' in text:
    text = text.replace('type="discontinue"', 'type="stop"')
```

**Example**:
```xml
<!-- Before -->
<ending number="1" type="discontinue"/>

<!-- After -->
<ending number="1" type="stop"/>
```

---

### 2. Volta Numbers: Normalize Comma-Separated Lists

**Issue**: Some files use `number="1, 2"` (comma-separated) instead of `number="1 2"` (space-separated).
**Fix**: Normalize volta number lists to space-separated format.
**Date Added**: 2025-01-16
**Code Location**: `parser.py:188-202`

```python
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
```

**Example**:
```xml
<!-- Before -->
<ending number="1, 2" type="start"/>

<!-- After -->
<ending number="1 2" type="start"/>
```

---

### 3. Missing Forward Repeat: Insert if Backward Repeat Present

**Issue**: Some files have `<repeat direction="backward">` without a matching `<repeat direction="forward">`.
**Fix**: Insert forward repeat at the first `<barline location="left">`.
**Date Added**: 2025-01-16
**Code Location**: `parser.py:204-210`

```python
if 'repeat direction="backward"' in text and 'repeat direction="forward"' not in text:
    text = text.replace(
        '<barline location="left">',
        '<barline location="left">\n        <repeat direction="forward"/>',
        1,  # Only first occurrence
    )
```

**Example**:
```xml
<!-- Before -->
<barline location="left">
  <!-- No forward repeat -->
</barline>
<!-- ... later ... -->
<barline location="right">
  <repeat direction="backward"/>
</barline>

<!-- After -->
<barline location="left">
  <repeat direction="forward"/>
</barline>
<!-- ... later ... -->
<barline location="right">
  <repeat direction="backward"/>
</barline>
```

---

## Future Edge Cases to Track

When new sanitization rules are added, document them here with:
- **Issue**: What problem was observed
- **Fix**: How we're fixing it
- **Date Added**: When the fix was implemented
- **Code Location**: Where in `parser.py` the fix is applied
- **Example**: Before/after XML snippets

---

## Debugging Failed Parses

When a MusicXML file fails to parse or generate MIDI:

1. **Check `parse_status` and `midi_status`** in the version object
2. **Download original file** from GridFS using `original_file_id`
3. **Test with music21** directly:
   ```python
   import music21
   score = music21.converter.parse('problem_file.musicxml')
   score.expandRepeats()  # Check for repeat bugs
   score.write('midi', 'output.mid')  # Check MIDI generation
   ```
4. **Check sanitized output**: Download sanitized MusicXML from `/files/<musicxml_id>`
5. **Add new rule** if a pattern is found, and document it above

---

## Known Issues to Watch For

### alphaTab Playback Issues
- **Missing SoundFont**: Check browser console for audio errors
- **Duration = 0**: Indicates tempo/duration calculation bug in alphaTab
- **playerPositionChanged loops**: Check for `endTime` reporting 0 repeatedly

### music21 Parsing Issues
- **Repeat expansion fails**: Check for malformed `<ending>` tags
- **MIDI generation empty**: Check for missing note events
- **Tempo parsing errors**: Check for invalid MetronomeMark values

### OSMD Rendering Issues
- **Staff not rendering**: Check for invalid clef definitions
- **TAB not showing**: Verify `<technical>` tags with `<fret>` and `<string>`
- **Cursor sync drift**: Check for measure numbering issues

---

## Reprocessing Workflow

If sanitization rules are updated and old files need reprocessing:

1. **Endpoint**: `POST /pieces/{id}/versions/{version_id}/reprocess`
2. **Process**:
   - Download `original_file_id` from GridFS
   - Re-run `_sanitize_musicxml()` with updated rules
   - Re-parse with music21
   - Re-generate MIDI
   - Update MusicXML and MIDI assets in version
3. **Response**: Updated version object with new `parse_status` and `midi_status`

---

## Testing Checklist

When adding new sanitization rules:

- [ ] Test with original problematic file
- [ ] Verify music21 parsing succeeds
- [ ] Verify MIDI generation produces notes
- [ ] Test OSMD rendering (staff)
- [ ] Test alphaTab rendering (TAB)
- [ ] Test playback with Tone.js
- [ ] Add before/after example to this log
- [ ] Update unit tests in `tests/services/test_parser.py`
