'use strict';
// Gate tests for the ICM template tools. Run: node --test tests/
// Each test copies icm-workspace-template/ into a temp project, so nothing here ships inside the template.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const TEMPLATE = path.join(REPO, 'icm-workspace-template');
const EXAMPLE = path.join(TEMPLATE, 'specs/.sdd/_config/examples/notes-service/specs');

function project({ example = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-gates-'));
  fs.cpSync(TEMPLATE, dir, { recursive: true });
  if (example) fs.cpSync(EXAMPLE, path.join(dir, 'specs'), { recursive: true });
  return dir;
}

function sdd(dir, ...args) {
  const r = spawnSync(process.execPath, [path.join(dir, 'specs/.sdd/scripts/sdd.cjs'), ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const readJson = (dir, rel) => JSON.parse(read(dir, rel));
const writeJson = (dir, rel, v) => write(dir, rel, `${JSON.stringify(v, null, 2)}\n`);
const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function gitInit(dir) {
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'gates@example.com');
  git(dir, 'config', 'user.name', 'gates');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
}

function state(dir, last, stepName) {
  writeJson(dir, 'specs/.sdd/_config/sdd-state.json', { lastCompletedStep: last, stepName, projectType: 'backend-service', timestamp: '2026-01-01T00:00:00.000Z', notes: '' });
}

/** A green run report as oracle.cjs writes it, bound to the current lock and HEAD. */
function greenRun(dir, { phase, head, dirty = [] } = {}) {
  const lock = readJson(dir, 'specs/spec.lock.json');
  writeJson(dir, 'specs/logs/oracle/run-default.json', {
    tool: 'sdd-oracle', mode: 'run', target: 'default', lockHash: lock.hash, lockValid: true, lockVersion: lock.lockVersion,
    filtered: phase !== undefined, filters: { phase: phase === undefined ? undefined : String(phase), bail: false },
    git: head ? { head, dirty, dirtyCount: dirty.length } : null,
    startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), total: 3, passed: 3, failed: 0, errored: 0, results: [],
  });
}

// ---------- check: fixtures ----------

test('check: the reference example passes unchanged', () => {
  const dir = project({ example: true });
  const r = sdd(dir, 'check');
  assert.equal(r.code, 0, r.out);
});

test('check: one Idempotency-Key on two operations fails; the reuse tag allows it', () => {
  const dir = project({ example: true });
  const f = 'specs/fixtures/cases/create.json';
  const data = readJson(dir, f);
  const c = data.cases.find(x => x.steps.some(s => s.http && s.http.method === 'POST' && s.expect && s.expect.status === 201 && s.capture));
  const create = c.steps.find(s => s.http && s.http.method === 'POST');
  const capture = Object.keys(create.capture)[0];
  const keyName = create.http.headers['Idempotency-Key'].match(/\$uuid:([^}]+)/)[1];
  // Reuse the create key on a different operation that the contract declares: PATCH the note just created.
  c.steps.push({
    http: { method: 'PATCH', path: `/notes/{{${capture}}}`, headers: { 'Idempotency-Key': `{{$uuid:${keyName}}}`, 'If-Match': '"1"' }, body: { title: 'x' } },
    expect: { status: 422 },
  });
  writeJson(dir, f, data);
  let r = sdd(dir, 'check');
  assert.equal(r.code, 1);
  assert.match(r.out, /Idempotency-Key \{\{\$uuid:[^}]+\}\} is sent to 2 different operations/);
  c.tags = [...(c.tags || []), 'idempotency-key-reuse'];
  writeJson(dir, f, data);
  r = sdd(dir, 'check');
  assert.doesNotMatch(r.out, /different operations/);
});

test('check: a step that reads the id it captures fails', () => {
  const dir = project({ example: true });
  const f = 'specs/fixtures/cases/create.json';
  const data = readJson(dir, f);
  const c = data.cases.find(x => x.steps.some(s => s.capture));
  const s = c.steps.find(x => x.capture);
  const name = Object.keys(s.capture)[0];
  s.http.path = `${s.http.path}?self={{${name}}}`;
  writeJson(dir, f, data);
  const r = sdd(dir, 'check');
  assert.equal(r.code, 1);
  assert.match(r.out, new RegExp(`uses \\{\\{${name}\\}\\} before any step captures it`));
});

