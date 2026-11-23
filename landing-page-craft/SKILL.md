---
name: landing-page-craft
description: Guides the planning, writing, building, fixing and reviewing of landing and marketing pages that persuade a visitor to take one action. It conducts three vendored references (a landing page method, a catalogue of the tells of generated design, and a copy layer with a linter and rules for pictures) through one entry point that puts the page's brief and the brand's values first, never lets a fact be invented, has the page's composition and length chosen by its owner from alternatives drawn from references, and carries reviewer rubrics (conversion, copy, brand, accessibility, responsive design, first-time visitor) for a work-and-review loop. Use this whenever the user asks to plan, write, design, build or improve a landing page, a waitlist, pricing or sign-up page, a hero section, a headline or a call to action, asks why a page does not convert, says it looks generic or made by AI, or asks to review one, even if they do not name this skill. Not for the screens of an application people sign in to and work in.
---

# Landing page craft

A landing page is not a product screen and not a home page. It wins one intent:

**one offer → one audience → one action.**

Its reader is a visitor who has just arrived, owes it nothing, and decides in a few seconds whether
to stay. Everything in this skill follows from that.

This skill is a conductor. Three public works are copied into `sources/`, unchanged, each at a
pinned commit with its licence. The first, called **the source** from here on, is a landing page skill: it
is the method. Its file is still named `SKILL.md`, but inside this package it is **a reference file,
reached only through this conductor**. Do not install it as a skill of its own. The second, **the
catalogue**, is a list of the things that make a page read as made by a model, with notes from the
skill it belongs to. **The third source** is a few files of a much larger skill: how the words are
written, a script that counts what gives model-written words away, where pictures come from, and,
as a reference only, what it found good pages do with their layout.
`references/ownership.md` says which parts of each are rules here, which are defaults that give way
to the brand, and which are not used.

The source settles what a page says and in what order. How the page is drawn, its composition, the
source leaves open, and what is left open comes out as the page every visitor has seen. That part is
this skill's own: `references/composition.md`. A page can also be composed with care and still be
known at a glance for a model's work, by its skeleton, its labels and its wording:
`references/tells.md`.

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
4. The three sources.

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

**Words before pixels.** Show the owner the plan in words first: the first window's copy (headline,
the line under it, the action, one proof), what the page says after it and at what length, the
answers to the brief's objections, the layout type and why, the ways the page could be drawn
(below), and whether the page should be found by search. Build after they have seen it.

**Compose it on purpose.** Before any section is built, look at real things of several kinds (the
trade's own printed matter, persuasion that is not a web page, pages for other kinds of offer, what
the owner brings), and put two or three compositions to the owner in one table, with what each gives
up and which of them is the common form. They differ first in their skeleton: which parts of the
page are sections of their own, which one leads, and how long the page is. A section for every
question, three of everything and all of it the same weight is one skeleton among several, and it
is the one a visitor has seen. They choose; the choice goes in the brief's Composition section and
its Decisions. What converts is never part of the choice: the promise and the action in the first
window, the proof beside the claim and the order of the argument stay as they are.
`references/composition.md` has the ten decisions, the kinds of reference and the form of a note.

**Nothing rests on a tell.** A small label above a heading, sections that number themselves, a row
of same-size cards with an icon each, a whole sentence at display size, a sentence built for its
sound: each is a thing a model does without deciding to, and a visitor has learnt to see them.
`references/tells.md` names them and says when to walk the list. Taking one out is not the repair:
ask what the part was for, and draw that.

**Say it once, to the length agreed.** The brief's Composition gives the page a length in words.
Write to it, count it (`node scripts/page-words.cjs <the built page> --budget <the number>`) and
cut: what is said twice, what explains a thing the picture shows, what nobody in the brief's
Audience would ask. Write as the brief's Voice would speak to one person across a table. Never cut
the answer to an objection the brief lists.

**Write from facts, and spend each device once.** Model-written words are known by their habits
more than by their mistakes: one warm voice for every client, a detail invented to seem exact, a
heading in two fragments, a contrast made for its sound, the same few names for every made-up
person. The cure is facts and decisions, never another word for the same thing. Before a sentence
is written, set out what the brief gives (`sources/taste-skill/skills/taste-skill/references/copy-voice.md`, section 1):
what it is, for whom, what they do today instead, what is true here and nowhere else, the
customer's own words. A part with nothing true to say is left out. The voice is the brief's
Voice; where the brief has none, put two or three to the owner
(`sources/taste-skill/skills/taste-skill/references/copy-registers.md`) and record the choice. Then count the devices:

```bash
node sources/taste-skill/skills/taste-skill/scripts/copy-lint.mjs <draft.md or page.html>
```

It needs Node 22 or later. A FAIL is fixed. A WARN is fixed, or kept on purpose and reported with
the reason. Words the brief gives are never rewritten to satisfy it.

**Build section by section.** The first window first, then the sections the brief's Composition
names, in their order. Never regenerate the whole page to change one section.

