'use strict';
// Tests of uxq.cjs on synthetic reviewer results: node --test scripts/uxq.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const UXQ = path.join(__dirname, 'uxq.cjs');
const JUDGE = path.join(__dirname, '..', 'judge');
const { ROLES, SPECIALISTS, EVIDENCE_KINDS, REBASE, disagree, reviewerResult, groupFindings, joinPoints, validateSpecialist, validateUser, validateVerdict, numberedDecisions, loadRubric, spawnPrompt } = require('./uxq.cjs');
const rubric = loadRubric();

function uxq(args, { allowFail = false } = {}) {
  const r = spawnSync(process.execPath, [UXQ, ...args], { encoding: 'utf8' });
  if (r.status !== 0 && !allowFail) throw new Error(`uxq ${args.join(' ')} failed (${r.status}):\n${r.stderr}\n${r.stdout}`);
  return r;
}
const json = (r) => JSON.parse(r.stdout);

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxq-test-'));
  const home = path.join(root, 'quality', 'ux');
  fs.mkdirSync(home, { recursive: true });
  const config = {
    app: { name: 'Sample', description: 'A sample product for the test.' },
    viewports: [{ id: 'phone', width: 375, height: 812, touch: true }, { id: 'desktop', width: 1280, height: 800 }],
    personas: [{ id: 'member', description: 'A member who signs in once a month, on a phone.', viewport: 'phone' }],
    judges: 2,
    units: [
      { id: 'pay-invoice', persona: 'member', goal: 'Settle the open bill.', weight: 2,
        steps: [
          { id: '01-open', do: 'Opens the list of bills.', expect: 'EXPECTED-OUTCOME-TEXT one' },
          { id: '02-pay', do: 'Presses the button to settle it.', expect: 'EXPECTED-OUTCOME-TEXT two' },
          { id: '03-focus', do: 'Tabs to the main button.', roles: ['accessibility', 'interaction'] }
        ] },
      { id: 'read-notice', persona: 'member', goal: 'Read the latest notice.', viewports: ['phone'], roles: ['content', 'user'],
        steps: [{ id: '01-open', do: 'Opens notices.' }, { id: '02-read', do: 'Opens the newest one.' }] },
      { id: 'control-form', persona: 'member', goal: 'Send a message to the office.', viewports: ['phone'], roles: ['accessibility', 'user'], control: true,
        planted: [{ id: 'faint-text', role: 'accessibility', criterion: 'A1', step: '01-form' }, { id: 'obscure-label', role: 'user', step: '01-form' }],
        clean: [{ id: 'labels-fine', role: 'accessibility', criterion: 'A2' }],
        steps: [{ id: '01-form', do: 'Opens the contact form.' }] }
    ]
  };
  const configFile = path.join(home, 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  return { root, home, configFile, config, tmp: path.join(root, 'tmp') };
}

function writeEvidence(dir, files, changed = []) {
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), changed.includes(f) ? `changed:${f}` : `png:${f}`);
  }
}

// A specialist's result, an issue in it, and a person's result: [[outcome, [[kind, what], ...]], ...].
const spec = (score, issues = []) => ({ score, reason: `Scored ${score} for what the screens show.`, issues, strengths: ['Clear layout.'] });
const issue = (criterion, severity, problem, evidence, extra = {}) => ({ criterion, severity, problem, evidence: [evidence], ...extra });
function person(steps, finished, score) {
  return {
    steps: steps.map(([outcome, trouble = []], i) => ({
      step: i + 1, saw: 'A screen.', outcome, good: [], next: 'Press the main button.',
      trouble: trouble.map(([kind, what]) => ({ kind, what, evidence: [`screens/screen-0${i + 1}.png`] }))
    })),
    finished, score, reason: 'It was what it was.'
  };
}
const easy = (n, score = 95) => person(Array.from({ length: n }, () => ['smooth']), 'sure', score);
// A score below 100 must say what cost the points. Sample results that only stand for "fine" get one
// small polish note, in the role's own first criterion, so they pass without changing what is tested.
function owed(data, role) {
  if (!data || typeof data.score !== 'number' || data.score >= 100) return data;
  if (role === 'user') {
    if (data.steps.some((st) => (st.trouble || []).length)) return data;
    const steps = data.steps.map((st, i) => (i === 0 ? { ...st, trouble: [{ kind: 'U5', what: 'A small extra glance.', evidence: ['screens/screen-01.png'] }] } : st));
    return { ...data, steps };
  }
  if ((data.issues || []).length) return data;
  return { ...data, issues: [{ criterion: rubric.roles[role].ids[0], severity: 'polish', problem: `A finishing detail in ${role}.`, evidence: ['rubric.md'] }] };
}

function readAllMarkdown(dir) {
  let out = '';
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out += readAllMarkdown(full);
    else if (e.name.endsWith('.md')) out += `\n${fs.readFileSync(full, 'utf8')}`;
  }
  return out.toLowerCase();
}
const FORBIDDEN = ['adversarial', 'iteration', 'ledger', 'previous review', 'other reviewers', 'another reviewer', 'other judges', 'loop', 'baseline', 'planted', 'earlier run', 'round'];

test('six rubrics, one version, each with its own criteria; reviewer material never mentions the process', () => {
  assert.strictEqual(rubric.version, '5.0.0');
  assert.deepStrictEqual(Object.keys(rubric.roles), ROLES);
  assert.deepStrictEqual(SPECIALISTS.map((r) => rubric.roles[r].ids.length), [10, 9, 12, 9, 8]);
  // Each specialist rubric says where its evidence is, what is a major whenever it is seen, and what 90 looks like.
  for (const role of SPECIALISTS) {
    const body = fs.readFileSync(rubric.roles[role].file, 'utf8');
    for (const heading of ['## Where to look', '## Criteria', '## Major on sight', '## What 90 looks like here']) assert.ok(body.includes(heading), `${role} rubric has "${heading}"`);
    for (const kind of EVIDENCE_KINDS[role].filter((k) => !['screens', 'pages'].includes(k))) assert.ok(body.includes(`\`${kind}/`), `${role} rubric says how to use ${kind}/`);
  }
  const prefix = { accessibility: 'A', visual: 'V', interaction: 'I', content: 'C', responsive: 'R', user: 'U' };
  for (const role of ROLES) {
    const r = rubric.roles[role];
    assert.ok(r.criteria.length >= 5, `${role} has criteria`);
    assert.ok(r.ids.every((id) => id.startsWith(prefix[role])), `${role} criteria carry its own prefix`);
  }
  assert.deepStrictEqual(rubric.roles.user.ids, ['U1', 'U2', 'U3', 'U4', 'U5']);
  // Every reviewer gives a score with its reason.
  for (const brief of ['reviewer-brief.md', 'user-brief.md']) assert.match(fs.readFileSync(path.join(JUDGE, brief), 'utf8'), /"score": \d+,\s*\n\s*"reason"/);
  const shown = readAllMarkdown(JUDGE);
  for (const word of FORBIDDEN) assert.ok(!new RegExp(`\\b${word}\\b`).test(shown), `reviewer material must not contain "${word}"`);
});

test('a score counts as given, held to the ceiling its own issues set', () => {
  const unit = { id: 'u' };
  const run = (role, data) => reviewerResult(unit, { role, judge: 1, data });
  const P = 'screens/02-pay.phone.png';
  assert.deepStrictEqual([run('visual', spec(95, [issue('V7', 'minor', 'A clipped label.', P)])).counted, run('visual', spec(95)).capped], [95, null], 'minor and polish issues set no ceiling');
  const major = run('accessibility', spec(85, [issue('A1', 'major', 'Faint total.', P)]));
  assert.deepStrictEqual([major.given, major.counted, major.capped], [85, 74, 'a major issue']);
  const blocker = run('interaction', spec(60, [issue('I5', 'blocker', 'The error wipes the form.', P), issue('I2', 'major', 'No confirmation.', P)]));
  assert.deepStrictEqual([blocker.counted, blocker.capped], [24, 'a blocker issue']);
  assert.strictEqual(run('content', spec(20, [issue('C5', 'blocker', 'A stack trace.', P)])).capped, null, 'a score already under the ceiling is untouched');
  // A person never names a severity: it follows from how the step went, and from whether they finished.
  const person1 = reviewerResult(unit, { role: 'user', judge: 1, data: { viewport: 'phone', finished: 'sure', score: 92, reason: 'r', steps: [
    { step: '01-a', outcome: 'smooth', trouble: [{ kind: 'U2', what: 'Odd word.', evidence: ['e'] }] },
    { step: '02-b', outcome: 'hesitated', trouble: [{ kind: 'U1', what: 'Where now?', evidence: ['e'] }] }] } });
  assert.deepStrictEqual([person1.counted, person1.issues.map((i) => i.severity)], [92, ['polish', 'minor']]);
  const unsure = reviewerResult(unit, { role: 'user', judge: 1, data: { viewport: 'phone', finished: 'unsure', score: 80, reason: 'r', steps: [{ step: '01-a', outcome: 'smooth', trouble: [] }] } });
  assert.deepStrictEqual([unsure.counted, unsure.capped], [74, 'finished: unsure']);
  const quit = reviewerResult(unit, { role: 'user', judge: 1, data: { viewport: 'phone', finished: 'sure', score: 70, reason: 'r', steps: [{ step: '01-a', outcome: 'gave_up', trouble: [{ kind: 'U1', what: 'Lost.', evidence: ['e'] }] }] } });
  assert.deepStrictEqual([quit.counted, quit.capped], [24, 'a blocker issue']);
});

test('reviewers of a role disagree when their scores are 25 or more apart', () => {
  assert.strictEqual(disagree([90, 60]), true);
  assert.strictEqual(disagree([90, 70]), false);
  assert.strictEqual(disagree([90, 92, 40]), true, 'one dissenting reviewer of three is a disagreement too');
  assert.strictEqual(disagree([88]), false);
});

test('reports of the same problem are grouped by the words they share, and only then', () => {
  const f = (id, statement, over = {}) => ({ id, unit: 'sign-in', step: '02-login', role: 'user', judge: 1, severity: 'minor', statement, ...over });
  const findings = [
    f('d1', "On the phone the selected 'Sign In' tab is a full-width green button above the fields, identical to the 'Sign In to Resident Portal' button below them.", { role: 'visual', check: 'V1', severity: 'major' }),
    f('d2', "The selected 'Sign In' tab and the submit button 'Sign In to Resident Portal' are both full-width solid green buttons, and the tab comes first.", { role: 'visual', judge: 2, check: 'V1' }),
    f('u1', 'The email box already says alice.resident@oakridge.org and the password box is full of dots. That is not me.'),
    f('u2', 'The email box already says alice.resident@oakridge.org and there is a password already in. That is not me.', { judge: 2 }),
    f('u3', "'Invalid email or password' does not say which one is wrong.", { judge: 3, step: '03-error' }),
    f('d3', "The due date is written '2026-09-01' and the balance box shows no due date.", { role: 'visual', check: 'V8', step: '04-home' }),
    f('d4', 'The page is 491 px wide on a 375 px screen and scrolls sideways.', { role: 'responsive', check: 'R1', step: '04-home', severity: 'major' })
  ];
  const ids = (groups) => groups.map((g) => g.members.map((m) => m.id).sort().join('+')).sort();
  assert.deepStrictEqual(ids(groupFindings(findings)), ['d1+d2', 'd3', 'd4', 'u1+u2', 'u3']);
  assert.deepStrictEqual(ids(groupFindings(findings, { 'Home screen on the phone': ['d3', 'd4'] })), ['d1+d2', 'd3+d4', 'u1+u2', 'u3']);
});

test('points of a comparison are joined when different reviewers made the same one of the same arrangement, on the same screen', () => {
  const P = 'screens/02-pay.phone.png'; const D = 'screens/02-pay.desktop.png';
  const pt = (id, judge, candidate, side, what, evidence = [P]) => ({ id, judge, candidate, side, what, evidence });
  const points = [
    pt('a1', 1, 'split', 'better', 'The amount owed sits directly beside the pay button, so the person confirms the sum without scrolling.'),
    pt('a2', 2, 'split', 'better', 'On the phone the amount owed stays next to the pay button: the person can check the sum and pay without scrolling.'),
    pt('a3', 3, 'split', 'better', 'The amount owed is beside the pay button, so the sum is confirmed where the person decides.'),
    // The same reviewer's second point, a point about another arrangement, the other side, another screen: all kept apart.
    pt('b1', 1, 'split', 'better', 'The list of earlier payments is folded away until asked for, leaving the form short.'),
    pt('c1', 2, 'stacked', 'better', 'The amount owed sits directly beside the pay button, so the person confirms the sum without scrolling.'),
    pt('d1', 3, 'split', 'worse', 'The amount owed sits beside the pay button but the due date is pushed below the fold.'),
    pt('e1', 2, 'split', 'better', 'The amount owed sits directly beside the pay button, so the person confirms the sum without scrolling.', [D]),
    pt('f1', 3, 'split', 'better', 'Earlier payments are shown as a table with dates, which reads faster than the cards.')
  ];
  const groups = joinPoints(points).map((g) => g.map((x) => x.id).join('+'));
  assert.deepStrictEqual(groups, ['a1+a2+a3', 'b1', 'c1', 'd1', 'e1', 'f1']);
  assert.deepStrictEqual(joinPoints([]), []);
});

