# Future Work — SDD v3 ICM Workspace Template

Backlog after the prototype-first change (branch `feat/prototype-first`, version `2026.10.18-v3.1-prototype-first`).
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

## Open

### B4. Playbook in the README (rest)
- Five user touchpoints (01 interview, end of round 1, 03p demos + acceptance, 04 freeze, 07 report); strong models for critic / predictor B, cheaper for generation; different model family for build B; per-stage token budget.
- **Effort:** S · **Guarantee impact:** none

### B5. Context diet for stage contracts
- Measured before v3.1: 02 = 13.6 KB, 05 = 13.2 KB, 04 = 12.9 KB; each also loads `systems-standards.md` (17.7 KB) and/or `oracle-standard.md` (17 KB) whole. The templates (B2) moved formats out of 02/03p; section-anchored references ("read §PAGE, §ERR only") and duplicate rule blocks remain. Target ≤ 8 KB per CONTEXT.
- **Effort:** M · **Guarantee impact:** none (verify with the test suite + a dry run)

### B6. Modular spec (long term)
- `specs/spec/<module>.md` with SPEC.md as index; frozen-set globs and `export` updated. The size warning is the short-term guard.
- **Effort:** L · **Guarantee impact:** strengthens

### B8. Single source for the global skills
- The skills (`../brainstorming`, `../adversarial-swarm-analysis`, …) are a stage behind the template and have no `sdd-prototype`. Generate skill text from the template stage files, or make skills thin pointers to them. CI runs `validate-icm-sync.sh` as report-only until then.
- **Effort:** M · **Guarantee impact:** strengthens

### B9. VS Code extension awareness of 03p (extension repo)
- 03p and 03 share `lastCompletedStep = 3`; the extension's "advance" can skip 03p without gates. Teach it `03p_prototype` (display + advance order 02 → 03p → 03 → 04), or disable advance past 2 unless `stepName` is `03p_prototype` / `03_interactive_wireframing`.
- **Effort:** M · **Guarantee impact:** none

### C2. Fold `spec-self-review.md` into `check` + the round 1 checklist
- Move mechanical checks (placeholders, token completeness, cross-artifact names) into `sdd.cjs check` as errors; put the judgment checks into the round 1 critic brief; delete the separate pass.
- **Effort:** M · **Guarantee impact:** strengthens

### C6. State model: stop overloading `lastCompletedStep`
- v3.1 reads `transitions.jsonl` (`iterationStages`) where `stepName` is not enough. A string `stage` field as the source of truth would remove the heuristics; keep the integer for the extension.
- **Effort:** M · **Guarantee impact:** none

### Stage 03 capture tooling
- The wireframe capture (rendered HTML + inlined styles, scripts stripped, test ids kept) is described in prose. A `ui-capture.cjs` next to `ui-observe.cjs` would make captures identical across agents.
- **Effort:** M · **Guarantee impact:** strengthens

---

## D. Tooling backlog (phase 2)

| Item | Why | Effort |
|---|---|---|
| `oracle.cjs gen-profile-cases` built in | Projects currently need a local `specs/changes/oracle/tools/gen-profile.cjs`; Zenith hand-authored ~676 profile-generic rows | M |
| Semantic matcher equality in `diff-expect` | Many Zenith diff gaps were notational (equivalent matchers written differently) | M |
| Coverage-exemption classes in the manifest | Zenith had 362 free-text exemptions; classes make them reviewable | S |
| Promote Zenith's author-harness tools | Reuse instead of per-project reinvention | M |
| Per-stage cost line in `transitions.jsonl` (rounds, cases, gaps) | See where time goes across projects | S |
| `readiness` panel in the VS Code extension | Progress the user can see without a terminal | M |

## E. Considered and kept

- **Equivalence Profile, lock, single grader, L2 as default target** — the core of the guarantee. `equivalenceCadence: "release"` is opt-in and never relabels a pending slice.
- **Caveman encoding of stage files** — saves tokens; no evidence yet that agents misread it. Revisit only with evidence.
- **No new stages, personas, or percentage readiness scores** — v3.1 moved work between stages (02 → 03p) and reordered 03; it added none.

## Suggested order

1. B5 and the rest of B4 (cheap, pure ergonomics).
2. C2 and the Stage 03 capture tool (both turn prose rules into machine checks).
3. B6 (modular spec) and C6 after a bounded adversarial pass.
4. B8, B9 and section D as separate work.
