'use strict';
// Checks that the reviewer set under review/ and the example files under assets/ hold together, by
// handing them to the review skill's own script:
//   node --test scripts/review-set.test.cjs
// Skipped when the ux-quality-score skill is not installed beside this one.
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
