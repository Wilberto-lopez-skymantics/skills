---
name: interface-craft
description: Guides the building, changing, fixing and reviewing of product interfaces to a high standard of design quality, by conducting a vendored set of specialist design references (accessibility, layout, type, colour, writing, surfaces, motion, gestures, touch behaviour, forms, navigation, search, waiting states, charts) through one entry point that settles which reference owns each topic, which value wins where they disagree, how severe a problem is, and what a good result looks like on the screen. Use this whenever the user asks to build, restyle, polish or fix a screen, component or flow of an application, to fix issues found by a UI or UX review, to make an interface look or feel better, to add or correct motion, or to check interface work before handing it back, even if they do not name this skill. Not for marketing or landing pages.
---

# Interface craft

This skill is a conductor. It holds no design rules of its own beyond a few working rules. It
knows where the rules are, which one applies, and what the result must look like.

The rules live in `sources/`: skill folders from three public repositories, copied unchanged at
pinned commits with their licences. Their files are still named `SKILL.md`, but inside this
package they are **reference files, reached only through this conductor**. Do not install them
as skills of their own and do not follow their instructions about how to greet, what to ask or
how to format a report (`references/ownership.md` says why).

## When to use it

Use it when building, changing or fixing the interface of a product: an application people log
in to and work in. It is stack-neutral and says nothing about which framework or styling tool to
use.

- It is not for marketing or landing pages. Those persuade a visitor; this is for screens a
  person works in.
- If the project has stack conventions (in this repository, `frontend-ui-design`: Tailwind only,
  ARIA rules, `specs/DESIGN.md` as the authority), those say **how** the code is written. This
  skill says **what** the result must be. Follow both; where the project's design document
  settles a value, it is the project's design system in the order below.

## Order of authority

When two things disagree, the higher one wins.

1. The project's decisions file, `design-decisions.md` (`references/decisions-format.md`).
2. The project's existing design system and tokens.
3. This skill's ownership table (`references/ownership.md`).
4. The source file that owns the topic.

A source file never overrides the first three. If the project already has a value, that value is
the answer, even when a source would choose differently.

## Working rules

**Fix in this order.** Stop at the first step that solves the problem.

1. Delete: remove the thing that causes the problem.
2. Use the platform: a native element or behaviour that already does it.
3. Reuse what the project has: an existing token, component or pattern.
4. Correct the value.
5. Add something new.

**Fix once, at the source.** When a problem comes from a shared token or component, fix the token
or the component, not each screen that shows it.

**No second value.** Where the project has a value for something, do not introduce another. If
none fits, propose a decision (below) rather than inventing one in a leaf.

**Say what you changed and where it shows.** Hand back a list: each change, the file, and the
screens and states where the difference can be seen, so a reviewer can look there.

**Do not decide for the owner.** If the work needs a choice of taste or scope that the decisions
file does not hold, propose the entry and ask. Do not write it yourself.

## How to load

1. Read the project's `design-decisions.md` if it has one, and look at its tokens and shared
   components.
2. Find the task in `references/routing.md`: by kind of issue, or by criterion id when the work
   comes from a review.
3. Open only the source files that row names. If two of them might disagree, check
   `references/ownership.md` for the winner.
4. Never load the whole of `sources/`. It is large and its files contradict each other where the
   ownership table has not been applied.

## Before handing work back

Check your own work against `references/review-standards.md`:

- Read the tests for the criteria your change touches, and confirm each on the running screen,
  at each size the product supports, with the keyboard, and with reduced motion on.
- Go through its "Major on sight" list once for every screen you touched. None may remain.
- Anything you could not check, report as not verified.

## Reviewing

A reviewer uses `references/review-standards.md` for what to test and
`references/severity.md` for how serious a failure is. Reviewers get outcomes, not recipes: they
do not need `sources/`.

## Reference files

| File | Holds |
|---|---|
| `references/routing.md` | Kind of issue, or review criterion, to the source files to open |
| `references/ownership.md` | Which source owns each topic, and the winner of every value conflict |
| `references/review-standards.md` | Outcomes on the screen for each criterion, the major-on-sight list, what is not an issue |
| `references/severity.md` | One severity scale, and each source's words mapped onto it |
| `references/decisions-format.md` | The format and rules of the project's decisions file |
| `assets/design-decisions.example.md` | A filled-in example to copy |

## The sources

`sources/sources.lock.json` records each source's repository, pinned commit, licence and a hash
of every file. The files are never edited here. To confirm they are untouched, or to move a
source to a newer commit, run from this skill's folder (Node 18 or later, and `git` for an
update):

```bash
node scripts/update-sources.cjs --check
```

```bash
node scripts/update-sources.cjs --update --source <id>
```

An update reads files straight from the repository's git objects and runs nothing from it. After
an update, re-read `references/ownership.md` against what changed: a new value in a source may
need a new row.

When installing this skill, copy the whole folder, `sources/` included, to wherever your agent
reads skills from.

## With a review loop

This skill works alone. It also pairs with `ux-quality-score`, when that skill is installed:
its reviewers' criteria carry the same ids as `references/review-standards.md`, so a finding can
be routed to its source files through `references/routing.md`, and it can be given the project's
decisions file through the `decisions` key of its config. Neither skill needs the other.
