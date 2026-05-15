---
name: writing-implementation-phases
description: Bridges the gap between the Architecture Spec and the Development Swarm by breaking the spec into sequential, testable implementation phases.
---

# Writing Implementation Phases

## Overview
This skill is a critical governance bridge. A hardened `ARCHITECTURE_SPEC.md` is too large and conceptual for a builder agent to execute reliably in one shot. This skill converts the high-level contract into a granular, traceable, and strictly sequenced checklist called `IMPLEMENTATION_PHASES.md`.

**CRITICAL MANDATE:** You must not write any code while this skill is active. Your only output is the phase breakdown document.

## The Workflow

When invoked to plan the execution of an architecture spec, follow this exact sequence:

1. **Ingest the Spec:** Read the `specs/ARCHITECTURE_SPEC.md` in its entirety.
2. **Deconstruct into Phases:** Break the system down into logical, dependency-ordered phases. 
   - *Rule:* Infrastructure and Database schemas must always be Phase 1 and 2. Frontend UIs must always be the final phases.
3. **Mandate Verifications:** For EVERY phase, you MUST define a strict, empirical `Verification` step. A phase cannot be marked complete by the Development Swarm unless this verification command (e.g., `pytest`, `docker-compose up`, or `curl`) passes.
4. **Write the Checklist:** Output the resulting checklist to `specs/IMPLEMENTATION_PHASES.md` using standard markdown task lists (`- [ ]`).
5. **Handoff:** Instruct the user or the orchestrator to pass this checklist directly into the `development-swarm` skill.

## Document Format (`specs/IMPLEMENTATION_PHASES.md`)
```markdown
# Implementation Phases
*Derived from ARCHITECTURE_SPEC.md*

## Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2
- [ ] **Verification:** [Exact command or empirical test to run]

## Phase 2: [Name]
...
```

## Usage Triggers
If the user asks to "write the implementation plan", "break down the spec", or "plan the phases", immediately adopt this workflow.
