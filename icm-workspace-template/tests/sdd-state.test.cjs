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

test('A1: Stage 00 --resume 04 leads to Stage 04, not back to the prototype', () => {
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

test('A1: Stage 00 --resume 02 reworks the prototype; --resume 03 re-hardens', () => {
  const p = project({ example: true });
  freeze(p);
  p.write('specs/backprop-log.md', '## SCR-001\n');
  p.state({ lastCompletedStep: 7, stepName: '07_verification_before_completion' });
  assert.equal(p.sdd('transition', '--completed', '00', '--resume', '02').code, 0);
  assert.match(p.sdd('status').out, /Next stage: 02_prototype/);
  p.state({ lastCompletedStep: 7, stepName: '07_verification_before_completion' });
  assert.equal(p.sdd('transition', '--completed', '00', '--resume', '03').code, 0);
  assert.match(p.sdd('status').out, /Next stage: 03_hardening/);
});

test('A1: Stage 04 is out of order before hardening', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 2, stepName: '02_prototype' });
  assert.match(p.sdd('status').out, /Next stage: 03_hardening/);
  assert.match(p.sdd('transition', '--completed', '04').out, /✗ 04_writing_implementation_phases is out of order: lastCompletedStep=2/);
});

test('A1: --resume accepts only 01|01b|02|03|04|05', () => {
  const p = project({ example: true });
  for (const target of ['06', '00', '07']) {
    const t = p.sdd('transition', '--completed', '00', '--resume', target);
    assert.notEqual(t.code, 0);
    assert.match(t.out, /is not a resume target: use one of 01\|01b\|02\|03\|04\|05/);
  }
  assert.equal(p.sdd('transition', '--completed', '00', '--resume', '03p').code, 2, 'the old 03p stage id is gone');
});

test('A1: every project type goes 01 → 02 prototype → 03 hardening → 04', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 1, stepName: '01_brainstorming' });
  assert.match(p.sdd('status').out, /Next stage: 02_prototype/);
  assert.match(p.sdd('transition', '--completed', '02').out, /✓ prototype of the slice brief/);
  assert.match(p.sdd('transition', '--completed', '03').out, /✗ 03_hardening is out of order/);
  p.state({ lastCompletedStep: 1, stepName: '01b_adoption' });
  assert.match(p.sdd('transition', '--completed', '02').out, /✓ walkthrough of the adopted system as the prototype/);
  assert.match(p.sdd('transition', '--completed', '04').out, /✗ 04_writing_implementation_phases is out of order/, 'no freeze-as-is shortcut: an adopted codebase still goes through 02 and 03');
});

test('01b: inventory + draft — the same gates as 01 (draft sections, interview log, placeholders allowed), then 02 is the walkthrough', () => {
  const p = project({ example: true });
  fs.rmSync(p.at('specs/contracts'), { recursive: true });
  fs.rmSync(p.at('specs/logs/01-interview.md'));
  p.state({ lastCompletedStep: -1, stepName: 'Pending Adoption' });
  assert.match(p.sdd('status').out, /Next stage: 01b_adoption/);
  p.write('specs/SPEC.md', p.read('specs/SPEC.md').replace('## 13. Limits & Non-Functional', '## 13. Limits & Non-Functional\nTBD — Stage 03\n'));
  let t = p.sdd('transition', '--completed', '01b', '--project-type', 'backend-service');
  assert.equal(t.code, 1);
  assert.match(t.out, /✓ adoption of an existing codebase/);
  assert.match(t.out, /✓ SPEC.md draft: §0, §1, §3, §4, §5 filled \(placeholders elsewhere are allowed until Stage 03\)/);
  assert.match(t.out, /✗ missing specs\/logs\/01-interview.md \(one row per question asked\)/);
  p.write('specs/logs/01-interview.md', '# Interview\n| # | Question | Answer | Recorded in |\n|---|---|---|---|\n| 1 | Is the published state intended to be terminal? | Yes | DEC002 |\n');
  t = p.sdd('transition', '--completed', '01b', '--project-type', 'backend-service');
  assert.equal(t.code, 0, t.out);
  assert.match(t.out, /✓ specs\/logs\/01-interview.md: 1 question\(s\) \(budget 12\)/);
  assert.match(p.sdd('status').out, /Next stage: 02_prototype/);
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
  p.write('specs/logs/03-swarm.md', swarmLog(3));
  assert.match(p.sdd('readiness').out, /Red Team 3\/3 round\(s\)/);

  p.state({ lastCompletedStep: 7, stepName: '07_verification_before_completion' });
  const t = p.sdd('transition', '--completed', '01');
  assert.equal(t.code, 0, t.out);
  const last = p.read('specs/logs/transitions.jsonl').trim().split('\n').pop();
  assert.equal(JSON.parse(last).swarmHeadings, 3);
  assert.match(p.sdd('readiness').out, /Red Team 0\/3 round\(s\)/, 'no rounds logged in the new iteration yet');

  p.write('specs/logs/03-swarm.md', swarmLog(3) + '\n' + swarmLog(1));
  assert.match(p.sdd('readiness').out, /Red Team 1\/3 round\(s\)/);
});

