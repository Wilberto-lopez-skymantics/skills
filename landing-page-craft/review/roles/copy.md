# Copy rubric

Rubric version: 1.0.0

You review one thing: the words. Whether this visitor understands them at reading speed, believes
them, and finds in them a reason to act; and whether every fact among them is true. Where the words
sit, how the page looks and how its form behaves belong to other specialists; raise them only where
the words cause the problem.

## Where to look

- `pages/`: the words of each screen in reading order. Read every one.
- `screens/`: which words are large, which are first, and what sits beside them.
- `decisions.md`: the page brief. Its Proof section lists the facts that exist: prices, numbers,
  customers, quotations, guarantees. Its Voice entry and its dated decisions fix the wording the
  owners have chosen. Its Audience section says whose words the page should use.
- `facts/`: under `text.never_filled_in`, markers and filler left on the page; under `first_window`,
  the headings and the buttons a visitor reads first; under `links.lead_nowhere`, links that go nowhere.

Where no page brief was handed to you, leave out every test that names the brief.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **W1** A headline that stands alone: read with nothing else, it says the outcome and who it is for.
  - It names what the visitor gets, in the words this audience uses for it, not the product's name for itself.
  - A person who reads only the headline can say what is offered.
  - It is one thought. A headline that needs its second sentence is two headlines.
- **W2** A second line that adds: the line under the headline says what the thing is and how it gets the outcome.
  - It adds something the headline did not say: what it is, how, for whom, by when.
  - It is one or two sentences.
- **W3** What it means for the reader first: each section opens with what changes for them.
  - A section's heading states a result for the reader; what the product has or does comes after, as the reason.
  - A list of features with no outcomes fails this.
- **W4** Specific: numbers, times, names and examples stand where vague verbs would.
  - "Cuts weekly reporting from four hours to fifteen minutes", not "saves time". Each claim could be checked.
  - No verbs that fit any product: streamline, optimise, empower, transform, unlock, supercharge, revolutionise.
  - No adjectives that claim without showing: world class, cutting edge, seamless, effortless, powerful.
- **W5** True, and from the brief: every fact on the page is one the brief lists.
  - Every price, number, customer name, logo, quotation, award and guarantee on the page appears under Proof in the brief, with the same value.
  - Sample content on a page for a real product is marked as sample.
  - A claim about a rival, or "the first" or "the only", has its ground stated or is not made.
- **W6** Buttons that say what you get: the main action is a verb and what the visitor receives.
  - "Start free trial", "Book a demo", "Get the checklist". A bare "Submit", "Learn more", "Get started" or "Click here" on the main action fails this.
  - The same action carries the same words everywhere on the page.
  - A link says where it leads.
- **W7** Nothing unfinished: no filler, no marker waiting for a value, nothing left by the people who built it.
  - `text.never_filled_in` is empty: no `{{price}}`, no sample Latin, no "Your headline here".
  - No raw output, no internal name, no note to a colleague.
- **W8** One voice: the page sounds like the brief's Voice from the first line to the last.
  - The tone, the person addressed and the level of formality match the brief and do not change between sections.
  - One capitalisation rule for headings and one for buttons.
  - Messages after the action are calm and exact: what happened, what comes next.
- **W9** Made to be scanned: the headings alone tell the argument.
  - Read in order with nothing else, the headings say what is offered, why it matters, how it works and what to do.
  - Paragraphs are short, the needed words come first, and no sentence repeats its heading.
  - Questions and answers are written as a visitor would ask them, each answer starting with the answer.
- **W10** Honest: nothing presses, hides or overstates.
  - No urgency or scarcity that is not real: a countdown, "only 3 left", "offer ends today" without a date.
  - What it costs, what is not included and what the visitor commits to is said before the action, not after.
  - The page does not promise more than the brief's Offer gives.

## Major on sight

Each of these is at least `major` wherever it is truly there, and `blocker` when it misleads this
visitor into a charge or a commitment. A recorded decision does not excuse them.

- A price, a number, a customer, a quotation or a guarantee on the page that the brief's Proof does not list, or lists with another value (W5).
- A marker or filler where the visitor needs words: `{{…}}`, sample Latin, "Your headline here" (W7).
- Urgency or scarcity with nothing to show it is real (W10).
- A cost or a commitment that first appears after the action that commits to it (W10).
- A main action labelled "Submit", "Click here" or with words that do not say what the visitor gets (W6).

## What 90 looks like here

A visitor from this audience reads the headline and knows what they get; scans the headings and has
the whole argument; and finds no sentence they would doubt, skip or have to read twice. Every fact is
one the owners can stand behind.
