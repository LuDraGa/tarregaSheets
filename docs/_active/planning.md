# Planning: [Feature Name]

**Date**: YYYY-MM-DD
**Author**: [Your Name]
**Status**: Draft | In Review | Approved

---

## Goal

What are we building and why? What problem does this solve?

---

## Context

- What existing features/code does this build on?
- What user pain points are we addressing?
- Any constraints or requirements?

---

## Technical Approach

### Architecture

- High-level design
- Components involved (backend, frontend, database)
- Data flow

### Libraries/Tools

- New dependencies needed
- Existing tools we'll leverage

### Data Models

```python
# Backend (Pydantic)
class ExampleModel(BaseModel):
    id: str
    name: str
    created_at: datetime
```

```typescript
// Frontend (TypeScript)
interface ExampleModel {
  id: string;
  name: string;
  createdAt: string;
}
```

### API Contract

```
POST /api/example
Request:
{
  "name": "Example"
}

Response: 200 OK
{
  "id": "abc123",
  "name": "Example",
  "created_at": "2025-01-15T12:00:00Z"
}
```

---

## UX Flow

1. User action (e.g., clicks "Upload File")
2. System behavior (e.g., validates file, shows progress)
3. Result (e.g., displays parsed sheet music)

### Wireframes/Mockups

(Link to Figma, screenshots, or ASCII diagrams)

```
┌─────────────────────────────────────┐
│  [Button: Upload]                   │
├─────────────────────────────────────┤
│  Progress: ████████░░ 80%           │
├─────────────────────────────────────┤
│  [Preview of uploaded content]      │
└─────────────────────────────────────┘
```

---

## Alternatives Considered

### Option 1: [Alternative Approach]

- **Pros**: ...
- **Cons**: ...
- **Decision**: Rejected because...

### Option 2: [Another Alternative]

- **Pros**: ...
- **Cons**: ...
- **Decision**: Chosen because...

---

## Questions & Open Issues

- [ ] Which library for X? (Options: A, B, C)
- [ ] Should we cache results? Where?
- [ ] Performance: Can we handle 1000+ items?
- [ ] Security: Input validation strategy?

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Malformed input files | High | Medium | Validate before processing; graceful error handling |
| Slow processing (>5s) | Medium | High | Use async jobs; show progress bar |
| Browser compatibility | Low | Low | Test on Chrome, Firefox, Safari |

---

## Success Metrics

- Feature works for 95% of test cases
- Processing time <2 seconds for typical input
- User testing: ≥80% satisfaction score
- Zero critical bugs after 1 week of usage

---

## Timeline Estimate

- Research & design: 0.5 days
- Backend implementation: 1 day
- Frontend implementation: 1 day
- Testing & polish: 0.5 days
- **Total**: 3 days

---

## Dependencies

- Blocked by: None
- Blocking: [Future Feature X]

---

## Notes

- Any additional context, links, or references
- Decisions made during discussion
- User feedback to incorporate
