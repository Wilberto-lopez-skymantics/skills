# Package format

The exact structure of `docs/design-package/`. `scripts/pkg.py` parses these formats; when you change one, change the parser in the same run.

## Contents

1. Files
2. Identifiers and numbering blocks
3. Banner
4. Requirement blocks (`02-system-requirements.md`)
5. Design decision records (`03-design-decisions.md`)
6. Interface control table (`06-external-interfaces.md`)
7. Traceability (`07-traceability.md`)
8. TBR register and gaps (`08-open-items.md`)
9. README tables
10. Statuses: withdrawn, closed, pending redraw
11. CHANGELOG.md
12. manifest.json
13. Derived chapters and blocks (`09`, `10`, `11`, the GAPS.md and VCRM blocks)
14. Review log (`12-review-log.md`)

## 1. Files

| File | Holds |
|---|---|
| `README.md` | Purpose, status, how the system is specified (SDD in SE terms), reading order, conventions, key numbers, diagram index, revision history |
| `01-system-overview.md` | ConOps-style overview: mission and users, operational context, system boundary, scope and roadmap, operational scenarios, Technical Performance Measures (TPM) summary, acronyms |
| `02-system-requirements.md` | Requirement blocks by category, with a summary table and contents list |
| `03-design-decisions.md` | Index table plus one record per design decision (`ZEN-DD`), including trade studies |
| `04-architecture.md` | System context, logical architecture (modules, responsibilities, owned data, interfaces), deployment, data model, N² matrix, requirement-to-component allocation |
| `05-behavior.md` | Narratives for the activity, state and sequence diagrams |
| `06-external-interfaces.md` | Maturity summary, the interface control table, machine-interface conventions |
| `07-traceability.md` | Bucket definitions, one or more rows per decision, Verification Cross-Reference Matrix (VCRM) summary, coverage results |
| `08-open-items.md` | TBR register, the package's own gaps list, and the derived block mirroring `specs/GAPS.md` |
| `09-change-control.md` | **Derived.** Configuration baseline (lock versions), stage transitions, prototype versions, SCR register, backprop log |
| `10-verification-status.md` | **Derived.** Per-requirement verification status from the oracle cases, UI specs and the latest run |
| `11-ui-design.md` | **Derived.** UI design baseline: numbers from SPEC §14 and DESIGN.md, screen catalog with frames and test ids from the frozen wireframes, requirements realized by the UI |
| `12-review-log.md` | Review comments (`RC-nn`) and what became of each |
| `CHANGELOG.md` | One entry per revision (created at adoption) |
| `manifest.json` | Written only by `pkg.py stamp`; never hand-edit |
| `diagrams/*.drawio`, `diagrams/*.svg` | Source draw.io XML and rendered SVG per diagram (see diagrams.md; `pkg.py compile` syncs SVG title blocks from `.drawio`) |
| `index.html`, `<pdf>` (`manifest.json#pdf`, default `<product>-design-package.pdf`) | Self-contained HTML and print-ready PDF deliverables compiled by `pkg.py compile --pdf` |

## 2. Identifiers and numbering blocks

| ID | Meaning | Numbering |
|---|---|---|
| `<PREFIX>-SR-<CAT>-<nnn>` (`ZEN-SR-…` in the examples; prefix = `manifest.json#id_prefix`) | System requirement. CAT ∈ FUN, PER, INT, DAT, SEC, HFA, OPS, CON | FUN uses blocks by SPEC area: 001–099 Foundations, 101–199 Situation display, 201–299 Demand monitoring and alerts, 301–399 Weather, 401–499 Platform services; a new area takes the next unused hundred. Other categories run sequentially from 001. |
| `ZEN-DD-<nnn>` | Design decision record | Sequential |
| `ZEN-IF-<nn>` | External interface | Sequential |
| `ZEN-DIA-<nn>[a-z]` | Diagram. A letter groups a family (`04a`/`04b` data model, `05a`–`05e` activities, `06a`–`06d` states, `07a`/`07b` sequences) | New family → next number; new member → next letter |
| `TBR-<nn>` | Expert-review item: one per `[PENDING-SME]` decision (or partly pending decision) | Sequential |
| `G-<nn>` | Gap found by this package: needed but missing or inconsistent in the sources (a package-side defect report). Questions the pipeline already tracks live in `specs/GAPS.md` and keep their own ids (`G04-01`, `G2A-42`, `G-S2`); they appear in the derived block of `08-open-items.md`, never as `G-nn` rows | Sequential |
| `RC-<nn>` | Review comment in `12-review-log.md` | Sequential |

