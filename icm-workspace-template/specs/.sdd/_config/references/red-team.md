<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Red Team Reference (hardening rounds, Stage 03p)

Every adversarial round of the pipeline runs against a **running prototype** (Stage 03p). Round 1 attacks the whole slice; rounds 2–3 attack the delta. Hard cap 3 rounds per iteration. This file holds the personas and rules; the stage contract holds the sequence.

## Personas (each attacks prose **and** contracts, and can execute requests)
1. **Contract & Schema Auditor** — name/type mismatches between contracts and SPEC; unpinned types (`string` where UUIDv7/regex/enum is meant).
2. **Systems Invariant Auditor** — Equivalence Profile compliance: IDEM, OCC, PAGE, ERR, HTTP-9 evaluation order; every deviation is an override in SPEC §11 + manifest.
3. **Fork Tester** — ∀ operation: *could two competent builders, reading only these files, return different observations?* Probe status, headers, field presence, null vs absent, ordering, rounding, normalization, error precedence. **Execute it:** send the request to the prototype, compare with a spec-only reading. Prototype ≠ pinned value → prototype bug (fix now). Spec silent → blocking finding.
4. **Edge-Case Hunter** — missing fallbacks, undefined error paths, timeouts.
5. **Chaos Engineer** — ordering, consistency, availability assumptions; split-brain.
6. **Resource Starver** — unbounded growth, missing pagination, no retention.
7. **Quantifier** — vague parameters: ∀ number is an exact value, bounded range, formula or config ref (`sdd.cjs check` flags the obvious hedges; the Quantifier finds the rest: "based on" without a formula, config named without a schema).
8. **Reconciler** — the prototype's code (and any existing system) vs SPEC and contracts. <anti_hallucination>⊥ assume the spec is right; read the files, flag every discrepancy.</anti_hallucination>

## Round 1 judgment checklist (what `check` cannot see; each item answered in the log, not rubber-stamped)
internal consistency (sections and contracts agree) · scope fits one implementation plan · every requirement has one reading · DECISION_LOG ↔ SPEC, nothing from the interview missing · config files/env vars have exact shapes (SPEC §12; ENV-3: every TTL, limit, window, batch size is a variable with a default) · §9 lists every degree of freedom and nothing else (= the future `variablePaths`) · concurrency and transactions (races, isolation, rollback, file↔db atomicity) · exact resource limits and backoff curves · determinism (total ordering, seeds/PRNG, numeric representation, string normalization) · hardware/policy blocks have fallbacks (audio, WebGL, permissions) · UI: WCAG AA contrast for every DESIGN.md text/background pair, component tokens complete (`backgroundColor`, `textColor`, `rounded`, interactive states), copy table character-exact (UI-2), test ids for every component and state (UI-1, UI-4), auxiliary screens present (splash, loading, settings, auth, error boundary, confirmations, empty states), fast inputs throttled.

## Findings are falsifiable
- **Blocking** = a concrete request (or UI interaction) + two observations two spec-faithful builders could each produce + the missing/contradicting citation. Example: `DELETE /notes/{id}` by a non-owner → `403` vs `404`; SPEC §5.3 names neither. Two contract files disagreeing counts as a fork.
- **Advisory** = no fork (wording, style, hypothetical scale). Logged `advisory`; never blocks, never triggers a round.
- Severity is this classification, never the critic's ranking. "Zero findings of any severity" is not a goal; a manufactured finding hides real ones.

## Rulings ledger (`specs/logs/02-rulings.md`)
Every triaged finding → one row (`../rulings-template.md`): `fixed` | `rejected` (cite where it is already pinned) | `advisory` | `gap` (→ `GAPS.md` G-nnn) | `open`. Later rounds receive the ledger; a finding that restates a ruled row without a new fork is dropped, not re-triaged.

## Technical vs policy
- **Technical (mechanics)** → the Blue Team resolves autonomously by the profile. ⊥ ask the user about status codes, index design, cursors, DDL types.
- **Policy (a business decision the interview missed)** → the user, exactly one question per message, batched to the end of the round — ideally asked at a prototype demo, where the question is concrete. Answer → DECISION_LOG + SPEC. ⊥ resolve policy with a "sensible default": that is the builder guess this pipeline exists to prevent. Unanswerable yet → `GAPS.md` row (kind `policy`, provisional DECnnn); the prototype keeps the provisional answer; Stage 04 refuses to freeze while it is open.

## Rounds
- **Round 1 (full):** all personas, whole slice, prototype running. Blue Team fixes technical findings (spec + contracts + prototype in the same step), `sdd.cjs check --contracts` after every fix.
- **Rounds 2–3 (delta):** only sections and contracts changed since the previous round (by resolution or by user feedback) + whatever references them + every `GAPS.md` row of kind `builder`. The attack surface shrinks every round; that is what converges.
- **Cap: 3 per iteration** (`## 🔄 Iteration N` headings in `specs/logs/02-swarm.md` since the transition that opened the iteration). A round with zero blocking findings ends the loop. Leftover blocking findings after round 3 → the user, one per message with a recommendation; ⊥ a round 4.
- An operation or lifecycle added by user feedback gets a full (not delta) attack in the next round, and the Outcome Table is extended.

## Visible logs
Every round written in full (format: `../iteration-log-format.md` §Adversarial Swarm) to `specs/logs/02-swarm.md`, with `sdd.cjs check --contracts` output pasted before the attack. ⊥ "internally looped"; a summarized log invalidates the run.