test('check: a real e-mail address in a fixture fails; reserved domains and SPEC-pinned addresses pass', () => {
  const dir = project({ example: true });
  const f = 'specs/fixtures/cases/create.json';
  const data = readJson(dir, f);
  const body = data.cases[0].steps[0].http.body;
  body.title = 'owner jane.doe@acme-corp.com';
  writeJson(dir, f, data);
  let r = sdd(dir, 'check');
  assert.equal(r.code, 1);
  assert.match(r.out, /jane\.doe@acme-corp\.com/);
  body.title = 'owner jane.doe@example.com and qa@team.test';
  writeJson(dir, f, data);
  r = sdd(dir, 'check');
  assert.doesNotMatch(r.out, /outside the reserved test domains/);
  body.title = 'support@acme-corp.com';
  writeJson(dir, f, data);
  write(dir, 'specs/SPEC.md', `${read(dir, 'specs/SPEC.md')}\n- Support address shown to users: support@acme-corp.com\n`);
  r = sdd(dir, 'check');
  assert.doesNotMatch(r.out, /outside the reserved test domains/);
});

// ---------- freeze ----------

test('freeze: requires a claim that matches the equivalence target', () => {
  const dir = project({ example: true });
  let r = sdd(dir, 'freeze', '--reason', 'Initial freeze', '--approved-by', 'Pat');
  assert.equal(r.code, 2);
  assert.match(r.out, /--claim <grader-ready\|two-build>/);
  r = sdd(dir, 'freeze', '--reason', 'Initial freeze', '--approved-by', 'Pat', '--claim', 'grader-ready');
  assert.equal(r.code, 2);
  assert.match(r.out, /contradicts manifest\.equivalenceTarget 2/);
  r = sdd(dir, 'freeze', '--reason', 'Initial freeze', '--approved-by', 'Pat', '--claim', 'two-build');
  assert.equal(r.code, 0, r.out);
  assert.equal(readJson(dir, 'specs/spec.lock.json').claim, 'two-build');
  assert.match(sdd(dir, 'status').out, /claim two-build/);
  // A re-freeze (SCR, template upgrade) inherits the approved claim.
  write(dir, 'specs/SPEC.md', `${read(dir, 'specs/SPEC.md')}\n<!-- SCR-001 -->\n`);
  r = sdd(dir, 'freeze', '--reason', 'SCR-001: x', '--approved-by', 'Pat');
  assert.equal(r.code, 0, r.out);
  const lock = readJson(dir, 'specs/spec.lock.json');
  assert.equal(lock.lockVersion, 2);
  assert.equal(lock.claim, 'two-build');
});

test('freeze: a Proposed hotfix SCR blocks the next freeze until it is re-graded', () => {
  const dir = project({ example: true });
  write(dir, 'specs/changes/SCR-013.md', '# SCR-013: import scope\n\n| Field | Value |\n|---|---|\n| Status | Proposed (hotfix, merged as 2cbb17f) |\n');
  let r = sdd(dir, 'freeze', '--reason', 'Class 1: feature X', '--approved-by', 'Pat', '--claim', 'two-build');
  assert.equal(r.code, 2);
  assert.match(r.out, /SCR-013 are still Proposed/);
  r = sdd(dir, 'freeze', '--reason', 'SCR-013: import scope re-graded', '--approved-by', 'Pat', '--claim', 'two-build');
  assert.equal(r.code, 0, r.out);
});

// ---------- phase gate ----------

function frozenRepo() {
  const dir = project({ example: true });
  assert.equal(sdd(dir, 'freeze', '--reason', 'Initial freeze', '--approved-by', 'Pat', '--claim', 'two-build').code, 0);
  state(dir, 4, '04_writing_implementation_phases');
  gitInit(dir);
  return dir;
}

