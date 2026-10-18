#!/usr/bin/env node
/**
 * Regression tests for sdd.cjs pipeline state: stage order, Stage 00 resume, slice cap, swarm round count.
 * Black-box: each test runs the real CLI with --root against a throwaway project.
 * Lives outside specs/ so projects created from the template do not copy it.
 *
 *   node --test tests/*.test.cjs
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TEMPLATE = path.resolve(__dirname, '..');
const SDD = path.join(TEMPLATE, 'specs/.sdd/scripts/sdd.cjs');
const EXAMPLE = path.join(TEMPLATE, 'specs/.sdd/_config/examples/notes-service/specs');

/** A throwaway project; with `example`, its specs/ is the notes-service frozen set (sdd.cjs check passes). */
function project({ example = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-test-'));
  const specs = path.join(root, 'specs');
  if (example) fs.cpSync(EXAMPLE, specs, { recursive: true });
  fs.mkdirSync(path.join(specs, '.sdd/_config'), { recursive: true });
  fs.mkdirSync(path.join(specs, 'logs'), { recursive: true });
  const at = rel => path.join(root, rel);
  return {
    root,
    at,
    write: (rel, text) => fs.writeFileSync(at(rel), text),
    read: rel => fs.readFileSync(at(rel), 'utf8'),
    json: rel => JSON.parse(fs.readFileSync(at(rel), 'utf8')),
    state: s => fs.writeFileSync(at('specs/.sdd/_config/sdd-state.json'), JSON.stringify({ projectType: 'backend-service', ...s })),
    sdd: (...args) => {
      const r = spawnSync(process.execPath, [SDD, ...args, '--root', root], { encoding: 'utf8' });
      return { code: r.status, out: r.stdout + r.stderr };
    },
  };
}

const freeze = p => assert.equal(p.sdd('freeze', '--reason', 'test', '--approved-by', 'tester').code, 0);
const swarmLog = n => Array.from({ length: n }, (_, i) => `## 🔄 Iteration ${i + 1} (round ${i + 1} of max 3 — full)\n`).join('\n');

// ---------- A1: Stage 00 resume and stage order ----------

test('A1: Stage 00 --resume 04 leads to Stage 04, not back to 03p', () => {
  const p = project({ example: true });
  freeze(p);
  p.state({ lastCompletedStep: 7, stepName: '07_verification_before_completion' });
  p.write('specs/backprop-log.md', '## SCR-001\n');
  const t = p.sdd('transition', '--completed', '00', '--resume', '04');
  assert.equal(t.code, 0, t.out);
  assert.equal(p.json('specs/.sdd/_config/sdd-state.json').lastCompletedStep, 3);
  assert.match(p.sdd('status').out, /Next stage: 04_writing_implementation_phases/);
  assert.match(p.sdd('transition', '--completed', '04').out, /✓ resuming after Stage 00/);
});

test('A1: Stage 04 still requires 03p after Stage 02', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 3, stepName: '02_adversarial_swarm_analysis' });
  assert.match(p.sdd('status').out, /Next stage: 03p_prototype/);
  assert.match(p.sdd('transition', '--completed', '04').out, /✗ 03p_prototype has not been completed/);
});

test('A1: --resume accepts only 01|01b|02|04|05', () => {
  const p = project({ example: true });
  for (const target of ['03', '03p']) {
    const t = p.sdd('transition', '--completed', '00', '--resume', target);
    assert.notEqual(t.code, 0);
    assert.match(t.out, /is not a resume target: use one of 01\|01b\|02\|04\|05/);
    assert.match(t.out, /resume at 02/);
  }
  assert.match(p.sdd('transition', '--completed', '00', '--resume', '06').out, /is not a resume target/);
  assert.match(p.sdd('transition', '--completed', '00', '--resume', '00').out, /is not a resume target/);
});

test('A1: non-UI project at lastCompletedStep 2 goes to 03p', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 2, stepName: '02_adversarial_swarm_analysis' });
  assert.match(p.sdd('status').out, /Next stage: 03p_prototype/);
  assert.match(p.sdd('transition', '--completed', '03p').out, /✓ prototype on the reviewed spec draft/);
});

// ---------- A2: slice cap counts the slice, not the whole contract ----------

test('A2: first slice counts every declared outcome', () => {
  const p = project({ example: true });
  assert.match(p.sdd('readiness').out, /slice:\s+30 new declared outcome\(s\) \(cap 150\); 30 in total/);
});