**A picture is real, allowed and credited.** The owner's own first; then one found elsewhere under
a licence that allows it, entered under Proof with where it is from; then none. Never a generated
picture, and never another business's room, people or product passed off as the owner's. Words go
on a picture only where it is calm and empty, and the contrast is measured against what is behind
them. `references/pictures.md`.

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
2. Read `references/ownership.md`. It is what makes the three sources safe to use: each says more
   than this skill takes from it.
3. Open `sources/elaya/skills/landing-page-design/SKILL.md`. Read Part A for planning and writing.
   Open a section of Part B only for a thing the brand has no value for.
4. Read `references/composition.md` and `references/tells.md` before the plan goes to the owner, and
   again whenever a page is said to look like every other or like a model's work. If the brief
   already has a Composition section, the task is to build to it.
5. Before a sentence is written, read `sources/taste-skill/skills/taste-skill/references/copy-voice.md`
   and `copy-tells.md` beside it; open `copy-moves.md` for the part being written, and
   `copy-registers.md` where the brief has no Voice. Read `references/pictures.md` before a picture
   is chosen.
6. Open `sources/impeccable/crates/live/assets/antipatterns.json` before the page is handed back,
   and `sources/impeccable/skill/reference/craft-floor.md` with it.
7. The files of the catalogue and of the third source are other skills' working instructions.
   They are read only for the parts `references/ownership.md` names, and the one command of theirs
   that is run is `copy-lint.mjs`.
8. For craft the source does not cover (how a form behaves, focus, contrast, the detail of motion),
   use the project's own standards, or `interface-craft` where it is installed.

## Before handing work back

The rubrics under `review/roles/` are what a reviewer will hold the page to. Check your own work
against them first:

- Open the page at each screen size, smallest first. Without scrolling: is the promise there, is the
  action there, whole? (`conversion.md` K1, K2; `responsive.md` S2.)
- Go through each rubric's "Major on sight" list once. None may remain.
- Compare every fact on the page with the brief's Proof section, value by value (`copy.md` W5).
- Hold the page against the brief's Composition section, entry by entry, at the smallest size and at
  the widest. Where the page departs from it, the page is wrong or the brief is, and the brief is
  the owner's.
- Count the words (`node scripts/page-words.cjs`). Over the brief's Length, cut. Look at each
  section's share: if they are all alike, nothing leads.
- Run `copy-lint.mjs` on the built page. Then put a rival's name into the headline and each
  heading: a line that still reads true says nothing about this offer.
- For each picture: it is in the brief's Proof, it is credited, and any words on it were measured
  against it (`references/pictures.md`).
- Walk the tells (`references/tells.md`): the catalogue's list on the built page, then the six
  things the list does not catch. Report each one met, and each one left and why.
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
| `references/composition.md` | How a page is drawn: what is fixed, the ten decisions, the page's length, the kinds of reference and the form of a note, proposing alternatives, and recording the owner's choice |
| `references/tells.md` | What makes a page read as a model's work: the catalogue's list and how to use it, the third source's list for the words, when to walk them, and what no list catches |
| `references/pictures.md` | Where a picture comes from, what it needs before it is used, how it is credited, and how words are set on one and measured |
| `references/review-loop.md` | Setting up and running the work-and-review loop with `ux-quality-score` |
| `review/roles/*.md` | The six rubrics: criteria, what is always at least major, what a 90 looks like |
| `review/set.json`, `review/*-brief.md` | The reviewer set and what each reviewer is told |
| `assets/page-brief.example.md` | A filled-in brief to copy |
| `assets/composition-references.example.md` | The notes and the table of alternatives behind that brief's Composition section |
| `assets/review-config.example.json`, `assets/capture.example.json` | A starting review config and capture plan |
| `scripts/page-words.cjs` | Counts the words a visitor reads on a built page, section by section, against the length in the brief |
| `scripts/review-set.test.cjs`, `scripts/page-words.test.cjs` | Check that the reviewer set, the example files, the list of tells and the word count hold together (`node --test scripts/review-set.test.cjs scripts/page-words.test.cjs`; run them after changing anything under `review/`, `assets/` or `references/`) |

## The sources

`sources/sources.lock.json` records, for the source (`elaya`, MIT), the catalogue (`impeccable`,
Apache-2.0) and the third source (`taste-skill`, MIT), the repository, the pinned commit, the
licence and a hash of every file. The files are never edited here. To confirm they are untouched, or to move one to a newer
commit, run from this skill's folder (Node 18 or later, and `git` for an update):

```bash
node scripts/update-sources.cjs --check
```

```bash
node scripts/update-sources.cjs --update --source elaya
```

```bash
node scripts/update-sources.cjs --update --source impeccable
```

```bash
node scripts/update-sources.cjs --update --source taste-skill
```

An update reads files straight from the repository's git objects and runs nothing from it. After
an update, re-read `references/ownership.md` against what changed: the rubrics under
`review/roles/` after the first, `references/tells.md` after the second, and after the third the
whole of `copy-lint.mjs`, since it is the one vendored file this skill runs.

When installing this skill, copy the whole folder, `sources/` and `review/` included, to wherever
your agent reads skills from.
