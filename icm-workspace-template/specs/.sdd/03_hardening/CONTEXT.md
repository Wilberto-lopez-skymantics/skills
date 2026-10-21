<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->
<!-- PRESERVE VERBATIM: code blocks, paths, URLs, file names, identifiers, JSON/YAML -->

# Stage 03: Harden — Contracts, Red Team, Wireframes

Turn the accepted prototype and the draft spec into a complete, machine-checked spec set the oracle can be derived from: compile the machine contracts against the running prototype, finish every SPEC section, inventory the prototype's decisions, run every Red Team round with the prototype running, prove the spec readable by two independent predictors, and (UI) capture the frozen wireframes from the prototype's screens. Agent-heavy. The user is asked only the policy questions a round raises — batched, one per message, at a demo — and (UI) to review the captured screens.

**⊥ new product scope here.** A change in what the user sees → a new version row in `specs/logs/02-prototype.md` (Stage 02's rule: spec + code in the same step). The prototype keeps running throughout.

## Inputs
- Layer 4 (working): `specs/SPEC.md` (draft), `specs/DECISION_LOG.md`, `specs/GAPS.md`, `specs/DESIGN.md` (UI), the prototype's code and its `Run:` line (`specs/logs/02-prototype.md`); `specs/contracts/*` if they already exist (adoption, iterations)
- Layer 3 (reference): `../_config/references/completeness-checklist.md` (whole) + `../_config/contract-matrix.json` (which contracts the type needs)
- Layer 3 (reference): `../_config/references/systems-standards.md` — §1 Representation, §3 Errors, §9 Environment, and the §§ for the project's interfaces (§2 http, §10 cli, §11 browser); `../_config/canonical-errors.json`, `../_config/schemas/`
- Layer 3 (reference): `../_config/references/red-team.md` (personas, falsifiable findings, rulings, rounds), `../_config/references/extraction-closure.md` (the four closure dimensions = the Round 1 domain checklist), `../_config/iteration-log-format.md`
- Layer 3 (reference): `../_config/prototype-record-template.md` §Decision Inventory, `../_config/rulings-template.md`, `../_config/gaps-template.md`, `../_config/references/oracle-standard.md` §Interpretation diff
- Layer 3 (reference, UI): `../_config/references/ui-state-matrix.md`, `../_config/visual-companion.md`, `../_config/design-template.md`

## Process (in order)

### 1. Compile the contracts (Blue Team: Core Architect, Data Specialist, Security Auditor, UX/UI Lead)
From the spec **and** the prototype: the Reconciler reads the code before anything is written; the contract says what the spec pins, the prototype is checked against it. Spec pins X, prototype does Y → fix the prototype now. Spec silent, prototype does Y → `GAPS.md` row (kind `builder`, draft assumption Y) — ⊥ promote Y to the contract because it already runs; step 3 lists it, step 4 rules on it.
- `specs/contracts/manifest.json`: project type, interfaces, artifacts, `notApplicable`, `equivalenceTarget` (default 2), `equivalenceCadence`, `profileOverrides`, `coverageExempt` (+ classes), `budgets`, `sliceCap`.
- `openapi.yaml` (http): every operation with a unique `operationId`, strict schemas (`additionalProperties: false` on requests), headers, params, pagination, every response status enumerated. | `cli.json` | `api.d.ts` per the matrix.
- `schema.sql` | `.prisma` | `storage.schema.json`: the prototype's DDL made explicit — pinned types, indices, FKs, OCC `version`, `COLLATE "C"` where strings sort.
- `statecharts.json`: ∀ lifecycle entity — states, guarded transitions, terminal retention, illegal-transition error.
- `errors.json`: canonical + domain codes per `canonical-errors.json`. `levels.schema.json` (games).
- Profile compliance: ∀ prototype deviation from the Equivalence Profile → fix the prototype, or an override in `manifest.profileOverrides` + SPEC §11 + DECnnn when the user's requirement demands it.
- Count declared outcomes against the slice cap (`manifest.sliceCap`, default 150 new since the last lock); over → split the slice with the user.
- `node specs/.sdd/scripts/sdd.cjs check --contracts` ! pass before step 2 and after every later contract edit.

### 2. Complete the spec
Every `## N.` section of `../_config/spec-template.md` filled (`TBD — Stage 03` placeholders gone; `check` errors on them from here on): §2 Glossary; §5 names every `operationId` | command and points to the contract (⊥ restate tables); §6 engine, retention, cascades; §7 domain error triggers; §8 Invariants as `- **Vn:**` bullets (fixtures cite them); §9 Equivalence Boundary = exactly the declared degrees of freedom (the future `variablePaths`); §10 Observable Environment; §11 mirrors `profileOverrides`; §12 every TTL, limit, window as an env var with a default (ENV-3); §13 exact limits; §14 (UI) full Component Hierarchy ↔ `DESIGN.md` keys, Input & Interaction Contract, copy table character-exact. A spec that would exceed ~120 KB splits into `specs/spec/<module>.md` files linked from SPEC.md. Then the **Outcome Table** → `specs/logs/03-swarm.md`: ∀ operation | command, every outcome (success + each reachable error, with its trigger); the gate cross-checks it against the contracts.

### 3. Decision Inventory → `specs/logs/03-decisions.md`
∀ observable decision the prototype makes (status, field value, ordering, message, default, limit, layout choice) → cite the spec line | contract | profile rule that pins it. No citation → `GAPS.md` row (kind `builder`) with the prototype's value as the draft assumption. Format: `prototype-record-template.md`. The cheap form of Stage 05's Decision Inventory: same check, it records instead of blocking.

### 4. Hardening rounds (prototype running)
Per `red-team.md`: round 1 full (whole slice, all personas, the four Extraction Closure dimensions and the Round 1 judgment checklist answered in the log), rounds 2–3 delta, cap 3 per iteration (`## 🔄 Iteration N` headings in `03-swarm.md`). The Fork Tester **executes** suspected forks against the prototype; the Reconciler reads its code. Prototype ≠ pinned value → fix the prototype now. Spec silent → blocking finding → the profile (technical) | the user (policy). Policy questions are batched to the end of the round and asked at a demo, one per message, with a recommendation; an answer → DECISION_LOG + SPEC + `GAPS.md`; unanswerable yet → `GAPS.md` row (kind `policy`, provisional), Stage 04 refuses to freeze while it is open. A round with zero blocking findings ends the loop; leftovers after round 3 → the user, ⊥ a round 4. `sdd.cjs check --contracts` before every round; every round in full to `03-swarm.md`; every finding → `specs/logs/03-rulings.md`.

### 5. Sampled Interpretation Diff
One request-only case per operation | command (prefer the success outcome; neutral titles — `Predict: POST /orders`) in `specs/changes/interp/requests/`. Two fresh sub-agents — given ONLY `specs/SPEC.md` (+ modules), `specs/contracts/` and the Equivalence Profile; **never the prototype, its code, `specs/logs/`, or this conversation** — each write the full expected response with `derivedFrom` citations, `{"$unspecified": "<what is missing>"}` where the files do not decide (`specs/changes/interp/a/`, `…/b/`). `node specs/.sdd/scripts/oracle.cjs diff-expect --a specs/changes/interp/a --b specs/changes/interp/b --label interp` ! report zero gaps. ∀ gap → fix the spec or contracts (policy → the user). ⊥ resolve a gap by choosing one author's answer. This is the cheap pre-check of Stage 04's every-outcome dual check — ⊥ defer the sample there.

### 6. Wireframes from the prototype (UI projects only)
The frozen HTML wireframes pin layout, copy, state ids and test ids; build B never sees the prototype, so they are its only channel for layout. Capturing them from the running prototype means every layout decision is either frozen here or caught as a gap.
1. Start the prototype with its `Run:` line. ∀ screen ∈ SPEC §14 Component Hierarchy × ∀ UI State Matrix state reachable:
   ```bash
   node specs/.sdd/scripts/ui-capture.cjs --url <prototype url> --name <screen>[-<state>] [--wait "[data-testid=<id>]"] [--setup ./capture-setup.cjs] --aria
   ```
   The tool (Playwright) performs the same capture for every agent: same-origin styles inlined into one `<style>` block, scripts and framework attributes removed, media → `<div class="placeholder asset">`, form state frozen, every `data-testid`, `data-key`, ARIA attribute, visible text and DOM order kept. `--setup` drives the prototype into the state (log in, open a modal, empty state); `--aria` also writes `<name>.aria.json` (the `diff-ui` reference). One file per screen state in `specs/wireframes/`. ⊥ hand-edit a capture into something the prototype does not do; ⊥ hand-draw a screen the prototype lacks — build it in the prototype first.
2. **Verify the contract** — test ids: ∀ component ∈ §14 carries `data-testid="<kebab-case name>"`, repeated items `data-key`, states `<component>-empty|loading|error` (UI-1, UI-4). Copy: ∀ visible static text = §14 copy table, character-exact (UI-2); text not in the table → add it (user-approved). Tokens: ∀ CSS color / spacing / font / radius value in the captured `<style>` equals a `DESIGN.md` token; a value with no token → user approves a new token (DESIGN.md + DECnnn) or the prototype is fixed to the token and re-captured. States: ∀ interactive component has a wireframe per UI State Matrix state; unreachable → `GAPS.md` row (kind `ui`) → prototype fix. Every miss is fixed **in the prototype first**, then re-captured.
3. **User review** — `specs/.sdd/scripts/start-server.sh --project-dir <project>` serves `specs/wireframes/` at `<url>/wireframes/<screen>.html`. Walk the user through every screen state; the question is "is this the product you accepted?", not "which option?". A requested change → prototype first (version row), then re-capture.
4. **Finalize** — fold approved deviations into `DESIGN.md` tokens (+ DECISION_LOG); `## Approved Wireframes` in `DESIGN.md` links every file with relative paths (`[title-screen](wireframes/title-screen.html)`; ⊥ `file:///`) + per screen: layout summary, interactive components, state files, test ids. Iterations re-capture changed screens only.

### Adopted codebases (after 01b → 02)
Harden **one slice at a time** — the surface or module chosen in the slicing plan (`GAPS.md` deferred rows): compile and reconcile the contracts of that surface only (the Reconciler reads the code first; routes, DDL, lifecycles and errors are extracted, then checked against the draft spec), inventory that surface's decisions, attack it, capture its screens. The slice cap applies per hardened surface. Behavior tagged `[TECH DEBT]` is a `builder` gap: pinned into the spec and contracts only when the user confirms it at a demo, otherwise fixed in the code with a DECnnn. Later slices return here from the deferred rows with the earlier slices' oracle as the regression guard; `01b` and `02` are not repeated.

### 7. Readiness & transition
`node specs/.sdd/scripts/sdd.cjs readiness` → show the user (budgets, their remaining questions, the path to the freeze). Then transition.

## Outputs
- `specs/contracts/manifest.json` + matrix-required contracts; `specs/SPEC.md` complete (+ `specs/spec/*.md`); `specs/DESIGN.md` (UI, tokens final)
- `specs/logs/03-swarm.md` (Outcome Table + rounds), `specs/logs/03-rulings.md` (no open row), `specs/logs/03-decisions.md`, `specs/GAPS.md`, `specs/DECISION_LOG.md` entries
- `specs/changes/interp/` (sampled dual prediction, working files) + `specs/logs/oracle/expectdiff-interp.json`
- `specs/wireframes/*.html` (+ `*.aria.json`) and `DESIGN.md` §Approved Wireframes (UI)
- Prototype fixes (profile compliance, fork fixes); further version rows in `specs/logs/02-prototype.md` when the user can see a change
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 03` (refuses unless `check --contracts` passes with the spec complete, the slice is within its cap, `03-swarm.md` written this stage holds a complete Outcome Table and ≥ 1 Red Team round, `03-decisions.md` was written this stage, `GAPS.md` is well-formed (open rows allowed until Stage 04), the rulings ledger written this stage has no open row, a fresh zero-gap sampled `diff-expect` exists, UI projects have captured wireframes linked from `DESIGN.md`, and — on iterations — the regression run is green or every failure is a declared behavior change).
2. **Handoff:** `04_writing_implementation_phases` — the oracle is recorded from this prototype and predicted from this spec. Keep the prototype runnable.
