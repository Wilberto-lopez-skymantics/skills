<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

# Stage 04: Writing Implementation Phases & Test Oracle Synthesis

Critical governance bridge. Converts high-level spec contract → granular, sequenced checklist (`IMPLEMENTATION_PHASES.md`) AND generates the **Immutable Test Oracle** (`specs/fixtures/`) *before* code generation begins.

**⊥ write implementation code while this stage active. Output = phase checklist & test fixtures only.**

## Inputs
- Layer 4 (working): `specs/SPEC.md`
- Layer 4 (working): `specs/contracts/*` (`openapi.yaml`, `schema.sql`, `statecharts.json`, `errors.json`)
- Layer 4 (working): `specs/DESIGN.md` (if UI project)
- Layer 4 (working): `specs/wireframes/*.html` (if UI project & exists)

## Process

### Workflow

1. **Ingest Spec & Machine Contracts:** Read `specs/SPEC.md` and ∀ files in `specs/contracts/`.
2. **Synthesize Immutable Test Oracle (`specs/fixtures/`):**
   Before breaking down phases, generate the black-box verification suite that Stage 05 will be graded against:
   - `specs/fixtures/api_cases.json`:
     - **Happy Path:** Expected request payload $\to$ exact expected response status, headers, and body shape.
     - **Error Path:** Invalid payloads $\to$ exact HTTP status, error code, and RFC 7807/9457 error envelope matching `errors.json`.
     - **Idempotency Cases:** Replay same `Idempotency-Key` $\to$ cached response (`Idempotent-Replay: true`); conflicting in-flight $\to$ 409 Conflict.
     - **OCC Cases:** Concurrent mutation with stale `version` $\to$ 409 Conflict (`RESOURCE_CONFLICT`).
   - `specs/fixtures/db_seed.sql` & `specs/fixtures/db_assertions.json`: Initial state seed data and expected post-mutation database row states.
   - `specs/fixtures/state_transitions.json`: Sequences of events validating valid state machine steps and verifying illegal transitions are rejected.
3. **Deconstruct into Phases:** Break system → logical, dependency-ordered phases.
   - Infrastructure & DB schemas = always Phase 1 & 2. Frontend UIs = always final phases.
   - **Data-Flow Traceability:** ∀ REST endpoint | UI component | API ∈ checklist ! explicitly state data source.
4. **Mandate Empirical Verifications:** ∀ phase ! bind to an immutable test fixture or contract validation command.
   - Example: `Verification: npm test -- tests/contracts/phase1.test.ts` (consuming `specs/fixtures/api_cases.json`).
   - "Verify it works" | coder writing ad-hoc tests in Stage 05 = STRICTLY FORBIDDEN.
5. **Write Checklist:** Append new phase(s) to `specs/IMPLEMENTATION_PHASES.md`. Keep new tasks sequenced & unchecked (`- [ ]`).
6. **Phase Integrity Check:** Before presenting to user, execute structural validations sequentially.

   **⛔ GATE:** ! create tracking artifact `specs/phase-integrity-check.md`. ! evaluate steps sequentially, write reasoning, check box only when proven.

   1. **Coverage Check:** ∀ component ∈ `SPEC.md` Component Hierarchy, ∀ API endpoint in `openapi.yaml`, ∀ table in `schema.sql`, ∀ state in `statecharts.json` $\to$ appears ∈ $\ge 1$ phase. Flag orphans.
   2. **Fixture Mapping Check:** ∀ phase ! have corresponding test fixtures in `specs/fixtures/`. Phase without fixture = GATE FAIL.
   3. **Dependency Ordering:** ∀ phase $\to$ list dependencies. Verify acyclic graph. Flag any phase referencing component not built in prior phase.
   4. **Phase Size Check:** Phase with >8 items $\to$ split. Phase with 1 item $\to$ merge into adjacent.
   5. **DESIGN.md Cross-Ref (UI):** ∃ `specs/DESIGN.md` $\to$ ∀ phase creating frontend component ! include "Read `specs/DESIGN.md` tokens for [component]" as first item.
   6. **Wireframe Sync Check (UI):** ∃ `specs/wireframes/*.html` $\to$ verify ∀ new UI components, states, layouts implemented in wireframes.

7. **Update state:** Update `specs/.sdd/_config/sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`) with `lastCompletedStep: 4` & `stepName: "04_writing_implementation_phases"`.
8. **Handoff:** Prompt user to proceed to `05_development_swarm`.

### Document Format (`specs/IMPLEMENTATION_PHASES.md`)
```markdown
# Implementation Phases
*Derived from specs/SPEC.md and specs/contracts/*

## Phase 1: [Name]
- [ ] Task 1: Scaffolding / Schema migration
- [ ] Task 2: Service / Repository implementation
- [ ] **Verification:** [Exact test command evaluating against specs/fixtures/ or specs/contracts/]

## Phase 2: [Name]
...
```

## Outputs
- `specs/IMPLEMENTATION_PHASES.md`
- `specs/fixtures/api_cases.json`
- `specs/fixtures/db_seed.sql` & `specs/fixtures/db_assertions.json`
- `specs/fixtures/state_transitions.json`
- `specs/phase-integrity-check.md`
- `specs/.sdd/_config/sdd-state.json`