test('A2: freeze records outcomes; the next slice counts only new ones', () => {
  const p = project({ example: true });
  freeze(p);
  const lock = p.json('specs/spec.lock.json');
  assert.equal(lock.outcomes.length, 30);
  assert.match(p.sdd('verify').out, /frozen set intact/, 'outcomes are not part of the lock hash');
  assert.match(p.sdd('readiness').out, /slice:\s+0 new declared outcome\(s\) \(cap 150\); 30 in total/);

  // Simulate a previous slice that froze only 10 of today's outcomes, with a cap of 15.
  p.write('specs/spec.lock.json', JSON.stringify({ ...lock, outcomes: lock.outcomes.slice(0, 10) }));
  const manifest = p.json('specs/contracts/manifest.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...manifest, sliceCap: 15 }));
  const over = p.sdd('readiness').out;
  assert.match(over, /slice:\s+20 new declared outcome\(s\) \(cap 15\); 30 in total/);
  assert.match(over, /✗ slice adds 20 declared outcome\(s\), cap 15 \(30 in total\)/);

  p.write('specs/spec.lock.json', JSON.stringify({ ...lock, outcomes: lock.outcomes.slice(0, 20) }));
  const under = p.sdd('readiness').out;
  assert.match(under, /slice:\s+10 new declared outcome\(s\) \(cap 15\)/);
  assert.doesNotMatch(under, /slice adds/);
});

test('A2: a lock that predates outcome recording reports the slice as unknown', () => {
  const p = project({ example: true });
  freeze(p);
  const { outcomes, ...legacy } = p.json('specs/spec.lock.json');
  p.write('specs/spec.lock.json', JSON.stringify(legacy));
  assert.match(p.sdd('readiness').out, /slice:\s+unknown \(lock predates outcome recording\) \(cap 150\); 30 in total/);
});

// ---------- A3: swarm rounds count only the current iteration ----------

test('A3: swarm rounds restart at the transition that opens a new iteration', () => {
  const p = project({ example: true });
  p.write('specs/logs/02-swarm.md', swarmLog(3));
  assert.match(p.sdd('readiness').out, /swarm:\s+3 Red Team round\(s\)/);

  p.state({ lastCompletedStep: 7, stepName: '07_verification_before_completion' });
  const t = p.sdd('transition', '--completed', '01');
  assert.equal(t.code, 0, t.out);
  const last = p.read('specs/logs/transitions.jsonl').trim().split('\n').pop();
  assert.equal(JSON.parse(last).swarmHeadings, 3);
  assert.doesNotMatch(p.sdd('readiness').out, /swarm:/, 'no rounds logged in the new iteration yet');

  p.write('specs/logs/02-swarm.md', swarmLog(3) + '\n' + swarmLog(1));
  assert.match(p.sdd('readiness').out, /swarm:\s+1 Red Team round\(s\)/);
});

// ---------- A4: Stage 00 needs a lock ----------

test('A4: Stage 00 refuses before the first freeze and points to GAPS.md', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 2, stepName: '02_adversarial_swarm_analysis' });
  p.write('specs/backprop-log.md', '## SCR-001\n');
  const t = p.sdd('transition', '--completed', '00', '--resume', '05');
  assert.equal(t.code, 1);
  assert.match(t.out, /✗ no specs\/spec\.lock\.json: nothing is frozen yet, so a defect is not a Class 2 change/);
  assert.equal(p.json('specs/.sdd/_config/sdd-state.json').lastCompletedStep, 2, 'state unchanged');
  assert.match(p.sdd('status').out, /lock:\s+none .* specs\/GAPS\.md row instead of running Stage 00/);
});

// ---------- Prototype-first order: 02 → 03p → (03, UI) → 04 ----------