test('phase: refuses a run made on a dirty tree, then passes on the committed tree', () => {
  const dir = frozenRepo();
  write(dir, 'src/routes.js', '// phase 1 and some phase 2 work\n');
  greenRun(dir, { phase: 1, head: git(dir, 'rev-parse', 'HEAD'), dirty: ['src/routes.js'] });
  let r = sdd(dir, 'phase', '--completed', '1');
  assert.equal(r.code, 1);
  assert.match(r.out, /graded tree had 1 uncommitted file/);
  assert.match(r.out, /⊥ start Phase 2 files/);
  git(dir, 'add', 'src');
  git(dir, 'commit', '-qm', 'Phase 1');
  greenRun(dir, { phase: 1, head: git(dir, 'rev-parse', 'HEAD') });
  r = sdd(dir, 'phase', '--completed', '1');
  assert.equal(r.code, 0, r.out);
  assert.equal(read(dir, 'specs/logs/phases.jsonl').trim().split('\n').length, 1);
  assert.match(sdd(dir, 'status').out, /build: {2}last green phase 1 @ [0-9a-f]{7} · open phase 2 · open SCRs: none · working tree clean/);
});

test('phase: an open SCR blocks the next phase, and phases gate in order', () => {
  const dir = frozenRepo();
  const head = git(dir, 'rev-parse', 'HEAD');
  greenRun(dir, { phase: 2, head });
  let r = sdd(dir, 'phase', '--completed', '2');
  assert.equal(r.code, 1);
  assert.match(r.out, /earlier phase\(s\) 1 not gated yet/);
  write(dir, 'specs/changes/SCR-001.md', '# SCR-001: case BASE-080\n\n| Field | Value |\n|---|---|\n| Status | Draft |\n');
  r = sdd(dir, 'phase', '--completed', '1');
  assert.equal(r.code, 1);
  assert.match(r.out, /open Spec Change Request\(s\): SCR-001 \(Draft\)/);
  write(dir, 'specs/changes/SCR-001.md', '# SCR-001: case BASE-080\n\n| Field | Value |\n|---|---|\n| Status | Applied (lock v2) |\n');
  assert.equal(sdd(dir, 'phase', '--completed', '1').code, 0);
  assert.equal(sdd(dir, 'phase', '--completed', '2').code, 0);
});

test('phase: a red cumulative run keeps the phase open', () => {
  const dir = frozenRepo();
  greenRun(dir, { phase: 1, head: git(dir, 'rev-parse', 'HEAD') });
  const f = 'specs/logs/oracle/run-default.json';
  writeJson(dir, f, { ...readJson(dir, f), passed: 71, total: 73, failed: 2 });
  const r = sdd(dir, 'phase', '--completed', '1');
  assert.equal(r.code, 1);
  assert.match(r.out, /71\/73 passed, 2 failed/);
});

test('an SCR without a Status row counts as open', () => {
  const dir = frozenRepo();
  write(dir, 'specs/changes/SCR-002.md', '# SCR-002\n\nno status here\n');
  greenRun(dir, { phase: 1, head: git(dir, 'rev-parse', 'HEAD') });
  const r = sdd(dir, 'phase', '--completed', '1');
  assert.match(r.out, /SCR-002 \(no Status row\)/);
});

// ---------- transitions ----------

function stage01(dir, interpretations) {
  write(dir, 'specs/SPEC.md', '# Spec\n\n## 8. Invariants\n- **V1:** a note has a title\n');
  write(dir, 'specs/DECISION_LOG.md', '# Decision Log\n\n## DEC001 — scope\n');
  if (interpretations) write(dir, 'specs/logs/01-interpretations.md', interpretations);
}

