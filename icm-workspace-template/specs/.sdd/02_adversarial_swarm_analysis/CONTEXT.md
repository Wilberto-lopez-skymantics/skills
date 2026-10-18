<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->
<!-- PRESERVE VERBATIM: code blocks, paths, URLs, file names, identifiers, JSON/YAML -->

# Stage 02: Contract Compilation

Compile the machine contracts (`specs/contracts/`) and the Outcome Table from the Stage 01 spec, so the prototype follows real shapes. **No adversarial review here**: every Red Team round runs in Stage 03p against the running prototype (`../_config/references/red-team.md`). This stage is agent-only and mechanical — `sdd.cjs check --contracts` is its judge — so the user reaches the first prototype demo right after the interview.

**⊥ implementation code. ⊥ Red Team rounds. Output = contracts + Outcome Table.**

## Inputs
- Layer 4 (working): `specs/SPEC.md` (+ `specs/spec/*.md`), `specs/DECISION_LOG.md`, `specs/GAPS.md`, `specs/DESIGN.md` (UI), `specs/contracts/*` (if drafted)
- Layer 3 (reference): `../_config/references/completeness-checklist.md` + `../_config/contract-matrix.json` (which contracts the project type needs)
- Layer 3 (reference): `../_config/references/systems-standards.md` — §1 Representation, §3 Errors, and the §§ for the project's interfaces (§2 http, §10 cli, §11 browser)
- Layer 3 (reference): `../_config/canonical-errors.json`, `../_config/schemas/` (manifest, errors, statecharts, cli)
- Layer 3 (reference): `../_config/iteration-log-format.md` §Outcome Table

## Process
0. **Pre-flight:** frameworks/versions → SPEC §10; ∃ existing code → read it first; confirm the project type → `manifest.json`; count declared outcomes against the slice cap (`manifest.sliceCap`, default 150 new since the last lock). Over the cap → split the slice.
1. **Compile (Blue Team: Core Architect, Data Specialist, Security Auditor, UX/UI Lead):**
   - `specs/contracts/manifest.json`: project type, interfaces, artifacts, `notApplicable`, `equivalenceTarget` (default 2), `equivalenceCadence`, `profileOverrides`, `coverageExempt` (+ classes), `budgets`.
   - `openapi.yaml` (http): every operation with a unique `operationId`, strict schemas (`additionalProperties: false` on requests), headers, params, pagination, every response status enumerated.
   - `schema.sql` | `.prisma`: explicit DDL, pinned types, indices, FKs, OCC `version` columns, `COLLATE "C"` where strings sort.
   - `statecharts.json`: ∀ lifecycle entity — states, guarded transitions, terminal retention, illegal-transition error.
   - `errors.json`: canonical + domain codes per `canonical-errors.json`.
   - Type-specific per the matrix: `cli.json`, `api.d.ts`, `storage.schema.json`, `levels.schema.json`.
   - SPEC edits only where compilation needs them: §5 names every operation and points to the contract (⊥ restate tables); §11 mirrors `profileOverrides`. Open policy gaps stay open — the contract encodes the provisional assumption from `GAPS.md`, and the row says so.
2. **Outcome Table** → `specs/logs/02-swarm.md`: ∀ operation | command, every outcome (success + each reachable error, with its trigger). The gate cross-checks it against openapi/cli.json. Rounds are appended to this file later, in 03p.
3. **Validate:** `node specs/.sdd/scripts/sdd.cjs check --contracts` ! pass — schemas, cross-references, the spec's structure (sections, placeholders, hedged numbers, §11 ↔ manifest, operations named, UI components ↔ DESIGN.md), slice cap. Fix and re-run until clean; paste the output into `02-swarm.md`.

Technical choices (status codes, index design, cursors, DDL types) are made here by the Equivalence Profile, never by asking the user. A business question the compiler hits → `GAPS.md` row (kind `policy`) with a provisional assumption, asked at the next prototype demo.

## Outputs
- `specs/contracts/manifest.json` + matrix-required contracts
- `specs/SPEC.md` edits (§5 operation names, §11), `specs/GAPS.md` rows for policy questions found while compiling
- `specs/logs/02-swarm.md` (Outcome Table + check output)
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 02` (refuses unless `check --contracts` passes, the slice is within its cap, and `02-swarm.md` was written this stage with a complete Outcome Table).
2. **Handoff:** `sdd.cjs readiness` → the user sees the path and their open questions; proceed to `03p_prototype` (every project type).
