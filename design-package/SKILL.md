---
name: design-package
description: Build, adopt, update, check or review the systems-engineering design package in docs/design-package/ — the systems engineer's view of this Spec-Driven Development workspace (system requirements kept separate from software design and programmatic decisions, design decision records, architecture views, an interface control table, traceability, a TBR register of expert-pending assumptions, draw.io diagrams, and the derived chapters: change control from the lock, stage record and SCRs; verification status from the oracle cases and run reports; the UI design baseline from the frozen wireframes; the pipeline's gap register; a review log). Use it whenever the user asks to update, refresh, sync, regenerate, extend, re-baseline, check or review the design package or the "SE package", wants the systems engineer brought up to date, has review comments from a systems engineer to process, or says that specs/SPEC.md, specs/DECISION_LOG.md, the contracts, the oracle or the lock changed after a spec review, an expert (SME) session, a prototype demo, a freeze, a Class 1 iteration or a new slice — even if they never say "design package". Keeps every ID stable, records a revision history and never edits specs/.
---

# Design package: the systems engineer's view of the spec set

`docs/design-package/` presents the SDD spec set in the terms a systems engineer works in: a concept of operations, "shall" requirements with verification methods, design decision records, architecture and behavior diagrams, an interface control table, traceability, a TBR register, and — derived mechanically by the helper script — the change-control record, the verification status of every requirement, the user-interface design baseline, the pipeline's own gap register and a review log. It is **derived and non-normative**. The frozen spec set (`specs/SPEC.md` and its modules, `specs/contracts/`, `specs/fixtures/`, `specs/wireframes/`, `specs/DESIGN.md`) is the baseline; where the package and the spec differ, the package is wrong.

## What the package reads (the spec set, pipeline v3.4)

| Source | Package use |
|---|---|
| `specs/SPEC.md` + `specs/spec/*.md` modules (linked from SPEC.md; headings `## G4.` belong to the module) | Sections, invariants (`Vn`), modules, config vars, error codes, copy table, component hierarchy |
| `specs/DECISION_LOG.md` | Every `DECnnn` classified and traced; `[PENDING-SME]` → TBR |
| `specs/DESIGN.md` + `specs/wireframes/*.html` | Tokens, UI State Matrix, the frozen screen frames and test ids → chapter 11 |
| `specs/contracts/` | Interface control detail, statecharts, data model, error catalogue |
| `specs/fixtures/cases/*.json`, `specs/fixtures/ui/*.spec.ts` | Verification procedures: each case's `derivedFrom` (SPEC §, `Vn`, operation) maps it to requirements → chapter 10 |
| `specs/logs/oracle/run-*.json`, `specs/logs/ui-e2e.json` | Verification execution records, bound to a lock hash → per-requirement status |
| `specs/spec.lock.json`, `specs/logs/transitions.jsonl` | Configuration baseline and milestone record → chapter 9 |
| `specs/changes/SCR-*.md`, `specs/backprop-log.md` | Engineering change proposals and problem reports → chapter 9 |
| `specs/GAPS.md` | The pipeline's open-items register, mirrored with its own ids in chapter 8 |
| `specs/logs/02-prototype.md`, `specs/logs/03-rulings.md`, `specs/logs/roadmap.md`, `specs/logs/01-sme-review.md` | Prototype versions the product owner saw; Red Team rulings; slices; the expert agenda |

The package's value to its reader comes from three properties. Every run must preserve them:

1. **Nothing is invented.** Every statement traces to decisions (`DECnnn`) and to SPEC sections and invariants (`Vn`). Something that seems needed but isn't in the sources goes on the gaps list (`G-nn`) instead of into a requirement. The reader must be able to trust that the package shows what was decided, not what an author assumed.
2. **IDs are permanent.** The systems engineer writes review comments against `ZEN-SR-FUN-014`, `ZEN-DIA-05e` and `TBR-10`. Renumbering or reusing an ID silently redirects those comments. Never renumber or reuse an ID. Withdraw an item instead of deleting it, and give new items the next free ID in their block.
3. **Every change is visible.** Each update is a numbered revision with a changelog, so the reader reviews only what moved.

