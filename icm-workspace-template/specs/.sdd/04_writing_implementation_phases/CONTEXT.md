<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 04: Oracle Synthesis, Implementation Phases & Freeze

Critical governance bridge. Converts the hardened spec into (1) the **Immutable Test Oracle** (`specs/fixtures/`) every build is graded by, (2) a sequenced build checklist (`IMPLEMENTATION_PHASES.md`), and (3) the **freeze**: a user-approved lock over the whole frozen set.

**Two interpretations per oracle value.** Every expected value is checked by two independent readings of the spec: the accepted prototype (Stage 03p) and a spec-only author. The prototype's reading is free — it is recorded or run, not written — so LLM authoring is spent only where judgment is needed.

**⊥ write implementation code while this stage is active** (prototype fixes found by the oracle are the exception, see Part A step 3). Oracle cases, seed data, the oracle config, generators, UI specs and (library projects) the oracle adapter are test artifacts, not implementation, and are written here.

## Inputs
- Layer 4 (working): `specs/SPEC.md`, `specs/contracts/*`, `specs/DECISION_LOG.md`, `specs/GAPS.md`
- Layer 4 (working): `specs/logs/02-swarm.md` — the Outcome Table only (the list of outcomes to cover; ⊥ treat its discussion as spec). Adoption option C: the reviewed characterization cases from Stage 01b take its place.
- Layer 4 (working): the running prototype — start it with the `Run:` line in `specs/logs/03p-prototype.md`; `specs/logs/03p-decisions.md` (which prototype decisions are pinned, and by what)
- Layer 4 (working): `specs/DESIGN.md`, `specs/wireframes/*.html` (UI projects)
- Layer 3 (reference): `../_config/references/oracle-standard.md` (format, matchers, coverage, probes)
- Layer 3 (reference): `../_config/schemas/oracle-cases.schema.json`, `../_config/schemas/oracle-config.schema.json`
- Layer 3 (reference): `../_config/references/systems-standards.md` (profile rules cited in `derivedFrom`)
- Layer 3 (reference): `../_config/examples/notes-service/specs/fixtures/` (reference oracle: exact problem bodies, idempotency, OCC, concurrency, pagination)

## Process

### Part A — Oracle Synthesis (`specs/fixtures/`)

**Independence:** the spec-only author (step 3c) works in a fresh session or sub-agent whose only inputs are the request skeletons, `SPEC.md`, `contracts/` and the Equivalence Profile — ⊥ the prototype's source, its recordings, `specs/logs/`, or this conversation. An author who has seen the prototype confirms it instead of checking it.

1. **Configure** `specs/fixtures/oracle.config.json`: targets `default` (the prototype, then build A), `a`, `b` (machine-specific values via `${ENV}`), `reset` hook + seed data in `specs/fixtures/seed/`, `adapters.sql` (if cases assert storage), readiness probe, `variablePaths` mirroring SPEC §9, `buildEnv` with the SPEC §12 values every graded build starts with (ENV-3). Start the prototype with that `buildEnv`.
2. **Request design:** ∀ Outcome Table row (∀ operation | command | transition, every outcome) → a request-only case (setup steps + the request, no `expect`, neutral title) in `specs/changes/oracle/requests/`. Concurrency cases use `parallel` steps with the ENV-5 delay frozen in `buildEnv`.
3. **Domain cases** (anything whose expectation needs SPEC.md):
   a. **Interpretation A — record:** `node specs/.sdd/scripts/oracle.cjs record --target default --cases-dir specs/changes/oracle/requests --out specs/changes/oracle/recorded.json`.
   b. **Review A:** replace accidental literals (ids, timestamps the generalizer missed) with matchers; add SPEC/contract/profile citations to every case's `derivedFrom`. `recorded:…` alone is not a citation — `diff-expect` reports it as a gap. A recorded value no citation supports is a prototype bug (fix the prototype, re-record) or a spec gap (step 5).
   c. **Interpretation B — predict:** `node specs/.sdd/scripts/oracle.cjs strip-expect --from specs/changes/oracle/recorded.json --out specs/changes/oracle/b`; the spec-only author fills `expect` + `derivedFrom` in place, writing `{"$unspecified": "<what is missing>"}` where the spec does not decide.
   d. **Compare:** `node specs/.sdd/scripts/oracle.cjs diff-expect --a specs/changes/oracle/recorded.json --b specs/changes/oracle/b --label domain`. ∀ gap → the spec decides: the spec states the value → prototype bug, fix and re-record; the spec does not → spec gap (step 5). ⊥ resolve a gap by picking one side.
   e. Move the agreed cases into `specs/fixtures/cases/` (add `phase`).
