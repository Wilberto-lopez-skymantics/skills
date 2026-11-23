# Composition

The source settles what a landing page says: what the first window holds, the questions the page
answers after it and their order, four types of page, the rules that bring a visitor to the action.
It says almost nothing about how any of it is drawn. The brand settles the look: type, colour,
shape. Between the two is the composition: which parts of the page are sections of their own and
which one leads, what the first window is made of, what the picture is, what form each section
takes, how the page moves from one to the next.

What is not decided comes out the commonest way. For a landing page that is the page every visitor
has seen: a headline, a line and a button, centred or beside a screenshot of the whole product;
then a section for each question, each about as long as the last; three cards with an icon each;
three numbered steps; a strip of logos; a folded list of questions. Two pages built that way from
two brands differ in their type and colour and are otherwise one page, and a visitor knows it for
a page nobody composed before reading a word. This file is for composing a page on purpose
instead.

A composition is drawn in the brand's look. It chooses no typeface and no colour: those are in the
brief's Brand section.

## What is fixed

A composition is free inside these, and only inside them. They are the brief, the source's rules
and what the reviewers test. A composition that breaks one is not a bold composition, it is a page
that will be sent back.

| Fixed | Where it is tested |
|---|---|
| The first window says what is offered and for whom, at every screen size | `conversion.md` K1 |
| The one action is in the first window, whole, with nothing competing | K2, `responsive.md` S2 |
| One sign of proof is in or directly under the first window | K4 |
| The headline is the largest text in the first window, the action its most prominent control, and the picture supports them | `brand.md` B4 |
| On a phone the headline, the line under it and the action are in the first window; a picture never pushes the action out of it | S2 |
| The page answers the visitor's questions in the source's order (A2): what it is, what changes for me, how it works, who else uses it, what if it goes wrong, the action again | K5 |
| Every objection in the brief has its answer where a visitor scanning the headings finds it, and the headings alone tell the argument | K6, `copy.md` W9 |
| The action comes again at the end and after long sections | K9 |
| Every picture is real, sharp and of one family, and is one the brief's Proof lists as existing | B5, and the brief's rule that Proof is a closed list |
| Every size is composed for that size; sections change form, they are not shrunk | S6, S7 |
| Nothing a visitor needs is held back by movement, and nothing jumps | B8 |
| Nothing in it is one of the tells: no label above a heading, no numbered sections, no row of same-size cards as a section's structure | `references/tells.md`, walked before the page is handed back |

Compose for the phone first. Most visitors arrive on one, and a composition that works only on a
wide screen is not one.

## What a composition decides

Ten decisions. The choices listed are the usual ones, not all of them.

| Decision | It usually comes down to |
|---|---|
| **1. The skeleton** | Which of the visitor's questions get a section of their own and which share one; which one part leads and is given the room; what the page leaves out; how long it is (below). A section for each question, all about the same weight: the common one. One demonstration of the product at work that answers what changes and how it works together, with everything after it short. One customer's account, read down, that carries the proof and the answers to the objections. The first window, the terms of the offer, and nothing else. The brief's Layout type bounds it |
| **2. The first window: words and picture** | Words beside the picture; words above and the picture below, running off the bottom of the window; words set large across the window with a small picture beside the action; a picture across the window with the words on a quiet part of it; the headline itself as the picture, very large, on the bare ground; the thing to do across the window, with the words above it. And the action: a button, or the thing itself already begun (the field to fill, the dates to pick). The third source describes eleven first windows it has tested, with what each needs and how it is drawn on a phone (`sources/taste-skill/skills/taste-skill/references/layout-v4.md`, section 3). The source's A2 puts a picture in the first window: a first window of words alone sets that rule aside, and needs the owner's dated decision in the brief |
| **3. The picture** | The whole product on a screen; one detail of it, large; the product at work on one real case; the outcome instead of the product (the report, the paid invoice, the finished thing); a figure set as the picture; a diagram of how it works; a photograph of it in use. Only what the brief's Proof says exists; where a picture comes from, and how words are set on one, is in `references/pictures.md` |
| **4. The first proof** | Under the action; beside the headline; inside the picture; a line across the foot of the window |
| **5. The benefits** | Statements set large, one under another; each beside the part of the product it is about; a before and an after; one annotated picture; a row of equal parts. As many as there are, which is seldom three |
| **6. How it works** | The real screens, in order; one picture with the steps marked on it; a line down the page with the steps along it; steps in a row. As many steps as there are |
| **7. The proof** | One quotation, large; a figure, large, with its source; a short account of one customer; a row of names |
| **8. The questions** | The brief's objections and no others. All open, to be read down; folded, with the first open; each set beside the claim or the action it belongs to, with no list at all |
| **9. The rhythm** | Which sections run the full width and which are a narrow column; which one is large and which are small; where the page is dense and where it rests; whether sections change ground or share one; or every section one window tall, so that each window shows one thing |
| **10. What recurs** | The one thing that comes back down the page and makes it one page: the figure the page is about; the picture, returning in parts; one way of setting a date or a price. One, or none. Never a label over each heading or a number on each section: those are the two that come to hand first, and both are tells |

