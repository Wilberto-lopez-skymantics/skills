<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->
<!-- PRESERVE VERBATIM: code blocks, paths, URLs, file names, identifiers, JSON/YAML -->

# Stage 02: Adversarial Swarm Analysis & Contract Synthesis

Multi-agent technical review & machine contract compiler. Hardens the spec until every observable outcome of every operation is pinned in `specs/contracts/` — zero unconstrained degrees of freedom outside the declared Equivalence Boundary.

**This stage runs round 1 only** (contracts + one full Red Team pass over the whole slice). Rounds 2–3 run in Stage 03p with the prototype running, where the Fork Tester can execute a suspected fork instead of imagining it. The user sees a working product after one round, not three.

**⊥ implementation code while stage active. Output = hardened spec & typed machine contracts in `specs/contracts/`.**

## Inputs
- Layer 4 (working): `specs/SPEC.md`, `specs/DECISION_LOG.md`, `specs/DESIGN.md` (UI)
- Layer 4 (working): `specs/contracts/*` (if existing/drafted)
- Layer 3 (reference): `../_config/spec-template.md`
- Layer 3 (reference): `../_config/references/completeness-checklist.md` + `../_config/contract-matrix.json`
- Layer 3 (reference): `../_config/references/systems-standards.md` (Equivalence Profile) + `../_config/canonical-errors.json`
- Layer 3 (reference): `../_config/schemas/` (manifest, errors, statecharts formats)
- Layer 3 (reference): `../_config/spec-self-review.md`
- Layer 3 (reference): `../_config/iteration-log-format.md`, `../_config/rulings-template.md`, `../_config/gaps-template.md`

## Process

### Creator Swarm (Blue Team)
Synthesize hardened `specs/SPEC.md` AND compile the machine contracts the contract matrix requires for the project type:
- `specs/contracts/manifest.json`: project type, interfaces, artifacts, `notApplicable` justifications, `equivalenceTarget` (default 2), `profileOverrides`, `coverageExempt` (schema: `../_config/schemas/contract-manifest.schema.json`).
- `specs/contracts/openapi.yaml` (http): every operation with a unique `operationId`, strict request/response schemas (`additionalProperties: false` on requests), headers, params, pagination, every response status enumerated.
- `specs/contracts/schema.sql` | `.prisma`: explicit DDL, pinned types, indices, foreign keys, OCC `version` columns, `COLLATE "C"` where strings are sorted.
- `specs/contracts/statecharts.json`: ∀ lifecycle entity — states, transitions (with exact guards), terminal retention, illegal-transition error.
- `specs/contracts/errors.json`: canonical + domain codes; statuses & `retryable` per `../_config/canonical-errors.json`.
- Type-specific: `cli.json`, `api.d.ts`, `storage.schema.json`, `levels.schema.json` per the matrix.

Roles: Core Architect, Security Auditor, AI/MLOps Engineer, Data Specialist, UX/UI Lead, Technical Writer.

### Critic Council (Red Team)
Attack both spec prose and typed machine contracts:
1. **Contract & Schema Auditor:** Field name/type mismatches between contracts and `SPEC.md`. Unpinned types (e.g. `string` instead of UUIDv7/regex/enum).
2. **Systems Invariant Auditor:** Compliance with the Equivalence Profile — IDEM, OCC, PAGE, ERR, HTTP-9 evaluation order. Every deviation documented as an override.
3. **Fork Tester:** ∀ operation, ask: *"Could two competent builders, reading only these files, return different observations?"* Probe each value in each response: status, headers, field presence, null vs absent, ordering, rounding, string normalization, error precedence. Any yes = finding. The persona's judgment is backed by the empirical Interpretation Diff (exit criterion 3).
4. **Edge-Case Hunter:** Missing fallback behavior, undefined error paths, unhandled timeouts.
5. **Chaos Engineer:** Assumptions about ordering, consistency, availability. Split-brain scenarios.
6. **Resource Starver:** Unbounded growth, missing pagination, no retention policy.
7. **Quantifier:** Attack vague/unquantified language. ∀ parameter ∈ final spec ! be exact value | bounded range | formula | config ref.
8. **Reconciler:** Cross-ref spec vs actual codebase & running infrastructure (if ∃). <anti_hallucination>⊥ assume spec correct. ! inspect source files & flag ANY spec-vs-reality discrepancy.</anti_hallucination>

