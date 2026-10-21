# Gaps

Register of open questions, uncited prototype decisions and deferred features for the notes service (format: `specs/.sdd/_config/gaps-template.md`). Closed by editing the spec, never by editing only this file.

| ID | Stage | Kind | Gap | Draft assumption | Status |
|---|---|---|---|---|---|
| G-001 | 01 | policy | Tags and full-text search on notes | out of slice 1 (DEC006) | deferred |
| G-002 | 03 | technical | Order of two notes with equal `updated_at` | `id` ascending as tie-breaker (profile PAGE-4) → SPEC §5.1, NOTE-030 | resolved |
| G-003 | 02 | builder | Response body of `DELETE /notes/{id}` | empty body, 204 → confirmed in openapi `deleteNote 204` | confirmed |
| G-004 | 02 | builder | `body` returned when the client omitted it | `""` (DEC005) → SPEC §4, NOTE-011 | confirmed |