test('results that do not follow the rules are rejected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxq-validate-'));
  writeEvidence(dir, ['screens/02-pay.phone.png', 'screens/screen-01.png', 'screens/screen-02.png']);
  const P = 'screens/02-pay.phone.png';
  const check = (j) => validateSpecialist(j, rubric.roles.accessibility.ids, ['01-open', '02-pay'], ['phone', 'desktop'], dir).join('; ');
  assert.strictEqual(check(spec(70, [issue('A1', 'major', 'Faint.', P, { step: '02-pay', size: 'phone' })])), '');
  assert.strictEqual(check(spec(100)), '', 'a perfect score needs no issue');
  assert.match(check(spec(95)), /a score below 100 needs at least one issue/);
  assert.strictEqual(check(spec(97, [issue('A1', 'polish', 'Could be a touch darker.', P)])), '', 'a polish issue is enough');
  assert.match(check(spec(8.5, [issue('A1', 'major', 'Faint.', P)])), /whole number from 0 to 100/);
  assert.match(check(spec(70, [issue('V1', 'major', 'Not mine.', P)])), /criterion must be one of A1/);
  assert.match(check(spec(70, [issue('A1', 'major', 'Faint.', 'screens/nope.png')])), /evidence must cite at least one file that exists/);
  assert.match(check(spec(70, [issue('A1', 'major', 'Faint.', P, { step: '09-none' })])), /step 09-none is not a step/);
  assert.match(check({ ...spec(70, [issue('A1', 'severe', 'Faint.', P)]) }), /severity must be one of/);
  const noReason = spec(95); delete noReason.reason;
  assert.match(check(noReason), /reason is required/);

  const kinds = rubric.roles.user.ids;
  assert.deepStrictEqual(validateUser(easy(2, 100), 2, kinds, dir), []);
  assert.match(validateUser(person([['smooth'], ['hesitated']], 'sure', 95), 2, kinds, dir).join(';'), /needs trouble that says why/);
  assert.match(validateUser(person([['smooth'], ['smooth']], 'sure', 70), 2, kinds, dir).join(';'), /a score below 100 needs at least one piece of trouble/);
  assert.match(validateUser(person([['smooth'], ['struggled', [['confusion', 'Lost.']]]], 'sure', 50), 2, kinds, dir).join(';'), /kind must be one of U1/);
  assert.match(validateUser(easy(1), 2, kinds, dir).join(';'), /one entry for each of the 2 steps/);
  const rated = easy(2); rated.finished = 'mostly';
  assert.match(validateUser(rated, 2, kinds, dir).join(';'), /finished must be one of/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a full run: six roles in blind folders, scores held to their issues, strictness both ways, fix order, ledger', () => {
  const t = setup();
  const created = json(uxq(['new-run', '--config', t.configFile, '--commit', 'abc1234', '--date', '2026-01-15']));
  assert.strictEqual(created.run_id, '20260115-abc1234');
  assert.strictEqual(created.reviewers_per_full_run, 20, '12 for the journey with all six roles, 4 for the one with two, 4 for the control');
  assert.deepStrictEqual(created.capture['pay-invoice'], ['screens/01-open.phone.png', 'screens/01-open.desktop.png', 'screens/02-pay.phone.png', 'screens/02-pay.desktop.png', 'screens/03-focus.phone.png', 'screens/03-focus.desktop.png']);
  assert.deepStrictEqual(created.capture['read-notice'], ['screens/01-open.phone.png', 'screens/02-read.phone.png']);
  assert.deepStrictEqual(created.controls_missing.files['control-form'], ['screens/01-form.phone.png']);
  const runDir = created.run_dir;
  const args = ['--config', t.configFile, '--run', runDir];

  assert.match(uxq(['bundle', ...args, '--tmp', t.tmp], { allowFail: true }).stderr, /missing screenshots/);
  for (const [unit, files] of Object.entries(created.capture)) writeEvidence(path.join(runDir, 'evidence', unit), files);
  writeEvidence(path.join(runDir, 'evidence', 'pay-invoice'), ['facts/02-pay.phone.json', 'pages/02-pay.phone.txt']);
  writeEvidence(path.join(t.home, 'controls', 'control-form'), ['screens/01-form.phone.png']);

  const bundles = json(uxq(['bundle', ...args, '--tmp', t.tmp]));
  assert.strictEqual(bundles.length, 20);
  // Isolation: each folder alone under a random parent; nothing in it names the run, the journey, the role
  // or the process; each role gets its own rubric; a person gets only their own screens, in order.
  assert.strictEqual(new Set(bundles.map((b) => path.dirname(b.dir))).size, bundles.length);
  for (const b of bundles) {
    assert.strictEqual(b.prompt, spawnPrompt(b.dir));
    assert.deepStrictEqual(fs.readdirSync(path.dirname(b.dir)), [path.basename(b.dir)]);
    assert.ok(!b.dir.includes(created.run_id) && !b.dir.includes(b.unit) && !b.dir.includes(b.role), 'folder path is neutral');
    const shown = readAllMarkdown(b.dir);
    for (const word of [...FORBIDDEN, created.run_id, b.unit]) assert.ok(!new RegExp(`\\b${word}\\b`).test(shown), `${b.role} material must not contain "${word}"`);
    assert.ok(!shown.includes('{{'), 'no unfilled placeholders');
    assert.strictEqual(fs.readFileSync(path.join(b.dir, 'rubric.md'), 'utf8'), fs.readFileSync(rubric.roles[b.role].file, 'utf8'), 'its own rubric');
    const listing = fs.readdirSync(b.dir).sort();
    if (b.role === 'user') {
      assert.deepStrictEqual(listing, ['README.md', 'rubric.md', 'screens', 'start.md', 'steps']);
      const n = b.unit === 'control-form' ? 1 : 2;
      assert.deepStrictEqual(fs.readdirSync(path.join(b.dir, 'screens')).sort(), Array.from({ length: n }, (_, i) => `screen-0${i + 1}.png`));
      for (const hidden of ['expected-outcome-text', '02-pay', '03-focus', 'tabs to the main button', 'desktop']) assert.ok(!shown.includes(hidden), `user material must not contain "${hidden}"`);
    } else {
      assert.deepStrictEqual(listing, b.unit === 'pay-invoice' ? ['README.md', 'facts', 'journey.md', 'pages', 'rubric.md', 'screens'] : ['README.md', 'journey.md', 'rubric.md', 'screens']);
      assert.ok(shown.includes(`specialist in ${{ accessibility: 'accessibility', visual: 'visual design', interaction: 'interaction', content: 'content', responsive: 'responsive design' }[b.role]}`));
      const focus = fs.existsSync(path.join(b.dir, 'screens', '03-focus.phone.png'));
      assert.strictEqual(focus, b.unit === 'pay-invoice' && ['accessibility', 'interaction'].includes(b.role), 'a step limited to some roles reaches only them');
    }
  }
  const dirOf = (unit, role, judge) => bundles.find((b) => b.unit === unit && b.role === role && b.judge === judge).dir;
  const put = (unit, role, judge, data) => fs.writeFileSync(path.join(dirOf(unit, role, judge), 'judgment.json'), JSON.stringify(owed(data, role)));

  const P = 'screens/02-pay.phone.png';
  const R = 'screens/02-read.phone.png';
  const F = 'screens/01-form.phone.png';
  put('pay-invoice', 'accessibility', 1, spec(70, [issue('A1', 'major', 'The amount due on the phone is pale grey text at 2.9 to 1 contrast.', P, { step: '02-pay', size: 'phone', fix: 'Darken the amount to at least 4.5 to 1.' })]));
  put('pay-invoice', 'accessibility', 2, spec(85, [issue('A1', 'major', 'On the phone the amount due text has 2.9 to 1 contrast.', P, { step: '02-pay', size: 'phone' })]));
  put('pay-invoice', 'visual', 1, spec(92, [issue('V4', 'polish', 'Two caption sizes differ by a pixel.', P)]));
  put('pay-invoice', 'visual', 2, spec(88, [issue('V3', 'minor', 'The pay button is not aligned with the amount above it.', P, { step: '02-pay' })]));
  put('pay-invoice', 'interaction', 1, spec(95, [issue('I10', 'polish', 'The receipt could offer the next bill.', P)]));
  put('pay-invoice', 'interaction', 2, spec(60, [issue('I2', 'major', 'Nothing on the screen confirms that the payment went through.', P, { step: '02-pay' })]));
  put('pay-invoice', 'content', 1, spec(90, [issue('C6', 'polish', 'The button could name the amount it pays.', P)]));
  put('pay-invoice', 'content', 2, spec(90, [issue('C6', 'polish', 'The pay button could say the amount it pays.', P)]));
  put('pay-invoice', 'responsive', 1, spec(80, [issue('R3', 'minor', 'The remove link is 20 pixels tall on the phone.', P, { step: '02-pay', size: 'phone' })]));
  put('pay-invoice', 'responsive', 2, spec(84, [issue('R3', 'minor', 'On the phone the remove link is only 20 pixels tall.', P, { step: '02-pay', size: 'phone' })]));
  put('pay-invoice', 'user', 1, person([['smooth'], ['hesitated', [['U2', 'It says remit and I do not know if that means pay.']]]], 'sure', 80));
  put('pay-invoice', 'user', 2, person([['smooth'], ['struggled', [['U1', 'I could not see where to pay.'], ['U3', 'I am not sure it went through.']]]], 'unsure', 80));
  put('read-notice', 'content', 1, spec(95, [issue('C9', 'polish', 'The notice could say who wrote it.', R, { step: '02-read' })]));
  put('read-notice', 'user', 1, person([['smooth'], ['gave_up', [['U1', 'The notice never opens.']]]], 'no', 10));
  put('read-notice', 'user', 2, person([['smooth'], ['gave_up', [['U1', 'The notice never opens.']]]], 'no', 30));
  // The control journey: one accessibility reviewer of two catches the faint text, the other flags labels known to be right; one person of two notices the odd label.
  put('control-form', 'accessibility', 1, spec(60, [issue('A1', 'major', 'The heading text is too faint to read.', F, { step: '01-form' })]));
  put('control-form', 'accessibility', 2, spec(85, [issue('A2', 'minor', 'The message field relies on its placeholder.', F, { step: '01-form' })]));
  put('control-form', 'user', 1, person([['hesitated', [['U2', 'What is a conveyance?']]]], 'sure', 70));
  put('control-form', 'user', 2, easy(1, 100));
  // One result breaks a rule: collection reports it and keeps it out until it is put right.
  fs.writeFileSync(path.join(dirOf('read-notice', 'content', 2), 'judgment.json'), JSON.stringify(spec(85)));
  const first = uxq(['collect', ...args], { allowFail: true });
  assert.strictEqual(first.status, 2);
  const invalid = json(first).filter((r) => r.status === 'invalid');
  assert.deepStrictEqual(invalid.map((r) => [r.unit, r.role, r.judge]), [['read-notice', 'content', 2]]);
  assert.match(invalid[0].errors[0], /a score below 100 needs at least one issue/);
  assert.ok(fs.existsSync(dirOf('read-notice', 'content', 2)), 'an invalid result keeps its folder until it is put right or discarded');
  assert.ok(!fs.existsSync(path.dirname(dirOf('pay-invoice', 'visual', 1))), 'a collected folder is gone, with its parent');
  put('read-notice', 'content', 2, spec(85, [issue('C2', 'minor', 'The notice says "per the CC&Rs" without explaining it.', R, { step: '02-read' })]));
  uxq(['collect', ...args]);
  assert.ok(bundles.every((b) => !fs.existsSync(b.dir)), 'every folder is gone once its result is in');
  const stored = JSON.parse(fs.readFileSync(path.join(runDir, 'judgments', 'pay-invoice', 'user-1.json'), 'utf8'));
  assert.deepStrictEqual([stored.steps[1].step, stored.steps[1].trouble[0].evidence], ['02-pay', ['screens/02-pay.phone.png']], 'a person\'s report carries the real step ids and files again');

  const result = json(uxq(['score', ...args]));
  // pay-invoice: accessibility (70 + 74) / 2 = 72, the second held to its major; visual (92 + 88) / 2 = 90;
  // interaction (95 + 60) / 2 = 77.5, 35 apart; content 90; responsive (80 + 84) / 2 = 82; user (80 + 74) / 2 = 77.
  // read-notice: content (95 + 85) / 2 = 90; user (10 + 24) / 2 = 17. Journeys weigh 2 and 1.
  assert.deepStrictEqual(result.role_scores, { accessibility: 72, visual: 90, interaction: 77.5, content: 90, responsive: 82, user: 57 });
  assert.strictEqual(result.overall_score, 78.1, '(72 + 90 + 77.5 + 90 + 82 + 57) / 6');
  assert.deepStrictEqual(result.contested, [{ unit: 'pay-invoice', role: 'interaction', scores: [95, 60] }]);
  assert.deepStrictEqual(result.capped.map((c) => [c.unit, c.role, c.given, c.counted, c.because]), [
    ['pay-invoice', 'accessibility', 85, 74, 'a major issue'], ['pay-invoice', 'user', 80, 74, 'finished: unsure'], ['read-notice', 'user', 30, 24, 'finished: no']]);
  // Strictness both ways: 2 of 4 planted chances reported (too kind), 1 of 2 known-right chances flagged (too harsh).
  assert.deepStrictEqual([result.reliable, result.too_harsh, result.sensitivity.rate, result.sensitivity.false_alarm_rate], [false, true, 0.5, 0.5]);
  assert.deepStrictEqual(result.sensitivity.missed, []);
  assert.deepStrictEqual(result.sensitivity.alarmed, []);
  assert.strictEqual(result.warnings.length, 2);
  assert.match(result.warnings.join(' '), /caught 2 of 4 planted defects/);
  assert.match(result.warnings.join(' '), /flagged 1 of 2 things known to be right/);

  const card = JSON.parse(fs.readFileSync(path.join(runDir, 'scorecard.json'), 'utf8'));
  const pay = card.units.find((u) => u.id === 'pay-invoice');
  assert.strictEqual(pay.overall, 81.4, '(72 + 90 + 77.5 + 90 + 82 + 77) / 6');
  assert.deepStrictEqual([pay.roles.accessibility.given, pay.roles.accessibility.raw], [[70, 85], [70, 74]]);
  assert.strictEqual(card.units.find((u) => u.id === 'read-notice').overall, 53.5);
  assert.deepStrictEqual(card.issue_counts, { blocker: 2, major: 5, minor: 5, polish: 5 }, 'a person\'s severity follows from the step: gave up is a blocker, struggled a major');
  assert.ok(!card.issues.some((f) => f.unit === 'control-form'), 'control screens add nothing to the issues');
  assert.strictEqual(card.fix_list.reduce((n, g) => n + g.reports, 0), 17, 'every report is in exactly one problem');
  // Top of the fix order: the contrast problem (major, both accessibility reviewers, weight 2) and the notice
  // that never opens (blocker, both people, weight 1), each reported twice and taken as one problem.
  assert.deepStrictEqual(card.fix_list.slice(0, 2).map((g) => [g.reports, g.priority]).sort(), [[2, 8], [2, 8]]);
  assert.deepStrictEqual(card.fix_list.slice(0, 2).map((g) => g.label).sort(), ['The amount due on the phone is pale grey text at 2.9 to 1 contrast.', 'The notice never opens.']);
  assert.strictEqual(card.fix_list.find((g) => g.label.startsWith('The amount due')).fix, 'Darken the amount to at least 4.5 to 1.');
  const md = fs.readFileSync(path.join(runDir, 'scorecard.md'), 'utf8');
  for (const want of [/\*\*Overall: 78\.1\*\*/, /TOO KIND/, /TOO HARSH/, /## Reviewers disagree/, /gave 85, counted 74, because of a major issue/, /## What each reviewer said/, /\| Target user \| 2 \| 74 \(gave 80\) \| It was what it was\. \|/, /`pay-invoice` \| 81\.4 \|/]) assert.match(md, want);
  assert.match(fs.readFileSync(path.join(runDir, 'findings.md'), 'utf8'), /Reports taken as one problem/);

  // The ledger is append-only and one line per run.
  const ledgerFile = path.join(t.home, 'ledger.jsonl');
  const ledgerLines = () => fs.readFileSync(ledgerFile, 'utf8').trim().split('\n');
  assert.strictEqual(ledgerLines().length, 1);
  uxq(['score', ...args]);
  assert.strictEqual(ledgerLines().length, 1, 'scoring twice does not duplicate the entry');
  const line = JSON.parse(ledgerLines()[0]);
  assert.deepStrictEqual(line.unit_scores.find((u) => u.id === 'pay-invoice').contested, ['interaction']);
  // What the capture hid as not part of the product is said on the scorecard, for real journeys only.
  fs.writeFileSync(path.join(runDir, 'capture-notes.json'), JSON.stringify({ hidden: [
    { unit: 'pay-invoice', step: '01-open', size: 'phone', what: 'demo accounts', selector: '#demo', elements: 1 },
    { unit: 'control-form', step: '01-form', size: 'phone', what: 'demo accounts', selector: '#demo', elements: 1 }] }));
  const noted = json(uxq(['score', ...args, '--no-ledger']));
  assert.strictEqual(noted.warnings.filter((w) => /the capture hid "demo accounts" on 1 screenshot\(s\)/.test(w)).length, 1);
  assert.strictEqual(noted.overall_score, 78.1, 'a note changes no score');
  fs.rmSync(path.join(runDir, 'capture-notes.json'));

  // A second run: every reviewer satisfied, every planted defect caught, nothing right flagged.
  const second = json(uxq(['new-run', '--config', t.configFile, '--commit', 'def5678', '--date', '2026-02-01']));
  for (const [unit, files] of Object.entries(second.capture)) writeEvidence(path.join(second.run_dir, 'evidence', unit), files);
  for (const b of json(uxq(['bundle', '--config', t.configFile, '--run', second.run_dir, '--tmp', t.tmp]))) {
    const control = b.unit === 'control-form';
    const data = b.role === 'user'
      ? (control ? person([['hesitated', [['U2', 'What is a conveyance?']]]], 'sure', 70) : easy(2))
      : (control ? spec(60, [issue('A1', 'major', 'The heading text is too faint to read.', F, { step: '01-form' })]) : spec(95));
    fs.writeFileSync(path.join(b.dir, 'judgment.json'), JSON.stringify(owed(data, b.role)));
  }
  uxq(['collect', '--config', t.configFile, '--run', second.run_dir]);
  const clean = json(uxq(['score', '--config', t.configFile, '--run', second.run_dir]));
  assert.deepStrictEqual([clean.overall_score, clean.reliable, clean.too_harsh, clean.contested, clean.warnings], [95, true, false, [], []]);
  assert.deepStrictEqual(clean.previous, { run_id: '20260115-abc1234', overall_score: 78.1 });
  const trend = uxq(['trend', '--config', t.configFile]).stdout;
  assert.match(trend, /20260115-abc1234 \| abc1234 \| 78\.1 \| 72 \| 90 \| 77\.5 \| 90 \| 82 \| 57 \| caught 2\/4, false alarms 1\/2, too kind, too harsh/);
  assert.match(trend, /20260201-def5678 \| def5678 \| 95 \|/);

  // Changing what is measured breaks comparability, and an open run refuses to be scored under a changed config.
  t.config.units[0].weight = 5;
  fs.writeFileSync(t.configFile, JSON.stringify(t.config));
  assert.match(uxq(['score', '--config', t.configFile, '--run', second.run_dir, '--no-ledger'], { allowFail: true }).stderr, /config changed/);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('work can stop anywhere and be picked up from the files: status, one-journey runs, progress', () => {
  const t = setup();
  t.config.reviewer_model = 'opus';
  fs.writeFileSync(t.configFile, JSON.stringify(t.config));
  const created = json(uxq(['new-run', '--config', t.configFile, '--commit', 'abc1234', '--date', '2026-03-01']));
  const runDir = created.run_dir;
  const status = (extra = []) => json(uxq(['status', '--config', t.configFile, '--run', runDir, ...extra]));
  const progress = (target = 90) => json(uxq(['progress', '--config', t.configFile, '--target', String(target)]));
  assert.match(status().next.join(' '), /Capture the evidence/);
  assert.deepStrictEqual([progress().not_reviewed, progress().next_journey, progress().target_met], [2, 'pay-invoice', false]);

  // One journey only: captured and handed to its twelve reviewers, started with the model the config names.
  writeEvidence(path.join(runDir, 'evidence', 'pay-invoice'), created.capture['pay-invoice']);
  const bundles = json(uxq(['bundle', '--config', t.configFile, '--run', runDir, '--unit', 'pay-invoice', '--tmp', t.tmp]));
  assert.strictEqual(bundles.length, 12);
  assert.ok(bundles.every((b) => b.model === 'opus'));
  assert.strictEqual(status(['--unit', 'pay-invoice']).units[0].state, 'reviewers outstanding');
  const P = 'screens/02-pay.phone.png';
  const write = (b, score = 95) => fs.writeFileSync(path.join(b.dir, 'judgment.json'), JSON.stringify(owed(b.role === 'user'
    ? (score >= 90 ? easy(2, score) : person([['smooth'], ['hesitated', [['U2', 'It says remit.']]]], 'sure', score))
    : spec(score, score >= 90 ? [] : [issue(`${{ accessibility: 'A', visual: 'V', interaction: 'I', content: 'C', responsive: 'R' }[b.role]}1`, 'minor', 'Something small.', P)]), b.role)));

  // The session ends here. A later one finds two results written, takes them in, and replaces the lost reviewers.
  bundles.slice(0, 2).forEach((b) => write(b));
  let s = status();
  assert.match(s.next.join(' '), /2 reviewer folder\(s\) hold a result not yet taken into the run: run collect/);
  assert.match(s.next.join(' '), /10 reviewer folder\(s\) have no result yet/);
  uxq(['collect', '--config', t.configFile, '--run', runDir, '--discard-bad']);
  assert.match(status().next.join(' '), /10 reviewer\(s\) still to start/);
  const again = json(uxq(['bundle', '--config', t.configFile, '--run', runDir, '--unit', 'pay-invoice', '--tmp', t.tmp]));
  assert.strictEqual(again.length, 10);
  again.forEach((b) => write(b));
  uxq(['collect', '--config', t.configFile, '--run', runDir]);
  s = status();
  assert.deepStrictEqual([s.units.find((u) => u.unit === 'pay-invoice').state, s.units.find((u) => u.unit === 'read-notice').state], ['ready to score', 'not captured']);
  assert.deepStrictEqual(s.next, ['Every result is in: run score.']);

  // Scoring one journey gives that journey's scores, marked as such, and compared with nothing.
  const result = json(uxq(['score', '--config', t.configFile, '--run', runDir]));
  assert.deepStrictEqual([result.complete, result.overall_score, result.previous], [false, 95, null]);
  assert.strictEqual(result.warnings.filter((w) => /partial run: 1 of 2 journeys were reviewed \(pay-invoice\)/.test(w)).length, 1);
  assert.match(status().next.join(' '), /Scored and up to date/);
  assert.match(uxq(['trend', '--config', t.configFile]).stdout, /some journeys only/);
  let p = progress();
  assert.deepStrictEqual([p.journeys_at_target, p.not_reviewed, p.next_journey, p.target_met, p.last_full_run], [1, 1, 'read-notice', false, null]);

  // A later round of the same journey that falls short: below target, with the roles below named, and next again.
  const second = json(uxq(['new-run', '--config', t.configFile, '--commit', 'def5678', '--date', '2026-03-02']));
  writeEvidence(path.join(second.run_dir, 'evidence', 'pay-invoice'), second.capture['pay-invoice']);
  for (const b of json(uxq(['bundle', '--config', t.configFile, '--run', second.run_dir, '--unit', 'pay-invoice', '--tmp', t.tmp]))) write(b, b.role === 'visual' || b.role === 'user' ? 80 : 95);
  uxq(['collect', '--config', t.configFile, '--run', second.run_dir]);
  uxq(['score', '--config', t.configFile, '--run', second.run_dir]);
  p = progress();
  const pay = p.journeys.find((j) => j.journey === 'pay-invoice');
  assert.deepStrictEqual([pay.state, pay.rounds, p.next_journey], ['below target', 2, 'pay-invoice']);
  assert.deepStrictEqual(pay.below, [{ role: 'visual', score: 80 }, { role: 'user', score: 80 }]);
  assert.strictEqual(pay.last_gain, -5, 'overall from 95 to (95 x 4 + 80 x 2) / 6 = 90');
  assert.match(p.then, /Work on pay-invoice \(visual at 80, user at 80\)/);

  // A third round that gains nothing: two flat rounds in a row, so the journey has stalled. It is not
  // given up: the untouched journey comes first, then the stalled one is next again, for a different approach.
  const round = (date, unit, score) => {
    const r = json(uxq(['new-run', '--config', t.configFile, '--commit', `c${date}`, '--date', `2026-03-${date}`]));
    writeEvidence(path.join(r.run_dir, 'evidence', unit), r.capture[unit]);
    for (const b of json(uxq(['bundle', '--config', t.configFile, '--run', r.run_dir, '--unit', unit, '--tmp', t.tmp]))) write(b, score(b));
    uxq(['collect', '--config', t.configFile, '--run', r.run_dir]);
    uxq(['score', '--config', t.configFile, '--run', r.run_dir]);
  };
  round('03', 'pay-invoice', (b) => (b.role === 'visual' || b.role === 'user' ? 80 : 95));
  p = progress();
  assert.deepStrictEqual([p.journeys.find((j) => j.journey === 'pay-invoice').state, p.next_journey, p.plateau], ['stalled', 'read-notice', false]);
  assert.match(p.then, /Review read-notice: it has not been reviewed yet/);
  round('04', 'read-notice', () => 95);
  p = progress();
  assert.deepStrictEqual([p.journeys.find((j) => j.journey === 'read-notice').state, p.next_journey, p.target_met], ['at target', 'pay-invoice', false]);
  // Nothing but a stalled journey is left: more of the same is not tried. The user is asked.
  assert.strictEqual(p.plateau, true);
  assert.match(p.then, /^Stop and ask the user: only stalled journeys are left below target; pay-invoice has waited longest \(visual at 80, user at 80\): two reviews in a row gained under 2 points\..*accept the scores as they stand; try a different approach.*lower the target.*Record the answer in improve\.md/);
  assert.match(p.target_in_issue_terms, /^For every role of every journey, 90 or more means roughly: .*only polish is left\.$/);
  assert.match(json(uxq(['progress', '--config', t.configFile, '--target', '80'])).target_in_issue_terms, /none leaves more than three minor issues/);
  // What stands in the journey is carried with its scores: here one minor problem, reported by the visual reviewers and the people.
  assert.deepStrictEqual(p.journeys.find((j) => j.journey === 'pay-invoice').standing.major, 0);
  assert.ok(p.journeys.find((j) => j.journey === 'pay-invoice').standing.minor >= 1);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('a reviewer with no usable result is discarded and replaced, never asked again', () => {
  const t = setup();
  const created = json(uxq(['new-run', '--config', t.configFile, '--commit', 'abc1234', '--date', '2026-03-01']));
  writeEvidence(path.join(created.run_dir, 'evidence', 'read-notice'), created.capture['read-notice']);
  const args = ['--config', t.configFile, '--run', created.run_dir];
  const first = json(uxq(['bundle', ...args, '--unit', 'read-notice', '--role', 'user', '--tmp', t.tmp]));
  assert.deepStrictEqual(first.map((b) => [b.role, b.judge]), [['user', 1], ['user', 2]]);
  const silent = first[1];
  fs.writeFileSync(path.join(first[0].dir, 'judgment.json'), JSON.stringify(owed(easy(2), 'user')));
  const report = json(uxq(['collect', ...args, '--discard-bad']));
  assert.deepStrictEqual(report.filter((r) => r.status === 'discarded').map((r) => [r.unit, r.role, r.judge]), [['read-notice', 'user', 2]]);
  assert.ok(!fs.existsSync(silent.dir) && !fs.existsSync(path.dirname(silent.dir)), 'a discarded folder is removed with its parent');
  const topUp = json(uxq(['bundle', ...args, '--unit', 'read-notice', '--role', 'user', '--tmp', t.tmp]));
  assert.deepStrictEqual(topUp.map((b) => [b.unit, b.judge]), [['read-notice', 3]]);
  fs.writeFileSync(path.join(topUp[0].dir, 'judgment.json'), JSON.stringify(owed(easy(2), 'user')));
  uxq(['collect', ...args]);
  // A reviewer can always be added beyond the configured number, under the next free number.
  const extra = json(uxq(['bundle', ...args, '--unit', 'read-notice', '--role', 'user', '--judges', '1', '--tmp', t.tmp]));
  assert.deepStrictEqual(extra.map((b) => b.judge), [4]);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('a loop to a target: a disagreement is fixed like any shortfall, and the target is met only by a full run where every role is at target and agreed', () => {
  const t = setup();
  writeEvidence(path.join(t.home, 'controls', 'control-form'), ['screens/01-form.phone.png']);
  const P = 'screens/02-pay.phone.png';
  const F = 'screens/01-form.phone.png';
  // One full run; `interaction2` is what the second interaction reviewer of pay-invoice reports.
  const fullRun = (date, interaction2) => {
    const r = json(uxq(['new-run', '--config', t.configFile, '--commit', `c${date}`, '--date', `2026-04-${date}`]));
    for (const [unit, files] of Object.entries(r.capture)) writeEvidence(path.join(r.run_dir, 'evidence', unit), files);
    for (const b of json(uxq(['bundle', '--config', t.configFile, '--run', r.run_dir, '--tmp', t.tmp]))) {
      let data;
      if (b.unit === 'control-form') data = b.role === 'user' ? person([['hesitated', [['U2', 'Odd word on the button.']]]], 'sure', 70) : spec(60, [issue('A1', 'major', 'The heading is too faint.', F, { step: '01-form' })]);
      else if (b.role === 'user') data = easy(2);
      else if (b.unit === 'pay-invoice' && b.role === 'interaction' && b.judge === 2) data = interaction2;
      else data = spec(95);
      fs.writeFileSync(path.join(b.dir, 'judgment.json'), JSON.stringify(owed(data, b.role)));
    }
    uxq(['collect', '--config', t.configFile, '--run', r.run_dir]);
    return json(uxq(['score', '--config', t.configFile, '--run', r.run_dir]));
  };
  // The two interaction reviewers of pay-invoice are 35 apart: 95 and 60.
  const first = fullRun('01', spec(60, [issue('I2', 'major', 'Nothing confirms the payment.', P, { step: '02-pay', fix: 'Show a receipt with the amount and date.' })]));
  assert.deepStrictEqual([first.reliable, first.too_harsh, first.contested.map((c) => c.role)], [true, false, ['interaction']]);

  // Even against 60, which the average of 77.5 clears, the disagreement means the journey is not done:
  // what the dissenting reviewer reported is fixed, and the journey reviewed again with fresh reviewers.
  let p = json(uxq(['progress', '--config', t.configFile, '--target', '60']));
  const pay = () => p.journeys.find((j) => j.journey === 'pay-invoice');
  assert.deepStrictEqual([pay().state, pay().below, pay().disputed, p.target_met, p.last_full_run.every_role_at_target, p.last_full_run.reviewers_agree], ['below target', [], ['interaction'], false, true, false]);
  assert.match(p.then, /Work on pay-invoice \(interaction reviewers disagree\): fix the top of its fix order, commit, and review it again in a new run with fresh reviewers/);
  // Against 90 the same run is short on interaction, and says so.
  p = json(uxq(['progress', '--config', t.configFile, '--target', '90']));
  assert.deepStrictEqual([pay().state, pay().below, p.target_met], ['below target', [{ role: 'interaction', score: 77.5 }], false]);
  assert.match(p.then, /Work on pay-invoice \(interaction at 77\.5\)/);

  // After the fix, a full run with fresh reviewers: every role at 95, agreed, controls caught. Met.
  const second = fullRun('02', spec(95));
  assert.deepStrictEqual(second.contested, []);
  p = json(uxq(['progress', '--config', t.configFile, '--target', '90']));
  assert.deepStrictEqual([pay().state, p.last_full_run.every_role_at_target, p.last_full_run.reviewers_agree, p.target_met], ['at target', true, true, true]);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('screening runs start one reviewer per role and skip the controls; under floor a role is held to the lowest ceiling among its reviewers; only a confirming run meets the target', () => {
  const t = setup();
  fs.writeFileSync(t.configFile, JSON.stringify({ ...t.config, screening_judges: 1, combine: 'floor' }, null, 2));
  writeEvidence(path.join(t.home, 'controls', 'control-form'), ['screens/01-form.phone.png']);
  const F = 'screens/01-form.phone.png';
  const run = (date, confirm, scoreOf) => {
    const r = json(uxq(['new-run', '--config', t.configFile, '--commit', `c${date}`, '--date', `2026-05-${date}`, ...(confirm ? ['--confirm'] : [])]));
    for (const [unit, files] of Object.entries(r.capture)) writeEvidence(path.join(r.run_dir, 'evidence', unit), files);
    const bundles = json(uxq(['bundle', '--config', t.configFile, '--run', r.run_dir, '--tmp', t.tmp]));
    for (const b of bundles) {
      let data;
      if (b.unit === 'control-form') data = b.role === 'user' ? person([['hesitated', [['U2', 'Odd word on the button.']]]], 'sure', 70) : spec(60, [issue('A1', 'major', 'The heading is too faint.', F, { step: '01-form' })]);
      else if (b.role === 'user') data = easy(2, scoreOf(b));
      else data = spec(scoreOf(b), scoreOf(b) < 80 ? [issue(rubric.roles[b.role].ids[1], 'major', 'The amount owed is given two different ways.', 'screens/01-open.phone.png', { step: '01-open' })]
        : scoreOf(b) < 90 ? [issue(rubric.roles[b.role].ids[2], 'minor', 'Edges do not line up.', 'screens/01-open.phone.png', { step: '01-open' })] : []);
      fs.writeFileSync(path.join(b.dir, 'judgment.json'), JSON.stringify(owed(data, b.role)));
    }
    uxq(['collect', '--config', t.configFile, '--run', r.run_dir]);
    return { r, bundles, card: json(uxq(['score', '--config', t.configFile, '--run', r.run_dir])) };
  };
  // Screening: one reviewer per role, journeys only (pay-invoice 6 roles, read-notice 2), no control unit.
  const s = run('01', false, () => 92);
  assert.deepStrictEqual([s.r.mode, s.r.reviewers_per_full_run, s.r.reviewers_per_screening_run, s.r.reviewers_per_confirming_run], ['screen', 8, 8, 20]);
  assert.strictEqual(s.bundles.length, 8);
  assert.ok(!s.bundles.some((b) => b.unit === 'control-form'));
  assert.ok(s.card.warnings.some((w) => /screening run/.test(w)));
  let p = json(uxq(['progress', '--config', t.configFile, '--target', '90']));
  assert.deepStrictEqual([p.journeys_at_target, p.target_met, p.last_full_run], [2, false, null]);
  assert.match(p.then, /confirming run/);
  // Confirming: two per role plus the controls. The second visual reviewer gives 80 for a minor issue: no
  // ceiling is set, so visual is the average, (95 + 80) / 2. The second content reviewer gives 78 for a
  // major: counted 74, and content is held to that ceiling instead of the average of 84.5.
  const c = run('02', true, (b) => (b.unit !== 'pay-invoice' ? 95 : b.role === 'visual' && b.judge === 2 ? 80 : b.role === 'content' && b.judge === 2 ? 78 : 95));
  assert.strictEqual(c.bundles.length, 20);
  const card = JSON.parse(fs.readFileSync(path.join(c.r.run_dir, 'scorecard.json'), 'utf8'));
  const roles = card.units.find((u) => u.id === 'pay-invoice').roles;
  assert.deepStrictEqual([card.mode, card.combine, roles.visual.score, roles.visual.held_to, roles.content.raw, roles.content.score, roles.content.held_to], ['confirm', 'floor', 87.5, undefined, [95, 74], 74, 74]);
  assert.match(fs.readFileSync(path.join(c.r.run_dir, 'scorecard.md'), 'utf8'), /74 \(held\)/);
  p = json(uxq(['progress', '--config', t.configFile, '--target', '80']));
  assert.deepStrictEqual([p.target_met, p.last_full_run.every_role_at_target], [false, false]);
  assert.deepStrictEqual(p.journeys.find((j) => j.journey === 'pay-invoice').below, [{ role: 'content', score: 74 }]);
  p = json(uxq(['progress', '--config', t.configFile, '--target', '74']));
  assert.strictEqual(p.target_met, true);
  // No target, no progress: the target is the user's to choose.
  const none = uxq(['progress', '--config', t.configFile], { allowFail: true });
  assert.notStrictEqual(none.status, 0);
  assert.match(none.stderr + none.stdout, /--target <N> is required: ask the user/);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('control entries must name a role the unit has, and nothing can be both planted and clean', () => {
  const t = setup();
  const control = t.config.units.find((u) => u.control);
  control.clean = [{ id: 'faint-fine', role: 'accessibility', criterion: 'A1', step: '01-form' }];
  fs.writeFileSync(t.configFile, JSON.stringify(t.config));
  assert.match(uxq(['new-run', '--config', t.configFile], { allowFail: true }).stderr, /cannot be both planted and clean/);
  control.clean = [{ id: 'not-reviewed', role: 'visual', criterion: 'V1' }];
  fs.writeFileSync(t.configFile, JSON.stringify(t.config));
  assert.match(uxq(['new-run', '--config', t.configFile], { allowFail: true }).stderr, /needs a "role" the unit is reviewed by/);
  control.clean = [{ id: 'wrong-rubric', role: 'accessibility', criterion: 'V1' }];
  fs.writeFileSync(t.configFile, JSON.stringify(t.config));
  assert.match(uxq(['new-run', '--config', t.configFile], { allowFail: true }).stderr, /V1 is not a criterion of the accessibility rubric/);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('the shipped example config is valid', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxq-example-'));
  fs.copyFileSync(path.join(__dirname, '..', 'assets', 'config.example.json'), path.join(root, 'config.json'));
  const out = JSON.parse(execFileSync(process.execPath, [UXQ, 'new-run', '--config', path.join(root, 'config.json'), '--commit', 'x', '--date', '2026-01-01'], { encoding: 'utf8' }));
  assert.ok(Object.keys(out.capture).length >= 2);
  assert.ok(out.controls_missing, 'the example includes a control unit');
  assert.strictEqual(out.reviewers_per_full_run, 36);
  fs.rmSync(root, { recursive: true, force: true });
});

test('each specialist is handed the evidence its role can judge and the project\'s recorded decisions; a person is handed neither', () => {
  const t = setup();
  const decisions = path.join(t.home, 'design-decisions.md');
  fs.writeFileSync(decisions, '# Design decisions\n\n## Style\n\nDense tables, one accent colour.\n\n## Decisions\n\n### D-001 Tables stay dense\n\nRows are 32 px tall.\n\n### D-002 One accent colour\n\nGreen is the only accent.\n');
  fs.writeFileSync(t.configFile, JSON.stringify({ ...t.config, decisions: 'design-decisions.md' }));
  const created = json(uxq(['new-run', '--config', t.configFile, '--commit', 'abc1234', '--date', '2026-06-01']));
  assert.match(created.decisions, /copied into the run/);
  const meta = JSON.parse(fs.readFileSync(path.join(created.run_dir, 'run.json'), 'utf8'));
  assert.match(meta.decisions_sha, /^[0-9a-f]{12}$/);
  // The run keeps the file as it was when the run was opened, whatever the project's copy becomes.
  fs.appendFileSync(decisions, '\n### D-003 Added later\n\nNot in this run.\n');
  const probes = ['keyboard/01-open.phone.json', 'states/01-open.phone.json', 'states/01-open.phone.c1.hover.png', 'motion/01-open.phone.json', 'frames/01-open.phone.json', 'frames/01-open.phone.f01.png'];
  writeEvidence(path.join(created.run_dir, 'evidence', 'pay-invoice'), [...created.capture['pay-invoice'], ...probes]);
  const bundles = json(uxq(['bundle', '--config', t.configFile, '--run', created.run_dir, '--unit', 'pay-invoice', '--tmp', t.tmp]));
  assert.strictEqual(bundles.length, 12);
  const handed = { accessibility: ['keyboard', 'motion', 'states'], visual: ['frames', 'motion', 'states'], interaction: ['frames', 'keyboard', 'motion', 'states'], content: [], responsive: [], user: [] };
  for (const b of bundles) {
    const listing = fs.readdirSync(b.dir);
    assert.deepStrictEqual(['frames', 'keyboard', 'motion', 'states'].filter((k) => listing.includes(k)), handed[b.role], `${b.role} gets what it can judge`);
    assert.deepStrictEqual(handed[b.role], ['frames', 'keyboard', 'motion', 'states'].filter((k) => (EVIDENCE_KINDS[b.role] || []).includes(k)));
    if (b.role === 'user') { assert.ok(!listing.includes('decisions.md'), 'a person is not told what the project decided'); continue; }
    const shown = fs.readFileSync(path.join(b.dir, 'decisions.md'), 'utf8');
    assert.ok(shown.includes('D-002') && !shown.includes('D-003'));
    if (handed[b.role].includes('states')) assert.deepStrictEqual(fs.readdirSync(path.join(b.dir, 'states')).sort(), ['01-open.phone.c1.hover.png', '01-open.phone.json']);
  }
  // A changed decisions file does not make an open run unusable: the file is not part of what makes runs
  // comparable. The next run is handed the new file, is compared with the last, and says the file changed.
  assert.strictEqual(json(uxq(['status', '--config', t.configFile, '--run', created.run_dir])).next.some((n) => /different yardstick/.test(n)), false);
  const finish = (runDir, list) => {
    for (const b of list) fs.writeFileSync(path.join(b.dir, 'judgment.json'), JSON.stringify(owed(b.role === 'user' ? easy(2) : spec(95), b.role)));
    uxq(['collect', '--config', t.configFile, '--run', runDir]);
    return json(uxq(['score', '--config', t.configFile, '--run', runDir]));
  };
  assert.ok(!finish(created.run_dir, bundles).warnings.some((w) => /design decisions/.test(w)));
  assert.match(fs.readFileSync(path.join(created.run_dir, 'scorecard.md'), 'utf8'), /handed the project's design decisions \(`[0-9a-f]{12}`, 2 recorded decision\(s\)\)/);
  const later = json(uxq(['new-run', '--config', t.configFile, '--commit', 'def5678', '--date', '2026-06-02']));
  writeEvidence(path.join(later.run_dir, 'evidence', 'pay-invoice'), later.capture['pay-invoice']);
  const again = finish(later.run_dir, json(uxq(['bundle', '--config', t.configFile, '--run', later.run_dir, '--unit', 'pay-invoice', '--tmp', t.tmp])));
  assert.strictEqual(again.warnings.filter((w) => /the design decisions handed to the specialists changed since run 20260601-abc1234/.test(w)).length, 1);
  fs.writeFileSync(t.configFile, JSON.stringify({ ...t.config, decisions: 'nowhere.md' }));
  assert.match(uxq(['new-run', '--config', t.configFile], { allowFail: true }).stderr, /decisions: must be the path of a file that exists/);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('the scorecard counts the decisions only where the file numbers them', () => {
  assert.strictEqual(numberedDecisions('# Design decisions\n\n## Decisions\n\n### D-001 Tables stay dense\n\nRows are 32 px tall.\n\n### D-002 One accent\n'), 2);
  // Any markdown file may record the decisions. One that keeps them as a list has no count to give, and
  // the scorecard must not say that none were recorded.
  assert.strictEqual(numberedDecisions('# Design decisions\n\n## Colour\n\n- **Gold in the light theme only.** Chosen on purpose.\n\n## Naming\n\n- **"Requests", not "Tickets".**\n'), null);
});

test('a verdict on a second look must say whether the claim holds and how serious it is', () => {
  assert.deepStrictEqual(validateVerdict({ holds: 'yes', severity: 'major', reason: 'The file shows it.' }), []);
  assert.deepStrictEqual(validateVerdict({ holds: 'partly', severity: 'minor', reason: 'It is there, and it costs less.' }), []);
  assert.deepStrictEqual(validateVerdict({ holds: 'no', severity: 'none', reason: 'No file shows it.' }), []);
  assert.match(validateVerdict({ holds: 'no', severity: 'minor', reason: 'r' }).join(';'), /severity is "none" when, and only when, holds is "no"/);
  assert.match(validateVerdict({ holds: 'yes', severity: 'none', reason: 'r' }).join(';'), /severity is "none" when, and only when, holds is "no"/);
  assert.match(validateVerdict({ holds: 'maybe', severity: 'major', reason: 'r' }).join(';'), /holds must be one of yes, partly, no/);
  assert.match(validateVerdict({ holds: 'yes', severity: 'major' }).join(';'), /reason is required/);
  assert.match(validateVerdict([]).join(';'), /not a JSON object/);
  // A second look keeps an issue or lowers it. It never raises one, and a score is counted again only when
  // the reviewer's most serious issue changed.
  const unit = { id: 'u' };
  const P = 'screens/02-pay.phone.png';
  const j = { role: 'visual', judge: 2, data: spec(60, [issue('V7', 'major', 'Cut off.', P), issue('V3', 'minor', 'Off the grid.', P)]) };
  const look = (severity, holds = 'yes') => reviewerResult(unit, j, { 'u.visual2.i1': { holds, severity, reason: 'r' } });
  const raised = look('blocker');
  assert.deepStrictEqual([raised.issues[0].severity, raised.counted, raised.rebased], ['major', 60, null]);
  const lowered = look('minor', 'partly');
  assert.deepStrictEqual([lowered.issues[0].severity, lowered.issues[0].reported, lowered.counted, lowered.ceiling], ['minor', 'major', REBASE.two_or_three_minors, 100]);
  assert.match(lowered.rebased.because, /its most serious issue was a major; after a second look the most serious left is a minor/);
  const gone = look('none', 'no');
  assert.deepStrictEqual([gone.issues.length, gone.refuted.length, gone.counted], [1, 1, REBASE.one_minor]);
  // A reviewer who already scored above the anchor keeps its own score.
  const kind = reviewerResult(unit, { role: 'visual', judge: 1, data: spec(92, [issue('V7', 'major', 'Cut off.', P)]) }, { 'u.visual1.i1': { holds: 'no', severity: 'none', reason: 'r' } });
  assert.deepStrictEqual([kind.given, kind.counted], [92, 92]);
});

test('a serious issue one reviewer alone reported is checked by a fresh specialist before it holds a score down', () => {
  const t = setup();
  const created = json(uxq(['new-run', '--config', t.configFile, '--commit', 'abc1234', '--date', '2026-07-01']));
  const runDir = created.run_dir;
  const args = ['--config', t.configFile, '--run', runDir];
  writeEvidence(path.join(runDir, 'evidence', 'pay-invoice'), [...created.capture['pay-invoice'], 'keyboard/02-pay.phone.json']);
  const P = 'screens/02-pay.phone.png';
  const same = issue('I7', 'major', 'Removing a saved card asks no question and offers no way back.', P, { step: '02-pay' });
  const reports = {
    'visual.2': spec(70, [issue('V7', 'major', 'The total owed is cut off at the right edge of its box.', P, { step: '02-pay', size: 'phone', impact: 'The person cannot read what they owe.' }), issue('V3', 'minor', 'The caption sits off the grid of the form.', P)]),
    'accessibility.1': spec(20, [issue('A4', 'blocker', 'No control shows where the keyboard focus is.', 'keyboard/02-pay.phone.json', { step: '02-pay' })]),
    'content.1': spec(70, [issue('C5', 'major', 'A raw database message is printed under the heading.', P, { step: '02-pay' })]),
    'interaction.1': spec(60, [same]),
    'interaction.2': spec(62, [same])
  };
  for (const b of json(uxq(['bundle', ...args, '--unit', 'pay-invoice', '--tmp', t.tmp]))) {
    const data = reports[`${b.role}.${b.judge}`] || (b.role === 'user' ? easy(2) : spec(95));
    fs.writeFileSync(path.join(b.dir, 'judgment.json'), JSON.stringify(owed(data, b.role)));
  }
  uxq(['collect', ...args]);
  const status = () => json(uxq(['status', ...args]));
  const lone = ['pay-invoice.accessibility1.i1', 'pay-invoice.content1.i1', 'pay-invoice.visual2.i1'];
  // What two reviewers both reported needs no second look; what one alone reported does.
  assert.deepStrictEqual(status().second_looks.still_to_start, lone);
  assert.match(status().next.join(' '), /Every result is in, and 3 major or blocker issue\(s\) rest on one reviewer's word: run challenge/);
  const before = json(uxq(['score', ...args]));
  assert.deepStrictEqual([before.unchecked, before.role_scores.visual, before.role_scores.content], [lone, 82.5, 82.5]);
  assert.ok(before.warnings.some((w) => /3 major or blocker issue\(s\) were reported by one reviewer only and have not been given a second look/.test(w)));
  assert.match(status().next.join(' '), /Scored, but 3 major or blocker issue\(s\).*run score --rescore/);

  const checks = json(uxq(['challenge', ...args, '--tmp', t.tmp]));
  assert.deepStrictEqual(checks.map((c) => [c.issue, c.role, c.severity]), [[lone[0], 'accessibility', 'blocker'], [lone[1], 'content', 'major'], [lone[2], 'visual', 'major']]);
  assert.strictEqual(new Set(checks.map((c) => path.dirname(c.dir))).size, 3);
  for (const c of checks) {
    assert.strictEqual(c.prompt, spawnPrompt(c.dir));
    const listing = fs.readdirSync(c.dir).sort();
    assert.deepStrictEqual(listing, c.role === 'accessibility' ? ['README.md', 'claim.md', 'journey.md', 'keyboard', 'rubric.md', 'screens'] : ['README.md', 'claim.md', 'journey.md', 'rubric.md', 'screens']);
    const shown = readAllMarkdown(c.dir);
    // The folder says what is claimed, and nothing of who claimed it, what it scored, or what else was reported.
    for (const word of [...FORBIDDEN, created.run_id, 'pay-invoice', 'judgment', 'reviewer 1', 'reviewer 2']) assert.ok(!new RegExp(`\\b${word}\\b`).test(shown), `a second look must not contain "${word}"`);
    assert.ok(!shown.includes('{{'), 'no unfilled placeholders');
    assert.match(shown, /verdict\.json/);
    assert.strictEqual(fs.readFileSync(path.join(c.dir, 'rubric.md'), 'utf8'), fs.readFileSync(rubric.roles[c.role].file, 'utf8'));
  }
  const claim = fs.readFileSync(path.join(checks[2].dir, 'claim.md'), 'utf8');
  for (const want of [/`V7`/, /Severity claimed \| `major`/, /`02-pay`/, /`phone`/, /The total owed is cut off at the right edge of its box\./, /The person cannot read what they owe\./, /`screens\/02-pay\.phone\.png`/]) assert.match(claim, want);
  assert.ok(!/70|caption/.test(claim), 'the claim carries neither the score nor the other issues');
  // Asking again starts nothing new while the folders are out.
  assert.deepStrictEqual(json(uxq(['challenge', ...args, '--tmp', t.tmp])), []);
  assert.deepStrictEqual([status().second_looks.still_to_start, status().second_looks.waiting.length], [[], 3]);

  const verdict = (c, v) => fs.writeFileSync(path.join(c.dir, 'verdict.json'), JSON.stringify(v));
  verdict(checks[0], { holds: 'yes', severity: 'blocker', reason: 'The keyboard walk shows no stop with a visible sign of focus.' });
  verdict(checks[1], { holds: 'no', severity: 'minor', reason: 'The text under the heading is a sentence in plain words.' });
  verdict(checks[2], { holds: 'partly', severity: 'minor', reason: 'One character of the total is clipped; the amount can still be read.' });
  const bad = uxq(['collect', ...args], { allowFail: true });
  assert.strictEqual(bad.status, 2);
  assert.deepStrictEqual(json(bad).filter((r) => r.status === 'invalid').map((r) => [r.check, r.errors[0]]), [[lone[1], 'severity is "none" when, and only when, holds is "no"']]);
  verdict(checks[1], { holds: 'no', severity: 'none', reason: 'The text under the heading is a sentence in plain words.' });
  uxq(['collect', ...args]);
  assert.ok(checks.every((c) => !fs.existsSync(c.dir)), 'a collected second look leaves no folder');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(runDir, 'checks', `${lone[2]}.json`), 'utf8')), { issue: lone[2], unit: 'pay-invoice', role: 'visual', reported: 'major', holds: 'partly', severity: 'minor', reason: 'One character of the total is clipped; the amount can still be read.' });
  assert.match(status().next.join(' '), /Every result is in: run score\./);

  // The blocker stands and still holds its reviewer at 20. The visual major became a minor beside another
  // minor: that reviewer counts 80, not 70. The content major was not upheld: with only polish left its
  // reviewer would count 90, but nothing is left at all, so the anchor is the same 90.
  const after = json(uxq(['score', ...args, '--rescore']));
  assert.deepStrictEqual(after.unchecked, []);
  assert.deepStrictEqual(after.second_looks, [
    { id: lone[0], reported: 'blocker', outcome: 'upheld', severity: 'blocker' },
    { id: lone[2], reported: 'major', outcome: 'lowered', severity: 'minor' },
    { id: lone[1], reported: 'major', outcome: 'not upheld', severity: 'none' }]);
  assert.deepStrictEqual(after.rebased.map((r) => [r.role, r.judge, r.given, r.from, r.counted]), [['visual', 2, 70, 70, 80], ['content', 1, 70, 70, 90]]);
  assert.deepStrictEqual([after.role_scores.accessibility, after.role_scores.visual, after.role_scores.content, after.role_scores.interaction], [57.5, 87.5, 92.5, 61]);
  assert.ok(!after.warnings.some((w) => /second look/.test(w)));
  const card = JSON.parse(fs.readFileSync(path.join(runDir, 'scorecard.json'), 'utf8'));
  assert.deepStrictEqual(card.issue_counts.major, 2, 'the two interaction reports; the lowered and the refuted majors are gone');
  assert.ok(!card.issues.some((f) => f.id === lone[1]), 'an issue not upheld is not in the fix order');
  assert.deepStrictEqual(card.units.find((u) => u.id === 'pay-invoice').standing, { blocker: 1, major: 1, minor: 2, polish: card.units.find((u) => u.id === 'pay-invoice').standing.polish });
  const md = fs.readFileSync(path.join(runDir, 'scorecard.md'), 'utf8');
  for (const want of [/## What stands in each journey/, /## Issues given a second look/, /## Scores counted again after a second look/, /80 \(gave 70\)/]) assert.match(md, want);
  const findings = fs.readFileSync(path.join(runDir, 'findings.md'), 'utf8');
  for (const want of [/## Not upheld on a second look \(1\)/, /Second look:/, /A raw database message is printed under the heading\./]) assert.match(findings, want);
  const lines = fs.readFileSync(path.join(t.home, 'ledger.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepStrictEqual([lines.length, lines[1].rescore, lines[1].second_looks, lines[1].unchecked, lines[0].unchecked], [2, true, { upheld: 1, lowered: 1, 'not upheld': 1 }, 0, 3]);
  assert.deepStrictEqual(lines[1].unit_scores[0].standing, card.units.find((u) => u.id === 'pay-invoice').standing);
  // A second look whose agent never answered is discarded and started again in a new folder.
  const next = json(uxq(['new-run', '--config', t.configFile, '--commit', 'def5678', '--date', '2026-07-02']));
  const nargs = ['--config', t.configFile, '--run', next.run_dir];
  writeEvidence(path.join(next.run_dir, 'evidence', 'read-notice'), next.capture['read-notice']);
  for (const b of json(uxq(['bundle', ...nargs, '--unit', 'read-notice', '--tmp', t.tmp]))) {
    const data = b.role === 'user' ? easy(2) : b.judge === 1 ? spec(70, [issue('C3', 'major', 'The notice says it was sent when it was not.', 'screens/02-read.phone.png', { step: '02-read' })]) : spec(95);
    fs.writeFileSync(path.join(b.dir, 'judgment.json'), JSON.stringify(owed(data, b.role)));
  }
  uxq(['collect', ...nargs]);
  const [silent] = json(uxq(['challenge', ...nargs, '--tmp', t.tmp]));
  assert.deepStrictEqual(json(uxq(['collect', ...nargs, '--discard-bad'])).filter((r) => r.status === 'discarded').map((r) => r.check), ['read-notice.content1.i1']);
  assert.ok(!fs.existsSync(silent.dir));
  const [replacement] = json(uxq(['challenge', ...nargs, '--unit', 'read-notice', '--tmp', t.tmp]));
  assert.ok(replacement.issue === 'read-notice.content1.i1' && replacement.dir !== silent.dir);
  assert.match(uxq(['challenge', ...nargs, '--unit', 'control-form'], { allowFail: true }).stderr, /no such journey: control-form/);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('what the capture measured worse than last time is reported before any reviewer is started', () => {
  const t = setup();
  const facts = (over = {}) => ({
    layout: { scrolls_sideways: false, overflowing_elements: { count: 0, examples: [] }, ...(over.layout || {}) },
    targets: { smaller_than_24px: { count: 2, examples: [] }, ...(over.targets || {}) },
    labels: { fields_without_label: { count: 1, examples: [] }, controls_without_name: { count: 0, examples: [] }, images_without_alt: { count: 0, examples: [] } },
    text: { below_required_contrast: { count: 3, examples: [] }, smaller_than_12px: { count: 0, examples: [] }, ...(over.text || {}) },
    structure: { skipped_heading_levels: [], h1_count: 1, has_main_landmark: true, open_dialogs: [], ...(over.structure || {}) }
  });
  const keyboard = (n) => ({ how_to_read: 'x', summary: { stops: 9, nothing_shows_focus: { count: n, examples: [] }, never_reached: { count: 0, examples: [] }, focus_covered_by_something_else: { count: 0, examples: [] } }, stops: [] });
  const motion = (n) => ({ how_to_read: 'x', with_reduced_motion: { elements_that_can_still_move: { count: n, examples: [] } } });
  const put = (runDir, unit, rel, data) => { const f = path.join(runDir, 'evidence', unit, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data)); };
  const open = (date) => json(uxq(['new-run', '--config', t.configFile, '--commit', `c${date}`, '--date', `2026-08-${date}`])).run_dir;
  const regress = (runDir, extra = []) => uxq(['regress', '--config', t.configFile, '--run', runDir, ...extra], { allowFail: true });

  const first = open('01');
  put(first, 'pay-invoice', 'facts/01-open.phone.json', facts());
  put(first, 'pay-invoice', 'keyboard/01-open.phone.json', keyboard(1));
  put(first, 'pay-invoice', 'motion/01-open.phone.json', motion(0));
  // Nothing earlier to compare with: said, and not a failure.
  const alone = regress(first);
  assert.strictEqual(alone.status, 0);
  assert.deepStrictEqual(json(alone).not_compared, [{ unit: 'pay-invoice', why: 'no earlier run holds measurements for it' }, { unit: 'read-notice', why: 'this run holds no measurements for it' }]);

  // A run of another journey in between holds nothing for this one and is passed over.
  const between = open('02');
  put(between, 'read-notice', 'facts/01-open.phone.json', facts());
  // The fix put the contrast right and the focus right, and broke three other things.
  const second = open('03');
  put(second, 'pay-invoice', 'facts/01-open.phone.json', facts({ layout: { scrolls_sideways: true, overflowing_elements: { count: 2, examples: [] } }, text: { below_required_contrast: { count: 0, examples: [] }, smaller_than_12px: { count: 0, examples: [] } }, structure: { skipped_heading_levels: [], h1_count: 1, has_main_landmark: false, open_dialogs: [] } }));
  put(second, 'pay-invoice', 'facts/02-pay.phone.json', facts());
  put(second, 'pay-invoice', 'keyboard/01-open.phone.json', keyboard(0));
  put(second, 'pay-invoice', 'motion/01-open.phone.json', motion(0));
  const r = regress(second);
  assert.strictEqual(r.status, 2, 'a rise is a failure for a script that calls this');
  const out = json(r);
  assert.deepStrictEqual(out.against, { 'pay-invoice': path.basename(first) });
  const row = (x) => [x.step, x.size, x.what, x.before, x.after];
  assert.deepStrictEqual(out.regressions.map(row), [
    ['01-open', 'phone', 'the page scrolls sideways', 0, 1],
    ['01-open', 'phone', 'elements wider than the page', 0, 2],
    ['01-open', 'phone', 'no main landmark', 0, 1]]);
  assert.deepStrictEqual(out.fixed.map(row), [
    ['01-open', 'phone', 'text below the required contrast', 3, 0],
    ['01-open', 'phone', 'keyboard stops that show no focus', 1, 0]]);
  assert.deepStrictEqual(out.not_compared, [{ unit: 'pay-invoice', step: '02-pay', size: 'phone', why: 'not in the earlier capture' }, { unit: 'read-notice', why: 'this run holds no measurements for it' }]);
  // Compared with itself, or with a named run, nothing rises.
  const same = regress(second, ['--against', second, '--unit', 'pay-invoice']);
  assert.deepStrictEqual([same.status, json(same).regressions, json(same).fixed], [0, [], []]);
  // The newer run is never what an older one is compared with.
  assert.deepStrictEqual(json(regress(first)).against, {});
  // Text left unfinished and links that lead nowhere are counted too. A capture made before they were
  // measured holds no number for them, and that is not held against the page.
  const loose = (unfilled, nowhere) => ({ ...facts({ text: { below_required_contrast: { count: 0, examples: [] }, smaller_than_12px: { count: 0, examples: [] }, never_filled_in: { count: unfilled, examples: [] } } }), links: { count: 5, lead_nowhere: { count: nowhere, examples: [] } } });
  const third = open('04');
  put(third, 'pay-invoice', 'facts/01-open.phone.json', loose(1, 0));
  const newly = json(regress(third));
  assert.ok(![...newly.regressions, ...newly.fixed].some((x) => /never filled in|lead nowhere/.test(x.what)));
  const fourth = open('05');
  put(fourth, 'pay-invoice', 'facts/01-open.phone.json', loose(0, 2));
  const counted = json(regress(fourth));
  assert.deepStrictEqual([counted.regressions.map(row), counted.fixed.map(row)], [[['01-open', 'phone', 'links that lead nowhere', 0, 2]], [['01-open', 'phone', 'text that was never filled in', 1, 0]]]);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('a run of every journey together that stops gaining is a plateau: the user is asked', () => {
  const t = setup();
  writeEvidence(path.join(t.home, 'controls', 'control-form'), ['screens/01-form.phone.png']);
  const F = 'screens/01-form.phone.png';
  const fullRun = (date, visual) => {
    const r = json(uxq(['new-run', '--config', t.configFile, '--commit', `c${date}`, '--date', `2026-09-${date}`]));
    for (const [unit, files] of Object.entries(r.capture)) writeEvidence(path.join(r.run_dir, 'evidence', unit), files);
    for (const b of json(uxq(['bundle', '--config', t.configFile, '--run', r.run_dir, '--tmp', t.tmp]))) {
      let data;
      if (b.unit === 'control-form') data = b.role === 'user' ? person([['hesitated', [['U2', 'Odd word on the button.']]]], 'sure', 70) : spec(60, [issue('A1', 'major', 'The heading is too faint.', F, { step: '01-form' })]);
      else if (b.role === 'user') data = easy(2);
      else if (b.role === 'visual') data = spec(visual, [issue('V3', 'minor', 'Edges do not line up.', 'screens/01-open.phone.png', { step: '01-open' })]);
      else data = spec(95);
      fs.writeFileSync(path.join(b.dir, 'judgment.json'), JSON.stringify(owed(data, b.role)));
    }
    uxq(['collect', '--config', t.configFile, '--run', r.run_dir]);
    uxq(['score', '--config', t.configFile, '--run', r.run_dir]);
    return json(uxq(['progress', '--config', t.configFile, '--target', '90']));
  };
  assert.strictEqual(fullRun('01', 80).plateau, false);
  assert.strictEqual(fullRun('02', 84).plateau, false, 'one small gain is not a plateau');
  const flat = fullRun('03', 86);
  assert.deepStrictEqual([flat.plateau, flat.target_met], [true, false]);
  assert.match(flat.then, /^Stop and ask the user: the last two runs of every journey together gained 0\.7 and 0\.3 points overall, each under 2\./);
  // At a target the scores already meet, the same history is no plateau.
  const met = json(uxq(['progress', '--config', t.configFile, '--target', '85']));
  assert.deepStrictEqual([met.plateau, met.target_met], [false, true]);
  fs.rmSync(t.root, { recursive: true, force: true });
});

// A reviewer set of its own, for a kind of screen the six shipped roles were not written for.
function customSet(home, { version = '0.1.0', withBrief = false } = {}) {
  const dir = path.join(home, 'rubric-set');
  fs.mkdirSync(path.join(dir, 'roles'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'set.json'), JSON.stringify({ name: 'sample-set', specialists: { offer: ['screens', 'pages', 'facts'], words: ['screens', 'pages', 'facts', 'motion'] } }));
  const body = (title, letter) => `# ${title}\n\nRubric version: ${version}\n\n## Criteria\n\n- **${letter}1** The first thing.\n  - A test of it.\n- **${letter}2** The second thing.\n- **${letter}3** The third thing.\n`;
  fs.writeFileSync(path.join(dir, 'roles', 'offer.md'), body('Offer rubric', 'O'));
  fs.writeFileSync(path.join(dir, 'roles', 'words.md'), body('Words on the page rubric', 'W'));
  fs.writeFileSync(path.join(dir, 'roles', 'user.md'), body('What to report', 'P'));
  if (withBrief) fs.writeFileSync(path.join(dir, 'reviewer-brief.md'), `${fs.readFileSync(path.join(JUDGE, 'reviewer-brief.md'), 'utf8')}\nSET-OWN-BRIEF-LINE\n`);
  return dir;
}

test('a config can name a reviewer set of its own: its roles, rubrics and evidence, and a series of its own', () => {
  const t = setup();
  const setDir = customSet(t.home);
  const config = {
    ...t.config, rubric_set: 'rubric-set',
    units: [{ id: 'visit', persona: 'member', goal: 'See what is offered.', viewports: ['phone'],
      steps: [{ id: '01-arrive', do: 'Opens the page.' }, { id: '02-read', do: 'Scrolls down.' }, { id: '03-detail', do: 'Looks at the small print.', roles: ['words'] }] }]
  };
  fs.writeFileSync(t.configFile, JSON.stringify(config));
  const created = json(uxq(['new-run', '--config', t.configFile, '--commit', 'abc1234', '--date', '2026-07-01']));
  assert.strictEqual(created.reviewers_per_full_run, 6, 'two specialists and the person, two reviewers each');
  const meta = JSON.parse(fs.readFileSync(path.join(created.run_dir, 'run.json'), 'utf8'));
  assert.deepStrictEqual([meta.rubric_set, meta.rubric_version], ['sample-set', '0.1.0']);
  assert.notStrictEqual(meta.rubric_sha, rubric.sha, 'another set is another yardstick');
  const args = ['--config', t.configFile, '--run', created.run_dir];
  writeEvidence(path.join(created.run_dir, 'evidence', 'visit'), [...created.capture.visit, 'facts/01-arrive.phone.json', 'motion/01-arrive.phone.json', 'keyboard/01-arrive.phone.json']);

  const bundles = json(uxq(['bundle', ...args, '--tmp', t.tmp]));
  assert.deepStrictEqual(bundles.map((b) => `${b.role}-${b.judge}`), ['offer-1', 'offer-2', 'words-1', 'words-2', 'user-1', 'user-2']);
  for (const b of bundles) {
    const listing = fs.readdirSync(b.dir).sort();
    assert.strictEqual(fs.readFileSync(path.join(b.dir, 'rubric.md'), 'utf8'), fs.readFileSync(path.join(setDir, 'roles', `${b.role}.md`), 'utf8'), 'the rubric of its own set');
    assert.ok(!readAllMarkdown(b.dir).includes('{{'), 'no unfilled placeholders');
    if (b.role === 'user') { assert.deepStrictEqual(listing, ['README.md', 'rubric.md', 'screens', 'start.md', 'steps']); continue; }
    // Each specialist is handed what set.json lists for it, and is told its specialism by its rubric's title.
    assert.deepStrictEqual(listing, b.role === 'words' ? ['README.md', 'facts', 'journey.md', 'motion', 'rubric.md', 'screens'] : ['README.md', 'facts', 'journey.md', 'rubric.md', 'screens']);
    assert.ok(fs.readFileSync(path.join(b.dir, 'README.md'), 'utf8').includes(`specialist in ${b.role === 'words' ? 'words on the page' : 'offer'}`));
    assert.strictEqual(fs.existsSync(path.join(b.dir, 'screens', '03-detail.phone.png')), b.role === 'words', 'a step limited to a role of the set reaches only it');
  }
  const dirOf = (role, judge) => bundles.find((b) => b.role === role && b.judge === judge).dir;
  const put = (role, judge, data) => fs.writeFileSync(path.join(dirOf(role, judge), 'judgment.json'), JSON.stringify(data));
  const S = 'screens/01-arrive.phone.png';
  put('offer', 1, spec(88, [issue('O2', 'minor', 'The second thing is hard to find.', S, { step: '01-arrive' })]));
  put('offer', 2, spec(90, [issue('A1', 'polish', 'A criterion of another set.', S)]));
  put('words', 1, spec(92, [issue('W1', 'polish', 'A word could be shorter.', S)]));
  put('words', 2, spec(96, [issue('W3', 'polish', 'A comma is missing.', S)]));
  put('user', 1, person([['smooth'], ['hesitated', [['P2', 'I had to look twice.']]]], 'sure', 84));
  put('user', 2, person([['smooth', [['P1', 'A small thing.']]], ['smooth']], 'sure', 96));
  const first = uxq(['collect', ...args], { allowFail: true });
  const invalid = json(first).filter((r) => r.status === 'invalid');
  assert.deepStrictEqual(invalid.map((r) => [r.role, r.judge]), [['offer', 2]], 'a criterion is one of the role\'s own rubric');
  put('offer', 2, spec(90, [issue('O1', 'polish', 'The first thing could be plainer.', S)]));
  uxq(['collect', ...args]);
  const result = json(uxq(['score', ...args]));
  assert.deepStrictEqual(result.role_scores, { offer: 89, words: 94, user: 90 });
  assert.strictEqual(result.overall_score, 91, 'the mean of the set\'s three roles');
  const line = JSON.parse(fs.readFileSync(path.join(t.home, 'ledger.jsonl'), 'utf8').trim().split('\n').pop());
  assert.deepStrictEqual([line.rubric_version, line.rubric_sha], ['0.1.0', meta.rubric_sha]);
  // A set says which of its criteria are about how a screen is arranged; until it does, no layout study
  // is suggested from what its reviewers report. Saying so changes no score and starts no new series.
  const studies = () => json(uxq(['progress', '--config', t.configFile, '--target', '95']));
  assert.match(studies().layout_studies.note, /names no arrangement criteria/);
  const setFile = path.join(setDir, 'set.json');
  const plainSet = fs.readFileSync(setFile, 'utf8');
  fs.writeFileSync(setFile, JSON.stringify({ ...JSON.parse(plainSet), arrangement: ['O2', 'P1'] }));
  assert.deepStrictEqual([studies().layout_studies, studies().journeys[0].rounds], [{ due: [], open: [] }, 1]);
  fs.writeFileSync(setFile, JSON.stringify({ ...JSON.parse(plainSet), arrangement: ['O2', 'V1'] }));
  assert.match(uxq(['progress', '--config', t.configFile, '--target', '95'], { allowFail: true }).stderr, /"arrangement" names criteria that no rubric under .* has: V1/);
  fs.writeFileSync(setFile, plainSet);

  // A brief the set words differently is used and is part of the yardstick; the others fall back to the shipped ones.
  customSet(t.home, { withBrief: true });
  assert.match(uxq(['score', ...args, '--rescore', '--no-ledger'], { allowFail: true }).stderr, /rubric/i, 'a changed set no longer fits a run opened with the old one');
  const later = json(uxq(['new-run', '--config', t.configFile, '--commit', 'def5678', '--date', '2026-07-02']));
  assert.notStrictEqual(JSON.parse(fs.readFileSync(path.join(later.run_dir, 'run.json'), 'utf8')).rubric_sha, meta.rubric_sha);
  writeEvidence(path.join(later.run_dir, 'evidence', 'visit'), later.capture.visit);
  const again = json(uxq(['bundle', '--config', t.configFile, '--run', later.run_dir, '--role', 'offer', '--judges', '1', '--tmp', t.tmp]));
  assert.ok(fs.readFileSync(path.join(again[0].dir, 'README.md'), 'utf8').includes('SET-OWN-BRIEF-LINE'));

  // A set that does not hold together is refused, and says why.
  const refuse = (change, pattern) => {
    const home = fs.mkdtempSync(path.join(t.root, 'bad-'));
    const dir = customSet(home);
    change(dir);
    const file = path.join(home, 'config.json');
    fs.writeFileSync(file, JSON.stringify(config));
    assert.match(uxq(['new-run', '--config', file], { allowFail: true }).stderr, pattern);
  };
  refuse((dir) => fs.rmSync(path.join(dir, 'roles', 'words.md')), /roles\/words\.md is missing/);
  refuse((dir) => fs.rmSync(path.join(dir, 'roles', 'user.md')), /roles\/user\.md is missing/);
  refuse((dir) => fs.rmSync(path.join(dir, 'set.json')), /has no set\.json/);
  refuse((dir) => fs.writeFileSync(path.join(dir, 'set.json'), JSON.stringify({ name: 'sample-set', specialists: { offer: ['pages'], words: ['screens', 'smells'] } })), /offer: its evidence must include "screens"[\s\S]*words: its evidence must include "screens"/);
  refuse((dir) => fs.writeFileSync(path.join(dir, 'set.json'), JSON.stringify({ name: 'sample-set', specialists: { user: ['screens'] } })), /"user" is the person every set has/);
  refuse((dir) => fs.writeFileSync(path.join(dir, 'roles', 'offer.md'), fs.readFileSync(path.join(dir, 'roles', 'offer.md'), 'utf8').replace('0.1.0', '0.2.0')), /must carry the same rubric version/);
  // A role the set does not have cannot be asked for, and a config without a set still uses the shipped six.
  const strayHome = fs.mkdtempSync(path.join(t.root, 'stray-'));
  customSet(strayHome);
  fs.writeFileSync(path.join(strayHome, 'config.json'), JSON.stringify({ ...config, units: [{ ...config.units[0], roles: ['visual', 'user'] }] }));
  assert.strictEqual(uxq(['new-run', '--config', path.join(strayHome, 'config.json')], { allowFail: true }).status, 1);
  const plain = setup();
  const plainRun = json(uxq(['new-run', '--config', plain.configFile, '--commit', 'abc1234', '--date', '2026-07-01']));
  const plainMeta = JSON.parse(fs.readFileSync(path.join(plainRun.run_dir, 'run.json'), 'utf8'));
  assert.deepStrictEqual([plainMeta.rubric_sha, plainMeta.rubric_set], [rubric.sha, undefined]);
  fs.rmSync(plain.root, { recursive: true, force: true });
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('a layout study: due when arrangement issues come back, candidates compared under letters, the user picks, no score is touched', () => {
  const t = setup();
  const cfgArgs = ['--config', t.configFile];
  const progress = () => json(uxq(['progress', ...cfgArgs, '--target', '90']));
  const P = 'screens/02-pay.phone.png';
  // A round of pay-invoice: the visual reviewers report one minor issue at the pay step, under the criterion given.
  const round = (day, criterion, people) => {
    const r = json(uxq(['new-run', ...cfgArgs, '--commit', `c${day}`, '--date', `2026-04-${day}`]));
    writeEvidence(path.join(r.run_dir, 'evidence', 'pay-invoice'), r.capture['pay-invoice']);
    for (const b of json(uxq(['bundle', ...cfgArgs, '--run', r.run_dir, '--unit', 'pay-invoice', '--tmp', t.tmp]))) {
      const data = b.role === 'visual' ? spec(80, [issue(criterion, 'minor', 'The amount sits far from the button.', P, { step: '02-pay' })])
        : b.role === 'user' && people ? person([['smooth'], ['hesitated', [['U1', 'I could not find the amount.']]]], 'sure', 80)
          : b.role === 'user' ? easy(2) : spec(95);
      fs.writeFileSync(path.join(b.dir, 'judgment.json'), JSON.stringify(owed(data, b.role)));
    }
    uxq(['collect', ...cfgArgs, '--run', r.run_dir]);
    uxq(['score', ...cfgArgs, '--run', r.run_dir]);
    return r;
  };

  // One review that reports the arrangement is not yet a reason: the fix has not been tried.
  round('01', 'V2');
  let p = progress();
  assert.deepStrictEqual(p.layout_studies, { due: [], open: [] });
  assert.ok(!/layout study/.test(p.then));
  // A finishing issue at the same step, review after review, is no reason either.
  // Reported again by reviewers who never saw the first review: now the arrangement itself is in question.
  const second = round('02', 'V1', true);
  p = progress();
  assert.deepStrictEqual(p.layout_studies.due, [{
    journey: 'pay-invoice', step: '02-pay', reports: 4, reports_before: 2, criteria: ['U1', 'V1'],
    why: 'arrangement issues were reported at this step in both of the last two reviews of the journey'
  }], 'two visual reviewers and two people; the polish notes of the others, also under V1, do not count');
  assert.match(p.then, /^Work on pay-invoice .* A layout study is due on 1 screen \(layout_studies\), first pay-invoice 02-pay: .*tell the user what a study costs.*study open\.$/);
  const ledger = () => fs.readFileSync(path.join(t.home, 'ledger.jsonl'), 'utf8');
  const before = ledger();

  // What the reviewers said of the arrangement, review by review: what the candidates are proposed from.
  const issuesOf = (extra, opts) => uxq(['study', 'issues', ...cfgArgs, ...extra], opts);
  const said = json(issuesOf(['--unit', 'pay-invoice', '--steps', '02-pay']));
  assert.deepStrictEqual([said.journey, said.steps, said.criteria.includes('V1'), said.earlier_series], ['pay-invoice', ['02-pay'], true, undefined]);
  assert.deepStrictEqual(said.reviews.map((r) => [r.date, r.present_series, r.issues.length]), [['2026-04-01', true, 2], ['2026-04-02', true, 4]]);
  assert.deepStrictEqual(said.reviews[1].issues.map((i) => [i.step, i.criterion, i.role]).sort(), [['02-pay', 'U1', 'user'], ['02-pay', 'U1', 'user'], ['02-pay', 'V1', 'visual'], ['02-pay', 'V1', 'visual']]);
  assert.ok(said.reviews[1].issues.every((i) => i.statement && i.severity), 'in the reviewers\' words');
  assert.deepStrictEqual(json(issuesOf(['--unit', 'pay-invoice', '--steps', '01-open', '--runs', '1'])).reviews.map((r) => r.issues), [[]]);
  assert.match(issuesOf(['--unit', 'pay-invoice', '--steps', '09-none'], { allowFail: true }).stderr, /not a step of pay-invoice: 09-none/);
  assert.match(issuesOf(['--unit', 'control-form'], { allowFail: true }).stderr, /--unit <journey> is required/);

  // Opening one: two to four other arrangements, and the one the product has is always in it.
  const open = (extra, opts) => uxq(['study', 'open', ...cfgArgs, '--unit', 'pay-invoice', ...extra], opts);
  assert.match(open(['--candidates', 'split'], { allowFail: true }).stderr, /name 2 to 4 other arrangements/);
  assert.match(open(['--candidates', 'split,current'], { allowFail: true }).stderr, /"current" is taken/);
  assert.match(open(['--candidates', 'split,stacked', '--steps', '09-none'], { allowFail: true }).stderr, /not a step of pay-invoice: 09-none/);
  assert.match(open(['--candidates', 'split,stacked', '--judges', '4'], { allowFail: true }).stderr, /odd number/);
  assert.match(uxq(['study', 'open', ...cfgArgs, '--unit', 'control-form', '--candidates', 'a,b'], { allowFail: true }).stderr, /--unit <journey> is required/);
  const opened = json(open(['--candidates', 'split,stacked', '--steps', '02-pay', '--date', '2026-04-03']));
  const study = opened.study_dir;
  const sArgs = [...cfgArgs, '--study', study];
  assert.strictEqual(path.relative(t.home, study), path.join('studies', '20260403-pay-invoice'));
  assert.deepStrictEqual(opened.candidates.map((c) => c.id), ['current', 'split', 'stacked']);
  assert.deepStrictEqual(opened.capture, ['screens/02-pay.phone.png', 'screens/02-pay.desktop.png']);
  assert.strictEqual(opened.reviewers, 3);
  const meta = () => JSON.parse(fs.readFileSync(path.join(study, 'study.json'), 'utf8'));
  assert.strictEqual(meta().after_run, path.basename(second.run_dir));
  assert.deepStrictEqual([...meta().base_order].sort(), ['current', 'split', 'stacked']);
  assert.match(open(['--candidates', 'a,b'], { allowFail: true }).stderr, /a study of these steps is still open/);
  // While it is open, the step is no longer reported as due; the study is listed instead.
  p = progress();
  assert.deepStrictEqual(p.layout_studies, { due: [], open: [{ study, journey: 'pay-invoice', steps: ['02-pay'], state: 'open' }] });
  const state = () => json(uxq(['study', 'status', ...sArgs]))[0];
  assert.match(state().next, /Capture the candidates still missing screens .*: current, split, stacked\./);
  assert.match(opened.then, /a capture plan of its own, at candidates\/<id>\/capture\.json in the study folder: --base-url moves the pages only/);

  // Reviewers are started only when every candidate is captured, and each from its own build.
  assert.match(uxq(['study', 'bundle', ...sArgs, '--tmp', t.tmp], { allowFail: true }).stderr, /not every candidate is captured:[\s\S]*stacked: screens\/02-pay\.phone\.png, screens\/02-pay\.desktop\.png/);
  const shots = (id, mark) => { for (const f of opened.capture) fs.writeFileSync(path.join(opened.candidates.find((c) => c.id === id).evidence, f), `png:${mark}:${f}`); };
  shots('current', 'now'); shots('split', 'split'); shots('stacked', 'split');
  assert.match(uxq(['study', 'bundle', ...sArgs, '--tmp', t.tmp], { allowFail: true }).stderr, /split and stacked show exactly the same screens/);
  shots('stacked', 'stacked');
  assert.strictEqual(state().state, 'captured');
  const bundles = json(uxq(['study', 'bundle', ...sArgs, '--tmp', t.tmp]));
  assert.strictEqual(bundles.length, 3);
  const map = () => JSON.parse(fs.readFileSync(path.join(study, 'bundles.json'), 'utf8'));
  // Each candidate is shown as A to one reviewer, as B to another and as C to the third.
  for (const pos of [0, 1, 2]) assert.deepStrictEqual(map().map((b) => b.order[pos]).sort(), ['current', 'split', 'stacked']);
  for (const b of bundles) {
    assert.strictEqual(b.prompt, spawnPrompt(b.dir));
    assert.deepStrictEqual(fs.readdirSync(b.dir).sort(), ['A', 'B', 'C', 'README.md', 'task.md']);
    assert.deepStrictEqual(fs.readdirSync(path.join(b.dir, 'B', 'screens')).sort(), ['02-pay.desktop.png', '02-pay.phone.png']);
    const told = readAllMarkdown(b.dir);
    assert.ok(!told.includes('{{'), 'no unfilled placeholders');
    assert.ok(told.includes('3 arrangements') && told.includes('`a`, `b`, `c`'));
    assert.ok(told.includes('settle the open bill') && told.includes('expected-outcome-text two') && !told.includes('expected-outcome-text one'), 'the task, and only the steps compared');
    assert.ok(told.includes('the `phone` size below'), 'the person\'s own size is named');
    // Nothing says which arrangement is which, where the folder came from, or what the reviews found.
    for (const word of ['current', 'split', 'stacked', 'pay-invoice', 'study', ...FORBIDDEN]) assert.ok(!new RegExp(`\\b${word}\\b`).test(told), `a comparison folder must not contain "${word}"`);
    assert.ok(!b.dir.includes(t.home));
  }

  // A comparison ranks every arrangement and shows each point on a screen of that arrangement.
  const letterOf = (b, id) => 'ABC'[map().find((x) => x.judge === b.judge).order.indexOf(id)];
  const comparison = (b, ranked, margin = 'clear') => {
    const L = ranked.map((id) => letterOf(b, id));
    const point = (l, what) => ({ what, evidence: [`${l}/screens/02-pay.phone.png`] });
    return {
      ranking: L, margin, reason: `${L[0]} keeps the amount beside the button.`,
      arrangements: Object.fromEntries(L.map((l, i) => [l, { better: i === 0 ? [point(l, 'The amount is beside the button.')] : [], worse: i === 2 ? [point(l, 'The amount is a screen away from the button.')] : [] }])),
      still_wrong: [point(L[0], 'The button is below the fold on the phone.')]
    };
  };
  const put = (b, data) => fs.writeFileSync(path.join(b.dir, 'comparison.json'), JSON.stringify(data));
  put(bundles[0], comparison(bundles[0], ['split', 'stacked', 'current']));
  const bad = comparison(bundles[1], ['split', 'current', 'stacked'], 'close');
  const [first, , last] = bad.ranking;
  put(bundles[1], { ...bad, ranking: [first, first, last], arrangements: { ...bad.arrangements, [last]: { better: [], worse: [{ what: 'Shown on another arrangement.', evidence: [`${first}/screens/02-pay.phone.png`] }] } } });
  let collected = uxq(['study', 'collect', ...sArgs], { allowFail: true });
  assert.strictEqual(collected.status, 2);
  assert.deepStrictEqual(json(collected).map((r) => r.status), ['collected', 'invalid', 'missing']);
  assert.deepStrictEqual(json(collected)[1].errors, ['ranking must list each of A, B, C once, best first', `arrangements.${last}.worse 1: evidence must cite at least one screen of arrangement ${last} that exists in the folder`, 'still_wrong must be a list'].slice(0, 2));
  assert.ok(!fs.existsSync(bundles[0].dir), 'a folder is removed once its comparison is in');
  assert.match(uxq(['study', 'tally', ...sArgs], { allowFail: true }).stderr, /1 of 3 comparisons are in/);
  assert.match(uxq(['study', 'pick', ...sArgs, '--candidate', 'split', '--by', 'Ada'], { allowFail: true }).stderr, /no result yet/);
  put(bundles[1], bad);
  // The third reviewer never reports: it is replaced by a fresh one, which gets the turn of the order that comes next.
  put(bundles[2], { not: 'a comparison' });
  uxq(['study', 'collect', ...sArgs, '--discard-bad']);
  assert.match(state().next, /study bundle|not reported/);
  const extra = json(uxq(['study', 'bundle', ...sArgs, '--tmp', t.tmp]));
  assert.deepStrictEqual(extra.map((b) => b.judge), [4]);
  put(extra[0], comparison(extra[0], ['stacked', 'split', 'current']));
  assert.deepStrictEqual(json(uxq(['study', 'collect', ...sArgs])).map((r) => r.status), ['collected', 'collected', 'collected']);
  assert.strictEqual(state().state, 'collected');
  // What is kept names the candidates and the real files, whatever letters each reviewer saw.
  const kept = JSON.parse(fs.readFileSync(path.join(study, 'comparisons', 'judge-2.json'), 'utf8'));
  assert.deepStrictEqual([kept.ranking, kept.margin], [['split', 'current', 'stacked'], 'close']);
  assert.deepStrictEqual(kept.arrangements.split.better[0].evidence, ['candidates/split/evidence/pay-invoice/screens/02-pay.phone.png']);
  assert.ok(fs.existsSync(path.join(study, kept.still_wrong[0].evidence[0])));

  // The tally: preferred means ranked first by more than half. It writes a result, and nothing in the ledger.
  const tally = json(uxq(['study', 'tally', ...sArgs]));
  assert.deepStrictEqual([tally.outcome, tally.preferred, tally.current_preferred, tally.reviewers, tally.called_close], ['clear', 'split', false, 3, 1]);
  assert.deepStrictEqual(tally.table.map((r) => [r.candidate, r.first, r.last, r.mean_rank]), [['split', 2, 0, 1.33], ['stacked', 1, 1, 2], ['current', 0, 2, 2.67]]);
  assert.deepStrictEqual(tally.table[0].ahead_of, ['current', 'stacked']);
  assert.match(tally.then, /2 of 3 reviewers ranked split first; 1 of them called it close\..*The choice is theirs/);
  const md = fs.readFileSync(tally.result, 'utf8');
  assert.match(md, /\*\*Preferred: `split`\*\*, ranked first by 2 of 3\./);
  assert.match(md, /\| `current` \(as it is now\) \| 0 of 3 \| 2 of 3 \| 2\.67 \| none \|/);
  // A point two reviewers made is listed once, under both; the screens are named by file, and the page beside it shows them.
  assert.match(md, /### `split`\n\n\*\*Better than the others\*\*\n\n- \*\*Reviewers 1 and 2\.\*\* The amount is beside the button\. \(`02-pay\.phone\.png`\)/);
  assert.strictEqual(md.split('The amount is beside the button.').length - 1, 2, 'once for split, once for stacked');
  assert.match(md, /What `split` still gets wrong:\n\n- The button is below the fold on the phone\. \(`candidates\/split\/evidence\/pay-invoice\/screens\/02-pay\.phone\.png`\)/);
  assert.match(md, /side by side: `side-by-side\.html`/);
  assert.strictEqual(ledger(), before, 'a study gives no score');
  assert.strictEqual(state().state, 'compared');
  // The page for whoever chooses: every candidate by name, the same step and size in a row.
  const SHEET = path.join(study, 'side-by-side.html');
  assert.strictEqual(tally.sheet, SHEET);
  const page = () => fs.readFileSync(SHEET, 'utf8');
  for (const id of ['current', 'split', 'stacked']) assert.ok(page().includes(`<a href="candidates/${id}/evidence/pay-invoice/screens/02-pay.phone.png">`), id);
  assert.match(page(), /<figcaption>split <span>ranked first by 2 of 3<\/span><\/figcaption>/);
  assert.match(page(), /<figcaption>current <span>as it is now<\/span> <span>ranked first by 0 of 3<\/span><\/figcaption>/);
  assert.match(page(), /<h2>02-pay <span>phone, \d+ x \d+<\/span><\/h2>/);
  for (const word of ['loop', 'ledger', 'round']) assert.ok(!new RegExp(`\\b${word}\\b`).test(page()));
  // bundles.json names temporary folders and is not committed: a checkout without it reads the same result.
  fs.rmSync(path.join(study, 'bundles.json'));
  assert.strictEqual(state().state, 'compared');
  assert.strictEqual(fs.readFileSync(json(uxq(['study', 'tally', ...sArgs])).result, 'utf8'), md);
  // It can be written to be sent on its own, and says what is not captured.
  fs.rmSync(path.join(study, 'candidates', 'stacked', 'evidence', 'pay-invoice', 'screens', '02-pay.desktop.png'));
  const sent = json(uxq(['study', 'sheet', ...sArgs, '--embed']));
  assert.deepStrictEqual([sent.sheet, Object.keys(sent.not_captured)], [SHEET, ['stacked']]);
  assert.ok(page().includes('src="data:image/png;base64,') && !page().includes('<a href=') && page().includes('<p class="none">not captured</p>'));

  // The choice is the user's, recorded with their name, once. It need not be the reviewers'.
  assert.match(uxq(['study', 'pick', ...sArgs, '--candidate', 'split'], { allowFail: true }).stderr, /--by "<name>" is required/);
  assert.match(uxq(['study', 'pick', ...sArgs, '--candidate', 'nope', '--by', 'Ada'], { allowFail: true }).stderr, /--candidate must be one of current, split, stacked/);
  const picked = json(uxq(['study', 'pick', ...sArgs, '--candidate', 'stacked', '--by', 'Ada', '--why', 'Fits the phone better.', '--date', '2026-04-04']));
  assert.deepStrictEqual(picked.picked, { candidate: 'stacked', by: 'Ada', date: '2026-04-04', why: 'Fits the phone better.', reviewers_preferred: 'split' });
  assert.match(picked.then, /Bring stacked into the product through the project's own change process/);
  assert.ok(page().includes('<span>chosen by Ada</span>') && page().includes('src="data:image/png;base64,'), 'the page names the choice, written the way it was');
  assert.match(uxq(['study', 'pick', ...sArgs, '--candidate', 'split', '--by', 'Ada'], { allowFail: true }).stderr, /already settled: Ada picked stacked/);
  assert.match(uxq(['study', 'bundle', ...sArgs], { allowFail: true }).stderr, /this study is settled/);
  assert.deepStrictEqual([state().state, state().next], ['picked', undefined]);
  // A settled step is given two reviews before another study of it is suggested.
  p = progress();
  assert.deepStrictEqual(p.layout_studies, { due: [], open: [] });
  round('05', 'V1');
  assert.deepStrictEqual(progress().layout_studies.due, []);
  round('06', 'V1');
  assert.deepStrictEqual(progress().layout_studies.due.map((d) => [d.step, d.reports]), [['02-pay', 2]]);

  // A study with no majority is a split, and one the present arrangement wins says so.
  const other = json(uxq(['study', 'open', ...cfgArgs, '--unit', 'pay-invoice', '--steps', '01-open', '--candidates', 'rail,tabs', '--date', '2026-04-07']));
  const oArgs = [...cfgArgs, '--study', other.study_dir];
  for (const c of other.candidates) for (const f of other.capture) fs.writeFileSync(path.join(c.evidence, f), `png:${c.id}:${f}`);
  const run2 = (orders) => {
    const bs = json(uxq(['study', 'bundle', ...oArgs, '--tmp', t.tmp]));
    const letters = JSON.parse(fs.readFileSync(path.join(other.study_dir, 'bundles.json'), 'utf8'));
    bs.forEach((b, i) => {
      const L = orders[i].map((id) => 'ABC'[letters.find((x) => x.judge === b.judge).order.indexOf(id)]);
      const point = (l) => ({ what: 'A point.', evidence: [`${l}/screens/01-open.phone.png`] });
      put(b, { ranking: L, margin: 'clear', reason: 'A reason.', arrangements: Object.fromEntries(L.map((l) => [l, { better: [point(l)], worse: [point(l)] }])), still_wrong: [] });
    });
    uxq(['study', 'collect', ...oArgs]);
    return json(uxq(['study', 'tally', ...oArgs]));
  };
  const split = run2([['rail', 'tabs', 'current'], ['tabs', 'current', 'rail'], ['current', 'rail', 'tabs']]);
  assert.deepStrictEqual([split.outcome, split.preferred], ['split', null]);
  assert.match(split.then, /the study is split.*keep the arrangement the product has.*a candidate that joins what the reviewers preferred/);
  assert.match(fs.readFileSync(split.result, 'utf8'), /\*\*Split:\*\* no arrangement was ranked first by more than half/);
  const stays = json(uxq(['study', 'pick', ...oArgs, '--candidate', 'current', '--by', 'Ada']));
  assert.match(stays.then, /The arrangement stays as it is/);

  // A study belongs to the journeys as they were when it opened.
  const third = json(uxq(['study', 'open', ...cfgArgs, '--unit', 'pay-invoice', '--steps', '01-open', '--candidates', 'rail,tabs', '--date', '2026-04-07']));
  assert.strictEqual(path.basename(third.study_dir), '20260407-pay-invoice-2');
  t.config.units[0].steps[0].do = 'Opens the list of open bills.';
  fs.writeFileSync(t.configFile, JSON.stringify(t.config));
  assert.match(uxq(['study', 'bundle', ...cfgArgs, '--study', third.study_dir], { allowFail: true }).stderr, /the config changed since this study was opened/);
  assert.strictEqual(json(uxq(['study', 'status', ...cfgArgs])).find((s) => s.study === third.study_dir).state, 'out of date');
  // The change began a new series, where progress starts again. What the reviewers said before it is still read.
  const across = json(issuesOf(['--unit', 'pay-invoice', '--steps', '02-pay']));
  assert.deepStrictEqual(across.reviews.map((r) => [r.date, r.present_series, r.issues.length]), [['2026-04-05', false, 2], ['2026-04-06', false, 2]]);
  assert.match(across.earlier_series, /measured with an earlier rubric or config/);
  assert.match(uxq(['study', 'nope', ...cfgArgs], { allowFail: true }).stderr, /usage: uxq\.cjs study <issues\|open\|text\|bundle\|collect\|tally\|sheet\|pick\|redo\|status>/);
  fs.rmSync(t.root, { recursive: true, force: true });
});

test('a layout study: the window alone beside a long screen, words that differ from the present arrangement, and a comparison done again', () => {
  const t = setup();
  const cfgArgs = ['--config', t.configFile];
  const opened = json(uxq(['study', 'open', ...cfgArgs, '--unit', 'pay-invoice', '--steps', '02-pay', '--candidates', 'split,stacked', '--date', '2026-04-03']));
  const study = opened.study_dir;
  const sArgs = [...cfgArgs, '--study', study];
  const ev = (id) => opened.candidates.find((c) => c.id === id).evidence;
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  const png = (width, height, mark) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from('IHDR'), u32(width), u32(height), Buffer.from(mark)]);
  const capture = (id, phoneHeight, words) => {
    fs.writeFileSync(path.join(ev(id), 'screens', '02-pay.phone.png'), png(375, phoneHeight, id));
    fs.writeFileSync(path.join(ev(id), 'screens', '02-pay.desktop.png'), png(1280, 800, id));
    fs.mkdirSync(path.join(ev(id), 'pages'), { recursive: true });
    for (const size of ['phone', 'desktop']) fs.writeFileSync(path.join(ev(id), 'pages', `02-pay.${size}.txt`), `${words.join('\n')}\n`);
  };
  capture('current', 812, ['Invoice 42', '0900:30 UTC', 'Amount due', '120.00', 'Pay now']);
  capture('split', 1112, ['Invoice 42', '0900:41 UTC', 'Amount due   120.00', 'Pay now']);
  capture('stacked', 812, ['Invoice 42', '0900:30 UTC', 'Amount due', '125.00', 'Settle the bill']);
  const state = () => json(uxq(['study', 'status', ...sArgs]))[0];
  assert.match(state().next, /study text, to see that the candidates say what current says; then study bundle/);

  // A picture longer than its window does not show what is in view on arrival: the window alone must be beside it.
  const refused = uxq(['study', 'bundle', ...sArgs, '--tmp', t.tmp], { allowFail: true });
  assert.match(refused.stderr, /longer than their window and have no picture of the window alone beside them[\s\S]*\n {2}- split: screens\/02-pay\.phone\.png \(1112 px, in a window of 812\)\nCapture those candidates again/);
  assert.ok(!/current:|stacked:/.test(refused.stderr), 'a screen that fits its window needs no second picture');
  fs.writeFileSync(path.join(ev('split'), 'screens', '02-pay.phone.window.png'), png(375, 812, 'split on arrival'));

  // What the candidates' pages say that the present arrangement's do not, before a reviewer sees them.
  const text = uxq(['study', 'text', ...sArgs], { allowFail: true });
  assert.strictEqual(text.status, 2);
  const [split, stacked] = json(text).candidates;
  // A clock showing its seconds is the moment of the capture: listed, and not counted as a difference.
  assert.deepStrictEqual(split, { candidate: 'split', only_in_candidate: [], only_in_current: [], figures: [], clock: [{ current: '0900:30 UTC', candidate: '0900:41 UTC', screens: ['02-pay.phone', '02-pay.desktop'] }], same_words_other_lines: ['02-pay.phone', '02-pay.desktop'], not_read: [], same: true });
  assert.deepStrictEqual([stacked.only_in_candidate, stacked.only_in_current, stacked.same], [[{ text: 'Settle the bill', screens: ['02-pay.phone', '02-pay.desktop'] }], [{ text: 'Pay now', screens: ['02-pay.phone', '02-pay.desktop'] }], false]);
  assert.deepStrictEqual(stacked.figures, [{ current: '120.00', candidate: '125.00', screens: ['02-pay.phone', '02-pay.desktop'] }]);
  assert.match(json(text).then, /Hold each against candidates\.md.*captured again before a reviewer is started.*Figures that differ/);

  // The reviewers are given both pictures of a long screen, and told which is which.
  const started = uxq(['study', 'bundle', ...sArgs, '--tmp', t.tmp]);
  assert.match(started.stderr, /the pages of stacked do not say what the pages of current say.*study text/);
  const bundles = json(started);
  const order = () => JSON.parse(fs.readFileSync(path.join(study, 'bundles.json'), 'utf8'));
  const letterOf = (b, id) => 'ABC'[order().find((x) => x.judge === b.judge).order.indexOf(id)];
  for (const b of bundles) {
    assert.deepStrictEqual(fs.readdirSync(path.join(b.dir, letterOf(b, 'split'), 'screens')).sort(), ['02-pay.desktop.png', '02-pay.phone.png', '02-pay.phone.window.png']);
    assert.deepStrictEqual(fs.readdirSync(path.join(b.dir, letterOf(b, 'current'), 'screens')).sort(), ['02-pay.desktop.png', '02-pay.phone.png']);
    const told = readAllMarkdown(b.dir);
    assert.ok(told.includes('`screens/<step>.<size>.window.png` beside every screen that is longer than its window'));
    assert.match(told, /the window alone as\s+the person finds it on arrival/);
    for (const word of ['current', 'split', 'stacked', 'study', ...FORBIDDEN]) assert.ok(!new RegExp(`\\b${word}\\b`).test(told), `a comparison folder must not contain "${word}"`);
  }
  // A point may be shown on either picture; the two pictures of one screen are one screen.
  const comparison = (b, ranked, file) => {
    const L = ranked.map((id) => letterOf(b, id));
    const point = (id, what, f = '02-pay.phone.png') => ({ what, evidence: [`${letterOf(b, id)}/screens/${f}`] });
    return {
      ranking: L, margin: 'clear', reason: 'The amount and the button are in view together.',
      arrangements: Object.fromEntries(ranked.map((id, i) => [letterOf(b, id), { better: i === 0 ? [point(id, 'The amount is beside the button on arrival.', id === 'split' ? file : undefined)] : [], worse: i === 2 ? [point(id, 'The amount is a screen away from the button.')] : [] }])),
      still_wrong: []
    };
  };
  const put = (b, data) => fs.writeFileSync(path.join(b.dir, 'comparison.json'), JSON.stringify(data));
  put(bundles[0], comparison(bundles[0], ['split', 'stacked', 'current'], '02-pay.phone.window.png'));
  put(bundles[1], comparison(bundles[1], ['split', 'current', 'stacked'], '02-pay.phone.png'));
  put(bundles[2], comparison(bundles[2], ['stacked', 'split', 'current']));
  assert.deepStrictEqual(json(uxq(['study', 'collect', ...sArgs])).map((r) => r.status), ['collected', 'collected', 'collected']);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(study, 'comparisons', 'judge-1.json'), 'utf8')).arrangements.split.better[0].evidence, ['candidates/split/evidence/pay-invoice/screens/02-pay.phone.window.png']);
  const tally = json(uxq(['study', 'tally', ...sArgs]));
  assert.strictEqual(tally.preferred, 'split');
  assert.deepStrictEqual(tally.words_differ, [{ candidate: 'stacked', only_in_candidate: 1, only_in_current: 1, figures: 1 }]);
  let md = fs.readFileSync(tally.result, 'utf8');
  assert.match(md, /- \*\*Reviewers 1 and 2\.\*\* The amount is beside the button on arrival\. \(`02-pay\.phone\.window\.png`, `02-pay\.phone\.png`\)/);
  assert.match(md, /## Besides the arrangement\n\nThe arrangements were to hold the same content\..*a reviewer may have preferred a wording, a figure or a piece of content, not an arrangement\..*\n\n- `stacked` says, and `current` does not: "Settle the bill"\n- `current` says, and `stacked` does not: "Pay now"\n- `stacked`: figures differ on 2 screen\(s\), for example "120\.00" in `current` and "125\.00" here\./);
  assert.ok(!/`split` says|does not: .*Amount due/.test(md), 'the same words set out in other lines are not a difference');
  // Whoever chooses sees the window alone first, then the whole screen.
  const page = fs.readFileSync(tally.sheet, 'utf8');
  assert.match(page, /<figcaption>split[^\n]*<p class="what">On arrival, the window alone<\/p><a href="candidates\/split\/evidence\/pay-invoice\/screens\/02-pay\.phone\.window\.png">[^\n]*<p class="what">The whole screen, as scrolling shows it\.[^\n]*<a href="candidates\/split\/evidence\/pay-invoice\/screens\/02-pay\.phone\.png">/);
  assert.strictEqual(page.split('On arrival, the window alone').length - 1, 1);

  // The comparison is done again because the reviewers were shown the wrong thing, never for another draw.
  const redo = (extra) => uxq(['study', 'redo', ...sArgs, ...extra], { allowFail: true });
  assert.match(redo(['--recapture', 'stacked']).stderr, /--why "<what was wrong with what the reviewers were shown>" is required.*never because its result is unwelcome/);
  assert.match(redo(['--why', 'Reworded.']).stderr, /--recapture <all\|id,id> is required.*\(current, split, stacked\).*a second draw/);
  assert.match(redo(['--why', 'Reworded.', '--recapture', 'tall']).stderr, /--recapture <all\|id,id> is required/);
  assert.ok(fs.existsSync(path.join(study, 'result.json')), 'nothing is moved by a refusal');
  const again = json(redo(['--why', 'The stacked candidate reworded the button.', '--recapture', 'stacked', '--date', '2026-04-05']));
  assert.deepStrictEqual([again.recaptured, again.reviewers_reported, again.result, again.preferred, again.kept], [['stacked'], 3, true, 'split', 'earlier/1']);
  assert.match(again.then, /Tell the user that the comparison is being done again, and why\. Capture stacked again.*never a reviewer that saw the earlier pictures/);
  // What was shown and what was said is set aside, not deleted.
  for (const kept of ['comparisons/judge-1.json', 'comparisons/judge-3.json', 'result.json', 'result.md', 'candidates/stacked/evidence/pay-invoice/screens/02-pay.phone.png', 'candidates/stacked/evidence/pay-invoice/pages/02-pay.phone.txt']) assert.ok(fs.existsSync(path.join(study, 'earlier', '1', kept)), kept);
  for (const gone of ['comparisons', 'result.json', 'result.md', 'bundles.json', 'side-by-side.html', 'earlier/1/candidates/split']) assert.ok(!fs.existsSync(path.join(study, gone)), gone);
  assert.ok(fs.existsSync(path.join(ev('split'), 'screens', '02-pay.phone.window.png')), 'a candidate not named keeps its pictures');
  let s = state();
  assert.deepStrictEqual([s.state, Object.keys(s.missing), s.reviewers, s.redone.length], ['open', ['stacked'], { wanted: 3, started: 0, reported: 0 }, 1]);
  assert.match(s.next, /^The comparison is being done again\. Capture the candidates still missing screens .*: stacked\.$/);
  assert.match(uxq(['study', 'bundle', ...sArgs, '--tmp', t.tmp], { allowFail: true }).stderr, /not every candidate is captured:[\s\S]*stacked/);
  assert.match(uxq(['study', 'open', ...cfgArgs, '--unit', 'pay-invoice', '--steps', '02-pay', '--candidates', 'a,b'], { allowFail: true }).stderr, /a study of these steps is still open/);

  capture('stacked', 812, ['Invoice 42', '0900:52 UTC', 'Amount due', '120.00', 'Pay now']);
  const clean = uxq(['study', 'text', ...sArgs]);
  assert.ok(json(clean).candidates.every((c) => c.same));
  assert.match(json(clean).then, /Every candidate says what current says\..*look at the screens too/);
  const fresh = uxq(['study', 'bundle', ...sArgs, '--tmp', t.tmp]);
  assert.strictEqual(fresh.stderr, '');
  assert.deepStrictEqual(json(fresh).map((b) => b.judge), [1, 2, 3]);
  json(fresh).forEach((b, i) => put(b, comparison(b, [['stacked', 'split', 'current'], ['stacked', 'current', 'split'], ['split', 'stacked', 'current']][i])));
  uxq(['study', 'collect', ...sArgs]);
  const second = json(uxq(['study', 'tally', ...sArgs]));
  assert.deepStrictEqual([second.preferred, second.words_differ, second.earlier.length], ['stacked', [], 1]);
  md = fs.readFileSync(second.result, 'utf8');
  assert.match(md, /This comparison replaces an earlier one, set aside on 2026-04-05\. The reason given: "The stacked candidate reworded the button\." Captured again: `stacked`\. The earlier comparisons and their result \(`split` preferred\) are in `earlier\/1\/`\./);
  assert.match(md, /## Besides the arrangement\n\nAt the steps compared, the pages of every candidate say what the pages of `current` say, line for line\./);
  uxq(['study', 'pick', ...sArgs, '--candidate', 'stacked', '--by', 'Ada']);
  assert.match(redo(['--why', 'Again.', '--recapture', 'all']).stderr, /this study is settled: Ada picked stacked.*A choice already made is not compared again/);

  // Before any reviewer is started there is nothing to set aside.
  const other = json(uxq(['study', 'open', ...cfgArgs, '--unit', 'pay-invoice', '--steps', '01-open', '--candidates', 'rail,tabs']));
  assert.match(uxq(['study', 'redo', ...cfgArgs, '--study', other.study_dir, '--why', 'Wrong branch.', '--recapture', 'all'], { allowFail: true }).stderr, /no reviewer has been started for this study/);
  // Pages that were never captured are said, not taken as the same.
  assert.deepStrictEqual(json(uxq(['study', 'text', ...cfgArgs, '--study', other.study_dir], { allowFail: true })).candidates.map((c) => [c.same, c.not_read.length]), [[false, 2], [false, 2]]);
  fs.rmSync(t.root, { recursive: true, force: true });
});
