# Content rubric

Rubric version: 5.0.0

You review one thing: the words. Whether they are clear to this person, whether they tell the truth,
and whether they help or get in the way. How the screens look and how the flow behaves belong to other
specialists; raise them only where the words cause the problem.

## Where to look

- `pages/`: the words of each screen in reading order. Read every one.
- `screens/`: where the words sit, and what is beside them.
- `facts/`: the names of controls and the labels of fields (`labels`).
- `decisions.md`: its Voice entry, and any decision that fixes a name or a term, is this product's
  chosen wording. Judge the screens against it.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **C1** One name per thing: the same thing has the same name on every screen of the journey.
  - One thing has one name in the navigation, headings, buttons and messages.
  - A navigation label and the title of the screen it opens use the same words.
  - One action has one verb: "Delete" does not become "Remove" two screens later.
- **C2** Plain words: labels, headings and buttons use everyday words, and any specialist term the product needs is explained where it first appears.
  - No internal terms, codes or idioms: a person who has never seen the product knows each word.
  - One sentence carries one idea, and instructions lead with the action.
- **C3** Honesty: the words tell the truth and do not steer.
  - A control does what its label says, and a status says what is true now.
  - No invented urgency, no consent ticked in advance, no cost that first appears at the last step, no decline option worded to be missed.
  - Sample or demonstration data is marked as such.
- **C4** Before commitment: before the person commits money, takes a binding step or shares personal details, the screen says what will happen, how much, and to whom.
  - What an action will cost, change or send is stated before the control that commits it.
  - What happens next is said at the point of commitment: when it takes effect, whether it can be changed.
- **C5** No leftovers: no placeholder text, internal identifiers, raw codes or developer wording.
  - No filler: sample Latin, "TODO", "Label", "Title goes here".
  - No raw output: `undefined`, `null`, `NaN`, an object printed as text, an internal key or id, a stack trace.
  - No control that does nothing and no link that leads nowhere.
- **C6** Specific labels: buttons and links say their specific outcome.
  - A button names its action with a verb, and its object where there could be doubt. "OK", "Yes" and "Submit" alone fail this where a specific label exists.
  - Link text says where it leads. "Click here" and a bare "Learn more" fail this.
  - A confirmation's title names the action and the object, never "Are you sure?".
- **C7** Written for this person: messages fit this person's situation and knowledge.
  - The tone fits the stakes: calm and exact when something failed or will be destroyed; no jokes, no blame, no "oops" there.
  - The words are the person's, not the system's: what they call the thing, not what the database calls it.
  - One capitalisation rule for each kind of element: all buttons one way, all headings one way.
- **C8** Relevant: every sentence on the screen helps with this step.
  - Nothing is addressed to a different kind of user, and nothing repeats the heading in the body or explains what is already plain.
  - The most needed words come first: on the screen, in each paragraph and in each label.
  - Help appears where the question arises.
- **C9** Open about limits: the product says what it does not do, what is information and not advice, and what the person must do somewhere else.
  - What the product cannot do, or cannot do right now, is said with the reason.
  - Values that are estimates, out of date or partial say so: as of when, roughly, first 50 of 312.

## Major on sight

Each of these is at least `major` wherever it is truly there, and `blocker` when it leads this person
into a harmful mistake. A recorded decision does not excuse them.

- A status or a confirmation that says something untrue: "Saved", "Sent" or "Paid" when the files show it is not (C3).
- A cost, a charge or a binding consequence that first appears after the control that commits to it (C4).
- Consent ticked in advance, or a decline option worded or styled to be missed (C3).
- Raw output where the person needs a value or a message: `undefined`, `null`, `NaN`, an error code with no words (C5).

## What 90 looks like here

Every word helps this person do what they came for: nothing is unclear, misleading, generic or in the
way, and one thing has one name from the first screen to the last.
