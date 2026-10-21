<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 04: Oracle Synthesis, Implementation Phases & Freeze

Converts the hardened spec into (1) the **Immutable Test Oracle** (`specs/fixtures/`) every build is graded by, (2) the phase checklist (`IMPLEMENTATION_PHASES.md`), and (3) the user-approved **freeze** of the whole frozen set.

**Two interpretations per oracle value:** the accepted prototype (recorded, free) and a spec-only author (predicted). LLM authoring is spent only where judgment is needed; every disagreement is a spec fix, never a pick.

**⊥ implementation code** (prototype fixes found by the oracle excepted). Cases, seed data, config, generators, UI specs and library adapters are test artifacts and are written here.

## Inputs
- Layer 4 (working): `specs/SPEC.md` (+ modules), `specs/contracts/*`, `specs/DECISION_LOG.md`, `specs/GAPS.md`, `specs/DESIGN.md` + `specs/wireframes/*.html` (UI)
- Layer 4 (working): `specs/logs/03-swarm.md` — the **Outcome Table only** (what to cover; its discussion is not spec).
- Layer 4 (working): the running prototype (`Run:` line in `specs/logs/02-prototype.md`) and `specs/logs/03-decisions.md`
- Layer 3 (reference): `../_config/references/oracle-standard.md` (whole: format, matchers, coverage, probes, diff-expect, prototype recording, UI specs), `../_config/schemas/oracle-cases.schema.json`, `oracle-config.schema.json`
- Layer 3 (reference): `../_config/references/systems-standards.md` — the rule ids cited in `derivedFrom` (read the §§ for the project's interfaces)
- Layer 3 (reference): `../_config/examples/notes-service/specs/fixtures/` (reference oracle; imitate its precision)

## Part A — Oracle synthesis (`specs/fixtures/`)

**Independence:** the spec-only author (step 3c) works in a fresh session | sub-agent whose only inputs are the request skeletons, `SPEC.md` (+ modules), `contracts/` and the profile — ⊥ the prototype's code, recordings, `specs/logs/`, or this conversation. An author who has seen the prototype confirms it instead of checking it.

1. **Configure** `specs/fixtures/oracle.config.json`: targets `default` (prototype, then build A), `a`, `b` (`${ENV}` values); `reset` hook + `specs/fixtures/seed/`; `adapters.sql` if cases assert storage; readiness probe; `variablePaths` mirroring SPEC §9; `buildEnv` = the SPEC §12 values every graded build starts with (ENV-3). Start the prototype with that `buildEnv`.
2. **Request design:** ∀ Outcome Table row → a request-only case (setup + request, no `expect`, neutral title) in `specs/changes/oracle/requests/`. Concurrency cases use `parallel` steps with the ENV-5 delay frozen in `buildEnv`.
3. **Domain cases** (expectations need SPEC.md):
   a. **Record A:** `node specs/.sdd/scripts/oracle.cjs record --target default --cases-dir specs/changes/oracle/requests --out specs/changes/oracle/recorded.json`. Adopted codebases: this is the characterization oracle of the current slice; a recorded value the user confirmed as tech debt (a `[TECH DEBT]` row of `GAPS.md`) keeps its case, tagged `"tags": ["tech-debt"]`, until a Class 1 change retires it.
   b. **Review A:** replace leftover literals with matchers; add SPEC/contract/profile citations to every `derivedFrom`. `recorded:` is provenance, not a citation (`oracle-standard.md` §Prototype recording). Uncitable recorded value → prototype bug (fix, re-record) | spec gap (step 5).
   c. **Predict B:** `node specs/.sdd/scripts/oracle.cjs strip-expect --from specs/changes/oracle/recorded.json --out specs/changes/oracle/b`; the spec-only author fills `expect` + `derivedFrom`, `{"$unspecified": "<what is missing>"}` where the spec does not decide.
   d. **Compare:** `node specs/.sdd/scripts/oracle.cjs diff-expect --a specs/changes/oracle/recorded.json --b specs/changes/oracle/b --label domain`. ∀ gap → the spec decides: pinned → prototype bug, fix and re-record; not pinned → spec gap (step 5). ⊥ pick a side.
   e. Move agreed cases into `specs/fixtures/cases/` (add `phase`).
4. **Profile-family cases** (idempotency, OCC, pagination, validation order, precedence, null/whitespace round-trips — `oracle-standard.md` §Coverage): a generator script (`specs/changes/oracle/tools/gen-profile.cjs`) derives full cases from contracts + profile rules into `specs/fixtures/cases/generated-profile*.json`, tagged `"generated"`, citing only `profile XXX-n` and contracts. A case needing a SPEC.md citation is a domain case, never generated. **Second interpretation:** `oracle.cjs run --target default` against the prototype — every generated case passes; a failure → generator bug | prototype bug (fix, or drop the tag so B predicts it) | spec gap. The gate checks this run against the exact current fixtures.
5. **⛔ Derivability:** an expected value that cannot be cited from SPEC, contracts or the profile = spec gap. ⊥ invent it. → `specs/logs/04-spec-gaps.md` + `GAPS.md` row (kind `oracle`); technical → the profile and contracts (Stage 03 rules), policy → the user; update the spec, re-run the affected steps. Before the first freeze no SCR is needed (the user approves once, at freeze); after a freeze it is part of the Class 1 iteration.
6. **Probes:** `node specs/.sdd/scripts/oracle.cjs gen-probes` (http) + hand-written `"probe": true` cases for domain edge inputs. Re-run after every contract change.
7. **Final dual-authoring evidence:** `strip-expect --from specs/fixtures/cases --out specs/changes/oracle-b` (skips generated), reuse step-3c predictions for unchanged cases, predict the rest, then `diff-expect --a specs/fixtures/cases --b specs/changes/oracle-b --label final` → zero gaps.
8. **UI projects:** frozen `specs/fixtures/ui/playwright.config.ts` + black-box specs selecting only by `data-testid`, role + name, or copy-table text (UI-3). First `node specs/.sdd/scripts/ui-specgen.cjs`: one generated smoke test per captured screen state (`specs/wireframes/*.capture.json` from Stage 03 — navigate as captured, every recorded test id present, `observe` for `diff-ui`), the floor of UI-4 coverage; then hand-written tests for every §14.3 interaction, with `// covers:` comments and `observe(page, name)` (`oracle-standard.md` §UI specs). Run against the prototype; triage failures like step 4. The generated file is regenerated, never edited.
9. **Library projects:** JSON-in/JSON-out adapter in `specs/fixtures/adapters/`, calling only the public API in `api.d.ts`.
10. **Iterations (frozen project):** ⊥ delete, loosen or re-expect an existing case unless a DECISION_LOG entry of this iteration names it as a behavior change; list every changed/removed id in `specs/phase-integrity-check.md`. Existing cases are the regression oracle.

## Part B — Implementation phases (`specs/IMPLEMENTATION_PHASES.md`)
1. Dependency-ordered phases: infrastructure & storage first, UIs last; ∀ endpoint | component | API states its data source.
2. ∀ non-probe case has `phase: N`; the phase's verification is `node specs/.sdd/scripts/oracle.cjs run --phase N` (cumulative). "Verify it works" | builder tests as verification = FORBIDDEN.
3. Append new phases, tasks unchecked (`- [ ]`); format:
```markdown
## Phase 1: [Name]
- [ ] Task 1: Scaffolding / Schema migration
- [ ] **Verification:** `node specs/.sdd/scripts/oracle.cjs run --phase 1`
```

## Part C — Integrity checks (`specs/phase-integrity-check.md`; reason per item, tick only when proven)
1. `node specs/.sdd/scripts/sdd.cjs check` passes (schemas, cross-refs, phase binding, coverage of every `op:…:status`, transition, illegal transition, invariant, error code, exit code; unpinned response fields → missing assertion or a §9/`variablePaths` freedom). Paste the output.
2. Phase dependencies acyclic; nothing references a component of a later phase.
3. Phases > 8 items split; 1-item phases merged.
4. UI: every frontend phase starts with "Read `specs/DESIGN.md` tokens for [component]"; every new component/state/layout exists in the wireframes with its `data-testid`.
5. Matcher audit: every `$type`/`$regex`/`$any`/`$oneOf` and every `bodyMatch: subset` justified by SPEC §9 or by another case pinning the full shape; else exact literals.
6. Iterations: changed-case ledger ↔ DECISION_LOG entries.

## Part D — Freeze
Optional `specs/CODING_STANDARDS.md` (builder conventions, frozen with the rest; ⊥ observable behavior in it).

**⛔ GATE (user approval):** present case counts (domain vs generated), the coverage line, declared degrees of freedom (`variablePaths` + matchers), `GAPS.md` (zero open; every deferred row with its DECnnn), changed cases (iterations). On explicit approval:
```bash
node specs/.sdd/scripts/sdd.cjs freeze --reason "<Initial freeze | Class 1: feature X>" --approved-by "<user's name>"
```

## Outputs
- `specs/fixtures/oracle.config.json`, `cases/*.json` (domain + `generated-profile*.json`), `seed/*`; `ui/*.spec.ts` (UI); `adapters/*` (library)
- `specs/changes/oracle/` (working files), `specs/IMPLEMENTATION_PHASES.md`, `specs/phase-integrity-check.md`, `specs/logs/04-spec-gaps.md`, `specs/GAPS.md` (all closed or deferred)
- `specs/spec.lock.json`, `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 04` (refuses unless Stage 03 was completed (or skipped by `--override DECnnn`), `check` passes, the phases file and a fresh `phase-integrity-check.md` exist, `GAPS.md` has no open row, a fresh zero-gap `diff-expect` covers the current `specs/fixtures/cases`, every generated case passed a fresh run against the prototype on these exact fixtures, and the lock is intact). Projects already in Stage 04 when upgraded (no prototype stage): record the decision in DECISION_LOG, pass `--override DECnnn`.
2. **Handoff:** `05_development_swarm` — build A continues from the prototype; build B (L2) starts from `sdd.cjs export` in a fresh session.
