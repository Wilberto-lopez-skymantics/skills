# Stage 00: Backprop — Trace Bugs to Source

When a bug is found or a test fails, the natural instinct is to fix the code and move on.
SDD does something different: it fixes the code **and** edits the spec so the class of bug
cannot recur. That edit-back-to-source step is backprop.

This stage implements the ICM paper's §6.3 "Edit-Source Principle": if you repeatedly fix
the same kind of output error, trace it back to the source (the CONTEXT.md, the reference
material, or the upstream stage output) and fix it there.

## When to Use This Stage

- A test fails during Stage 05 (development swarm) or Stage 07 (verification).
- A bug is reported after deployment.
- A post-mortem reveals a class of defect that should have been caught.
- The user explicitly asks to trace a bug back to its source.

## Inputs

- **Layer 4 (working):** Bug report, test failure output, or post-mortem notes
- **Layer 4 (working):** `specs/SPEC.md`
- **Layer 4 (working):** `specs/.sdd-state.json`
- **Layer 3 (reference):** All stage `CONTEXT.md` files in `specs/.sdd/` (read only the stage relevant to the root cause)

## Process

### Step 1: Trace

Read the failure output or bug report. Find the exact file and line of wrong behavior.
State the root cause in one sentence.

### Step 2: Analyze — Where Did the Pipeline Fail?

Ask three questions to identify which layer of the SDD pipeline allowed the bug through:

1. **Was the spec incomplete?** Did the specification fail to define behavior for this case?
   If yes → the fix belongs in `specs/SPEC.md` (add an invariant, define the missing behavior).

2. **Was a stage contract too weak?** Did a CONTEXT.md fail to instruct the agent to check
   for this class of problem? If yes → the fix belongs in the relevant stage's `CONTEXT.md`
   (add a gate, checklist item, or Red Team persona attack).

3. **Was reference material missing or wrong?** Did a `_config/` file provide incorrect
   guidance? If yes → the fix belongs in the Layer 3 reference file.

### Step 3: Propose the Source Fix

Draft the spec or pipeline change. Always produce a backprop log entry:

```markdown
## Backprop Entry

| Field | Value |
|-------|-------|
| Date | YYYY-MM-DD |
| Bug | One-sentence description |
| Root cause | What went wrong and why |
| Stage that failed | Which SDD stage should have caught this |
| Source fix | What spec/CONTEXT.md/reference change prevents recurrence |
| Invariant | Testable rule (if applicable) |
```

### Step 4: Generate a Test

A new invariant without a test is a wish, not a guarantee. Write a failing test that
encodes the invariant. Name the test so it references the invariant it validates.

### Step 5: Fix and Verify

Fix the code. Run the test — it must pass. Run the full test suite — it must not regress.

### Step 6: Log and Commit

Commit the spec edit, pipeline fix, test, and code fix together as a single atomic change.

Append the backprop entry to `specs/backprop-log.md` (create if it doesn't exist).

## Verify

After completing the backprop:
- Confirm the new invariant is testable and the test passes.
- Confirm the source fix (CONTEXT.md or reference material) would have prevented the
  original bug if it had been in place before the pipeline ran.
- Check that no other stage contracts have the same gap.

## Outputs

- Updated `specs/SPEC.md` (if spec was incomplete)
- Updated stage `CONTEXT.md` (if pipeline contract was too weak)
- Updated `specs/.sdd/_config/` reference file (if reference material was wrong)
- `specs/backprop-log.md` (cumulative log of all backprop entries)
- New test file
- Code fix
