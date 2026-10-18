<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->
<!-- PRESERVE VERBATIM: code blocks, paths, URLs, file names, identifiers, JSON/YAML -->

# Stage 02: Contract Synthesis & Red Team Round 1

Compile the machine contracts (`specs/contracts/`) from the Stage 01 spec and run **one** full Red Team round over the slice. Goal: every observable outcome of every operation pinned in a contract; zero unconstrained degrees of freedom outside SPEC §9. Rounds 2–3 run in Stage 03p with the prototype running, where a suspected fork is executed instead of imagined — the user sees a working product after one round.

**⊥ implementation code. Output = hardened spec + typed contracts.**

## Inputs
- Layer 4 (working): `specs/SPEC.md` (+ `specs/spec/*.md` modules), `specs/DECISION_LOG.md`, `specs/DESIGN.md` (UI), `specs/GAPS.md`, `specs/contracts/*` (if drafted)
- Layer 3 (reference): `../_config/references/completeness-checklist.md` + `../_config/contract-matrix.json` (which contracts the project type needs)
- Layer 3 (reference): `../_config/references/systems-standards.md` — read §1 Representation, §3 Errors and the §§ for the project's interfaces (§2 http, §10 cli, §11 browser); the rest on demand when a persona cites it
- Layer 3 (reference): `../_config/canonical-errors.json`, `../_config/schemas/` (manifest, errors, statecharts, cli formats)
- Layer 3 (reference): `../_config/iteration-log-format.md` §Adversarial Swarm, `../_config/rulings-template.md`, `../_config/gaps-template.md`

## Process

### 0. Pre-flight
- 0a **Context map:** frameworks/versions of the target architecture → SPEC §10 Observable Environment.
- 0b **Codebase grounding (∃ existing code):** the Reconciler reads it before the Blue Team drafts.
- 0c **Project type:** confirm → `manifest.json#projectType`; count declared outcomes against the slice cap (`manifest.sliceCap`, default 150 new outcomes since the last lock; raising it needs `sliceCapDecision` DECnnn). Over the cap → split into slices (each runs 02 → 07).

### 1. Generation pass (Blue Team)
Roles: Core Architect, Security Auditor, AI/MLOps Engineer, Data Specialist, UX/UI Lead, Technical Writer. Produce:
- `specs/contracts/manifest.json`: project type, interfaces, artifacts, `notApplicable` justifications, `equivalenceTarget` (default 2), `equivalenceCadence`, `profileOverrides`, `coverageExempt` (+ `coverageExemptClasses`).
- `openapi.yaml` (http): every operation with a unique `operationId`, strict schemas (`additionalProperties: false` on requests), headers, params, pagination, every response status enumerated.
- `schema.sql` | `.prisma`: explicit DDL, pinned types, indices, FKs, OCC `version` columns, `COLLATE "C"` where strings are sorted.
- `statecharts.json`: ∀ lifecycle entity — states, guarded transitions, terminal retention, illegal-transition error.
- `errors.json`: canonical + domain codes, statuses and `retryable` per `canonical-errors.json`.
- Type-specific per the matrix: `cli.json`, `api.d.ts`, `storage.schema.json`, `levels.schema.json`.
- SPEC edits: §5 names every operation and points to the contract (⊥ restate contract tables); §8 invariants as `- **Vn:**`; §9 Equivalence Boundary lists every declared degree of freedom; §11 overrides mirror the manifest.

**⛔ GATE:** `node specs/.sdd/scripts/sdd.cjs check --contracts` ! pass before the Red Team starts (paste the output into the iteration log). It validates schemas, cross-references, the spec's structure (sections, placeholders, hedged numbers, §11 ↔ manifest, operations named, UI component names ↔ DESIGN.md) and the slice cap. A draft missing a matrix-required artifact or a required SPEC § is rejected whole — ⊥ attack an incomplete draft.

### 2. Adversarial pass (Red Team, round 1 = the whole slice)
Personas, each attacking prose **and** contracts:
1. **Contract & Schema Auditor** — name/type mismatches between contracts and SPEC; unpinned types (`string` where UUIDv7/regex/enum is meant).
2. **Systems Invariant Auditor** — profile compliance: IDEM, OCC, PAGE, ERR, HTTP-9 evaluation order; every deviation is an override.
3. **Fork Tester** — ∀ operation: *could two competent builders, reading only these files, return different observations?* Probe status, headers, field presence, null vs absent, ordering, rounding, normalization, error precedence.
4. **Edge-Case Hunter** — missing fallbacks, undefined error paths, timeouts.
5. **Chaos Engineer** — ordering, consistency, availability assumptions; split-brain.
6. **Resource Starver** — unbounded growth, missing pagination, no retention.
7. **Quantifier** — vague parameters: ∀ number is an exact value, bounded range, formula or config ref. (`check` flags the obvious hedges; the Quantifier finds the rest.)
8. **Reconciler** (∃ codebase) — spec vs source and running infrastructure. <anti_hallucination>⊥ assume the spec is right; read the files, flag every discrepancy.</anti_hallucination>

