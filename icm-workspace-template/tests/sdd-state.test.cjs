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
/** Copy the template's pipeline (specs/.sdd) into the project so the lock pins a real version. */
const withPipeline = p => { fs.cpSync(path.join(TEMPLATE, 'specs/.sdd'), p.at('specs/.sdd'), { recursive: true, filter: f => !/sdd-state\.json$/.test(f) }); return p; };
const bumpPipeline = (p, version) => p.write('specs/.sdd/WORKSPACE_ROUTING.md', p.read('specs/.sdd/WORKSPACE_ROUTING.md').replace(/<!-- version: .*? -->/, `<!-- version: ${version} -->`));
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

test('agenda: a row that says `supersedes DECnnn` drops the pending row from agenda, readiness and the dashboard; check warns on a citation without the word and errors on an unknown id', () => {
  const p = project({ example: true });
  fs.appendFileSync(p.at('specs/DECISION_LOG.md'), '| DEC007 | Ghost timeout [PENDING-SME] | 5, 7 | 7 min | until experts confirm | SPEC §4 |\n| DEC008 | Retention [PENDING-LEGAL] | 1y, 7y | 7y | regulation unknown | SPEC §6 |\n| DEC009 | Ghost timeout confirmed | 5, 7 | 7 min | experts confirmed DEC007 | SPEC §4 |\n');
  let out = p.sdd('check', '--contracts').out;
  assert.match(out, /⚠ DECISION_LOG.md: DEC009 cites pending DEC007 without superseding it — .*write "supersedes DEC007"/);
  assert.match(p.sdd('agenda').out, /## Working assumptions pending SME \(1\)[\s\S]*DEC007/, 'a citation alone is not an answer');
  assert.match(p.sdd('readiness').out, /pending:\s+2 \[PENDING-<ROLE>\] tag\(s\)/);
  fs.appendFileSync(p.at('specs/DECISION_LOG.md'), '| DEC010 | Ghost timeout: 7 min — Supersedes DEC007 | 5, 7 | 7 min | experts confirmed | SPEC §4 |\n');
  out = p.sdd('check', '--contracts').out;
  assert.doesNotMatch(out, /cites pending DEC007/, 'the superseding row silences the warning');
  assert.match(out, /→ PASS/);
  const agenda = p.sdd('agenda').out;
  assert.doesNotMatch(agenda, /DEC007/);
  assert.doesNotMatch(agenda, /pending SME/);
  assert.match(agenda, /## Working assumptions pending LEGAL \(1\)[\s\S]*DEC008/);
  assert.match(p.sdd('readiness').out, /pending:\s+1 \[PENDING-<ROLE>\] tag\(s\)/);
  const j = JSON.parse(p.sdd('dashboard', '--json').out);
  assert.equal(j.pending.tags, 1);
  assert.deepEqual(j.pending.byRole.map(r => r.role), ['LEGAL']);
  fs.appendFileSync(p.at('specs/DECISION_LOG.md'), '| DEC011 | Retention: 7y, supersedes DEC042 and DEC008 | 1y, 7y | 7y | legal confirmed | SPEC §6 |\n');
  out = p.sdd('check', '--contracts').out;
  assert.match(out, /✗ DECISION_LOG.md: DEC011 supersedes DEC042, which is not in specs\/DECISION_LOG.md/);
  assert.doesNotMatch(p.sdd('agenda').out, /DEC008/, 'several ids after one `supersedes`');
  assert.doesNotMatch(p.sdd('readiness').out, /pending:/);
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

// ---------- v3.5: the pipeline is one lock entry ----------

test('lock: pipeline pin — a pipeline change is one line (never a file list); a spec file still reports by name; the re-freeze is one line too', () => {
  const p = withPipeline(project({ example: true }));
  p.state({ lastCompletedStep: 3, stepName: '03_hardening' });
  freeze(p);
  const lock = p.json('specs/spec.lock.json');
  assert.equal(lock.pipeline.version, '2026.10.21-v3.5-prototype-first');
  assert.match(lock.pipeline.hash, /^[0-9a-f]{64}$/);
  assert.ok(Object.keys(lock.files).length > 0 && Object.keys(lock.files).every(f => !f.startsWith('specs/.sdd/')), 'lock.files holds the spec content only');
  assert.match(p.sdd('verify').out, /✓ frozen set intact: lock v1 \([0-9a-f]{12}\), \d+ spec file\(s\) \+ pipeline 2026\.10\.21-v3\.5-prototype-first/);
  // one pipeline file changes (a template upgrade)
  bumpPipeline(p, '2026.10.22-v3.6-prototype-first');
  const v = p.sdd('verify');
  assert.equal(v.code, 1);
  assert.match(v.out, /~ pipeline 2026\.10\.21-v3\.5-prototype-first → 2026\.10\.22-v3\.6-prototype-first — re-freeze with the user's approval: `sdd\.cjs freeze --reason "upgrade: 2026\.10\.22-v3\.6-prototype-first"/);
  assert.doesNotMatch(v.out, /specs\/\.sdd\//, 'no pipeline file is listed');
  assert.doesNotMatch(v.out, /~ specs\//, 'no spec file is listed');
  const st = p.sdd('status').out;
  assert.match(st, /lock:\s+v1 [0-9a-f]{12} — MODIFIED \(pipeline only\)\n\s+pipeline 2026\.10\.21-v3\.5-prototype-first → 2026\.10\.22-v3\.6-prototype-first/);
  const gate = p.sdd('transition', '--completed', '04').out;
  assert.match(gate, /✗ frozen set modified since lock v1: pipeline 2026\.10\.21-v3\.5-prototype-first → 2026\.10\.22-v3\.6-prototype-first\n/);
  assert.doesNotMatch(gate, /specs\/\.sdd\//);
  const j = JSON.parse(p.sdd('dashboard', '--json').out);
  assert.deepEqual([j.lock.intact, j.lock.modified, j.lock.pipeline.changed, j.lock.pipeline.from, j.lock.pipeline.to], [false, [], true, '2026.10.21-v3.5-prototype-first', '2026.10.22-v3.6-prototype-first']);
  assert.equal(p.sdd('dashboard').code, 0);
  assert.match(p.read('specs/logs/dashboard.html'), /pipeline changed/);
  // a spec file changes too: still reported by name, next to the pipeline line
  p.write('specs/SPEC.md', p.read('specs/SPEC.md') + '\n<!-- edited -->\n');
  const v2 = p.sdd('verify').out;
  assert.match(v2, /~ pipeline 2026\.10\.21-v3\.5-prototype-first → 2026\.10\.22-v3\.6-prototype-first/);
  assert.match(v2, /~ specs\/SPEC\.md/);
  assert.match(p.sdd('status').out, /MODIFIED \(spec files: 1 changed, 0 added, 0 removed; pipeline, see below\)/);
  assert.match(p.sdd('transition', '--completed', '04').out, /frozen set modified since lock v1: pipeline [^;]+; ~specs\/SPEC\.md/);
  // the re-freeze after an upgrade
  const f = p.sdd('freeze', '--reason', 'upgrade: 2026.10.22-v3.6-prototype-first', '--approved-by', 'Ada');
  assert.equal(f.code, 0, f.out);
  assert.match(f.out, /Re-freezing \(v1 → v2\)\. Changes:\n  ~ pipeline 2026\.10\.21-v3\.5-prototype-first → 2026\.10\.22-v3\.6-prototype-first\n  ~ specs\/SPEC\.md\n/);
  const lock2 = p.json('specs/spec.lock.json');
  assert.equal(lock2.pipeline.version, '2026.10.22-v3.6-prototype-first');
  assert.equal(lock2.history[0].pipeline, '2026.10.21-v3.5-prototype-first');
  assert.match(p.sdd('verify').out, /✓ frozen set intact: lock v2/);
});

test('lock: an old-format lock (pipeline hashed file by file, no pipeline entry) reads as a modified pipeline, never crashes', () => {
  const p = withPipeline(project({ example: true }));
  p.state({ lastCompletedStep: 3, stepName: '03_hardening' });
  freeze(p);
  const lock = p.json('specs/spec.lock.json');
  const files = { ...lock.files };
  for (const f of L.pipelineFiles(p.root)) files[f] = L.hashFile(p.at(f));
  const { pipeline, ...rest } = lock;
  p.write('specs/spec.lock.json', JSON.stringify({ ...rest, toolVersion: '2026.10.20-v3.4', hash: L.manifestHash(files), files }));
  const v = p.sdd('verify');
  assert.equal(v.code, 1);
  assert.match(v.out, /~ pipeline unpinned → 2026\.10\.21-v3\.5-prototype-first \(the lock predates the pipeline pin/);
  assert.doesNotMatch(v.out, /lock edited by hand/, 'the old hash formula is still recognized');
  assert.doesNotMatch(v.out, /~ specs\//, 'the spec files match: only the pin is missing');
  const st = p.sdd('status');
  assert.equal(st.code, 0, st.out);
  assert.match(st.out, /MODIFIED \(pipeline only\)/);
  assert.match(p.sdd('transition', '--completed', '04').out, /frozen set modified since lock v1: pipeline unpinned → 2026\.10\.21-v3\.5-prototype-first/);
  const j = JSON.parse(p.sdd('dashboard', '--json').out);
  assert.deepEqual([j.lock.intact, j.lock.pipeline.changed, j.lock.pipeline.version, j.lock.modified], [false, true, null, []]);
  // a user-approved re-freeze pins it
  assert.equal(p.sdd('freeze', '--reason', 'upgrade: 2026.10.21-v3.5-prototype-first', '--approved-by', 'Ada').code, 0);
  assert.equal(p.json('specs/spec.lock.json').pipeline.version, '2026.10.21-v3.5-prototype-first');
  assert.match(p.sdd('verify').out, /✓ frozen set intact: lock v2/);
});

test('upgrade: on a locked project the log says the lock now differs only by the pipeline pin', () => {
  const p = withPipeline(project({ example: true }));
  bumpPipeline(p, '2026.10.18-v3.3-prototype-first');
  p.state({ lastCompletedStep: 3, stepName: '03_hardening' });
  freeze(p);
  const t = p.sdd('upgrade', '--from', TEMPLATE);
  assert.equal(t.code, 0, t.out);
  assert.match(t.out, /lock: The lock v1 now differs only by the pipeline pin: pipeline 2026\.10\.18-v3\.3-prototype-first → 2026\.10\.21-v3\.5-prototype-first\. Re-freeze with the user's approval: `sdd\.cjs freeze --reason "upgrade: 2026\.10\.21-v3\.5-prototype-first" --approved-by "<user>"`/);
  const log = p.read('specs/logs/upgrade-2026.10.21-v3.5-prototype-first.md');
  assert.match(log, /now differs only by the pipeline pin: pipeline 2026\.10\.18-v3\.3-prototype-first → 2026\.10\.21-v3\.5-prototype-first/);
  assert.match(log, /lock:\s+v1 [0-9a-f]{12} — MODIFIED \(pipeline only\)/, 'the status captured in the log shows the one-line diff');
});

test('export: the build-B workspace holds the spec files plus every pipeline file, its lock verifies, and --update drops stale pipeline files', () => {
  const p = withPipeline(project({ example: true }));
  p.state({ lastCompletedStep: 3, stepName: '03_hardening' });
  freeze(p);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-b-'));
  const e = p.sdd('export', out);
  assert.equal(e.code, 0, e.out);
  const lock = p.json('specs/spec.lock.json');
  const pipeline = L.pipelineFiles(p.root);
  assert.match(e.out, new RegExp(`Exported ${Object.keys(lock.files).length + pipeline.length} frozen file\\(s\\) \\(${Object.keys(lock.files).length} spec \\+ pipeline 2026\\.10\\.21-v3\\.5-prototype-first\\)`));
  const expected = new Set([...Object.keys(lock.files), ...pipeline, 'specs/spec.lock.json', 'specs/IMPLEMENTATION_PHASES.md', 'specs/.sdd/_config/sdd-state.json', 'AGENTS.md', 'CLAUDE.md', '.cursorrules']);
  const actual = new Set(L.listFiles(out).map(f => path.relative(out, f)));
  assert.deepEqual([...actual].sort(), [...expected].sort(), 'exactly the frozen set, the lock, the phases, the state and the entry files');
  const bv = spawnSync(process.execPath, [SDD, 'verify', '--root', out], { encoding: 'utf8' });
  assert.match(bv.stdout, /✓ frozen set intact: lock v1/, 'B is on the same intact lock');
  // --update: a pipeline file that no longer exists in the template is removed from B
  fs.writeFileSync(path.join(out, 'specs/.sdd/03p_prototype.md'), 'stale\n');
  assert.equal(p.sdd('export', out, '--update').code, 0);
  assert.ok(!fs.existsSync(path.join(out, 'specs/.sdd/03p_prototype.md')), 'stale pipeline file removed');
  assert.deepEqual([...new Set(L.listFiles(out).map(f => path.relative(out, f)))].sort(), [...expected].sort());
});

// ---------- Rolling cadence: the cap reads per accepted slice, from the outcomes each Stage 02 row records ----------

const lastRow = p => JSON.parse(p.read('specs/logs/transitions.jsonl').trim().split('\n').pop());

test('rolling cap: two accepted slices each under the cap pass Stage 03 although their sum exceeds it; default cadence counts the whole set', () => {
  const p = project({ example: true });
  const manifest = p.json('specs/contracts/manifest.json');
  const spec = p.read('specs/SPEC.md');
  fs.renameSync(p.at('specs/contracts'), p.at('contracts-later')); // prototypes come before the contracts, as a rolling project runs
  // Slice 1: §5 names the service and collection operations only (9 outcomes once the contracts are compiled).
  p.write('specs/SPEC.md', spec.replace(/### 5\.2 Single note[\s\S]*?(?=## 6\.)/, ''));
  p.state({ lastCompletedStep: 1, stepName: '01_brainstorming' });
  p.write('specs/logs/02-prototype.md', PROTOTYPE_RECORD);
  let t = p.sdd('transition', '--completed', '02', '--approved-by', 'Wil');
  assert.equal(t.code, 0, t.out);
  let rec = lastRow(p);
  assert.equal(rec.approvedBy, 'Wil');
  assert.deepEqual(rec.outcomes, ['spec:getHealth', 'spec:createNote', 'spec:listNotes'], 'no contracts yet: the operations SPEC.md §5 names');
  assert.equal(rec.outcomesSource, 'spec');
  // Slice 2: the single-note operations (21 outcomes).
  p.write('specs/logs/01-interview.md', p.read('specs/logs/01-interview.md'));
  t = p.sdd('transition', '--completed', '01');
  assert.equal(t.code, 0, t.out);
  p.write('specs/SPEC.md', spec);
  p.write('specs/logs/02-prototype.md', PROTOTYPE_RECORD);
  t = p.sdd('transition', '--completed', '02', '--approved-by', 'Wil');
  assert.equal(t.code, 0, t.out);
  assert.equal(lastRow(p).outcomes.length, 7);
  // Stage 03 compiles the contracts and declares the cadence. Cap 25: 9 and 21 each pass; 30 together would not.
  fs.renameSync(p.at('contracts-later'), p.at('specs/contracts'));
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...manifest, prototypeCadence: 'rolling', sliceCap: 25 }));
  t = p.sdd('transition', '--completed', '03').out;
  assert.match(t, /✓ rolling cadence: 2 accepted slice\(s\) since the last lock, each within cap 25 — #1 9, #2 21 new declared outcome\(s\); 30 in total/);
  assert.match(p.sdd('readiness').out, /slice:\s+rolling cadence — 2 accepted slice\(s\) since the last lock: #1 9, #2 21 new declared outcome\(s\) \(cap 25 per slice\); 30 in total across 7 operation\(s\)/);
  const j = JSON.parse(p.sdd('dashboard', '--json').out);
  assert.equal(j.slice.cadence, 'rolling');
  assert.deepEqual(j.slice.slices.map(s => [s.n, s.size, s.source, s.approvedBy]), [[1, 9, 'spec', 'Wil'], [2, 21, 'spec', 'Wil']]);
  assert.equal(p.sdd('dashboard').code, 0);
  assert.match(p.read('specs/logs/dashboard.html'), /25 declared outcomes per accepted slice.*per accepted slice since the last lock: #1 9 · #2 21 new · 30 in total/);
  // Default cadence, same rows: the whole set is one slice and the cap refuses.
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...manifest, sliceCap: 25 }));
  t = p.sdd('transition', '--completed', '03').out;
  assert.match(t, /✗ slice adds 30 declared outcome\(s\), cap 25 \(30 in total\)/);
  assert.match(p.sdd('readiness').out, /slice:\s+30 new declared outcome\(s\) \(cap 25\); 30 in total/);
});

test('rolling cap: a single accepted slice over the cap still fails; with no accepted row since the lock the whole set is one slice', () => {
  const p = project({ example: true });
  p.state({ lastCompletedStep: 1, stepName: '01_brainstorming' });
  p.write('specs/logs/02-prototype.md', PROTOTYPE_RECORD);
  const t = p.sdd('transition', '--completed', '02', '--approved-by', 'Wil');
  assert.equal(t.code, 0, t.out);
  const rec = lastRow(p);
  assert.equal(rec.outcomesSource, 'contracts');
  assert.equal(rec.outcomes.length, 30, 'contracts exist: the declared outcome keys');
  assert.ok(rec.outcomes.includes('op:updateNote:412'));
  const m = p.json('specs/contracts/manifest.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, prototypeCadence: 'rolling', sliceCap: 25 }));
  assert.match(p.sdd('transition', '--completed', '03').out, /✗ rolling cadence: slice #1 \(accepted \d{4}-\d{2}-\d{2} by Wil\) adds 30 declared outcome\(s\), cap 25 per slice — slices since the last lock: #1 30; 30 in total: split the slice with the user/);
  // After a freeze the row predates the lock: nothing new, no slice to count.
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, prototypeCadence: 'rolling' }));
  freeze(p);
  const lock = p.json('specs/spec.lock.json');
  p.write('specs/contracts/manifest.json', JSON.stringify({ ...m, prototypeCadence: 'rolling', sliceCap: 15 }));
  assert.match(p.sdd('readiness').out, /slice:\s+rolling cadence — 0 new declared outcome\(s\) \(no accepted prototype recorded its outcomes since the last lock: counted as one slice\) \(cap 15 per slice\); 30 in total/);
  // A lock that froze only 10 of today's outcomes, no accepted prototype since: the whole set is one slice, as under the default cadence.
  p.write('specs/spec.lock.json', JSON.stringify({ ...lock, outcomes: lock.outcomes.slice(0, 10) }));
  assert.match(p.sdd('readiness').out, /✗ rolling cadence, but no accepted prototype recorded its outcomes since the last lock: the whole set counts as one slice — 20 new declared outcome\(s\), cap 15 \(30 in total\)/);
  const { outcomes, ...legacy } = lock;
  p.write('specs/spec.lock.json', JSON.stringify(legacy));
  assert.match(p.sdd('readiness').out, /slice:\s+rolling cadence — unknown \(lock predates outcome recording\) \(cap 15 per slice\); 30 in total/);
});
