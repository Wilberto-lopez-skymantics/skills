<!-- sdd-icm-template -->
<!-- version: 2026.10.18-v3.2-prototype-first -->
<!-- source: github.com/Wilberto-lopez-skymantics/skills -->

# Spec-Driven Development (SDD v3) Workspace
## Observational Equivalence Engine

**Objective:** a frozen spec set — prose spec, typed machine contracts, and an executable oracle — so complete that two independent builders, each given ONLY that set, produce systems the oracle cannot tell apart.

**Equivalence is measured, not asserted:**
> Two builds are observationally equivalent iff, for every case and probe in `specs/fixtures/`, they produce identical observations at the declared interfaces, after masking only the values the spec explicitly declares variable (SPEC §9 Equivalence Boundary).

| Level | Evidence |
|---|---|
| L1 Oracle-conformant | Lock intact + `oracle.cjs run` 100% green against the current lock |
| L2 Equivalence-verified (default target) | L1 + `oracle.cjs diff` between two independently built implementations reports zero divergences |

**Tools** (Node.js ≥ 18, zero dependencies):
- `node specs/.sdd/scripts/sdd.cjs status | check | readiness | freeze | verify | transition [--approved-by] [--release] | export [--update]`
- `node specs/.sdd/scripts/oracle.cjs run | diff | diff-ui | diff-expect | strip-expect | gen-probes | record | env`
- `node specs/.sdd/scripts/ui-capture.cjs --url … --name …` (Stage 03: wireframes captured from the prototype; needs Playwright)

**Reference example:** `specs/.sdd/_config/examples/notes-service/` — a complete, validated frozen spec set. Imitate its precision, not its domain.

**See it first, then harden it.** Stage 01 scopes a bounded slice; Stage 02 writes the contracts and runs one Red Team round; Stage 03p builds a working prototype of that slice for the user, then runs hardening rounds 2–3 against the running prototype and ends on the user's acceptance (`--approved-by`). UI projects capture their wireframes from the accepted prototype (Stage 03). `sdd.cjs readiness` reports, in counts, how far the slice is from a freezable spec (open gaps, coverage, latest diff-expect, failing gates).

**Diff early, not only at the end.** Divergence is measured at every stage, cheapest first: Stage 01 dual interpretation of scenarios (once per slice + high-risk topics) → Stage 02 fork-only findings on contracts → Stage 03p prototype Decision Inventory (uncited decisions → `GAPS.md`), executed Fork Tests against the prototype, sampled `diff-expect` by spec-only authors → Stage 04 two-interpretation oracle (A recorded from the prototype, B predicted from the spec alone) + generated probes → Stage 05 builder decision inventory and lockstep build B with per-phase `diff` → Stage 07 full dual-build `diff` (the evidence; per slice, or per release with `manifest.equivalenceCadence: "release"`).

## Entry Protocol (∀ requests, before anything else)

1. Run `node specs/.sdd/scripts/sdd.cjs status` → current stage, lock state, latest evidence, and the next stage's exit gates.
2. Classify the request with **Change Classes** below.
3. Read the target stage's `CONTEXT.md` before doing anything else.
4. The target stage's inputs are missing → ⊥ proceed. Tell the user what is missing and which stage produces it. Skipping requires the user's explicit instruction, recorded in `specs/DECISION_LOG.md`.
5. Finish a stage only with `sdd.cjs transition --completed <stage>`. It refuses a stage that is out of order and refuses until the exit gates pass, then records the transition in `specs/logs/transitions.jsonl`. A user-approved skip uses `--override DECnnn` (the decision ! exist in `specs/DECISION_LOG.md`); the exit gates still apply. ⊥ hand-edit `specs/.sdd/_config/sdd-state.json` (the tools and `transitions.jsonl` are its only writers; every transition also records stage metrics there).

## Change Classes

| Class | Definition | Route |
|---|---|---|
| **0 Non-observable** | Changes no observation at any declared interface: refactor, dependency bump, performance, internal logging | 05 → 07. Oracle ! stay 100% green; `sdd.cjs verify` ! pass unchanged |
| **1 Observable** | Adds or changes an observation: feature, behavior change, new error, UI change (incl. the next slice) | 01 → 02 → 03p → (03) → 04 → 05 → (06) → 07 |
| **2 Defect** | Disputed oracle case, `oracle diff` divergence, escaped bug, Stage 07 failure — after the first freeze | 00 → re-freeze → resume where `--resume` says. ∄ lock yet → not Class 2: edit the spec in the current stage + add/close a `GAPS.md` row |

Unsure between Class 0 and 1 → Class 1.

## The Frozen Set

`sdd.cjs freeze` (end of Stage 04) hashes these into `specs/spec.lock.json`:
- `specs/SPEC.md` (+ `specs/spec/**` modules, each linked from SPEC.md), `specs/DESIGN.md`, `specs/CODING_STANDARDS.md` (if used), `specs/contracts/**`, `specs/fixtures/**`, `specs/wireframes/**`
- the pipeline itself: `specs/.sdd/**` except `_config/sdd-state.json`