// ---------- A4: Stage 00 needs a lock ----------

test('A4: Stage 00 refuses before the first freeze and points to GAPS.md', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 2, stepName: '02_prototype' });
  p.write('specs/backprop-log.md', '## SCR-001\n');
  const t = p.sdd('transition', '--completed', '00', '--resume', '05');
  assert.equal(t.code, 1);
  assert.match(t.out, /✗ no specs\/spec\.lock\.json: nothing is frozen yet, so a defect is not a Class 2 change/);
  assert.equal(p.json('specs/.sdd/_config/sdd-state.json').lastCompletedStep, 2, 'state unchanged');
  assert.match(p.sdd('status').out, /lock:\s+none .* specs\/GAPS\.md row instead of running Stage 00/);
});

// ---------- Prototype-first order: 01 → 02 prototype → 03 hardening (+ wireframes for UI) → 04 ----------

const L = require('../specs/.sdd/scripts/sdd-lib.cjs');
const uiManifest = p => {
  const m = p.json('specs/contracts/manifest.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, projectType: 'fullstack-app', interfaces: ['http', 'browser'] }));
};
const PROTOTYPE_RECORD = '# Prototype record\n**Run:** docker compose up -d\n\n| Version | Date | Changed | Gaps closed | Decisions |\n|---|---|---|---|---|\n| v0 | 2026-01-01 | first demo | — | — |\n';

test('order: the same linear path for UI and non-UI projects; 06 only for UI', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 2, stepName: '02_prototype' });
  assert.match(p.sdd('status').out, /Next stage: 03_hardening/);
  p.state({ lastCompletedStep: 3, stepName: '03_hardening' });
  assert.match(p.sdd('status').out, /Next stage: 04_writing_implementation_phases/);
  assert.match(p.sdd('transition', '--completed', '04').out, /✓ next stage after lastCompletedStep=3/);
  p.state({ lastCompletedStep: 4, stepName: '04_writing_implementation_phases' });
  assert.match(p.sdd('transition', '--completed', '06').out, /✗ 06_visual_acceptance_testing applies only to UI projects/);

  uiManifest(p);
  p.state({ lastCompletedStep: 2, stepName: '02_prototype' });
  assert.match(p.sdd('status').out, /Next stage: 03_hardening/);
  const t = p.sdd('transition', '--completed', '03').out;
  assert.match(t, /✗ no wireframes in specs\/wireframes\/ \(UI project: capture every screen state from the prototype/);
  assert.match(t, /✗ DESIGN.md §Approved Wireframes links wireframes/);
  p.state({ lastCompletedStep: 5, stepName: '05_development_swarm' });
  assert.match(p.sdd('status').out, /Next stage: 06_visual_acceptance_testing/);
});

