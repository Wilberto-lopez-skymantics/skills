---
name: visual-direction
description: Guides the choosing of a product's look with its owner, so that its screens and pages are its own and not the look every generated interface shares. Gathers references that differ in kind (the product's own world, other crafts, other software), turns them into two to four candidate directions that a script checks to differ from each other, to meet a floor of contrast and sizes, and to carry none of the faces and marks that give a generated page away, shows them on one specimen as a working product and as a landing page, and records the owner's choice with its tokens and the Style and Brand sections other skills read. Use this whenever the user asks to choose or change the look, theme, visual identity, palette or typefaces of a product or site, says its screens look generic, templated or AI-made, asks for design directions or references, starts a product with no settled look, or wants an existing brand written down, even if they do not name this skill. Not for building, arranging or fixing screens or pages.
---

# Visual direction

A product's look is one decision: its type, its colour, its shape, how tight it is, how it moves,
what its pictures are, how it speaks. This skill is for making that decision once, with the
product's owner, and for writing it down where whoever builds the screens and the pages will read
it.

It exists because a look nobody chose is still a look: the commonest one. Wherever a value is not
decided, whoever builds the screen, a person or a model, reaches for what they have seen most, and
every product built that way looks like the others. A list of things to avoid does not make a
look: it moves everything to the next commonest one. What works is a look chosen on purpose from
real things, written down, and then followed.

A look chosen on purpose can still give itself away. Asked to be distinctive, a model reaches for
the same few moves: a small label over every heading, numbered sections, a grid drawn behind the
words, a newspaper's rules, a poster's one flat colour, and the product dressed up as some object
from top to bottom. So the check also says when a candidate carries one of those.

## What it is for, and what it is not

- **For:** choosing the look of a product that has none; replacing a look the owner finds generic;
  writing an existing brand down in a form screens can follow; changing a settled look later.
- **Not for arranging anything.** What goes where on a screen, and how a landing page is composed,
  are settled by the skills that build them. Every candidate here is shown on the same arrangement
  on purpose, so that only the look is being chosen.
- **Not for building or fixing screens or pages.** Those have their own skills (`interface-craft`
  for a product, `landing-page-craft` for a landing page, where they are installed). This skill
  hands them the look and stops.

It is stack-neutral. Its output is a record in Markdown, the values as CSS custom properties, and
the same values as JSON for a stack that does not read CSS.

## The ideas it rests on

1. **References that differ in kind.** A look drawn from other products of the same category is
   that category's average. A look that belongs to this product comes from its own world (what its
   people read and handle), from other crafts (print, signs, instruments, maps), from software of
   another category or another time, and from what the owner brings.
2. **Properties, never artefacts.** From a reference you take how it uses type, colour, shape and
   space. You never take its mark, its pictures, its words or anything that would make a screen be
   mistaken for it. Every direction is drawn from two references or more for the same reason.
3. **A look, not a costume.** A product that learns from a timetable sets its figures the way the
   timetable does. It does not pretend to be one. A look that acts one object out in every part,
   every label and rule and corner, is read at once as dressing up, and three looks made that way
   are told apart by their costumes and are otherwise one page.
4. **Candidates have to differ.** Asked for three directions, a model gives its usual one three
   times with the colours changed. `check` measures each pair of candidates on eight things and
   refuses a study whose candidates are the same look under different names. Expect it to refuse a
   first attempt: that is what it is for.
5. **One skeleton, the product's own words.** Every candidate is shown on the same specimen: the
   same parts in the same places with the same words, taken from the real product. Only the look
   differs, so the choice is about the look.
6. **A floor under every candidate.** Whatever the look, text has to be read and a control has to
   be found. A candidate below the floor is not shown, so that the owner cannot pick one that fails
   its first review.
7. **The owner chooses.** Taste is theirs. You propose, check and show; you never pick, and you
   never record a choice they did not make.
8. **One record, two registers.** A product and its landing page are one look said at two volumes:
   quietly where people work, aloud where a visitor is met. Both are settled together and kept in
   one place, so the two cannot drift apart.

## The files

