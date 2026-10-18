<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 03p: Prototype & Hardening

Build a working product from the reviewed (unfrozen) spec draft, put it in front of the user, fold their feedback into the spec, then finish hardening the spec **with the prototype running**. The user sees the product before the oracle exists; the prototype becomes **build A** and the reference system Stage 04 records the oracle against.

This stage trades the "spec-only builder" property of build A for speed. The guarantee is kept elsewhere: Stage 04 checks every oracle value with two independent interpretations, and L2 still needs a clean-room build B made from the frozen set alone.

## When
- After Stage 02 (contracts compiled) — every project type. UI projects run Stage 03 after this stage: the wireframes are captured from the accepted prototype.
- Again when the prototype must change after acceptance (UI: re-run 03 afterwards if any screen changed).
- Iterations (a lock ∃): the prototype is the certified build A. Prototype the new slice on it; the previous slice's oracle is the regression guard (§1).
- Adopted codebases (01b → 02): the existing system is the prototype. Record its Run line; the Decision Inventory may state "existing system, characterized in 01b".
- Skipping requires the user's decision in DECISION_LOG and `transition --completed 04 --override DECnnn`.

## Inputs
- Layer 4 (working): `specs/SPEC.md` (+ modules), `specs/contracts/*`, `specs/DESIGN.md` (UI: tokens from Stage 01; ∄ wireframes yet), `specs/DECISION_LOG.md`, `specs/GAPS.md` (open policy rows = the user's questions, with the provisional answers to build), `specs/logs/02-swarm.md` (Outcome Table)
- Layer 3 (reference): `../_config/references/systems-standards.md` (Equivalence Profile: applies to the prototype exactly as to any build)
- Layer 3 (reference): `../_config/references/red-team.md` (personas, falsifiable findings, rulings, rounds — all hardening rounds run here)
- Layer 3 (reference): `../_config/prototype-record-template.md`, `../_config/gaps-template.md`, `../_config/rulings-template.md`, `../_config/iteration-log-format.md`

## Process

### 1. Build (version 0)
- Build only what the slice declares. Out-of-slice ideas → `GAPS.md` row, status `deferred`, with a DECnnn.
- Open policy gaps are built as their provisional assumption, exactly as the `GAPS.md` row states it — the demo is where the user decides.
- Follow the contracts, the Equivalence Profile and the design tokens. Contract and profile behavior is not a prototype shortcut: Stage 04 grades the prototype against them.
- UI: ∀ component carries its `data-testid` (profile UI-1), visible copy comes from SPEC §14 (UI-2), ∀ UI State Matrix state is reachable. Stage 03 captures these screens as the frozen wireframes, so what is missing here is missing there.
- ⊥ oracle authoring in this stage, ⊥ freeze. Internal tests are allowed and never count as evidence.
- **Iterations:** start from build A. Run `node specs/.sdd/scripts/oracle.cjs run` (unfiltered, target `default`) as the regression guard: ∀ existing case stays green unless a DECISION_LOG entry of this iteration names the case as a declared behavior change. The gate refuses an undeclared failure. These runs are a guard, not evidence (the lock is broken until Stage 04 re-freezes).

### 2. Decision Inventory → `specs/logs/03p-decisions.md`
∀ observable decision the build makes (status, field value, ordering, message, default, limit, layout choice) → cite the spec line that pins it. A decision without a citation → `GAPS.md` row (kind `builder`), with the value the prototype chose as the draft assumption. Format: `../_config/prototype-record-template.md`. This is the cheap version of the Stage 05 Decision Inventory: same check, but it records instead of blocking.

### 3. Demo loop (versions)
Every demo the user sees is a **version** — one row in the `Versions` table of `specs/logs/03p-prototype.md` (v0, v1, …; budget 3 per slice, `manifest.budgets.prototypeVersions`; over is a signal, not a block).
1. Run the prototype; give the user the URL or command. Walk them through the slice **and through every open policy gap**: "here it does X provisionally — is that right?" Each answer → DECISION_LOG entry + SPEC edit + `GAPS.md` row `resolved` | `confirmed`. This is where most policy questions get answered, one per message, with the product on screen.
2. ∀ change the user asks for → update `SPEC.md` / `DESIGN.md` / contracts **in the same step** as the code, with a DECISION_LOG entry. Code-only feedback changes = drift = process violation. (Stage 04 catches leftover drift mechanically: the recorded prototype and the spec-only predictor disagree.)
3. `node specs/.sdd/scripts/sdd.cjs check --contracts` ! pass after every spec edit. Feedback that adds an operation or a lifecycle → extend the Outcome Table in `02-swarm.md`; the next hardening round attacks it in full.
4. Show the user `node specs/.sdd/scripts/sdd.cjs readiness` after each version: budgets vs actuals, their remaining questions verbatim, the path to a frozen spec, and their next action.

### 4. Hardening rounds (prototype running)
All Red Team rounds of the iteration run here, per `../_config/references/red-team.md`: round 1 full (whole slice, all personas, the Round 1 judgment checklist answered in the log), rounds 2–3 delta, cap 3 (`## 🔄 Iteration N` headings in `specs/logs/02-swarm.md` since the transition that opened the iteration). Interleave rounds with demos: round 1 after v0 is accepted as "the right product", so the critics attack a shape the user wants. The Fork Tester **executes** suspected forks against the prototype; the Reconciler reads its code. Prototype ≠ pinned value → fix the prototype now. Spec silent → blocking finding → profile (technical) | user question at the next demo (policy). A round with zero blocking findings ends the loop. Run `sdd.cjs check --contracts` before every round; every round in full to `02-swarm.md`; every finding → `specs/logs/02-rulings.md`.

### 5. Sampled Interpretation Diff
One request-only case per operation | command (prefer the success outcome; neutral titles — `Predict: POST /orders`), in `specs/changes/interp/requests/`. Two fresh sub-agents — given ONLY `specs/SPEC.md`, `specs/contracts/` and the Equivalence Profile; **never the prototype, its code, `specs/logs/`, or this conversation** — each write the full expected response with `derivedFrom` citations, using `{"$unspecified": "<what is missing>"}` where the files do not decide (`specs/changes/interp/a/`, `…/b/`). Then `node specs/.sdd/scripts/oracle.cjs diff-expect --a specs/changes/interp/a --b specs/changes/interp/b --label interp` ! report zero gaps. ∀ gap → fix the spec or contracts (policy → the user). ⊥ resolve a gap by choosing one author's answer. This is the cheap pre-check of the full, every-outcome dual check Stage 04 runs — ⊥ defer the sample there.

### 6. Readiness & acceptance
1. `node specs/.sdd/scripts/sdd.cjs readiness` → show the user.
2. Write `specs/logs/03p-prototype.md` (format: `../_config/prototype-record-template.md`): the `Run:` line Stage 04 starts the prototype with, target, build environment, rounds, and the `Versions` table (one row per demo).
3. **⛔ GATE:** the stage ends only on the user's explicit acceptance, given on the command line: `node specs/.sdd/scripts/sdd.cjs transition --completed 03p --approved-by "<user>"`. ⊥ write acceptance into a file; the transition records who accepted in `specs/logs/transitions.jsonl`. Each further idea → next slice (`GAPS.md` deferred row + DECnnn).

## Outputs
- Prototype code (becomes build A in Stage 05)
- `specs/logs/03p-prototype.md`, `specs/logs/03p-decisions.md`, `specs/GAPS.md`
- `specs/logs/02-swarm.md` (rounds 1–3, Outcome Table current), `specs/logs/02-rulings.md` (no open row)
- `specs/changes/interp/` (sampled dual prediction, working files) + `specs/logs/oracle/expectdiff-interp.json`
- Spec edits from feedback and hardening + DECISION_LOG entries
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 03p --approved-by "<user>"` (refuses unless `check --contracts` passes, the slice is within its cap, `03p-prototype.md` has a Run line and ≥ 1 version row, `03p-decisions.md` was written this stage, `GAPS.md` is well-formed, ≥ 1 Red Team round is logged and the rulings ledger written this stage has no open row, a fresh zero-gap sampled `diff-expect` exists, and — on iterations — the regression run is green or every failure is a declared behavior change).
2. **Handoff:** UI project → `03_interactive_wireframing` (wireframes captured from this prototype). Otherwise → `04_writing_implementation_phases`. Keep the prototype runnable: Stage 04 records against it.
