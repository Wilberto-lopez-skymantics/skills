<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 01b: Adopt an Existing Codebase — Inventory & Draft

Bring working code with no spec under SDD. The running system is already the prototype, so this stage does what Stage 01 does for a new product and nothing more: inventory what the code does today, write the **draft** spec of it, record the questions the code cannot answer, choose the first slice to harden, and hand the user the running system to judge in Stage 02. Contracts, the Decision Inventory and the Red Team are Stage 03, one slice at a time; the characterization oracle is recorded in Stage 04. ⊥ compile contracts or record cases here.

**Budget:** 12 questions (`manifest.budgets.interviewQuestions`), in `specs/logs/01-interview.md`. Code evidence answers first; the user is asked only what the code cannot show (intent, policy, what is a bug).

## When to use this stage (instead of Stage 01)
- The project has working code and no spec in this pipeline's form — none at all, a document in another format (PRD, design document, wiki), or a `SPEC.md` from an earlier pipeline version without a lock; the user wants it under SDD, or wants to rewrite it equivalently. (Working code **and** a lock from this pipeline → upgrade the pipeline files in place; the state and artifacts carry over. No code, only a document → Stage 01 with the document as the brief.)
- The user says "adopt", "onboard", or "reverse-engineer the spec".
- Stage 00 `--resume 01b`: the inventory of an adopted project must be redone.

## Inputs
- Layer 4 (working): the codebase (source, config, package manifests), its tests, docs, git history; a runnable instance (the Run line)
- Layer 4 (working, if ∃): any existing specification (PRD, design document, earlier `SPEC.md`, decision log, contracts). **Evidence of intent, not the spec**: the code describes today; the document describes what someone meant. Where they agree, the document supplies the rationale and the `DECISION_LOG.md` entry (cite it). Where they disagree, the code's behavior goes into the draft and the disagreement is a `GAPS.md` row (kind `policy`, draft assumption = the code, the document's version quoted in the Gap cell) for the user at the Stage 02 walkthrough. Earlier decision logs and gap registers carry over mechanically with their ids; earlier contracts and cases are inputs to Stages 03 and 04, never frozen as they are.
- Layer 3 (reference): `../_config/spec-template.md`, `../_config/decision-log-template.md`, `../_config/interview-template.md`, `../_config/gaps-template.md`, `../_config/prototype-record-template.md`
- Layer 3 (reference): `../_config/references/completeness-checklist.md` §Project Type Classification, `../_config/references/extraction-closure.md` §Core-flow closure
- Layer 3 (reference, UI): `../_config/design-template.md`
- Layer 3 (reference): `../_config/references/prototype-checklist.md` — read to *recognize* deviations; ⊥ change the code here to fix them (Stage 03 decides, with the user)

## Process

### 1. Configure (one message, the user confirms before any scan)
| Parameter | Default | Description |
|---|---|---|
| Analysis depth | `thorough` | `quick` / `standard` / `thorough` |
| Focus modules | `all` | Directories/modules to prioritize |
| Include git history | `yes` | Mine git log for decisions |
| Map existing tests | `yes` | Inventory tests; they become evidence for the draft, never the oracle |
| Project type | auto-detect | One of `completeness-checklist.md` (confirm) |
| Run command | auto-detect | How to start the existing system (the `Run:` line) |

**⛔ GATE:** ⊥ begin analysis until the user confirms the parameters.

### 2. Scan & inventory (agent)
Folder tree, package manifests, entry points, README; key modules and their responsibilities; every public interface (routes, commands, exported API, screens); storage (migrations, live schema); error handling; lifecycle logic; configuration and env vars. `Map existing tests = yes` → categorize them and note what they pin. `Include git history = yes` → decisions and reversals, as `[inferred]` DECISION_LOG candidates. Note every place the code deviates from the Equivalence Profile (`prototype-checklist.md`): a list for Stage 03, not a fix list for now.

### 3. Questions (one per message, within the budget)
Only what the code cannot answer and the draft cannot be written without: who the actors are when the code does not say, which of two behaviors the code exhibits is intended, what the slice boundaries should be. Everything else → `specs/GAPS.md` row (kind `policy` | `builder`) with the code's current behavior as the draft assumption; the user judges it on screen in Stage 02. Behavior that looks wrong is a `builder` row tagged `[TECH DEBT]` in the Gap cell, never silently a rule. The core-flow closure (`extraction-closure.md` §Core-flow closure) ends the questions: actor(s), primary entity + lifecycle, core flow, forbidden-by-design, out of the first slice.

