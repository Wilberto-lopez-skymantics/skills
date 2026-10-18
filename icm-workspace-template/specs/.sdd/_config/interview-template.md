# Interview Log Format (`specs/logs/01-interview.md`)

Working file, never frozen. One row per question the Lead Architect asked the user in Stage 01. It is the audit trail of "every business decision is made with the user", and its length is the stage's budget (default 20 per slice, `manifest.budgets.interviewQuestions`): `sdd.cjs readiness` shows the count against the budget; the gate requires the file, not a count.

```markdown
# Interview

| # | Question | Answer | Recorded in |
|---|---|---|---|
| 1 | Who uses the service, and is there more than one actor? | A single anonymous actor behind an authenticating gateway | DEC001, SPEC §3 |
| 2 | Can a published note be edited? | No; published text must stay citable | DEC002, SPEC §5.2, V2 |
| 3 | Are tags and search part of the first slice? | No; see the product first | DEC006, G-001 |
| 4 | Who may delete a shared note? | (not yet — deferred to the prototype demo) | G-007, provisional: owner only |
```

- **Question**: verbatim, one per row, one per message (the One Question at a Time rule).
- **Answer**: the user's answer, or "(not yet — deferred to the prototype demo)" when the question is better asked with the product on screen.
- **Recorded in**: the DECnnn and SPEC § the answer became, or the `G-nnn` row that holds the open question with its provisional assumption.
- Over budget is a signal, not a block: the remaining questions belong in Stage 03p demos, where they are concrete.