const L = require('../specs/.sdd/scripts/sdd-lib.cjs');
const uiManifest = p => {
  const m = p.json('specs/contracts/manifest.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, projectType: 'fullstack-app', interfaces: ['http', 'browser'] }));
};

test('order: non-UI 02 → 03p → 04; UI 02 → 03p → 03 → 04', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 2, stepName: '02_adversarial_swarm_analysis' });
  assert.match(p.sdd('status').out, /Next stage: 03p_prototype/);
  p.state({ lastCompletedStep: 3, stepName: '03p_prototype' });
  assert.match(p.sdd('status').out, /Next stage: 04_writing_implementation_phases/);
  assert.match(p.sdd('transition', '--completed', '04').out, /✓ next stage after the accepted prototype/);

  uiManifest(p);
  p.state({ lastCompletedStep: 2, stepName: '02_adversarial_swarm_analysis' });
  assert.match(p.sdd('status').out, /Next stage: 03p_prototype/);
  assert.match(p.sdd('transition', '--completed', '03').out, /✗ 03p_prototype has not been completed: wireframes are captured from the accepted prototype/);
  p.state({ lastCompletedStep: 3, stepName: '03p_prototype' });
  assert.match(p.sdd('status').out, /Next stage: 03_interactive_wireframing/);
  assert.match(p.sdd('transition', '--completed', '04').out, /✗ 03_interactive_wireframing has not been completed/);
  assert.match(p.sdd('transition', '--completed', '03').out, /✓ wireframes captured from the accepted prototype/);
  // 04 after 03 needs 03p in this iteration's transitions, not just a stepName.
  p.state({ lastCompletedStep: 3, stepName: '03_interactive_wireframing' });
  assert.match(p.sdd('transition', '--completed', '04').out, /✗ 03p_prototype has not been completed/);
  p.write('specs/logs/transitions.jsonl', [
    JSON.stringify({ ts: '2026-01-01T00:00:00Z', completed: '01_brainstorming' }),
    JSON.stringify({ ts: '2026-01-02T00:00:00Z', completed: '03p_prototype', approvedBy: 'tester' }),
    JSON.stringify({ ts: '2026-01-03T00:00:00Z', completed: '03_interactive_wireframing' }),
  ].join('\n') + '\n');
  assert.match(p.sdd('transition', '--completed', '04').out, /✓ next stage after the accepted prototype and its wireframes/);
});

test('03p: acceptance comes from --approved-by, never from a line the agent types', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 2, stepName: '02_adversarial_swarm_analysis' });
  p.write('specs/logs/03p-prototype.md', '# Prototype record\n**Run:** docker compose up -d\n**User acceptance:** ACCEPTED\n');
  const t = p.sdd('transition', '--completed', '03p');
  assert.equal(t.code, 1);
  assert.match(t.out, /✗ missing --approved-by "<user>"/);
  assert.match(t.out, /✓ specs\/logs\/03p-prototype.md: run command recorded/);
  assert.match(p.sdd('transition', '--completed', '03p', '--approved-by', 'Wil').out, /✓ prototype accepted by Wil/);
  assert.doesNotMatch(p.sdd('readiness').out, /approved-by/, 'readiness is a report, not a transition');
});

test('03p on an iteration: existing cases must stay green unless DECISION_LOG names them', () => {
  const p = project({ example: true });
  freeze(p);
  p.state({ lastCompletedStep: 2, stepName: '02_adversarial_swarm_analysis', timestamp: '2026-01-01T00:00:00Z' });
  fs.mkdirSync(p.at('specs/logs/oracle'), { recursive: true });
  const report = results => p.write('specs/logs/oracle/run-default.json', JSON.stringify({
    target: 'default', fixturesHash: L.hashTree(p.at('specs/fixtures/cases')), filtered: false, finishedAt: new Date().toISOString(),
    total: results.length, passed: results.filter(r => r.status === 'pass').length, failed: results.filter(r => r.status !== 'pass').length, errored: 0, results,
  }));
  assert.match(p.sdd('readiness').out, /✗ iteration regression .*: no unfiltered oracle run/);
  report([{ id: 'NOTE-001', status: 'pass' }, { id: 'NOTE-002', status: 'fail' }]);
  assert.match(p.sdd('readiness').out, /✗ iteration regression .*: 1 existing case\(s\) fail without a DECISION_LOG entry naming them \(NOTE-002\)/);
  fs.appendFileSync(p.at('specs/DECISION_LOG.md'), '| DEC007 | Change X | a, b | b | user decided | NOTE-002 |\n');
  // readiness prints only failing gates; the passing gate shows in the transition output.
  assert.match(p.sdd('transition', '--completed', '03p').out, /✓ iteration regression .*: 1\/2 passed; 1 declared behavior change\(s\)/);
});