Decisions 1 to 3 carry most of what a visitor remembers, and most of what makes two pages
different. Where the skeleton gives two questions one section, the rows for both say so.

### Length

A page is as long as what a visitor must be told before they act. Decide that as a number of words
before any are written. It is part of the skeleton.

- What sets it is the action and the brief's Objections. An action that is free and familiar needs
  the promise, one reason to believe it and what happens next. An action that costs money or a
  meeting needs each objection answered, and that is where the words go.
- The number of sections does not set it. Seven sections of a hundred words each have given every
  question the same weight, which is having no view of which one matters.
- As a place to start, taken from this skill's own first pages and not from any study: under 150
  words for a waiting list or a download; 250 to 400 where the action is free; more only where the
  brief's Objections need it, and then as one account read down (the source's long form type), not
  as more sections.
- The headline is part of it. A headline that is a whole sentence is set at a size that leaves the
  line under it, the action and the proof in the window. Only a few words are ever set at display
  size.

Then write the page, count it, and cut it to the number.

```bash
node scripts/page-words.cjs <the built page> --budget <the number>
```

It counts the words a visitor reads, section by section, and each section's share.

How the words fall is a second thing to know. A page can be within its length and still open on a
wall of text. Where the page is captured with the `ux-quality-score` skill, the measurements give
the words in the first window and in each window down the page (`words` in `facts/`). The third
source sets a number for that, 34 to 80 words a window by the kind of business, for a layout of
its own with one section and one large picture to a window. Take its numbers as a place to start
and not as a rule. On this skill's first pages the count in a window did not follow what their
owner found wordy: the page called wordy had 84 words a window and the one preferred had 99. The
total, the number of sections and things said twice did. So the total is what is agreed, and the
count in a window is looked at for one thing: a window that is all words.

Whoever reviews the page holds it to the number: the copy rubric (`review/roles/copy.md`, W9) asks
that the page be no more than a tenth over the length its brief records, and that no block of
running text be over 40 words unless the Composition names it as an account to be read down.

Cut what is said twice, what explains a thing the picture already shows, and what answers a
question nobody in the brief's Audience asks (`sources/impeccable/skill/reference/distill.md`,
"Content Simplification"). Never cut the answer to an objection the brief lists, or what the action
costs and commits to.

## References

A composition is taken from things that were looked at, of several kinds. Keep a note of each in
`composition-references.md`, beside the page brief. It is working material: it is not part of the
brief and is not handed to anyone who reviews the page. `assets/composition-references.example.md`
is a filled-in one.

| Kind | Is | Why it is here |
|---|---|---|
| `own-world` | How people in this trade already show this thing to each other: a price list, a menu, a specification sheet, a timetable, the form the product replaces | A page that looks like it belongs to the trade starts here |
| `other-craft` | Persuasion that is not a web page: a poster, a magazine spread, a catalogue page, packaging, a shop window, a leaflet | Print solved "one promise, one picture, one thing to do" long before the web, in many more ways |
| `other-page` | A page for a different kind of offer to a different audience | Shows the form a section can take without importing this category's habits |
| `owner` | Anything the owner brings | Their taste, and what they know of their visitors |
| `same-category` | Pages for offers like this one | What this visitor has already seen today, to stand apart from. Notes are taken; a composition is never drawn from these alone |

Two notes at least for each composition proposed, of three kinds or more, with one that is not a
web page.

**Where to look.** Ask the owner first, once, in one batch: pages they admire, pages they do not
want to resemble, and the printed matter of their own trade. Then look yourself, with whatever lets
you see a page. Where the project has a library of real sites or of page sections connected, search
it by the section (a pricing section, a first window) and for another kind of offer, not for this
category. Galleries of awarded sites are good for pace and for the first window, with one caution:
many of those pages were made to be admired by other designers, and their first window holds
neither an offer nor an action. Hold everything you take against the fixed list above.

Do not use as a reference a generated page or a picture of a page that was never built.