Working files outside the lock: `DECISION_LOG.md`, `GAPS.md`, `IMPLEMENTATION_PHASES.md` (only checkboxes change after freeze), `logs/**` (incl. `02-rulings.md`, `03p-prototype.md`, `03p-decisions.md`), `changes/**` (incl. `changes/oracle/**` scratch cases and tools), `backprop-log.md`, `phase-integrity-check.md`, `dev-swarm-reconciliation.md`, `vat-checklist.md`, `VAT_REPORT.md`, `EQUIVALENCE_REPORT.md`.

After the freeze, a frozen file changes through exactly two doors, both ending in a user-approved `sdd.cjs freeze`:
1. **Class 1 iteration** — Stages 01 → 02 → 03p → (03) → 04 edit the spec set; the lock stays broken until Stage 04 re-freezes it with the user's approval. The previous slice's oracle guards the prototype during 03p (undeclared failures refuse the transition).
2. **Stage 00 Spec Change Request** (Class 2) — SCR → explicit user approval → edit → `sdd.cjs freeze --reason "SCR-NNN: …" --approved-by "<user>"`.

`sdd.cjs verify` detects every other change. Every gate from Stage 04 on refuses while the lock is broken, so no build can be graded against an unapproved spec.

## Workspace Stages

Map the request to a stage and **read its `CONTEXT.md` before doing anything else.**

0. **`specs/.sdd/00_backprop/CONTEXT.md`**: Defect backpropagation. Classify the root cause, write a Spec Change Request, get user approval, patch spec + contracts + oracle, re-freeze. Never writes implementation code.
1. **`specs/.sdd/01_brainstorming/CONTEXT.md`**: Socratic dialogue with a real-time **Shadow Critic**. Scopes a bounded slice; ends when the 4 **Extraction Closure** dimensions pass with zero open domain gaps inside it.
1b. **`specs/.sdd/01b_adoption/CONTEXT.md`**: Bring an existing codebase under SDD: reverse-engineer spec and contracts, record a characterization oracle.
2. **`specs/.sdd/02_adversarial_swarm_analysis/CONTEXT.md`**: **Machine contract synthesis** (`specs/contracts/`), validated by `sdd.cjs check --contracts`, plus Red Team **round 1** over the whole slice. Fork-only blocking findings, rulings ledger.
3p. **`specs/.sdd/03p_prototype/CONTEXT.md`**: Working **prototype** of the slice for the user (every project type, right after 02); every uncited decision → `GAPS.md`; feedback edits the spec in the same step; hardening **rounds 2–3** run against the running prototype (cap 3 per iteration); sampled `diff-expect`; ends on the user's acceptance via `transition --completed 03p --approved-by`. The prototype becomes build A.
3. **`specs/.sdd/03_interactive_wireframing/CONTEXT.md`**: UI projects, after 03p — the frozen HTML wireframes are **captured from the accepted prototype's screens** (test ids, copy, tokens, states verified), reviewed by the user.
4. **`specs/.sdd/04_writing_implementation_phases/CONTEXT.md`**: **Oracle synthesis** (`specs/fixtures/`) from two interpretations, phase breakdown, coverage check, zero open gaps, user-approved **freeze**.
5. **`specs/.sdd/05_development_swarm/CONTEXT.md`**: Spec-only build, per phase: Decision Inventory → build → `oracle.cjs run --phase N` until green → one Red Team pass for what the oracle cannot see. Build A continues the accepted prototype; build B starts from `sdd.cjs export`. Builders never modify the frozen set.
6. **`specs/.sdd/06_visual_acceptance_testing/CONTEXT.md`**: Browser-based visual QA against tokens, wireframes and frozen UI specs.
7. **`specs/.sdd/07_verification_before_completion/CONTEXT.md`**: Fresh evidence + equivalence certification (L1/L2) → `specs/EQUIVALENCE_REPORT.md`; lists the deferred `GAPS.md` rows as next-slice candidates. With `manifest.equivalenceCadence: "release"`, intermediate slices certify L1 with an explicit `L2 pending` row and L2 is certified with `--release`.

## Core Rules

- **The spec is the only channel.** A builder ⊥ use anything outside the frozen set — conversation history, swarm logs, another implementation. Information it needs but cannot find = spec gap → Stage 00.
- **The oracle derives, never decides.** ∀ expected value in a fixture ! be citable from SPEC, contracts or the Equivalence Profile (`derivedFrom`). A value the fixture author had to choose = spec gap.
- **Pinned defaults.** `_config/references/systems-standards.md` (Equivalence Profile) applies automatically. Deviations ! be in `manifest.json#profileOverrides` + `DECISION_LOG.md`.
- **Single grader.** Only `oracle.cjs` (and frozen UI specs) grades. Builder-written tests are allowed for internal use and never count as evidence.
- **Evidence is lock-bound and fresh.** Oracle results count only if their `lockHash` equals the current lock; Stage 07 accepts only evidence produced after Stage 07 began.
- **Machine contracts over prose.** Operations, storage, lifecycles and errors live in `specs/contracts/`; SPEC points to them instead of restating them.
- **Code is a byproduct.** ⊥ write implementation code before the frozen set is locked — except the Stage 03p prototype of the declared slice (and Class 0 changes against an existing lock). The prototype is never evidence; build B never sees it.
