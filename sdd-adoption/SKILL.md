---
name: sdd-adoption
description: "Adopt an existing codebase into SDD management by reverse-engineering specs from code. Produces SPEC.md, DECISION_LOG.md, and optionally DESIGN.md — same outputs as brainstorming, but code-first instead of idea-first."
---

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

# SDD Adoption — Onboarding Existing Projects

Reverse-engineer specs from a working codebase → bring project under SDD management.

Goal: existing code → fully documented spec artifacts → standard SDD lifecycle from that point forward.

**Key difference from brainstorming:** brainstorming starts with ideas & user intent. Adoption starts with **code as ground truth** and extracts the implicit spec.

## When to Use

- User has an existing codebase without specs/ folder
- User wants to bring a project under SDD management
- User says "adopt", "onboard", "reverse-engineer the spec"
- Project already works but lacks formal specification

## Anti-Pattern: "Just Slap a Spec On It"

Adoption ⊥ rubber-stamp the status quo. The reverse-engineered spec must be honest about what the code *actually* does, including undocumented behaviors, implicit assumptions, & architectural shortcuts. These become the **adoption baseline** — future SDD iterations improve from here.

## Adoption Parameters

Before starting analysis, ! ask user for parameters. Present as a configuration step:

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Analysis Depth** | `thorough` | `quick` (folder structure + entry points), `standard` (+ key modules + APIs), `thorough` (+ all source files + git history) |
| **Focus Modules** | `all` | Comma-separated list of directories/modules to prioritize |
| **Include Git History** | `yes` | Mine git log for architectural decisions & evolution |
| **Map Existing Tests** | `yes` | Inventory test files & map to spec invariants |
| **Project Type** | auto-detect | `client-side-app` \| `server-side-app` \| `library` \| `cli-tool` \| `full-stack` \| `extension` |

**⛔ GATE:** ⊥ begin codebase analysis until user confirms | adjusts parameters. Defaults are sensible — user can just approve.

## Checklist

! create task for each item, complete in order:

1. **Configure adoption parameters** — present parameter table, get user confirmation
2. **Scan project structure** — read folder tree, package manifests (package.json, Cargo.toml, go.mod, etc.), entry points, README, config files
3. **Inventory source modules** — identify key modules, their responsibilities, public APIs, inter-module dependencies. Build a module dependency map.
4. **Map existing tests** (if enabled) — read test files, categorize by type (unit, integration, e2e), note coverage gaps. Map tests → source modules they exercise.
5. **Extract architectural decisions** — from code patterns, comments, config files, git history (if enabled). Look for: framework choices, data flow patterns, state management, error handling strategies, authentication/authorization, deployment config.
6. **Confidence self-assessment** — score understanding across 5 dimensions, ! reach ≥85 before proceeding to spec drafting. Read `../_config/references/confidence-assessment.md`. If below threshold → ask user targeted questions about weak dimensions.

**⛔ GATE:** ⊥ draft spec artifacts (Step 7+) until Confidence Self-Assessment score ≥85. Code reading alone may leave gaps — the user fills them.

7. **Draft DECISION_LOG.md** — consolidate discovered decisions into `specs/DECISION_LOG.md` using standard template. Each row = a decision found in the code. Rationale column = evidence from code/git/docs. Mark decisions that are **inferred** (vs explicitly documented) with `[inferred]`.
8. **Draft SPEC.md** — reverse-engineer requirements from the codebase into `specs/SPEC.md`. Must include:
   - Core Requirements (what the system does)
   - Data Flow (how data moves between components)
   - API Contracts (if applicable)
   - Invariants (extracted from tests + code assertions + defensive patterns)
   - Configuration Schema (from config files)
   
   **⊥ aspirational specs.** Document *what the code does today*, not what it should do. Mark any observed code smells | architectural debt as `[TECH DEBT]` annotations — these become future backlog items, not current spec requirements.

9. **Draft DESIGN.md** (UI projects only) — extract design tokens from existing CSS/styles. Read `../_config/design-template.md`. ! pass Design Token Completeness Checklist. Tokens are **extracted from code**, not invented.

10. **Map tests to invariants** (if enabled) — for each test found in Step 4, link it to the spec invariant it validates. Tests without a clear invariant → flag as `[UNMAPPED]`. Invariants without a test → flag as `[UNTESTED]`.

11. **Generate IMPLEMENTATION_PHASES.md** — produce `specs/IMPLEMENTATION_PHASES.md` with all phases marked as `[x]` (completed). Header must include:
    ```markdown
    > [!NOTE]
    > This document was auto-generated by the SDD Adoption process on [DATE].
    > All phases are pre-checked as they represent work already completed.
    > Future modifications to this project will add new phases via the standard SDD lifecycle.
    ```
    Group phases by architectural component. Each phase = a module or feature that already exists.

12. **User reviews adopted spec** — present all drafted artifacts to user for review & correction. The user knows the codebase better than the agent — they will catch misinterpretations.

**⛔ GATE:** ⊥ proceed to next stage until user explicitly approves the adopted spec artifacts.

13. **Set SDD state** — write `specs/.sdd/_config/sdd-state.json`:
    ```json
    {
      "lastCompletedStep": 1,
      "stepName": "Adoption Complete",
      "projectType": "[detected]",
      "timestamp": "[ISO 8601]",
      "notes": "Project adopted into SDD. Spec reverse-engineered from existing codebase."
    }
    ```

14. **Transition** — present next-step options to user:
    - **Option A: Run Adversarial Analysis** → proceed to Stage 02 (harden the adopted spec, surface gaps in existing code)
    - **Option B: Expand via Brainstorming** → proceed to Stage 01 (use the adopted spec as baseline, brainstorm new features/improvements)
    - **Option C: Jump to Development** → proceed to Stage 04/05 (start using SDD for future changes only)
    
    Return control to `spec-driven-development` orchestrator with the user's choice.

## Outputs

- `specs/SPEC.md` — reverse-engineered specification
- `specs/DECISION_LOG.md` — discovered architectural decisions
- `specs/DESIGN.md` (if UI project) — extracted design tokens
- `specs/IMPLEMENTATION_PHASES.md` — pre-checked documentation of existing architecture
- `specs/.sdd/_config/sdd-state.json` — SDD state set to adoption complete
- `specs/backprop-log.md` — created (empty) if not present, ready for future bug traces

## Adoption-Specific Anti-Patterns

| Anti-Pattern | Why It's Wrong | Correct Approach |
|---|---|---|
| Inventing requirements not in code | Spec becomes aspirational fiction | Document what code does today. Aspirations → brainstorming backlog. |
| Ignoring existing tests | Loses coverage history | Map tests → invariants. Unmapped tests still have value. |
| Skipping user review | Agent misreads code intent | User knows the "why" behind code patterns. |
| Marking tech debt as requirements | Treats workarounds as spec | Mark as `[TECH DEBT]` — separate from real requirements. |
| Generating empty IMPLEMENTATION_PHASES.md | Loses architectural documentation | Pre-check all phases with component descriptions. |
