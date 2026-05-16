---
name: spec-driven-development
description: Use when a user requests a new feature, update, or bugfix in a project that utilizes Spec-Driven Development (i.e., contains a 'specs/' folder or an ARCHITECTURE_SPEC.md). Enforces updating the specification before writing any code.
---

# Spec-Driven Development Enforcement

## Overview
This skill acts as an absolute governor for code generation in projects that maintain architectural specifications. In a Spec-Driven Development (SDD) environment, **code is a byproduct of the spec.**

If a user requests a new feature, a behavior change, or an architectural update, you are **FORBIDDEN** from immediately jumping into the codebase to implement it.

## The Rule of the Source of Truth
In an SDD project (identifiable by the presence of a `specs/` directory, an `ARCHITECTURE_SPEC.md`, or a `IMPLEMENTATION_PHASES.md`):

1. **The Specification is the Law:** The development swarm (`development-swarm`) is programmed to reject any code that does not exist in the specification. If you write code for a feature that isn't in the spec, the Architect persona will flag it as a violation.
2. **Update the Blueprint First:** You MUST translate the user's requested change into an explicit modification to the `ARCHITECTURE_SPEC.md` document.
3. **Trace the Data Flow:** When updating the spec, ensure Data-Flow Traceability. If the feature introduces a new configuration file, database column, or API endpoint, you must explicitly state how they connect in the spec.
4. **Regenerate the Phases:** After the `ARCHITECTURE_SPEC.md` is updated and approved by the user, you MUST invoke the `writing-implementation-phases` skill to regenerate the `IMPLEMENTATION_PHASES.md` checklist.
5. **Execute:** Only after the checklist is updated can you invoke the `development-swarm` to actually write the code.

## Workflow When Receiving User Feedback
When the user says "I want to add X feature" or "Change how Y works":

1. **Stop & Acknowledge:** Inform the user that because this is an SDD project, the specification must be updated first to ensure the swarm agents build it correctly.
2. **Draft the Spec Change:** Propose the exact markdown additions/deletions to `ARCHITECTURE_SPEC.md` that define the new feature.
3. **Swarm the Spec:** You MUST invoke the `adversarial-swarm-analysis` skill to harden the proposed spec changes. Do not skip this step; the spec modifications must survive the Red Team Critic Council before they are finalized.
4. **Apply the Change:** Once the spec survives the adversarial swarm and the user approves the hardened spec, write the changes to the `specs/` folder.
5. **Proceed:** Move to implementation planning (`writing-implementation-phases`) and swarm execution (`development-swarm`).
6. **Close the Loop:** After the `development-swarm` completes, its mandatory Post-Implementation Reconciliation (Step 6 of that skill) will re-read the spec and compare it against the code that was actually written. If drift is detected:
   - **Minor drift:** The spec is auto-corrected to match the implementation.
   - **Major drift:** The `adversarial-swarm-analysis` is re-invoked to harden the updated spec, creating a feedback cycle back to Step 3.
   
   The lifecycle is NOT complete until the Reconciliation Report shows ZERO drift entries.

## SDD Lifecycle Diagram
```
  ┌─── 1. User Request ───┐
  │                        ▼
  │           2. Draft Spec Change
  │                        │
  │           3. adversarial-swarm-analysis
  │                        │ (3+ iterations)
  │           4. User Approves Spec
  │                        │
  │           5. writing-implementation-phases
  │                        │
  │           6. development-swarm
  │                        │
  │           7. Post-Implementation Reconciliation
  │                        │
  │               ┌────────┴────────┐
  │               │                 │
  │          No Drift          Drift Found
  │               │                 │
  │            ✅ DONE         ┌────┴────┐
  │                            │         │
  │                         Minor     Major
  │                            │         │
  │                       Auto-fix   Re-invoke
  │                        spec     adversarial
  │                            │     swarm (→3)
  │                            │         │
  └────────────────────────────┴─────────┘
```

**Hard Rule:** Never write application code (Python, TS, React, Java, etc.) to satisfy a feature request before the markdown spec has been formally updated. Never declare a feature complete until the Post-Implementation Reconciliation passes.
