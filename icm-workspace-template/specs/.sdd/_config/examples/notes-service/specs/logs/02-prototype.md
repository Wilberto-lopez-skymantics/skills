# Prototype record
**Run:** `docker compose up -d`
**Target:** `http://localhost:3000`
**Build environment:** profile defaults (`PAGE_SIZE_DEFAULT=20`, `CONCURRENCY_DELAY_MS=250` per SPEC §12)
**Feedback rounds:** 2 (DEC005: default `body` is `""`; DEC006: tags and search deferred to slice 2)
**Hardening rounds:** 2 in Stage 03 (round 1 full, round 2 delta with zero blocking findings → loop ended)
**Acceptance:** recorded by `sdd.cjs transition --completed 02 --approved-by "<user>"` (see `specs/logs/transitions.jsonl`)

## Versions
| Version | Date | Changed | Gaps closed | Decisions |
|---|---|---|---|---|
| v0 | 2026-10-10 | create, get, list, update, publish, delete from the slice brief | — | — |
| v1 | 2026-10-11 | omitted `body` stored as `""`; delete returns 204 empty | G-003, G-004 | DEC005 |
| v2 | 2026-10-12 | tie-breaker on equal `updated_at`; tags/search button removed | G-002 | DEC006 |
