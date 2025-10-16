# Active Documentation Structure

This directory contains living documents for ongoing feature work. The structure is optimized for **cross-session continuity** and **human-agent collaboration**.

## Core Documents (Always Updated)

### 1. `planning.md` - The Single Source of Truth

**Purpose:** Lean 1-page planning doc that stays current across all sessions.

**When to use:**
- Starting a new feature
- Updating decisions/risks/questions mid-implementation
- Checking current status of what's in/out of scope

**What it contains:**
- TL;DR, Goals/Non-Goals, Scope
- High-level architecture (1 paragraph + ASCII diagram)
- Stable API contracts
- Top 3 risks & mitigations
- Decisions log (with dates & 1-way/2-way flags)
- Open questions (with owners & due dates)
- Success metrics & timeline

**What it does NOT contain:**
- Detailed implementation code
- Verbose context dumps
- Execution progress logs
- Deep technical specs

Those live in **annexes** (see below).

### 2. `execution.md` - Implementation Tracking

**Purpose:** Track day-to-day progress, bugs, decisions made during coding.

**When to use:**
- During active implementation
- Logging progress updates
- Recording bugs/fixes
- Capturing lessons learned

**What it contains:**
- Task checklist (backend, frontend, infra, docs, testing)
- Timestamped progress log
- Decisions made during implementation
- Bugs & fixes table
- Code locations
- Performance metrics
- Testing results
- Follow-up tasks
- Lessons learned

**Relationship to planning.md:**
- Execution.md can be linked as an annex from planning.md
- Execution.md references planning.md for context
- Keep planning.md updated as execution reveals new decisions/risks

## Annex Structure (Opt-In Deep Dives)

Create annexes under `/docs/features/[feature-name]/` only when needed:

```
docs/
├── _active/
│   ├── README.md (this file)
│   ├── planning.md (lean 1-pager)
│   └── execution.md (implementation tracking)
├── features/
│   └── [feature-name]/
│       ├── context.md (detailed background, user research, etc.)
│       ├── models.md (full Pydantic/TypeScript schemas)
│       ├── diagrams.md (sequence diagrams, C4 models, etc.)
│       ├── telemetry.md (logs, metrics, traces)
│       ├── security.md (security/privacy notes)
│       └── runbook.md (deployment, rollout, troubleshooting)
└── phases/
    └── phaseN.md (high-level strategic roadmap)
```

### When to create annexes:

- **context.md** - When you need to explain "why" in detail (user research, alternatives considered)
- **models.md** - When data models are complex (>5 fields, nested structures)
- **diagrams.md** - When ASCII diagrams aren't enough (sequence flows, architecture)
- **telemetry.md** - When you need detailed logging/monitoring plans
- **security.md** - When handling sensitive data, auth, or compliance
- **runbook.md** - When deployment/rollout has multiple steps or failure modes

### How to reference annexes:

In `planning.md`, link to annexes in the "Optional Annexes" section:

```markdown
### Optional Annexes (link only when needed)

* **Annex A: Detailed Context** → [context.md](/docs/features/pdf-upload/context.md)
* **Annex B: Full Data Models** → [models.md](/docs/features/pdf-upload/models.md)
```

## Workflow for Agents & Humans

### Starting a new feature:

1. Copy `planning.md` template → rename to `planning-[feature-name].md` OR update the existing planning.md
2. Fill in TL;DR, Goals, Scope, Architecture (1 paragraph)
3. Add known risks (top 3)
4. Add open questions with owners
5. Set success metrics & rough timeline
6. Create annexes if needed (complex models, detailed context, etc.)

### During implementation:

1. Update `execution.md` with progress, bugs, decisions
2. Update `planning.md` Decisions Log when making key choices
3. Mark open questions as resolved in `planning.md`
4. Add new risks to `planning.md` if discovered

### Cross-session handoff:

1. Read `planning.md` first (1-page summary of current state)
2. Check `execution.md` for recent progress
3. Review Decisions Log for context on why things are the way they are
4. Check Open Questions for what's still unresolved
5. Dive into annexes only if you need deep details

### Committing work:

1. Update planning.md with final decisions
2. Mark execution.md tasks as completed
3. Add lessons learned to execution.md
4. Create execution doc for the feature if needed

## Benefits of This Structure

✅ **1-page planning.md stays lightweight** - Easy to scan, quick to update
✅ **Cross-session continuity** - New agents/humans can get up to speed fast
✅ **Human-friendly** - Designed for quick human updates (not just agent dumps)
✅ **Opt-in detail** - Deep specs in annexes, not cluttering the main doc
✅ **Decision tracking** - Decisions Log captures "why" with dates
✅ **Open questions visible** - Nothing gets lost between sessions

## Anti-Patterns to Avoid

❌ Don't dump full code into planning.md (use annexes or execution.md)
❌ Don't skip updating planning.md during implementation (it gets stale)
❌ Don't create annexes "just in case" (create them when needed)
❌ Don't let execution.md replace planning.md (they serve different purposes)
❌ Don't forget to mark 1-way vs 2-way decisions (helps with rollback)
