<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 02: Prototype — See It

Build a working v0 of the slice from the brief, put it in front of the user, fold every answer into the spec, repeat until the user accepts the shape of the product. No contracts, no Red Team, no oracle here: that is Stage 03, run against this prototype while it keeps running. The accepted prototype becomes **build A** and the reference system Stage 04 records the oracle against.

This trades the "spec-only builder" property of build A for seeing the product first. The guarantee is kept elsewhere: every oracle value gets a spec-only second interpretation (Stage 03 sample, Stage 04 full), `recorded:` is never a citation, and L2 still needs a clean-room build B that never sees this code.

## When
- After Stage 01 — every project type.
- After Stage 01b (adopted codebase): the existing system **is** the prototype and v0 is what runs today. The demo loop is a walkthrough, surface by surface: intended → `GAPS.md` row `confirmed` + the SPEC sentence that pins it; bug → DECISION_LOG + SPEC edit + code fix in the same step (never pinned as behavior); outside the first slice → stays `deferred`. No build step; §1 does not apply except its regression-guard rule on iterations.
- Again when the product must change after acceptance (Stage 03 feedback that changes what the user sees; Stage 00 `--resume 02`).
- Iterations (a lock ∃): start from the certified build A; the previous slice's oracle is the regression guard (§1).
- Skipping requires the user's decision in DECISION_LOG and `transition --completed 03 --override DECnnn`.

## Inputs
- Layer 4 (working): `specs/SPEC.md` (draft), `specs/DECISION_LOG.md`, `specs/GAPS.md` (open policy rows = the provisional answers to build), `specs/DESIGN.md` (UI: tokens, UI State Matrix)
- Layer 3 (reference): `../_config/references/prototype-checklist.md` — the dozen profile rules a prototype follows *now* because retrofitting them rewrites it; the full profile is enforced in Stage 03
- Layer 3 (reference): `../_config/prototype-record-template.md`, `../_config/gaps-template.md`, `../_config/decision-log-template.md`

## Process

### 1. Build v0
- Only the slice. Every open policy gap is built exactly as its `GAPS.md` draft assumption states — the demo is where the user decides. Out-of-slice idea → `GAPS.md` row, status `deferred`, with a DECnnn.
- Follow `prototype-checklist.md`: error envelope, ids, timestamps, idempotency header, version + `If-Match`, pagination envelope, test ids + copy (UI), limits from env vars. Everything else the profile pins is Stage 03's to find and fix.
- Real storage of the declared engine (SPEC §10; unset → the profile default), real DDL you keep: Stage 03 lifts it into `schema.sql`, Stage 04 records the oracle against this code. ⊥ mocks on the observable path.
- UI: ∀ component carries its `data-testid` (profile UI-1), visible copy comes from SPEC §14 where it exists (what you invent goes into the copy table in the same step), ∀ UI State Matrix state is reachable. Stage 03 captures these screens as the frozen wireframes, so what is missing here is missing there.
- ⊥ oracle authoring, ⊥ contracts, ⊥ freeze. Internal tests are allowed and never count as evidence.
- **Iterations:** start from build A. Run `node specs/.sdd/scripts/oracle.cjs run` (unfiltered, target `default`) as the regression guard: ∀ existing case stays green unless a DECISION_LOG entry of this iteration names the case as a declared behavior change. The gate refuses an undeclared failure. A guard, not evidence (the lock is broken until Stage 04 re-freezes).

### 2. Demo loop (versions)
Every demo the user sees is a **version**: one row in the `Versions` table of `specs/logs/02-prototype.md` (v0, v1, …; budget 3 per slice, `manifest.budgets.prototypeVersions`; over is a signal, not a block).
1. Run the prototype; give the user the URL or command. Walk them through the slice **and through every open policy gap**: "here it does X provisionally — is that right?" One question per message, with the product on screen. Each answer → DECISION_LOG entry + SPEC edit + `GAPS.md` row `resolved` | `confirmed`.
2. ∀ change the user asks for → `SPEC.md` / `DESIGN.md` edit **in the same step** as the code, with a DECISION_LOG entry. Code-only feedback changes = drift = process violation (Stage 04 catches leftovers: the recorded prototype and the spec-only predictor disagree). A new operation or screen → SPEC §5 / §14 row.
3. `node specs/.sdd/scripts/sdd.cjs check --spec` after every spec edit (draft mode: placeholders are reported, not errors).
4. Show `node specs/.sdd/scripts/sdd.cjs readiness` after each version: budgets vs actuals, the user's remaining questions verbatim, the path to a frozen spec, their next action.
5. Say what is next, once: "Stage 03 hardens this without you (contracts, Red Team, wireframes); you get the policy questions a round raises, batched, and (UI) the captured screens to review; then you approve the freeze."

### 3. Record & acceptance
1. Write `specs/logs/02-prototype.md` (format: `../_config/prototype-record-template.md`): the `Run:` line Stages 03 and 04 start the prototype with, target, build environment, the `Versions` table (one row per demo).
2. **⛔ GATE:** the stage ends only on the user's explicit acceptance, given on the command line: `node specs/.sdd/scripts/sdd.cjs transition --completed 02 --approved-by "<user>"`. ⊥ write acceptance into a file; the transition records who accepted in `specs/logs/transitions.jsonl`. Acceptance means "this is the product": Stage 03 may still change mechanics (status codes, envelopes, a tie-breaker) and shows anything the user can see as a further version row. Each further idea → next slice (`GAPS.md` deferred row + DECnnn).

## Outputs
- Prototype code (build A from Stage 05 on)
- `specs/logs/02-prototype.md`, `specs/GAPS.md`, `specs/DECISION_LOG.md` entries, SPEC/DESIGN edits from feedback
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 02 --approved-by "<user>"` (refuses unless the SPEC.md draft sections are filled, `DESIGN.md` exists (UI), `02-prototype.md` has a Run line and ≥ 1 version row written this stage, `GAPS.md` is well-formed, `--approved-by` is given, and — on iterations — the regression run is green or every failure is a declared behavior change).
2. **Handoff:** `03_hardening`. Keep the prototype runnable: every Red Team finding is executed against it, the wireframes are captured from it, and Stage 04 records against it.
