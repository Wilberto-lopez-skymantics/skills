# Prototype Decision Inventory

Every observable decision the prototype makes, with the line that pins it or the gap it opened (format: `specs/.sdd/_config/prototype-record-template.md`).

| # | Decision | Observation | Pinned by | Gap |
|---|---|---|---|---|
| 1 | Create returns the full note | `POST /notes` → 201, body = note | openapi `createNote` 201; SPEC §5.1 | — |
| 2 | Default page size | `GET /notes` → 20 items, `has_more` | profile PAGE-2; openapi `listNotes` `limit` default | — |
| 3 | Tie-breaker on equal `updated_at` | `id` ascending | profile PAGE-4; SPEC §5.1 | — (G-002 resolved) |
| 4 | Editing a published note | `PATCH /notes/{id}` → 409 `NOTE_NOT_EDITABLE` | errors.json; statecharts `note` illegal transition; SPEC §5.2 (DEC002) | — |
| 5 | Delete response | `DELETE /notes/{id}` → 204, empty body | openapi `deleteNote` 204 | — (G-003 confirmed) |
| 6 | Omitted `body` on create | stored and returned as `""` | SPEC §4 (DEC005); profile SER-7 | — (G-004 confirmed) |
| 7 | Replayed `Idempotency-Key` with a different body | 422 `IDEMPOTENCY_MISMATCH` | profile IDEM-3; errors.json | — |
| 8 | Stale `If-Match` | 412 `PRECONDITION_FAILED`; missing header 428 | profile OCC-2, OCC-3; errors.json | — |
