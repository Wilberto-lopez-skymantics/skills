<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 01: Brainstorm → Slice Brief

Turn an idea → the smallest slice worth seeing working, described just enough to prototype it. The user judges a running product in Stage 02, not a document: this stage asks only what the prototype cannot be built without, records every other question as a provisional assumption, and stops. Completeness is Stage 03's job, with the prototype running.

**Budget:** 12 questions per slice (`manifest.budgets.interviewQuestions`; `sdd.cjs readiness` shows the count). A first slice usually needs 6–10, then the brief.

## Inputs
- Layer 4 (working): user request or brief — including an existing specification in any format (a PRD, a design document, a `SPEC.md` from an earlier pipeline version) for a product with **no working code**; existing `specs/` on iterations (start from the `deferred` rows of `specs/GAPS.md`). Code exists → Stage 01b instead.
- Layer 3 (reference): `../_config/spec-template.md` (section numbers; only the draft sections are filled here), `../_config/decision-log-template.md`, `../_config/interview-template.md`, `../_config/gaps-template.md`
- Layer 3 (reference): `../_config/references/completeness-checklist.md` §Project Type Classification (the type only; the rest is Stage 03)
- Layer 3 (reference): `../_config/references/extraction-closure.md` §Core-flow closure (the Stage 01 gate; the four full dimensions run in Stage 03)
- Layer 3 (reference, UI): `../_config/design-template.md`, `../_config/references/theme-brainstorming.md`, `../_config/references/ui-state-matrix.md`, `../_config/visual-companion.md`
- Plumbing is pre-decided by the Equivalence Profile (`../_config/references/systems-standards.md`): ⊥ read it here, ⊥ ask the user about pagination, ids, error formats, concurrency, timestamps.

## Process

Start: context → type & slice → (UI: theme) → interview, one question per message → core-flow closure → slice brief → user OK → draft files → transition.

**⛔ GATE:** ⊥ write implementation code here; the prototype is Stage 02. ⊥ write to `specs/` until the user OKs the slice brief (step 6).

**⛔ GATE (UI):** ⊥ generate design tokens or styled mockups before the theme is chosen (anchoring bias). ∃ visual companion → theme and layout options are shown in the browser, never described in text.

### Checklist

! complete in order:

