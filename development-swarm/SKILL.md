---
name: development-swarm
description: "Execute a Builder vs. Critic loop that implements the frozen spec phase by phase, graded only by the frozen oracle, with one green, committed phase at a time and spec gaps routed to Stage 00 instead of guessed."
---

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | § = section ref | & = and | | = or -->

# Spec-Only Development Swarm (SDD Stage 05)

**Authority:** ∃ `specs/.sdd/05_development_swarm/CONTEXT.md` in the project → that file is the stage contract; follow it and run its `sdd.cjs` / `oracle.cjs` commands. This skill is its portable summary. The two ! say the same thing — `scripts/validate-icm-sync.sh` checks the anchors.

Builder's mandate is narrow: make the frozen oracle pass using only the frozen spec set. A second builder with the same files must reach the same observations.

**! execute the attack-and-refine loop until the Red Team finds zero findings with terminal evidence. Stopping after a single unverified pass = severe failure.**

## Inputs (the ONLY inputs)
`specs/SPEC.md`, `specs/DESIGN.md` (UI), `specs/contracts/*`, `specs/fixtures/*` (the oracle), `specs/wireframes/*` (UI), `specs/CODING_STANDARDS.md` (∃), `specs/IMPLEMENTATION_PHASES.md`. ⊥ Stage 01–04 conversation, swarm logs, decision-log rationale, other implementations.

## Gates

### ⛔ Spec gaps & disputed cases
Need a fact the frozen set does not state → spec gap. ⊥ guess. Draft `specs/changes/SCR-NNN.md` (`| Status | Draft |`), stop that item. Other tasks inside the current phase may continue; the next phase may not start. Case looks wrong → same route; the case stays until the user approves the SCR.

### ⛔ Anti-Tampering
⊥ modify the frozen set (spec, design, contracts, fixtures, wireframes, pipeline). A failing case means the CODE is defective unless an approved SCR says otherwise. `sdd.cjs verify` before and after every phase.

### ⛔ Phase Boundary
A phase is **done** only when: wired into the running system → committed alone (no later-phase files) → `oracle.cjs run --phase N` on that commit 0 failed / 0 errored (cumulative) → `sdd.cjs phase --completed N` passes (lock intact, graded tree = clean HEAD, earlier phases gated, no open SCR). Then tick its boxes.
⊥ write phase N+1 files while phase N is red or any SCR is open. Suite-local greens ⊥ tick a cumulative box.

**Status block** in every user-facing update: last green phase + commit, open phase, open SCR ids, whether the tree holds uncommitted work (`sdd.cjs status` → `build:` line). ⊥ answer "is it ready?" from memory.

