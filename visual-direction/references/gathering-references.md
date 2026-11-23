# Gathering references

A candidate is only as particular as what it was drawn from. Three candidates drawn from three
screenshots of products like this one are three versions of the look this product already has.
This file says what to look at, how to note it, and what may be taken.

## The kinds

Every note has one kind.

| Kind | Is | Why it is here |
|---|---|---|
| `own-world` | What the product's own people read and handle at work: forms, labels, signs, instruments, drawings, logbooks, vehicles, the board on the wall | A look that belongs to this product, and that its people already know how to read, starts here |
| `other-craft` | Something that is not software: a timetable, a map, a field guide, packaging, a dial, a ticket, a building's signs | Other crafts solved density, emphasis and legibility long ago, each in its own way |
| `other-software` | Software of another category, or of another time | Shows that a screen can look otherwise and still work |
| `owner` | Anything the owner brings, whatever it is | Their taste is the one thing no library holds |
| `same-category` | Products that do what this one does | To know what the category looks like, so as to stand apart from it. Notes are taken; a direction is never drawn from these alone |

A study needs two notes for each candidate (and four at least), of three kinds or more, with one
`own-world` and one `other-craft` among them. Each candidate starts from a different note.

## Where to look

In this order.

1. **Ask the owner, once, in one batch.** For things they admire and things they do not want to
   resemble, of any kind: a site, a magazine, a tool they like using, a photograph of their own
   workplace. Also for what the product's people already use: the form on the clipboard, the label
   on the shelf. An owner's own photograph of the whiteboard is worth more than a hundred pictures
   of dashboards.
2. **The product's own world.** If the owner cannot supply it, look for it: public archives and
   museum collections, standards and manuals, a trade's own publications, photographs of the place
   and the equipment.
3. **Other crafts,** chosen for a problem this product has. Dense figures: a timetable, a
   tide table, a stock page. Finding one thing fast: signs, a dial, a map's key. Long use in poor
   light or on the move: an instrument, a road sign.
4. **Software.** With a browser tool, look at the thing itself. Where the project has a library of
   real product screens connected, search it for another category that has this product's problem
   (a dense table, a schedule, a form used in the field), not for this product's category.

Do not use as a reference: a generated image, another generated interface, or a gallery of
concept pictures of screens that were never built. They are the commonest look already.

## What good sites of each trade use

One more place to look comes with this skill: `sources/taste-skill/skills/taste-skill/library/palettes.json`,
copied unchanged from a public skill at a pinned commit. It is a reading of real sites: 64
palettes, each with the trades it suits (`trades`), six colours (`bg`, `surface`, `ink`, `muted`,
`accent`, `accentInk`), a sentence on how those colours are used (`note`), and the sites it was
seen on (`seenIn`, as short names from two galleries of real sites).

It is used on these terms.

- **It feeds the familiar candidate, and only that one.** Step 6 asks for one candidate close to
  what people who use products of this kind already expect. A palette from this list is a fair
  start for it. That candidate is said to be the familiar one when it is shown, whether or not
  `check` says anything.
- **Its note is a note of the kind `same-category`,** and its `Seen` is `described by the palette
  library that comes with this skill`: nobody looked at a site. Where one of the sites it names can
  be opened, open it and write the note from the site, as `looked at`. The checks on references
  hold as for any other: a direction is never drawn from this kind alone.
- **It gives six of the sixteen colours a candidate needs.** The lines, the focus ring and the
  colours of the states are yours to add, and `check` measures all of them against the floor. A
  palette that is in the list is not excused from it.
- **Nothing is dealt.** The list is read, and a palette is proposed for a reason that can be said.
  The owner chooses between candidates as before.

The skill it comes from is in wide use, so a look taken from this list is by now a common one.
That is why it serves for the familiar candidate and for nothing else.

## Writing a note

```markdown
## R3  A printed regional bus timetable

- Kind: other-craft
- Where: The county's printed timetable booklet, current edition.
- Seen: looked at 2026-11-19
- Does: Dense tables of times in a humanist sans with strong, open figures. On the cover, route
  numbers are reversed out of rounded lozenges in one bright colour on a dark ground. Inside,
  alternate rows are tinted, not ruled.
- Take: Figures that read at a glance in a dense table. A tint in place of a line between rows. A
  rounded lozenge for the one thing to find.
- Leave: The operator's livery colours and its route symbols.
```

- **One thing a note.** "Railway timetables" is a kind of thing; a note is of one timetable that was
  looked at.
- **Where** is a link, or where it can be seen. Whoever reads the record later should be able to
  find it.
- **Seen** is one of three: `looked at` and the day (`looked at 2026-11-19`); `from memory`; or
  `described by` and who (`described by the owner`), for a thing someone told you about and you
  never saw. Anything else is refused. What is remembered or retold of a thing is the average of
  things like it, which is the opposite of what a reference is for: `check` counts the three, and
  warns when more than half the notes are of things that were not looked at. Where the owner
  describes something they could send, ask for the picture.
- **Does** is what you saw, in words and in numbers where you can count them: how many sizes of
  type, how many colours and where each appears, what is largest, how one thing is told from the
  next, how tight it is.
- **Take** is the properties worth taking.
- **Leave** starts with everything that is the thing's own.

## What may be taken

A property may be taken: a class of typeface, how many sizes it uses, where colour appears and how
much, whether things are ruled or boxed, how tight the rows are, what is made largest.

The thing itself may not: a mark or a logo, a picture, an illustration, an icon, wording, a named
colour that is someone's trade mark, or an arrangement so particular that a screen would be
mistaken for the source. A direction that could be mistaken for one of its references is a copy.
This is why every direction is drawn from at least two.

Nor may the object be put on as a costume. A reference is worth what it knows: a timetable knows
how to set figures to be read at a glance, an engineering drawing how to keep a great many labels
quiet, a newspaper how to rank ten things on one sheet. Take what it knows and use it where the
product has that same problem. Do not make the product look like the timetable, the drawing or
the newspaper. A look that acts its reference out in every part is seen at once for what it is,
and it is one of the surest signs that a page was generated.

A typeface is the exception that has a price: the family itself is used, under its licence. Name
the licence in the candidate before the owner sees it.

## What may be kept

Keep the notes and the links. Keep a picture of a reference only where the project may: the
owner's own photographs, works in the public domain, material whose licence allows it. A picture
taken from a site or from a library of screens is looked at and described, not kept, and is never
put in a repository others can read.
