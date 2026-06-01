<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

# Stage 04: Writing Implementation Phases

Critical governance bridge. Hardened `specs/SPEC.md` too large & conceptual for builder agent to execute ∈ one shot. This stage converts high-level contract → granular, traceable, strictly sequenced checklist: `IMPLEMENTATION_PHASES.md`.

**⊥ write code while this stage active. Output = phase breakdown document only.**

## Inputs
- Layer 4 (working): `specs/SPEC.md`
- Layer 4 (working): `specs/DESIGN.md` (if UI project)

## Process

### Workflow

1. **Ingest Spec:** Read `specs/SPEC.md` in entirety.
2. **Deconstruct into Phases:** Break system → logical, dependency-ordered phases.
   - Infrastructure & DB schemas = always Phase 1 & 2. Frontend UIs = always final phases.
   - **Data-Flow Traceability (CRITICAL):** ∀ REST endpoint | UI component | API ∈ checklist ! explicitly state data source (e.g., `Database Table X` | `Configuration File Y`). ∃ config file like `agents.yaml` ∈ spec → ! create checklist item stating exactly which module/endpoint parses & consumes it. ⊥ leave "wiring" implicit.
3. **Mandate Verifications:** ∀ phase ! define strict empirical `Verification` step. Phase ⊥ be marked complete by Dev Swarm unless verification command passes (e.g., `pytest`, `docker-compose up`, `curl`).
4. **Write Checklist:** Output → `specs/IMPLEMENTATION_PHASES.md` using markdown task lists (`- [ ]`).
5. **Phase Integrity Check:** Before presenting to user, execute structural validations sequentially.

   **⛔ GATE:** ! create tracking artifact `specs/phase-integrity-check.md`. ! evaluate steps sequentially, write reasoning, check box only when proven. Rubber-stamping "All phases look good" without tracker = process violation.

   1. **Coverage Check:** ∀ component ∈ SPEC.md's Component Hierarchy, ∀ API endpoint, ∀ data model, ∀ game invariant (§V), ∀ interface (§I), ∀ task ∈ `## §T TASKS` → appears ∈ ≥1 phase. Flag orphans.
   2. **Dependency Ordering:** ∀ phase → list dependencies. Verify acyclic graph. Flag any phase referencing component not built ∈ prior phase.
   3. **Verification Step Check:** ∀ phase ! end with concrete verification — command to run | test to pass | behavior to observe with expected output. "Verify it works" ≠ verification step. Flag any missing.
   4. **Phase Size Check:** Phase with >8 items → split. Phase with 1 item → merge into adjacent.
   5. **DESIGN.md Cross-Ref (UI):** ∃ `specs/DESIGN.md` → ∀ phase creating frontend component ! include "Read `specs/DESIGN.md` tokens for [component]" as first item. Flag any missing.

   Fix issues inline → "Phase Integrity Check passed: [N] checks clear, [M] issues fixed inline."

6. **Update state:** Update `specs/.sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`).
7. **Handoff:** Prompt user to proceed to `05_development_swarm`.

### Document Format (`specs/IMPLEMENTATION_PHASES.md`)
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

## Verify

Cross-stage consistency checks (execute before presenting to user):
- **Coverage:** Every component in `specs/SPEC.md` Component Hierarchy, every API endpoint, every data model, every invariant (§V), every interface (§I), and every task (§T) appears in at least one phase. Flag orphans.
- **Dependency ordering:** Every phase's dependencies are built in a prior phase. Verify acyclic graph.
- **Verification steps:** Every phase ends with a concrete verification command or observable behavior. "Verify it works" is not a verification step.
- **Phase sizing:** Phases with more than 8 items should be split. Phases with 1 item should be merged.
- **DESIGN.md cross-ref (UI):** Every phase creating a frontend component includes "Read `specs/DESIGN.md` tokens for [component]" as its first item.

## Outputs
- `specs/IMPLEMENTATION_PHASES.md`
- `specs/phase-integrity-check.md` (temporary tracker)
- `specs/.sdd-state.json`
