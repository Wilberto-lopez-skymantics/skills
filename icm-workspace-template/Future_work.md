# Future Work — SDD v3 ICM Workspace Template

Backlog after the prototype-first change (branch `feat/prototype-first`, version `2026.10.18-v3.2-prototype-first`).
Every item must preserve the core goal: two builders given only the frozen set produce systems the oracle cannot tell apart (L2).

Legend — **Effort:** S (< ½ day) · M (1–2 days) · L (design needed first: bounded adversarial pass before building).
**Guarantee impact:** `none` = workflow/ergonomics only · `strengthens` · `trade-off` (explicitly weakens something; needs a user decision).

---

## Done in v3.1 (2026-10-18)

| Item | What changed | Tests |
|---|---|---|
| A1–A4 | Stage 00 resume, slice cap per slice, round counter per iteration, pre-freeze route | `tests/sdd-state.test.cjs` A1–A4 |
| Stage 02 split around the prototype | 02 = contracts + round 1; 03p = prototype, feedback, rounds 2–3 with the prototype running, sampled `diff-expect`. Cap 3 rounds per iteration counted across both stages | order tests |
| C4 — acceptance not self-attestable | `transition --completed 03p --approved-by "<user>"`, recorded in `transitions.jsonl`; the `ACCEPTED` text gate is gone | `03p: acceptance comes from --approved-by` |
| UI flip | UI projects run 02 → 03p → 03 → 04; wireframes are captured from the accepted prototype (03 CONTEXT rewritten); 04 checks `transitions.jsonl` for 03p when the last stage was 03 | `order: … UI 02 → 03p → 03 → 04` |
| Iteration regression guard | 03p on a locked project requires an unfiltered run of the previous oracle; failures must be named in DECISION_LOG | `03p on an iteration` |
| C5 — L2 cadence | `manifest.equivalenceCadence: "iteration" \| "release"`; 07 requires `L2 pending` row or `--release` + diff | `07: equivalenceCadence` |
| C1 — Stage 05 per-phase oracle loop | Draft/Attack/Refine per file replaced by inventory → build → oracle until green → one Red Team pass; dev iteration log is per phase | — (prose) |
| C3 — Dual Interpretation trimmed | Once per slice + lifecycle/permission/money topics | — (prose) |
| C7 — personas by project type | Stage 05 Red Team instantiated from `manifest.interfaces` / project type | — (prose) |
| B1, B2 — templates + worked example | `_config/gaps-template.md`, `rulings-template.md`, `prototype-record-template.md`; notes-service gained `GAPS.md`, `02-rulings.md`, `03p-prototype.md`, `03p-decisions.md`, DEC006 | example `check` still passes |
| B3 — next slice routed | 07 handoff lists deferred gaps; 01 iteration note starts from them; `status` shows the deferred count | `status: deferred gaps` |
| B4 (partial) — playbook | First slice 30–80 outcomes in Stage 01 step 1c and README | — |
| B6 (short term) — SPEC size guard | `check` warns above 120 KB | `check: warns when SPEC.md is too large` |
| B7 — tests in the repo + CI | `tests/sdd-state.test.cjs`; `.github/workflows/sdd-template.yml` (tests, example check, entry-file parity, sync report) | — |
| Reference material | `oracle-standard.md` §Prototype recording + `recorded:`-only gap; iteration-log rounds note; 05 CONTEXT no longer contradicts itself about `03p-decisions.md` | — |
| B9 (tooling side) | `validate-icm-sync.sh` knows `03p_prototype` (reports SKIP until a skill exists) | — |

## Done in v3.2 (2026-10-18, same branch)

| Item | What changed | Tests |
|---|---|---|
| C2 — self-review folded into `check` | `spec-self-review.md` deleted. Mechanical checks now in `sdd.cjs check`: required `## N.` sections, placeholders (error), hedged numbers (warning with file:line), §11 overrides ↔ manifest, every operation named in the spec, UI components ↔ DESIGN.md keys, module links, size. Judgment checks are the Round 1 checklist in the 02 contract | `check: placeholders…`, `check: profile overrides…` |
| B6 — modular spec | `specs/spec/**/*.md` is frozen, must be linked from SPEC.md, contributes invariants and sections; size warning per file | `check: spec modules…` |
| B5 — context diet | 02 → 9.9 KB, 04 → 9.7 KB, 05 → 8.7 KB (from 13–14 KB); references anchored to the sections a stage needs | — |
| B4 — playbook | README §Operating playbook (slice size, five touchpoints, model strength, metrics, modules, cadence) | — |
| Stage 03 capture tool | `scripts/ui-capture.cjs`: same capture for every agent (styles inlined, scripts stripped, media → placeholders, form state frozen, test ids kept, optional ARIA snapshot) | — (needs Playwright) |
| D — coverage-exemption classes | `coverageExempt` keys accept `*`; values may cite `coverageExemptClasses`; `check` reports per class | `check: coverage exemptions…` |
| D — per-stage metrics | every transition record carries `metrics` (rounds, gaps, rulings, outcomes, cases, probes) | `transition: every record carries stage metrics` |
| D — notational matcher equality | `diff-expect` treats `{"$eq":x}`, an anchored literal `$regex`, and `$oneOf` order as the same prediction | `diff-expect: notational differences…` |
| Dropped by decision (2026-10-18) | VS Code extension items (B9, readiness panel) and global-skills sync (B8): the workflow is used through the template only | — |

## Open

### `oracle.cjs gen-profile-cases` built in
- Projects write a local `specs/changes/oracle/tools/gen-profile.cjs`; Zenith hand-authored ~676 profile-generic rows. A built-in generator derives the mandatory profile families (IDEM, OCC, PAGE, validation order, precedence, round-trips) from `openapi.yaml` + the profile rules. Needs a bounded design pass: which families generalize across contracts, how a project excludes one.
- **Effort:** M · **Guarantee impact:** strengthens (fewer hand-written generic cases)

### C6. State model: stop overloading `lastCompletedStep`
- v3.1 reads `transitions.jsonl` (`iterationStages`) where `stepName` is not enough. A string `stage` field as the source of truth would remove the remaining heuristics. Low value now that nothing external reads the integer.
- **Effort:** M · **Guarantee impact:** none

### Promote Zenith's author-harness tools
- Reuse the request-skeleton and recording helpers instead of per-project reinvention.
- **Effort:** M

### Remaining hedge heuristics
- `check` flags approximate numbers, examples standing for values, undefined intervals and adjective parameters. "based on" without a formula and config files named without a schema are still the Quantifier's job.
- **Effort:** S

## E. Considered and kept

- **Equivalence Profile, lock, single grader, L2 as default target** — the core of the guarantee. `equivalenceCadence: "release"` is opt-in and never relabels a pending slice.
- **Caveman encoding of stage files** — saves tokens; no evidence yet that agents misread it. Revisit only with evidence.
- **No new stages, personas, or percentage readiness scores** — v3.1 moved work between stages (02 → 03p) and reordered 03; it added none.

## Suggested order

1. `gen-profile-cases` after a bounded design pass (largest remaining token saving in Stage 04).
2. Remaining hedge heuristics and the Zenith harness tools.
3. C6 only if the stepName heuristics cause a defect.
