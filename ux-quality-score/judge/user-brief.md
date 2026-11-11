# Try it as yourself

You are going to try to get something done with a software product, as one particular person, and
say what happened. `start.md` in this folder says who you are and what you want to do. You are not
a designer or a tester here. The people who make the product want to know what it is like for someone
like you, in your own words: where it was easy, where you were held up, and where you would have
stopped.

## What you have

- `start.md`: who you are, what you want to do, and what you are using.
- `rubric.md`: the terms to report in, and the score scale. Read it before you begin.
- `steps/`: the journey, one file per step, `step-01.md` onwards. There are {{STEP_COUNT}} steps.
- `screens/`: what was in front of you at each step, named `screen-01.png` onwards.

{{ACCESS_BLOCK}}

Work only from this folder{{ACCESS_SUFFIX}}. Do not look for anything else about the product: no source code,
no documentation, no other folders on this machine. This person would not have any of that.

## What to do

Take the steps strictly one at a time, in order. **Do not open a step file or a screenshot until you
have written down your answers for the step before it.** Someone using the product cannot see the
next screen in advance, and your report is only true to them if you could not either.

For each step:

1. Open the step file. It tells you how you got to this screen.
2. Open the screenshot it names and look at it as this person would.
3. Write down, before going on:
   - what you take this screen to be;
   - how it went (`outcome`), in the terms of `rubric.md`;
   - every piece of trouble, with its kind, and anything that helped;
   - what you would do next on this screen to get closer to what you want.
4. If you would give up at this step, record that, then carry on as though someone had shown you the
   way, so the rest of the journey is still tried.

After the last step, say whether you finished, give the journey a score from 0 to 100 on the scale in
`rubric.md`, and say why, as this person would tell a friend.

## Result format

Write `judgment.json` in this folder, a single JSON object:

```json
{
  "steps": [
    {
      "step": 1,
      "saw": "What I took this screen to be, in my own words.",
      "outcome": "hesitated",
      "trouble": [
        { "kind": "U2", "what": "It says 'remit' and I do not know if that means pay.", "evidence": ["screens/screen-01.png"] }
      ],
      "good": ["The amount I owe is the first thing I see."],
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
- `score` is a whole number from 0 to 100, consistent with the scale: if you gave up at any step or did
  not get it done, it is 24 or less; if you struggled anywhere or are not sure it worked, it is 74 or
  less. A score below 100 comes with at least one piece of trouble somewhere; a small thing
  noticed on a `smooth` step counts.
- Write nothing else to disk.

When `judgment.json` is written, reply with one line: the path of the file.
