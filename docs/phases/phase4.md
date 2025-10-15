# Phase 4: Full Mix → Single-Instrument Guitar Arrangement (Key-Targeted)

**Timeline**: 6-8 weeks
**Status**: Planned (Q4 2025)

## Overview

Transform ensemble pieces (full mixes with multiple instruments) into playable solo guitar arrangements. This phase introduces intelligent arrangement engines that preserve melody, harmony, and bass while optimizing for guitar playability.

---

## v0 (Week 1-2)

### Features

- **Lead Extraction**:
  - Extract melody track from full mix
  - Use basic-pitch + CREPE on guitar-biased stem (from Phase 3)

- **Harmony Scaffold**:
  - Chroma-based chord inference (vamp-like heuristics via music21)
  - Identify chord progression (e.g., C-Am-F-G)

- **Arrangement Engine v1**:
  - Keep melody on top voice (highest notes)
  - Add bass on downbeats (root or 5th within reachable fret positions)
  - Light inner arpeggio on strong beats (if fret budget allows)

### UX Flow

1. User uploads full mix or YouTube URL
2. System separates stems (Phase 3 pipeline)
3. Extracts melody + chord progression
4. Generates arrangement: melody + bass + light harmony
5. Display staff + TAB (multi-voice)
6. Playback with all voices

### API Endpoints

- `POST /arrange` - Create arrangement from full mix
  - Request: `{ url: str, target_key: str | None, difficulty: Literal["easy", "medium", "hard"] }`
  - Response: `{ job_id, status }`
- `GET /arrange/{job_id}/status` - Check arrangement job status
- `GET /arrange/{job_id}/result` - Download arranged piece (MusicXML + TAB)

### Data Model

```python
# ArrangementJob
{
  "id": str,
  "user_id": str,
  "source_url": str | None,
  "target_key": str | None,      # e.g., "C", "Am" (None = auto-detect)
  "difficulty": Literal["easy", "medium", "hard"],
  "melody_notes": List[Note],
  "chord_progression": List[Chord],
  "arrangement_notes": List[Note],  # Final arrangement
  "status": Literal["pending", "processing", "completed", "failed"],
  "created_at": datetime,
  "completed_at": datetime | None
}

# Chord
{
  "time": float,       # Beat position
  "symbol": str,       # e.g., "Cmaj7", "Am"
  "root": int,         # MIDI note number
  "quality": Literal["maj", "min", "dom7", "maj7", "min7", ...]
}
```

### Arrangement Engine v1 Algorithm

```python
# Pseudocode
def arrange_v1(melody, chords, tuning, capo):
    arrangement = []

    for i, note in enumerate(melody):
        # 1. Add melody note (top voice)
        arrangement.append(note)

        # 2. Add bass on downbeats
        if is_downbeat(note.time):
            chord = get_chord_at_time(note.time, chords)
            bass_note = choose_bass_note(chord, tuning, capo)
            arrangement.append(bass_note)

        # 3. Add light arpeggio on strong beats (if fret budget allows)
        if is_strong_beat(note.time) and has_fret_budget(note, bass_note):
            harmony_note = choose_harmony_note(chord, tuning, capo)
            arrangement.append(harmony_note)

    return arrangement
```

### Quality Bar

- Melody coverage ≥90% (retain all important melody notes)
- Chord tone coverage ≥80% (bass + harmony hit root/3rd/5th)
- Playability score ≥70% (fret stretches, jumps acceptable)

---

## v1 (Week 3-4)

### Features

- **Key Targeting**:
  - Transpose to requested key while minimizing position strain
  - Suggest capo options (e.g., "Capo 3 in G is easier than open C")

- **Patterning**:
  - Pick arpeggio templates based on tempo & meter:
    - **Travis picking** (alternating bass)
    - **Classical i-m-a** (index-middle-ring arpeggio)
    - **Tremolo** (fast repeated notes)
  - Apply pattern to harmony notes

### UX Enhancements

- Key selector: "Transpose to key: [C] [Am] [G] [D] [A] [E] ..."
- Capo suggestions: "Try Capo 0, 3, 5" with playability scores
- Pattern selector: "Travis | Classical | Tremolo | Strumming"

### Key Transposition Algorithm

```python
# Pseudocode
def find_best_key(melody, chords, target_key=None):
    candidates = [target_key] if target_key else ["C", "G", "D", "A", "E", "Am", "Em", "Dm"]
    best_key = None
    min_cost = inf

    for key in candidates:
        for capo in range(8):
            transposed = transpose(melody, key, capo)
            cost = playability_cost(transposed, tuning="EADGBE", capo=capo)
            if cost < min_cost:
                min_cost = cost
                best_key = (key, capo)

    return best_key
```

### Arpeggio Patterning

```python
# Example: Travis picking pattern (alternating bass)
def apply_travis_pattern(chords, melody, tuning, capo):
    pattern = []
    for chord in chords:
        bass_notes = [chord.root, chord.fifth]  # Alternate between root and 5th
        for i, beat in enumerate(beats_in_chord(chord)):
            bass = bass_notes[i % 2]
            pattern.append(Note(time=beat, pitch=bass, duration=0.25))
            # Add melody note if present
            if melody_at_time(beat, melody):
                pattern.append(melody_at_time(beat, melody))
    return pattern
```

---

## v2 (Week 5-6)

### Features

