<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 05: Spec-Only Development Swarm

Make the frozen oracle pass using only the frozen spec set. Equivalence follows from that narrowness: a second builder with the same files must reach the same observations without anything this builder knew from elsewhere.

**The oracle is the inner loop.** Per phase: Decision Inventory → build → `oracle.cjs run --phase N` until green → one Red Team pass for what the oracle cannot observe. A phase without the green run pasted in its log is not done.

> **Build A continues the prototype** accepted in Stage 02 and hardened in Stage 03. From the freeze on, every change to it is driven by a failing oracle case or a cited inventory entry; prototype behavior with no citation is either pinned by the frozen set (keep) or a gap (SCR). **Build B is always spec-only**: it starts from `sdd.cjs export` and never sees the prototype. Only L2 certifies that the spec, not the prototype, determines the observations.

## Inputs (the ONLY inputs)
- Layer 4 (frozen): `specs/SPEC.md` (+ `specs/spec/*.md`), `specs/DESIGN.md` (UI), `specs/contracts/*`, `specs/fixtures/*`, `specs/wireframes/*.html` (UI), `specs/CODING_STANDARDS.md` (if exists: internal conventions only)
- Layer 4 (working): `specs/IMPLEMENTATION_PHASES.md`
- Layer 3 (reference): `../_config/role-standards.md`, `../_config/iteration-log-format.md` §Development Swarm, `../_config/references/systems-standards.md` (the profile is part of the spec: read the §§ for the project's interfaces)

## Gates

### ⛔ Spec-only context
- Run in a fresh session | sub-agent. ⊥ read Stage 01–04 conversation history, `specs/logs/`, `specs/DECISION_LOG.md` rationale, or any other implementation of this spec.
- Build A exceptions (exactly two): its own codebase (the accepted prototype), and `specs/logs/03-decisions.md` as the seed of its Decision Inventory — citations only, each re-verified against the frozen files. Nothing else under `specs/logs/`; never the prototype conversation. The code is a starting point, the frozen set is the truth.
- A fact the frozen set does not state (value, ordering, message, edge case) = **spec gap**: draft `specs/changes/SCR-NNN.md` (Stage 00 format, class C) and stop work on that item; unaffected items continue. A case you believe wrong → same route (class B); the case stays until the user approves the SCR.

### ⛔ Immutable (anti-tampering)
- ⊥ modify, add or delete any file in the frozen set (`SPEC.md`, `spec/`, `DESIGN.md`, `CODING_STANDARDS.md`, `contracts/`, `fixtures/`, `wireframes/`, `.sdd/`). Relaxing an assertion, skipping a case, altering an expected payload = AUTOMATIC PROCESS FAILURE. A failing case means the CODE is defective — unless an approved SCR says otherwise.
- `node specs/.sdd/scripts/sdd.cjs verify` ! pass before and after every phase. Failing → stop, report, restore (`git checkout -- <file>`).
- Writable under `specs/`: checkboxes in `IMPLEMENTATION_PHASES.md`, `dev-swarm-reconciliation.md`, `logs/**`, `changes/SCR-*` drafts.

## Teams
- **Blue Team (builders):** Infrastructure, Backend, Security, Frontend, Writer (+ specialists the stack needs). Standards: `../_config/role-standards.md`, `specs/CODING_STANDARDS.md`. Query Context7 MCP for framework syntax when available; otherwise web search | training knowledge and note "docs not verified" in the log.
- **Red Team (once per phase, after the oracle is green):** Architect (Spec Enforcer), Compliance Enforcer, DX Auditor, Penetration Tester; + Chaos Engineer and Resource Starver for services and fullstack apps; + Visual QA Tester and Design Token Auditor when `manifest.interfaces` includes `browser`. Scope = what the oracle cannot observe: security, resource bounds, orphan code, dependency justification, token use, spec clauses no case observes. The oracle already decided everything it grades.

## Rules
- **Acceptance evidence** = `oracle.cjs run` 100% green against the current lock (+ the frozen UI specs for browser projects). Nothing else. Builder tests are allowed outside `specs/` and never count.
- **Graded configuration:** start the build for every oracle run with `eval "$(node specs/.sdd/scripts/oracle.cjs env)"`. Other defaults are fine for development, never for evidence.
- **Observable environment** (SPEC §10) ! match: runtime, database engine/version, collation, timezone. Internals (modules, folders, helpers) are free unless SPEC pins them; list every new runtime dependency with a one-line justification in the reconciliation.
- **Design tokens (UI):** read `specs/DESIGN.md` before any component; every color/font/spacing/radius references a token (hardcoded value that exists as a token = FAIL); component names, `data-testid`s, copy and state ids match wireframes and SPEC §14 exactly (profile UI-1…UI-4). Screenshot each screen the phase touches; the formal visual gate is Stage 06.
- **Docker** (backend-service, fullstack-app): `.dockerignore` whenever a `Dockerfile` is created or modified.
- **TypeScript:** `tsc --noEmit` with zero errors; a bundler build is not a typecheck. Mocked unit tests are not evidence of contract behavior.
- **Orphan check:** every helper is imported and called from the main entry; a module used only by tests = FAIL.
- **Logs:** every phase iteration written in full (`../_config/iteration-log-format.md` §Development Swarm) to `specs/logs/05-swarm.md`. ⊥ "internally looped".

## Oracle-driven loop (∀ phase, in `IMPLEMENTATION_PHASES.md` order; only unchecked `- [ ]` phases)
"Run continuously" | "finish development" → proceed through every phase without returning to the user.
0. **Pre-flight:** `sdd.cjs verify` passes.
1. **Decision Inventory** (before any code) → `specs/logs/05-decisions.md`: every observable decision the phase requires (status, header, field value, ordering, message, default, limit) with the frozen line that pins it. Uncitable = spec gap → SCR now, not after the code exists. Build B writes its own from scratch.
2. **Build (Blue Team)** against the inventory and the contracts.
3. **Oracle loop:** `node specs/.sdd/scripts/oracle.cjs run --phase N` (browser-only phases: the frozen UI suite) → fix the CODE for each failure → re-run until 0 failed, 0 errored. Hard limit 5 rounds without green → halt & ask the user.
4. **Red Team pass** (once, after green): findings → fix + re-run the oracle, or → SCR draft when a spec gap is exposed.
5. **Phase gate:** oracle green on the final code, `sdd.cjs verify` passes, log holds the pasted run and the Red Team table → tick the phase's boxes.
6. **Run:** single-command start (`docker compose up -d` for services; the documented command otherwise); DX Auditor verifies; Writer updates `README.md`.

`--phase N` is cumulative: earlier phases are re-graded as regressions. **Class 0 changes** (refactor, dependency bump): no new phases; the full oracle stays green and `sdd.cjs verify` passes unchanged.

> **Lockstep build B (recommended for L2; required early warning under `equivalenceCadence: "release"`):** `sdd.cjs export ../<project>-eqb` after the freeze; a fresh session builds there phase by phase. Both green → `node specs/.sdd/scripts/oracle.cjs diff --phase N --b-root ../<project>-eqb`. A filtered diff is an early warning, not evidence; divergences → Stage 00, re-freeze, `sdd.cjs export ../<project>-eqb --update`.

## Reconciliation (after all phases)
`specs/dev-swarm-reconciliation.md` (format: `../_config/iteration-log-format.md` §Reconciliation): re-read SPEC and contracts against the code — endpoint fields/params/headers ↔ `openapi.yaml`; migrations ↔ `schema.sql`; frontend components exist with their `data-testid`s; SPEC §12 env vars referenced; new dependencies justified; full unfiltered `oracle.cjs run` pasted. Drift → fix the CODE; spec wrong → SCR. ⊥ edit a frozen file to match the code. **⛔ GATE:** zero ❌ rows.

## Outputs
- Codebase, `README.md`
- `specs/logs/05-decisions.md`, `specs/logs/05-swarm.md`, `specs/logs/oracle/run-*.json`
- `specs/dev-swarm-reconciliation.md`, `specs/changes/SCR-*.md` drafts (if any)
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)

### Handoff / Transitions
1. **Final evidence:** unfiltered `node specs/.sdd/scripts/oracle.cjs run` → 100% green; UI projects also `specs/logs/ui-e2e.json`.
2. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 05` (refuses unless the lock is intact, the latest unfiltered run on this lock is green, and the reconciliation has zero ❌).
3. **Handoff:** UI → `06_visual_acceptance_testing`; otherwise → `07_verification_before_completion`.