### 4. Draft files (agent; describe what the code does **today**, ⊥ aspirational)
- `specs/SPEC.md` — all `## N.` headings of `spec-template.md`. Filled now: §0 Meta, §1 Scope (the whole system in scope; §1.2 lists what the code does not do), §3 Actors, §4 Domain model & lifecycles as the code implements them, §5 Operations (every route, command or exported call, purpose and outcomes in words), §14 (UI: screens, components, visible copy). The rest `TBD — Stage 03`. Mark `[TECH DEBT]` inline where the described behavior is a `builder` gap. Where the code deviates from the profile, say so in the section (§11 is filled in Stage 03 when the user decides fix vs override). `sdd.cjs check --spec` reports the draft.
- `specs/DECISION_LOG.md` — discovered decisions; inferred ones marked `[inferred]`, with the file:line evidence in the Rationale cell.
- `specs/DESIGN.md` (UI) — tokens extracted from the stylesheets; values that occur once or inconsistently are listed as deviations for Stage 03's token check, not invented into tokens.
- `specs/GAPS.md` — the questions not asked (provisional = current behavior), the tech-debt rows, and the **slicing plan**: one `deferred` row per surface or module to harden later, each citing the DECnnn that orders them; the first slice is chosen with the user (step 3) and is the only one Stage 03 compiles contracts for.
- `specs/logs/02-prototype.md` — the `Run:`, `Target:` and `Build environment:` lines for the existing system; the Versions table starts empty (Stage 02 adds one row per walkthrough).
- `specs/IMPLEMENTATION_PHASES.md` — one phase per planned slice, all tasks `[x]` except the verification line, with the header:
  > **Note:** Adopted codebase. Phases mirror the slicing plan in `GAPS.md`; each slice's verification is bound to its oracle in Stage 04.

### 5. User review of the draft
Present the draft spec section by section only where the agent is unsure of intent; otherwise one message: what the system does, the tech-debt list, the slicing plan, the first slice. **⛔ GATE:** the user's OK on this message. A codebase the user wants frozen *unchanged* is still adopted the same way: a short Stage 02 (one walkthrough, accept as-is) and a Stage 03 that extracts the contracts; there is no path to a freeze without them.

### 6. Transition
`node specs/.sdd/scripts/sdd.cjs transition --completed 01b --project-type <type>` (refuses while the SPEC.md draft sections, `DECISION_LOG.md`, `DESIGN.md` (UI) or `specs/logs/01-interview.md` are missing, or `GAPS.md` is malformed; placeholders and open gaps are allowed).

## Outputs
- `specs/SPEC.md` (draft of today's behavior, `[TECH DEBT]` tags), `specs/DECISION_LOG.md` (`[inferred]`), `specs/DESIGN.md` (UI), `specs/GAPS.md` (incl. the slicing plan), `specs/logs/01-interview.md`
- `specs/logs/02-prototype.md` (Run line; no versions yet), `specs/IMPLEMENTATION_PHASES.md` (one phase per planned slice)
- `specs/backprop-log.md` (created empty if ∄)
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 01b --project-type <type>`.
2. **Handoff → `02_prototype`:** the existing system is the prototype. The walkthrough is surface by surface: "this is what it does here — intended, a bug, or outside the first slice?" An intended behavior → `GAPS.md` row `confirmed` (+ the SPEC sentence that now pins it); a bug → DECISION_LOG entry + SPEC edit + code fix in the same step (it is never pinned as behavior); outside the slice → stays `deferred`. One Versions row per walkthrough; the user accepts with `--approved-by`. Then `03_hardening` for the first slice only (contracts extracted and reconciled against the code, Decision Inventory of that surface, Red Team rounds, captured wireframes), `04` (characterization oracle recorded from the running system as interpretation A, predicted spec-only as B; pure tech-debt cases tagged `tech-debt`), freeze, `05` (the code is build A: reconciliation and the fixes the oracle forces), `07`. Each later slice returns to `03` from the `deferred` rows with the earlier slices' oracle as the regression guard; `01b` and `02` are not repeated unless a new surface needs its own walkthrough (one more version row).