`VD` below stands for `node <this skill>/scripts/direction.cjs`. Every command takes `--dir`, the
**direction folder**: wherever the project keeps its look, under version control (in a spec-driven
workspace, outside the frozen `specs/` set, because it grows by appending). Tell whoever builds
where it is; nothing searches for it.

```
<direction folder>/
  direction.json          the look that was chosen: the source of the two files below
  visual-direction.md     the record, for people to read (written by the script)
  direction.css           the values, as --vd-* custom properties (written by the script)
  common-looks.json       optional: the project's own list of looks that are everywhere
  studies/1/
    study.json            where the study stands
    brief.md              what the product is, who meets it, what is held, how it should feel
    references.md         one note for each thing looked at
    words.json            the product's own words, for the specimen
    candidates/<id>.json  one direction each (one that was dropped is kept in set-aside/)
    specimens/<id>/       each candidate drawn on the skeleton
    sheet.html            the candidates side by side, for the owner
```

## A study, step by step

1. **Read what exists.** The product's screens and tokens, any brand guidelines, any decisions
   file or page brief. If a brand already settles type and colour and little is left open, there
   is nothing to study: go to "When the look already exists".
2. **Open the study.** `VD open --dir DIR`. Add `--surfaces product` or `--surfaces landing` when
   only one is wanted. It writes the brief, the references and the words as empty forms. The
   candidates are named later, at step 6.
3. **Write the brief with the owner** (`brief.md`): the product, the people, what is held and why,
   and, in their own words, three things the look should bring to mind and three it should not,
   with anything they said it must not resemble. Ask in one batch, and ask for examples of their
   own while you are there: things they admire, and things they do not want to resemble.

   **Held** is two things. What the owner brings: a mark, a colour, a typeface, a typeface budget.
   And what the setting fixes, whether or not they said so: a dark ground for a dim room, tall rows
   for gloved hands, the modes the product needs. Write both down with their reasons. What is held
   is the same in every candidate, and is not what the candidates are compared on.
4. **Gather references** into `references.md`, two at least for each candidate you mean to
   propose, of three kinds or more, one of them from the product's own world and one from another
   craft. Look at each thing. A note of something you remember, or that someone described to you,
   says so. `references/gathering-references.md` says where to look, how to write a note and what
   may be taken.
5. **Put the product's own words in `words.json`**: its real navigation, a real table with real
   rows, its real headline. Where the product has no such words (it has no footer, no line of help
   under a field), take that line out and the specimen is drawn without it;
   `references/direction-format.md` lists what may be left out. Never fill a gap with words of
   your own, and never invent a fact: a fact the page needs and does not have yet stays a marker
   such as `{{proof}}`, and is drawn as one.
6. **Name the candidates, and write each from its references.** `VD candidates --dir DIR --names
   <name,name,name>`, with `--held <thing,thing>` for what the brief holds (the names are the
   eight things compared: `display_type`, `text_type`, `accent_hue`, `neutrals`, `ground`,
   `corners`, `separation`, `density`). Two to four candidates; three is usual. Name each for what
   it is drawn from, not for how bold it is. They can be named again until the owner has chosen.

   Spread them: one close to what people who use products of this kind already expect, done well
   (the palette library that comes with this skill is a place to start that one, and only that
   one: `references/gathering-references.md`); one drawn from the product's own world; one further
   out. The owner cannot say how far they want
   to go before they have seen the range.

   Write each candidate (`candidates/<id>.json`) as a whole idea that a designer could defend:
   its own marks first, the two or three details a person would describe it by, then its values.
   On values alone, three candidates are one look in three colours. Say what each gives up.

   Its idea says what the look does with type, colour and line, and where each came from. It does
   not say what the product is dressed as ("the page as a broadsheet"). Its own marks are things
   the references had and other products do not. They are not the marks a great many generated
   pages carry: a small label over each heading, numbers on the sections, a grid or stripes drawn
   as a background, a glow, plain shapes standing where a picture should be. `check` says when a
   candidate has one of these, when it is set in one of the faces everything is set in, and when
   its headline is sized so that a window holds nothing else.
   `references/direction-format.md` has every field. Read one of the example's candidates for the
   shape of the file only after you know what yours are drawn from: the example is a look too, and
   it leaks.

   Three rules decide most refusals, so know them before you write:
   - Every pair differs in its **type**: the class (serif, sans, slab, mono, script) or the width
     of its display face or of its text face. Three sans faces of normal width are one look to the
     checker, and mostly to the eye.
   - Every pair differs in its **colour**: accents 45 degrees of hue apart, greys of another
     temperature, or a light ground against a dark one.
   - Every pair differs on **half of what is free** (four of the eight, fewer when something is
     held), and no two share a text or display family.
