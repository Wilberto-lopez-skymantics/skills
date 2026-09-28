# Extraction Closure & Domain Invariant Contract

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

Empirical replacement for subjective confidence scoring. Guarantees zero unconstrained domain degrees of freedom before design presentation.

**⛔ GATE:** ⊥ propose approaches (Step 4) | write design until domain model passes ALL 4 Extraction Closure dimensions with zero remaining gaps. Self-assessed numeric scores (e.g. "85/100") = FORBIDDEN.

---

## The 4 Empirical Closure Dimensions

### 1. Entity Lifecycle & Transition Closure (Finite State Completeness)
∀ identified domain entity:
- [ ] **State Enumeration:** Complete set of states $S = \{s_1, s_2, \dots, s_n\}$ explicitly declared.
- [ ] **Deterministic Transitions:** ∀ legal transition ! specify:
  $$\text{Current State } (s_i) \xrightarrow[\text{Actor / Role } + \text{ Guard Condition}]{\text{Event / Trigger}} \text{New State } (s_j)$$
- [ ] **Negative Transition Policy:** Attempted illegal transition (e.g. cancel after ship) ! declare explicit error behavior (HTTP code, error envelope, rejection message).
- [ ] **Terminal State Semantics:** Terminal states (Deleted, Archived, Cancelled, Completed) ! explicitly declare data retention, tombstone vs purge policy, and cascade rules for dependent entities.
*Unspecified transition, missing guard, or dangling state = GATE FAIL.*

### 2. Negative Space & Invariant Definition
System definition ! define what is strictly forbidden, not just happy-path features:
- [ ] **System Invariants (§V):** List of mathematical/business rules that ! NEVER be violated (e.g. `balance >= 0`, `tenant_id immutable`, `seats_booked <= total_seats`).
- [ ] **Authorization Boundaries:** Explicitly define who is DENIED access, not just permitted roles.
- [ ] **Mutation Failure Policies:** ∀ state-changing operation, declare failure behavior:
  - Atomic rollback vs compensating transaction (saga) vs dead-letter queue.
  - User-facing error code and recovery path.
- [ ] **Resource & Rate Bounds:** Maximum payload size, maximum batch size, pagination limit ceiling, rate limit policy.
*Missing invariant or undefined failure policy = GATE FAIL.*

### 3. The Fork Test (Degree-of-Freedom Audit)
Adversarial check: *"Could Coder A and Coder B reasonably implement conflicting business behaviors given the extracted requirements?"*
Audit the domain model against these variance vectors:
- [ ] **Deletion Semantics:** Soft-delete (`is_deleted`) vs hard-delete vs GDPR cryptoshredding?
- [ ] **Concurrency Conflict Resolution:** Optimistic concurrency (version/ETag) vs pessimistic lock vs last-write-wins?
- [ ] **Consistency Bounds:** Strong read-after-write vs eventual consistency tolerance?
- [ ] **Ordering & Tie-Breakers:** Multi-item queries ! specify deterministic secondary sort (e.g. `created_at DESC, id ASC`).
- [ ] **Idempotency Window:** Repeated mutation submissions within $N$ seconds ! specify deduplication behavior.
*Any unpinned variance vector that alters user-observable behavior = GATE FAIL.*

### 4. Policy vs. Mechanics Separation Protocol
Prevent user interview fatigue while enforcing rigor:
- **Domain & Business Policy (Human Authority):** Business rules, permissions, pricing, legal boundaries, workflow triggers, domain entities.
  - Rule: AI ⊥ guess | assume. ! ask user directly (one question per message).
- **Technical Plumbing & Mechanics (AI Synthesizer):** Pagination standards (cursor-based), UUIDv7 vs NanoID, HTTP status mappings, retry backoff algorithms, date serialization formats.
  - Rule: AI ! propose industry-standard default, explain rationale in 1 sentence, and ask user only for confirmation or override. ⊥ interrogate user with open-ended technical plumbing questions.

---

## Shadow Critic Verification & Sign-Off Report

Before advancing to Step 4 (Propose Approaches), the Shadow Critic ! evaluate the domain model and output the Extraction Closure Report:

```markdown
### Extraction Closure Verification Report

- [x/ ] 1. Entity Lifecycle Closure: [PASS / FAIL - explain dangling states]
- [x/ ] 2. Negative Space & Invariants: [PASS / FAIL - explain unstated failure policies]
- [x/ ] 3. The Fork Test: [PASS / FAIL - list unpinned business ambiguities]
- [x/ ] 4. Policy vs Mechanics Protocol: [PASS / FAIL - confirm zero guessed domain policies]

**Remaining Domain Policy Gaps:** [0 / List of specific probing questions for the Architect to ask next]
**Verdict:** [PASS -> proceed to Step 4 | FAIL -> continue clarifying questions]
```

**⛔ GATE:** Verdict = FAIL | Gaps > 0 → Agent ! convert highest-priority gap into the next single clarifying question to the user. ⊥ present design until Verdict = PASS.
