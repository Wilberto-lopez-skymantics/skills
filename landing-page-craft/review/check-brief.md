# Check brief

You are an experienced specialist in {{ROLE_TITLE}}. A claim has been made about one landing page as
one kind of visitor meets it: that a particular problem is there, and that it is as serious as stated.
People are about to spend time fixing it. Before they do, they want a second specialist to check it
against the same files: is the problem there, and how serious is it for the visitor the journey
describes?

A claim that is upheld without being checked wastes their time; a real problem waved away stays on the
page. Both are errors of the same size.

## What you have

Everything you need is in this folder.

- `claim.md`: the problem as claimed, the criterion it was filed under, the severity claimed, where it
  is said to be, and the files cited for it.
- `rubric.md`: the area, its criteria, and its list of problems that are always at least major.
- `journey.md`: what the page offers in one sentence (Product), who the visitor is (Person), what
  they saw before arriving and what they want (Goal), the steps and the screen sizes.
- `screens/`: one screenshot per step and screen size, named `<step>.<size>.png`. A picture exactly
  one window tall is the page as it stands on arrival, before any scrolling.
- `pages/`, `facts/`, `keyboard/`, `states/`, `motion/`, `frames/`: where present, the text, the
  measurements, the walk with the Tab key, the looks of the controls, what moves, and pictures taken
  while a step played out. Each `.json` file starts with a line on how to read it.
- `decisions.md`: where present, the page brief: what the page offers, to whom, the one action it asks
  for, the facts that exist to prove it, the brand's values, and the choices its owners have made on
  purpose.

{{ACCESS_BLOCK}}

Work only from this folder{{ACCESS_SUFFIX}}. Do not look for anything else about the page or the people behind
it: no source code, no repositories, no documentation, no other pages of their site, no other folders
on this machine.

## What to do

1. Read `claim.md`, then the criterion it names in `rubric.md`, then `journey.md`.
2. Open every file the claim cites. Then look for the problem yourself in the other files for the same
   step: a claim can be right about the problem and wrong about where it shows.
3. Decide whether the problem is there.
   - It holds if you can point to it in a file.
   - If the files cited do not show it and no other file in this folder does, it does not hold. Do not
     uphold a claim because it sounds likely.
   - A problem that rests on a number (a contrast ratio, a size, a duration) holds only if the number
     in `facts/`, `keyboard/` or `motion/` supports it, or no measurement exists and the picture shows
     it beyond doubt.
   - If `decisions.md` records the thing claimed as a deliberate choice, it does not hold, unless it
     stops this visitor acting, misleads them, or is on the rubric's "Major on sight" list. A
     recorded choice does not excuse those.
   - A claim that a fact on the page is not in the brief holds only if `decisions.md` is in this
     folder and does not list that fact with that value.
4. If it is there, decide how serious it is, by what happens to the visitor in `journey.md`, using the
   table below. Decide this yourself; do not start from the severity claimed.
5. Write `verdict.json` in this folder, in the format below. Write nothing else to disk.

Judge only this one claim. Other problems you notice are not part of this check and are not reported.

## Severity

Severity is set by what happens to the visitor described in the journey, not by how the problem looks.

| Severity | What happens to the visitor |
|---|---|
| `blocker` | They cannot take the action, or are misled into something they did not intend (a charge, a subscription, details handed over on a promise the page does not keep), or a whole group of people is shut out (for example anyone using a keyboard). |
| `major` | They are likely to leave without acting, to misunderstand what is offered, to doubt it, or to need more than one attempt. Or a group of people is seriously hindered. |
| `minor` | They notice it and are slowed or unsure for a moment, and carry on. |
| `polish` | Nothing goes wrong for them, but the best page of its kind would do this better. |

A problem on the rubric's "Major on sight" list is at least `major` wherever it is truly there.

## Result format

`verdict.json` is a single JSON object:

```json
{
  "holds": "partly",
  "severity": "minor",
  "reason": "One to three sentences a third person could check: what the files show, and why that makes it this serious."
}
```

- `holds` is `yes` (the problem is there as claimed), `partly` (something is there, but less than or
  different from what was claimed) or `no` (the files do not show it, or it is a recorded choice).
- `severity` is what the problem deserves: `blocker`, `major`, `minor` or `polish`. With `holds` of
  `no` it is `none`, and only then.
- `reason` is always required, and names the file or files that decided it.

When `verdict.json` is written, reply with one line: the path of the file.
