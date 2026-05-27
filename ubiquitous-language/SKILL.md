---
name: ubiquitous-language
description: Extract a DDD-style ubiquitous language glossary from the current conversation, flagging ambiguities and proposing canonical terms. Saves to UBIQUITOUS_LANGUAGE.md.
---

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

# Ubiquitous Language

Extract & formalize domain terminology from conversation → consistent glossary → local file.

## Process

1. **Scan conversation** for domain-relevant nouns, verbs, concepts
2. **Identify problems:**
   - Same word → different concepts (ambiguity)
   - Different words → same concept (synonyms)
   - Vague | overloaded terms
3. **Propose canonical glossary** with opinionated term choices
4. **Write to `UBIQUITOUS_LANGUAGE.md`** in working directory (format below)
5. **Output summary** inline in conversation

## Output Format

Write `UBIQUITOUS_LANGUAGE.md`:

```md
# Ubiquitous Language

## Order lifecycle

| Term        | Definition                                              | Aliases to avoid      |
| ----------- | ------------------------------------------------------- | --------------------- |
| **Order**   | A customer's request to purchase one or more items      | Purchase, transaction |
| **Invoice** | A request for payment sent to a customer after delivery | Bill, payment request |

## People

| Term         | Definition                                  | Aliases to avoid       |
| ------------ | ------------------------------------------- | ---------------------- |
| **Customer** | A person or organization that places orders | Client, buyer, account |
| **User**     | An authentication identity in the system    | Login, account         |

## Relationships

- An **Invoice** belongs to exactly one **Customer**
- An **Order** produces one or more **Invoices**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the **Invoice** immediately?"
> **Domain expert:** "No — an **Invoice** is only generated once a **Fulfillment** is confirmed. A single **Order** can produce multiple **Invoices** if items ship in separate **Shipments**."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User** — distinct concepts.
```

## Rules

- **Be opinionated.** Multiple words for same concept → pick best one, list others as aliases to avoid.
- **Flag conflicts explicitly.** Term used ambiguously → call out ∈ "Flagged ambiguities" with clear recommendation.
- **Domain terms only.** Skip module/class names unless they have domain meaning. Skip generic programming concepts (array, function, endpoint).
- **Definitions tight.** One sentence max. Define what it IS, not what it does.
- **Show relationships.** Bold term names, express cardinality where obvious.
- **Group terms** into multiple tables when natural clusters emerge (by subdomain, lifecycle, actor). Single cohesive domain → one table fine, ⊥ force groupings.
- **Write example dialogue.** 3-5 exchanges between dev & domain expert demonstrating terms interacting naturally. Clarify boundaries between related concepts.

## Re-running

When invoked again ∈ same conversation:

1. Read existing `UBIQUITOUS_LANGUAGE.md`
2. Incorporate new terms from subsequent discussion
3. Update definitions if understanding evolved
4. Re-flag new ambiguities
5. Rewrite example dialogue to incorporate new terms
