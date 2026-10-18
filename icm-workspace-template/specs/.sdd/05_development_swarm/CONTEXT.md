<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 05: Spec-Only Development Swarm

Builder vs. Critic loop during implementation. The builder's mandate is narrow: make the frozen oracle pass using only the frozen spec set. Equivalence follows from that narrowness — a second builder with the same files must be able to reach the same observations without anything this builder knew from elsewhere.

**The oracle is the inner loop.** Per phase: Decision Inventory → build → `oracle.cjs run --phase N` until green → one Red Team pass limited to what the oracle cannot observe. Claiming a phase done without the green run pasted in the log = severe failure.

> [!NOTE]
> **Build A continues the prototype.** The code accepted in Stage 03p is build A's starting point — it is not thrown away. From the freeze on, every change to build A ! be driven by a failing oracle case or a cited Decision Inventory entry; prototype behavior with no citation is either pinned by the frozen set (keep) or a gap (SCR). **Build B is always spec-only**: it starts from `sdd.cjs export` and never sees the prototype. That is why only L2 certifies that the spec — not the prototype — determines the observations.

## Inputs (the ONLY inputs)
- Layer 4 (frozen): `specs/SPEC.md`, `specs/DESIGN.md` (UI), `specs/contracts/*`, `specs/fixtures/*`, `specs/wireframes/*.html` (UI)
- Layer 4 (frozen): `specs/CODING_STANDARDS.md` (if exists — internal conventions only; frozen so every builder sees the same file)
- Layer 4 (working): `specs/IMPLEMENTATION_PHASES.md`
- Layer 3 (reference): `../_config/role-standards.md`, `../_config/iteration-log-format.md`, `../_config/references/systems-standards.md`

## Process

### ⛔ GATE: Spec-Only Context
- Run Stage 05 in a fresh session | sub-agent. ⊥ read Stage 01–04 conversation history, `specs/logs/` (swarm, gap and prototype logs), `specs/DECISION_LOG.md` rationale, or any other implementation of this spec. Those carry information outside the frozen set that a second builder would not have.
- Build A exceptions (exactly two): build A MAY read its own codebase (the accepted 03p prototype it continues), and it MAY copy `specs/logs/03p-decisions.md` as the starting point of its Decision Inventory — that file holds only citations into frozen files, each re-verified against the frozen set before use (line numbers move at freeze). Nothing else under `specs/logs/`, and never the prototype conversation. The code is a starting point, not a source of truth — the frozen set is.
- Need a fact the frozen set does not state (a value, an ordering, a message, an edge case) → **spec gap**. ⊥ guess, ⊥ pick "the obvious" option. Draft `specs/changes/SCR-NNN.md` (Stage 00 format, class C) and stop work on that item. Work on unaffected items may continue.
- Believe an oracle case is wrong → same route (class B). The case stays as-is until the user approves the SCR.

### ⛔ IMMUTABLE GATE (Anti-Tampering)
- Builder ⊥ modify, add or delete any file in the frozen set (`specs/SPEC.md`, `specs/DESIGN.md`, `specs/CODING_STANDARDS.md`, `specs/contracts/`, `specs/fixtures/`, `specs/wireframes/`, `specs/.sdd/`). Relaxing an assertion, skipping a case or altering an expected payload = AUTOMATIC PROCESS FAILURE. If a case fails, the CODE is defective, not the case — unless an approved SCR says otherwise.
- `node specs/.sdd/scripts/sdd.cjs verify` ! pass before starting and after finishing every phase. Failing → stop, report which frozen files changed, restore them (`git checkout -- <file>`).
- Files Stage 05 may write under `specs/`: checkboxes in `IMPLEMENTATION_PHASES.md`, `dev-swarm-reconciliation.md`, `logs/**`, `changes/SCR-*` drafts.

### Implementation Swarm (Blue Team)
Roles: Infrastructure, Backend, Security, Frontend, Writer.
∃ role standards → read `../_config/role-standards.md`.
∃ project standards → read `specs/CODING_STANDARDS.md`.
Analyze project stack → instantiate additional specialist roles as needed.

*∀ Builders SHOULD query Context7 MCP server before writing code → ensure syntax matches latest framework versions. ⊥ Context7 → use web search | training knowledge, but note "docs not verified against latest version" ∈ iteration log.*

