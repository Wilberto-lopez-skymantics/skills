# Systems & Concurrency Invariant Standards

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

Mandatory technical standards for backend services, APIs, and persistent state machines to guarantee observational equivalence across independent coding agents.

---

## 1. Idempotency Standard

∀ state-mutating HTTP endpoint (`POST`, `PATCH`, `PUT` creating side effects):
- **Header:** `Idempotency-Key: <UUIDv4 | UUIDv7>` (Mandatory on payment, order, state-transition endpoints).
- **Deduplication Window:** Minimum 24 hours ($86,400\text{ seconds}$).
- **Concurrency / In-Flight Rule:** 
  - Second request arrives with same `Idempotency-Key` while first request still processing → ! return `409 Conflict` with `Retry-After: <seconds>` OR block until first completes (pinned in spec). ⊥ process concurrently.
- **Completed Request Replay:**
  - Second request arrives after completion → ! return identical cached response body, status code, and headers (`Idempotent-Replay: true`). ⊥ re-execute business logic.
- **Payload Mismatch Rule:**
  - Same `Idempotency-Key` with different payload / params → ! return `422 Unprocessable Entity` (`ERR_IDEMPOTENCY_MISMATCH`).

---

## 2. Concurrency & Mutation Isolation

∀ mutable entity in persistent storage:
- **Default Concurrency Model:** **Optimistic Concurrency Control (OCC)** via `version` column (`INT NOT NULL DEFAULT 1`).
  - Read query ! select `version`.
  - Mutation query ! execute:
    ```sql
    UPDATE entity_table 
    SET column = :new_val, version = version + 1, updated_at = NOW()
    WHERE id = :id AND version = :expected_version;
    ```
  - Rows affected = 0 → ! return `409 Conflict` (`ERR_CONCURRENT_MUTATION`), roll back transaction. ⊥ overwrite silently (last-write-wins forbidden unless explicitly justified).
- **HTTP ETag Binding:** REST APIs exposing OCC ! return `ETag: "v<version>"` and require `If-Match: "v<version>"` on mutating requests.

---

## 3. Pagination & Deterministic Sorting

∀ endpoint returning list/collection:
- **Format:** Cursor-based pagination (opaque Base64-encoded cursor). Offset-based pagination forbidden on tables with $>10,000$ rows or real-time inserts.
- **Cursor Payload:** Encodes `(last_sort_value, last_id)`.
- **Deterministic Tie-Breaker:** Multi-item queries ! specify primary sort AND secondary unique tie-breaker:
  - Example: `ORDER BY created_at DESC, id ASC`
  - Unordered SQL queries (`SELECT * FROM table` without tie-breaker) = AUTOMATIC FAIL.
- **Page Size Contract:**
  - `limit` parameter default: 20.
  - `limit` parameter ceiling: 100.
  - Client requests `limit > 100` → clamp to 100 OR return `400 Bad Request`.
- **Response Envelope:**
  ```json
  {
    "data": [ ... ],
    "pagination": {
      "has_more": true,
      "next_cursor": "ZXhhbXBsZV9jdXJzb3I=",
      "prev_cursor": null
    }
  }
  ```

---

## 4. Canonical Error Taxonomy & Envelope

∀ error response returned by any service or API:
- **Envelope Standard (RFC 7807 / RFC 9457 compliant):**
  ```json
  {
    "error": {
      "code": "RESOURCE_CONFLICT",
      "message": "Human readable description of the error.",
      "target": "order.status",
      "details": [
        {
          "field": "version",
          "issue": "Version mismatch. Resource was modified concurrently."
        }
      ],
      "retryable": false,
      "doc_url": "https://docs.api.example/errors/RESOURCE_CONFLICT"
    }
  }
  ```
- **Error Code Format:** `SCREAMING_SNAKE_CASE` strings (e.g. `NOT_FOUND`, `INVALID_CREDENTIALS`, `RATE_LIMITED`).
- **HTTP Status Mapping:**
  - Invalid client syntax/payload schema: `400 Bad Request` (`BAD_REQUEST`)
  - Missing authentication token: `401 Unauthorized` (`UNAUTHENTICATED`)
  - Authenticated user lacks permission: `403 Forbidden` (`PERMISSION_DENIED`)
  - Resource not found: `404 Not Found` (`NOT_FOUND`)
  - Concurrency collision or invalid state machine transition: `409 Conflict` (`RESOURCE_CONFLICT` / `INVALID_STATE_TRANSITION`)
  - Validation failure on well-formed payload: `422 Unprocessable Entity` (`VALIDATION_ERROR`)
  - Rate limit exceeded: `429 Too Many Requests` (`RATE_LIMITED` with `Retry-After` header)
  - Unhandled server fault: `500 Internal Server Error` (`INTERNAL_SERVER_ERROR`, sanitizing internal stack traces)

---

## 5. Resilience & Timeout Budgets

∀ integration point (external HTTP API, database, cache, message broker):
- **Connection Timeout:** Pinned (default $\le 3,000\text{ms}$).
- **Read Timeout:** Pinned (default $\le 10,000\text{ms}$).
- **Retry Policy:** 
  - Idempotent reads: Max 3 retries with Exponential Backoff + Full Jitter ($\text{base} = 200\text{ms}$, $\text{cap} = 2,000\text{ms}$).
  - Non-idempotent writes: ⊥ retry automatically unless idempotency key is confirmed active on destination.
- **Circuit Breaker:** Pinned failure threshold ($5$ consecutive errors in $10\text{s}$) $\to$ open circuit for $30\text{s}$.
