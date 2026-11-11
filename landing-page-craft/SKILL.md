---
name: landing-page-craft
description: Guides the planning, writing, building, fixing and reviewing of landing pages and marketing pages that persuade a visitor to take one action, by conducting a vendored landing page reference (intake, page structure, layout choice, conversion rules, copywriting, search and sharing) through one entry point that puts the page's own brief and the brand's own values first, never lets a fact be invented, and carries a set of blind reviewer rubrics (conversion, copy, brand and visual design, accessibility, responsive design, and the first-time visitor) for a work-and-review loop. Use this whenever the user asks to plan, write, design, build, restyle or improve a landing page, a campaign page, a product marketing page, a waitlist, pricing or sign-up page, a hero section, a headline or a call to action, or asks why a page does not convert or to review one, even if they do not name this skill. Not for the screens of an application people sign in to and work in.
---

# Landing page craft

A landing page is not a product screen and not a home page. It wins one intent:

**one offer → one audience → one action.**

Its reader is a visitor who has just arrived, owes it nothing, and decides in a few seconds whether
to stay. Everything in this skill follows from that.

This skill is a conductor. The method lives in `sources/`: a public landing page skill copied
unchanged at a pinned commit with its licence. Its file is still named `SKILL.md`, but inside this
package it is **a reference file, reached only through this conductor**. Do not install it as a
skill of its own. `references/ownership.md` says which of its parts are rules here, which are
defaults that give way to the brand, and which are not used.

## When to use it

Use it for a page whose job is to persuade a visitor to do one thing: start a trial, book a demo,
buy, join a list, download.

- It is not for the screens of a product people sign in to and work in. Those are tools, judged by
  whether work gets done; `interface-craft` covers them where it is installed.
- A home page that serves several audiences is several intents. Either treat each intent as its
  own page, or say plainly that this skill's "one action" rules will not all hold.
- It is stack-neutral. Where the project has conventions for how code is written, follow them; this
  skill says what the page must be.

## Order of authority

When two things disagree, the higher one wins.

1. The page brief, `page-brief.md` (`references/page-brief-format.md`): the offer, the audience, the
   action, the facts that exist, the brand's values, and the owner's dated decisions.
2. The brand's own system: its guidelines, its tokens, the components of its existing site.
3. This skill's ownership notes (`references/ownership.md`).
4. The source.

The source has a house style of its own: named typefaces, a spacing table, a text gradient on the
hero, a ban on hyphens, a "mandatory" tagline section. None of it overrides a brand. It is a
starting point only for a page whose brand has no value of its own for that thing.

## Working rules

**The brief comes first.** No outline, no headline and no code before the offer, the audience and
the action are written down. Read the project for what it already says; ask the owner for what is
missing, in one batch, not one question at a time.

**Facts come from the brief, never from you.** A price, a number, a customer's name, a logo, a
quotation, an award, a guarantee: each appears on the page only if the brief's Proof section lists
it. Where a fact is missing, put a marker such as `{{price}}` and say so. A page that still holds a
marker is not finished, and the review will say so.

**One page, one offer, one action.** A second offer, a second audience or a second main button is
a second page. Say so instead of fitting it in.

**Words before pixels.** Show the owner the plan in words first: the outline, the first window's
copy (headline, the line under it, the action, one proof), the benefits, how it works, the questions
and answers, the layout type and why, and whether the page should be found by search. Build after
they have seen it.

**Build section by section.** First window, benefits, how it works, proof, questions, the last call
to act. Never regenerate the whole page to change one section.

**The brand's value, not a second one.** Where the brief or the brand's system has a value, use it.
Where neither has one, propose it as a decision for the brief; do not invent it in a section.

**Do not decide for the owner.** The offer, the audience, the action, what may be claimed and any
choice of taste are theirs. Propose the entry for the brief and ask. An assumption you had to make
to keep going is written down as a proposed decision, marked as assumed, never as settled.

**Say what you changed and where it shows.** Hand back a list: each change, the file, and the
section and screen size where the difference can be seen.

## How to load

1. Read the page brief. If there is none, write one with the owner
   (`references/page-brief-format.md`, starting from `assets/page-brief.example.md`).
2. Read `references/ownership.md`. It is short, and it is what makes the source safe to use.
3. Open `sources/elaya/skills/landing-page-design/SKILL.md`. Read Part A for planning and writing.
   Open a section of Part B only for a thing the brand has no value for.
4. For craft the source does not cover (how a form behaves, focus, contrast, the detail of motion),
   use the project's own standards, or `interface-craft` where it is installed.

## Before handing work back

The rubrics under `review/roles/` are what a reviewer will hold the page to. Check your own work
against them first:

- Open the page at each screen size, smallest first. Without scrolling: is the promise there, is the
  action there, whole? (`conversion.md` K1, K2; `responsive.md` S2.)
- Go through each rubric's "Major on sight" list once. None may remain.
- Compare every fact on the page with the brief's Proof section, value by value (`copy.md` W5).
- Walk the page with the Tab key, and once more with reduced motion asked for.
- Press the action. Does it do what its label says, and does the page say what happens next?
- Anything you could not check, report as not verified.

## Reviewing, and the work-and-review loop

`review/` is a set of reviewer rubrics for the `ux-quality-score` skill: five specialists
(`conversion`, `copy`, `brand`, `accessibility`, `responsive`) and the first-time visitor, each
blind to the others and to how the page was made. With that skill installed, a page is captured,
scored by fresh reviewers, fixed with this skill, and reviewed again until every role reaches the
threshold the owner sets. `references/review-loop.md` says how to set it up and what it cannot tell
you.

Without that skill the rubrics still serve as the checklist above, and a single reviewer can be
handed one of them with screenshots of the page.

## Reference files

| File | Holds |
|---|---|
| `references/page-brief-format.md` | The format and rules of the page brief |
| `references/ownership.md` | Which parts of the source are rules, which are defaults, which are not used |
| `references/review-loop.md` | Setting up and running the work-and-review loop with `ux-quality-score` |
| `review/roles/*.md` | The six rubrics: criteria, what is always at least major, what a 90 looks like |
| `review/set.json`, `review/*-brief.md` | The reviewer set and what each reviewer is told |
| `assets/page-brief.example.md` | A filled-in brief to copy |
| `assets/review-config.example.json`, `assets/capture.example.json` | A starting review config and capture plan |
| `scripts/review-set.test.cjs` | Checks that the reviewer set and the example files hold together (`node --test scripts/review-set.test.cjs`; run it after changing anything under `review/` or `assets/`) |

## The source

`sources/sources.lock.json` records the source's repository, pinned commit, licence and a hash of
every file. The files are never edited here. To confirm they are untouched, or to move to a newer
commit, run from this skill's folder (Node 18 or later, and `git` for an update):

```bash
node scripts/update-sources.cjs --check
```

```bash
node scripts/update-sources.cjs --update --source elaya
```

An update reads files straight from the repository's git objects and runs nothing from it. After
an update, re-read `references/ownership.md` and the rubrics under `review/roles/` against what
changed.

When installing this skill, copy the whole folder, `sources/` and `review/` included, to wherever
your agent reads skills from.
