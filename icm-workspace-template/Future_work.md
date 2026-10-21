# Future Work — SDD v3 ICM Workspace Template

Backlog after the prototype-first change (branch `feat/prototype-first`, version `2026.10.20-v3.4-prototype-first`).
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

## Done in v3.3 (2026-10-18, same branch) — time to first prototype

| Item | What changed | Tests |
|---|---|---|
| Stage 01 gate: zero *unrecorded* gaps | Core-flow questions answered; every other gap a `GAPS.md` row with a provisional assumption the prototype builds. `extraction-closure.md` and 01 CONTEXT updated; 01 gate requires `specs/logs/01-interview.md` (one row per question) and a well-formed GAPS.md with open rows allowed | `01: open policy gaps are allowed…` |
| Stage 02 = contract compilation only | No Red Team before the prototype; all rounds (1 full, 2–3 delta) run in 03p via `_config/references/red-team.md`. 02 gate: check + slice cap + Outcome Table | `02: contracts + Outcome Table only…` |
| Versioned demos | `03p-prototype.md` Versions table (gate requires ≥ 1 row); 03p gate requires ≥ 1 round and a fresh rulings ledger | `03p: acceptance…` |
| `readiness` as the user's map | Budgets vs actuals, open policy questions verbatim with provisional answers, path to a frozen spec in plain words, the user's next action; 01 gates included | `readiness: budgets…` |
| Budgets | `manifest.budgets` (interviewQuestions 20, prototypeVersions 3, swarmRounds 3); shown, never blocking; metrics record interview questions and prototype versions | metrics test |

## Done in v3.4 (2026-10-20, same branch) — see it, then harden it

Why: v3.3 moved the Red Team and the oracle after the prototype but kept the whole v3 definition load *before* it — a 14-section placeholder-free SPEC, the four-dimension closure gate, two dual-interpretation sub-agents, 2–3 approaches and per-section design approvals, then an agent-only contract compilation with every status enumerated. The user still waited through v3's Stage 01 before seeing anything. v3.4 makes the running prototype the boundary: v2's experience up to it, v3's completeness after it.

| Item | What changed | Tests |
|---|---|---|
| Linear stages | `01 → 02_prototype → 03_hardening → 04 → 05 → (06) → 07` for every project type; `03p_prototype`, `02_adversarial_swarm_analysis` and `03_interactive_wireframing` folded into 02 and 03. No shared integers in `sdd-state.json` (C6 resolved as a side effect); `--resume 02` reworks the prototype, `--resume 03` re-hardens | `A1: every project type goes 01 → 02 → 03 → 04`, `order: …`, `A1: --resume …` |
| Stage 01 = brief, not spec | Interview budget 12; a core-flow closure (actor, entity + lifecycle, core flow, forbidden, out of slice) replaces the four-dimension gate; one slice brief the user OKs replaces approaches + section approvals; Dual Interpretation sub-agents removed from 01; SPEC is a **draft** (§0, §1, §3, §4, §5, UI §14 filled; the rest `TBD — Stage 03`) | `check --spec: …`, `01: open policy gaps …` |
| `check --spec` | Draft mode: placeholders and missing sections reported, never errors; lists the draft sections still to fill. `check`/`check --contracts` still error on placeholders (Stage 03 on, freeze) | `check --spec: …`, `03: hardening needs …` |
| Stage 02 = prototype only | Built from the brief against `_config/references/prototype-checklist.md` (the profile rules that are expensive to retrofit); versions, demo answers, `--approved-by`; no contracts, rounds or oracle required | `02: acceptance …`, `01 → 02 without any contract …` |
| Stage 03 = hardening with the prototype running | Contracts compiled *against* the prototype (Reconciler first), spec completed, Outcome Table, Decision Inventory, Red Team rounds 1–3 (round 1 carries the four closure dimensions), sampled `diff-expect`, wireframes captured + user review (UI). Logs: `03-swarm.md`, `03-rulings.md`, `03-decisions.md`; prototype record `02-prototype.md` | `03: hardening needs …`, `A3`, `02 on an iteration …` |
| Readiness | Path 01 → 02 → 03 → 04 with the user's next action per stage; gates for 01/02/03/04 | `readiness: …` |
| Reference material | `extraction-closure.md` split into the Stage 01 core-flow gate and the Stage 03 Round 1 checklist; `red-team.md`, templates, example logs renamed; `ui-state-matrix.md` cells may be gaps the prototype renders | example `check` passes |
| Existing spec documents as input | Stage 01: a spec in any format with no code behind it is the brief (decisions carried over, hardening redone against the prototype). Stage 01b: with code, the document is evidence of intent, the code describes today, disagreements become gap rows | — (prose) |
| Stage 01b adoption in the same shape | 01b = inventory + draft spec of today's behavior + slicing plan, within the interview budget; 02 = walkthrough of the existing system (intended / bug / later slice); 03 = contracts and inventory per hardened surface; 04 = the characterization oracle recorded from the running system (`tech-debt` tag for confirmed debt). Nothing is recorded in 01b; the freeze-as-is shortcut is gone (it skipped the walkthrough and could not pass `check` without contracts) | `01b: inventory + draft …` |

Not changed: the Equivalence Profile, the lock, the single grader, `recorded:` ≠ citation, spec-only predictor B (03 sample, 04 full), L2 by clean-room build B. The prototype anchors nothing the spec does not cite.