7. **Check.** `VD check --dir DIR` reads everything and lists what is missing, what is below the
   floor, and which pairs of candidates do not differ enough. It also warns of what gives a
   generated page away. A warning does not stop the study, and each one is either put right or said
   to the owner with the candidate. Put right what it lists in the files it names. When it says two candidates are too alike, they are: go back to what each is drawn
   from and take more from it. Do not change a value only to get past the check; a candidate that
   differs on paper and not to the eye wastes the owner's choice.
8. **Draw them and look.** `VD specimen --dir DIR` writes one page for each candidate and
   `sheet.html` with all of them (`--draft` draws candidates that do not pass yet, for your eyes
   only). Look at every candidate yourself, with whatever lets you see a page:
   - each part, each width and each mode. The sheet opens in any state from its address
     (`sheet.html#part=landing&mode=dark&width=390`; the parts are `product`, `landing` and
     `values`, the widths 1280, 768 and 390), and so does a specimen
     (`specimens/<id>/index.html#part=product&mode=dark`);
   - a specimen that says a typeface did not load is not showing the candidate;
   - hold each against the brief's Feel, the three words it should not bring to mind above all,
     and against what the owner said it must not resemble.

   Fix what looks wrong and draw them again.
9. **Show the owner.** The sheet (`--embed` makes it one file to send). For each candidate: its
   idea, what it gives up, where it risks one of the words the owner did not want, and anything
   `check` warned of, above all a candidate that sits in a look a great many generated interfaces
   share. Do not say which you would choose unless they ask.
10. **Record their choice.** `VD pick --dir DIR --candidate <id> --by "<their name>" --why "<their
    reason>"`. It is refused if a candidate changed after it was shown. If they like none, `VD close
    --dir DIR --why "<what they said>"` and open another study from what they said was wrong. If
    they want parts of two, that is a new candidate in a new study: it has to be seen whole.
11. **Hand it over.** `references/using-the-direction.md`: the Style section for the product's
    decisions file, the Brand section for a page brief, the tokens, and what to do where the
    project freezes its design.

## When the look already exists

A brand with guidelines, or a product whose look the owner wants kept, is written down without a
study. Put its values in a file in the form of a candidate (the parts that record where a
direction came from are left out), and run `VD adopt --dir DIR --from <file> --product "<name>"
--by "<who says so>" --why "<why now>" --source "<where it is set out>"`.

The floor still applies. Where the brand itself falls below it (a pair of colours that does not
reach its contrast), that goes to the owner. It is theirs to change, and it is never written down
as though it passed.

Where a brand settles some things and leaves others open (it has a colour and a typeface, and
nothing about density, shape or how a product screen should look), run a study with what it
settles held: every candidate keeps those, and they differ in the rest.

## Working rules

**Do not decide for the owner.** The choice, the reason and any later change are theirs. A choice
you had to assume is not a choice: ask.

**Look before you show.** Every specimen, at every width and in every mode. Numbers that pass and a
page that looks wrong is a page that looks wrong.

**Do not differ for the checker's sake.** The check is a floor under the candidates, not the
measure of them. A corner moved from 2 px to 4 gets past it and changes nothing a person can see.
When two candidates are refused as alike, the honest fix is in what they are drawn from.

**Never copy.** A direction that could be mistaken for one of its references is a copy of it. Take
properties; leave marks, pictures, words and exact arrangements where they are.

**Say what is from memory.** What you remember of a thing is the average of things like it. A note
that was not looked at says so, and `check` counts them.

**A typeface is a purchase.** Name the licence of every family before the owner sees it. An owner
who falls for a typeface they cannot afford has been shown the wrong thing.

