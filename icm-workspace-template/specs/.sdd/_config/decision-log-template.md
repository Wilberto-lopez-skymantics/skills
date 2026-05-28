# DECISION_LOG.md Template & Rules

This file defines the canonical template for `specs/DECISION_LOG.md`. It is referenced by:
- `brainstorming/SKILL.md` — creates the initial DECISION_LOG.md
- `spec-driven-development/SKILL.md` — verifies it exists and references it as the "why"

---

## Template

```markdown
# Decision Log

| # | Decision | Options Considered | Choice | Rationale |
|---|----------|-------------------|--------|----------|
| 1 | Example: Data storage | PostgreSQL, SQLite, localStorage | localStorage | Client-only app, no server required — user confirmed |
```

## Rules

- Every decision made during brainstorming MUST appear in this table — even ones that felt obvious.
- If a decision was made by the user selecting from options, list all options considered.
- If a decision was made by the AI recommending and the user approving, note that in the Rationale.
- If a decision involves a numeric parameter, the Choice column MUST contain the exact value or range — not vague language.
