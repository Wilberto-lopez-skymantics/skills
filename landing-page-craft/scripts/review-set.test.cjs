'use strict';
// Checks that the reviewer set under review/, the example files under assets/, the references and
// the vendored sources hold together:
//   node --test scripts/review-set.test.cjs
// The last test hands the set to the review skill's own script, and is skipped when the
// ux-quality-score skill is not installed beside this one.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SKILL = path.join(__dirname, '..');
const REVIEW = path.join(SKILL, 'review');
const UXQ = path.join(SKILL, '..', 'ux-quality-score', 'scripts', 'uxq.cjs');
const skip = fs.existsSync(UXQ) ? false : 'the ux-quality-score skill is not installed beside this one';
const set = JSON.parse(fs.readFileSync(path.join(REVIEW, 'set.json'), 'utf8'));
const PREFIX = { conversion: 'K', copy: 'W', brand: 'B', accessibility: 'X', responsive: 'S', user: 'F' };
// Words about how reviewing is organised. A reviewer who reads them stops judging the page alone.
const FORBIDDEN = ['adversarial', 'iteration', 'ledger', 'previous review', 'other reviewers', 'another reviewer', 'other judges', 'loop', 'baseline', 'planted', 'earlier run', 'round', 'worker'];

const uxq = (args) => spawnSync(process.execPath, [UXQ, ...args], { encoding: 'utf8' });
const markdown = (dir) => fs.readdirSync(dir, { withFileTypes: true }).map((e) => (e.isDirectory() ? markdown(path.join(dir, e.name)) : e.name.endsWith('.md') ? fs.readFileSync(path.join(dir, e.name), 'utf8') : '')).join('\n');

test('the set: six rubrics, one version, each with criteria of its own, and nothing about how reviewing is organised', () => {
  assert.strictEqual(set.name, 'landing-page');
  assert.deepStrictEqual(Object.keys(set.specialists), ['conversion', 'copy', 'brand', 'accessibility', 'responsive']);
  const versions = new Set();
  for (const role of [...Object.keys(set.specialists), 'user']) {
    const text = fs.readFileSync(path.join(REVIEW, 'roles', `${role}.md`), 'utf8');
    versions.add((text.match(/^Rubric version: (\S+)$/m) || [])[1]);
    const ids = [...text.matchAll(/^- \*\*([A-Z][0-9]+)\*\* /gm)].map((m) => m[1]);
    assert.ok(ids.length >= 6, `${role} has ${ids.length} criteria`);
    assert.deepStrictEqual(ids, ids.map((_, i) => `${PREFIX[role]}${i + 1}`), `${role}: criteria are ${PREFIX[role]}1 onwards, in order`);
    if (role === 'user') continue;
    for (const heading of ['## Where to look', '## Criteria', '## Major on sight', '## What 90 looks like here']) assert.ok(text.includes(`\n${heading}\n`), `${role}.md needs "${heading}"`);
    // A rubric sends its reader only to evidence its role is handed.
    for (const kind of ['keyboard', 'states', 'motion', 'frames']) {
      if (!set.specialists[role].includes(kind)) assert.ok(!new RegExp(`\`${kind}/`).test(text), `${role}.md points at ${kind}/, which ${role} is not handed`);
    }
  }
  assert.strictEqual(versions.size, 1, `one version across the set, found ${[...versions].join(', ')}`);
  const shown = markdown(REVIEW);
  for (const word of FORBIDDEN) assert.ok(!new RegExp(`\\b${word}\\b`, 'i').test(shown), `reviewer material must not contain "${word}"`);
});

