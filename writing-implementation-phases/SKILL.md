---
name: writing-implementation-phases
description: "Break a hardened SPEC.md into a granular, dependency-ordered, and testable IMPLEMENTATION_PHASES.md checklist with empirical verification steps per phase."
---

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

# Writing Implementation Phases

## Overview
Critical governance bridge. Hardened `specs/SPEC.md` too large & conceptual for builder agent to execute ∈ one shot. This skill converts high-level contract → granular, traceable, strictly sequenced checklist: `IMPLEMENTATION_PHASES.md`.

**⊥ write code while this skill active. Output = phase breakdown document only.**

## Workflow

1. **Ingest Spec:** Read `specs/SPEC.md` in entirety.
2. **Deconstruct into Phases:** Break system → logical, dependency-ordered phases.
   - Infrastructure & DB schemas = always Phase 1 & 2. Frontend UIs = always final phases.
   - **Data-Flow Traceability (CRITICAL):** ∀ REST endpoint | UI component | API ∈ checklist ! explicitly state data source (e.g., `Database Table X` | `Configuration File Y`). ∃ config file like `agents.yaml` ∈ spec → ! create checklist item stating exactly which module/endpoint parses & consumes it. ⊥ leave "wiring" implicit.
3. **Mandate Verifications:** ∀ phase ! define strict empirical `Verification` step. Phase ⊥ be marked complete by Dev Swarm unless verification command passes (e.g., `pytest`, `docker-compose up`, `curl`).
4. **Write Checklist:** Output → `specs/IMPLEMENTATION_PHASES.md` using markdown task lists (`- [ ]`).
5. **Phase Integrity Check:** Before presenting to user, execute structural validations sequentially.

   **⛔ GATE:** ! create tracking artifact `phase-integrity-check.md`. ! evaluate steps sequentially, write reasoning, check box only when proven. Rubber-stamping "All phases look good" without tracker = process violation.

   1. **Coverage Check:** ∀ component ∈ SPEC.md's Component Hierarchy, ∀ API endpoint, ∀ data model, ∀ game invariant (§V), ∀ interface (§I), ∀ task ∈ `## §T TASKS` → appears ∈ ≥1 phase. Flag orphans.
   2. **Dependency Ordering:** ∀ phase → list dependencies. Verify acyclic graph. Flag any phase referencing component not built ∈ prior phase.
   3. **Verification Step Check:** ∀ phase ! end with concrete verification — command to run | test to pass | behavior to observe with expected output. "Verify it works" ≠ verification step. Flag any missing.
   4. **Phase Size Check:** Phase with >8 items → split. Phase with 1 item → merge into adjacent.
   5. **DESIGN.md Cross-Ref (UI):** ∃ `specs/DESIGN.md` → ∀ phase creating frontend component ! include "Read `specs/DESIGN.md` tokens for [component]" as first item. Flag any missing.

   Fix issues inline → "Phase Integrity Check passed: [N] checks clear, [M] issues fixed inline."

6. **Handoff:** Return control to `spec-driven-development` orchestrator. ⊥ invoke `development-swarm` | downstream skills directly. SDD passes checklist to dev swarm.

## Document Format (`specs/IMPLEMENTATION_PHASES.md`)
```markdown
# Implementation Phases
*Derived from specs/SPEC.md*

## Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2
- [ ] **Verification:** [Exact command or empirical test to run]

## Phase 2: [Name]
...
```

## Usage Triggers
User asks "write implementation plan" | "break down spec" | "plan phases" → adopt this workflow.
