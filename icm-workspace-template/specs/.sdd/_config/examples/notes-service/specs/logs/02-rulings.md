# Rulings

Every triaged Red Team finding of the current iteration (format: `specs/.sdd/_config/rulings-template.md`). All rounds ran in Stage 03p with the prototype running (round 1 full, round 2 delta).

| ID | Round | Persona | Finding | Fork | Ruling | Status |
|---|---|---|---|---|---|---|
| R-001 | 1 | Fork Tester | Editing a published note | `PATCH /notes/{id}` on a published note → 409 vs 422 | SPEC §5.2 + errors.json `NOTE_NOT_EDITABLE` 409 (DEC002); NOTE-053 | fixed |
| R-002 | 1 | Systems Invariant Auditor | Empty patch `{}` | `PATCH /notes/{id} {}` → 422 vs 200 with version + 1 | profile OCC-1: every successful mutation increments `version`; SPEC §5.2 (DEC004); NOTE-059 | fixed |
| R-003 | 1 | Quantifier | "reasonable" title length | — | already pinned: SPEC §13 title ≤ 200 code points; openapi `maxLength` | rejected |
| R-004 | 1 | Edge-Case Hunter | Tie order on equal `updated_at` | `GET /notes` two notes same timestamp → either order | moved to the gap register → G-002 | gap |
| R-005 | 2 | Fork Tester | Delete response body | `DELETE /notes/{id}` → 204 empty vs 200 with note | prototype returned 204 empty; openapi `deleteNote` pins 204, no body (G-003 confirmed) | fixed |
| R-006 | 2 | Technical Writer | §5.1 pagination prose duplicates the contract | — | reword: point to openapi `listNotes` instead of restating | advisory |