test('the example brief has the sections the format names, in its order, and its composition holds together with its notes', () => {
  const format = fs.readFileSync(path.join(SKILL, 'references', 'page-brief-format.md'), 'utf8');
  const named = [...format.matchAll(/^\| `## ([A-Za-z ]+)` \|/gm)].map((m) => m[1]);
  assert.deepStrictEqual(named, ['Offer', 'Audience', 'Arrival', 'Action', 'Proof', 'Objections', 'Brand', 'Layout', 'Composition', 'Search and sharing', 'Decisions']);
  const brief = fs.readFileSync(path.join(SKILL, 'assets', 'page-brief.example.md'), 'utf8');
  assert.deepStrictEqual([...brief.matchAll(/^## (.+)$/gm)].map((m) => m[1]), named);
  // The Composition section has an entry for each thing the format lists, and a decision that records it.
  const listed = format.match(/`## Composition` \|[^\n]*?: (Skeleton[^.]*)\./)[1].replace(/\([^)]*\)/g, '').split(',').map((x) => x.trim());
  assert.deepStrictEqual(listed, ['Skeleton', 'Length', 'First window', 'First proof', 'Benefits', 'How it works', 'Proof', 'Questions', 'Rhythm', 'Recurs']);
  const composition = brief.slice(brief.indexOf('\n## Composition\n'), brief.indexOf('\n## Search and sharing\n'));
  assert.deepStrictEqual([...composition.matchAll(/^- \*\*([^:*]+):\*\*/gm)].map((m) => m[1]), listed);
  assert.match(brief, /### D-003\n- \*\*Date:\*\* 2026-11-10\n- \*\*Decision:\*\* The page is drawn as the Composition section says/);

  // The ten decisions are the same ten in the page that explains them and in the example's table of alternatives,
  // and the skeleton comes first, with a length for each alternative.
  const page = fs.readFileSync(path.join(SKILL, 'references', 'composition.md'), 'utf8');
  const decisions = [...page.matchAll(/^\| \*\*(\d+)\. ([^*]+)\*\* \|/gm)].map((m) => `${m[1]}. ${m[2].split(':')[0]}`);
  assert.deepStrictEqual(decisions.map((d) => d.split('.')[0]), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  assert.strictEqual(decisions[0], '1. The skeleton');
  assert.ok(page.includes(`\nTen decisions.`) && page.includes('\n### Length\n'));
  const notes = fs.readFileSync(path.join(SKILL, 'assets', 'composition-references.example.md'), 'utf8');
  const rows = [...notes.matchAll(/^\| (\d+)\. ([^|]+?) \|(.+)\|$/gm)].map((m) => ({ n: m[1], name: m[2], cells: m[3].split('|').map((c) => c.trim()) }));
  assert.deepStrictEqual(rows.map((r) => r.n), decisions.map((d) => d.split('.')[0]));
  assert.strictEqual(rows[0].name, 'Skeleton');
  const lengths = rows[0].cells.map((c) => Number((c.match(/(\d+) words$/) || [])[1]));
  assert.ok(lengths.every((n) => n > 0) && new Set(lengths).size === 3, `each alternative has a length of its own, found ${lengths.join(', ')}`);
  assert.match(composition, new RegExp(`^- \\*\\*Length:\\*\\* ${lengths[0]} words`, 'm'), 'the brief records the length of the alternative that was chosen');
  // Alternatives are different when their skeletons differ, they differ in the first window or the picture, and in four rows in all.
  const differ = (a, b) => rows.filter((r) => r.cells[a] !== r.cells[b]).map((r) => Number(r.n));
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
    const d = differ(a, b);
    assert.ok(d.includes(1) && (d.includes(2) || d.includes(3)) && d.length >= 4, `alternatives ${a + 1} and ${b + 1} differ in rows ${d.join(', ')}`);
  }
  // The example does what the list of tells asks: nothing recurs as a number on each section or a label over each heading.
  assert.ok(!/number|label/i.test(rows[9].cells.join(' ')) && !/number|label/i.test(composition.match(/^- \*\*Recurs:\*\*[^\n]*(\n  [^\n]*)*/m)[0]));
  // Every note has the kind, the parts and a day or "from memory"; several kinds, one of them not a web page.
  const kinds = [...page.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1]);
  assert.deepStrictEqual(kinds, ['own-world', 'other-craft', 'other-page', 'owner', 'same-category']);
  const blocks = notes.split(/^## (?=R\d)/m).slice(1);
  assert.ok(blocks.length >= 4);
  const used = new Set();
  for (const b of blocks) {
    const kind = (b.match(/^- Kind: (.+)$/m) || [])[1];
    assert.ok(kinds.includes(kind), `a note of kind ${kind}`);
    used.add(kind);
    for (const part of ['Where', 'Seen', 'Does', 'Take', 'Leave']) assert.match(b, new RegExp(`^- ${part}: \\S`, 'm'), `${b.split('\n')[0]} needs "${part}"`);
    assert.match(b, /^- Seen: (looked at \d{4}-\d{2}-\d{2}|from memory)/m);
  }
  assert.ok(used.size >= 3 && (used.has('other-craft') || used.has('own-world')));
  // The alternatives: each starts from notes that exist, one is named as the common form, and the brief's choice is one of them.
  const starts = notes.match(/^\| Starts from \|(.+)\|$/m)[1].split('|').map((c) => c.trim().split(/,\s*/));
  assert.strictEqual(starts.length, 3);
  for (const refs of starts) for (const r of refs) assert.ok(blocks.some((b) => b.startsWith(`${r} `)), `${r} is a note`);
  assert.strictEqual(new Set(starts.map((r) => r[0])).size, 3, 'each alternative starts from a different note');
  assert.match(notes, /\*\*C\*\* is the common form/);
  assert.match(notes, /^A, by the owner, on 2026-11-10\. It is D-003 in the brief\.$/m);
  // Nothing in the notes or the composition names a fact or a picture the brief does not list.
  for (const fact of ['6 days', '4,200 accounts', 'reminders schedule', 'invoice editor']) assert.ok(brief.includes(fact.replace('4,200 accounts', '4,200 active accounts')), fact);
});

test('the list of tells names every tell in the catalogue, and nothing that is not in it', () => {
  const catalogue = JSON.parse(fs.readFileSync(path.join(SKILL, 'sources', 'impeccable', 'crates', 'live', 'assets', 'antipatterns.json'), 'utf8'));
  const ids = new Set(catalogue.map((e) => e.id));
  const tells = fs.readFileSync(path.join(SKILL, 'references', 'tells.md'), 'utf8');
  // An id is lower case, most with hyphens. Other things in backticks (paths, commands) have a dot, a slash, a space or a colon;
  // a single word in backticks is an id only when the catalogue has it.
  const named = [...tells.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)*)`/g)].map((m) => m[1]).filter((w) => w.includes('-') || ids.has(w));
  assert.ok(named.length >= 30);
  for (const id of named) assert.ok(ids.has(id), `${id} is named in tells.md and is not in the catalogue`);
  const missing = catalogue.filter((e) => e.category === 'slop' && !named.includes(e.id)).map((e) => e.id);
  assert.deepStrictEqual(missing, [], 'every entry marked slop has a place in references/tells.md');
  // Every file the ownership notes and the entry file send a reader to is there.
  const pointers = ['SKILL.md', 'references/ownership.md', 'references/tells.md', 'references/composition.md'].map((f) => fs.readFileSync(path.join(SKILL, f), 'utf8')).join('\n');
  for (const m of pointers.matchAll(/`(sources\/[^`\s]+)`/g)) assert.ok(fs.existsSync(path.join(SKILL, m[1])), `${m[1]} is pointed at and is not there`);
  for (const f of ['craft-floor.md', 'mode-persuade.md', 'new-work.md', 'distill.md']) assert.ok(fs.existsSync(path.join(SKILL, 'sources', 'impeccable', 'skill', 'reference', f)), f);
});

test('the vendored sources are as their lock records them, each with its licence', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(SKILL, 'sources', 'sources.lock.json'), 'utf8'));
  assert.deepStrictEqual(lock.sources.map((x) => [x.id, x.licence]), [['elaya', 'MIT'], ['impeccable', 'Apache-2.0']]);
  for (const source of lock.sources) assert.ok(fs.existsSync(path.join(SKILL, 'sources', source.id, source.licence_file)), `${source.id} has its licence`);
  const checked = spawnSync(process.execPath, [path.join(SKILL, 'scripts', 'update-sources.cjs'), '--check'], { encoding: 'utf8' });
  assert.strictEqual(checked.status, 0, checked.stdout + checked.stderr);
});

