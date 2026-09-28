# ICM Examples and Templates

## Example Stage Contract: `CONTEXT.md`

Each stage folder must contain a `CONTEXT.md` defining the contract:

```markdown
# Stage 02: Script Generation

Translate the research outline into a video script.

## Inputs
- Layer 4 (working): ../01_research/output/research_report.md
- Layer 3 (reference): ../_config/voice_guidelines.md
- Layer 3 (reference): references/script_template.md

## Process
1. Read the research report to extract key arguments and sections.
2. Draft a dialogue script following the structural pacing in script_template.md.
3. Apply the tone and style rules defined in voice_guidelines.md.
4. Ensure the total reading time does not exceed 90 seconds.

## Outputs
- script_draft.md -> output/script_draft.md
```

---

## Example Workspace Routing: `WORKSPACE_ROUTING.md`

Located at the root of the workspace config folder:

```markdown
# Workspace routing map

Map user requests to the correct stage folder and read its CONTEXT.md.

## Stages
01. **`01_research/CONTEXT.md`**: Topic gathering and structured research.
02. **`02_script/CONTEXT.md`**: Creative writing and script formatting.
03. **`03_production/CONTEXT.md`**: Code generation and final assembly.
```

---

## Example State File: `sdd-state.json`

Tracks the status of pipeline execution:

```json
{
  "lastCompletedStage": "01_research",
  "activeStage": "02_script",
  "timestamp": "2026-06-08T13:18:00Z",
  "runId": "run-9827",
  "results": {
    "01_research": "SUCCESS: Research report created with 5 key arguments."
  }
}
```
