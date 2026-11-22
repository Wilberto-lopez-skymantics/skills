'use strict';
// Checks the word count that the brief's Length is held to:
//   node --test scripts/page-words.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'page-words.cjs');
const { count } = require(SCRIPT);

const PAGE = `<!doctype html>
<html><head><title>Not counted at all</title><style>.a { content: "nor this"; }</style></head>
<body>
  <nav><a href="/">Home</a> <a href="/pricing">Pricing</a></nav>
  <header>
    <h1>Invoices that get paid <em>in days</em></h1>
    <p>Send in a minute. Reminders go out on their own &mdash; free for 30&nbsp;days.</p>
    <button>Start my free trial</button>
    <select><option>Not counted</option><option>Nor this</option></select>
  </header>
  <!-- a comment with several words in it -->
  <section>
    <h2>What happens on each date</h2>
    <p>The invoice goes out.<br>Then a reminder.</p>
    <div data-words="off"><p>Sample invoice for Acme: twelve hundred euros</p><div>nested <span>still sample</span></div></div>
    <section><h3>A part inside a part</h3><p>Belongs to the outer one.</p></section>
    <p class="flex hidden md:block">Counted: a class is not the attribute.</p>
    <p hidden>Not counted, by the attribute.</p>
    <svg><title>Not counted</title><text>Counted label</text></svg>
  </section>
  <p>Words outside.</p>
  <footer><p>Example Ledger Ltd, registered somewhere, not counted.</p></footer>
  <script>var notCounted = "at all";</script>
</body></html>`;

test('counts what a visitor reads, part by part, and nothing else', () => {
  const r = count(PAGE);
  assert.deepStrictEqual(r.parts.map((p) => [p.name, p.words]), [
    ['Invoices that get paid in days', 6 + 14 + 4],
    ['What happens on each date', 5 + 7 + 5 + 5 + 7 + 2],
    ['(outside any section)', 2],
  ]);
  assert.strictEqual(r.words, 24 + 31 + 2);
  assert.strictEqual(r.parts.reduce((n, p) => n + p.share, 0) >= 99, true);
  assert.deepStrictEqual([r.headline, r.headline_words], ['Invoices that get paid in days', 6]);
  assert.strictEqual(r.sample_words, 10, 'the words inside a picture made of text are counted apart');
  assert.strictEqual(r.dashes, 1);
});

test('plain text is counted whole, and a word is something with a letter or a figure in it', () => {
  const r = count('Paid in 6 days \u2014 not 6 weeks.\n\n30-minute call, \u00a34,000, a/b.');
  assert.strictEqual(r.words, 7 + 4);
  assert.deepStrictEqual(r.parts.map((p) => p.name), ['(the whole text)']);
  assert.strictEqual(r.headline, null);
});

test('the command reports the count and fails a page that is over its length', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-words-'));
  try {
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, PAGE);
    const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    const within = run([file, '--budget', '60']);
    assert.strictEqual(within.status, 0, within.stderr);
    assert.match(within.stdout, /^57 words, within the 60 in the brief\nheadline: 6 words\n/);
    assert.match(within.stdout, /sample words, counted apart: 10/);
    const over = run([file, '--budget', '50', '--json']);
    assert.strictEqual(over.status, 2);
    assert.deepStrictEqual([JSON.parse(over.stdout).words, JSON.parse(over.stdout).over], [57, 7]);
    assert.strictEqual(run([]).status, 1);
    assert.strictEqual(run([file, '--budget', 'many']).status, 1);
    assert.strictEqual(run([path.join(dir, 'missing.html')]).status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('questions are counted folded or open, and the footer is not', () => {
  const r = count('<main><section><h2>Questions</h2><details><summary>Is it safe?</summary><p>Yes, and here is why.</p></details></section></main><footer>Small print here</footer>');
  assert.strictEqual(r.words, 1 + 3 + 5);
});