### Pipeline Rules

#### Findings must be falsifiable (blocking vs advisory)
LLM critics always find *something*; a loop that waits for silence never ends. So only a **fork** can block:
- **Blocking finding** = a concrete request (or UI interaction) + two observations two competent builders could each produce from these files + the missing or contradicting citation. Example: `DELETE /notes/{id}` by a non-owner → `403 FORBIDDEN` vs `404 NOT_FOUND`; SPEC §5.3 names neither. A contract contradiction (`sdd.cjs check` cannot see it, two files disagree) counts as a fork.
- **Advisory finding** = anything without a fork: wording, style, "could be clearer", hypothetical scale. Logged with status `advisory`; never blocks, never triggers another round.
- Severity is this classification, never the critic's own ranking.

#### Rulings ledger (`specs/logs/02-rulings.md`)
Every triaged finding gets one row (format: `../_config/rulings-template.md`). Critics of later rounds receive the ledger; a finding that restates a ruled row without a new fork is dropped, not re-triaged. Status: `fixed` | `rejected` (not a fork, or already pinned — cite where) | `advisory` | `gap` (moved to `specs/GAPS.md`; cite the G-nnn) | `open`. The exit gate refuses any `open` row and any `gap` row without a matching G-nnn.

#### Bounded rounds
1. **Round 1 (this stage):** all personas, whole spec and contracts. Blocking findings → fixed (technical) or batched to the user at the end of the round (policy). A question the user cannot answer yet → `GAPS.md` row (kind `policy`) with a provisional DECnnn; the prototype builds the provisional answer, and Stage 04 refuses to freeze until the row is closed.
2. **Rounds 2–3 (Stage 03p, delta):** only sections and contracts changed since round 1 (by resolution or by user feedback), plus whatever references them, plus the prototype's uncited decisions — with the prototype running. The attack surface shrinks every round; that is what makes the loop converge.
3. **Hard cap: 3 rounds per iteration** (`## 🔄 Iteration N` headings appended to `02-swarm.md` since the transition that opened this iteration — 01, 01b or 00; earlier slices do not count). Blocking findings still open after round 3 → the user, one question per message with a recommendation.
4. A round with zero blocking findings ends the loop early. "Zero findings of any severity" is not a goal.

#### Technical vs Policy findings
- **Technical (mechanics)** → resolved autonomously by the Blue Team, applying the Equivalence Profile. ⊥ ask the human about status codes, index design, cursors, DDL types.
- **Policy (business decision Stage 01 missed)** — e.g. who may cancel, what happens to child records, a limit's value → ask the user exactly ONE question (Stage 01 protocol) and record the answer in `specs/DECISION_LOG.md` and SPEC. Within the round cap, policy questions are batched to the end of the round instead of stopping the loop. ⊥ resolve a policy finding by picking a "sensible default": that is the builder-guess this pipeline exists to prevent. Mark these findings `Escalation Required? = Yes` in the iteration log.

#### Slice cap
The slice adds at most `manifest.sliceCap` outcomes (default **150**: operation statuses + CLI exit codes not in the last `spec.lock.json`, counted by `sdd.cjs`; the first slice counts all of them; `readiness` also shows the total). Every step of Stages 02 and 04 grows with spec size, and cross-reference checks grow faster. More scope → split into slices (each runs 02 → 07), or raise `sliceCap` with `sliceCapDecision` citing the user's DECnnn.

#### Project Type Classification & Completeness Checklist (Step 0c)
Before the first Blue Team draft, classify the project and apply `../_config/references/completeness-checklist.md`.

**⛔ GATE:** Blue Team draft missing even ONE required section or matrix-required artifact → Critic Council ! reject the entire draft. ⊥ adversarial pass on an incomplete draft.

#### Machine validation before every Red Team pass
Run `node specs/.sdd/scripts/sdd.cjs check --contracts` and paste the output into the iteration log. Errors → fix before attacking: the Red Team's time goes to semantics, not syntax.

#### Mandatory Visible Iteration Logs
⊥ claim "internally looped" (all iterations inside one hidden thought block with only the final output shown). Execute iterations sequentially without stopping for user input (except the end-of-round policy batch). Write each iteration log in full, using the Adversarial Swarm Iteration Log format ∈ `../_config/iteration-log-format.md`, and append it to `specs/logs/02-swarm.md` — the persisted log is the audit trail, the chat shows a summary.

