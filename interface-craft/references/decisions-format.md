# The decisions file

A project that uses this skill keeps one file, `design-decisions.md`, that records what the
project has settled about its own interface. It is the first thing in the order of authority:
where it speaks, it wins over the project's inherited tokens, over this skill's ownership table
and over every source file.

It exists so that settled questions stay settled. Without it, each new worker re-decides the
corner radius and each new reviewer reports the house style as an issue.

A starting copy is in `assets/design-decisions.example.md`.

## Where it lives

Wherever the project likes, under version control, next to the code or the design notes. In a
spec-driven workspace keep it outside the frozen `specs/` set, because it grows by appending while
the frozen set does not change. Tell workers and reviewers where it is; nothing in this skill
searches for it.

## The two parts

### Style

The settled values, written so that a worker can apply them and a reviewer can check them. One
short section for each of these, in this order. Leave a section out rather than fill it with a
guess; a missing section means "not decided, use the project's existing tokens, then the
sources".

| Section | Holds |
|---|---|
| Type | Font families and what each is for, the sizes in use and the role of each, weights, line length for long text |
| Colour | The neutrals, the accent, the status colours and what each means, plus the colour contract table below |
| Spacing | The scale in use and which step goes with which relation (inside a control, between a label and its field, between groups, between sections) |
| Shape | Corner sizes by kind of element, border and shadow use, icon family |
| Density | How tight the product is, by input: pointer screens and touch screens |
| Motion | Whether the product moves at all, durations and curves by kind of element, what happens under reduced motion |
| Voice | Who the product speaks to and how: person, tone by stakes, capitalisation, words the product uses and words it avoids |

The **colour contract** is a table of every foreground and background pair the product is allowed
to put together. A pair that is not in the table is not used.

| Foreground | Background | Used for | Minimum contrast |
|---|---|---|---|

"Minimum contrast" is the ratio the pair must reach (4.5:1 for text, 3:1 for large text and for
the edges and states of controls), not the ratio it happens to have today.

Values in Style point at the project's real tokens by name where they exist. The file records
which token is right, the tokens stay where they are.

### Decisions

An append-only list. Each entry has these fields:

```
### D-NNN  <the decision in one line>

- Date: YYYY-MM-DD
- Decision: what was chosen, stated so it can be checked on a screen.
- Why: the reason, in a sentence or two.
- Applies to: the whole product, or the screens, components or sizes it covers.
- Supersedes: D-NNN, or "nothing".
```

`NNN` counts up from 001 and is never reused.

## Rules

1. **The project's file wins over every source.** A source file that says otherwise is ignored
   for that point.
2. **Entries are appended, never rewritten.** To change a decision, add a new entry that names
   the one it supersedes. The old entry stays, so the history of why can be read. When a decision
   changes a value in Style, update Style in the same edit and cite the entry.
3. **Only the owner adds a decision.** An agent that thinks a decision is needed proposes the
   entry in its hand-back and asks. It does not write the entry, and it does not act as though
   the entry existed.
4. **A decision settles taste and scope. It never excuses a failure.** No entry can permit
   anything on the major-on-sight list in `review-standards.md`, or anything that stops a person
   finishing or misleads them. An entry that tries is void for that part, and a reviewer reports
   the failure and the entry together.
5. **Reviewers are given the whole file** and treat a recorded choice as chosen, not as an issue.
   A screen that departs from the file is the finding, not the file's choice.
6. **Workers read it before the sources.** If the file settles the point, the task is to apply
   it, and no source file needs to be opened.

## What belongs in it and what does not

Belongs: a choice between defensible options that someone would otherwise re-open (dense tables,
sentence-case buttons, no motion on navigation, a 6 px corner on controls), and a limit of scope
(desktop only for the admin area, no dark theme this release).

Does not belong: a rule that every product should follow anyway (those are in
`review-standards.md`), an implementation note, a task, or a bug.

## Use by other tools

A review tool can be pointed at the file so its reviewers receive it. `ux-quality-score` reads it
through a `decisions` key in its config, a path relative to that config file. This skill does not
depend on that or on any other tool: the file is plain Markdown for people and agents to read.