4. **Profile-family cases** (idempotency, OCC, pagination, validation order, evaluation-order precedence, null/whitespace round-trips — the mandatory families in `oracle-standard.md`):
   - Write a generator script (`specs/changes/oracle/tools/gen-profile.cjs`) that derives full cases — expectations included — from the contracts and the profile rules, into `specs/fixtures/cases/generated-profile*.json`. Tag every case `"tags": ["generated"]` and cite only `profile XXX-n` rules and contracts in `derivedFrom`. A case that needs a SPEC.md citation is a domain case (step 3), never generated.
   - **Second interpretation:** `node specs/.sdd/scripts/oracle.cjs run --target default` against the prototype. Every generated case ! pass. Each failure → triage: generator bug (fix the generator, regenerate) | prototype bug (fix the prototype, or drop the `generated` tag so the case goes through step 3c) | spec gap (step 5). The Stage 04 gate checks this run against the exact current fixtures.
   - `diff-expect` and `strip-expect` skip qualifying generated cases automatically.
5. **⛔ GATE (Derivability):** an expected value that cannot be cited from SPEC, contracts or the profile = spec gap. ⊥ invent it. Log it in `specs/logs/04-spec-gaps.md` and as a `specs/GAPS.md` row (kind `oracle`); route technical gaps through Stage 02 rules and policy gaps to the user, update the spec, then re-run the affected steps. Before the first freeze these spec edits need no SCR — ⊥ batch them into SCRs; the user approves the result once, at freeze. After a freeze they are part of the Class 1 iteration.
6. **Probes:** run `node specs/.sdd/scripts/oracle.cjs gen-probes` (http projects) to derive edge-case probes from the contracts, then add hand-written probes (`"probe": true`) for domain-specific edge inputs. Probes power `oracle diff`; re-run `gen-probes` whenever the contracts change.
7. **Final dual-authoring evidence:** the gate needs a `diff-expect` whose A is exactly `specs/fixtures/cases`: `node specs/.sdd/scripts/oracle.cjs strip-expect --from specs/fixtures/cases --out specs/changes/oracle-b` (skips generated cases), reuse the step-3c predictions for unchanged cases, predict the rest, then `node specs/.sdd/scripts/oracle.cjs diff-expect --a specs/fixtures/cases --b specs/changes/oracle-b --label final` ! report zero gaps.
8. **UI projects:** a frozen `specs/fixtures/ui/playwright.config.ts` plus black-box Playwright specs selecting only by `data-testid`, role + accessible name, or copy-table text (profile UI-3). ∀ UI State Matrix state & ∀ interaction ≥ 1 test, coverage declared with `// covers:` comments, `observe(page, name)` calls at every screen/state for `diff-ui` (`oracle-standard.md` §UI specs). Run them against the prototype: a failure is triaged like step 4.
9. **Library projects:** a minimal JSON-in/JSON-out adapter in `specs/fixtures/adapters/`, invoked by `run` steps. It may call only the public API in `api.d.ts`.
10. **Iterative cycle (Class 1 change on a frozen project):** ⊥ delete, loosen (exact → subset, literal → matcher) or re-expect an existing case unless a DECISION_LOG entry from this iteration declares that behavior change. List every changed or removed case id in `specs/phase-integrity-check.md`. Existing cases are the regression oracle that keeps old behavior equivalent.

### Part B — Implementation Phases

1. **Deconstruct into Phases:** Break system → logical, dependency-ordered phases.
   - Infrastructure & storage schemas = always Phase 1 & 2. Frontend UIs = always final phases.
   - **Data-Flow Traceability:** ∀ REST endpoint | UI component | API ∈ checklist ! explicitly state data source.
2. **Bind every phase to the oracle:** ∀ non-probe case has `phase: N`; the phase's verification is `node specs/.sdd/scripts/oracle.cjs run --phase N` (cumulative: runs phases ≤ N). "Verify it works" | builder-written tests as phase verification = STRICTLY FORBIDDEN.
3. **Write Checklist:** Append new phase(s) to `specs/IMPLEMENTATION_PHASES.md`. Keep new tasks sequenced & unchecked (`- [ ]`).