test('transition 01: an UNSPECIFIED scenario blocks; a DEC row that scopes it out does not', () => {
  const dir = project();
  stage01(dir, null);
  let r = sdd(dir, 'transition', '--completed', '01', '--project-type', 'backend-service');
  assert.equal(r.code, 1);
  assert.match(r.out, /missing specs\/logs\/01-interpretations\.md/);
  stage01(dir, '## Round 1\n\n| Scenario | Predictor A | Predictor B |\n|---|---|---|\n| S1.1 create placement | UNSPECIFIED: position | first |\n| S1.2 delete | 404 (§5) | 404 (§5) |\n');
  r = sdd(dir, 'transition', '--completed', '01', '--project-type', 'backend-service');
  assert.equal(r.code, 1);
  assert.match(r.out, /still UNSPECIFIED in their latest round: S1\.1/);
  // A later round re-predicts S1.1 after the user answered.
  write(dir, 'specs/logs/01-interpretations.md', `${read(dir, 'specs/logs/01-interpretations.md')}\n## Round 2\n\n| Scenario | Predictor A | Predictor B |\n|---|---|---|\n| S1.1 create placement | last (§4.2) | last (§4.2) |\n`);
  write(dir, 'specs/logs/01-interpretations.md', `${read(dir, 'specs/logs/01-interpretations.md')}\n## Round 3\n\n| Scenario | Predictor A | Predictor B | Unspecified | Verdict |\n|---|---|---|---|---|\n| S1.2 delete | 404 (§5) | 410 (§5) | — | disagree |\n`);
  r = sdd(dir, 'transition', '--completed', '01', '--project-type', 'backend-service');
  assert.match(r.out, /1 scenario\(s\) not agreed in their latest round: S1\.2 \(disagree\)/);
  write(dir, 'specs/logs/01-interpretations.md', `${read(dir, 'specs/logs/01-interpretations.md')}\n## Round 4\n\n| Scenario | Predictor A | Predictor B | Unspecified | Verdict |\n|---|---|---|---|---|\n| S1.2 delete | 404 (§5.3) | 404 (§5.3) | — | agree |\n`);
  r = sdd(dir, 'transition', '--completed', '01', '--project-type', 'backend-service', '--tokens', 'orchestrator=184000,subagents=2310000');
  assert.equal(r.code, 0, r.out);
  const board = read(dir, 'specs/logs/scoreboard.md');
  assert.match(board, /Token counts are whole tokens/);
  assert.match(board, /\| 01_brainstorming \| none \| none \| 0 \| — \| 1 \| — \| — \| 3 \| 184000 \/ 2310000 \|/);
  const log = read(dir, 'specs/logs/transitions.jsonl').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(log.filter(x => x.refused).length, 3);
});

test('transition 01: README with open Stage 01 language blocks', () => {
  const dir = project();
  stage01(dir, '| Scenario | A | B |\n|---|---|---|\n| S1 | x (§1) | x (§1) |\n');
  write(dir, 'README.md', '# App\n\nStack: TBD — open in Stage 01.\n');
  const r = sdd(dir, 'transition', '--completed', '01', '--project-type', 'backend-service');
  assert.equal(r.code, 1);
  assert.match(r.out, /README\.md: TBD or "open Stage 01" language/);
});

test('transition: --tokens rejects ambiguous units', () => {
  const dir = project();
  const r = sdd(dir, 'transition', '--completed', '01', '--tokens', 'orchestrator=184k');
  assert.equal(r.code, 2);
  assert.match(r.out, /whole token counts/);
});

const DESIGN = `---
name: Test
colors:
  surface: "#FFFFFF"
  accent: "#B8422E"
components:
  draft-chip:
    backgroundColor: "{colors.surface}"
    hover:
      backgroundColor: "{colors.accent}"
---

## UI State Matrix
| Component | Empty | Loading | Success | Error | Edge Case |
|---|---|---|---|---|---|
| ModuleTable | none (\`module-table-empty\`) | — | rows | — | — |

## Approved Wireframes
- [module](wireframes/module.html)
`;

function stage03(dir) {
  writeJson(dir, 'specs/.sdd/_config/sdd-state.json', { lastCompletedStep: 2, stepName: '02_adversarial_swarm_analysis', projectType: 'fullstack-app', timestamp: '2026-01-01T00:00:00.000Z', notes: '' });
  write(dir, 'specs/DESIGN.md', DESIGN);
  write(dir, 'specs/SPEC.md', '# Spec\n\n## 14. UI\n| Key | Text |\n|---|---|\n| module.archived | This module is archived |\n');
  write(dir, 'specs/wireframes/module.html', '<div data-testid="draft-chip">Draft</div><div data-testid="module-table-empty"></div>');
}