test('02: acceptance comes from --approved-by, never from a line the agent types; no contracts or rounds yet', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 1, stepName: '01_brainstorming' });
  fs.rmSync(p.at('specs/contracts'), { recursive: true });
  p.write('specs/logs/02-prototype.md', '# Prototype record\n**Run:** docker compose up -d\n**User acceptance:** ACCEPTED\n');
  let t = p.sdd('transition', '--completed', '02');
  assert.equal(t.code, 1);
  assert.match(t.out, /✗ missing --approved-by "<user>"/);
  assert.match(t.out, /✗ specs\/logs\/02-prototype.md: no Versions table/);
  assert.doesNotMatch(t.out, /Red Team|check --contracts|rulings/, 'the prototype stage asks for no hardening artifact');
  p.write('specs/logs/02-prototype.md', PROTOTYPE_RECORD);
  t = p.sdd('transition', '--completed', '02');
  assert.match(t.out, /✓ specs\/logs\/02-prototype.md: run command recorded, 1 prototype version\(s\) shown/);
  assert.match(p.sdd('transition', '--completed', '02', '--approved-by', 'Wil').out, /✓ prototype accepted by Wil/);
  assert.doesNotMatch(p.sdd('readiness').out, /missing --approved-by/, 'readiness is a report, not a transition');
  const rec = JSON.parse(p.read('specs/logs/transitions.jsonl').trim().split('\n').pop());
  assert.equal(rec.approvedBy, 'Wil');
});

test('03: hardening needs valid contracts, a complete spec, the Outcome Table, the inventory, rounds, rulings and the sampled diff', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 2, stepName: '02_prototype' });
  fs.rmSync(p.at('specs/logs/03-swarm.md'), { force: true });
  let t = p.sdd('transition', '--completed', '03').out;
  assert.match(t, /✓ sdd.cjs check --contracts passes \(contracts valid, spec complete\)/);
  assert.match(t, /✗ missing specs\/logs\/03-swarm.md \(Outcome Table \+ Red Team rounds\)/);
  assert.match(t, /✗ specs\/logs\/03-decisions.md was not updated during this stage|✓ specs\/logs\/03-decisions.md/);
  assert.match(t, /✗ no Red Team round logged \(round 1 attacks the whole slice with the prototype running; `## 🔄 Iteration 1` heading in specs\/logs\/03-swarm.md\)/);
  assert.match(t, /✗ no interpretation diff of the Outcome Table/);
  assert.doesNotMatch(t, /--approved-by/, 'acceptance was given in Stage 02');
  // A placeholder left in the spec blocks hardening (it was fine in Stages 01–02).
  p.write('specs/SPEC.md', p.read('specs/SPEC.md').replace('## 13. Limits & Non-Functional', '## 13. Limits & Non-Functional\n- Retention: TBD — Stage 03\n'));
  t = p.sdd('transition', '--completed', '03').out;
  assert.match(t, /✗ sdd.cjs check --contracts: 1 error\(s\) \(contracts valid, spec complete: no placeholders, every section\)/);
});

