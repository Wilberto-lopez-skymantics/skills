---
name: spec-driven-development
description: Use when a user requests a new feature, update, or bugfix in a project that utilizes Spec-Driven Development (i.e., contains a 'specs/' folder or a SPEC.md). Enforces updating the specification before writing any code.
---

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

# Spec-Driven Development Enforcement

## Overview
Central orchestrator ∀ code generation ∈ projects with specs. In SDD, **code = byproduct of spec.**

User requests feature | behavior change | architectural update → ⊥ jump into codebase to implement.

**Orchestrator Role:** ∀ sub-skills (brainstorming, adversarial-swarm-analysis, interactive-wireframing, writing-implementation-phases, development-swarm, visual-acceptance-testing) ! return control to this skill on completion. SDD determines next step from artifacts on disk. ⊥ sub-skill invoke another sub-skill directly.

**Anti-Eagerness Enforcement:** User commands "keep going" across phases → ! update `specs/.sdd-state.json` between phases. ⊥ silently transition without state update. Skipping checkpoint = broken recoverability.

## Rule of Source of Truth
SDD project = ∃ `specs/` directory with `SPEC.md` | `DESIGN.md` | `IMPLEMENTATION_PHASES.md`:

1. **Spec = Law:** Dev swarm rejects code ∉ spec. Code for feature not ∈ spec → Architect flags violation.
2. **Spec Before Code:** ⊥ implementation code until spec updated & approved. Spec created via `brainstorming`, hardened by `adversarial-swarm-analysis`, ⊥ drafted by this orchestrator.
3. **Data-Flow Traceability:** ∀ config file | DB column | API endpoint | state transition ! have explicit trace through spec showing data flow between components.
4. **Phase-Driven Execution:** Code written only after `IMPLEMENTATION_PHASES.md` regenerated from approved spec. Dev swarm follows checklist strictly in order.
5. **Wireframes as Visual Source of Truth (UI):** `DESIGN.md` dictates initial tokens → `interactive-wireframing` generates wireframes. **Once wireframes approved, wireframes = absolute visual source of truth for implementation.** Dev swarm ! extract colors/spacing/typography/layout from approved wireframes ∈ `specs/wireframes/`. Wireframe hex code | inline style → generated code must match exactly. **Wireframe Completeness:** Wireframes ! be self-contained. ⊥ reference external local assets. ∀ visual values fully baked in.

## Interactive Execution Gates

**⛔ GATE:** Before invoking ANY sub-skill, ! present Execution Gate to user. Gate informs what happens next, lets user proceed | skip (if skippable) | adjust parameters. ! pause & wait for explicit response.

Format:
> **⏭️ Next Step: [Step Name]**
> **What it does:** [1-2 sentence description]
> **Token budget:** 🟢 Low / 🟡 Medium / 🔴 High
> **Estimated iterations:** [e.g., "3+ adversarial passes"]
> **Skippable:** Yes / No
> **Parameters you can adjust:** [e.g., "Minimum iteration count (default: 2)"]
>
> Proceed? (yes / skip / adjust)

Token budget categories (relative cost, input + output; actual cost depends on spec size & iteration count):
| Category | Meaning | Examples |
|----------|---------|---------:|
| 🟢 Low | Single pass, minimal I/O | Completeness gate, phase integrity check, artifact verification |
| 🟡 Medium | 2-3 passes, moderate I/O | Writing implementation phases, wireframing single screen |
| 🔴 High | 3+ iterated passes, heavy I/O | Adversarial swarm, development swarm, full VAT |

## Conversation Checkpoints

After completing each major gate, ! save checkpoint to disk:
1. Write `specs/.sdd-state.json`:
   ```json
   {
     "lastCompletedStep": 4,
     "stepName": "Harden the Spec",
     "projectType": "game",
     "timestamp": "2026-05-26T12:00:00Z",
     "notes": "Adversarial swarm passed after 3 iterations"
   }
   ```
2. Inform user: *"Checkpoint saved at Step [N] ([step name]). Continue in new conversation — I will detect state file & resume."*