test('transition 03: missing state, copy and token rows block; a complete audit passes', () => {
  const dir = project();
  stage03(dir);
  let r = sdd(dir, 'transition', '--completed', '03');
  assert.equal(r.code, 1);
  assert.match(r.out, /1 SPEC copy string\(s\) appear in no wireframe: module\.archived/);
  assert.match(r.out, /missing specs\/logs\/03-token-audit\.md/);
  write(dir, 'specs/wireframes/module.html', '<div data-testid="draft-chip">Draft</div><div data-testid="module-table-empty"></div><p data-testid="archived-banner">This module is archived</p>');
  const skeleton = sdd(dir, 'token-audit', '--stage', '03');
  assert.equal(skeleton.code, 0);
  assert.match(skeleton.out, /\| draft-chip \| base \| backgroundColor \| `\{colors\.surface\}` \| `#FFFFFF` \|/);
  // The Drawers shape: the wireframe CSS gave the chip no background.
  write(dir, 'specs/logs/03-token-audit.md', skeleton.out
    .replace('| `#FFFFFF` |  |  |', '| `#FFFFFF` | (none) | ❌ |')
    .replace('| `#B8422E` |  |  |', '| `#B8422E` | #B8422E | ✅ |'));
  r = sdd(dir, 'transition', '--completed', '03');
  assert.equal(r.code, 1);
  assert.match(r.out, /1 row\(s\) not ✅: draft-chip\|base\|backgroundColor/);
  write(dir, 'specs/logs/03-token-audit.md', skeleton.out.replace('| `#FFFFFF` |  |  |', '| `#FFFFFF` | #FFFFFF | ✅ |'));
  r = sdd(dir, 'transition', '--completed', '03');
  assert.equal(r.code, 1);
  assert.match(r.out, /1 row\(s\) without a measured value: draft-chip\|hover\|backgroundColor/);
  write(dir, 'specs/logs/03-token-audit.md', skeleton.out
    .replace('| `#FFFFFF` |  |  |', '| `#FFFFFF` | #FFFFFF | ✅ |')
    .replace('| `#B8422E` |  |  |', '| `#B8422E` | #B8422E | ✅ |'));
  write(dir, 'specs/logs/02-deferred-ui.md', '- [ ] R14-F3 archived banner copy\n');
  r = sdd(dir, 'transition', '--completed', '03');
  assert.equal(r.code, 1);
  assert.match(r.out, /1 deferred Stage 02 UI finding\(s\) still open/);
  write(dir, 'specs/logs/02-deferred-ui.md', '- [x] R14-F3 archived banner copy → SPEC §14 module.archived\n');
  r = sdd(dir, 'transition', '--completed', '03');
  assert.equal(r.code, 0, r.out);
});

test('transition 03: a DESIGN component without a wireframe test id blocks', () => {
  const dir = project();
  stage03(dir);
  write(dir, 'specs/wireframes/module.html', '<div class="chip">Draft</div><p>This module is archived</p>');
  const r = sdd(dir, 'transition', '--completed', '03');
  assert.match(r.out, /wireframes lack 2 DESIGN component\(s\) \/ state id\(s\): draft-chip, module-table-empty/);
  // A style-variant component may be named by class or data-component; a state id still needs its test id.
  write(dir, 'specs/wireframes/module.html', '<div class="chip draft-chip">Draft</div><div data-testid="module-table-empty"></div><p>This module is archived</p>');
  assert.doesNotMatch(sdd(dir, 'transition', '--completed', '03').out, /wireframes lack/);
});

test('UI specs tagged @keyboard need a repeated run', () => {
  const dir = project();
  stage03(dir);
  write(dir, 'specs/fixtures/ui/playwright.config.ts', 'export default {};\n');
  write(dir, 'specs/fixtures/ui/table.spec.ts', "test('arrow keys keep editor focus @keyboard', async () => {});\n");
  writeJson(dir, 'specs/.sdd/_config/sdd-state.json', { lastCompletedStep: 5, stepName: '05_development_swarm', projectType: 'fullstack-app', timestamp: '2026-01-01T00:00:00.000Z', notes: '' });
  writeJson(dir, 'specs/spec.lock.json', { tool: 'sdd', lockVersion: 1, frozenAt: '2026-01-01T00:00:00.000Z', hash: '0'.repeat(64), files: {}, history: [] });
  let r = sdd(dir, 'status');
  assert.match(r.out, /tag @keyboard\/@focus: repeat them/);
  writeJson(dir, 'specs/logs/ui-repeat.json', { config: { projects: [{ repeatEach: 1 }] }, stats: { expected: 1, unexpected: 0, flaky: 0 } });
  r = sdd(dir, 'status');
  assert.match(r.out, /ran --repeat-each=1; @keyboard\/@focus specs need at least 20/);
});