test('02 on an iteration: existing cases must stay green unless DECISION_LOG names them', () => {
  const p = project({ example: true });
  freeze(p);
  p.state({ lastCompletedStep: 1, stepName: '01_brainstorming', timestamp: '2026-01-01T00:00:00Z' });
  p.write('specs/logs/02-prototype.md', PROTOTYPE_RECORD);
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
  assert.match(p.sdd('transition', '--completed', '02').out, /✓ iteration regression .*: 1\/2 passed; 1 declared behavior change\(s\)/);
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
  p.write('specs/GAPS.md', '# Gaps\n| ID | Stage | Kind | Gap | Draft assumption | Status |\n|---|---|---|---|---|---|\n| G-001 | 01 | policy | Tags on notes | none (DEC001) | deferred |\n| G-002 | 03 | builder | Toast text | "Saved" | open |\n');
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

test('check --spec: the Stage 01 draft may keep placeholders; the sections a prototype needs must be filled', () => {
  const p = project({ example: true });
  fs.rmSync(p.at('specs/contracts'), { recursive: true });
  p.state({ lastCompletedStep: 0, stepName: 'Project Initialization', projectType: 'backend-service' });
  const spec = p.read('specs/SPEC.md');
  p.write('specs/SPEC.md', spec.replace('## 13. Limits & Non-Functional', '## 13. Limits & Non-Functional\nTBD — Stage 03\n').replace('## 12. Configuration', '## Configuration'));
  let out = p.sdd('check', '--spec');
  assert.equal(out.code, 0, out.out);
  assert.match(out.out, /· draft: 1 placeholder\(s\) left for Stage 03/);
  assert.match(out.out, /⚠ spec is missing section\(s\) §12/);
  assert.match(out.out, /· draft sections filled: §0, §1, §3, §4, §5 \(the prototype can be built\)/);
  // The 01 gate: §5 reduced to a placeholder blocks the transition; a placeholder in §13 does not.
  p.write('specs/logs/01-interview.md', '# Interview\n| # | Question | Answer | Recorded in |\n|---|---|---|---|\n| 1 | Q? | A | DEC001 |\n');
  let t = p.sdd('transition', '--completed', '01', '--project-type', 'backend-service');
  assert.equal(t.code, 0, t.out);
  assert.match(t.out, /✓ SPEC.md draft: §0, §1, §3, §4, §5 filled \(placeholders elsewhere are allowed until Stage 03\)/);
  p.write('specs/SPEC.md', p.read('specs/SPEC.md').replace(/## 5\. Operations[\s\S]*?(?=## 6\.)/, '## 5. Operations\nTBD\n\n'));
  t = p.sdd('transition', '--completed', '01', '--project-type', 'backend-service');
  assert.equal(t.code, 1);
  assert.match(t.out, /✗ SPEC.md draft: section\(s\) §5 missing or still a placeholder/);
  assert.match(p.sdd('check', '--spec').out, /draft sections still to fill before the prototype: §5/);
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
  assert.deepEqual(rec.metrics, { swarmRounds: 0, gapsOpen: 0, gapsDeferred: 1, gapsTotal: 1, rulings: 6, interviewQuestions: 6, prototypeVersions: 3, declaredOutcomes: 30, cases: 155, probes: 100 });
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

// ---------- Interactive path: open gaps allowed out of 01, interview budget, readiness path ----------

test('01: open policy gaps are allowed (the prototype builds the provisional answer); the interview log is required', () => {
  const p = project({ example: true });
  fs.rmSync(p.at('specs/logs/01-interview.md'));
  p.write('specs/GAPS.md', '# Gaps\n| ID | Stage | Kind | Gap | Draft assumption | Status |\n|---|---|---|---|---|---|\n| G-001 | 01 | policy | Who may delete a shared note? | Owner only | open |\n');
  let t = p.sdd('transition', '--completed', '01', '--project-type', 'backend-service');
  assert.equal(t.code, 1);
  assert.match(t.out, /✗ missing specs\/logs\/01-interview.md \(one row per question asked\)/);
  assert.match(t.out, /✓ specs\/GAPS.md: 1 row\(s\), 1 open \(allowed until Stage 04\)/);
  const rows = Array.from({ length: 14 }, (_, i) => `| ${i + 1} | Q${i + 1}? | A${i + 1} | DEC001 |`).join('\n');
  p.write('specs/logs/01-interview.md', `# Interview\n| # | Question | Answer | Recorded in |\n|---|---|---|---|\n${rows}\n`);
  t = p.sdd('transition', '--completed', '01', '--project-type', 'backend-service');
  assert.equal(t.code, 0, t.out);
  assert.match(t.out, /✓ specs\/logs\/01-interview.md: 14 question\(s\) \(budget 12\) — over budget: the rest belongs in the prototype demos/);
});

test('01 → 02 without any contract: the status after the interview asks only for the prototype', () => {
  const p = project({ example: true });
  fs.rmSync(p.at('specs/contracts'), { recursive: true });
  fs.rmSync(p.at('specs/logs/02-prototype.md'));
  p.state({ lastCompletedStep: 1, stepName: '01_brainstorming' });
  const out = p.sdd('status').out;
  assert.match(out, /Exit gates for 02/);
  assert.doesNotMatch(out, /Red Team round|rulings|check --contracts|Outcome Table/);
  assert.match(out, /✗ missing specs\/logs\/02-prototype.md \(prototype record\)/);
  assert.match(p.sdd('readiness').out, /slice:\s+no contracts yet \(Stage 03 compiles them against the accepted prototype\)/);
});

test('readiness: budgets, the user\'s open questions verbatim, and the path to a full spec', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 1, stepName: '01_brainstorming' });
  p.write('specs/GAPS.md', '# Gaps\n| ID | Stage | Kind | Gap | Draft assumption | Status |\n|---|---|---|---|---|---|\n| G-001 | 01 | policy | Who may delete a shared note? | Owner only (DEC001, provisional) | open |\n| G-002 | 03 | builder | Toast text | "Saved" | open |\n');
  const out = p.sdd('readiness').out;
  assert.match(out, /budget:\s+interview 6\/12 question\(s\) · prototype 3\/3 version\(s\) · Red Team 0\/3 round\(s\)/);
  assert.match(out, /your questions \(1 open policy gap\(s\)/);
  assert.match(out, /G-001: Who may delete a shared note\? — provisional: Owner only \(DEC001, provisional\)/);
  assert.match(out, /agent questions: 1 open technical\/builder/);
  assert.match(out, /path to a full \(frozen\) spec:\n\s+→ 02: prototype demos/);
  assert.match(out, /\n\s+03: contracts compiled against the prototype, spec completed, Red Team rounds, sampled interpretation diff \(agent/);
  assert.match(out, /\n\s+04: oracle recorded/);
  assert.match(out, /next action \(yours\): try the prototype/);
  assert.match(out, /gates \(all spec stages, freshness ignored\):\n\s+✓ 01 \d+\/\d+\n\s+✓ 02 \d+\/\d+\n\s+✗ 03 \d+\/\d+/);
  const m = p.json('specs/contracts/manifest.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, budgets: { interviewQuestions: 5 } }));
  assert.match(p.sdd('readiness').out, /interview 6\/5 question\(s\) ⚠ over budget/);
  uiManifest(p);
  assert.match(p.sdd('readiness').out, /03: contracts compiled .*, wireframes captured from the prototype \(agent/);
});

// ---------- v3.5: citations credit invariants, rolling cadence, append-only log, agenda, metrics, outline, specgen, upgrade ----------

test('check: invariants credited from derivedFrom citations (explicit covers remains the stronger claim)', () => {
  const p = project({ example: true });
  let out = p.sdd('check').out;
  assert.match(out, /coverage: .*inv 4\/4/);
  // Drop every explicit `covers: inv:` entry: the cases still cite the invariants in derivedFrom, so coverage holds.
  for (const f of fs.readdirSync(p.at('specs/fixtures/cases'))) {
    const doc = p.json(`specs/fixtures/cases/${f}`);
    for (const c of doc.cases) if (c.covers) c.covers = c.covers.filter(x => !x.startsWith('inv:'));
    p.write(`specs/fixtures/cases/${f}`, JSON.stringify(doc));
  }
  out = p.sdd('check').out;
  assert.match(out, /invariants credited from derivedFrom citations: 3/);
  assert.match(out, /coverage: .*inv 3\/4/, 'V2–V4 are cited in derivedFrom; V1 was covered only by an explicit covers entry');
  assert.match(out, /✗ uncovered .*inv:V1/);
});

test('order: rolling cadence lets the next slice\'s brief follow an accepted prototype; the cap still applies at 03', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 2, stepName: '02_prototype' });
  assert.match(p.sdd('transition', '--completed', '01').out, /✗ 01_brainstorming is out of order/);
  const m = p.json('specs/contracts/manifest.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, prototypeCadence: 'rolling' }));
  assert.match(p.sdd('status').out, /rolling cadence: `transition --completed 01` for the next slice is also in order/);
  assert.match(p.sdd('transition', '--completed', '01').out, /✓ rolling prototypes \(manifest.prototypeCadence\)/);
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, prototypeCadence: 'sometimes' }));
  assert.match(p.sdd('check', '--contracts').out, /✗ specs\/contracts\/manifest.json: .*prototypeCadence/);
});

test('decision log: a transition fingerprints the rows; rewriting or removing an earlier row is reported', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 7, stepName: '07_verification_before_completion' });
  assert.equal(p.sdd('transition', '--completed', '01').code, 0);
  assert.ok(fs.existsSync(p.at('specs/logs/decisions.fingerprint.json')));
  assert.doesNotMatch(p.sdd('check', '--contracts').out, /append-only/);
  const log = p.read('specs/DECISION_LOG.md');
  p.write('specs/DECISION_LOG.md', log.replace('| DEC002 | Editing published notes', '| DEC002 | Editing published notes (reworded)'));
  let out = p.sdd('check', '--contracts').out;
  assert.match(out, /⚠ DECISION_LOG.md is append-only, but 1 row\(s\) recorded at .* were rewritten since: DEC002/);
  assert.match(p.sdd('status').out, /log:\s+⚠ DECISION_LOG.md rows rewritten or removed since .*: DEC002/);
  p.write('specs/DECISION_LOG.md', log.split('\n').filter(l => !l.startsWith('| DEC003 ')).join('\n'));
  out = p.sdd('check', '--contracts').out;
  assert.match(out, /⚠ DECISION_LOG.md: 1 row\(s\) recorded at .* are gone: DEC003/);
});