## Ground rules

- **Read-only on `specs/`.** Don't edit SPEC.md, DESIGN.md, DECISION_LOG.md, logs, contracts or `.sdd/`, and don't run `sdd.cjs transition` or `freeze`. This work sits outside the pipeline stages; `sdd.cjs status` is fine. If the package finds a defect in the spec, record it as a gap and tell the user. Spec fixes go through the SDD process, not through this skill.
- **Keep context small.** SPEC.md is about 50,000 words and the decision log about 100 KB. Never read either whole. Use `scripts/pkg.py impact` to learn *what* changed, then read only those sections: `grep -n '^## \|^### \|^#### '` gives the offsets. For large jobs (a new slice, a full re-verification), give each subagent one SPEC area and have it return a short summary while it edits files.
- **Don't commit.** Offer to at the end.
- **Draw diagrams with the draw.io MCP.** See [references/diagrams.md](references/diagrams.md). Load its tools with ToolSearch ("drawio", then "draw.io" or "diagram"). If it isn't available, finish the text work, mark the affected diagrams as *pending redraw*, and tell the user. Don't hand-edit diagram XML unless the user agrees.

## The helper script

`python3 .claude/skills/design-package/scripts/pkg.py <command>` (standard library only; run it from anywhere in the repo):

| Command | What it does | When |
|---|---|---|
| `impact` | Compares the spec set now with the baseline stored in `manifest.json`. Lists added, changed and removed decisions, SPEC sections, invariants, modules, statecharts, config vars, error codes and contract files. Earlier decisions cited by new ones signal a resolution, refinement or reversal. Separates package items and diagrams that are **directly** affected from those **possibly** affected, and lists the obligations and the next free IDs per block. | Start of every update |
| `check` | Consistency of the package against the spec: every decision traced; every invariant cited; every requirement has a source, a verification method and a valid status; TBR links resolve; no ID has disappeared; diagram files exist; README key numbers match. Exits 1 on errors. | Before stamping; whenever asked to "check" |
| `index --out FILE` | Parses the package into JSON (requirements with attributes, design decisions, interfaces, TBR, gaps, diagrams, traceability, counts). | To get counts for the README, or to look up an item's sources quickly |
| `fingerprint [--rev REV]` | Fingerprints the spec set from the working tree or a git revision | Rarely by hand; `stamp` and `impact` call it |
| `stamp --revision N [--rev REV] [--date D] [--note TEXT]` | Writes `manifest.json`: the baseline fingerprint, the ID registry (it only ever grows), the diagram source map, counts and history | Before compiling at the end of every run |
| `derive [--write]` | Regenerates the derived chapters and blocks from the spec set: `09-change-control.md`, `10-verification-status.md`, `11-ui-design.md`, the `specs/GAPS.md` block in `08-open-items.md` (between `<!-- gaps-md:begin/end -->`) and the VCRM block in `07-traceability.md` (between `<!-- vcrm:begin/end -->`). Without `--write` it only reports what would change | After the hand-written chapters are updated, before `stamp`; also to answer "what is verified?" |
| `verify [--json]` | Per-requirement verification status: requirement → its SPEC refs and invariants → the oracle cases and UI specs citing them → the latest unfiltered run on target `default` and its lock binding. Statuses: verified, failing, stale (run not on the current lock), not run, unverified | Whenever the user asks what is verified, or before a certification report |
| `review --resolve [RC-nn]` | For each open review comment in `12-review-log.md` (or one), prints the decisions, SPEC sections, invariants, oracle cases and diagrams behind every targeted id, then the classification guide | Start of every review run |
| `review --draft RC-nn --kind scr\|gap` | Writes the change request a comment asks for under `specs/changes/review/`: a Stage 00 SCR draft when a lock exists, otherwise a draft `GAPS.md` row + DECISION_LOG entry. Never touches any other file under `specs/` | After the product owner accepts a comment |
| `compile [--pdf]` | Syncs `.svg` diagram title blocks from `.drawio`, embeds SVG figures inline, compiles all markdown chapters (plus `CHANGELOG.md`) into `docs/design-package/index.html`, and optionally renders the PDF (`manifest.json#pdf`, default `<product>-design-package.pdf`) via Headless Chrome | Final step of every run after `stamp` |