### Validation Swarm (Red Team)
Once per phase, after the oracle is green, review what the oracle cannot observe:
Roles: Penetration Tester, Chaos Engineer, Resource Starver, Compliance Enforcer, DX Auditor, Architect (Spec Enforcer), Visual QA Tester, Design Token Auditor.
Instantiate by project type: Visual QA Tester and Design Token Auditor only when `manifest.interfaces` includes `browser`; Resource Starver and Chaos Engineer only for services and fullstack apps (`cli-tool` and `library` get the Architect, Compliance Enforcer and DX Auditor). The Red Team never re-grades what the oracle already proved: its scope is security, resource bounds, orphan code, dependency justification, token use in UI, and spec clauses no case observes.
∃ role standards → read `../_config/role-standards.md`.

### Pipeline Rules (∀ roles)

#### Build Rules
- **Oracle Fulfillment:** the build is done when `oracle.cjs run` passes 100% against the current lock (plus the frozen UI specs for browser projects). Nothing else is acceptance evidence.
- **Internal tests:** builders MAY write unit/integration tests outside `specs/` for their own feedback. They never replace, extend or count as oracle evidence.
- **Graded configuration:** start the build for every oracle run with the frozen build environment: `eval "$(node specs/.sdd/scripts/oracle.cjs env)"` before the start command. Defaults that differ from it are fine for development, never for evidence.
- **Observable environment:** runtime, database engine/version, collation and timezone ! match SPEC §10. Internal structure (modules, folders, helper libraries) is the builder's choice unless SPEC pins it; list every new runtime dependency with a one-line justification in the reconciliation.
- **Equivalence Profile:** ∀ behavior SPEC does not override follows `../_config/references/systems-standards.md` exactly (envelope, statuses, evaluation order, formats). The profile is part of the spec.
- **Docker (backend-service, fullstack-app):** ! generate `.dockerignore` when `Dockerfile` created | modified.
- **Failure Routing (Backprop):** unresolvable spec defect → Stage 00 via SCR draft. ⊥ patch code around a spec defect.

#### Design Token Mandate (UI + ∃ `specs/DESIGN.md`)
- Before generating a frontend component, ! read `specs/DESIGN.md` & extract YAML tokens.
- ∀ color/font/spacing/border-radius values ! reference tokens. Hardcoded values that ∃ as DESIGN.md tokens = automatic FAIL.
- Component names ! match DESIGN.md `components:`; `data-testid`s, copy text and state ids ! match the wireframes and SPEC §14 exactly (profile UI-1…UI-4).

#### Verification Rules
- ⊥ PASS on `200 OK` | code inspection alone. ! run `oracle.cjs run --phase N` + include terminal output ∈ iteration log.
- **TypeScript:** ! execute `tsc --noEmit` & verify zero errors. Bundler build ⊥ sufficient.
- **Headless Mock Caveat:** mocked unit tests ⊥ evidence for integration | contract behavior. The oracle runs against the real runtime and storage.

#### Spec & Contract Enforcement
- Architect ! cross-ref code vs `specs/SPEC.md`, `specs/contracts/`, and `specs/IMPLEMENTATION_PHASES.md`.
- ∀ API endpoints match `specs/contracts/openapi.yaml` schemas, headers, status codes.
- ∀ database queries match `specs/contracts/schema.sql` columns, indices, OCC `version` handling.
- **Orphan Check:** ∀ helper/utility created → verify imported & called ∈ main entry files. Module only imported ∈ unit tests = FAIL.

#### Visual Smoke Check (∃ UI)
- Screenshot each screen touched by the phase; verify components present/visible/interactive. ⊥ PASS based on code inspection alone. The formal visual gate is Stage 06.

### Anti-Simulation Enforcement

#### Mandatory Visible Iteration Logs
<format_enforcement>
⊥ claim "internally looped" (all iterations inside one hidden thought block with only the final output shown). Execute iterations sequentially without stopping for user input (unless a spec gap or user guidance is required). Write each iteration log in full using the Development Swarm Iteration Log format ∈ `../_config/iteration-log-format.md` and append it to `specs/logs/05-swarm.md`.

**⛔ GATE:** Missing | summarized iteration log → swarm run invalid.
</format_enforcement>

#### Mandatory Empirical Evidence
A phase ⊥ PASS based on inspection alone. The green `oracle.cjs run --phase N` output (and build/typecheck output) ! be pasted ∈ the Iteration Log; the Red Team table follows it. A phase whose log lacks the pasted run is not done.

> [!NOTE]
> **Iterative Execution:** Only execute the new unchecked phases (`- [ ]`) in `specs/IMPLEMENTATION_PHASES.md`. Skip phases marked completed (`- [x]`). `--phase N` is cumulative, so earlier phases keep being re-graded as regressions.
> **Class 0 changes** (refactor, dependency bump): no new phases; the full oracle ! stay green and `sdd.cjs verify` ! pass unchanged.

