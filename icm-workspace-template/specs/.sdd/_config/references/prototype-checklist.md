# Prototype Checklist (Stage 02)

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

The Equivalence Profile (`systems-standards.md`) applies to every build, the prototype included, and Stage 03 enforces all of it against the running prototype. This page is the short list a v0 follows **now**, because retrofitting these rewrites the prototype instead of patching it. Rule ids point into the profile; read a rule only when you build the thing it governs.

## All interfaces
- **SER-2** timestamps RFC 3339 UTC, millisecond precision, `Z` suffix; stored at the same precision.
- **SER-3** ids are server-generated UUIDv7 (lowercase, hyphenated); ⊥ client ids, ⊥ integers.
- **SER-6** `snake_case` field names end to end (JSON, query, columns); lowercase `snake_case` enums.
- **SER-7** every declared response property always present (`null` when no value); empty collections `[]`.
- **SER-11** every list has a total order ending in `id`; binary code-point string order (`COLLATE "C"`).
- **ENV-1** process timezone UTC. **ENV-3** every TTL, limit, window, batch size reads an env var with a default (SPEC §12 gets the table in Stage 03).

## http
- **ERR-1** every error body is the 8-member problem document (`type`, `title`, `status`, `detail`, `instance`, `code`, `retryable`, `errors`); codes `SCREAMING_SNAKE_CASE`, 422 for validation, 404 for unknown ids, 409 for state conflicts.
- **IDEM-1** every `POST` requires `Idempotency-Key` (UUID); a naive store-and-replay is enough now (IDEM-4…6 in Stage 03).
- **OCC-1/2/3** mutable entities carry `version` (starts at 1, +1 per mutation), single-resource responses send `ETag: "v<version>"`, `PATCH`/`PUT`/`DELETE` take `If-Match` (missing → 428, stale → 412).
- **PAGE-1/2** collection `GET`s take `limit` (default 20, max 100) and `cursor`; respond `{"data": [...], "pagination": {"next_cursor", "has_more"}}`.
- **SER-8** unknown request properties and query parameters → 422.

## cli
- **CLI-1** exit codes `0` success, `1` runtime/domain error, `2` usage error. **CLI-2** `--json` prints exactly one JSON document to stdout; diagnostics go to stderr. **CLI-4** output ends with one `\n`, no color when piped.

## browser
- **UI-1** every component in SPEC §14 renders `data-testid="<kebab-case name>"` (= its `DESIGN.md` `components:` key); repeated items add `data-key`.
- **UI-2** visible static text comes from the SPEC §14 copy table — what you invent goes into the table in the same step.
- **UI-4** every UI State Matrix state renders `<component>-empty|-loading|-error`.
- `DESIGN.md` tokens only: no stray hex colors, font sizes or radii (Stage 03's token check fixes the prototype, not the wireframe).

## Storage
- The engine SPEC §10 declares (unset → PostgreSQL 16 for services, the browser's storage for client apps); real DDL you keep in the repo — Stage 03 lifts it into `schema.sql` | `storage.schema.json`.

## Not now (Stage 03 finds and fixes these with the Fork Tester)
HTTP-9 validation and precedence order, rate limits (§7), retry curves (§8), ENV-5/ENV-6 testability delays, exact error precedence between two applicable errors, idempotency fingerprint rules.