**Resumption:** When invoked on SDD project, FIRST check `specs/.sdd-state.json`. ∃ → read & present state:
> "I found an SDD checkpoint at Step [N] ([step name]), last updated [timestamp]. Resume from here? Or restart?"

## Workflow: User Feedback
User says "I want to add X" | "Change how Y works":

1. **Stop & Acknowledge:** Inform user: SDD project → spec ! be updated first. **UI projects:** Let user know they can drop visual references into `specs/references/style/`.
2. **Brainstorm:** Invoke `brainstorming` → explore requirements, propose approaches, draft spec artifacts. Brainstorming OWNS initial creation of `specs/DECISION_LOG.md`, `specs/SPEC.md`, `specs/DESIGN.md` (UI only). Artifacts = **DRAFT** status until hardened.
   - New domain terms → brainstorming invokes `/ubiquitous-language` → `specs/UBIQUITOUS_LANGUAGE.md`
   - Working artifacts stored ∈ `specs/brainstorming/`
3. **Verify Draft Artifacts:** After brainstorming returns control, confirm on disk:
   - `specs/DECISION_LOG.md` ✓
   - `specs/SPEC.md` ✓
   - `specs/DESIGN.md` (UI only) ✓
   Missing → re-invoke brainstorming. ⊥ draft them here.
4. **Harden Spec:** Invoke `adversarial-swarm-analysis` → Red Team Critic Council. Returns control on completion. PASS verdict → artifacts transition DRAFT → **HARDENED**.
5. **Quantitative Completeness Gate:** Execute 14-step Spec Self-Review (see below). Fix issues inline before final approval.
6. **User Approves Hardened Spec:** Present to user. Approved → save to `specs/`.
7. **Wireframe (UI only):** Invoke `interactive-wireframing` → iterative WYSIWYG HTML wireframes from `DESIGN.md` & `SPEC.md`. Iterates screen-by-screen until approved. Saved to `specs/wireframes/` → absolute visual source of truth.
8. **Generate Implementation Phases:** Invoke `writing-implementation-phases` → granular sequenced checklist `specs/IMPLEMENTATION_PHASES.md`. Returns control on completion.
9. **Execute:** Invoke `development-swarm` → implement per `IMPLEMENTATION_PHASES.md`. Pass approved wireframes (if any) as absolute visual spec.
   - **9a. VAT (UI only):** After code compiles, invoke `visual-acceptance-testing` → verify rendered output in real browser. Catches invisible elements, empty screens, layout breakage.
10. **Close Loop:** Dev swarm's Post-Implementation Reconciliation re-reads spec vs code. Drift detected:
    - **Minor:** Spec auto-corrected to match implementation.
    - **Major:** Re-invoke `adversarial-swarm-analysis` → feedback cycle to Step 4.
    
    *(UI: swarm cross-refs frontend/UI code vs **approved HTML wireframes** ∈ `specs/wireframes/` for zero visual drift).*
    
    Lifecycle NOT complete until Reconciliation Report = ZERO drift entries.

**ESCALATION RULE:** Adversarial swarm | any SDD step identifies gap requiring user input → ! invoke `brainstorming`. Swarm = **SUSPENDED, not paused.** Brainstorming runs to FULL completion (all steps including Spec Self-Review & User Review) before swarm resumes. ⊥ "quickly resolve" escalation. Treating brainstorming as quick detour = anti-pattern → specs built on assumptions.

## Workflow: Bugs Escape (Hardening Loop)
Defect | edge case | structural flaw discovered *after* SDD lifecycle completed:

1. **Root Cause Analysis:** Before fixing → analyze *why* it slipped. Which persona failed? Missing from spec? VAT didn't cover that state?
2. **Process Hardening:** Before implementing fix → ! write | update skill to prevent this bug category from escaping again. Visual bug → update VAT. Architectural → update adversarial. New gate needed → write new skill.
3. **Execute Fix:** Enter standard SDD loop (update Spec → regenerate Phases → Swarm).