`pkg.py impact` prints the next free ID of every series and block. IDs are never renumbered or reused (`check` fails if an ID recorded in `manifest.json` disappears). HTML anchors are the lower-case ID: `zen-sr-fun-014`, `zen-dd-003`, `zen-if-07`, `tbr-10`, `g-02`.

## 3. Banner

The first lines of every markdown file (after its `#` title):

```
> **Draft revision N, derived from `specs/SPEC.md` at commit <short>[ (lock vX)]; SPEC.md is authoritative.** Updated YYYY-MM-DD. <rest of the original banner text, if any>
```

Before adoption, the banner reads "Draft, derived from … at commit bc67109 …". Adoption inserts "revision 1". Every later revision updates the revision, commit and date in **every** file, so the whole package always shows one baseline.

## 4. Requirement blocks (`02-system-requirements.md`)

Functional requirements sit under `## Functional requirements`, grouped by `### <SPEC area>` headings (Foundations, Situation display, Demand monitoring and alerts, Weather, Platform services). Every other category has its own `## <Category> requirements` section. Each block:

```
<a id="zen-sr-fun-014"></a>
#### ZEN-SR-FUN-014 · Position freshness and ghosts

> Zenith shall … (one "shall", at the system boundary, no design)

| Attribute | Value |
|---|---|
| Rationale | Why the requirement exists, in one or two sentences |
| Source | DEC043, DEC047 |
| SPEC | §4.1 Freshness; §5.1 evaluateFreshness |
| Invariants | V27, V28, V31 |
| Verification | **Test** — what verifies it (oracle HTTP/UI cases; later, case ids) |
| Status | **TBR** — what rests on the working assumption. → [TBR-10](08-open-items.md#tbr-10) (DEC043) |
| Allocated to | `trajectory`, `flights`, `api`, web app |
```

Rules:
- **Every attribute is present.** Use `—` for an empty Invariants cell, e.g. a performance requirement verified by Analysis.
- **SPEC refs** are `§<number> <sub-heading or operation>`, separated by `;`. Name the sub-heading when one exists: `pkg.py impact` matches refs to SPEC sub-headings, and a bare `§4.1` makes the item "possibly affected" by every change in §4.1.
- **Verification** starts with one of **Test**, **Demonstration**, **Analysis**, **Inspection** in bold.
- **Status** starts with **Agreed**, **TBR** (then the `TBR-nn` link or links) or **Withdrawn**.
- **Allocated to** uses only SPEC §0.3 module names (in backticks), "web app" and the §0.2 deployment units.
- When requirements are added or withdrawn, update the `## Summary` table (Category | Code | Requirements | TBR, plus a Total row), the verification-method counts line under it, and the contents list.

## 5. Design decision records (`03-design-decisions.md`)

An index table near the top (`| ID | Decision | Source |`, linking each record), then for each record:

```
<a id="zen-dd-003"></a>
## ZEN-DD-003 · Module decomposition and data ownership

**Source:** DEC087 (SPEC §0.3). **Diagrams:** [ZEN-DIA-02](diagrams/ZEN-DIA-02-components.drawio).

**Context.** …

**Decision.** …

**Trade study** (optional table: criteria × options, chosen option marked)

**Alternatives considered.** …

**Consequences.** …

**Requirements satisfied:** ZEN-SR-…, …

---
```

A withdrawn record keeps its heading and adds a line right under it: `**Status:** Withdrawn in rev N — <reason>; superseded by [ZEN-DD-0xx](#zen-dd-0xx).`

## 6. Interface control table (`06-external-interfaces.md`)

Columns: `| ID | Interface | Endpoints | Direction | Protocol / format | Content | Rate / size | Status | Source | Requirements |`. The ID cell is `<a id="zen-if-07"></a>**ZEN-IF-07**`. Status is one of `specified`, `interim mapping`, `awaiting samples`. Keep the maturity summary table above it in step with the rows. Every interface must also appear, labeled with its ID, on the system context diagram (ZEN-DIA-01).

## 7. Traceability (`07-traceability.md`)

Columns: `| DEC | Decision | Part | Bucket | Requirements | Design decisions | SPEC sections | Invariants (tagged) | Components |`.