The formats the script parses are in [references/package-format.md](references/package-format.md). If you change a format, change the parser in the same run, or the next update will misread the package.

## Choose the mode

| Situation | Mode |
|---|---|
| `docs/design-package/` doesn't exist | **Build** |
| The folder exists but has no `manifest.json` | **Adopt** |
| `manifest.json` exists | **Update** (default) or, if the user asks for a full refresh or a new slice starts, **Re-verify** |
| The user brings review comments (a systems engineer read the package) | **Review** (see below), then Update once the pipeline applied the accepted changes |

### Adopt (an existing package with no manifest)

The package was built once (for example from a prompt) and now enters the update workflow. Adopting changes no content. It only adds the revision machinery.

1. Find the commit the package was derived from. It's in the banner at the top of each file ("derived from `specs/SPEC.md` at commit …") and in each diagram's title block.
2. Run `pkg.py check`. If it reports errors, decide whether they come from the package or from spec changes made after that commit. Spec drift is handled by the update in step 6, so record what you saw but don't fix anything yet.
3. Add the revision machinery, formatted as in [references/package-format.md](references/package-format.md):
   - in every file's banner, `Revision 1`
   - in the README, a "Revision history" section linking `CHANGELOG.md`, and `manifest.json` in its conventions table
   - a `CHANGELOG.md` whose Revision 1 entry records the baseline: the date built, the source commit, and the counts from `pkg.py index`
4. Run `pkg.py stamp --revision 1 --rev <that commit> --date <the date the package was built> --note "Adopted into the update workflow"`.
5. Run `pkg.py check` again. Expect zero errors, unless the errors come from spec drift.
6. Run `pkg.py impact`. If the spec moved since that commit, continue straight into **Update** as revision 2.

### Update (the normal case)

1. **Measure.** Run `pkg.py impact`. Keep its report; the changelog is built from it. If it says the package is current, run `check`, tell the user, and stop.
2. **Read only what changed:** the new and changed decision rows (`grep -n '^| DEC101 ' specs/DECISION_LOG.md`), the changed SPEC sub-sections, and the changed invariants (`grep -n '\*\*V31:\*\*' specs/SPEC.md`). Also read the earlier decisions that new ones cite.
3. **Work the obligations in this order** (later steps depend on earlier ones):
   1. **Classify each new decision** using [references/classification.md](references/classification.md): system requirement, software design, programmatic, or clarification. Split it when its parts fall in different buckets. Add its traceability rows. Then write the new requirements, design decision records and interface rows, or fold it into the decision it clarifies.
   2. **Decide what each new decision does to the earlier ones it cites.**
      - *Confirms* a working assumption: close the TBR entry, and set the requirements it held to **Agreed** unless another open TBR still applies.
      - *Refines* it: edit the affected items in place and keep their IDs.
      - *Reverses* it, or changes its meaning: withdraw the old items, create new ones, and cross-reference both.
      - *Makes a new working assumption* (`[PENDING-SME]`): open a TBR entry and set the affected requirements to TBR.
   3. **Directly affected items:** re-verify each against its changed sources and edit it in place. Update its Source, SPEC and Invariants attributes.
   4. **Invariants:** cite every new invariant in the requirement it verifies, or in a new requirement if none fits. Remove citations of deleted invariants.
   5. **Possibly affected items:** skim each, and edit only what is now wrong.
   6. **Gaps:** close each gap the spec now resolves ("Closed in rev N — how"), and add new gaps you find.
   7. **Architecture and interfaces:** if modules, statecharts, config vars, error codes or contracts changed, update `04-architecture.md`, `06-external-interfaces.md` and the allocations.
   8. **Diagrams:** do the directly affected ones first, then open each possibly affected one to confirm it's still right. Edit in place through the draw.io MCP, and update each title block's revision, date and source commit. See [references/diagrams.md](references/diagrams.md).
   9. **Derived chapters:** run `pkg.py derive --write`. It regenerates 09 (change control), 10 (verification status), 11 (UI design baseline), the GAPS.md block in 08 and the VCRM block in 07. Read 10's summary: a requirement **failing** is a build defect or a spec question the user must hear about; **stale** means the latest oracle run is not on the current lock (normal while a slice is being hardened: say so in the changelog); a Test-method requirement that is **unverified** is a verification gap to report. Package gaps (`G-nn`) are only for defects of the sources found by the package; questions the pipeline already tracks live in `specs/GAPS.md` and arrive through the derived block.
   10. **Counts and coverage:**
      - the README key numbers and the 02 summary table, from `pkg.py index --out …`
      - the Technical Performance Measures (TPM) summary in `01-system-overview.md` if any performance/capacity targets moved
      - the coverage results table in `07-traceability.md` (the VCRM table above it is derived)
      - the README status (facts from chapter 9: stage, lock, acceptance) and the diagram index
      - the revision banner in every file
