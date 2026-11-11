# Conversion rubric

Rubric version: 1.0.0

You review one thing: whether this page brings this visitor to its one action. What the first window
says, what the page asks for, the order of its argument, and what stands between the visitor and the
action. The wording itself, the look, and access for people with different abilities belong to other
specialists; raise them only where they decide whether the visitor acts.

## Where to look

- `decisions.md`: the page brief. Its Offer, Audience, Arrival, Action, Proof and Objections sections
  say what this page is for. Judge the page against them, not against a page you would have planned.
- `journey.md`: its Goal says what this visitor was told before arriving and what they want.
- `screens/`: a step whose picture is one window tall shows the page as it stands on arrival, before
  any scrolling. Later steps show the whole page, then what follows the action.
- `facts/`: under `first_window`, the headings, the buttons and links and the number of form fields a
  visitor sees before scrolling, at each screen size, and whether a button is cut off at the bottom
  edge. Under `links.lead_nowhere`, links that go nowhere. Under `labels`, the form fields and their
  types. Under `head`, the title, the description and the sharing card.
- `pages/`: the page's words in reading order, to follow the order of the argument.

Where no page brief was handed to you, leave out every test that names the brief.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **K1** The promise first: before scrolling, the page says what is offered, for whom, and what they get.
  - The first window holds a headline that names the outcome, and the visitor can tell from it or the line under it whether this is for them (`first_window.headings`).
  - The offer in the first window is the brief's Offer, not the company, a category or a slogan.
  - This holds at every screen size captured, not only the widest.
- **K2** One action: the page has one main action, and it is in the first window.
  - The brief's Action is offered in the first window at every size, whole, not cut off at the bottom edge (`first_window.buttons_and_links`).
  - Nothing else in the first window competes with it: no second button of the same weight that leads somewhere else. A quiet second link (a sign-in, "see how it works" to a place further down this page) is not a competitor.
  - The navigation does not offer ways out that the brief's action does not need.
- **K3** The same promise as before: the first window keeps the promise this visitor was given before arriving.
  - The headline uses the words, the offer and the audience named under Arrival in the brief and in the journey's Goal.
  - What was promised before arriving (a price, a free trial, a download) is in the first window, not further down or missing.
- **K4** Proof near the promise: the page shows it is true, early, and beside what it supports.
  - One sign of proof sits in or directly under the first window: named customers, a number, a short quotation.
  - Each strong claim has its proof beside it, not gathered at the bottom of the page.
  - The proof is the kind this audience trusts: people and organisations like them.
- **K5** The argument in order: each section does one job, and the sections follow the questions a visitor asks.
  - What it is, what changes for me, how it works, who else uses it, what if it goes wrong, then the action again.
  - No section is there for the company's sake: nothing a visitor has to read past to reach what they came for.
  - The page makes one offer. A second offer, a second audience or a second product is a different page.
- **K6** Objections answered: every objection in the brief is answered on the page, before the last call to act.
  - Each objection listed in the brief has an answer a visitor can find by scanning the headings.
  - Where the action costs money or commitment, the answers come before or beside it, not only in a list of questions at the foot.
- **K7** Risk taken away at the point of action: beside the action, the page says what acting costs and commits.
  - Next to the main action: what it costs, whether a card is needed, how long it takes, how to leave.
  - At least one reassurance the brief lists as true is shown there: a free trial, no card, cancel at any time, a guarantee.
- **K8** A fair ask: the page asks for no more than the action needs.
  - A form asks only for what the brief's action needs. Every further field costs visitors.
  - What happens to what is typed, and what happens next, is said at the form.
  - Nothing is asked before the visitor has been told what they get.
- **K9** The action again: wherever a visitor is ready, the action is within reach.
  - The main action is repeated at the end of the page, and after long sections, with the same words and the same destination.
  - On a long page the action stays in reach without scrolling back to the top.
- **K10** What follows the action: pressing it does what it says, and the visitor knows it worked.
  - The main action leads where its label says: it is not a link that goes nowhere (`links.lead_nowhere`).
  - After acting, the page says what happened and what comes next: when, where, by what means.
  - A mistake in a form is said beside the field, in words, and nothing typed is lost.
- **K11** The promise before arrival: the title, the description and the sharing card make the same promise as the page.
  - `head.title` and `head.description` exist, say the offer, and are not cut short in a search result (about 60 and 160 characters).
  - A sharing card exists: `head.open_graph` has a title, a description and an image.
  - Where the brief says the page is for one campaign or one period, it asks not to be indexed (`head.robots`); where the brief says it should be found by search, it does not.

## Major on sight

Each of these is at least `major` wherever it is truly there, and `blocker` when it stops this visitor
taking the action. A recorded decision does not excuse them.

- No main action in the first window at a captured size, or one cut off at the bottom edge (K2).
- Two or more actions of the same weight in the first window that lead to different things (K2).
- A first window that does not say what is offered (K1).
- A first window that promises something other than what this visitor was told before arriving (K3).
- A main action that leads nowhere, or somewhere its label does not say (K10).
- A form that asks for a payment card, a telephone number or a postal address the brief's action does not need (K8).

## What 90 looks like here

A visitor who gives the page five seconds knows what is offered, that it is for them, and what to
press. Every doubt the brief lists is answered before the page asks again, the ask is no larger than
the action needs, and nothing on the page leads anywhere else.
