'use strict';
// Tests of direction.cjs on the example study: node --test scripts/direction.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'direction.cjs');
const EXAMPLE = path.join(__dirname, '..', 'assets', 'example');
const { AXES, ROLES, PAIRS, contrast, oklch, hueGap, checkCandidate, parseReferences } = require('./direction.cjs');

function run(args, { allowFail = false } = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  if (r.status !== 0 && !allowFail) throw new Error(`direction ${args.join(' ')} failed (${r.status}):\n${r.stderr}\n${r.stdout}`);
  return r;
}
const json = (r) => JSON.parse(r.stdout);

// A copy of the example, to change freely.
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'direction-test-'));
  const dir = path.join(root, 'look');
  fs.cpSync(EXAMPLE, dir, { recursive: true });
  const study = path.join(dir, 'studies', '1');
  const file = (id) => path.join(study, 'candidates', `${id}.json`);
  const read = (id) => JSON.parse(fs.readFileSync(file(id), 'utf8'));
  const write = (id, c) => fs.writeFileSync(file(id), `${JSON.stringify(c, null, 2)}\n`);
  const change = (id, fn) => { const c = read(id); fn(c); write(id, c); };
  const state = (fn) => { const f = path.join(study, 'study.json'); const s = JSON.parse(fs.readFileSync(f, 'utf8')); if (fn) { fn(s); fs.writeFileSync(f, JSON.stringify(s, null, 2)); } return s; };
  return { root, dir, study, read, write, change, state };
}

// The look that is everywhere, as values: a plain sans, cool greys, an indigo accent, soft shadowed cards.
function makeCommon(c) {
  const inter = (extra) => ({ family: 'Inter', class: 'sans', width: 'normal', fallback: 'sans-serif', source: 'system', licence: 'SIL Open Font License 1.1', ...extra });
  c.type.families = { text: inter(), mono: c.type.families.mono };
  c.colour.default_mode = 'light';
  c.colour.modes = { light: {
    surface: '#F8FAFC', 'surface-raised': '#FFFFFF', 'text-default': '#0F172A', 'text-muted': '#475569', border: '#E2E8F0', 'border-control': '#64748B',
    accent: '#4F46E5', 'text-on-accent': '#FFFFFF', 'text-accent': '#4F46E5', 'focus-ring': '#4F46E5',
    danger: '#DC2626', 'text-on-danger': '#FFFFFF', 'text-danger': '#B91C1C', 'text-warning': '#92400E', 'text-success': '#166534', 'text-info': '#1D4ED8'
  } };
  c.shape.radius_control = 8; c.shape.radius_container = 12; c.shape.separation = 'shadow'; c.shape.shadow = '0 1px 3px rgba(0, 0, 0, 0.12)'; c.shape.action_edge = false;
  c.signature_css = '';
}

test('colour: contrast as the standard counts it, and hue as the eye does', () => {
  assert.strictEqual(Math.round(contrast('#000000', '#ffffff') * 100) / 100, 21);
  assert.strictEqual(Math.round(contrast('#fff', '#FFF') * 100) / 100, 1);
  assert.ok(Math.abs(contrast('#767676', '#ffffff') - 4.54) < 0.01, 'the grey that just passes on white');
  const hue = (hex) => Math.round(oklch(hex).h);
  assert.ok(Math.abs(hue('#ff0000') - 29) <= 1 && Math.abs(hue('#00ff00') - 142) <= 1 && Math.abs(hue('#0000ff') - 264) <= 1);
  assert.ok(oklch('#808080').C < 0.001, 'a grey has no colour');
  assert.strictEqual(hueGap(350, 10), 20);
  assert.strictEqual(hueGap(10, 190), 180);
});

test('the example study holds together: it passes, and every pair of its candidates differs', () => {
  const { dir } = setup();
  const r = run(['check', '--dir', dir]);
  const out = json(r);
  assert.strictEqual(out.ok, true);
  assert.deepStrictEqual(out.problems, []);
  assert.deepStrictEqual(out.warnings, [], 'the example should not teach a warning');
  assert.deepStrictEqual(out.compared_on, AXES);
  assert.strictEqual(out.must_differ_on, 4);
  assert.strictEqual(out.pairs.length, 3);
  for (const p of out.pairs) {
    assert.ok(p.ok && p.differ_on.length >= 4, `${p.a} and ${p.b}`);
    assert.ok(p.differ_on.includes('display_type') || p.differ_on.includes('text_type'));
  }
  assert.deepStrictEqual(Object.keys(out.candidates), ['asset-tag', 'timetable', 'field-book']);
  assert.strictEqual(out.candidates.timetable.axes.ground, 'dark');
  assert.strictEqual(out.candidates['field-book'].axes.neutrals, 'warm');
  assert.match(out.candidates['asset-tag'].axes.accent_hue, /^orange, \d+ degrees$/);
  assert.match(out.candidates['asset-tag'].closest_pair, /to 1 where 4\.5 is needed/);
  assert.match(out.then, /specimen/);
  // --full adds every pair that was measured, in every mode.
  const full = json(run(['check', '--dir', dir, '--full']));
  assert.strictEqual(full.candidates.timetable.contrast.length, PAIRS.length * 2);
  assert.ok(full.candidates.timetable.contrast.some((x) => x.mode === 'light' && x.foreground === 'accent' && x.waived), 'a fill below 3 to 1 is let through only where the action carries an edge');
});

test('the floor: no candidate may go below it, and the report says which value and by how much', () => {
  const { dir, change } = setup();
  change('timetable', (c) => {
    c.colour.modes.light['text-muted'] = '#9AA5B1';            // faint text, in the mode that is not the default
    c.type.product.body = 14;                                   // body text too small
    c.type.product.weight_text = 300;                           // and too light
    c.space.landing.control_height = 36;                        // a main action too small to press
    c.space.product.gutter = 18;                                // off the scale
    delete c.colour.modes.dark['focus-ring'];                   // a role missing
  });
  change('asset-tag', (c) => { c.colour.modes.light.danger = '#C2330C'; c.colour.modes.light['text-danger'] = '#B02E0A'; });   // the accent would also read as an error
  change('field-book', (c) => { c.shape.action_edge = false; c.colour.modes.light.accent = '#E8D9A0'; c.colour.modes.light['text-on-accent'] = '#23211C'; c.colour.modes.light['text-accent'] = '#1D4E89'; });
  const r = run(['check', '--dir', dir], { allowFail: true });
  assert.strictEqual(r.status, 2);
  const out = json(r);
  assert.strictEqual(out.ok, false);
  const has = (re) => assert.ok(out.problems.some((p) => re.test(p)), `no problem matching ${re} in:\n${out.problems.join('\n')}`);
  has(/^timetable: colour\.modes\.dark\.focus-ring is undefined: a colour written #rrggbb/);
  has(/^timetable: type\.product\.body is 14, and at least 16 is needed/);
  has(/^timetable: type\.product\.weight_text is 300, and at least 400 is needed: text below 18 px is not set lighter than regular/);
  has(/^timetable: space\.landing\.control_height is 36, and at least 44 is needed/);
  has(/^timetable: space\.product\.gutter is 18, which is not a step of the scale/);
  has(/^asset-tag: colour\.modes\.light: accent and danger are \d+ degrees of hue apart\. One colour has one meaning/);
  has(/^field-book: colour\.modes\.light: accent on surface measures 1\.\d+ to 1, and 3 to 1 is needed .*give the main action an edge: shape\.action_edge true/);
  // With the missing role put back, the faint text is measured and named.
  change('timetable', (c) => { c.colour.modes.dark['focus-ring'] = '#FFFFFF'; });
  const again = json(run(['check', '--dir', dir], { allowFail: true }));
  assert.ok(again.problems.some((p) => /^timetable: colour\.modes\.light: text-muted on surface measures 2\.\d+ to 1, and 4\.5 to 1 is needed \(captions, helper text, placeholders\)/.test(p)), again.problems.join('\n'));
  assert.match(again.then, /Do not change a value only to get past the check/);
});

test('candidates have to differ: the same look under another name is refused, with what is the same', () => {
  const { dir, read, write } = setup();
  const twin = read('asset-tag');
  const mine = read('field-book');
  write('field-book', { ...twin, id: 'field-book', name: 'Asset tag again', drawn_from: mine.drawn_from });
  const r = run(['check', '--dir', dir], { allowFail: true });
  assert.strictEqual(r.status, 2);
  const out = json(r);
  const pair = out.pairs.find((p) => p.a === 'asset-tag' && p.b === 'field-book');
  assert.strictEqual(pair.ok, false);
  assert.deepStrictEqual(pair.differ_on, []);
  const text = out.problems.join('\n');
  assert.match(text, /asset-tag and field-book differ on 0 of the 8 things compared \(none\), and 4 are needed/);
  assert.match(text, /asset-tag and field-book are set in the same kind of typeface \(sans, condensed for display, sans, normal for text\)/);
  assert.match(text, /asset-tag and field-book have the same colouring/);
  assert.match(text, /asset-tag and field-book both use the family "barlow" and "barlow condensed"|both use the family "barlow condensed" and "barlow"/);
  // A different accent of nearly the same hue does not count as a different colour.
  const near = read('asset-tag');
  write('field-book', { ...near, id: 'field-book', name: 'Nearly', drawn_from: mine.drawn_from, colour: { ...near.colour, modes: { light: { ...near.colour.modes.light, accent: '#B45309', 'text-accent': '#9A4708' } } } });
  const out2 = json(run(['check', '--dir', dir], { allowFail: true }));
  assert.ok(!out2.pairs.find((p) => p.a === 'asset-tag' && p.b === 'field-book').differ_on.includes('accent_hue'));
});

test('what a brand already settles is held, and is not compared', () => {
  const { dir, read, write, state } = setup();
  // The brand fixes both typefaces: every candidate uses them.
  const brand = read('asset-tag').type.families;
  for (const id of ['timetable', 'field-book']) { const c = read(id); c.type.families = brand; write(id, c); }
  let out = json(run(['check', '--dir', dir], { allowFail: true }));
  assert.ok(out.problems.some((p) => /both use the family/.test(p)));
  state((s) => { s.held = ['display_type', 'text_type']; });
  out = json(run(['check', '--dir', dir]));
  assert.strictEqual(out.ok, true);
  assert.deepStrictEqual(out.compared_on, AXES.filter((a) => a !== 'display_type' && a !== 'text_type'));
  assert.strictEqual(out.must_differ_on, 3);
  // Too much held leaves nothing to compare, and --held takes only the names of the things compared.
  const fresh = setup();
  fs.rmSync(path.join(fresh.dir, 'studies'), { recursive: true });
  let r = run(['open', '--dir', fresh.dir, '--candidates', 'a,b', '--held', AXES.slice(0, 6).join(',')], { allowFail: true });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /too little is left to compare.*adopt/);
  r = run(['open', '--dir', fresh.dir, '--candidates', 'a,b', '--held', 'typeface'], { allowFail: true });
  assert.match(r.stderr, /"typeface" is not one of display_type, text_type/);
  // Half of what is free, rounded down, and never fewer than two.
  for (const [n, need] of [[0, 4], [1, 3], [2, 3], [3, 2], [4, 2], [5, 2]]) {
    const one = setup();
    one.state((x) => { x.held = AXES.slice(8 - n); });
    assert.strictEqual(json(run(['check', '--dir', one.dir], { allowFail: true })).must_differ_on, need, `${n} held`);
  }
});