**Once chosen, it is followed.** A screen that departs from the record is the fault, not the
record. A change to the look is a decision of the owner's, made in `direction.json`, never a value
adjusted on one screen.

## The commands

| Command | Does |
|---|---|
| `VD open --dir DIR [--surfaces ...]` | Sets up the next study: the brief, the references and the words, as empty forms |
| `VD candidates --dir DIR --names a,b,c [--held ...]` | Names the candidates and says what is held. One empty file for each new name; one that is dropped is set aside, not deleted |
| `VD check --dir DIR [--full]` | Everything that is missing, below the floor or too alike. Exit code 2 when there is any. `--full` adds every pair of colours measured |
| `VD specimen --dir DIR [--embed] [--draft]` | Draws every candidate on the skeleton, and the sheet that shows them side by side |
| `VD pick --dir DIR --candidate ID --by NAME --why REASON` | Records the owner's choice and writes the record and the tokens |
| `VD close --dir DIR --why REASON` | Ends a study in which nothing was chosen |
| `VD adopt --dir DIR --from FILE --product NAME --by NAME --why REASON --source WHERE` | Writes down a look that already exists, without a study |
| `VD decide --dir DIR --title ... --decision ... --by NAME --why REASON` | Records a later change to the settled look, after its values were changed in `direction.json` |
| `VD render --dir DIR [--style] [--brand]` | Writes the record and the tokens again; `--style` prints the Style section for a decisions file, `--brand` the Brand section for a page brief |
| `VD compare --dir DIR [--decisions FILE] [--brief FILE]` | Says whether those files still say what the direction says. Exit code 2 when they do not |
| `VD status --dir DIR` | Where every study stands, what is settled, and what comes next |

Each command says what to do next under `then` (the two that print a section print only that). The
commands of a study act on the latest one; `--study <n>` names another. A study is finished in one
go or picked up later: `status` says where it stands.

## Reference files

| File | Holds |
|---|---|
| `references/direction-format.md` | Every field of a candidate, the colour roles, the eight things candidates are compared on, the floor, and the classes a candidate's own CSS may restyle |
| `references/gathering-references.md` | The kinds of reference, where to look, how to write a note, what may be taken and what may be kept |
| `references/using-the-direction.md` | Handing the look to the product and to a landing page, the tokens, changing the look later, and projects that freeze their design |
| `assets/example/` | A whole study of a made-up product: its brief, seven references, its words and three candidates that pass |
| `sources/taste-skill/skills/taste-skill/library/palettes.json` | What good sites of each trade use: 64 palettes read from real sites, kept as a reference for the one familiar candidate (`references/gathering-references.md`) |
| `assets/common-looks.json` | The looks, the typefaces and the marks that are everywhere, as this skill's maintainers saw them at the date in the file, with where the list was taken from |
| `assets/specimen.css` | The skeleton every candidate is drawn on |
| `scripts/direction.test.cjs` | Tests of the script on the example (`node --test scripts/direction.test.cjs`; run it after changing the script, the skeleton or the example) |

## With the other skills

This skill works alone. It also feeds two others, where they are installed, in the forms they
already read: `interface-craft` reads the Style section of the project's decisions file, and
`landing-page-craft` reads the Brand section of a page brief. `VD render` writes both from the one
record, so a product and its landing page share a look without either skill knowing about this one.
A review tool that hands those files to its reviewers, such as `ux-quality-score`, then holds every
screen and page to the chosen look. None of them needs this skill, and it needs none of them.

## The source

One file here is someone else's: the palette library above, from a public skill, copied unchanged
with its licence (MIT). `sources/sources.lock.json` records the repository, the pinned commit and
a hash of the file. To confirm it is untouched, or to move to a newer commit (Node 18 or later, and
`git` for an update):

```bash
node scripts/update-sources.cjs --check
```

```bash
node scripts/update-sources.cjs --update --source taste-skill
```

An update reads the file straight from the repository's git objects and runs nothing from it.

When installing this skill, copy the whole folder, `assets/` and `sources/` included, to wherever
your agent reads skills from. It needs Node 18 or later and nothing else.
