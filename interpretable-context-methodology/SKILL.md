---
name: interpretable-context-methodology
version: 2026.09.28-v2
description: Follows Interpretable Context Methodology (ICM) principles to manage sequential stage-based workflows. Use when working in a directory structured with numbered folders representing stages (e.g. 01_brainstorming, 05_development_swarm) or when WORKSPACE_ROUTING.md or CONTEXT.md exists.
---

# Interpretable Context Methodology (ICM)

## Small-Model Guardrails (MANDATORY)

<HARD-GATE>
**Anti-Rubber-Stamping:** You MUST check the Inputs table in the current stage's `CONTEXT.md` file before starting work. You MUST create or update the stage's output tracking files (e.g., state logs or checklists) as you perform the steps. Do not declare a stage complete without generating inspectable artifacts.

**Surgical Edits:** When modifying configuration files (Layer 3) or stage prompts (Layer 2), make targeted edits. Do not rewrite entire prompt documents unless replacing them completely is necessary.
</HARD-GATE>

## Quick Start

An ICM stage is executed in three simple steps:
1. **Identify the Active Stage:** Read the `WORKSPACE_ROUTING.md` at the project root to map your task to the current folder (e.g., `05_development_swarm/`).
2. **Read the Contract:** Read the `CONTEXT.md` in the stage folder. Identify the required Layer 3 (reference) and Layer 4 (working) inputs.
3. **Execute and Save:** Perform the process and write output files directly to the stage's `output/` directory. Wait for user review before proceeding.

## Workflows

### 1. Executing an ICM Stage
1. **Locate Contract:** Open the stage's `CONTEXT.md` (e.g., [CONTEXT.md](file://./05_development_swarm/CONTEXT.md)).
2. **Verify Inputs:** Cross-reference the "Inputs" table. Load every required reference file (Layer 3) and working artifact (Layer 4).
3. **Process Steps:** Execute the instructions in the "Process" section of the contract.
4. **Produce Outputs:** Save all files listed in the "Outputs" table to the local `output/` directory.
5. **State Checkpoint:** Update the workspace state file (e.g., `specs/.sdd-state.json`) with the timestamp and stage outcomes.
6. **User Gate:** Present the final output list to the user and request permission/review before transitioning to the next stage.

### 2. Creating a New Stage Folder
1. **Folder Naming:** Prefix with a two-digit execution order (e.g., `08_documentation`).
2. **Stage Contract:** Create a `CONTEXT.md` inside the new folder. Include `## Inputs`, `## Process`, and `## Outputs` sections.
3. **Handoff Config:** Configure the Inputs table to read from the output folder of the preceding stage.
4. **Routing Update:** Update `WORKSPACE_ROUTING.md` to document the new stage.

## Advanced Features

See [REFERENCE.md](REFERENCE.md) for details on:
- Five-Layer Context Hierarchy
- The Edit-Source Principle
- Provable Execution & Debugging

See [EXAMPLES.md](EXAMPLES.md) for templates and concrete files.