test('07: equivalenceCadence "release" certifies L1 with an explicit L2 pending row unless --release', () => {
  const p = project({ example: true });
  freeze(p);
  p.state({ lastCompletedStep: 6, stepName: '05_development_swarm' });
  const m = p.json('specs/contracts/manifest.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, equivalenceCadence: 'release' }));
  freeze(p); // the manifest is frozen
  p.write('specs/EQUIVALENCE_REPORT.md', '# Equivalence Report\n| Certified level | L1 Oracle-conformant |\n');
  assert.match(p.sdd('transition', '--completed', '07').out, /✗ equivalenceCadence "release": EQUIVALENCE_REPORT.md must state "L2 pending"/);
  p.write('specs/EQUIVALENCE_REPORT.md', '# Equivalence Report\n| Certified level | L1 Oracle-conformant, L2 pending |\n');
  const t = p.sdd('transition', '--completed', '07').out;
  assert.match(t, /✓ equivalenceCadence "release": this slice certifies L1/);
  assert.doesNotMatch(t, /no oracle diff report/);
  assert.match(p.sdd('transition', '--completed', '07', '--release').out, /✗ no oracle diff report between two independent builds/);
});

test('check: warns when SPEC.md is too large to be read in one pass', () => {
  const p = project({ example: true });
  assert.doesNotMatch(p.sdd('check', '--contracts').out, /SPEC.md is \d+ KB/);
  p.write('specs/SPEC.md', p.read('specs/SPEC.md') + '\n' + 'x'.repeat(130 * 1024));
  assert.match(p.sdd('check', '--contracts').out, /specs\/SPEC.md is 1\d\d KB \(> 120 KB\)/);
});

test('status: deferred gaps are shown as next-slice candidates', () => {
  const p = project({ example: true });
  p.write('specs/GAPS.md', '# Gaps\n| ID | Stage | Kind | Gap | Draft assumption | Status |\n|---|---|---|---|---|---|\n| G-001 | 01 | policy | Tags on notes | none (DEC001) | deferred |\n| G-002 | 03p | builder | Toast text | "Saved" | open |\n');
  assert.match(p.sdd('status').out, /gaps:\s+1 open in specs\/GAPS.md \(0 policy, need the user\), 1 deferred \(next-slice candidates\)/);
});

// ---------- Spec text checks (the mechanical half of the former self-review), modules, exemption classes ----------

test('check: spec modules under specs/spec/ are frozen, must be linked from SPEC.md, and contribute invariants', () => {
  const p = project({ example: true });
  fs.mkdirSync(p.at('specs/spec'), { recursive: true });
  p.write('specs/spec/publishing.md', '# Publishing\n\n- **V9:** a published note is never edited.\n');
  let out = p.sdd('check').out;
  assert.match(out, /✗ specs\/spec\/publishing.md is not linked from specs\/SPEC.md/);
  p.write('specs/SPEC.md', p.read('specs/SPEC.md') + '\n## Modules\n- [Publishing](spec/publishing.md)\n');
  out = p.sdd('check').out;
  assert.doesNotMatch(out, /is not linked/);
  assert.match(out, /spec: 2 file\(s\), \d+ KB \(1 module\(s\)/);
  assert.match(out, /invariants in SPEC.md: 5/);
  assert.match(out, /uncovered .*inv:V9/, 'a module invariant needs coverage like any other');
  p.write('specs/spec/publishing.md', '# Publishing\n\nPublished notes are read-only (SPEC §5.2, V2).\n');
  freeze(p);
  assert.match(p.read('specs/spec.lock.json'), /specs\/spec\/publishing.md/, 'modules are part of the frozen set');
});

test('check: placeholders are errors, hedged parameters are warnings, missing sections are errors', () => {
  const p = project({ example: true });
  const spec = p.read('specs/SPEC.md');
  p.write('specs/SPEC.md', spec.replace('## 13. Limits & Non-Functional', '## 13. Limits & Non-Functional\n- Retention: TBD\n- Cleanup runs periodically, approximately 5 minutes apart\n'));
  const out = p.sdd('check', '--contracts').out;
  assert.match(out, /✗ specs\/SPEC.md:\d+: placeholder "TBD"/);
  assert.match(out, /⚠ 2 unquantified parameter\(s\)/);
  assert.match(out, /interval not defined: "periodically"/);
  p.write('specs/SPEC.md', spec.replace('## 12. Configuration', '## Configuration'));
  assert.match(p.sdd('check', '--contracts').out, /✗ spec is missing section\(s\) §12/);
});

test('check: profile overrides must agree between SPEC §11 and the manifest', () => {
  const p = project({ example: true });
  const m = p.json('specs/contracts/manifest.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, profileOverrides: [{ rule: 'PAGE-1', override: 'default page size 50 instead of 20', decision: 'DEC006' }] }));
  assert.match(p.sdd('check', '--contracts').out, /✗ profile override PAGE-1 is in manifest.profileOverrides but not in SPEC §11/);
  p.write('specs/SPEC.md', p.read('specs/SPEC.md').replace('## 11. Equivalence Profile Overrides\nNone.', '## 11. Equivalence Profile Overrides\n| Rule | Override | Decision |\n|---|---|---|\n| PAGE-1 | default 50 | DEC006 |\n| IDEM-2 | 48h window | DEC006 |'));
  const out = p.sdd('check', '--contracts').out;
  assert.doesNotMatch(out, /PAGE-1 is in manifest/);
  assert.match(out, /✗ profile override IDEM-2 is in SPEC §11 but not in manifest.profileOverrides/);
});

test('check: coverage exemptions accept wildcards and reviewable classes', () => {
  const p = project({ example: true });
  const m = p.json('specs/contracts/manifest.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({
    ...m,
    coverageExempt: { 'error:INTERNAL_*': { class: 'fault-injection-only' }, 'op:getHealth:422': 'Health takes no input, so its 422 is declared only by the shared Problem response and cannot be triggered.' },
    coverageExemptClasses: { 'fault-injection-only': 'Cannot be triggered black-box without fault injection, which the spec does not define.', 'unused-class': 'A class nothing cites, to check the warning text here.' },
  }));
  const out = p.sdd('check').out;
  assert.match(out, /coverage exemptions: fault-injection-only 1 · \(uncategorized\) 1/);
  assert.match(out, /⚠ manifest.coverageExemptClasses "unused-class" is used by no exemption/);
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, coverageExempt: { 'error:INTERNAL_ERROR': { class: 'nope' } } }));
  assert.match(p.sdd('check').out, /✗ manifest.coverageExempt "error:INTERNAL_ERROR" cites class "nope", which is not in manifest.coverageExemptClasses/);
});