## Done in v3.5 (2026-10-21, same branch) — the recommendations after the Zenith catch-up

| Item | What changed | Tests |
|---|---|---|
| Metrics readable | `sdd.cjs metrics`: one row per transition with its recorded counts | `metrics: …` |
| Modules the norm | Stage 03 step 2 splits by surface; `sdd.cjs spec-outline` shows section sizes; README playbook | `spec-outline: …` |
| Oracle credit from citations | `check` credits `inv:Vn` to a case whose `derivedFrom` cites the invariant (explicit `covers` stays the stronger claim) | `check: invariants credited …` |
| Rolling prototype cadence | `manifest.prototypeCadence: "rolling"`: Stage 01 is in order right after an accepted prototype; the cap applies at Stage 03 | `order: rolling cadence …` |
| Append-only decision log | `transition` writes `specs/logs/decisions.fingerprint.json`; `check` and `status` warn on rewritten or removed rows | `decision log: …` |
| Derived agenda | `sdd.cjs agenda [--write]`: open policy gaps + `[PENDING-<ROLE>]` decisions by role; readiness counts the tags | `agenda: …` |
| Decision supersession | A row whose text says `supersedes DECnnn` (one or more ids) replaces those rows: `agenda`, `readiness` and the dashboard skip a superseded `[PENDING-<ROLE>]` row; `check` warns when a pending row is cited without the word and errors when `supersedes` names an unknown id | `agenda: a row that says supersedes …` |
| Generated UI specs | `ui-capture.cjs` writes `<name>.capture.json`; `ui-specgen.cjs` emits `generated-wireframes.spec.ts` (one smoke test per captured state) | `ui-specgen: …` |
| Template upgrade | `sdd.cjs upgrade --from <template-root>`: swaps `specs/.sdd`, keeps the state, renames legacy logs, regenerates entry files, writes the upgrade log with status and readiness | `upgrade: …` |
| Derived artifacts direction | README playbook names the next derived deliverables (API reference, user manual, test plan) after the `design-package` skill | — |
| Dashboard | `sdd.cjs dashboard [--out F] [--json] [--open]`: one self-contained HTML page from the same functions status/readiness/agenda/metrics use; rewritten by every transition; `--json` for other tools (the VS Code extension can read it instead of parsing output) | `dashboard: …` |
| Cadence before contracts | After an accepted prototype with no manifest yet, the next slice's brief is in order (the user chooses at acceptance; Stage 03 writes the choice into `manifest.prototypeCadence`); the brief states the defaults it runs under instead of asking per setting | `order: next slice before contracts …` |
| Per-slice cap under rolling cadence | `transition --completed 02` records the slice's declared outcomes in its `transitions.jsonl` row (contract keys, else `spec:<id>` from SPEC §5); under `prototypeCadence: "rolling"` the Stage 03 gate, `readiness` and the dashboard size each accepted slice since the last lock on its own (`#1 9, #2 21`) and enforce the cap per slice; Stage 03 hardens in slice-sized passes | `rolling cap: …` |
| Legacy state mapping | `upgrade` maps older stage names in the state file (`03p_prototype` → Stage 02 complete; v2 `02_adversarial_swarm_analysis` / `03_interactive_wireframing` → Stage 01 complete) and never overwrites an earlier upgrade log | `upgrade: legacy state …` |
| Pipeline pinned as one lock entry | `spec.lock.json` keeps per-file hashes for the spec content only; `specs/.sdd/**` is one `pipeline: { version, hash }` entry, so `upgrade` leaves a one-line diff (`pipeline 2026.10.20-v3.4 → 2026.10.21-v3.5`) in `status`, `verify`, the lock gate and the dashboard, and the re-freeze is `freeze --reason "upgrade: <version>"`; an old-format lock reads as "pipeline unpinned"; `export` still copies the whole frozen set | `lock: pipeline pin …`, `lock: an old-format lock …`, `upgrade: on a locked project …`, `export: the build-B workspace …` |

## Open

### Derived deliverables beyond the design package
- An API reference from `openapi.yaml` + `errors.json`; a user manual from SPEC §14 (copy table, screen flow) and the wireframes; a test plan from `specs/fixtures/cases` and `IMPLEMENTATION_PHASES.md`. Each with the `design-package` skill's machinery: a fingerprint of its sources, permanent ids, numbered revisions, `impact` before every update.
- **Effort:** M each · **Guarantee impact:** none

### Pilot run v3.4 (measure before trusting)
- Run one notes-service-sized slice end to end and read `metrics` in `transitions.jsonl` per stage: questions to the brief, versions to acceptance, prototype rework in Stage 03 (the cost of compiling contracts after the code), rounds. The interview budget (12) and the prototype checklist's length are the two numbers most likely to move.
- **Effort:** one session · **Guarantee impact:** none


### `oracle.cjs gen-profile-cases` built in
- Projects write a local `specs/changes/oracle/tools/gen-profile.cjs`; Zenith hand-authored ~676 profile-generic rows. A built-in generator derives the mandatory profile families (IDEM, OCC, PAGE, validation order, precedence, round-trips) from `openapi.yaml` + the profile rules. Needs a bounded design pass: which families generalize across contracts, how a project excludes one.
- **Effort:** M · **Guarantee impact:** strengthens (fewer hand-written generic cases)

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
3. Lower the interview budget or shorten the prototype checklist only with pilot numbers.
