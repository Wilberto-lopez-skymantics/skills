# Tells

A page can keep to its brief, pass every rubric, look like nobody else's and still be read at a
glance as made by a model. What gives it away is rarely the colour. It is the things a model does
without deciding to: the same skeleton as every other page, a small label over every heading, three
of everything, sentences built to sound finished, and every thought written out in full.

This file says how to use the list of such things that this skill carries, and what the list does
not cover.

## The list

`sources/impeccable/crates/live/assets/antipatterns.json` is a public catalogue, copied unchanged
(`references/ownership.md`). Each entry has an `id`, a `name` and a `description` that says what
the thing is and what to do in its place. About half are marked `slop`: the tells. The rest are
marked `quality`: plain faults that the review rubrics also look for. An entry with `severity:
advisory` is a prompt to look, not a fault: the thing has honest uses.

`sources/impeccable/skill/reference/craft-floor.md` adds, under "Refuse", the habits that no list
of patterns catches, and `mode-persuade.md` beside it names the two first windows that are the
template whatever is painted on them.

Read the entries themselves. What follows names every tell in the list and says which of them a
landing page meets most.

**In the structure of the page**

| Id, or where it is said | The habit |
|---|---|
| `kicker-above-heading`, `hero-eyebrow-chip` | A small label as a block of its own directly above a heading, or the same thing as a pill. The catalogue's entry is the label in spaced capitals and it allows that to nobody; here it holds for a label in any case |
| `numbered-section-labels` | Sections that number themselves, where the order tells the visitor nothing |
| `icon-tile-stack`, and "Refuse" in the craft floor | Cards of the same size, each an icon, a heading and a line, as the structure of a section |
| "Refuse" in the craft floor | A big figure over a small label, with two more beside it |
| `oversized-h1` | A whole sentence set at display size, so that the first window holds a headline and nothing else |
| `mode-persuade.md`, "Comps" | Words on one side, the product on the other and a row of badges under them; or a centred headline over a row of equal cards |
| `monotonous-spacing`, `flat-type-hierarchy` | One distance used everywhere and sizes that barely differ, so that every section weighs the same |

**In the words**

| Id | The habit |
|---|---|
| `aphoristic-cadence` | A short rebuttal after a statement ("X. No Y."), or a contrast made for its sound ("Not a feature. A platform."), in section after section |
| `marketing-buzzword` | A phrase that could sit on any company's page |
| `em-dash-overuse` | A dash in sentence after sentence |
| `theater-slop-phrase` | Dismissing a thing by calling it theatre |

Of the entries marked `quality`, one belongs with these: `repeated-container-text`, the same words
set three times in one panel.

**On the surface**

Drawn: `overused-font`, `italic-serif-display`, `extreme-negative-tracking`, `gradient-text`,
`ai-color-palette`, `cream-palette`, `dark-glow`, `radial-halo`, `radial-spotlight-glow`,
`codex-grid-background`, `repeating-stripes-gradient`, `shape-assembled-illustration`, `side-tab`,
`border-accent-on-rounded`, `nested-cards`, `gpt-thin-border-wide-shadow`.

Moving: `marquee`, `pulsing-dot`, `blinking-cursor`, `bounce-easing`.

Most of these are settled with the look, before this skill is used. They are here because a
section can still bring one in, and because a picture drawn in code to fill a gap (shapes
assembled into a scene, a grid behind the words) is where they come back.

## When to walk it

1. **Before the compositions go to the owner.** No alternative rests on a tell: not its skeleton,
   not its picture, not the device that recurs. A device chosen to make a page distinct is the
   likeliest place to find one, because a model reaches for the same few devices when asked to be
   distinct. If the idea of a composition is "every section has a number", it has no idea yet.
2. **While writing.** The rows under "In the words", and the rule in `SKILL.md` on saying it once.
3. **Before handing the page back.** The whole list, on the built page, at the smallest size and at
   the widest. Report each entry met, and which you left and why: an advisory entry may stay where
   the brief asks for the thing by name.

A brand's own values are not tells. A typeface, a colour or a shape that the brief records is
used, whatever list it is on. A structure is never a brand value: no brief earns a label above a
heading back.

Taking a tell out is not a repair by itself. A label deleted from above a heading leaves the
heading to do its work, and a heading that needed the label needs rewriting. Three cards turned
into three rows are still three of everything. Ask what the part was for, and draw that.

## What the list does not catch

The first pages made with this skill were measured against the list by the program its authors
publish. One of them came through with three small notes, and its owner still read it as
generated. What was left, in that page and in the others, was this:

- **The skeleton.** A first window; then a problem, three benefits, three steps, some proof, six
  questions and the action again, one section each, in that order. The order of the questions a
  visitor asks is right. A section for each of them is a habit (`references/composition.md`,
  decision 1).
- **Threes.** Three benefits, three steps, three figures, three terms, each set in three equal
  columns. Count what there is. If the honest number is two or five, the page has two or five.
- **Every section the same weight.** A page a person made has one part it cares about most, and
  gives it the room.
- **Everything said.** Each section explained itself in full, and the page ran to seven hundred
  words. Nothing was left for the call. A length is now part of the composition
  (`references/composition.md`, "Length").
- **A concept applied to everything.** Each page took one idea of what it was (a drawing, a
  newspaper, a poster) and dressed every element in it. One move carries an idea. Thirty make a
  costume (`references/composition.md`, "Take a form once").
- **No real material.** Invented figures, an unnamed customer, no picture of anything that exists.
  This one a made-up company cannot fix, and a real one must: the brief's Proof section is where it
  starts.

## The catalogue's own detector

The catalogue's authors publish a program that checks a page against it without a model. This
skill does not carry it, install it or need it. Where a project already has it, run it on the
built page and treat each finding as this file treats the list:

```bash
npx impeccable detect <folder or address>
```

It downloads and runs a program on first use, so whether a project has it is the owner's decision
and not yours.

Given a file, it reads the page without drawing it. A size it cannot work out, such as one
written with `clamp()` or in viewport units, it takes as nothing or as another size, and it then
reports what is not there: text flush against the edge of a section, lines set too tight. Before
acting on a finding that is a measurement, measure the same thing on the page as a browser draws
it. Given an address, it uses a browser, and what it reports is measured.

A page it passes has none of the tells it can see. It says nothing about the six things above.
