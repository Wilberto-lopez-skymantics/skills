# The page brief

Every landing page made with this skill has one file, `page-brief.md`, that records what the page is
for and what its owner has settled. It is first in the order of authority: where it speaks, it wins
over the brand's inherited system, over this skill's ownership notes and over the source.

It does three jobs.

- It is what the page is **built from**: the offer, the audience and the action.
- It is the list of **what is true**: a fact that is not in it does not go on the page.
- It is what the page is **reviewed against**: reviewers are handed it, so a recorded choice is not
  reported as a fault, and a page that departs from its own brief is.

A starting copy is in `assets/page-brief.example.md`.

## Where it lives

Beside the page, under version control. One brief per page: a second offer or a second audience is
a second page with a second brief. In a spec-driven workspace keep it outside the frozen `specs/`
set, because its decisions grow by appending.

## Sections

Use these headings, in this order. Leave a section out rather than fill it with a guess: a missing
section means "not decided", and the work stops there to ask.

| Section | Holds |
|---|---|
| `## Offer` | Exactly what a visitor gets, what it costs them (money, details, time), and what counts as the page having worked. |
| `## Audience` | Who the page is for, the problem in their own words, what they already know and believe when they arrive, and the device most of them use. |
| `## Arrival` | Where visitors come from (an advertisement, a search, an email, a link from a named place), and the words and the promise they saw there. One entry per source. |
| `## Action` | The one action, the words on its button, what it asks of the visitor (each field, and why it is needed), and what happens after it is pressed. |
| `## Proof` | The facts that exist, one per line, each with where it comes from: prices, numbers with their date, customers who may be named, logos that may be shown, quotations with the speaker's name, role and permission, awards, guarantees and their terms, the pictures and films that exist. Then, under "Not available", the kinds of proof that do not exist, so that nobody supplies them. |
| `## Objections` | The reasons this audience does not act today, most common first, each with its true answer. |
| `## Brand` | The values this page must use. One short entry for each of: Type, Colour, Shape, Spacing, Motion, Imagery, Voice. Where the brand keeps a value somewhere else (a token file, a guidelines document), say where instead of copying it. Leave an entry out where the brand has no value. |
| `## Layout` | Which of the source's four layout types (A3) and why. |
| `## Search and sharing` | Whether the page should be found by search or kept out of it, and why; the title and the description if it should. |
| `## Decisions` | The dated decisions, below. |

Write for a reader who has never met the product. Reviewers are handed this file with no other
knowledge of the page. For the same reason it holds nothing about how the page is being worked on or
reviewed: no scores, no findings, no account of what was tried.

## Decisions

Append-only, newest last, numbered and never renumbered.

```markdown
### D-003
- **Date:** 2026-11-11
- **Decision:** The main action stays "Book a demo"; there is no self-service trial.
- **Why:** Every account needs data imported by our team before it is useful.
- **Applies to:** every section
- **Supersedes:** none
```

A decision that changes an earlier one names it under Supersedes; the earlier one stays in the
file. A decision the worker had to assume in order to carry on is written with
`- **Status:** assumed, to be confirmed by <owner>` and is not settled until the owner removes
that line.

## Rules

1. **The brief wins.** Over the brand's general system, over this skill, over the source.
2. **Only the owner settles it.** A worker proposes an entry and asks. A worker never edits the
   Offer, Audience, Action or Proof to make a page pass a review; if a review shows the brief itself
   is the problem, that goes to the owner.
3. **Proof is a closed list.** If it is not there, it is not on the page. If it is there with one
   value, the page shows that value.
4. **A decision never excuses a failure.** A recorded choice that stops a visitor acting, misleads
   them, or is on a rubric's "Major on sight" list is still reported.
5. **The visitor never sees it.** In a review, specialists are handed the brief; the reviewer playing
   the visitor is not, because a real visitor has only the page.
6. **Change the offer, the audience or the action and it is a different page.** Scores from before
   and after are not comparable.