test('agenda: open policy gaps and [PENDING-<ROLE>] decisions, grouped by role; readiness counts the tags', () => {
  const p = project({ example: true });
  p.write('specs/GAPS.md', '# Gaps\n| ID | Stage | Kind | Gap | Draft assumption | Status |\n|---|---|---|---|---|---|\n| G-001 | 01 | policy | Who may delete a shared note? | Owner only (DEC001, provisional) | open |\n| G-002 | 03 | builder | Toast text | "Saved" | open |\n');
  fs.appendFileSync(p.at('specs/DECISION_LOG.md'), '| DEC007 | Ghost timeout [PENDING-SME] | 5, 7 | 7 min | until experts confirm | SPEC §4 |\n| DEC008 | Retention [PENDING-LEGAL] | 1y, 7y | 7y | regulation unknown | SPEC §6 |\n');
  const out = p.sdd('agenda').out;
  assert.match(out, /## Open policy questions for the product owner \(1\)/);
  assert.match(out, /\| G-001 \| Who may delete a shared note\? \| Owner only/);
  assert.match(out, /## Working assumptions pending LEGAL \(1\)[\s\S]*DEC008/);
  assert.match(out, /## Working assumptions pending SME \(1\)[\s\S]*DEC007/);
  assert.match(p.sdd('readiness').out, /pending:\s+2 \[PENDING-<ROLE>\] tag\(s\)/);
  assert.equal(p.sdd('agenda', '--write').code, 0);
  assert.match(p.read('specs/logs/agenda.md'), /# Agenda/);
});

test('metrics: one row per transition; spec-outline: section sizes', () => {
  const p = project({ example: true });
  assert.match(p.sdd('metrics').out, /No transitions yet/);
  p.state({ lastCompletedStep: 7, stepName: '07_verification_before_completion' });
  assert.equal(p.sdd('transition', '--completed', '01').code, 0);
  const out = p.sdd('metrics').out;
  assert.match(out, /date\s+stage completed\s+accepted\s+quest\s+vers\s+rounds/);
  assert.match(out, /01_brainstorming\s+6\s+3\s+0\s+0\s+1\s+6\s+30\s+155\s+100/);
  const o = p.sdd('spec-outline').out;
  assert.match(o, /specs\/SPEC.md — \d+ KB/);
  assert.match(o, /5\. Operations/);
  assert.match(o, /Rule of thumb: one module per surface/);
});

test('ui-specgen: one smoke test per capture record, test ids asserted, observe recorded', () => {
  const p = project({ example: true });
  fs.mkdirSync(p.at('specs/wireframes'), { recursive: true });
  p.write('specs/wireframes/notes-list.capture.json', JSON.stringify({ name: 'notes-list', url: 'http://x/notes', path: '/notes', setup: null, wait: '[data-testid=notes-list]', viewport: { width: 1280, height: 800 }, testids: ['notes-list', 'note-row', 'note-row'], covers: ['inv:V3'] }));
  p.write('specs/wireframes/notes-empty.capture.json', JSON.stringify({ name: 'notes-empty', url: 'http://x/notes', path: '/notes?empty=1', setup: 'specs/wireframes/setup-empty.cjs', wait: null, viewport: { width: 1280, height: 800 }, testids: ['notes-list-empty'], covers: [] }));
  const r = spawnSync(process.execPath, [path.join(TEMPLATE, 'specs/.sdd/scripts/ui-specgen.cjs'), '--root', p.root], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /generated-wireframes.spec.ts: 2 screen state\(s\), 3 test-id assertions/);
  const spec = p.read('specs/fixtures/ui/generated-wireframes.spec.ts');
  assert.match(spec, /test\("wireframe: notes-list"/);
  assert.match(spec, /\/\/ covers: inv:V3/);
  assert.match(spec, /getByTestId\("note-row"\)\.first\(\)\)\.toBeAttached\(\)/);
  assert.match(spec, /waitForSelector\("\[data-testid=notes-list\]"/);
  assert.match(spec, /require\(require\('path'\)\.resolve\(__dirname, ROOT, "specs\/wireframes\/setup-empty\.cjs"\)\)/);
  assert.match(spec, /observe\(page, "notes-empty"\)/);
  assert.equal((spec.match(/^test\(/gm) || []).length, 2);
});

test('upgrade: swaps specs/.sdd from a template, keeps the state, renames legacy logs, regenerates entry files, writes the log', () => {
  const p = project({ example: true });
  // An "old" template: today's files with an older version header and a stage folder that no longer exists.
  const old = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-old-'));
  fs.cpSync(path.join(TEMPLATE, 'specs/.sdd'), path.join(old, 'specs/.sdd'), { recursive: true });
  fs.writeFileSync(path.join(old, 'specs/.sdd/WORKSPACE_ROUTING.md'), fs.readFileSync(path.join(old, 'specs/.sdd/WORKSPACE_ROUTING.md'), 'utf8').replace(/<!-- version: .*? -->/, '<!-- version: 2026.10.18-v3.3-prototype-first -->'));
  fs.mkdirSync(path.join(old, 'specs/.sdd/03p_prototype'));
  fs.writeFileSync(path.join(old, 'specs/.sdd/03p_prototype/CONTEXT.md'), '# old stage\n');
  fs.rmSync(p.at('specs/.sdd'), { recursive: true, force: true });
  fs.cpSync(path.join(old, 'specs/.sdd'), p.at('specs/.sdd'), { recursive: true });
  p.state({ lastCompletedStep: 2, stepName: '02_prototype', notes: 'keep me' });
  p.write('specs/logs/02-swarm.md', swarmLog(1));
  p.write('CLAUDE.md', fs.readFileSync(path.join(old, 'specs/.sdd/_config/entrypoint.md'), 'utf8'));
  p.write('AGENTS.md', 'custom agent file\n');
  const t = p.sdd('upgrade', '--from', TEMPLATE);
  assert.equal(t.code, 0, t.out);
  assert.match(t.out, /Upgraded specs\/.sdd: 2026.10.18-v3.3-prototype-first → 2026\.10\.21-v3\.5-prototype-first/);
  assert.match(t.out, /renamed specs\/logs\/02-swarm.md → specs\/logs\/03-swarm.md/);
  assert.match(t.out, /CLAUDE.md: regenerated/);
  assert.match(t.out, /AGENTS.md: left as is \(customized/);
  assert.ok(!fs.existsSync(p.at('specs/.sdd/03p_prototype')), 'removed stage folder is gone');
  assert.equal(p.json('specs/.sdd/_config/sdd-state.json').notes, 'keep me');
  assert.equal(p.read('CLAUDE.md'), fs.readFileSync(path.join(TEMPLATE, 'specs/.sdd/_config/entrypoint.md'), 'utf8'));
  assert.equal(p.read('AGENTS.md'), 'custom agent file\n');
  const log = p.read('specs/logs/upgrade-2026.10.21-v3.5-prototype-first.md');
  assert.match(log, /# Upgrade to pipeline 2026\.10\.21-v3\.5-prototype-first/);
  assert.match(log, /03p_prototype\/CONTEXT.md/);
  assert.match(log, /SDD status[\s\S]*Next stage: 03_hardening/);
  assert.match(log, /## Next actions/);
});

test('order: next slice before contracts exist — the cadence is the user\'s call at acceptance until Stage 03 declares it', () => {
  const p = project({ example: true });
  fs.rmSync(p.at('specs/contracts'), { recursive: true, force: true });
  p.state({ lastCompletedStep: 2, stepName: '02_prototype' });
  assert.match(p.sdd('status').out, /no contracts yet: `transition --completed 01` for another slice is also in order/);
  assert.match(p.sdd('transition', '--completed', '01').out, /✓ next slice before hardening \(no contracts yet/);
});

test('dashboard: one self-contained page from the same data as status/readiness; --json for other tools; transitions rewrite it', () => {
  const p = project({ example: true });
  freeze(p);
  p.state({ lastCompletedStep: 3, stepName: '03_hardening' });
  const t = p.sdd('dashboard');
  assert.equal(t.code, 0, t.out);
  assert.match(t.out, /Wrote specs\/logs\/dashboard.html: next 04 Oracle \+ freeze/);
  const html = p.read('specs/logs/dashboard.html');
  assert.match(html, /<!doctype html>/);
  assert.doesNotMatch(html, /<script/, 'no scripts: the page is inert');
  assert.match(html, /class="stage done"><div class="num">01<\/div>/);
  assert.match(html, /class="stage next"><div class="num">04<\/div>/);
  assert.match(html, /Next action \(yours\):<\/b> approve the freeze/);
  assert.match(html, /v1 intact/);
  assert.match(html, /Interview questions/);
  const j = JSON.parse(p.sdd('dashboard', '--json').out);
  assert.equal(j.next.id, '04');
  assert.equal(j.stages.filter(s => s.done).length, 3);
  assert.ok(j.gates.length > 0 && j.gates.every(g => typeof g.ok === 'boolean'));
  assert.equal(j.lock.intact, true);
  assert.equal(j.settings.prototypeCadence, 'slice (default)');
  // a transition rewrites the page
  fs.rmSync(p.at('specs/logs/dashboard.html'));
  p.state({ lastCompletedStep: 7, stepName: '07_verification_before_completion' });
  const tr = p.sdd('transition', '--completed', '01');
  assert.equal(tr.code, 0, tr.out);
  assert.match(tr.out, /dashboard: specs\/logs\/dashboard.html/);
  assert.match(p.read('specs/logs/dashboard.html'), /class="stage next"><div class="num">02<\/div>/);
});

test('upgrade: legacy state names are mapped to today\'s numbering (03p accepted = Stage 02 complete) and an earlier log is kept', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 3, stepName: '03p_prototype', notes: 'Completed 03p_prototype; prototype accepted by Ada' });
  p.write('specs/logs/upgrade-2026.10.21-v3.5-prototype-first.md', 'filled in by the agent\n');
  const t = p.sdd('upgrade', '--from', TEMPLATE);
  assert.equal(t.code, 0, t.out);
  assert.match(t.out, /state mapped: 03p_prototype \(lastCompletedStep=3\) → 02_prototype \(2\)/);
  const s = p.json('specs/.sdd/_config/sdd-state.json');
  assert.equal(s.lastCompletedStep, 2);
  assert.equal(s.stepName, '02_prototype');
  assert.match(s.notes, /prototype accepted by Ada; upgrade .*: mapped legacy stage 03p_prototype → 02_prototype/);
  assert.match(p.sdd('status').out, /Next stage: 03_hardening/);
  assert.equal(p.read('specs/logs/upgrade-2026.10.21-v3.5-prototype-first.md'), 'filled in by the agent\n', 'the filled-in log is kept');
  assert.match(p.read('specs/logs/upgrade-2026.10.21-v3.5-prototype-first-2.md'), /State file mapped: 03p_prototype/);
});
