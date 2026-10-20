---
name: adversarial-swarm-analysis
description: Execute a multi-agent adversarial review (Creator vs Critic) that hardens the spec and compiles typed machine contracts until no two builders could return different observations. Exits on objective criteria, never on an iteration count. Forbids implementation code generation.
---

<!-- CAVEMAN-ENCODED: compressed ~60% vs prose. Decoder key below. -->
<!-- DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | § = section ref | & = and | | = or -->
<!-- PRESERVE VERBATIM: code blocks, paths, URLs, file names, identifiers, JSON/YAML -->

# Adversarial Swarm Analysis (SDD Stage 02)

**Authority:** ∃ `specs/.sdd/02_adversarial_swarm_analysis/CONTEXT.md` in the project → that file is the stage contract; follow it and run its `sdd.cjs` / `oracle.cjs` commands. This skill is its portable summary for agents loading skills globally. The two ! say the same thing — `scripts/validate-icm-sync.sh` checks the anchors.

**⊥ implementation code while skill active. Output = hardened `specs/SPEC.md` + typed machine contracts in `specs/contracts/`.**

## Creator Swarm (Blue Team)
Draft spec AND the contracts the project type needs (`manifest.json`, `openapi.yaml`, `schema.sql`, `statecharts.json`, `errors.json`, type-specific files). Plumbing (errors, ids, pagination, idempotency, concurrency) follows the Equivalence Profile; deviations = documented overrides.
Roles: Core Architect, Security Auditor, AI/MLOps Engineer, Data Specialist, UX/UI Lead, Technical Writer.
Analyze project stack → instantiate additional specialist roles as needed.

## Critic Council (Red Team)
Attack spec prose and contracts:
1. **Contract & Schema Auditor:** Field name/type mismatches between contracts and SPEC. Unpinned types.
2. **Systems Invariant Auditor:** Equivalence Profile compliance (idempotency, OCC, pagination, errors, evaluation order). Every deviation documented as an override.
3. **Fork Tester:** ∀ operation: *"Could two competent builders, reading only these files, return different observations?"* Status, headers, field presence, null vs absent, ordering, rounding, normalization, error precedence. A rule scoped to "this module | project | tenant | owner" stays a fork until an outcome exercises a **sibling container holding colliding data**.
4. **Edge-Case Hunter:** Missing fallback behavior, undefined error paths, unhandled timeouts.
5. **Chaos Engineer:** Ordering, consistency, availability assumptions. Split-brain.
6. **Resource Starver:** Unbounded growth, missing pagination, no retention policy.
7. **Quantifier:** ∀ parameter ! be exact value | bounded range | formula | config ref.
8. **Reconciler:** Cross-ref spec vs codebase & infrastructure (∃). <anti_hallucination>⊥ assume spec correct. ! inspect source files.</anti_hallucination>

## Pipeline Rules

### Technical vs Policy
- **Technical** → Blue Team resolves autonomously via the profile. ⊥ ask the user about status codes, indices, cursors.
- **Policy** (who may, what happens to children, a limit's value, visual design not provided) → ⛔ STOP. Ask the user ONE question, record in `specs/DECISION_LOG.md` + SPEC, resume. ⊥ "sensible default". Existing `specs/DESIGN.md` = source of truth for visuals.

### Completeness Checklist (Step 0c)
Classify project type, apply [completeness-checklist.md](file://{{SKILLS_DIR}}/adversarial-swarm-analysis/references/completeness-checklist.md). ⊥ resolve → inline fallback: architecture, API contracts (∀ status), data models, auth (or "none" + why), error handling ∀ integration, cross-section consistency, UI hierarchy & visual design (UI). Log the fallback.

**⛔ GATE:** draft missing ONE required section | contract → Critic Council rejects entire draft.

### Round budget, API vs UI, delegation (set before round 1)
- **Models:** name primary subagent model + fallback before round 1. Subagent stops without report → fallback model, smaller brief. ⊥ relaunch same brief.
- **Round cap:** milestone date ∃ → record `maxRedTeamRounds: N` (decision log + top of swarm log) before round 1. Cap may waive the confirming clean round only if that entry says so. Interpretation diff, contract check, Outcome Table, self-review never waived.
- **Two counts per round:** `Findings: API <n> · UI <m>`. UI = visible copy, layout, test ids. Behavior behind a screen = API.
- **UI deferral:** after a complete round with API 0, UI-only findings → `specs/logs/02-deferred-ui.md` (`- [ ]`), resolved in Stage 03 wireframing. Behavior & error-code mapping stay here.

### Mandatory Visible Iteration Logs
⊥ claim "internally looped". Execute rounds sequentially without stopping (except policy escalations). Write each in full, [iteration-log-format.md](file://{{SKILLS_DIR}}/shared/iteration-log-format.md), to `specs/logs/02-swarm.md`; chat shows a summary.

**⛔ GATE:** Missing | summarized iteration log → swarm run invalid.

### Exit criteria (objective, all required)
⊥ minimum iteration counts, ⊥ forced failures: a manufactured finding is noise that hides real ones. A first-round PASS backed by the criteria below is a PASS.
1. Contract validation passes (`sdd.cjs check --contracts`, output in final log).
2. A complete round, ALL personas, finds zero new findings (deferred UI-only excluded; cap waiver per decision log).
3. **Outcome Table** complete: ∀ operation | command, every observable outcome with trigger, pinned in contracts.
3b. **Interpretation Diff:** two fresh agents, given ONLY SPEC + contracts + profile, each predict every Outcome Table request with citations (`$unspecified` where undetermined); `oracle.cjs diff-expect` → zero gaps. Gap → fix spec (policy → ask user), re-predict affected cases. ⊥ pick one author's answer. May run beside late rounds; final run after last spec edit.
4. Spec self-review checks pass ([spec-self-review.md](file://{{SKILLS_DIR}}/shared/spec-self-review.md)).
5. Pre-Pass Hardening Checklist in final log: structural, profile compliance, concurrency & tx, resource limits (exact numbers), determinism (SPEC §9 lists every declared freedom, nothing else).

## Iterative Workflow
0. **Pre-Flight Context Map:** frameworks/versions → SPEC §10.
0b. **Codebase Grounding (∃ code):** Reconciler reads existing files before Blue Team drafts. <anti_hallucination>Fresh reads; ⊥ memory.</anti_hallucination>
0c. **Project Type Classification** → `manifest.json`.
0d. **Round budget & models** (above).
1. **Generation Pass:** Blue Team → SPEC + contracts. ! pass checklist + contract validation.
2. **Adversarial Pass:** Critic Council attacks. ∀ finding logged.
3. **Resolution:** technical → profile; policy → escalate.
4. **Loop** 1–3 until exit criteria hold.
5. **Save:** `specs/SPEC.md`, `specs/contracts/`. ⊥ implementation code.
6. **Handoff:** ∃ ICM workspace → `node specs/.sdd/scripts/sdd.cjs transition --completed 02`, then route (UI → Stage 03, else Stage 04). Invoked by SDD orchestrator → return control. Standalone → present spec, ask next step.
7. **Report:** Swarm Log `| Spec/Contract Section | Attacking Persona | Ambiguity/Flaw Found | Blue Team Resolution |`.

## Usage Triggers
User asks for "Red Team review" | "Adversarial Swarm Analysis" | "Spec-Driven Design" | "harden" architecture → adopt this workflow.