test('a candidate in a look that is everywhere is said to be; two of them are refused', () => {
  const { dir, change } = setup();
  change('asset-tag', makeCommon);
  // The other two keep their own looks; the dark one is given a slab for its headings, so that its type
  // still differs from the plain sans the first has now.
  change('timetable', (c) => { c.type.families.display = { ...c.type.families.display, family: 'Zilla Slab', class: 'slab' }; });
  let r = run(['check', '--dir', dir]);
  let out = json(r);
  assert.strictEqual(out.ok, true, out.problems.join('\n'));
  assert.deepStrictEqual(out.candidates['asset-tag'].common_looks.map((l) => l.look), ['cool-grey-and-blue']);
  assert.strictEqual(out.candidates['asset-tag'].common_looks[0].matched.length, 5);
  assert.ok(out.warnings.some((w) => /^asset-tag: It sits in a look a great many generated interfaces share \(cool-grey-and-blue\).*Keep it only as the familiar one of the set, and say so when it is shown/.test(w)), out.warnings.join('\n'));
  assert.strictEqual(out.common_looks.as_of, '2026-11');
  // A second one, in another of the looks: a display serif on cream with an orange accent.
  change('field-book', (c) => {
    c.type.families.display.family = 'Fraunces';
    c.colour.modes.light.accent = '#B4500F'; c.colour.modes.light['text-accent'] = '#9A4208';
    c.colour.modes.light.danger = '#A3195B'; c.colour.modes.light['text-danger'] = '#A3195B';   // kept clear of the orange
  });
  r = run(['check', '--dir', dir], { allowFail: true });
  out = json(r);
  assert.strictEqual(r.status, 2);
  assert.deepStrictEqual(out.candidates['field-book'].common_looks.map((l) => l.look), ['cream-and-serif']);
  assert.ok(out.problems.some((p) => /^asset-tag and field-book each sit in a look that is everywhere\. At most one candidate may/.test(p)), out.problems.join('\n'));
  // The list is the project's to change: a copy in the direction folder is the one used.
  fs.writeFileSync(path.join(dir, 'common-looks.json'), JSON.stringify({ as_of: '2030-01', looks: [] }));
  out = json(run(['check', '--dir', dir]));
  assert.strictEqual(out.common_looks.as_of, '2030-01');
  assert.deepStrictEqual(out.candidates['asset-tag'].common_looks, []);
});