**What good pages of this kind do.** The third source holds a reading of several hundred real
sites (`sources/taste-skill/skills/taste-skill/references/layout-v4.md`): what it measured in
them (section 1), and eleven first windows it has built and tested (section 3). Use it as one
more place to look, on these terms. A note taken from it is of the kind `same-category` and its
`Seen` is `described by` that file: nobody looked at a page. It may be the start of one
alternative, the common one, and that alternative is said to be the common one. It is never the
only source of a composition. A great many pages are now built from that same description, which
is the reason to know it and the reason not to stop at it.

**A note.**

```markdown
## R2  The back page of a seed catalogue

- Kind: other-craft
- Where: A printed mail-order catalogue, spring edition, the owner's copy.
- Seen: looked at 2026-11-20
- Does: One promise across the top in large type. Under it a table, not a picture: each row a
  variety, with a price and one line of what it is good for. The order form is the bottom third of
  the same page, already half filled in as an example.
- Take: A table as the picture. The thing to do shown already begun.
- Leave: Its drawings and its wording.
```

One thing a note, with where it can be seen. `Seen` is `looked at` and the day, `from memory`, or
`described by` and who: what is remembered of a page is the average of pages like it, and a
description is someone else's reading of it. `Does` is what you saw of the ten
decisions: which parts it has and which one leads, how long it is, what the first window holds and
how it is arranged, what the picture is, what form each section takes, how the page is paced.
`Leave` starts with everything that is the thing's own.

**What may be taken** is a form: where the words sit, what kind of thing the picture is, what a
section is shaped like, how the page is paced. Never the thing itself: a picture, an illustration,
wording, a mark, or an arrangement copied whole, so that the page would be mistaken for its source.
Draw each composition from two notes or more. Keep the notes and the links; keep a picture of a
reference only where the project may (the owner's own, the public domain, a licence that allows
it), and never in a repository others can read.

**Take a form once.** A page that borrows a timetable for its first window and then sets every
section as a timetable is wearing the timetable. One part of the page carries what was borrowed.
The rest is a plain page in the brand's look. The same holds for the look itself: a page whose
every label, rule and corner acts out one idea of what it is (a drawing, a newspaper, a ticket) is
read as a costume, and is one of the surest signs that nobody edited it.

## Proposing alternatives

Propose two or three compositions, each a whole idea of the page that starts from a different
note. Asked for three, anyone gives their usual page three times with the sections reordered, so
put them in one table: a column for each, a row for each of the ten decisions. Keep the table in
`composition-references.md`, under the notes.

- Two compositions are different when their skeletons differ (row 1), when they differ in row 2 or
  row 3 as well, and in four rows or more in all. A row whose cells all say the same is not a
  difference.
- One of them may be the page every visitor has seen. It is common because it works. Say that it
  is the common one, and never offer it twice.
- None of them rests on a tell: not its skeleton, not its picture, not what recurs. Read
  `references/tells.md` before the table is shown. A device chosen to make a page distinct is the
  likeliest place to find one. The common one is offered without the tells that usually come with
  it.
- Each has a length, in row 1, and the lengths differ where the skeletons do.
- For each, say in a sentence what it gives up: what a visitor in a hurry might miss, what it needs
  from the brief (a picture, a figure) and whether that exists.
- Check each against the fixed list at the smallest screen size before it is shown. One that fails
  there is taken out or changed.

## Choosing

The alternatives go to the owner with the rest of the plan, in words, before anything is built:
the table, a sentence of what each gives up, and which one is the common form. The choice is
theirs, and need not be the one you would make.

Where they cannot choose from words, build the first window of each: the same words and the same
look, differing only in how it is drawn. Show them side by side at the phone size and at the
widest.

Where the page is already under review with the `ux-quality-score` skill, its layout study makes
that comparison blind: the page as it stands and the other compositions, built apart from it, are
compared by fresh reviewers who are not told which is which. The owner still chooses
(`references/review-loop.md`).

## Recording it

The chosen composition goes in the brief as a `## Composition` section, written as a description of
the page for someone who has never seen it (`references/page-brief-format.md`), and as a dated
decision under Decisions, in the owner's name. In `composition-references.md`, note under the table
which was chosen, by whom and when. The brief says what the page is; that file keeps what else was
considered. Whoever reviews the page is handed the brief, so a
form that was chosen is not reported as a fault for being unusual, and a page that departs from its
own composition is.

Then build to it, section by section. A section that turns out to need another form is a change to
the brief: propose it and ask. Do not build something else and leave the brief as it was.

## A page that already exists

Its composition is the page as built. Write that down as the Composition section the first time
its composition is in question: when the owner says it looks like every other page or like a page
a model made, or when reviewers report how it is arranged in two reviews running. Then propose
alternatives to it as above, with the page as it stands as one of the columns.