4. **Changelog.** Add the revision-N entry to `CHANGELOG.md`: its trigger, the baseline move (commit and lock), the items added, changed and withdrawn, the TBR entries closed or opened, the gaps closed or opened, the diagrams updated or pending, and the counts before and after.
5. **Stamp.** Run `pkg.py stamp --revision N --note "<one line>"`. N is the previous revision + 1.
6. **Compile.** Run `pkg.py compile --pdf` to regenerate `docs/design-package/index.html` and the PDF (syncing `.svg` title blocks from `.drawio` automatically). The cover page and file name come from `manifest.json#cover` and `#pdf` (package-format.md §12); set them once at Build or Adopt.
7. **Check.** Run `pkg.py check --strict` until it reports zero errors and zero warnings. `NOTE` lines (Test-method requirements with no oracle case; requirements whose case fails in the latest run) are pipeline items, not package defects: they do not fail the check, and the final report lists them for the user to route (Stage 04 cases, Stage 05 fixes, or a Stage 00 change request).
8. **Report** (template below).

### Review (comments from a systems engineer)

The package is derived: a reviewer's change is **never made in the package**. It becomes a change request to the spec set, the pipeline applies it, and the next revision reflects it. The direction of truth is package → change request → spec → build → package.

1. **Log the comments** as rows of `12-review-log.md` (format in package-format.md §13): one `RC-nn` per comment (next free id, never reused), the reviewer, the date, the package or spec ids it targets, the comment verbatim, status `open`.
2. **Resolve:** `pkg.py review --resolve` prints, for each open comment, the decisions, SPEC sections, invariants, oracle cases and diagrams behind its targets. Read those sources (and nothing else) before judging.
3. **Classify** each comment and write the classification into its row:
   - **package defect** — the package misread or mis-summarized the spec. Fix the package item in place (keep its id), status `package`, resolution "fixed in rev N". No spec change.
   - **clarification** — the spec means what the reviewer wants but says it badly. Draft a clarification decision (`pkg.py review --draft RC-nn --kind gap` gives the DEC entry skeleton); the pipeline records it in the current stage.
   - **technical** — a mechanics change inside the Equivalence Profile (status codes, ordering, envelopes, limits). After a freeze: `pkg.py review --draft RC-nn --kind scr` (Stage 00 format, class B or C). Before a freeze: `--kind gap` (a `GAPS.md` row of kind technical for the hardening round).
   - **policy** — a business decision only the product owner can make. After a freeze: an SCR of class D, which routes to Stage 01 for the decision. Before a freeze: a `GAPS.md` row of kind policy, asked at the next prototype demo.
4. **⛔ Gate.** Present the classified comments and the drafts to the user. Nothing under `specs/` changes from this skill: the user (or the pipeline agent on the user's word) moves an accepted draft into `specs/changes/SCR-nnn.md` or `specs/GAPS.md` and `specs/DECISION_LOG.md`, and the pipeline runs its own gates (Stage 00 approval and re-freeze, or the current stage's demo and hardening). Set each row to `accepted` with the SCR / gap id, or `rejected` with the reason and where the spec already decides it.
5. **Close the loop** at the next Update: `pkg.py impact` shows the new decisions; the changelog entry cites the `RC-nn` each change closes; the row becomes `applied` with the DEC id and revision. The reviewer can follow their comment from the ledger to the decision, the spec edit, the oracle case and the build change.