1. **Context** — `node specs/.sdd/scripts/sdd.cjs status`; files, docs, recent commits. **An existing spec document is the brief, not the spec:** read it, carry its decisions into `DECISION_LOG.md` (cite the document), write the draft sections from it, and ask only the core-flow questions it leaves open. Its earlier hardening is not trusted — it was done against prose; Stage 03 hardens again against the running prototype. Contracts, oracle cases and wireframes it brings along are inputs to Stages 03 and 04, never frozen artifacts. Iteration (SPEC/DESIGN exist): they are the baseline; with the user, pick this slice from the `deferred` gaps (`sdd.cjs status` counts them); skip step 3; every behavior that changes for existing users gets its own DECISION_LOG entry naming the oracle cases it changes (Stage 02's regression guard and Stage 04's changed-case ledger read it).
2. **Type & slice** — project type from `completeness-checklist.md` (unclear → ask; it decides which contracts and stages apply). Agree on the smallest slice worth seeing: 30–80 observable outcomes (operations × success/error outcomes, screens × states) reaches a prototype fastest; the cap is 150 (`manifest.sliceCap`, Stage 03 enforces). ∀ feature outside the slice → `specs/GAPS.md` row (kind `policy`, status `deferred`, cite the DECnnn that defers it), one line each, no interview.
3. **Theme** (UI, new projects) — ask for the vibe; show 2–3 directions in the visual companion; iterate until one is chosen (`theme-brainstorming.md`). This is the one visual decision the prototype cannot defer.
4. **Interview** — the Lead Architect asks exactly ONE question per message; every question is a row in `specs/logs/01-interview.md` (`interview-template.md`). The Shadow Critic (same agent, background) picks the next question by what the prototype cannot be built without: the actor(s), the primary entity and its lifecycle states, the slice's core flow, what is forbidden. A question better judged with the product on screen (an edge policy, wording, a limit's value, what an empty screen shows) → `GAPS.md` row (kind `policy`) with a provisional assumption, not a message. Policy → ask the user; plumbing → never (the profile decides).
5. **Core-flow closure** — `extraction-closure.md` §Core-flow closure: actor, primary entity + lifecycle, core flow answered; every other gap recorded with a provisional assumption. Zero *unrecorded* gaps; no confidence scores.
6. **Slice brief** — ONE message, ≤ 300 words: what v0 will do (operations | screens, in the user's words), the provisional answers it will build (the open `GAPS.md` rows, verbatim), what is deferred. A real fork the user must pick (storage engine, auth mechanism, hosted vs local) → two options with a recommendation, in the same message; otherwise the profile decides and the brief says so.
   **⛔ GATE:** the user's OK on this message is the approval to write `specs/` and to build v0. ⊥ section-by-section approvals, ⊥ architecture documents: the prototype is the design presentation.
7. **Draft files** (agent, no user time):
   - `specs/SPEC.md` — all `## N.` headings of `spec-template.md`. Filled now: §0 Meta, §1 Scope, §3 Actors, §4 Domain model & lifecycles (states and transitions in prose), §5 Operations (name, purpose, outcomes in words; `operationId`s come with the contracts in Stage 03), §14 (UI: screens, component names, the copy you already have). Every other section: `TBD — Stage 03`. `sdd.cjs check --spec` reports the draft; placeholders are allowed until Stage 03.
   - `specs/DECISION_LOG.md` — every answer that decided something (`decision-log-template.md`; append, never overwrite).
   - `specs/GAPS.md` — open policy rows with provisional assumptions; deferred rows with their DECnnn.
   - `specs/DESIGN.md` (UI) — tokens from the chosen theme; fill every mandatory category of `design-template.md` with defaults that match the theme (no user time). Include the UI State Matrix (`ui-state-matrix.md`): a cell you cannot fill = `GAPS.md` row (kind `ui`); the prototype shows a provisional state.
8. **Transition** — `node specs/.sdd/scripts/sdd.cjs transition --completed 01 --project-type <type>` (refuses while the SPEC.md draft sections, `DECISION_LOG.md`, `DESIGN.md` (UI) or `specs/logs/01-interview.md` are missing, or `GAPS.md` is malformed; placeholders and open gaps are allowed). Show `sdd.cjs readiness` (the user's open questions and their next action) and proceed to `02_prototype`.

### Rules
- **One question per message.** Batched questions → partial answers and unexamined assumptions.
- **Policy vs plumbing.** Business rules, permissions, pricing, lifecycles, limits that mean something to the business → the user. Pagination, ids, error envelope, timestamps, idempotency, concurrency, retries → the Equivalence Profile; raise one only when a business requirement conflicts with it (→ override in DECISION_LOG, mirrored in Stage 03).
- **Stop early.** A brief with 6 answers and 8 provisional rows beats 20 answers: the demo answers the rest, concretely, and `GAPS.md` keeps the list.
- **Scope check first.** A request that describes several independent subsystems → say so and decompose before any question.

## Outputs
- `specs/SPEC.md` (draft: §0, §1, §3, §4, §5, §14 (UI) filled; the rest `TBD — Stage 03`)
- `specs/DECISION_LOG.md`, `specs/GAPS.md`, `specs/logs/01-interview.md`
- `specs/DESIGN.md` (UI: tokens + UI State Matrix)
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 01 --project-type <type>`.
2. **Handoff:** `02_prototype` — build v0 from the brief and show it. Tell the user what happens next in one line: "v0 in Stage 02; your open questions get answered on the running product; hardening and the freeze come after you accept it."
