# UI State Matrix

**Stage 01 writes the matrix; Stage 02 shows every state; Stage 03 captures every state.** The brainstorming questions naturally focus on the success state, so empty, loading, error and edge-case states are listed here explicitly. A cell the interview did not answer is a `GAPS.md` row (kind `ui`) with a provisional state the prototype renders — the user judges it on screen, not in a question.

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
1. Every cell marked "?" is either answered or a `GAPS.md` row with a provisional state; the prototype renders the provisional state and the demo resolves it.
2. "Same as empty" or "Show error toast" are valid answers — but they must be explicit.
3. The completed matrix MUST appear in the DESIGN.md's UI State Matrix section.
4. Every non-success state gets a pinned test id (`<component>-empty|-loading|-error`, profile UI-4) and its text in the SPEC §14 Copy table.
5. Downstream: Stage 02 makes every state reachable in the prototype; Stage 03 captures every state as a wireframe; Stage 04 writes ≥ 1 frozen UI spec per state; Stage 06 verifies each one renders.

*(Wireframes are captured from the accepted prototype in Stage 03. Brainstorming focuses on requirements exploration and design direction — not production wireframes.)*