- One row per decision. A split decision continues on rows whose first two cells are empty (`|  |  | b: … |`). Parts are labeled `a:`, `b:`, ….
- The Bucket cell starts with its number: `1 System`, `2 Software design`, `3 Programmatic/process`, `4 Clarification` (see classification.md).
- Link requirements and design decisions to their anchors.
- The `## Verification Cross-Reference Matrix (VCRM) summary` table is **derived**: it sits between `<!-- vcrm:begin -->` and `<!-- vcrm:end -->` and `pkg.py derive --write` regenerates it (per category: totals by method and status, plus verified / failing / no-evidence counts from chapter 10). Never edit inside the markers.
- The `## Coverage results` table (`| Check | Result | Detail |`) restates each `check` result with numbers. Update it every revision.

## 8. TBR register and gaps (`08-open-items.md`)

TBR register columns: `| TBR | Decision | Working assumption | Impact if reversed | Affected requirements | Experts must confirm or supply |`.
- The ID cell is `<a id="tbr-10"></a>TBR-10`.
- The Decision cell starts with the `DECnnn` ids it covers, and adds `*(partly pending)*` when only part of the decision awaits experts.

Gaps columns: `| Gap | Topic | What is missing or inconsistent | Where | Found by |`.
- The ID cell is `<a id="g-02"></a>G-02`.
- Where gives SPEC refs (`§5.2 …`).
- Below the package's gaps, the section `## Open items from the pipeline gap register` holds the derived block between `<!-- gaps-md:begin -->` and `<!-- gaps-md:end -->`: every row of `specs/GAPS.md` (open first, then deferred, then resolved/confirmed) with its own id, stage, kind, question, provisional reading and status. `pkg.py derive --write` regenerates it; never edit inside the markers. A package `G-nn` that `specs/GAPS.md` now tracks is closed with "**Closed in rev N** — tracked by the pipeline as G…".

## 9. README tables

- **Conventions:** the identifier table (section 2 above), plus a `manifest.json` row from adoption onward.
- **Key numbers** (`| Item | Count |`). `check` reads the first number of these rows, so keep them first: `System requirements`, `TBR register entries` (open, e.g. "31 open of 33"), `Gaps` (open, e.g. "54 open of 56"), `Diagrams`. The other rows (invariants cited, decisions classified, design decision records, external interfaces) are restated from `pkg.py index`.
- **Diagram index:** `| ID | Title | File | Kind |`, with File a relative link `[name](diagrams/name.drawio)`.
- **Revision history:** `| Revision | Date | Baseline | Summary |`, newest first, linking the CHANGELOG entry.

## 10. Statuses: withdrawn, closed, pending redraw

| Item | How to mark it | Never |
|---|---|---|
| Requirement withdrawn | Heading gets ` (withdrawn)`; Status becomes `**Withdrawn** in rev N — <reason>; replaced by [ZEN-SR-…](#…)`. Keep the statement for the record. | Delete the block or reuse the ID |
| Design decision withdrawn | `**Status:** Withdrawn in rev N — …` line under the heading | Delete the record |
| TBR closed | Append to the Working assumption cell: `**Closed in rev N** — confirmed by DEC101: <outcome>.` (or `reversed by …`). The row stays where it is. Then set the affected requirements to **Agreed**, unless another open TBR still holds them. | Remove the row |
| Gap closed | Append to the What is missing cell: `**Closed in rev N** — <how the spec resolved it>.` | Remove the row |
| Diagram pending redraw | Append ` — *pending redraw (rev N)*` to its Title cell in the README index, and say why in the changelog | Leave a stale diagram unmarked |

## 11. CHANGELOG.md

Newest revision first:

```
# Changelog

## Revision N — YYYY-MM-DD

**Baseline:** commit <old> → <new> (lock: <old> → <new>). **Trigger:** <e.g. "expert session decisions DEC101–DEC104">.

### Added
- [ZEN-SR-FUN-026](02-system-requirements.md#zen-sr-fun-026) · Title (DEC101; V438)
### Changed
- [ZEN-SR-FUN-021](…) · Feed silence banner — threshold now 3 minutes (DEC101; V31)
### Withdrawn
- …
### TBR register
- TBR-10 closed: DEC101 confirms the ghost and No Radar thresholds.
### Gaps
- G-09 closed: … · G-57 opened: …
### Diagrams
- ZEN-DIA-05e updated (feed-silence threshold). ZEN-DIA-02 checked, unchanged.
### Counts
Requirements 162 → 163 (TBR 88 → 85) · Design decisions 10 · Interfaces 22 · TBR open 33 → 31 · Gaps open 56 → 55 · Diagrams 16
```

