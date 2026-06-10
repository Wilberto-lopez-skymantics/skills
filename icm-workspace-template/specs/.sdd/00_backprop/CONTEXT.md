<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

# Stage 00: Backprop — Trace Bugs to Source

Bug found | test fails → ⊥ just fix code. ! edit spec back-to-source (add §V invariant) to prevent recurrence.

*Edit-Source Principle: repeatedly fix same error → trace root cause to source (spec, CONTEXT.md, or reference) & fix there.*

## When to Use This Stage

- Test fails during `05_development_swarm` | `07_verification_before_completion`.
- Bug reported post-deployment.
- Post-mortem reveals defect class.
- User explicitly asks trace bug back to source.

## Inputs
- Layer 4 (working): Bug report, test failure output, | post-mortem notes
- Layer 4 (working): `specs/SPEC.md`
- Layer 4 (working): `specs/.sdd/_config/sdd-state.json`
- Layer 3 (reference): All stage `CONTEXT.md` files in `specs/.sdd/` (read relevant stage context only)

## Process

### 1. Trace
Read failure output | bug report → locate exact file & line of wrong behavior. State root cause ∈ single sentence.

### 2. Analyze
Identify pipeline failure layer:
1. **Spec incomplete?** Spec failed define behavior → ! update `specs/SPEC.md` (add invariant, define behavior).
2. **Stage contract weak?** `CONTEXT.md` failed instruct check for problem → ! update relevant stage `CONTEXT.md` (add gate | attack role).
3. **Reference material wrong?** `_config/` file provided wrong guidance → ! update Layer 3 reference file.

### 3. Propose Source Fix
Draft spec | pipeline change. ! produce backprop log entry:
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

### 4. Generate Test
Invariant without test = wish. ! write failing test encoding invariant. Test name ! reference invariant.

### 5. Fix & Verify
Fix code. Run test → ! pass. Run full test suite → ⊥ regress.

### 6. Log & Save
Save spec edit, pipeline fix, test, & code fix together as single atomic commit. Append backprop entry to `specs/backprop-log.md` (create if ∄).

## Verify
- New invariant testable & test passes.
- Source fix prevents original bug recurrence.
- ⊥ duplicate gaps ∈ other stage contracts.

## Outputs
- Updated `specs/SPEC.md` (if spec incomplete)
- Updated stage `CONTEXT.md` (if contract weak)
- Updated `specs/.sdd/_config/` reference (if reference wrong)
- `specs/backprop-log.md`
- `specs/.sdd/_config/sdd-state.json`
- New test file & code fix

### Handoff / Transitions
1. **Update state:** Update `specs/.sdd/_config/sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`) with `lastCompletedStep: 0` & `stepName: "00_backprop"`.
2. **Handoff:** Return to stage where defect detected.