### Part C — Integrity Checks

**⛔ GATE:** ! create tracking artifact `specs/phase-integrity-check.md`. ! evaluate steps sequentially, write reasoning, check box only when proven.

1. **Machine check:** `node specs/.sdd/scripts/sdd.cjs check` → ! pass. It enforces case schema validity, cross-references, phase binding, and coverage of every `op:<operationId>:<status>`, transition, illegal transition, invariant, error code and CLI exit code. It also reports response fields no case ever pins to a literal value — treat each as either a missing assertion or a degree of freedom to declare in SPEC §9 / `variablePaths`. Paste the output.
2. **Dependency Ordering:** ∀ phase → list dependencies. Verify acyclic graph. Flag any phase referencing a component not built in a prior phase.
3. **Phase Size Check:** Phase with >8 items → split. Phase with 1 item → merge into adjacent.
4. **DESIGN.md Cross-Ref (UI):** ∃ `specs/DESIGN.md` → ∀ phase creating a frontend component ! include "Read `specs/DESIGN.md` tokens for [component]" as first item.
5. **Wireframe Sync Check (UI):** ∃ `specs/wireframes/*.html` → verify ∀ new UI components, states, layouts exist in wireframes with their `data-testid`s.
6. **Matcher Audit:** ∀ variable matcher (`$type`, `$regex`, `$any`, `$oneOf`) and ∀ `bodyMatch: subset` → justify against SPEC §9 or another case that pins the full shape. Unjustified → replace with exact literals.
7. **Changed-case ledger (iterations only):** every changed/removed existing case ↔ its DECISION_LOG entry.

### Part D — Freeze

**Builder conventions:** if the project wants internal coding conventions for builders, write `specs/CODING_STANDARDS.md` now — it is frozen with the rest, so every builder sees the same file. ⊥ put observable behavior in it.

**⛔ GATE (User approval):** present the oracle summary — case count per suite (domain vs generated), the coverage line from `sdd.cjs check`, declared degrees of freedom (`variablePaths` + variable matchers), `GAPS.md` (zero open; every deferred row with its DECnnn), and changed cases (iterations) — and ask the user to approve the freeze. On explicit approval:

```bash
node specs/.sdd/scripts/sdd.cjs freeze --reason "<Initial freeze | Class 1: feature X>" --approved-by "<user's name>"
```

`freeze` refuses unless `sdd.cjs check` passes. From now on the frozen set changes only through a Class 1 iteration or a Stage 00 SCR.

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 04` (refuses unless Stage 03p — and Stage 03 for UI projects — was completed this iteration or skipped by `--override DECnnn`, check passes, the phases file exists, `phase-integrity-check.md` was written this stage, `GAPS.md` has no open row, a fresh zero-gap `diff-expect` covers the current `specs/fixtures/cases`, every generated profile case passed a fresh run against the prototype on these exact fixtures, and the lock is intact).
   Projects already in Stage 04 when this template was upgraded (no 03p): record the user's decision in DECISION_LOG and pass `--override DECnnn`.
2. **Handoff:** Prompt user to proceed to `05_development_swarm`: build A continues from the prototype; build B (L2) starts from `sdd.cjs export` in a fresh session, per Stage 05's spec-only rule.

### Document Format (`specs/IMPLEMENTATION_PHASES.md`)
```markdown
# Implementation Phases
*Derived from specs/SPEC.md and specs/contracts/*

## Phase 1: [Name]
- [ ] Task 1: Scaffolding / Schema migration
- [ ] Task 2: Service / Repository implementation
- [ ] **Verification:** `node specs/.sdd/scripts/oracle.cjs run --phase 1`

## Phase 2: [Name]
...
```

## Outputs
- `specs/fixtures/oracle.config.json`, `specs/fixtures/cases/*.json` (domain + `generated-profile*.json`), `specs/fixtures/seed/*`
- `specs/fixtures/ui/*.spec.ts` (UI) · `specs/fixtures/adapters/*` (library)
- `specs/changes/oracle/` (requests, recordings, predictions, generator — working files)
- `specs/IMPLEMENTATION_PHASES.md`
- `specs/phase-integrity-check.md`, `specs/logs/04-spec-gaps.md`, `specs/GAPS.md` (all rows closed or deferred)
- `specs/spec.lock.json` (freeze)
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)
