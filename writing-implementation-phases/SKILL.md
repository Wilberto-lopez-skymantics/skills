---
name: writing-implementation-phases
description: Bridges the gap between the Architecture Spec and the Development Swarm by breaking the spec into sequential, testable implementation phases.
---

# Writing Implementation Phases

## Overview
This skill is a critical governance bridge. A hardened `specs/ARCHITECTURE.md` is too large and conceptual for a builder agent to execute reliably in one shot. This skill converts the high-level contract into a granular, traceable, and strictly sequenced checklist called `IMPLEMENTATION_PHASES.md`.

**CRITICAL MANDATE:** You must not write any code while this skill is active. Your only output is the phase breakdown document.

## The Workflow

When invoked to plan the execution of an architecture spec, follow this exact sequence:

1. **Ingest the Spec:** Read the `specs/ARCHITECTURE.md` in its entirety.
2. **Deconstruct into Phases:** Break the system down into logical, dependency-ordered phases. 
   - *Rule:* Infrastructure and Database schemas must always be Phase 1 and 2. Frontend UIs must always be the final phases.
   - *Data-Flow Traceability Rule (CRITICAL):* Every REST endpoint, UI component, or API listed in the checklist MUST explicitly state its data source (e.g., `Database Table X` or `Configuration File Y`). If a configuration file like `agents.yaml` is defined in the spec, you MUST explicitly create a checklist item stating exactly which module or endpoint parses and consumes it. Do not leave "wiring" implicit.
3. **Mandate Verifications:** For EVERY phase, you MUST define a strict, empirical `Verification` step. A phase cannot be marked complete by the Development Swarm unless this verification command (e.g., `pytest`, `docker-compose up`, or `curl`) passes.
4. **Write the Checklist:** Output the resulting checklist to `specs/IMPLEMENTATION_PHASES.md` using standard markdown task lists (`- [ ]`).
5. **Phase Integrity Check:** Before presenting the phases to the user, execute each of these structural validations. Fix any issues inline before proceeding.

   1. **Coverage Check:** Every component in `ARCHITECTURE.md`'s Component Hierarchy, every API endpoint, every data model, and every frontend component appears in at least one phase. Flag any orphan from the spec that has no corresponding phase item.
   2. **Dependency Ordering:** For each phase, list its dependencies (other phases it requires). Verify the dependency graph is acyclic (no circular dependencies). Flag any phase that references a component not yet built in a prior phase.
   3. **Verification Step Check:** Every phase MUST end with a concrete verification step — a command to run, a test to pass, or a behavior to observe with expected output. "Verify it works" is NOT a verification step. Flag any phase missing one.
   4. **Phase Size Check:** Any phase with more than 8 checklist items should be split. Any phase with only 1 item should be merged into an adjacent phase.
   5. **DESIGN.md Cross-Reference (UI projects):** If a `specs/DESIGN.md` exists, every phase that creates a frontend component MUST include "Read `specs/DESIGN.md` tokens for [component]" as its first checklist item. Flag any frontend phase that doesn't.

   Fix any issues inline. After fixing, explicitly state: "Phase Integrity Check passed: [N] checks clear, [M] issues fixed inline."

6. **Handoff:** Instruct the user or the orchestrator to pass this checklist directly into the `development-swarm` skill.

## Document Format (`specs/IMPLEMENTATION_PHASES.md`)
```markdown
# Implementation Phases
*Derived from specs/ARCHITECTURE.md*

## Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2
- [ ] **Verification:** [Exact command or empirical test to run]

## Phase 2: [Name]
...
```

## Usage Triggers
If the user asks to "write the implementation plan", "break down the spec", or "plan the phases", immediately adopt this workflow.