test('transition: every record carries stage metrics (counts, never a score)', () => {
  const p = project({ example: true });
  p.write('specs/GAPS.md', '# Gaps\n| ID | Stage | Kind | Gap | Draft assumption | Status |\n|---|---|---|---|---|---|\n| G-001 | 01 | policy | Tags | later (DEC001) | deferred |\n');
  p.state({ lastCompletedStep: 7, stepName: '07_verification_before_completion' });
  assert.equal(p.sdd('transition', '--completed', '01').code, 0);
  const rec = JSON.parse(p.read('specs/logs/transitions.jsonl').trim().split('\n').pop());
  assert.deepEqual(rec.metrics, { swarmRounds: 0, gapsOpen: 0, gapsDeferred: 1, gapsTotal: 1, rulings: 6, declaredOutcomes: 30, cases: 155, probes: 100 });
});

test('diff-expect: notational differences are not gaps (anchored literal regex, $eq, $oneOf order)', () => {
  const p = project({ example: true });
  const ORACLE = path.join(TEMPLATE, 'specs/.sdd/scripts/oracle.cjs');
  const mk = (expectBody) => ({ suite: 'interp', cases: [{ id: 'X-001', title: 'Predict: GET /notes', phase: 1, derivedFrom: ['SPEC §5.1'], steps: [{ http: { method: 'GET', path: '/notes' }, expect: { status: 200, body: expectBody } }] }] });
  fs.mkdirSync(p.at('a')); fs.mkdirSync(p.at('b'));
  p.write('a/c.json', JSON.stringify(mk({ status: 'draft', kind: { $oneOf: ['a', 'b'] }, etag: '"v1"', n: 1 })));
  p.write('b/c.json', JSON.stringify(mk({ status: { $regex: '^draft$' }, kind: { $oneOf: ['b', 'a'] }, etag: { $eq: '"v1"' }, n: 2 })));
  const r = spawnSync(process.execPath, [ORACLE, 'diff-expect', '--a', p.at('a'), '--b', p.at('b'), '--label', 't', '--root', p.root], { encoding: 'utf8' });
  const out = r.stdout + r.stderr;
  assert.match(out, /1 case\(s\) compared: 1 with gaps, 1 gap\(s\)/, out);
  assert.match(out, /steps\[0\]\.expect\.body\.n: different values/);
  assert.doesNotMatch(out, /body\.status|body\.kind|body\.etag/);
});
