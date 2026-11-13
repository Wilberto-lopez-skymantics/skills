# Comparison brief

You are an experienced product designer. A team has built {{COUNT}} arrangements of the same part of a
software product, and must choose one. Every arrangement holds the same content and offers the same
actions, for the same person doing the same task; only the way the screen is arranged differs: what
comes first, what sits beside what, what is in view and what has to be looked for, how the screen is
rebuilt at each size. They want to know which arrangement serves that person best, and why.

A preference that cannot be shown on a screen is useless to them. So is a ranking decided by which
arrangement looks more finished: all of them will be finished to the same standard once one is chosen.

## What you have

Everything you need is in this folder.

- `task.md`: the product in one sentence, who the person is, what they are trying to do, the steps
  compared and the screen sizes.
- {{LETTERS}}: one folder per arrangement. Each holds `screens/`, with one screenshot per step and
  screen size, named `<step>.<size>.png`. The same file name in two folders shows the same step at the
  same size, with the same data, in two arrangements.
- Where a screen is longer than the window it is shown in, its screenshot shows all of it, as
  scrolling would, and a second file beside it, `<step>.<size>.window.png`, shows the window alone as
  the person finds it on arrival, before any scrolling. Take what is in view on arrival from the second
  file, never from a height you estimate on the long one. Take from it, too, the place of anything
  fixed to an edge of the window, such as a bar of buttons: the long screenshot may draw such a thing
  lower than the person sees it, or across the middle of the page. A screen with no second file is
  shown as the person finds it on arrival.

The letters were given at random. They say nothing about which arrangement is older, newer, or
expected to be chosen.

Work only from this folder. Do not look for anything else about the product: no source code, no
repositories, no documentation, no other folders on this machine.

## What to do

1. Read `task.md`. Keep the person and what they are trying to do in mind for everything that follows.
2. Open every screenshot of every arrangement. Go step by step and size by size, with the arrangements
   side by side: the same step at the same size in each, before moving to the next.
3. For each step, ask of each arrangement, as the person in `task.md`:
   - Is what they need most for this step the first thing they see, and is it plain what to do next?
   - Is what they need in order to decide in view where they decide, or must they look for it, scroll
     to it, open something, or carry it in their head from another place?
   - Do the things that belong together sit together, and stand apart from what does not?
   - How much must they read, find or do before they can act?
   - Does it hold at every size, and above all at the size `task.md` gives as the person's own: is the
     screen rebuilt for that size, or the largest one made smaller, with something pushed out of view?
4. Leave aside what the arrangements have in common: a problem that all of them share does not
   separate them. Leave aside differences of finish too (a colour, a font, a small misalignment,
   a wording), unless one keeps the person from reading or using the screen.
5. Rank the arrangements from best to worst for this person and this task. No ties: where two are
   close, decide, and say that it was close.
6. For every arrangement, write down what it does better than the others and what it does worse, each
   point with the screenshot that shows it. Then write down what the arrangement you ranked first
   still gets wrong.
7. Write `comparison.json` in this folder, in the format below. Write nothing else to disk.

Judge the arrangements as they are. Do not design a new one, and do not describe a blend of two: if
the best of one and the best of another would belong together, your points for each already say so.

## Result format

`comparison.json` is a single JSON object:

```json
{
  "ranking": ["B", "A", "C"],
  "margin": "clear",
  "reason": "Two to four sentences a third person could check: what puts the first arrangement ahead for this person, and what puts the last one behind.",
  "arrangements": {
    "A": {
      "better": [
        { "what": "One thing this arrangement does better than the others, and what that means for the person.", "evidence": ["A/screens/02-choose.tablet.png"] }
      ],
      "worse": [
        { "what": "One thing it does worse than the others, and what that costs the person.", "evidence": ["A/screens/02-choose.phone.png"] }
      ]
    },
    "B": { "better": [], "worse": [] },
    "C": { "better": [], "worse": [] }
  },
  "still_wrong": [
    { "what": "Something the arrangement ranked first still gets wrong.", "evidence": ["B/screens/01-open.phone.png"] }
  ]
}
```

- `ranking` lists every letter once, best first.
- `margin` says how far the first is ahead of the second: `clear` or `close`.
- `reason` is always required.
- `arrangements` has an entry for every letter, each with a `better` and a `worse` list. A list may be
  empty, except that the arrangement ranked first has at least one point under `better` and the one
  ranked last at least one under `worse`.
- Every point has `what`, in plain words, and `evidence`: at least one screenshot of that arrangement
  that shows it, as a path from this folder (`A/screens/...` for a point about `A`). Either file of a
  long screen may be cited: cite the one the point can be seen on.
- `still_wrong` may be empty. Its points cite screenshots of the arrangement ranked first.

When `comparison.json` is written, reply with one line: the path of the file.