## Workflow: Adopt Existing Project
User has existing codebase → wants SDD management. Code exists, spec does not.

1. **Stop & Route:** Detect adoption intent (user says "adopt", "onboard", project has code but no `specs/`). Inform user: this uses the adoption workflow (Stage 01b) instead of brainstorming (Stage 01).
2. **Adopt:** Invoke `sdd-adoption` → reverse-engineers SPEC.md, DECISION_LOG.md, DESIGN.md (UI), IMPLEMENTATION_PHASES.md (pre-checked) from existing code. Maps existing tests → spec invariants. Returns control on completion.
3. **Verify Adoption Artifacts:** After adoption returns control, confirm on disk:
   - `specs/SPEC.md` ✓
   - `specs/DECISION_LOG.md` ✓
   - `specs/DESIGN.md` (UI only) ✓
   - `specs/IMPLEMENTATION_PHASES.md` (pre-checked) ✓
   Missing → re-invoke adoption. ⊥ draft them here.
4. **User Chooses Next Step:** Adoption presents 3 options:
   - **Option A:** Run adversarial-swarm-analysis → harden adopted spec, surface gaps in existing code. Proceed to Step 4 of User Feedback workflow.
   - **Option B:** Expand via brainstorming → use adopted spec as baseline, brainstorm new features. Proceed to Step 2 of User Feedback workflow.
   - **Option C:** Jump to development → skip hardening, use SDD for future changes only. Proceed to Step 8 of User Feedback workflow.

**Key difference from User Feedback workflow:** Steps 1-3 use `sdd-adoption` instead of `brainstorming`. From Step 4 onward, the standard SDD lifecycle applies unchanged.

## Process Failure Recovery

| Failure Mode | Recovery |
|---|---|
| Sub-skill crashes | server won't start | Raise to user. ⊥ silently skip. |
| User abandons brainstorming | Save to `specs/.brainstorming-state.json`. Next invocation → offer resume. |
| Adversarial can't PASS after max iterations | Raise: present remaining findings, ask for architectural guidance. |
| Context exhaustion during dev swarm | Track via `IMPLEMENTATION_PHASES.md` checkboxes. Resume from next unchecked phase. |

## Document Templates

Canonical templates ∈ shared files:

