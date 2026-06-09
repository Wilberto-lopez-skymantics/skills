<!-- sdd-icm-template -->
<!-- version: 2026.05.28 -->
<!-- source: github.com/Wilberto-lopez-skymantics/skills -->

# Spec-Driven Development (SDD) Workspace

This project uses an Interpretable Context Methodology (ICM) workspace to orchestrate the Spec-Driven Development (SDD) pipeline. 

As an AI agent, your role is to read the appropriate `CONTEXT.md` file for the current stage when the user makes a request. The folder structure dictates the pipeline order.

## Workspace Stages

When a user asks you to perform a task, map it to the correct stage below and **read the `CONTEXT.md` file in that folder before doing anything else.**

0. **`specs/.sdd/00_backprop/CONTEXT.md`**: Use this when a bug is found post-deployment, a test fails unexpectedly, or the user wants to trace a defect back to its source and fix the pipeline — not just the code.
1. **`specs/.sdd/01_brainstorming/CONTEXT.md`**: Use this when the user wants to brainstorm a new feature, explore ideas, design UI, or start a new specification.
1b. **`specs/.sdd/01b_adoption/CONTEXT.md`**: Use this when the user wants to adopt an existing codebase into SDD management — reverse-engineering specs from existing code rather than designing from scratch.
2. **`specs/.sdd/02_adversarial_swarm_analysis/CONTEXT.md`**: Use this when the user wants to harden, review, or attack a draft specification.
3. **`specs/.sdd/03_interactive_wireframing/CONTEXT.md`**: Use this when the user wants to build HTML wireframes based on a UI design specification.
4. **`specs/.sdd/04_writing_implementation_phases/CONTEXT.md`**: Use this when the user wants to break down a hardened spec into dependency-ordered implementation phases.
5. **`specs/.sdd/05_development_swarm/CONTEXT.md`**: Use this when the user wants to generate code, build the application, or execute the implementation phases.
6. **`specs/.sdd/06_visual_acceptance_testing/CONTEXT.md`**: Use this when the user wants to verify UI implementation against the design tokens.
7. **`specs/.sdd/07_verification_before_completion/CONTEXT.md`**: Use this when the user wants to verify tests, builds, and overall completion before finalizing work.

## Core Rules
- **Code is a byproduct of the spec.** Never write or edit implementation code before the specification (`specs/SPEC.md`) is updated.
- Read `specs/.sdd/_config/` reference materials only when instructed to do so by a stage's `CONTEXT.md`.
- All specifications and outputs live in the `specs/` directory at the project root.
- **Continuous State Tracking:** Before transitioning between any two stages, ! update `specs/.sdd/_config/sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`) by updating the top-level keys to the new stage and appending the previous stage state (excluding `history`) to the `history` array. ⊥ silently transition without state update — breaks pipeline recoverability.