The Revision 1 entry, written at adoption or build, records the baseline: the date built, the source commit, the counts, and "Adopted into the update workflow" or "Initial build".

## 12. manifest.json

Written only by `pkg.py stamp`. It holds:
- `revision`, `date` and `baseline` (commit, lock)
- `fingerprint`: decision rows, SPEC sections, invariants, modules, statecharts, config vars, error codes, DESIGN.md sections and components, contract files
- `ids`: the registry of every ID ever issued, per series; it only grows
- `diagrams`: each diagram's title, file, depicted decisions, sections and invariants
- `counts` and `history`
- project settings kept across stamps: `id_prefix` (the `ZEN` of `ZEN-SR-…`; detected from the first requirement when absent), `cover` (`org`, `product`, `title`, `description`, `footer` for the compiled cover page) and `pdf` (the PDF file name). Set them by hand once, at Build or Adopt; `stamp` preserves them.

`impact` compares the current spec set with `fingerprint`, and `check` uses `ids` to catch deleted items.

## 13. Derived chapters and blocks

`pkg.py derive --write` regenerates, from the spec set alone:

| Output | Built from |
|---|---|
| `09-change-control.md` | `specs/spec.lock.json` (versions, dates, approvers, reasons, file count), `specs/logs/transitions.jsonl` (stage, date, acceptance, note), `specs/logs/02-prototype.md` Versions tables, `specs/changes/SCR-*.md` (id, date, title, class, status from the Status row, cases changed, decisions, `RC-nn` cited), `specs/backprop-log.md` |
| `10-verification-status.md` | `specs/fixtures/cases/*.json` (each case's `derivedFrom` → SPEC §, `Vn`, operation; probes excluded), `specs/fixtures/ui/*.spec.ts` (`// covers:` refs), the newest unfiltered `specs/logs/oracle/run-*.json` on target `default` with its lock binding, `specs/logs/ui-e2e.json`. A requirement maps to a case when they share an invariant or a SPEC sub-heading (*exact*) or only a numbered section (*broad*). Statuses: **verified** (every mapped case passed on the current lock), **failing**, **stale** (run not bound to the current lock: not evidence), **not run**, **unverified** (nothing maps) |
| `11-ui-design.md` | SPEC §14.1–§14.4 counts, DESIGN.md tokens, DESIGN.md §Approved Wireframes screen list and paragraphs, each wireframe's `<h2>` frame titles and `data-testid`s; requirements whose SPEC refs include §14 |
| `08-open-items.md` block | `specs/GAPS.md` rows, between the `gaps-md` markers |
| `07-traceability.md` block | the VCRM rollup, between the `vcrm` markers |

Every derived file starts with the banner `> **Derived by `pkg.py derive`; do not edit by hand.**`. `check` warns when a derived file or block differs from what `derive` would produce now. The revision banner of the hand-written chapters does not apply to derived files; their provenance is the manifest's baseline.

## 14. Review log (`12-review-log.md`)

One table, newest last:

```
| RC | Date | Reviewer | Targets | Comment | Classification | Status | Resolution |
|---|---|---|---|---|---|---|---|
| RC-01 | 2026-10-21 | J. Doe (SE) | ZEN-SR-FUN-014, TBR-10 | Ghost timeout should be 5 min, not 7 | policy | accepted | SCR-036 (draft under specs/changes/review/ until approved) |
```

- **RC** ids are permanent. **Targets:** package ids (`ZEN-SR-…`, `ZEN-DD-…`, `ZEN-IF-…`, `ZEN-DIA-…`, `TBR-nn`, a gap id) or spec ids (`DECnnn`, `Vn`, `§n.n`), comma-separated.
- **Classification:** `package defect` | `clarification` | `technical` | `policy` (SKILL.md §Review).
- **Status:** `open` → `accepted` → `applied`, or `rejected`, or `package` (fixed in the package only).
- **Resolution:** the SCR, DEC, GAPS row or revision that closes it. The changelog entry of the revision that reflects an applied change cites the RC.
- `pkg.py review --resolve` reads this table; `pkg.py review --draft RC-nn --kind scr|gap` writes `specs/changes/review/SCR-draft-RC-nn.md` or `GAP-draft-RC-nn.md`. The drafts folder is the only place under `specs/` this skill writes, and it is cleared when the pipeline has taken the draft.
