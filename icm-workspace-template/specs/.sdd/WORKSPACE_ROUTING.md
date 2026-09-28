<!-- sdd-icm-template -->
<!-- version: 2026.09.28-v2 -->
<!-- source: github.com/Wilberto-lopez-skymantics/skills -->

# Spec-Driven Development (SDD v2) Workspace
## Equivalence & Determinism Engine

This project uses an Interpretable Context Methodology (ICM) workspace to orchestrate the Spec-Driven Development (SDD) pipeline. 

**Core Objective:** Generate specifications, typed machine contracts, and test fixtures so complete and invariant-constrained that two independent coding agents produce observationally and semantically equivalent solutions.

As an AI agent, your role is to read the appropriate `CONTEXT.md` file for the current stage when the user makes a request. The folder structure dictates the pipeline order.

## Workspace Stages

When a user asks you to perform a task, map it to the correct stage below and **read the `CONTEXT.md` file in that folder before doing anything else.**

0. **`specs/.sdd/00_backprop/CONTEXT.md`**: Defect backpropagation. Trace unexpected test failures or post-deployment defects back to spec invariants (§V) and fix the specification before touching code.
1. **`specs/.sdd/01_brainstorming/CONTEXT.md`**: Socratic human-in-the-loop dialogue with real-time **Shadow Critic**. Terminates only upon passing the 4 empirical **Extraction Closure** dimensions (Entity Lifecycle, Negative Space, Fork Test, Policy vs Mechanics).
1b. **`specs/.sdd/01b_adoption/CONTEXT.md`**: Reverse-engineer specs, typed contracts, and tests from an existing codebase.
2. **`specs/.sdd/02_adversarial_swarm_analysis/CONTEXT.md`**: Autonomous technical hardening and **Machine Contract Synthesis**. Produces `specs/contracts/` (`openapi.yaml`, `schema.sql`, `statecharts.json`, `errors.json`) complying strictly with `systems-standards.md`.
3. **`specs/.sdd/03_interactive_wireframing/CONTEXT.md`**: WYSIWYG HTML wireframes from design tokens (UI projects).
4. **`specs/.sdd/04_writing_implementation_phases/CONTEXT.md`**: Granular phase breakdown AND **Immutable Test Oracle Synthesis** (`specs/fixtures/` containing API golden cases, DB assertions, and state transition sequences).
5. **`specs/.sdd/05_development_swarm/CONTEXT.md`**: Strict test-fulfillment coding swarm. Builders are **strictly forbidden from modifying `specs/` or `specs/fixtures/`**; their sole role is satisfying the pre-existing test oracle.
6. **`specs/.sdd/06_visual_acceptance_testing/CONTEXT.md`**: Browser-based visual QA against design tokens.
7. **`specs/.sdd/07_verification_before_completion/CONTEXT.md`**: Independent evidence-based completion proof.

## Core Rules
- **Observational Equivalence Principle:** Specs must leave zero unconstrained domain degrees of freedom. Two independent coding instances must produce indistinguishable external behaviors.
- **Machine Contracts over Prose:** API routes, DB DDL, state machines, and error taxonomies must be emitted as machine-checkable files in `specs/contracts/`.
- **Strict Test-Consumer Mandate:** Acceptance tests and fixtures are authored in the spec phase (`specs/fixtures/`), NOT by the coder in Stage 05. The coder never grades its own work.
- **Code is a Byproduct:** Never write or edit implementation code before the specification, contracts, and test fixtures are frozen.
- **Continuous State Tracking:** Before transitioning between any two stages, ! update `specs/.sdd/_config/sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`).