> [!TIP]
> **Lockstep build B (recommended for L2):** start the independent build early instead of at Stage 07. `sdd.cjs export ../<project>-eqb` after the freeze; a fresh session builds there phase by phase. After each phase, both builds green: `node specs/.sdd/scripts/oracle.cjs diff --phase N --b-root ../<project>-eqb` — a filtered diff is an early warning, not evidence. Divergences found while little code depends on them are cheap: route them to Stage 00 here, re-freeze, then `sdd.cjs export ../<project>-eqb --update` (keeps B's code and progress, refreshes its frozen files).

### Oracle-Driven Implementation Loop
Execute this exact sequence ∀ phase (one phase at a time, in `IMPLEMENTATION_PHASES.md` order):

- **Continuous Session Execution**: User explicitly requests "run continuously" | "finish development" → agent ! proceed through ∀ phases sequentially. ⊥ pause | return to user after a single phase. Loop next phases via tool calls.

0. **Pre-Flight:** `sdd.cjs verify` passes. ∃ Context7 MCP → invoke its resolving tools; ⊥ Context7 → web search | training knowledge. Log documentation source.
1. **Decision Inventory (before any code):** list every observable decision the phase requires — each status, header, field value, ordering, message, default, limit — and cite the frozen file line that pins it, in `specs/logs/05-decisions.md`. A decision you cannot cite = spec gap → SCR draft now, not after the code exists. This is the builder-side interpretation check: it catches the gaps a second builder would fill differently. Build A MAY start from `specs/logs/03p-decisions.md` (copy rows, re-verify each citation against the frozen files); build B writes its own from scratch.
2. **Build (Blue Team):** the appropriate Builders write the phase's files against the inventory and the frozen contracts.
3. **Oracle loop:** `node specs/.sdd/scripts/oracle.cjs run --phase N` (browser-only phases: the frozen UI suite, `oracle-standard.md` §UI specs) → fix the CODE for every failure → re-run, until 0 failed, 0 errored. A failing case you believe is wrong → SCR draft (class B); the case stays. **Hard Limit:** 5 oracle rounds per phase without reaching green → halt & ask the user.
4. **Red Team pass (once, after green):** Critics review the phase's code for what the oracle cannot observe (§Validation Swarm). Every finding → fixed and the oracle re-run (step 3), or → SCR draft when it exposes a spec gap. Findings about behavior the oracle already grades are out of scope: the oracle decided.
5. **Phase gate:** oracle green on the final code; `sdd.cjs verify` passes; the iteration log (format: `../_config/iteration-log-format.md` §Development Swarm) holds the pasted green run and the Red Team table; tick the phase's boxes.
6. **Document & Run:** single-command start (`docker-compose up -d` for services; the documented command otherwise). DX Auditor verifies. Technical Writer updates `README.md`.

### Post-Implementation Reconciliation (CRITICAL)
After ALL phases complete & verified, Architect ! execute full reconciliation:

**⛔ GATE:** ! create tracking artifact `specs/dev-swarm-reconciliation.md`. Evaluate cross-refs sequentially, write findings ∀ bullet, check box only when proven. Rubber-stamping = process violation.

**What to check:** Re-read `specs/SPEC.md` and `specs/contracts/*`, cross-ref vs created/modified files:
- ∀ API endpoint field names, query params, headers match `specs/contracts/openapi.yaml`.
- ∀ DB migrations match `specs/contracts/schema.sql`.
- ∀ components in Frontend Hierarchy exist as actual files, with their `data-testid`s.
- ∀ env vars in SPEC §12 actually referenced in code.
- New runtime dependencies listed with justification.
- Full `oracle.cjs run` (no filters) passes; output pasted.

**Drift found:** code differs from spec → fix the CODE. The spec seems wrong or incomplete → SCR draft → Stage 00. ⊥ edit `SPEC.md` or any contract to match the code — that is the builder grading itself.

**⛔ GATE:** ⊥ proceed until reconciliation = ZERO ❌ drift entries.

### Handoff / Transitions
1. **Final evidence:** `node specs/.sdd/scripts/oracle.cjs run` (unfiltered) → 100% green; UI projects also write `specs/logs/ui-e2e.json` (see `oracle-standard.md` §UI specs).
2. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 05` (refuses unless the lock is intact, the latest unfiltered oracle run against this lock is green, and reconciliation has zero ❌).
3. **Handoff:** UI project → prompt `06_visual_acceptance_testing`. Otherwise → `07_verification_before_completion` (the transition skips 06 automatically).

## Outputs
- Codebase files
- `specs/dev-swarm-reconciliation.md`
- `specs/logs/05-swarm.md`, `specs/logs/oracle/run-*.json`
- `specs/changes/SCR-*.md` drafts (if gaps were found)
- `README.md`
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)
