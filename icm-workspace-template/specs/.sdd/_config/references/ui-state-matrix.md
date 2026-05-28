# UI State Matrix

**⛔ GATE:** You are FORBIDDEN from writing the design doc or proceeding to spec self-review until the UI State Matrix has been completed for every interactive component. This gate exists because the brainstorming visual questions naturally focus on the success state. Empty, loading, error, and edge-case states are systematically missed unless explicitly enforced.

For each interactive component identified during brainstorming, you MUST explicitly confirm or design the following states:

| Component | Empty | Loading | Success | Error | Edge Case |
|-----------|-------|---------|---------|-------|-----------|
| (fill in) | ? | ? | ✅ | ? | ? |

**State Definitions:**
- **Empty**: What does this component look like before any data exists?
- **Loading**: What does this component show while waiting for data?
- **Success**: The designed happy-path appearance (already covered by visual questions).
- **Error**: What happens when the data source fails or disconnects?
- **Edge Case**: What happens with unusual data (0 rows, 10K rows, missing fields)?

**Rules:**
1. Every cell marked "?" must be resolved with the user before proceeding.
2. "Same as empty" or "Show error toast" are valid answers — but they must be explicit.
3. The completed matrix MUST appear in the DESIGN.md's UI State Matrix section.

*(Screen Layout Walk and wireframe generation are handled by the `interactive-wireframing` skill, which is invoked by the SDD orchestrator after the spec is hardened. Brainstorming focuses on requirements exploration and design direction — not production wireframes.)*