## Implementation Swarm (Blue Team)
Roles: Infrastructure, Backend, Security, Frontend, Writer.
∃ role standards → read [role-standards.md](file://{{SKILLS_DIR}}/shared/role-standards.md). ∃ `specs/CODING_STANDARDS.md` → read it.
Analyze project stack → instantiate additional specialist roles as needed.

*∀ Builders SHOULD query Context7 MCP before writing code. ⊥ Context7 → web search | training knowledge, note "docs not verified against latest version" ∈ iteration log.*

## Validation Swarm (Red Team)
After Blue Team drafts code, adopt attack roles *before* saving:
Roles: Penetration Tester, Chaos Engineer, Resource Starver, Compliance Enforcer, DX Auditor, Architect (Spec Enforcer), Visual QA Tester, Design Token Auditor.
∃ role standards → read [role-standards.md](file://{{SKILLS_DIR}}/shared/role-standards.md).

## Pipeline Rules (∀ roles)

### Build Rules
- **Oracle = acceptance.** Done = `oracle.cjs run` 100% against the current lock (+ frozen UI specs for browser projects). Nothing else is acceptance evidence.
- **Internal tests** (`test-driven-development` skill) are allowed outside `specs/` as builder feedback. They never replace, extend or count as oracle evidence.
- **Graded configuration:** `eval "$(node specs/.sdd/scripts/oracle.cjs env)"` before starting the build for any graded run.
- **Runtime by path:** every command & subagent brief invokes the runtime SPEC §10 names by exact binary (e.g. Node 22's `node`/`npx`), not whatever is first on `PATH`. Paste `--version` per phase.
- **Docker:** ! `.dockerignore` when `Dockerfile` created | modified. **K8s:** ∃ manifests → `kubernetes-deployment` skill.
- **Failure routing:** spec defect → SCR → Stage 00. ⊥ patch code around it.

### Parallel builders
- **Shared kernel first:** compile/start, body parsing, empty (204) responses + headers, session/auth graded green (phase 1 gate) before any parallel author starts.
- **One module per builder** after that; parent owns shared files (entry point, router), the oracle run, the phase gate, the commit. Shared file → serial.
- **Brief:** named inputs, timebox + stop-and-report, WIP commits on a branch, script edits for large files, fallback model; ⊥ relaunch the same brief. Success = files written + gaps listed. Skipping a numbered SPEC procedure step ≠ success even if it typechecks. Procedures Stage 02 rewrote as one sequence → stronger model or planned second pass.

### Design Token Mandate (UI + ∃ `specs/DESIGN.md`)
- Read DESIGN.md tokens before generating a component. Hardcoded values that ∃ as tokens = automatic FAIL.
- Component names = DESIGN.md `components:`; `data-testid`s, copy text, state ids = wireframes & SPEC §14 exactly.

### Verification Rules
- ⊥ PASS on `200 OK` | code inspection. ! run `oracle.cjs run --phase N`, paste output ∈ iteration log.
- **TypeScript:** `tsc --noEmit` zero errors; bundler build ⊥ sufficient.
- **Mocks** ⊥ evidence for integration | contract behavior.
- **UI:** screenshot each touched screen (smoke); formal visual gate = Stage 06 (`visual-acceptance-testing`). Specs tagged `@keyboard`/`@focus` → repeated run (`--repeat-each=20`) before the stage closes.

### Spec & Contract Enforcement
- Architect cross-refs code vs SPEC, contracts, phases. ∀ endpoint ↔ `openapi.yaml`; ∀ query ↔ `schema.sql`.
- **Orphan Check:** helper only imported ∈ tests = FAIL.

## Anti-Simulation Enforcement
<format_enforcement>
⊥ claim "internally looped" | "simulated Red Team." Write each iteration in full, Development Swarm format ∈ [iteration-log-format.md](file://{{SKILLS_DIR}}/shared/iteration-log-format.md), to `specs/logs/05-swarm.md`.

**⛔ GATE:** Missing | summarized iteration log → swarm run invalid.
</format_enforcement>

Red Team ⊥ PASS on inspection alone; ! terminal output. A first-draft PASS is allowed only with that evidence.

## Implementation Loop
**⛔ GATE: One File at a Time (per builder):** ⊥ build an entire phase ∈ one loop. Select one file → Draft → Attack → Refine until PASS → write → next file.
- **Continuous execution** ("run continuously" | "finish development") → ⊥ pause between files or between gated phases. ⊥ override a **hard stop**: open SCR, refused phase gate, red oracle run, 5-iteration cap, policy question, broken lock. At a hard stop → commit WIP on the branch, post the status block, stop.

0. **Pre-Flight:** `sdd.cjs verify`; Context7 (∃); log documentation source.
0b. **Decision Inventory (once per phase):** list every observable decision the phase needs, cite the frozen line → `specs/logs/05-decisions.md`. Uncitable → SCR now.
1. **Draft (Blue Team).**
2. **Attack (Red Team)** vs contracts, profile, edge cases, security.
3. **Refine (Blue Team).** Surgical edits; ⊥ rewrite a whole file to fix a few lines.
4. **Verify:** repeat 1–3 until PASS with zero findings + evidence. **Hard Limit:** Max 5 iterations per component; still failing → halt & ask user.
5. **Phase gate:** commit phase alone → `oracle.cjs run --phase N` → `sdd.cjs phase --completed N && <tick boxes>`.
6. **Document & Run:** single-command start; DX Auditor verifies; Technical Writer updates `README.md`.

## Post-Implementation Reconciliation
After ALL phases gated, Architect writes `specs/dev-swarm-reconciliation.md` (table with a `Drift` column, ✅ | ❌ per row): endpoints ↔ openapi, migrations ↔ schema, hierarchy components ↔ files + test ids, SPEC §12 env vars referenced, new runtime deps justified, full unfiltered oracle output pasted.
<anti_hallucination>Fresh file reads; ⊥ "code matches spec" from memory.</anti_hallucination>

**Drift:** code differs → fix the CODE. Spec seems wrong → SCR → Stage 00. ⊥ edit SPEC or contracts to match code — that is the builder grading itself.

**⛔ GATE:** ⊥ proceed until reconciliation = ZERO ❌.

## Handoff
`node specs/.sdd/scripts/sdd.cjs transition --completed 05 && git commit …` — refuses unless lock intact, latest unfiltered oracle run green, every phase gated, no open SCR, (UI) keyboard/focus repeat green, reconciliation zero ❌. ⊥ pipe a gate into `tail`/`head` before `&&`. Then UI → Stage 06, else Stage 07. Invoked by the SDD orchestrator → return control.

## Usage Triggers
User asks "use development swarm" | "build with red team" | "code using swarm loop" → adopt this workflow.
