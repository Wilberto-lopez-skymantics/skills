<!-- CAVEMAN-ENCODED: compressed ~60% vs prose. Decoder key below. -->
<!-- DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->
<!-- PRESERVE VERBATIM: code blocks, paths, URLs, file names, identifiers, JSON/YAML -->

# Stage 02: Adversarial Swarm Analysis & Contract Synthesis

Autonomous multi-agent technical review & machine contract compiler. Hardens architecture → zero degrees of freedom.

**⊥ implementation code while stage active. Output = architectural design & typed machine contracts in `specs/contracts/`.**

**! execute attack-and-refine loop iteratively until Red Team finds zero new attacks.**

## Inputs
- Layer 4 (working): `specs/SPEC.md`
- Layer 4 (working): `specs/contracts/*` (if existing/drafted)
- Layer 3 (reference): `../_config/references/completeness-checklist.md`
- Layer 3 (reference): `../_config/references/systems-standards.md`
- Layer 3 (reference): `../_config/iteration-log-format.md`

## Process

### Creator Swarm (Blue Team)
Synthesize hardened `specs/SPEC.md` AND compile formal machine contracts in `specs/contracts/`:
- `specs/contracts/openapi.yaml` (or `.proto` / tRPC): strict endpoint types, headers, query params, pagination, error schemas.
- `specs/contracts/schema.sql` (or `.prisma`): explicit DDL, pinned types, indices, foreign keys, OCC `version` columns.
- `specs/contracts/statecharts.json`: finite state machine transitions, guards, actions, rollback policies.
- `specs/contracts/errors.json`: canonical error taxonomy mapping domain errors to HTTP codes & RFC 7807/9457 envelopes.

Roles: Core Architect, Security Auditor, AI/MLOps Engineer, Data Specialist, UX/UI Lead, Technical Writer.

### Critic Council (Red Team)
Attack both spec prose and typed machine contracts:
1. **Contract & Schema Auditor:** Field name/type mismatches between `openapi.yaml`, `schema.sql`, and `SPEC.md`. Unpinned types (e.g. `string` instead of UUIDv7/regex).
2. **Systems Invariant Auditor:** Check compliance with `../_config/references/systems-standards.md`:
   - State-mutating endpoints have `Idempotency-Key` headers & deduplication windows.
   - Mutable tables have `version INT NOT NULL DEFAULT 1` for OCC.
   - Collections have cursor pagination & secondary sort tie-breakers.
   - All error responses conform to `errors.json`.
3. **Edge-Case Hunter:** Missing fallback behavior, undefined error paths, unhandled timeouts.
4. **Chaos Engineer:** Assumptions about ordering, consistency, availability. Split-brain scenarios.
5. **Resource Starver:** Unbounded growth, missing pagination, no retention policy.
6. **Quantifier:** Attack vague/unquantified language. ∀ parameter ∈ final spec ! be exact value | bounded range | formula | config ref.
7. **Reconciler:** Cross-ref spec vs actual codebase & running infrastructure. <anti_hallucination>⊥ assume spec correct. ! inspect source files & flag ANY spec-vs-reality discrepancy.</anti_hallucination>

### Pipeline Rules

#### Autonomous Technical Resolution (Human-Free)
All business policies, domain boundaries, and user preferences were frozen during Stage 01 via the Extraction Closure gate. Creators resolve technical attacks by applying standard engineering patterns from `systems-standards.md`. ⊥ pull human back into loop for technical plumbing decisions (status codes, index design, pagination cursors, DDL types).

### Anti-Simulation Enforcement

#### Project Type Classification & Completeness Checklist (Step 0c)
Before Blue Team draft, classify project type & apply corresponding checklist: `../_config/references/completeness-checklist.md`.

**⛔ GATE:** Blue Team draft missing even ONE required section or machine contract artifact (`openapi.yaml`, `schema.sql`, `statecharts.json`, `errors.json`) → Critic Council ! reject entire draft. ⊥ proceed to adversarial pass with incomplete draft.

#### Mandatory Visible Iteration Logs
⊥ claim "internally looped" (meaning all loop iterations executed inside a single hidden thought block with only the final output shown). Instead, execute all loop iterations sequentially in a single model response (turn) without stopping to wait for user input. You must print each iteration log in full using the Adversarial Swarm Iteration Log format ∈ `../_config/iteration-log-format.md`.

**⛔ GATE:** Missing | summarized iteration log → entire swarm run invalid.

#### Minimum Iteration Count
- **≥ 3 documented iterations** before PASS allowed.
- Iteration 1 = ALWAYS FAIL (initial draft always has contract/schema gaps).
- Red Team PASS on iteration 1 | 2 → override, ! attack harder. Premature PASS = lazy analysis, not hardened contracts.

#### Structured Verification Gates (Pre-Pass Checklist)
⊥ PASS review until Critic Council verifies spec and `specs/contracts/` against 5 dimensions:
- **Structural**: Typed schemas in `specs/contracts/`, DB DDL, API req/res contracts, config shapes, missing §.
- **Systems Standards**: Idempotency keys, OCC versioning, tie-breaker sorting, canonical error envelopes.
- **Concurrency & Tx**: Race conditions, request isolation, db rollback, file-to-db atomicity.
- **Resource Limits**: Text/payload limits, db scale limits, API timeout budgets & backoff curves.
- **Determinism**: Tie-breaker ordering, random seeds, float boundaries, zero unconstrained degrees of freedom.

Pre-PASS ! include `Pre-Pass Hardening Verification Checklist` in iteration log explaining ∀ 5 dimensions.

### Iterative Workflow

Execute this exact loop:
0. **Pre-Flight Context Map:** Identify ∀ frameworks/versions ∈ target architecture.
0b. **Pre-Flight Codebase Grounding (∃ existing spec):** Reconciler ! read existing files before Blue Team drafts.
0c. **Project Type Classification:** Classify project. Determines Completeness Checklist variant.
1. **Generation Pass:** Blue Team → draft `specs/SPEC.md` AND formal contracts in `specs/contracts/`. **! pass Completeness Checklist before proceeding.**
2. **Adversarial Pass:** Critic Council attacks draft prose and contracts. ∀ finding ! be printed ∈ Iteration Log format.
3. **Resolution:** Creators modify spec and machine contracts to resolve attacks. Apply `systems-standards.md`.
4. **Loop:** ! recursively repeat Steps 1-3 until Critics → "PASS" with ZERO new findings. **≥ 3 documented iterations required.**
5. **Save:** Output finalized spec to `specs/SPEC.md` and contracts to `specs/contracts/`. ⊥ write implementation code.
6. **Update state:** Update `specs/.sdd/_config/sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`) with `lastCompletedStep: 2` & `stepName: "02_adversarial_swarm_analysis"`.
7. **Handoff:** Present spec & contracts to user.
   - UI project & spec modifications introduce new visual components, states, layouts → ! route `03_interactive_wireframing`.
   - Otherwise → prompt user to proceed `04_writing_implementation_phases`.
8. **Report:** Output Swarm Log. Format: `| Spec/Contract Section | Attacking Persona | Ambiguity/Flaw Found | Blue Team Resolution |`.

## Outputs
- `specs/SPEC.md` (Hardened)
- `specs/contracts/openapi.yaml` (or `.proto`)
- `specs/contracts/schema.sql` (or `.prisma`)
- `specs/contracts/statecharts.json`
- `specs/contracts/errors.json`
- `specs/.sdd/_config/sdd-state.json`