- **Playability Optimizer**:
  - Use ILP (Integer Linear Programming) or DP with constraints:
    - Simultaneous holds (e.g., barre chords)
    - Barre inference (detect when barre is more efficient)
    - Position stability windows (stay in same position for N beats)
  - Generate 2-3 ranked arrangements (easy/medium/hard)

- **Evaluation Metrics**:
  - Playability score: stretch, jumps, position shifts
  - Coverage: melody note retention, chord tone coverage

### UX Flow: Multiple Arrangements

1. System generates 3 arrangements:
   - **Easy**: Melody + bass only, simple positions
   - **Medium**: Melody + bass + light harmony, moderate positions
   - **Hard**: Full arrangement with rich harmony, advanced positions
2. User previews each arrangement (staff + TAB + playback)
3. User selects preferred arrangement
4. Can manually tweak individual notes/positions

### Playability Optimizer (ILP)

```python
# Pseudocode (using PuLP or OR-Tools)
from pulp import *

def optimize_arrangement(notes, tuning, capo, difficulty):
    prob = LpProblem("Guitar_Arrangement", LpMinimize)

    # Decision variables: x[note][string][fret] = 1 if note played on string/fret
    x = LpVariable.dicts("x", (notes, strings, frets), cat='Binary')

    # Objective: minimize cost
    prob += lpSum([
        x[n][s][f] * cost(n, s, f, prev_note) for n in notes for s in strings for f in frets
    ])

    # Constraints
    for n in notes:
        # Each note must be played exactly once
        prob += lpSum([x[n][s][f] for s in strings for f in frets]) == 1

        # Playability constraints
        for s in strings:
            for f in frets:
                # Fret range
                prob += f <= 22

                # Stretch constraint (if multiple notes simultaneous)
                if has_simultaneous_notes(n):
                    prob += fret_span(simultaneous_notes(n)) <= 4

    prob.solve()
    return extract_solution(x)
```

---

## Quality Bar

- Two distinct arrangements renderable at ≥80% playability score
- Melody retention ≥90%
- Chord tone coverage ≥80% for medium/hard arrangements
- User testing: ≥70% prefer arranged TAB over original mix

---

## Risks & Mitigations

### Arrangement Complexity

- **Risk**: Full arrangements (melody + bass + harmony) may be too dense
- **Mitigation**: Offer 3 difficulty levels; simplify based on user preference

### Key Transposition Edge Cases

- **Risk**: Some keys are inherently harder on guitar (e.g., Db, Gb)
- **Mitigation**: Suggest capo + alternative key; allow manual override

### Chord Detection Errors

- **Risk**: Chroma-based chord inference is approximate
- **Mitigation**: Allow manual chord progression override; use music21's robust chord detection

### Polyphonic Fingering Conflicts

- **Risk**: Simultaneous notes may be unplayable (stretch >4 frets)
- **Mitigation**: ILP constraints enforce playability; mark impossible sections for manual edit

---

## Tech Stack Additions

- **Chord Inference**: music21 (chordify), chroma features (librosa)
- **Optimization**: PuLP or OR-Tools (ILP solver)
- **Arpeggio Patterns**: Custom templates (Travis, classical, tremolo)

---

## Concrete Weekly Deliverables

### Week 1
- Melody extraction from full mix
- Chord progression inference (chroma + music21)
- Basic arrangement engine (melody + bass on downbeats)

### Week 2
- Display arranged staff + TAB
- Playback with all voices
- Manual edit UI for arrangement notes

### Week 3
- Key transposition with capo search
- Capo suggestions with playability scores

### Week 4
- Arpeggio patterning (Travis, classical, tremolo)
- Pattern selector UI

### Week 5
- Playability optimizer (ILP) for medium/hard arrangements
- Generate 3 difficulty levels (easy/medium/hard)

### Week 6
- Multi-arrangement preview UI
- User testing with full mixes (YouTube songs)
- Polish and refinement

---

## Success Metrics

- ≥90% melody retention across all arrangements
- ≥80% playability score for "easy" arrangement
- ≥70% playability score for "medium" arrangement
- User testing: ≥70% prefer arranged TAB over direct transcription
- Design partners successfully learn songs from arrangements

---

## Example Arrangements

### "Blackbird" by The Beatles (Full Mix → Solo Guitar)

**Original**: Vocals, acoustic guitar, hand percussion
**Arrangement**:
- **Easy**: Melody + bass on downbeats (Capo 3 in G)
- **Medium**: Melody + Travis pattern bass (Capo 3 in G)
- **Hard**: Full fingerstyle arrangement with inner harmony (Capo 3 in G)

### "Hotel California" (Eagles)

**Original**: Full band (vocals, guitars, bass, drums)
**Arrangement**:
- **Easy**: Melody + root notes on downbeats (Open Am)
- **Medium**: Melody + arpeggio pattern (Open Am)
- **Hard**: Full fingerstyle with bass line + harmony (Capo 2 in Am)

---

## Dataset Requirements

### Training/Validation Set

- 20 songs with known chord progressions
- Ground truth: manually verified arrangements (at least one section per song)

### Benchmark Test Set

- 10 songs across genres (pop, rock, folk, classical)
- Evaluate melody retention, chord coverage, playability

---

## Next Phase Prep

- Collect user feedback on arrangement difficulty levels
- Identify common arpeggio patterns per genre
- Explore AI-based arrangement (future: train model on guitar arrangements)