**Round 1 judgment checklist** (what `check` cannot see; each item is answered in the log, not rubber-stamped): internal consistency (sections and contracts agree) · scope fits one implementation plan · every requirement has one reading · decisions in DECISION_LOG ↔ SPEC, none missing from the conversation · config files/env vars have exact shapes (SPEC §12, ENV-3: every TTL, limit, window, batch size is a variable with a default) · §9 lists every degree of freedom and nothing else, matching the future `variablePaths` · concurrency and transactions (races, isolation, rollback, file↔db atomicity) · exact resource limits and backoff curves · determinism (total ordering, seeds/PRNG, numeric representation, string normalization) · hardware/policy blocks have fallbacks (audio, WebGL, permissions) · UI: WCAG AA contrast for every DESIGN.md text/background pair, component tokens complete (`backgroundColor`, `textColor`, `rounded`, interactive states), copy table character-exact (UI-2), test ids for every component and state (UI-1, UI-4), auxiliary screens present (splash, loading, settings, auth, error boundary, confirmations, empty states), fast inputs throttled.

#### Findings are falsifiable
- **Blocking** = a concrete request (or UI interaction) + two observations two spec-faithful builders could each produce + the missing/contradicting citation. Example: `DELETE /notes/{id}` by a non-owner → `403` vs `404`; SPEC §5.3 names neither. Two contract files disagreeing counts as a fork.
- **Advisory** = no fork (wording, style, hypothetical scale). Logged `advisory`; never blocks, never triggers a round.
- Severity is this classification, never the critic's ranking. "Zero findings of any severity" is not a goal; a manufactured finding hides real ones.

#### Rulings ledger (`specs/logs/02-rulings.md`)
Every triaged finding → one row (`../_config/rulings-template.md`): `fixed` | `rejected` (cite where it is already pinned) | `advisory` | `gap` (→ `GAPS.md` G-nnn) | `open`. Later rounds receive the ledger; a finding that restates a ruled row without a new fork is dropped.

#### Technical vs policy
- **Technical (mechanics)** → the Blue Team resolves autonomously by the profile. ⊥ ask the user about status codes, index design, cursors, DDL types.
- **Policy (a business decision Stage 01 missed)** → exactly one question per message, batched to the end of the round, answer → DECISION_LOG + SPEC. ⊥ resolve policy with a "sensible default" — that is the builder guess this pipeline exists to prevent. A question the user cannot answer yet → `GAPS.md` row (kind `policy`, provisional DECnnn); the prototype builds the provisional answer; Stage 04 refuses to freeze while it is open.

#### Rounds
Round 1 here, whole slice. Rounds 2–3 in Stage 03p, delta only, prototype running. Hard cap 3 per iteration (`## 🔄 Iteration N` headings in `specs/logs/02-swarm.md` since the transition that opened the iteration). ⊥ run round 2 here.

#### Visible logs
Write round 1 in full (format: `../_config/iteration-log-format.md`) to `specs/logs/02-swarm.md`, including the **Outcome Table**: ∀ operation | command, every outcome (success + each reachable error with its trigger), cross-checked by the gate against openapi/cli.json. ⊥ "internally looped"; a summarized log invalidates the run.

### 3. Resolution
Technical findings → Blue Team fixes via the profile → `check --contracts` again. Policy findings → user (batched). Every finding → a ruling row. Then stop: the next round waits for the prototype.

## Exit criteria (all; the gate checks what it can)
1. `sdd.cjs check --contracts` passes; slice within cap.
2. Round 1 logged in full with the Outcome Table complete; the judgment checklist answered in the log.
3. `specs/logs/02-rulings.md`: no `open` row.
4. `GAPS.md` well-formed (open policy rows allowed until Stage 04).

## Outputs
- `specs/SPEC.md` (+ modules) hardened, with §9 Equivalence Boundary
- `specs/contracts/manifest.json` + matrix-required contracts
- `specs/DECISION_LOG.md` (policy answers, profile overrides)
- `specs/logs/02-swarm.md` (round 1 + Outcome Table), `specs/logs/02-rulings.md`
- `specs/GAPS.md` (policy questions the user could not answer yet)
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 02` (refuses unless `check --contracts` passes, the slice is within its cap, `02-swarm.md` was written this stage with ≥ 1 round and a complete Outcome Table, and the rulings ledger has no open row).
2. **Handoff:** present spec, contracts and `sdd.cjs readiness`; prompt the user to proceed to `03p_prototype` (every project type).
