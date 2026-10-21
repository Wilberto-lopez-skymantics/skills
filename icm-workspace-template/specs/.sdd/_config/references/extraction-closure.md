# Extraction Closure & Domain Invariant Contract

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

Empirical replacement for subjective confidence scoring. Two gates use it: the **Core-flow closure** ends the Stage 01 interview (what the prototype cannot be built without); the **four closure dimensions** are the domain checklist of Stage 03's first Red Team round, judged against the running prototype. Self-assessed numeric scores (e.g. "85/100") = FORBIDDEN in both.

**Scope by project type:** apply every item that the project type can exhibit. Items that cannot apply (authorization boundaries in a single-user offline game, idempotency windows in a pure library) are answered `N/A — <reason>` in the report, never skipped silently.

**Plumbing is pre-decided:** the technical variance vectors (concurrency control, pagination, tie-breakers, idempotency, serialization) are pinned by the Equivalence Profile (`systems-standards.md`). Stage 01 never asks the user about them; Stage 03 asks only where a business requirement conflicts with a profile default (→ override).

---

## Core-flow closure (Stage 01 gate)

The interview stops — and the slice brief is written — when every item below is answered; everything else the Shadow Critic can think of is a `specs/GAPS.md` row (kind `policy`) with a provisional assumption the prototype builds and the user judges at a demo. Zero *unrecorded* gaps, not zero gaps.

- [ ] **Actor(s):** who uses the slice, and whether more than one role exists (a denial the slice must show counts; the full permission matrix does not).
- [ ] **Primary entity & lifecycle:** the main thing the slice creates or changes, its states, and the one or two transitions the core flow exercises. Other transitions, terminal retention, cascades → recorded.
- [ ] **Core flow:** the sequence the user will walk through in v0, start to finish, in their words — the operations | screens it touches.
- [ ] **Forbidden by design:** anything the user named as "never" (a rule the prototype must not violate even provisionally).
- [ ] **Out of slice:** every feature the user mentioned that v0 will not show → `deferred` row with its DECnnn.

```markdown
### Core-flow closure
- [x] Actor(s): …            - [x] Primary entity & lifecycle: …
- [x] Core flow: …           - [x] Forbidden: … | none named
- [x] Out of slice: G-…, G-…
**Recorded gaps (provisional):** G-… (n rows)   **Unrecorded gaps:** 0
**Verdict:** PASS → slice brief | FAIL → next single question (within the budget)
```

**⛔ GATE:** Verdict = FAIL | unrecorded gaps > 0 → the Lead Architect asks the highest-priority gap as the next single question (within the budget, `sdd.cjs readiness`), or records it as a `GAPS.md` row. ⊥ present the slice brief until Verdict = PASS.

---

## The 4 Closure Dimensions (Stage 03, Round 1 domain checklist)

The Red Team's domain personas (Fork Tester, Edge-Case Hunter, Systems Invariant Auditor) answer every item below in the Round 1 log, each with a citation into SPEC / contracts, a fix, or a `GAPS.md` row — against the running prototype, where "what happens if…" can be executed instead of imagined.

### 1. Entity Lifecycle & Transition Closure (Finite State Completeness)
∀ identified domain entity:
- [ ] **State Enumeration:** Complete set of states $S = \{s_1, s_2, \dots, s_n\}$ explicitly declared (`statecharts.json`).
- [ ] **Deterministic Transitions:** ∀ legal transition ! specify:
  $$\text{Current State } (s_i) \xrightarrow[\text{Actor / Role } + \text{ Guard Condition}]{\text{Event / Trigger}} \text{New State } (s_j)$$
- [ ] **Negative Transition Policy:** Attempted illegal transition (e.g. cancel after ship) ! declare explicit error behavior (HTTP code, error envelope, rejection message).
- [ ] **Terminal State Semantics:** Terminal states (Deleted, Archived, Cancelled, Completed) ! explicitly declare data retention, tombstone vs purge policy, and cascade rules for dependent entities.
*Unspecified transition, missing guard, or dangling state = blocking finding.*