**⛔ GATE:** Missing | summarized iteration log in `specs/logs/02-swarm.md` → entire swarm run invalid.

#### Exit criteria (objective, all required)
⊥ minimum iteration counts and ⊥ forced failures: a manufactured finding is noise that hides real ones. This stage ends when ALL hold:
1. `sdd.cjs check --contracts` passes (output in the iteration log); the slice is within its cap.
2. Round 1 is logged in full and every blocking finding it raised is ruled: fixed, answered by the user, or recorded as a `GAPS.md` row with a provisional DECnnn.
3. `specs/logs/02-rulings.md`: no `open` row.
4. The **Outcome Table** is complete: ∀ operation | command, every observable outcome (success + each reachable error, with its trigger) is listed and pinned in the contracts. It is the input for Stage 04 coverage. The gate cross-checks it against openapi/cli.json: nothing missing, nothing undeclared.
5. `../_config/spec-self-review.md` checks 1–19 pass, reported as "Spec self-review passed: N checks clear, M issues fixed inline."
6. The Pre-Pass Hardening Verification Checklist below is in the iteration log.

The sampled Interpretation Diff (one predicted case per operation, two fresh spec-only authors) runs at the end of Stage 03p, after rounds 2–3; the full, every-outcome dual check runs once, in Stage 04.

#### Pre-Pass Hardening Verification Checklist
- **Structural**: matrix-required contracts present; typed schemas, DDL, req/res contracts, config shapes; no missing SPEC §.
- **Systems Standards**: Equivalence Profile compliance or documented overrides.
- **Concurrency & Tx**: race conditions, request isolation, rollback, file-to-db atomicity.
- **Resource Limits**: payload limits, scale limits, timeout budgets, backoff curves — exact numbers.
- **Determinism**: total ordering, seeds, numeric representation, string normalization; SPEC §9 Equivalence Boundary lists every declared degree of freedom and nothing else.

### Iterative Workflow

Execute this exact loop:
0. **Pre-Flight Context Map:** Identify ∀ frameworks/versions ∈ target architecture → SPEC §10 Observable Environment.
0b. **Pre-Flight Codebase Grounding (∃ existing code):** Reconciler ! read existing files before Blue Team drafts.
0c. **Project Type Classification:** confirm type → `manifest.json`; count declared outcomes against the slice cap.
1. **Generation Pass:** Blue Team → draft `specs/SPEC.md` AND contracts. **! pass Completeness Checklist + `sdd.cjs check --contracts`.**
2. **Adversarial Pass (round 1):** Critic Council attacks prose and contracts — everything in the slice — with the rulings ledger in hand. ∀ finding ! be logged ∈ Iteration Log format, classified blocking (with its fork) or advisory.
3. **Resolution:** Technical findings → Blue Team fixes via the profile. Policy findings → batched to the user at the end of the round. Every finding → a ruling row.
4. **Stop after round 1.** Rounds 2–3 belong to Stage 03p, with the prototype running; ⊥ run them here.
5. **Save:** finalized `specs/SPEC.md` and `specs/contracts/`. ⊥ implementation code.
6. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 02` (refuses unless `check --contracts` passes, the slice is within its cap, `specs/logs/02-swarm.md` was written this stage with ≥ 1 round and a complete Outcome Table, and `specs/logs/02-rulings.md` has no open ruling).
7. **Handoff:** Present spec & contracts to user, plus `sdd.cjs readiness`, then prompt the user to proceed to `03p_prototype` (every project type; UI projects capture wireframes from the prototype in Stage 03 afterwards).
8. **Report:** Output Swarm Log. Format: `| Spec/Contract Section | Attacking Persona | Fork / Flaw Found | Blue Team Resolution |`.

## Outputs
- `specs/SPEC.md` (Hardened, with §9 Equivalence Boundary)
- `specs/contracts/manifest.json` + matrix-required contracts
- `specs/DECISION_LOG.md` (policy escalations, profile overrides)
- `specs/logs/02-swarm.md` (round 1 log + Outcome Table), `specs/logs/02-rulings.md` (rulings ledger)
- `specs/GAPS.md` (policy questions the user could not answer yet, if any)
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)
