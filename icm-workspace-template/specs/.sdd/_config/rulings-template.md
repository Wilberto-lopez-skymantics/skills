# Rulings Ledger Format (`specs/logs/02-rulings.md`)

Working file, never frozen. Every triaged Red Team finding of the current iteration gets exactly one row, whether it was raised in Stage 02 (round 1) or in Stage 03p (rounds 2–3, prototype running). Critics of later rounds receive the ledger; a finding that restates a ruled row without a new fork is dropped, not re-triaged. `sdd.cjs transition` refuses 02 and 03p while any row is `open`, and refuses a `gap` row without a matching `G-nnn` in `specs/GAPS.md`.

```markdown
# Rulings

| ID | Round | Persona | Finding | Fork | Ruling | Status |
|---|---|---|---|---|---|---|
| R-001 | 1 | Fork Tester | non-owner delete | `DELETE /notes/{id}` → 403 vs 404 | SPEC §5.3 + errors.json: 404 (DEC031) | fixed |
| R-002 | 1 | Quantifier | "large" payload | — | advisory: limit already pinned in SPEC §13 (1 MiB) | rejected |
| R-003 | 2 | Edge-Case Hunter | empty `tags` array | `PATCH /notes/{id} {"tags":[]}` → 200 vs 422 | policy question for the user → G-007 | gap |
| R-004 | 2 | Technical Writer | §5.2 wording | — | reword only | advisory |
```

- **Fork**: the concrete request (or UI interaction) and the two observations two spec-faithful builders could produce. `—` means no fork, so the finding is advisory by definition.
- **Ruling**: where the spec now pins it (section + contract + DECnnn), or why it was rejected (already pinned: cite where).
- **Status**: `fixed` | `rejected` (not a fork, or already pinned) | `advisory` (backlog; never blocks) | `gap` (moved to `specs/GAPS.md`; cite the G-nnn in the Ruling cell) | `open` (only while a round is in progress).
- Severity is the blocking/advisory classification, never the critic's own ranking.
