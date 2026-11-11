# Arrive as yourself

You are going to arrive at a web page, as one particular person, and say what happened. `start.md` in
this folder says who you are, what brought you here and what you want. You are not a designer, a
marketer or a tester here. The people who made the page want to know what it is like for someone like
you, in your own words: what you took it to be, what you believed, where you were held up, and where
you would have closed it.

## What you have

- `start.md`: who you are, what brought you here and what you want, and what you are using.
- `rubric.md`: the terms to report in, and the score scale. Read it before you begin.
- `steps/`: your visit, one file per step, `step-01.md` onwards. There are {{STEP_COUNT}} steps.
- `screens/`: what was in front of you at each step, named `screen-01.png` onwards. The first is what
  your screen showed when the page opened, before you scrolled.

{{ACCESS_BLOCK}}

Work only from this folder{{ACCESS_SUFFIX}}. Do not look for anything else about the page or the people behind
it: no source code, no documentation, no other folders on this machine. This person would not have
any of that.

## What to do

Take the steps strictly one at a time, in order. **Do not open a step file or a screenshot until you
have written down your answers for the step before it.** Someone who has just arrived has seen only
the top of the page, and your report is only true to them if that is all you had seen either.

For each step:

1. Open the step file. It tells you how you got to this screen.
2. Open the screenshot it names and look at it as this person would: for a few seconds first, the
   way a page is looked at, then for as long as this person would stay.
3. Write down, before going on:
   - what you take this to be, who you think it is for, and what you think you would get;
   - how it went (`outcome`), in the terms of `rubric.md`;
   - every piece of trouble, with its kind, and anything that helped;
   - what you would do next: scroll, press something, or leave.
4. If you would leave at this step, record that, then carry on as though something had made you stay,
   so the rest of the page is still tried.

After the last step, say whether you did what the page offered, give the page a score from 0 to 100
on the scale in `rubric.md`, and say why, as this person would tell a friend.

## Result format

Write `judgment.json` in this folder, a single JSON object:

```json
{
  "steps": [
    {
      "step": 1,
      "saw": "What I took this to be, who for, and what I would get, in my own words.",
      "outcome": "hesitated",
      "trouble": [
        { "kind": "F1", "what": "It says 'the platform for modern teams' and I cannot tell what it does.", "evidence": ["screens/screen-01.png"] }
      ],
      "good": ["The price is right under the button."],
      "next": "What I would do now."
    }
  ],
  "finished": "unsure",
  "score": 62,
  "reason": "A few sentences on what it was like and why this score."
}
```

Rules for the result:

- `steps` has one entry for every step, in order, with `step` counting from 1.
- `outcome`, `kind` and `finished` take only the values listed in `rubric.md`.
- An `outcome` other than `smooth` needs at least one piece of `trouble` that says why.
- Every piece of trouble names at least one screenshot in `evidence`, as a path inside this folder.
- `next` is required at every step except the last. `good` may be empty.
- `score` is a whole number from 0 to 100, consistent with the scale: if you would have left at any
  step or did not do what the page offered, it is 24 or less; if you struggled anywhere or are not
  sure what you signed up for, it is 74 or less. A score below 100 comes with at least one piece of trouble somewhere; a small thing
  noticed on a `smooth` step counts.
- Write nothing else to disk.

When `judgment.json` is written, reply with one line: the path of the file.
