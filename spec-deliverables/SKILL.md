---
name: spec-deliverables
description: Generate, refresh or check the reader-facing deliverables derived from a Spec-Driven Development spec set — the API reference (docs/api-reference/), the user manual (docs/user-manual/) and the test plan (docs/test-plan/) — each as markdown plus one self-contained index.html, stamped with the lock they were built from. Use it whenever the user asks for API docs, an API reference, endpoint documentation, a user manual, user guide, help pages, a test plan, test procedures, a traceability matrix, test results or QA documentation for an SDD project, or wants those documents regenerated, refreshed, checked for staleness or viewed after the spec, contracts, oracle cases, wireframes or lock changed — even if they never say "derived". Never edits specs/; every output is regenerated from the spec set.
---

# Spec deliverables: the API reference, the user manual and the test plan

A complete SDD spec set already contains what these documents say: `openapi.yaml` and `errors.json` are the API, SPEC §14 and the wireframes are the user interface, the oracle cases and run reports are the tests. This skill writes them out the way their readers expect them, without a second source of truth: the tool regenerates everything, nothing is hand-edited, and every page says which lock it was built from.

| Deliverable | Folder | Built from | Reader |
|---|---|---|---|
| API reference | `docs/api-reference/` | `openapi.yaml` (operations, parameters, schemas, `x-outcomes`), `errors.json`, SPEC §5 (the rules in words), the oracle cases (recorded request/response examples) | integrators, build B |
| User manual | `docs/user-manual/` | SPEC §14.2 (flow), DESIGN.md §Approved Wireframes and UI State Matrix, the wireframes, SPEC §14.4 (every string), SPEC §2–§4 (concepts), §3 (roles), §12 (configuration), `errors.json` | users, administrators, support |
| Test plan | `docs/test-plan/` | `specs/fixtures/cases` (procedures), `specs/fixtures/ui` (browser specs), `oracle.config.json` (environment), `IMPLEMENTATION_PHASES.md` (schedule), `specs/logs/oracle/run-*.json` and `ui-e2e.json` (results), the lock (evidence binding) | QA, certification reviewers |

The `design-package` skill is the fourth derived document (the systems engineer's view, with hand-written chapters and a review loop); this skill's three are fully mechanical.

## Commands

All run from anywhere inside the project (`--root` otherwise); `--out` changes the `docs/` base.

```bash
node .claude/skills/spec-deliverables/scripts/deliver.cjs build all --write     # api | manual | test-plan | all; without --write: a summary
node .claude/skills/spec-deliverables/scripts/deliver.cjs compile all           # one index.html per deliverable (no scripts; the manual embeds the wireframes)
node .claude/skills/spec-deliverables/scripts/deliver.cjs check                 # exit 1 when a deliverable is older than its inputs or the lock
```

The script uses the project's own pipeline library (`specs/.sdd/scripts/sdd-lib.cjs`) so the contracts parse exactly as the oracle reads them; `--lib` points at it when the project is an example inside a template.

## When to run it

- **After a freeze** (Stage 04, or a Stage 00 re-freeze): `build all --write && compile all`. The baseline block of every README names the lock; the pages are evidence-grade only then.
- **Before a freeze**, as a preview: the same commands; the README says "not frozen yet: this is a preview, not a baseline". Fine for reviewing a prototype's API or a hardening round's screens.
- **After an oracle run or a UI run**: `build test-plan --write && compile test-plan` refreshes results and the per-phase status.
- **On request**: whenever someone asks what an operation answers, what a screen does in a state, or what a case verifies, point them at the compiled page instead of the spec.
- `check` belongs next to `sdd.cjs status` in a routine: a stale deliverable is a reminder, never a gate.

## What the pages contain

**API reference.** `README.md`: version, counts, the contract's own conventions text, authentication, the public operations, and an operation index by SPEC §5 group. One file per group (`5-1-<title>.md`, or `ops-<tag>.md` for operations SPEC §5 does not name): per operation the purpose, who may call it, the spec's rules verbatim, parameters with constraints, request body, responses, **every declared outcome** (`x-outcomes`), one recorded success and one recorded failure example from the oracle (requests as sent, responses as expected, `{"$type": …}` for values the spec leaves free), the invariants its cases cite and the latest run result of those cases. `errors.md`: the problem envelope, the catalogue, where each code can occur. `schemas.md`: every component schema with members, requirement, constraints and meaning.

**User manual.** `01-getting-started.md` (screen flow in words; sign-in strings), `02-screens.md` (per approved screen: the DESIGN.md description with copy keys resolved to the strings, the wireframe embedded in the HTML and linked in markdown, its frames, the UI State Matrix rows of its components, the strings it shows), `03-roles-and-permissions.md` (SPEC §3), `04-concepts.md` (glossary; domain model headings with their opening paragraph), `05-messages.md` (the copy table by area), `06-errors.md` (every error with what it means and what to do), `07-administration.md` (configuration variables; administrator rows of the permission matrix). Component names become words (`SplashScreen` → Splash Screen); keys with no entry in the copy table stay as keys, which is itself a finding for the spec.

**Test plan.** `README.md` (scope with counts, strategy, environment from `oracle.config.json` and the prototype record, entry and exit criteria, status now), `01-traceability.md` (invariants → cases → latest result, with the manifest's coverage exemptions; operations → cases; screens → browser specs), `02-procedures.md` (every case: origin, phase, steps with request and expectation), `03-ui-procedures.md` (every browser spec: tests, refs, observed states), `04-schedule.md` (phases with tasks done, verification command, cases, latest result), `05-results.md` (latest run bound or not to the lock, failures with messages, run history, browser run).

## Rules

1. **Never edit `specs/`.** A wrong statement in a deliverable is either a generator defect (fix the script) or a spec defect (a `specs/GAPS.md` row or a Spec Change Request through the pipeline). Do not patch the markdown: the next `build --write` overwrites it.
2. **Never hand-edit the output.** The derived banner at the top of every file says so. A reader who wants a different document gets a different generator section, with a reference note in `references/format.md`.
3. **Say what the baseline is.** A page built before the lock is a preview; after the lock it is evidence of what the frozen set says. `check` tells which; the README table says which.
4. **The example in the page is the oracle's.** Never invent an example request or response; when no case exercises an operation, the page says "no recorded case yet" and that gap is a Stage 04 finding.
5. **Keep the three in step with the design package.** When `pkg.py impact` shows the spec moved, rebuild these too; both read the same lock.

## Install

Copy this folder to the project's `.claude/skills/spec-deliverables/` (or `~/.claude/skills/`). Node.js ≥ 18, no dependencies. Outputs are plain markdown plus HTML; commit them with the spec set they were built from.