| Document | Template | Created By | Verified By |
|----------|----------|------------|-------------|
| `specs/DECISION_LOG.md` | [decision-log-template.md](file://{{SKILLS_DIR}}/shared/decision-log-template.md) | brainstorming \| sdd-adoption | SDD (Step 3) |
| `specs/DESIGN.md` | [design-template.md](file://{{SKILLS_DIR}}/shared/design-template.md) | brainstorming \| sdd-adoption (UI) | SDD (Step 3), wireframing |
| `specs/SPEC.md` | (structure from adversarial completeness checklist) | brainstorming \| sdd-adoption | adversarial, SDD (Step 5) |
| `specs/IMPLEMENTATION_PHASES.md` | (structure from writing-implementation-phases) | writing-impl-phases \| sdd-adoption (pre-checked) | SDD (Step 8) |

## SDD Lifecycle Diagram
```
  ┌─── 1. User Request (Feature/Bug/Adopt) ──┐
  │                                           ▼
  │                     ┌── 1.5 Defect Leakage Analysis ──┐
  │                     │   (If post-release bug)         │
  │                     │                                 ▼
  │                     │                        Harden Global Skills
  │                     │                                 │
  │                     └─────────────────────────────────┘
  │                                    ▼
  │                     ┌──────────────┴──────────────┐
  │                     │                             │
  │              New project?                  Existing codebase?
  │                     │                             │
  │            2. brainstorming              2b. sdd-adoption
  │         (drafts DECISION_LOG,        (reverse-engineers spec
  │              SPEC, DESIGN)             from existing code)
  │                     │                             │
  │                     └──────────────┬──────────────┘
  │                                    │
  │                           3. Verify Draft Artifacts
  │                                    │
  │                    ──── Execution Gate ────
  │                                    │
  │                           4. adversarial-swarm-analysis
  │                         (DRAFT → HARDENED on PASS)
  │                                    │ (3+ iterations)
  │                           5. Quantitative Completeness Gate
  │                                    │ (14 checks)
  │                           6. User Approves Hardened Spec
  │                                    │
  │                    ──── Execution Gate ────
  │                                    │
  │                           7. interactive-wireframing
  │                            (UI projects only)
  │                                    │
  │                    ──── Execution Gate ────
  │                                    │
  │                           8. writing-implementation-phases
  │                                    │
  │                    ──── Execution Gate ────
  │                                    │
  │                           9. development-swarm
  │                             (uses approved wireframes
  │                              as visual source of truth)
  │                                    │
  │                    ──── Execution Gate ────
  │                                    │
  │                          9a. visual-acceptance-testing
  │                            (UI projects only)
  │                                    │
  │                          10. Post-Implementation Reconciliation
  │                                    │
  │                       ┌────────────┴────────────┐
  │                       │                         │
  │                  No Drift                  Drift Found
  │                       │                         │
  │                    ✅ DONE                 ┌────┴────┐
  │                                            │         │
  │                                         Minor     Major
  │                                            │         │
  │                                       Auto-fix   Re-invoke
  │                                        spec     adversarial
  │                                            │     swarm (→4)
  │                                            │         │
  └────────────────────────────────────────────┴─────────┘
```

**Hard Rule:** ⊥ write application code before markdown spec formally updated. ⊥ declare feature complete until Post-Implementation Reconciliation passes. UI: ⊥ declare visual correctness without browser screenshot evidence from `visual-acceptance-testing`. ⊥ fix post-release bug without Defect Leakage Analysis first.

## Spec Self-Review (Quantitative Completeness Gate)

**⛔ GATE:** ⊥ invoke downstream skills (writing-implementation-phases, development-swarm, interactive-wireframing) until this gate explicitly executed & passed. Skipping = entire spec drafting process invalid.

After drafting spec & passing adversarial swarm, execute checks sequentially.

**⛔ GATE:** ! create tracking artifact `sdd-completeness-gate.md`. ! evaluate 14 checks one by one, write reasoning, mark `[x]` only when proven. Mass-approving without tracking artifact = rubber-stamping = process violation.

Execute all 14 checks ∈ [spec-self-review.md](file://{{SKILLS_DIR}}/shared/spec-self-review.md) (base 11 + SDD extensions 12-14).

⊥ resolve reference → use fallback checks. Log: "Spec self-review reference unavailable — using inline fallback."

<details><summary>Fallback Spec Self-Review (use only if reference unresolvable)</summary>

1. **Placeholder scan:** Any "TBD" | "TODO" | incomplete sections → fix.
2. **Internal consistency:** Sections contradict each other?
3. **Scope check:** Focused enough for single implementation plan?
4. **Ambiguity check:** Requirement interpretable two ways → pick one.
5. **Quantification check:** ∀ numeric parameter ! be exact value | bounded range | formula.
6. **Decision log completeness:** Cross-ref DECISION_LOG.md vs conversation.
7. **Config schema check:** Config references ! include exact schema shape.
8. **WCAG Contrast (UI):** ∀ text/background pair → ≥4.5:1 (body) | ≥3:1 (large).
9. **Design Token Completeness (UI):** ∀ component ! define backgroundColor, textColor, rounded + interaction states.
10. **Cross-Artifact (UI):** DESIGN.md component names ↔ SPEC.md hierarchy — flag orphans.
11. **Auxiliary UI State (UI):** Check for missing screens: splash, loading, settings, error, empty states.
12. **PRNG Determinism (Algorithmic):** Random generation → define deterministic algorithm + seed storage.
13. **Input Throttling (Interactive):** Fast inputs (pointermove, scroll) throttled?
14. **Hardware Resilience:** Fallback for blocked APIs (audio, WebGL, camera)?
</details>

Fix issues inline. After fixing → "Spec self-review passed: [N] checks clear, [M] issues fixed inline." Then ask user for Final Approval.