// ---------- regressions from review ----------

test('transition 01: a DEC cited as evidence does not close an UNSPECIFIED scenario; only an out-of-scope verdict does', () => {
  const dir = project();
  stage01(dir, '| Scenario | Predictor A | Predictor B | Unspecified | Verdict |\n|---|---|---|---|---|\n| S2.1 refund a shipped order | refund (DEC001) | UNSPECIFIED | who pays shipping | disagree |\n');
  let r = sdd(dir, 'transition', '--completed', '01', '--project-type', 'backend-service');
  assert.match(r.out, /still UNSPECIFIED in their latest round: S2\.1/);
  // Reworded in a later round: the stable id still supersedes the old row.
  write(dir, 'specs/logs/01-interpretations.md', `${read(dir, 'specs/logs/01-interpretations.md')}\n| Scenario | Predictor A | Predictor B | Unspecified | Verdict |\n|---|---|---|---|---|\n| S2.1 refund after shipment | out of scope | out of scope | — | out of scope (DEC099) |\n`);
  r = sdd(dir, 'transition', '--completed', '01', '--project-type', 'backend-service');
  assert.match(r.out, /S2\.1/, 'DEC099 does not exist in the decision log');
  write(dir, 'specs/DECISION_LOG.md', '# Decision Log\n\n## DEC001 — scope\n\n## DEC099 — refunds are out of scope for v1\n');
  r = sdd(dir, 'transition', '--completed', '01', '--project-type', 'backend-service');
  assert.equal(r.code, 0, r.out);
});

test('token audit: a ✅ over a measured value that contradicts the token is a mismatch', () => {
  const dir = project();
  stage03(dir);
  write(dir, 'specs/wireframes/module.html', '<div data-testid="draft-chip">Draft</div><div data-testid="module-table-empty"></div><p>This module is archived</p>');
  const skeleton = sdd(dir, 'token-audit', '--stage', '03').out;
  write(dir, 'specs/logs/03-token-audit.md', skeleton
    .replace('| `#FFFFFF` |  |  |', '| `#FFFFFF` | rgba(0, 0, 0, 0) | ✅ |')
    .replace('| `#B8422E` |  |  |', '| `#B8422E` | rgb(184, 66, 46) | ✅ |'));
  const r = sdd(dir, 'transition', '--completed', '03');
  assert.match(r.out, /draft-chip\|base\|backgroundColor \(marked ✅, but measured rgba\(0, 0, 0, 0\) ≠ #FFFFFF\)/);
  assert.doesNotMatch(r.out, /hover\|backgroundColor/);
});

test('DESIGN.md without front matter does not crash the Stage 03 gate', () => {
  const dir = project();
  stage03(dir);
  write(dir, 'specs/DESIGN.md', '# Design\n\n---\nnot: [yaml\n---\n\n## Approved Wireframes\n- [module](wireframes/module.html)\n');
  const r = sdd(dir, 'transition', '--completed', '03');
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.out, /front matter:/);
});

test('freeze: a lock from before claims existed re-freezes with the claim its manifest implies', () => {
  const dir = project({ example: true });
  assert.equal(sdd(dir, 'freeze', '--reason', 'Initial', '--approved-by', 'Pat', '--claim', 'two-build').code, 0);
  const lock = readJson(dir, 'specs/spec.lock.json');
  delete lock.claim;
  writeJson(dir, 'specs/spec.lock.json', lock);
  write(dir, 'specs/SPEC.md', `${read(dir, 'specs/SPEC.md')}\n<!-- template upgrade -->\n`);
  const r = sdd(dir, 'freeze', '--reason', 'template upgrade', '--approved-by', 'Pat');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /records no claim; recording two-build/);
});