test('what gives a generated page away is said at the check: its faces, its marks, its sizes and a look worn as a costume', () => {
  const { dir, change, state } = setup();
  state((x) => { x.candidates = ['asset-tag', 'field-book']; });
  // The newspaper, as the usual answer to a request for taste: a display serif, hairlines, square corners, labels in spaced capitals.
  change('field-book', (c) => {
    c.idea = 'The page as the front page of a broadsheet: a headline across the measure and columns divided by hairlines.';
    c.type.families.text = { ...c.type.families.text, family: 'Newsreader', class: 'serif' };
    c.type.labels = { case: 'upper', tracking_em: 0.12 };
    c.type.landing.display = 128; c.type.landing.display_tracking_em = -0.06;
    c.shape.radius_control = 0; c.shape.radius_container = 0; c.shape.separation = 'rules';
    c.signature = [
      { what: 'A kicker in spaced capitals before every headline', product: 'Every panel', landing: 'Every section' },
      { what: 'Columns divided by hairlines', product: 'Every table', landing: 'The benefits' }
    ];
    c.signature_css = '.l-benefits { counter-reset: part; }\n.l-nav { background-image: repeating-linear-gradient(90deg, var(--vd-border) 0 1px, transparent 1px 8px); }';
  });
  let out = json(run(['check', '--dir', dir]));
  assert.strictEqual(out.ok, true, out.problems.join('\n'));
  const mine = out.warnings.filter((w) => w.startsWith('field-book: ')).map((w) => w.slice('field-book: '.length));
  const has = (re) => assert.ok(mine.some((w) => re.test(w)), `${re}\n${mine.join('\n')}`);
  has(/^idea says what the product is dressed as \("page as the front page of a broadsheet"\)\. Say what the look does with type, colour and line/);
  has(/^type\.families\.text is Newsreader, one of the faces a great many generated pages are set in\. Keep it only if a reference in drawn_from is set in it/);
  has(/^type\.landing\.display is 128 px\. Above 96 px a window holds a few words and little else/);
  has(/^type\.landing\.display_tracking_em is -0\.06\. Below -0\.04 em letters lose their own shapes\./);
  has(/^Its signature \("A kicker in spaced capitals before every headline\. Every panel\. Every section"\) looks like a small label set above each heading: one of the marks a great many generated pages carry \(kicker-above-heading\)/);
  has(/^Its signature_css looks like sections that number themselves: .*\(numbered-section-labels\)/);
  has(/^Its signature_css looks like stripes drawn as a background: .*\(repeating-stripes-gradient\)/);
  has(/^It sits in a look a great many generated interfaces share \(broadsheet-editorial\): its typeface, its corners \(sharp\), how it separates things \(rules\), its display type \(serif\) and its labels \(capitals\)/);
  assert.deepStrictEqual(out.candidates['field-book'].common_looks.map((l) => l.look), ['broadsheet-editorial']);
  assert.ok(!out.warnings.some((w) => w.startsWith('asset-tag: ')), 'a candidate that does none of it hears none of it');

  // The loud poster, as the usual answer to a request for something bold: one flat strong colour, heavy condensed type, hard shadows.
  // A ground of one strong colour under heavy type is not that look by itself.
  change('asset-tag', (c) => { c.colour.modes.light.surface = '#1F3FD0'; c.type.landing.display_weight = 900; c.type.families.display.width = 'normal'; c.shape.radius_control = 12; });
  out = json(run(['check', '--dir', dir], { allowFail: true }));
  assert.deepStrictEqual(out.candidates['asset-tag'].common_looks, []);
  change('asset-tag', (c) => { c.type.families.display.width = 'condensed'; c.shape.radius_control = 0; c.shape.shadow = '6px 6px 0 #000000'; });
  out = json(run(['check', '--dir', dir], { allowFail: true }));
  assert.deepStrictEqual(out.candidates['asset-tag'].common_looks, [{ look: 'flat-colour-and-heavy-type', matched: ['its corners (sharp)', 'the colour of its ground (saturated)', 'its shadow (hard)', 'the width of its display type (condensed)', 'the weight of its display type (900)'] }]);
  assert.ok(out.problems.some((p) => /^asset-tag and field-book each sit in a look that is everywhere/.test(p)));

  // A family the brand already has is held, and is not remarked on. The list is the project's to change, and a mark that cannot be read is said.
  const { dir: other, change: change2, state: state2 } = setup();
  state2((x) => { x.held = ['text_type']; });
  for (const id of ['asset-tag', 'timetable', 'field-book']) change2(id, (c) => { c.type.families.text = { ...c.type.families.text, family: 'Inter', class: 'sans', width: 'normal' }; });
  out = json(run(['check', '--dir', other], { allowFail: true }));
  assert.ok(!out.warnings.some((w) => /one of the faces/.test(w)), out.warnings.join('\n'));
  fs.writeFileSync(path.join(other, 'common-looks.json'), JSON.stringify({ as_of: '2030-01', looks: [], faces: ['Barlow'], marks: [{ id: 'own-mark', what: 'a thing of our own', words: ['(unclosed'] }, { id: 'lozenge', what: 'a lozenge', words: ['\\blozenge\\b'] }] }));
  out = json(run(['check', '--dir', other], { allowFail: true }));
  assert.ok(out.problems.some((p) => /^common-looks\.json: the mark own-mark\.words: \(unclosed is not a regular expression\.$/.test(p)), out.problems.join('\n'));
  assert.ok(out.warnings.some((w) => /^asset-tag: type\.families\.display is Barlow Condensed, one of the faces/.test(w)));
  assert.ok(out.warnings.some((w) => /^timetable: Its signature \("A yellow lozenge marks where you are\..*looks like a lozenge: .*\(lozenge\)/.test(w)), out.warnings.join('\n'));
});

test('references: several kinds, each looked at, and no direction drawn from one thing or from the category alone', () => {
  const { dir, study, change } = setup();
  const refs = path.join(study, 'references.md');
  const text = fs.readFileSync(refs, 'utf8');
  assert.deepStrictEqual(parseReferences(text).map((r) => `${r.id}:${r.kind}`), ['R1:own-world', 'R2:own-world', 'R3:other-craft', 'R4:other-craft', 'R5:other-software', 'R6:same-category', 'R7:owner']);
  assert.match(parseReferences(text)[0].take, /^Condensed capitals for names and labels\. The code as the most prominent thing in a row\. Ruled boxes/, 'a field runs on over its wrapped lines');
  // Drawn from the category alone, from a note that is not there, and from one thing only.
  change('asset-tag', (c) => { c.drawn_from = [{ ref: 'R6', took: 'Its look' }, { ref: 'R9', took: 'Its look' }]; });
  change('timetable', (c) => { c.drawn_from = [{ ref: 'R3', took: 'Everything' }]; });
  change('field-book', (c) => { c.drawn_from = [{ ref: 'R3', took: 'Its tables' }, { ref: 'R7', took: 'Its colours' }]; });
  let out = json(run(['check', '--dir', dir], { allowFail: true }));
  let all = out.problems.join('\n');
  assert.match(all, /asset-tag: drawn_from\[1\]\.ref is R9, and references\.md has no note with that id/);
  assert.match(all, /timetable: drawn_from names at least two references: a direction taken from one thing is a copy of it/);
  change('asset-tag', (c) => { c.drawn_from = [{ ref: 'R6', took: 'Its look' }]; });
  fs.writeFileSync(refs, text.replace('## R7  The whiteboard at the North depot\n\n- Kind: owner', '## R7  Another maintenance product\n\n- Kind: same-category'));
  change('asset-tag', (c) => { c.drawn_from = [{ ref: 'R6', took: 'Its look' }, { ref: 'R7', took: 'Its look' }]; });
  out = json(run(['check', '--dir', dir], { allowFail: true }));
  assert.match(out.problems.join('\n'), /asset-tag: drawn_from holds only products of the same category/);
  // Too few notes, too few kinds, none from the product's own world, and mostly remembered.
  const few = parseReferences(text).filter((r) => ['R3', 'R4', 'R5'].includes(r.id));
  fs.writeFileSync(refs, `# References\n\n${few.map((r) => `## ${r.id}  ${r.title}\n\n- Kind: ${r.kind}\n- Where: ${r.where}\n- Seen: from memory\n- Does: ${r.does}\n- Take: ${r.take}\n- Leave: ${r.leave}\n`).join('\n')}`);
  out = json(run(['check', '--dir', dir], { allowFail: true }));
  all = out.problems.join('\n');
  assert.match(all, /references\.md holds 3 notes, and 3 candidates need at least 6/);
  assert.match(all, /references\.md has no note of the kind own-world/);
  assert.match(all, /references\.md holds 2 kinds of reference, and three are needed/);
  assert.ok(out.warnings.some((w) => /3 of 3 notes are of things that were not looked at \(3 from memory, 0 described by someone else\)/.test(w)));
  assert.deepStrictEqual(out.references.seen, { looked_at: 0, from_memory: 3, described: 0 });
  // How a thing was met is one of three, and a day it was looked at is a day that has been.
  const note = (id, seenLine) => `## ${id}  A thing\n\n- Kind: other-craft\n- Where: here\n- Seen: ${seenLine}\n- Does: something\n- Take: something\n- Leave: its mark\n`;
  fs.writeFileSync(refs, `# References\n\n${note('R1', 'yes')}\n${note('R2', 'looked at 2099-01-01')}\n${note('R3', 'described by the owner, who keeps one on the wall')}\n${note('R4', 'looked at 2026-11-20 in the depot')}\n`);
  out = json(run(['check', '--dir', dir], { allowFail: true }));
  all = out.problems.join('\n');
  assert.match(all, /R1 has Seen "yes": write "looked at" and the day \(looked at 2026-01-31\), "from memory", or "described by" and who described it/);
  assert.match(all, /R2 was looked at on 2099-01-01, which is not a day that has been/);
  assert.ok(!/R3 has Seen|R4 has Seen|R4 was looked at/.test(all));
  assert.deepStrictEqual(out.references.seen, { looked_at: 2, from_memory: 0, described: 1 });
  // A note with a kind that is not one, or with a part missing.
  fs.writeFileSync(refs, '# References\n\n## R1  A thing\n\n- Kind: inspiration\n- Where: here\n');
  all = json(run(['check', '--dir', dir], { allowFail: true })).problems.join('\n');
  assert.match(all, /R1 has Kind "inspiration": one of own-world, other-craft, other-software, same-category, owner/);
  assert.match(all, /R1 has no "Leave": what stays with it/);
});

test('two candidates may not start from the same reference, or share most of what they are drawn from', () => {
  const { dir, change } = setup();
  change('timetable', (c) => { c.drawn_from = [{ ref: 'R1', took: 'Its capitals' }, { ref: 'R3', took: 'Its figures' }]; });
  let all = json(run(['check', '--dir', dir], { allowFail: true })).problems.join('\n');
  assert.match(all, /asset-tag and timetable are both drawn first from R1\. Each candidate starts from a different reference/);
  change('timetable', (c) => { c.drawn_from = [{ ref: 'R3', took: 'Its figures' }, { ref: 'R1', took: 'Its capitals' }, { ref: 'R2', took: 'Its cells' }]; });
  all = json(run(['check', '--dir', dir], { allowFail: true })).problems.join('\n');
  assert.match(all, /asset-tag and timetable share more than one reference \(R1 and R2\)/);
  // Every candidate starting from the same kind of thing is one kind of answer three times.
  const other = setup();
  other.change('asset-tag', (c) => { c.drawn_from = [{ ref: 'R5', took: 'Its dark ground' }, { ref: 'R1', took: 'Its capitals' }]; });
  other.change('timetable', (c) => { c.drawn_from = [{ ref: 'R3', took: 'Its figures' }, { ref: 'R2', took: 'Its cells' }]; });
  const text = fs.readFileSync(path.join(other.study, 'references.md'), 'utf8').replace('## R5  The telemetry screens of a regional control room\n\n- Kind: other-software', '## R5  The telemetry screens of a regional control room\n\n- Kind: other-craft');
  fs.writeFileSync(path.join(other.study, 'references.md'), text);
  all = json(run(['check', '--dir', other.dir], { allowFail: true })).problems.join('\n');
  assert.match(all, /Every candidate is drawn first from a reference of the kind other-craft/);
});

test('a candidate\'s own CSS may restyle the parts, and may not hide them, move them or write words', () => {
  const base = JSON.parse(fs.readFileSync(path.join(EXAMPLE, 'studies', '1', 'candidates', 'asset-tag.json'), 'utf8'));
  const problems = (css) => checkCandidate({ ...base, signature_css: css }, { id: 'asset-tag', surfaces: ['product', 'landing'], refs: null }).problems;
  assert.deepStrictEqual(problems('.p-title { text-transform: uppercase; border-bottom: 2px solid var(--vd-border); }\n.card::before { content: ""; }'), []);
  assert.match(problems('.p-user { display: none; }')[0], /signature_css hides something/);
  assert.match(problems('.p-title::after { content: "Beta"; }')[0], /writes words onto the page/);
  assert.match(problems('.p-detail { order: -1; }')[0], /moves something out of its place/);
  assert.match(problems('.p-bar { position: fixed; }')[0], /moves something out of its place/);
  assert.match(problems('@import "x.css"; .l-hero { background: url(pic.png); }')[0], /brings in a file from outside/);
  assert.match(problems('</style><script>alert(1)</script>')[0], /leaves the style element/);
  for (const css of ['.p-user { opacity: 0; }', '.p-user { opacity: 0.0 }', '.help { font-size: 0; }', '.p-notice { max-height: 0px; }', '.p-user { clip-path: inset(100%); }', '.p-user { text-indent: -999em; }']) assert.match(problems(css)[0], /signature_css hides something/, css);
  assert.deepStrictEqual(problems('.p-user { opacity: 0.6; } .card { height: 100%; }'), []);
  assert.match(problems('.p-table td { font-size: 9px; } .help { font-size: 11.5px; } .p-h { font-size: 12px; }')[0], /signature_css sets text at 9 px and 11\.5 px\. Nothing a person needs to read is below 12 px/);
  // Colours of its own are let through and said: nothing measures the pairs they make.
  const warned = (css) => checkCandidate({ ...base, signature_css: css }, { id: 'asset-tag', surfaces: ['product', 'landing'], refs: null }).warnings;
  assert.match(warned('.status { background: currentColor; } .status span { color: #FFF; }')[0], /signature_css brings colours of its own \(background: currentcolor, #fff\)\. They do not follow the modes, and the pairs they make are not measured here.*shape\.status "patch"/);
  assert.deepStrictEqual(warned('.p-table tbody tr:nth-child(even) { background: color-mix(in srgb, var(--vd-text-default) 7%, transparent); }'), []);
});

test('a status may be drawn as a filled patch, with roles of its own that are measured like the rest', () => {
  const { dir, study, change } = setup();
  change('timetable', (c) => { c.shape.status = 'blob'; });
  let all = json(run(['check', '--dir', dir], { allowFail: true })).problems.join('\n');
  assert.match(all, /timetable: shape\.status is how a status is drawn: "mark" for a coloured icon and word, or "patch" for the word on a filled patch/);
  change('timetable', (c) => { c.shape.status = 'patch'; });
  all = json(run(['check', '--dir', dir], { allowFail: true })).problems.join('\n');
  assert.match(all, /timetable: colour\.modes\.dark\.success is undefined: a colour written #rrggbb, needed because shape\.status is "patch"/);
  assert.match(all, /timetable: colour\.modes\.light\.text-on-info is undefined/);
  const fills = { dark: { success: '#86EFAC', 'text-on-success': '#052E16', warning: '#FACC15', 'text-on-warning': '#FFFFFF', info: '#93C5FD', 'text-on-info': '#0B1F3A' }, light: { success: '#1B6B3A', 'text-on-success': '#FFFFFF', warning: '#FACC15', 'text-on-warning': '#1A1A0A', info: '#1F5FA8', 'text-on-info': '#FFFFFF' } };
  change('timetable', (c) => { for (const m of ['dark', 'light']) Object.assign(c.colour.modes[m], fills[m]); });
  let out = json(run(['check', '--dir', dir], { allowFail: true }));
  assert.deepStrictEqual(out.problems, ['timetable: colour.modes.dark: text-on-warning on warning measures 1.53 to 1, and 4.5 to 1 is needed (the word on a patch for a warning).']);
  change('timetable', (c) => { c.colour.modes.dark['text-on-warning'] = '#1A1A0A'; });
  out = json(run(['check', '--dir', dir, '--full']));
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.candidates.timetable.contrast.length, (PAIRS.length + 3) * 2);
  // The roles of a patch given by a look that does not use them are said, not refused.
  change('asset-tag', (c) => { c.colour.modes.light.success = '#1B6B3A'; });
  assert.ok(json(run(['check', '--dir', dir])).warnings.some((w) => /^asset-tag: colour\.modes\.light gives success, which are used only where shape\.status is "patch"/.test(w)));
  change('asset-tag', (c) => { delete c.colour.modes.light.success; });

  run(['specimen', '--dir', dir]);
  const page = fs.readFileSync(path.join(study, 'specimens', 'timetable', 'index.html'), 'utf8');
  assert.ok(page.includes('data-status="patch"') && page.includes('--vd-warning: #facc15;') && page.includes('--vd-text-on-warning: #1a1a0a;'));
  assert.ok(fs.readFileSync(path.join(study, 'specimens', 'asset-tag', 'index.html'), 'utf8').includes('data-status="mark"'));
  run(['pick', '--dir', dir, '--candidate', 'timetable', '--by', 'R. Vance', '--why', 'The patches read from across the yard']);
  const style = run(['render', '--dir', dir, '--style']).stdout;
  assert.match(style, /A status is drawn as a filled patch with its word on it and an icon beside the word \(`--vd-success`, `--vd-warning`, `--vd-danger`, `--vd-info`, each with its `--vd-text-on-\.\.\.`\)\./);
  assert.match(style, /\| `--vd-text-on-warning` \| `--vd-warning` \| The word on a patch for a warning \| 4\.5:1 \|/);
  const record = fs.readFileSync(path.join(dir, 'visual-direction.md'), 'utf8');
  assert.match(record, /\| `--vd-text-on-success` \| #052e16 \| #ffffff \|/);
  assert.match(record, /\| `text-on-info` \| `info` \| The word on a patch for a note \| 4\.5:1 \| \d+\.\d\d \| \d+\.\d\d \|/);
});

test('the specimen is drawn without what the product has no words for, and nothing is made up to fill it', () => {
  const { dir, study } = setup();
  const file = path.join(study, 'words.json');
  const full = JSON.parse(fs.readFileSync(file, 'utf8'));
  const w = JSON.parse(JSON.stringify(full));
  delete w.product.states_title; delete w.product.detail.field_help; delete w.product.detail.error_value;
  for (const k of ['nav', 'quiet_link', 'picture_caption', 'band', 'band_source', 'closing_headline', 'footer']) delete w.landing[k];
  fs.writeFileSync(file, JSON.stringify(w));
  assert.strictEqual(json(run(['check', '--dir', dir])).ok, true);
  run(['specimen', '--dir', dir]);
  const page = fs.readFileSync(path.join(study, 'specimens', 'asset-tag', 'index.html'), 'utf8');
  const body = shared(page);
  for (const gone of ['What each state means', 'class="help"', '<nav aria-label="Page">', 'class="l-quiet"', '<figcaption>', 'l-band-say', 'class="l-close"', '<footer']) assert.ok(!body.includes(gone), gone);
  assert.ok(body.includes('aria-invalid="true"') && body.includes('value="" aria-invalid'), 'the field in error is still drawn, empty');
  // With no words for the band, the last call to act is the band: the band's colour is still shown.
  assert.match(body, /<div class="l-band"><div class="l-band-in l-band-close"><h2 class="l-h2">Every hydrant checked, and the sheet to prove it<\/h2><a class="btn btn-primary btn-l" href="#">Book a walk-through<\/a><\/div><\/div>/);
  assert.strictEqual(body, shared(fs.readFileSync(path.join(study, 'specimens', 'field-book', 'index.html'), 'utf8')));

  // Present and empty is a mistake; so is a filler where the product has nothing.
  const bad = JSON.parse(JSON.stringify(full));
  bad.product.states_title = ''; bad.landing.nav = []; bad.landing.footer = ' '; delete bad.landing.band; delete bad.landing.proof; bad.product.detail.field_label = '';
  fs.writeFileSync(file, JSON.stringify(bad));
  const all = json(run(['check', '--dir', dir], { allowFail: true })).problems.join('\n');
  assert.match(all, /words\.json: product\.states_title is empty: write the product's own words, or take the line out and the specimen is drawn without it/);
  assert.match(all, /words\.json: landing\.nav is the links at the top of the page: write the page's own, or take the line out/);
  assert.match(all, /words\.json: landing\.footer is empty: write the product's own words, or take the line out/);
  assert.match(all, /words\.json: landing\.band_source says whose words landing\.band holds, and there is no landing\.band/);
  assert.match(all, /words\.json: landing\.proof is empty\./);
  assert.match(all, /words\.json: product\.detail\.field_label is empty\./);
});

test('a typeface from the skill\'s own example, and one that is not in hand, are said when the candidate is checked', () => {
  const { dir, state, change } = setup();
  state((x) => { x.candidates = ['asset-tag', 'timetable']; });
  change('timetable', (c) => {
    c.type.families.text = { ...c.type.families.text, family: 'Public Sans' };                      // the example's field-book is set in it
    c.type.families.display = { ...c.type.families.display, family: 'Akzidenz-Grotesk', licence: 'Commercial; to be bought' };
  });
  const out = json(run(['check', '--dir', dir]));
  assert.strictEqual(out.ok, true, out.problems.join('\n'));
  assert.deepStrictEqual(out.warnings, [
    'timetable: type.families.display.licence says the family is not in hand yet ("Commercial; to be bought"). Say so, and what it costs, when this candidate is shown.',
    'timetable: type.families.text is Public Sans, which this skill\'s own example uses. Make sure it came from your references and not from there.'
  ]);
});

test('a study is opened first and its candidates named later, once it is known what each is drawn from', () => {
  const { root } = setup();
  const dir = path.join(root, 'new');
  let r = run(['open'], { allowFail: true });
  assert.match(r.stderr, /Say where the direction is kept: --dir/);

  let out = json(run(['open', '--dir', dir, '--date', '2026-11-21']));
  assert.strictEqual(out.study, 1);
  assert.deepStrictEqual(out.candidates, []);
  assert.deepStrictEqual(out.files, ['brief.md', 'references.md', 'words.json']);
  assert.match(out.then, /The candidates are named after that, when you know what each is drawn from and what the brief holds: candidates --dir .* --names <name,name,name> \[--held <thing,thing>\]/);
  const study = path.join(dir, 'studies', '1');
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(study, 'words.json'), 'utf8')).example, true);
  assert.match(fs.readFileSync(path.join(study, 'brief.md'), 'utf8'), /what\s+the setting fixes, whether or not the owner said so/);
  assert.match(fs.readFileSync(path.join(study, 'references.md'), 'utf8'), /or: described by the owner/);

  // Before any candidate is named, the check speaks of the brief, the references and the words.
  r = run(['check', '--dir', dir], { allowFail: true });
  assert.strictEqual(r.status, 2);
  let all = json(r).problems.join('\n');
  assert.match(all, /brief\.md: "## Product" is empty: what the product is/);
  assert.match(all, /brief\.md: "## Feel" is empty/);
  assert.match(all, /references\.md holds 0 notes, and three candidates would need at least 6/);
  assert.match(all, /words\.json: these are the words of the example\. Write the product's own/);
  assert.match(all, /No candidates are named yet\. When you know what each is drawn from: candidates --names <name,name,name>/);
  assert.match(json(run(['status', '--dir', dir])).then, /Study 1 is open and its candidates are not named yet/);
  r = run(['specimen', '--dir', dir, '--draft'], { allowFail: true });
  assert.match(r.stderr, /No candidate is complete enough to draw/);

  // Naming them.
  r = run(['candidates', '--dir', dir, '--names', 'only-one'], { allowFail: true });
  assert.match(r.stderr, /A study compares two to four candidates: --names <name,name,name>/);
  r = run(['candidates', '--dir', dir, '--names', 'a,b,c,d,e'], { allowFail: true });
  assert.match(r.stderr, /two to four candidates/);
  r = run(['candidates', '--dir', dir, '--names', 'Quiet One,loud'], { allowFail: true });
  assert.match(r.stderr, /"Quiet One" is not a name for a candidate/);
  out = json(run(['candidates', '--dir', dir, '--names', 'quiet,own-world,far']));
  assert.deepStrictEqual(out.candidates, ['quiet', 'own-world', 'far']);
  assert.deepStrictEqual(out.new_files, ['candidates/quiet.json', 'candidates/own-world.json', 'candidates/far.json']);
  assert.match(out.then, /its own marks first and its values after.*3 candidates need at least 6 notes/);
  const blank = JSON.parse(fs.readFileSync(path.join(study, 'candidates', 'quiet.json'), 'utf8'));
  assert.deepStrictEqual([blank.id, blank.gives_up, blank.shape.status], ['quiet', '', 'mark']);
  assert.deepStrictEqual(Object.keys(blank.colour.modes.light), ROLES);
  assert.ok(blank.type.product && blank.type.landing && blank.space.product && blank.space.landing);
  all = json(run(['check', '--dir', dir], { allowFail: true })).problems.join('\n');
  assert.ok(!/No candidates are named yet/.test(all));
  assert.match(all, /references\.md holds 0 notes, and 3 candidates need at least 6/);
  assert.match(all, /quiet: name is empty: the name the owner will know it by/);
  assert.match(all, /quiet: gives_up is empty: what the product loses by taking this look/);
  assert.match(all, /quiet: type\.families\.text\.family is empty: name the family/);
  assert.match(all, /quiet: type\.families\.display\.family is empty: name the family, or take type\.families\.display out if the direction has none/);
  assert.match(all, /quiet: colour\.modes\.light\.surface is "": a colour written #rrggbb/);
  assert.match(all, /quiet: space\.scale is the spacing steps in px, rising, at least seven of them/);

  // Named again: one dropped is set aside and not deleted, one added gets its file, and what is held is said.
  fs.writeFileSync(path.join(study, 'candidates', 'far.json'), JSON.stringify({ ...blank, id: 'far', name: 'Far' }));
  out = json(run(['candidates', '--dir', dir, '--names', 'quiet,own-world,further', '--held', 'density,ground']));
  assert.deepStrictEqual([out.candidates, out.held], [['quiet', 'own-world', 'further'], ['density', 'ground']]);
  assert.deepStrictEqual([out.new_files, out.set_aside], [['candidates/further.json'], ['candidates/set-aside/far.json']]);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(study, 'candidates', 'set-aside', 'far.json'), 'utf8')).name, 'Far');
  const checked = json(run(['check', '--dir', dir], { allowFail: true }));
  assert.deepStrictEqual([checked.held, checked.compared_on.length, checked.must_differ_on], [['density', 'ground'], 6, 3]);
  r = run(['candidates', '--dir', dir, '--names', 'quiet,loud', '--held', 'typeface'], { allowFail: true });
  assert.match(r.stderr, /"typeface" is not one of display_type, text_type/);

  // One study at a time, and one that ends with no choice says why.
  r = run(['open', '--dir', dir], { allowFail: true });
  assert.match(r.stderr, /Study 1 is still open\. Finish it with pick, or end it with close/);
  r = run(['close', '--dir', dir], { allowFail: true });
  assert.match(r.stderr, /--why is needed: why none of them was chosen/);
  assert.strictEqual(json(run(['close', '--dir', dir, '--why', 'The owner wants to wait for the new name.'])).state, 'closed');
  r = run(['candidates', '--dir', dir, '--names', 'x,y'], { allowFail: true });
  assert.match(r.stderr, /Study 1 is closed: its candidates are what they were/);
  // Named in one go, for one surface.
  out = json(run(['open', '--dir', dir, '--candidates', 'x,y', '--surfaces', 'landing']));
  assert.deepStrictEqual([out.study, out.candidates, out.surfaces], [2, ['x', 'y'], ['landing']]);
  const landingOnly = JSON.parse(fs.readFileSync(path.join(dir, 'studies', '2', 'candidates', 'x.json'), 'utf8'));
  assert.ok(landingOnly.type.landing && !landingOnly.type.product && !landingOnly.space.product);
  const st = json(run(['status', '--dir', dir]));
  assert.deepStrictEqual(st.studies.map((x) => x.state), ['closed', 'open']);
  assert.strictEqual(st.direction, null);
  assert.match(st.then, /Study 2 is open: check, then specimen/);
});

// The part of a specimen that every candidate shares: its product and landing sections.
const shared = (html) => html.slice(html.indexOf('<section class="vd-part" data-part="product"'), html.indexOf('<section class="vd-part" data-part="values"'));

test('specimens: one skeleton and the product\'s own words for every candidate, and only the values differ', () => {
  const { dir, study, change, state } = setup();
  const words = path.join(study, 'words.json');
  const w = JSON.parse(fs.readFileSync(words, 'utf8'));
  w.product.notice = 'Saved <b>now</b> & "kept"';
  fs.writeFileSync(words, JSON.stringify(w, null, 2));
  const out = json(run(['specimen', '--dir', dir, '--date', '2026-11-21']));
  assert.strictEqual(out.draft, false);
  assert.strictEqual(out.specimens.length, 3);
  const pages = Object.fromEntries(['asset-tag', 'timetable', 'field-book'].map((id) => [id, fs.readFileSync(path.join(study, 'specimens', id, 'index.html'), 'utf8')]));
  assert.ok(shared(pages['asset-tag']).length > 4000);
  assert.strictEqual(shared(pages['asset-tag']), shared(pages.timetable));
  assert.strictEqual(shared(pages['asset-tag']), shared(pages['field-book']));
  for (const html of Object.values(pages)) {
    assert.ok(html.includes('Rounds this week') && html.includes('Every hydrant checked, and the sheet to prove it'));
    assert.ok(html.includes('Saved &lt;b&gt;now&lt;/b&gt; &amp; &quot;kept&quot;') && !html.includes('Saved <b>now</b>'), 'words are written as words, never as markup');
    assert.ok(html.includes('{{proof: a figure from a named utility, with its date}}'), 'a fact that does not exist stays a visible marker');
    assert.ok(html.includes('@layer skeleton {'), 'so that a candidate\'s own CSS wins over the skeleton');
    assert.ok(html.includes('class="vd-fontwarn" hidden'));
  }
  assert.ok(pages['asset-tag'].includes('--vd-accent: #c2410c;') && pages.timetable.includes('--vd-accent: #facc15;') && pages['field-book'].includes('--vd-accent: #1d4e89;'));
  assert.ok(pages['asset-tag'].includes('data-separation="rules"') && pages.timetable.includes('data-separation="fill"') && pages['field-book'].includes('data-separation="space"'));
  assert.ok(pages.timetable.includes('<html lang="en" data-mode="dark"') && pages.timetable.includes('[data-mode="light"] {') && pages.timetable.includes('data-action-edge="true"'));
  assert.ok(pages.timetable.includes('--vd-current-mark: var(--vd-text-default);') && pages['asset-tag'].includes('--vd-current-mark: var(--vd-accent);'));
  assert.ok(pages['asset-tag'].includes('--vd-l-band: var(--vd-text-default);') && pages.timetable.includes('--vd-l-band: var(--vd-accent);') && pages['field-book'].includes('--vd-l-band: var(--vd-surface-raised);'));
  assert.ok(pages['asset-tag'].includes('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&amp;display=swap'));
  assert.ok(pages['asset-tag'].includes('.p-table td.code { font-weight: 600; }'), 'its own marks come after the skeleton');
  assert.ok(pages.timetable.includes('Contrast (dark, the default)') && pages.timetable.includes('Contrast (light)'));
  assert.ok(pages['asset-tag'].includes('Stamped metal asset tags on valves and hydrants'), 'what it was drawn from is named, not numbered');
  assert.ok(pages['asset-tag'].includes('<span class="vd-marker">{{proof: a figure from a named utility, with its date}}</span>'), 'a marker is drawn as a marker');
  assert.ok(pages['asset-tag'].includes('<td class="c-lead code" data-label="Asset">HY-0412</td>') && pages['asset-tag'].includes('<td class="c-more num" data-label="Pressure, bar">4.2</td>'), 'each cell says which part of the row it is, for the phone');
  assert.ok(pages['asset-tag'].includes('<th scope="col">Asset</th>'), 'a heading is not set in the face kept for codes');
  assert.ok(pages['asset-tag'].includes('<b>What it gives up.</b> Warmth.') && pages['asset-tag'].includes('data-status="mark"'));
  assert.ok(pages['field-book'].includes('--vd-font-mono: "Courier Prime", Courier New, monospace;'));
  const sheet = fs.readFileSync(out.sheet, 'utf8');
  assert.strictEqual((sheet.match(/<iframe /g) || []).length, 3);
  assert.ok(sheet.includes('src="specimens/timetable/index.html"') && sheet.includes('data-modes="dark light" data-default="dark"'));
  assert.ok(sheet.includes('Only the look differs') && sheet.includes('data-set="mode" data-value=""'));
  assert.ok(sheet.includes('<span>Gives up: Room. Rows this tall show a supervisor fewer assets at once') && sheet.includes('sheet.html#part=landing&mode=dark&width=390'));
  const st = state();
  assert.strictEqual(st.specimens.made, '2026-11-21');
  assert.strictEqual(st.specimens.skeleton, out.skeleton);
  assert.deepStrictEqual(Object.keys(st.specimens.candidates), ['asset-tag', 'timetable', 'field-book']);

  // One file to send: the specimens inside the sheet.
  const embedded = fs.readFileSync(json(run(['specimen', '--dir', dir, '--embed'])).sheet, 'utf8');
  assert.ok(embedded.includes('srcdoc="&lt;!doctype html&gt;') && !embedded.includes('src="specimens/') && !embedded.includes('Open it alone'));

  // Unfinished candidates can be looked at as a draft, which is never what the owner is shown.
  change('timetable', (c) => { c.type.product.weight_text = 300; });
  let r = run(['specimen', '--dir', dir], { allowFail: true });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /The check has not passed \(1 problem; run check to read them\).*specimen --draft/);
  const draft = json(run(['specimen', '--dir', dir, '--draft']));
  assert.strictEqual(draft.draft, true);
  assert.deepStrictEqual(draft.not_drawn, []);
  assert.match(fs.readFileSync(draft.sheet, 'utf8'), /Draft: the check has not passed, so this is not ready to show to the owner/);
  assert.match(draft.then, /draft for your own eyes/);
  // A candidate with a whole part missing is left out of a draft, and the others are still drawn.
  change('field-book', (c) => { delete c.type.product; });
  const partial = json(run(['specimen', '--dir', dir, '--draft']));
  assert.deepStrictEqual(partial.not_drawn, ['field-book']);
  assert.strictEqual(partial.specimens.length, 2);
});

test('the choice is the owner\'s: it is recorded once, of what they were shown, and the record follows from it', () => {
  const { dir, study, change, state } = setup();
  let r = run(['pick', '--dir', dir, '--candidate', 'timetable', '--by', 'R. Vance', '--why', 'It is the one the crews could read in the van.'], { allowFail: true });
  assert.match(r.stderr, /No specimens have been made, so the owner has been shown nothing/);
  run(['specimen', '--dir', dir, '--date', '2026-11-21']);
  r = run(['pick', '--dir', dir, '--candidate', 'timetable'], { allowFail: true });
  assert.match(r.stderr, /--by is needed: the name of the person who chose\. The choice is the owner's, never yours/);
  r = run(['pick', '--dir', dir, '--candidate', 'timetable', '--by', 'R. Vance'], { allowFail: true });
  assert.match(r.stderr, /--why is needed: their reason, in their words/);
  r = run(['pick', '--dir', dir, '--candidate', 'bold', '--by', 'R. Vance', '--why', 'x'], { allowFail: true });
  assert.match(r.stderr, /"bold" is not a candidate of study 1\. They are: asset-tag, timetable, field-book/);
  // A candidate changed after it was shown is not what the owner chose.
  change('timetable', (c) => { c.shape.radius_control = 16; });
  r = run(['pick', '--dir', dir, '--candidate', 'timetable', '--by', 'R. Vance', '--why', 'x'], { allowFail: true });
  assert.match(r.stderr, /timetable changed after the specimens were made, so the owner was shown something else/);
  run(['specimen', '--dir', dir, '--date', '2026-11-22']);

  const out = json(run(['pick', '--dir', dir, '--candidate', 'timetable', '--by', 'R. Vance', '--why', 'It is the one the crews could read in the van', '--date', '2026-11-23']));
  assert.strictEqual(out.picked, 'timetable');
  assert.deepStrictEqual(out.files.map((f) => path.basename(f)), ['direction.json', 'visual-direction.md', 'direction.css']);
  assert.match(out.then, /render --dir .* --style prints the Style section.*render --dir .* --brand prints the Brand section/);
  assert.strictEqual(state().state, 'picked');
  const d = JSON.parse(fs.readFileSync(path.join(dir, 'direction.json'), 'utf8'));
  assert.strictEqual(d.product, 'Example Rounds');
  assert.deepStrictEqual(d.chosen, { candidate: 'timetable', by: 'R. Vance', why: 'It is the one the crews could read in the van', date: '2026-11-23', study: 1, from: ['asset-tag', 'timetable', 'field-book'] });
  assert.strictEqual(d.direction.shape.radius_control, 16);
  assert.deepStrictEqual(d.sources.map((s) => `${s.id}:${s.kind}`), ['R3:other-craft', 'R5:other-software']);
  assert.strictEqual(d.decisions.length, 1);
  assert.deepStrictEqual([d.decisions[0].id, d.decisions[0].supersedes, d.decisions[0].by], ['D-001', 'nothing', 'R. Vance']);

  const record = fs.readFileSync(path.join(dir, 'visual-direction.md'), 'utf8');
  assert.match(record, /^# Visual direction: Example Rounds\n\n\*\*Timetable\.\*\* Strong figures on a dark ground, tinted rows in place of lines/);
  assert.match(record, /\n\nWhat it gives up: The look of paper that a supervisor trusts\. A dark screen is also harder to read in full sun at the kerb, which is why it has a light mode\.\n\n/);
  assert.match(record, /Chosen by R\. Vance on 2026-11-23, from 3 candidates \(asset-tag, timetable, field-book; study 1\): It is the one the crews could read in the van\./);
  for (const heading of ['## Its own marks', '## It never', '## Type', '## Colour', '## Shape and space', '## Two registers', '## Imagery', '## Voice', '## Where it came from', '## Decisions']) assert.ok(record.includes(`\n${heading}\n`), heading);
  assert.match(record, /\| `--vd-accent` \| #facc15 \| #facc15 \|/);
  assert.match(record, /\| Role \| dark \(default\) \| light \|/);
  assert.match(record, /\| `accent` \| `surface` \| The fill of the main action against the page \| 3:1 \| 11\.32 \| 1\.41 \(the action carries an edge\) \|/);
  assert.match(record, /\| Largest text \| 26 px screen title \| 64 px headline, weight 800 \|/);
  assert.match(record, /- \*\*A printed regional bus timetable\*\* \(other-craft; The county's printed timetable booklet, current edition\)\. Taken: Open figures.*Left: The operator's livery colours and its route symbols\./);
  assert.match(record, /### D-001  The look of Example Rounds is the direction "Timetable"\n\n- Date: 2026-11-23\n- By: R\. Vance\n- Decision: Strong figures on a dark ground.*as a pocket timetable uses them to be read at a glance in a van/);
  assert.ok(!/undefined|\[object|NaN|false px/.test(record), 'nothing unwritten leaks into the record');

  const css = fs.readFileSync(path.join(dir, 'direction.css'), 'utf8');
  assert.match(css, /^\/\* Example Rounds: the direction "Timetable", chosen by R\. Vance on 2026-11-23\./);
  assert.ok(css.includes('@import url("https://fonts.googleapis.com/css2?family=Overpass:wght@600;700;800&display=swap");'));
  assert.ok(css.includes(':root, [data-mode="dark"] {') && css.includes('[data-mode="light"] {') && css.includes('--vd-radius-control: 16px;') && css.includes('--vd-space-10: 112px;'));

  // Chosen once: another choice is another study, and the specimens of this one are kept as shown.
  r = run(['pick', '--dir', dir, '--candidate', 'asset-tag', '--by', 'R. Vance', '--why', 'x'], { allowFail: true });
  assert.match(r.stderr, /Study 1 is picked: timetable was chosen by R\. Vance\. Another choice is another study/);
  r = run(['specimen', '--dir', dir], { allowFail: true });
  assert.match(r.stderr, /Study 1 is picked: its specimens are what the owner was shown/);
  const st = json(run(['status', '--dir', dir]));
  assert.deepStrictEqual([st.direction.name, st.direction.by, st.direction.decisions], ['Timetable', 'R. Vance', 1]);

  // A later study replaces the look, and says which decision it replaces.
  run(['open', '--dir', dir, '--candidates', 'asset-tag,field-book', '--date', '2026-12-01']);
  const second = path.join(dir, 'studies', '2');
  for (const f of ['brief.md', 'references.md', 'words.json']) fs.copyFileSync(path.join(study, f), path.join(second, f));
  for (const id of ['asset-tag', 'field-book']) fs.copyFileSync(path.join(study, 'candidates', `${id}.json`), path.join(second, 'candidates', `${id}.json`));
  run(['specimen', '--dir', dir]);
  run(['pick', '--dir', dir, '--candidate', 'field-book', '--by', 'R. Vance', '--why', 'The dark screen could not be read in the yard', '--date', '2026-12-02']);
  const d2 = JSON.parse(fs.readFileSync(path.join(dir, 'direction.json'), 'utf8'));
  assert.deepStrictEqual(d2.decisions.map((x) => [x.id, x.supersedes]), [['D-001', 'nothing'], ['D-002', 'D-001']]);
  assert.match(fs.readFileSync(path.join(dir, 'visual-direction.md'), 'utf8'), /### D-002  The look of Example Rounds is the direction "Field book"[\s\S]*- Supersedes: D-001\./);
});

test('the look reaches the product and the page in their own forms, and compare says when they have drifted', () => {
  const { dir, root } = setup();
  run(['specimen', '--dir', dir]);
  run(['pick', '--dir', dir, '--candidate', 'asset-tag', '--by', 'R. Vance', '--why', 'It looks like our own drawings', '--date', '2026-11-23']);

  const style = run(['render', '--dir', dir, '--style']).stdout;
  const order = ['## Style', '### Type', '### Colour', 'Colour contract (light):', '### Spacing', '### Shape', '### Density', '### Motion', '### Voice', '## Decisions'];
  const at = order.map((h) => style.indexOf(`\n${h}\n`.replace(/^\n## Style/, '## Style')));
  assert.ok(at.every((p, i) => p >= 0 && (i === 0 || p > at[i - 1])), `the sections of a decisions file, in its order: ${at}`);
  assert.match(style, /The look is the direction "Asset tag", chosen by R\. Vance on 2026-11-23\. It is kept in `visual-direction\.md`/);
  assert.match(style, /- Barlow for the interface and running text \(`--vd-font-text`\); Barlow Condensed for the product's name, titles and headlines \(`--vd-font-display`\); Red Hat Mono for codes \(`--vd-font-mono`\)\. No other family\./);
  assert.match(style, /- Sizes in use: 13 px captions and table headings, 14 px controls and table cells, 16 px body, 20 px section headings, 30 px screen titles\. Nothing below 13 px\./);
  assert.match(style, /- Labels and table headings are in capitals, spaced 0\.06 em\. Numbers in columns use equal-width digits\./);
  assert.match(style, /- Accent \(`--vd-accent`, #c2410c\): the one thing to do next on a screen, and nothing else\./);
  assert.match(style, /\| `--vd-text-muted` \| `--vd-surface` \| Captions, helper text, placeholders \| 4\.5:1 \|/);
  assert.match(style, /\| `--vd-accent` \| `--vd-surface` \| The fill of the main action against the page \| 3:1 \|/);
  assert.match(style, /- Things are told apart by lines 1 px wide \(`--vd-border`\)\. No shadows\./);
  assert.match(style, /- Pointer screens: controls 32 px high, table rows 32 px high\.\n- Touch screens: controls at least 44 px high\./);
  assert.match(style, /- The product says "round", "asset", "sheet" and "visit"\. It does not say "work order", "ticket", "job" and "task"\./);
  assert.match(style, /### D-NNN  The product's look is the direction "Asset tag"\n\n- Date: 2026-11-23\n- Decision: Condensed capitals, square ruled cells and one signal colour.*Its own marks: Asset codes in fixed-width capitals.*What it refuses: No shadows: nothing is lifted off the page; No rounded corners/);
  assert.match(style, /- Why: It looks like our own drawings\.\n- Applies to: The whole product\.\n- Supersedes: nothing\./);

  const brand = run(['render', '--dir', dir, '--brand']).stdout;
  const entries = ['- **Type:**', '- **Colour:**', '- **Shape:**', '- **Spacing:**', '- **Motion:**', '- **Imagery:**', '- **Voice:**'];
  const where = entries.map((e) => brand.indexOf(e));
  assert.ok(where.every((p, i) => p > 0 && (i === 0 || p > where[i - 1])), 'the entries of a page brief, in its order');
  assert.match(brand, /- \*\*Type:\*\* Barlow Condensed for headlines, weight 600: 80 px at full width, line spacing 0\.96, section headings 46 and 26 px\. Barlow for running text: 18 px, the line under the headline 22 px, lines of about 58 characters\./);
  assert.match(brand, /A full-width band is filled with the text colour, with the page colour for its words\./);
  assert.match(brand, /- \*\*Imagery:\*\* Real screens of the product, and line drawings of assets.*Never: Photographs of people, or any colour but the one orange\./);
  assert.match(brand, /### D-NNN\n- \*\*Date:\*\* 2026-11-23\n- \*\*Decision:\*\* The page's look is the direction "Asset tag"/);
  assert.ok(!/undefined|\[object|NaN/.test(style + brand));

  // Written into a decisions file and a page brief, the two say what the direction says.
  const decisions = path.join(root, 'design-decisions.md'), brief = path.join(root, 'page-brief.md');
  fs.writeFileSync(decisions, `# Design decisions\n\n${style.split('\n## Decisions')[0]}\n\n## Decisions\n\n### D-001  Desk tables are dense\n`);
  fs.writeFileSync(brief, `# Page brief\n\n## Offer\n\nA walk-through.\n\n${brand.split('\n## Decisions')[0]}\n\n## Layout\n\nType A.\n`);
  let out = json(run(['compare', '--dir', dir, '--decisions', decisions, '--brief', brief]));
  assert.deepStrictEqual([out.decisions.state, out.brief.state], ['same', 'same']);
  // A line added by the project is its own business; a value changed is drift.
  fs.writeFileSync(decisions, fs.readFileSync(decisions, 'utf8').replace('controls 32 px high, table rows 32 px high', 'controls 36 px high, table rows 32 px high').replace('### Density\n', '### Density\n\n- Handheld rows are 56 px (D-006).'));
  let r = run(['compare', '--dir', dir, '--decisions', decisions, '--brief', brief], { allowFail: true });
  assert.strictEqual(r.status, 2);
  out = json(r);
  assert.strictEqual(out.decisions.state, 'differs');
  assert.deepStrictEqual(out.decisions.lines_not_found, ['- Pointer screens: controls 32 px high, table rows 32 px high.']);
  assert.strictEqual(out.brief.state, 'same');
  assert.match(out.then, /that is the owner's decision: change direction\.json/);
  fs.writeFileSync(brief, '# Page brief\n\n## Offer\n\nA walk-through.\n');
  out = json(run(['compare', '--dir', dir, '--brief', brief], { allowFail: true }));
  assert.deepStrictEqual([out.brief.state, out.brief.says], ['missing', 'It has no "## Brand" section.']);
  r = run(['compare', '--dir', dir], { allowFail: true });
  assert.match(r.stderr, /Say which file to hold against the direction/);

  // A value changed by hand in direction.json still has to meet the floor before anything is written from it.
  const file = path.join(dir, 'direction.json');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  d.direction.colour.modes.light['text-muted'] = '#A0A8B0';
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
  r = run(['render', '--dir', dir], { allowFail: true });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /direction\.json no longer holds a direction that can be used:\n- colour\.modes\.light: text-muted on surface measures 2\.\d+ to 1/);
  d.direction.colour.modes.light['text-muted'] = '#3F4C57';
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
  json(run(['render', '--dir', dir]));
  assert.ok(fs.readFileSync(path.join(dir, 'direction.css'), 'utf8').includes('--vd-text-muted: #3f4c57;'));

  // A change to a settled look is a decision with a name on it, and the files written earlier then lag.
  fs.writeFileSync(decisions, `# Design decisions\n\n${run(['render', '--dir', dir, '--style']).stdout.split('\n## Decisions')[0]}\n`);
  d.direction.space.product.row_height = 36;
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
  r = run(['decide', '--dir', dir, '--title', 'Table rows are 36 px', '--decision', 'Rows of every table are 36 px high on pointer screens', '--why', 'Crews in gloves missed the 32 px rows'], { allowFail: true });
  assert.match(r.stderr, /--by is needed: the name of the person who decided\. A change to the look is the owner's, never yours/);
  r = run(['decide', '--dir', dir, '--title', 'Table rows are 36 px', '--decision', 'Rows of every table are 36 px high on pointer screens', '--why', 'Crews in gloves missed the 32 px rows', '--by', 'R. Vance', '--supersedes', 'D-009'], { allowFail: true });
  assert.match(r.stderr, /--supersedes names D-009, and the decisions are: D-001/);
  out = json(run(['decide', '--dir', dir, '--title', 'Table rows are 36 px', '--decision', 'Rows of every table are 36 px high on pointer screens', '--why', 'Crews in gloves missed the 32 px rows', '--by', 'R. Vance', '--date', '2026-12-05', '--applies-to', 'Every table of the product']));
  assert.strictEqual(out.decision, 'D-002');
  const record = fs.readFileSync(path.join(dir, 'visual-direction.md'), 'utf8');
  assert.match(record, /### D-002  Table rows are 36 px\n\n- Date: 2026-12-05\n- By: R\. Vance\n- Decision: Rows of every table are 36 px high on pointer screens\.\n- Why: Crews in gloves missed the 32 px rows\.\n- Applies to: Every table of the product\.\n- Supersedes: nothing\./);
  assert.match(record, /\| Rhythm \| table rows 36 px, 16 px between panels \|/);
  assert.match(run(['render', '--dir', dir, '--style']).stdout, /The look is the direction "Asset tag", chosen by R\. Vance on 2026-11-23/, 'the look is still the one that was chosen');
  out = json(run(['compare', '--dir', dir, '--decisions', decisions], { allowFail: true }));
  assert.deepStrictEqual(out.decisions.lines_not_found, ['- Pointer screens: controls 32 px high, table rows 36 px high.']);
});

test('a study for one surface only settles that surface', () => {
  const { dir, study, state, change, read } = setup();
  state((s) => { s.surfaces = ['landing']; });
  for (const id of ['asset-tag', 'timetable', 'field-book']) change(id, (c) => { delete c.type.product; delete c.space.product; delete c.motion.product; delete c.colour.product_use; for (const s of c.signature) delete s.product; });
  const out = json(run(['check', '--dir', dir]));
  assert.strictEqual(out.ok, true, out.problems.join('\n'));
  assert.deepStrictEqual(out.surfaces, ['landing']);
  assert.strictEqual(out.candidates['field-book'].axes.density, 'roomy', 'with no product, how roomy it is comes from the space between a page\'s sections');
  run(['specimen', '--dir', dir]);
  const html = fs.readFileSync(path.join(study, 'specimens', 'timetable', 'index.html'), 'utf8');
  assert.ok(!html.includes('data-part="product"') && html.includes('data-part="landing"'));
  assert.ok(html.includes('<div class="l-hero l-hero-solo">') && !html.includes('<figure class="l-picture">'), 'with no product to show, the first window has no picture, not an empty frame');
  assert.ok(!fs.readFileSync(path.join(study, 'sheet.html'), 'utf8').includes('data-value="product"'));
  run(['pick', '--dir', dir, '--candidate', 'timetable', '--by', 'R. Vance', '--why', 'It stands out']);
  assert.ok(read('timetable').type.landing);
  const r = run(['render', '--dir', dir, '--style'], { allowFail: true });
  assert.match(r.stderr, /settled for the landing page only: it has no values for the product/);
  assert.match(run(['render', '--dir', dir, '--brand']).stdout, /^## Brand\n/);
  assert.match(fs.readFileSync(path.join(dir, 'visual-direction.md'), 'utf8'), /\| Body text \| not settled \| 18 px \|/);
});

test('a look that already exists is written down without a study, and still has to meet the floor', () => {
  const { root, read } = setup();
  const dir = path.join(root, 'brand');
  const look = read('field-book');
  for (const k of ['drawn_from', 'brings_to_mind', 'refuses', 'signature', 'signature_css']) delete look[k];
  look.id = 'house'; look.name = 'House style';
  const from = path.join(root, 'house.json');
  fs.writeFileSync(from, JSON.stringify(look));
  let r = run(['adopt', '--dir', dir, '--from', from, '--by', 'R. Vance', '--why', 'So that screens follow the guidelines'], { allowFail: true });
  assert.match(r.stderr, /--source is needed: where the look is already set out/);
  const args = ['adopt', '--dir', dir, '--from', from, '--by', 'R. Vance', '--why', 'So that screens follow the guidelines', '--source', 'the brand guidelines, edition 3', '--product', 'Example Rounds', '--date', '2026-11-23'];
  const out = json(run(args));
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.adopted, 'House style');
  const record = fs.readFileSync(path.join(dir, 'visual-direction.md'), 'utf8');
  assert.match(record, /Written down by R\. Vance on 2026-11-23, from the brand guidelines, edition 3\. So that screens follow the guidelines\./);
  assert.ok(!record.includes('## Where it came from') && !record.includes('## It never') && !/undefined/.test(record));
  assert.match(run(['render', '--dir', dir, '--style']).stdout, /The look is the direction "House style", written down by R\. Vance on 2026-11-23/);
  assert.match(fs.readFileSync(path.join(dir, 'direction.css'), 'utf8'), /"House style", written down by R\. Vance/);
  // A brand that falls below the floor is not written down as though it passed.
  look.colour.modes.light['text-muted'] = '#A39E92';
  fs.writeFileSync(from, JSON.stringify(look));
  const other = path.join(root, 'brand2');
  r = run([...args.map((a) => (a === dir ? other : a))], { allowFail: true });
  assert.strictEqual(r.status, 2);
  const bad = json(r);
  assert.strictEqual(bad.ok, false);
  assert.match(bad.problems.join('\n'), /text-muted on surface measures 2\.\d+ to 1, and 4\.5 to 1 is needed/);
  assert.match(bad.then, /that goes to the owner/);
  assert.ok(!fs.existsSync(path.join(other, 'direction.json')));
  r = run(['render', '--dir', other], { allowFail: true });
  assert.match(r.stderr, /No direction has been settled in .*there is no direction\.json/);
});