Comments made on a frozen baseline cost a re-freeze each; comments taken during Stage 03 hardening are just more findings against the running prototype and are cheaper. Say which situation applies when you present the drafts.

### Re-verify (a full refresh, or a new slice)

Same as Update, but treat every item as possibly affected, with one subagent per SPEC area. IDs still never change. A new SPEC area gets a new functional block: the next unused hundred (for example 500), recorded in the "How to read" notes of `02-system-requirements.md`. New behavior gets new diagrams with the next `ZEN-DIA` number. A new slice also updates the scope and roadmap in `01-system-overview.md`.

### Build (no package yet)

Create the package in the structure and formats of [references/package-format.md](references/package-format.md). Classify with [references/classification.md](references/classification.md), draw the catalog in [references/diagrams.md](references/diagrams.md), write the README from [references/sdd-to-se.md](references/sdd-to-se.md), then `stamp --revision 1`, `compile --pdf`, and `check --strict`. Use one subagent per SPEC area for the requirements, and keep the diagrams on the main agent, which has the MCP. Requirements are **capability-level**: in slice 1, 162 requirements cover 235 invariants. Each requirement cites the invariants that elaborate it; it doesn't restate them.

## When machine contracts exist (Stage 03 onward)

Once `specs/contracts/` exists (Stage 03 hardening compiles them against the accepted prototype), prefer it over prose wherever it applies:
- `openapi.yaml` gives the details of the machine-interface rows in the interface table.
- `statecharts.json` is authoritative for the state diagrams.
- `schema.sql` is authoritative for the data-model diagrams.
- `errors.json` is the error catalogue.
- `manifest.json#profileOverrides` lists the overrides.

Once `specs/fixtures/` exists (Stage 04), chapter 10 maps every requirement to the oracle cases that cite it; the Verification attribute keeps naming the method and what it checks, the case ids come from the derived chapter. After a freeze, `stamp` records the lock version automatically: label the baseline "lock vN" in banners and the changelog, because to a systems engineer the frozen lock is the configuration baseline. Between a slice's start and its re-freeze the lock is broken by design; chapter 10 then reports every requirement as **stale** and chapter 9 shows why.

## Final report

End every run with:

```
Design package revision N (mode) — baseline <old commit> → <new commit>[, lock vX]
- Requirements: +a / changed b / withdrawn c → total T (TBR t)
- Design decisions: … · Interfaces: … · TBR register: closed …, opened … · Gaps: closed …, opened …
- Diagrams: updated … · pending redraw … (why)
- Verification (chapter 10): v verified / f failing / s stale / u unverified of T, run <file> on <lock binding>
- Change control (chapter 9): lock vN, m stage transitions, k SCRs (applied/proposed), p prototype versions
- Review log: r open comments, a accepted (drafts under specs/changes/review/), c closed this revision
- Deliverables: index.html & <pdf name> compiled
- pkg.py check: 0 errors, w warnings (each explained)
- Spec defects found: G-nn … (worth raising in the SDD process); pipeline gaps mirrored from specs/GAPS.md: o open
Offer: commit on the current branch.
```

## References

- [references/package-format.md](references/package-format.md): files, ID schemes and blocks, the exact formats of every item, statuses (TBR, withdrawn, closed), banners, changelog, manifest, the derived chapters and their markers, the review log. Read it before editing any package file.
- [references/classification.md](references/classification.md): the four buckets, the observability test, splitting rules, requirement-writing rules and verification methods. Read it when classifying decisions or writing requirements.
- [references/diagrams.md](references/diagrams.md): the diagram catalog, notation, title block and legend, how to edit in place, and draw.io MCP practice. Read it before touching any diagram.
- [references/sdd-to-se.md](references/sdd-to-se.md): how SDD terms map to systems-engineering terms. Use it when writing the README or the overview, or when explaining the process to the reader.