### 2. Negative Space & Invariant Definition
System definition ! define what is strictly forbidden, not just happy-path features:
- [ ] **System Invariants (§8):** List of mathematical/business rules that ! NEVER be violated (e.g. `balance >= 0`, `tenant_id immutable`, `seats_booked <= total_seats`), as `- **Vn:**` bullets fixtures can cite.
- [ ] **Authorization Boundaries:** Explicitly define who is DENIED access, not just permitted roles.
- [ ] **Mutation Failure Policies:** ∀ state-changing operation, declare failure behavior:
  - Atomic rollback vs compensating transaction (saga) vs dead-letter queue.
  - User-facing error code and recovery path.
- [ ] **Resource & Rate Bounds:** Maximum payload size, maximum batch size, pagination limit ceiling, rate limit policy — exact numbers (SPEC §13).
*Missing invariant or undefined failure policy = blocking finding.*

### 3. The Fork Test (Degree-of-Freedom Audit)
Adversarial check: *"Could Coder A and Coder B reasonably implement conflicting business behaviors given the extracted requirements?"* Executed, not imagined: send the request to the prototype, compare with a spec-only reading.
Audit the domain model against these variance vectors:
- [ ] **Deletion Semantics:** Soft-delete (`is_deleted`) vs hard-delete vs GDPR cryptoshredding? (business policy — ask)
- [ ] **Concurrency Conflict Resolution:** profile default = OCC (OCC-1…4). Does any workflow need something else? (ask only on conflict)
- [ ] **Consistency Bounds:** Strong read-after-write vs eventual consistency tolerance?
- [ ] **Ordering:** profile default = `created_at DESC, id DESC` (PAGE-3). Which business listings need a different primary order?
- [ ] **Idempotency Window:** profile default = 24 h per principal (IDEM-2). Does any operation need a different window or none?
- [ ] **Visible text & formats:** user-facing messages, number/date display formats, rounding of displayed values — pinned (copy table, SPEC)?
*Any unpinned variance vector that alters user-observable behavior = blocking finding.*

### 4. Policy vs. Mechanics Separation Protocol
Prevent user interview fatigue while enforcing rigor:
- **Domain & Business Policy (Human Authority):** Business rules, permissions, pricing, legal boundaries, workflow triggers, domain entities.
  - Rule: AI ⊥ guess | assume. ! ask user directly (one question per message, batched to the end of the round, asked at a demo).
- **Technical Plumbing & Mechanics (pinned by the Equivalence Profile):** Pagination, id formats, HTTP status mappings, error envelope, retry backoff, date serialization — already decided in `systems-standards.md`.
  - Rule: ⊥ ask the user about plumbing. Only when a business requirement conflicts with a profile rule, explain the conflict in 1 sentence and ask whether to override it (→ DECISION_LOG + `manifest.json#profileOverrides`).

---

## Round 1 closure report (in `specs/logs/03-swarm.md`)

```markdown
### Extraction Closure Verification Report

- [x/ ] 1. Entity Lifecycle Closure: [PASS / findings R-nnn — explain dangling states]
- [x/ ] 2. Negative Space & Invariants: [PASS / findings R-nnn — explain unstated failure policies]
- [x/ ] 3. The Fork Test: [PASS / findings R-nnn — list unpinned business ambiguities, each executed against the prototype]
- [x/ ] 4. Policy vs Mechanics Protocol: [PASS / confirm zero guessed domain policies; policy questions batched: G-nnn, …]

**Verdict:** [PASS | n blocking findings → rulings ledger]
```

A dimension that fails is not a reason for another interview: each failing item is a finding in the rulings ledger (`fixed` | `gap` → `GAPS.md`), and the policy questions are asked at the next demo.
