# ICM Reference Documentation

## The Five-Layer Context Hierarchy

ICM scopes the context window of the language model to only load what is relevant to the active task, minimizing token consumption and improving attention accuracy.

| Layer | Type | Description | Examples |
|---|---|---|---|
| **Layer 0** | Global Identity | Defines the workspace scope, directory structure, and agent persona. | Global README, `.cursorrules` |
| **Layer 1** | Task Routing | Directs user requests to the appropriate numbered stage folders. | `WORKSPACE_ROUTING.md` |
| **Layer 2** | Stage Contract | Specifies inputs, process steps, and expected outputs of one step. | Stage `CONTEXT.md` |
| **Layer 3** | Reference Material (Stable) | Rules, templates, standards, and style guides that persist across runs. | `_config/role-standards.md` |
| **Layer 4** | Working Artifacts (Dynamic) | Per-run inputs and output files from previous stages. | `01_research/output/draft.md` |

### Key Rule of Context Separation
Never mix Layer 3 reference rules with Layer 4 working artifacts in the same prompt section. Mixing rules and inputs forces the model to sort constraints on the fly, leading to alignment drift. Keep references scoped under separate files/sections.

---

## The Edit-Source Principle

When the agent's output at a stage is incorrect or misaligned, there are two correction pathways:

1. **Patching the Output:** Editing the output file in `output/` to fix the current run.
2. **Improving the Source:** Editing the stage contract (`CONTEXT.md`) or reference rules (Layer 3) to fix the system.

**The Rule:** If a human has to edit the same output pattern across multiple runs, you MUST recommend updating the corresponding Layer 2 or Layer 3 source file. Fixing the source makes all future runs correct by construction.