test('the example files open a run with the review skill, and each reviewer is handed what its role is meant to see', { skip }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-set-'));
  try {
    // Laid out as references/review-loop.md says: the set copied into the review home, the brief named from the config.
    const home = path.join(root, 'quality', 'landing', 'trial');
    fs.mkdirSync(home, { recursive: true });
    fs.cpSync(REVIEW, path.join(home, 'rubric-set'), { recursive: true });
    const config = JSON.parse(fs.readFileSync(path.join(SKILL, 'assets', 'review-config.example.json'), 'utf8'));
    assert.strictEqual(config.rubric_set, 'rubric-set');
    const brief = path.resolve(home, config.decisions);
    assert.ok(brief.startsWith(root), 'the example brief path stays inside the project');
    fs.mkdirSync(path.dirname(brief), { recursive: true });
    fs.copyFileSync(path.join(SKILL, 'assets', 'page-brief.example.md'), brief);
    const configFile = path.join(home, 'config.json');
    fs.writeFileSync(configFile, JSON.stringify(config));

    const opened = uxq(['new-run', '--config', configFile, '--commit', 'abc1234', '--date', '2026-01-15']);
    assert.strictEqual(opened.status, 0, opened.stderr);
    const created = JSON.parse(opened.stdout);
    const meta = JSON.parse(fs.readFileSync(path.join(created.run_dir, 'run.json'), 'utf8'));
    assert.deepStrictEqual([meta.rubric_set, meta.rubric_version], ['landing-page', '1.0.0']);

    // The capture plan names the same journeys and steps as the config, and pictures each arrival as the window alone.
    const plan = JSON.parse(fs.readFileSync(path.join(SKILL, 'assets', 'capture.example.json'), 'utf8'));
    assert.deepStrictEqual(Object.keys(plan.units), config.units.map((u) => u.id));
    for (const unit of config.units) {
      assert.deepStrictEqual(Object.keys(plan.units[unit.id].steps), unit.steps.map((s) => s.id));
      assert.deepStrictEqual(plan.units[unit.id].window_steps, ['01-arrive']);
      assert.deepStrictEqual(plan.units[unit.id].steps['02-read'][0], { scroll: 'through' });
    }

    // Stand-in evidence, then the reviewer folders.
    for (const [unit, files] of Object.entries(created.capture)) {
      const steps = new Set(files.map((f) => path.basename(f).split('.').slice(0, 2).join('.')));
      const all = [...files, ...[...steps].flatMap((s) => [`pages/${s}.txt`, `facts/${s}.json`, `keyboard/${s}.json`, `states/${s}.json`, `motion/${s}.json`, `frames/${s}.json`])];
      for (const rel of all) { const file = path.join(created.run_dir, 'evidence', unit, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, rel.endsWith('.json') ? '{}' : 'x'); }
    }
    const bundled = uxq(['bundle', '--config', configFile, '--run', created.run_dir, '--tmp', path.join(root, 'tmp')]);
    assert.strictEqual(bundled.status, 0, bundled.stderr);
    const bundles = JSON.parse(bundled.stdout);
    assert.strictEqual(bundles.length, config.units.length * 6 * config.judges, 'six roles, two reviewers each, per journey');
    const title = { conversion: 'conversion', copy: 'copy', brand: 'brand and visual design', accessibility: 'accessibility', responsive: 'responsive design' };
    for (const b of bundles) {
      const listing = fs.readdirSync(b.dir);
      const shown = markdown(b.dir);
      assert.ok(!/\{\{[A-Z_]+\}\}/.test(shown), `${b.role}: no unfilled placeholders`);
      assert.strictEqual(fs.readFileSync(path.join(b.dir, 'rubric.md'), 'utf8'), fs.readFileSync(path.join(REVIEW, 'roles', `${b.role}.md`), 'utf8'));
      if (b.role === 'user') {
        // The visitor knows what brought them and nothing else: not the brief, not the measurements.
        assert.ok(!listing.includes('decisions.md') && !listing.includes('facts') && !listing.includes('pages'), `the visitor is handed ${listing.join(', ')}`);
        assert.ok(!shown.includes('Ana Ruiz') && !shown.includes('partnership agreement'), 'nothing from the brief reaches the visitor');
        continue;
      }
      assert.ok(listing.includes('decisions.md'), `${b.role} is handed the page brief`);
      assert.ok(fs.readFileSync(path.join(b.dir, 'README.md'), 'utf8').includes(`specialist in ${title[b.role]}`), `${b.role} is told its specialism`);
      for (const kind of ['pages', 'facts', 'keyboard', 'states', 'motion', 'frames']) assert.strictEqual(listing.includes(kind), set.specialists[b.role].includes(kind), `${b.role} and ${kind}/`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