test('phase: a Proposed hotfix SCR does not stop the build; Status rows in bold or bullet form parse', () => {
  const dir = frozenRepo();
  write(dir, 'specs/changes/SCR-013.md', '# SCR-013\n\n| Field | Value |\n|---|---|\n| **Status** | Proposed (merged 2cbb17f) |\n');
  write(dir, 'specs/changes/SCR-014.md', '# SCR-014\n\n- Status: Rejected\n');
  greenRun(dir, { phase: 1, head: git(dir, 'rev-parse', 'HEAD') });
  const r = sdd(dir, 'phase', '--completed', '1');
  assert.equal(r.code, 0, r.out);
  assert.match(sdd(dir, 'status').out, /hotfix SCRs to re-grade at the next freeze: SCR-013/);
});

test('phase: a repository with no commit cannot pass the gate', () => {
  const dir = project({ example: true });
  assert.equal(sdd(dir, 'freeze', '--reason', 'Initial', '--approved-by', 'Pat', '--claim', 'two-build').code, 0);
  git(dir, 'init', '-q');
  greenRun(dir, { phase: 1 });
  const r = sdd(dir, 'phase', '--completed', '1');
  assert.equal(r.code, 1);
  assert.match(r.out, /no commit yet: commit phase 1 alone/);
});

test('phase: a renumbered phase must be gated again', () => {
  const dir = frozenRepo();
  greenRun(dir, { phase: 1, head: git(dir, 'rev-parse', 'HEAD') });
  assert.equal(sdd(dir, 'phase', '--completed', '1').code, 0);
  const f = 'specs/logs/phases.jsonl';
  const e = JSON.parse(read(dir, f));
  write(dir, f, `${JSON.stringify({ ...e, title: 'Something else' })}\n`);
  const r = sdd(dir, 'phase', '--completed', '2');
  assert.match(r.out, /earlier phase\(s\) 1 not gated yet/);
});

test('phase: a browser-only phase is graded by the UI specs that declare it', () => {
  const dir = project();
  writeJson(dir, 'specs/.sdd/_config/sdd-state.json', { lastCompletedStep: 4, stepName: '04_writing_implementation_phases', projectType: 'client-side-app', timestamp: '2026-01-01T00:00:00.000Z', notes: '' });
  write(dir, 'specs/IMPLEMENTATION_PHASES.md', '# Phases\n\n## Phase 1: Shell\n- [ ] a\n\n## Phase 2: Board\n- [ ] b\n');
  write(dir, 'specs/fixtures/ui/shell.spec.ts', '// phase: 1\ntest("shell", () => {});\n');
  write(dir, 'specs/fixtures/ui/board.spec.ts', '// phase: 2\ntest("board", () => {});\n');
  writeJson(dir, 'specs/spec.lock.json', { tool: 'sdd', lockVersion: 1, frozenAt: '2026-01-01T00:00:00.000Z', hash: '0'.repeat(64), files: {}, history: [] });
  writeJson(dir, 'specs/logs/ui-e2e.json', { suites: [{ file: 'shell.spec.ts' }], stats: { expected: 1, unexpected: 0, flaky: 0 } });
  const r = sdd(dir, 'phase', '--completed', '1');
  // The stub lock is not intact, but the UI evidence for phase 1 alone is accepted: board.spec.ts is not required yet.
  assert.match(r.out, /✓ UI specs for phase 1: 1 passed, 0 failed, 0 flaky \(1 spec file\(s\) with phase ≤ 1\)/);
  assert.doesNotMatch(r.out, /did not run/);
});

test('check: role mailboxes and URL credentials are not personal data', () => {
  const dir = project({ example: true });
  const f = 'specs/fixtures/cases/create.json';
  const data = readJson(dir, f);
  data.cases[0].steps[0].http.body.title = 'noreply@acme-corp.com git@github.com https://user@registry.acme-corp.com/x qa@ci.internal';
  writeJson(dir, f, data);
  assert.doesNotMatch(sdd(dir, 'check').out, /outside the reserved test domains/);
});
