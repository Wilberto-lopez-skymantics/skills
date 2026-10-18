#!/usr/bin/env node
'use strict';
/**
 * sdd.cjs — SDD pipeline gatekeeper. Zero dependencies (Node.js >= 18).
 *
 *   node specs/.sdd/scripts/sdd.cjs status
 *   node specs/.sdd/scripts/sdd.cjs check [--contracts]
 *   node specs/.sdd/scripts/sdd.cjs freeze --reason "<why>" --approved-by "<who>"
 *   node specs/.sdd/scripts/sdd.cjs verify
 *   node specs/.sdd/scripts/sdd.cjs transition --completed <stage> [--resume <stage>] [--project-type <t>] [--note "<text>"]
 *   node specs/.sdd/scripts/sdd.cjs readiness
 *   node specs/.sdd/scripts/sdd.cjs export <dir>
 *
 * Global flag: --root <project-dir> (default: three levels above this script).
 */
const fs = require('fs');
const path = require('path');
const L = require('./sdd-lib.cjs');

const USAGE = `Usage:
  sdd.cjs status                         Current stage, lock, evidence, and the next stage's exit gates
  sdd.cjs check [--contracts]            Validate contracts (+ fixtures, coverage, phases unless --contracts)
  sdd.cjs freeze --reason R --approved-by U   Lock the frozen set (refused unless check passes)
  sdd.cjs verify                         Exit 1 if any frozen file changed since the last freeze
  sdd.cjs transition --completed S [--resume S] [--project-type T] [--note N] [--override DECnnn]
                     [--approved-by U] [--release]
                                         Record a completed stage; refused unless it is the next stage
                                         (or --override cites a DECISION_LOG entry) and its exit gates pass.
                                         03p needs --approved-by (the user who accepted the prototype);
                                         07 with manifest.equivalenceCadence "release" needs --release to certify L2
  sdd.cjs export <dir> [--update]        Copy only the frozen set into <dir> for an independent build
                                         (--update resyncs an existing build-B workspace after a re-freeze)
  sdd.cjs readiness                      Report-only: how far the spec set is from freezable (open gaps,
                                         policy questions for the user, coverage, failing gates per stage)
Stages: 00 01 01b 02 03 03p 04 05 06 07`;

// ========== Reporting ==========

class Report {
  constructor() { this.errors = []; this.warnings = []; this.notes = []; }
  error(m) { this.errors.push(m); }
  warn(m) { this.warnings.push(m); }
  note(m) { this.notes.push(m); }
  print(title) {
    console.log(`\n${title}`);
    for (const n of this.notes) console.log(`  · ${n}`);
    for (const w of this.warnings) console.log(`  ⚠ ${w}`);
    for (const e of this.errors) console.log(`  ✗ ${e}`);
    console.log(this.errors.length
      ? `  → FAIL: ${this.errors.length} error(s), ${this.warnings.length} warning(s)`
      : `  → PASS (${this.warnings.length} warning(s))`);
  }
}

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

function exists(f) { return fs.existsSync(f); }
function readText(f) { return exists(f) ? fs.readFileSync(f, 'utf8') : ''; }

const SPEC_SIZE_WARN_KB = 120;

// ========== Contracts ==========

function checkContracts(p, r) {
  const ctx = { ops: [], errorCodes: new Map(), machines: [], transitions: new Map(), commands: [], manifest: null, typeDef: null, matrix: null };
  let matrix;
  try { matrix = L.readJson(p.matrix); } catch (e) { r.error(e.message); return ctx; }
  ctx.matrix = matrix;

  if (!exists(p.spec)) r.error('missing specs/SPEC.md');
  else {
    // A spec no agent reads in one pass is read partially, and partial reading is itself a source of divergence.
    const kb = Math.round(fs.statSync(p.spec).size / 1024);
    if (kb > SPEC_SIZE_WARN_KB) r.warn(`specs/SPEC.md is ${kb} KB (> ${SPEC_SIZE_WARN_KB} KB): agents read a spec this large partially. Move restated tables (statuses, error codes, fields) into specs/contracts/ and point to them; split the rest into modules with SPEC.md as the index`);
  }
  if (!exists(p.manifest)) { r.error('missing specs/contracts/manifest.json (Stage 02 output)'); return ctx; }
  let manifest;
  try { manifest = L.readJson(p.manifest); } catch (e) { r.error(e.message); return ctx; }
  const merrs = L.validateSchema(L.loadSchema(p, 'contract-manifest.schema.json'), manifest);
  if (merrs.length) { merrs.forEach(e => r.error(`specs/contracts/manifest.json: ${e}`)); return ctx; }
  ctx.manifest = manifest;
  const typeDef = matrix.types[manifest.projectType];
  ctx.typeDef = typeDef;
  r.note(`project type: ${manifest.projectType}; interfaces: ${manifest.interfaces.join(', ')}; equivalence target: L${manifest.equivalenceTarget}`);

  for (const i of typeDef.defaultInterfaces) {
    if (!manifest.interfaces.includes(i)) r.warn(`manifest.interfaces omits "${i}" (default for ${manifest.projectType}); justify in SPEC.md §Equivalence Boundary`);
  }
  const na = manifest.notApplicable || {};
  for (const key of typeDef.required) {
    if (!manifest.artifacts[key]) r.error(`artifact "${key}" is required for ${manifest.projectType}; declare it in manifest.artifacts`);
    if (na[key]) r.error(`artifact "${key}" is required for ${manifest.projectType} and cannot be notApplicable`);
  }
  for (const key of typeDef.conditional) {
    if (!manifest.artifacts[key] && !na[key]) r.error(`conditional artifact "${key}" must be provided or justified in manifest.notApplicable`);
  }
  for (const key of Object.keys(na)) {
    if (manifest.artifacts[key]) r.error(`artifact "${key}" is both provided and marked notApplicable`);
  }
  if (manifest.interfaces.includes('http') && !manifest.artifacts.openapi) r.error('interface "http" requires the openapi artifact');
  if (manifest.interfaces.includes('cli') && !manifest.artifacts.cli) r.error('interface "cli" requires the cli artifact (cli.json)');
  if (typeDef.ui && !exists(p.design)) r.error(`${manifest.projectType} is a UI project: specs/DESIGN.md is required`);

  const order = ['openapi', 'errors', 'cli', 'statecharts', 'schema', 'storage', 'levels', 'api'];
  for (const key of order) {
    const file = manifest.artifacts[key];
    if (!file) continue;
    const fp = path.join(p.contracts, file);
    const label = `specs/contracts/${file}`;
    if (!exists(fp)) { r.error(`manifest lists ${key} → ${label}, but the file does not exist`); continue; }
    if (fs.statSync(fp).size === 0) { r.error(`${label} is empty`); continue; }
    try {
      CONTRACT_CHECKS[matrix.artifacts[key].kind](fp, label, p, ctx, r);
    } catch (e) {
      r.error(`${label}: ${e.message}`);
    }
  }

  const overrides = manifest.profileOverrides || [];
  const decisionLog = readText(p.decisionLog);
  const cites = id => !!decisionLog && new RegExp(`\\b${id}\\b`).test(decisionLog);
  for (const o of overrides) {
    if (!cites(o.decision)) r.error(`profile override ${o.rule} cites ${o.decision}, which is not in specs/DECISION_LOG.md`);
  }
  if (manifest.equivalenceTarget === 1) {
    const d = manifest.equivalenceTargetDecision;
    if (!d || !cites(d)) r.error('equivalenceTarget 1 requires manifest.equivalenceTargetDecision citing a DECnnn entry in specs/DECISION_LOG.md');
  }
  if (overrides.length) r.note(`${overrides.length} documented profile override(s)`);
  return ctx;
}

const CONTRACT_CHECKS = {
  openapi(fp, label, p, ctx, r) {
    const { doc, ops, parser } = L.loadOpenApi(fp, p.root);
    ctx.doc = doc;
    if (!ops.length) { r.error(`${label}: no operations found under paths`); return; }
    const seen = new Map();
    for (const op of ops) {
      const where = `${label}: ${op.method} ${op.path}`;
      if (!op.operationId) { r.error(`${where} has no operationId (profile HTTP-8)`); continue; }
      if (!/^[a-z][A-Za-z0-9]*$/.test(op.operationId)) r.warn(`${where}: operationId "${op.operationId}" is not lowerCamelCase (profile HTTP-8)`);
      if (seen.has(op.operationId)) r.error(`${label}: duplicate operationId "${op.operationId}"`);
      seen.set(op.operationId, op);
      if (!op.statuses.length) r.error(`${where} declares no responses`);
      if (op.statuses.includes('default')) r.warn(`${where} uses a "default" response; enumerate every status explicitly`);
    }
    ctx.ops = ops.filter(o => o.operationId);
    r.note(`openapi: ${ops.length} operation(s) (parser: ${parser})`);
  },

  errors(fp, label, p, ctx, r) {
    const data = L.readJson(fp);
    const errs = L.validateSchema(L.loadSchema(p, 'errors.schema.json'), data);
    if (errs.length) { errs.forEach(e => r.error(`${label}: ${e}`)); return; }
    const canonical = L.readJson(path.join(p.config, 'canonical-errors.json')).codes;
    const interfaces = ctx.manifest.interfaces;
    for (const e of data.errors) {
      if (ctx.errorCodes.has(e.code)) r.error(`${label}: duplicate code ${e.code}`);
      ctx.errorCodes.set(e.code, e);
      const c = canonical[e.code];
      if (c && e.status !== undefined && (c.status !== e.status || c.retryable !== e.retryable)) {
        r.error(`${label}: ${e.code} must be status ${c.status}, retryable ${c.retryable} (profile ${c.rule})`);
      }
      if (interfaces.includes('cli') && e.exitCode === undefined) r.error(`${label}: ${e.code} needs an exitCode (interface cli, profile CLI-1)`);
    }
    if (data.errors.some(e => e.status !== undefined) && !data.typeBaseUri) r.error(`${label}: typeBaseUri is required when errors carry HTTP statuses (profile ERR-1)`);
    if (interfaces.includes('http')) {
      for (const [code, c] of Object.entries(canonical)) {
        if (c.mandatory && !ctx.errorCodes.has(code)) r.error(`${label}: missing mandatory http error ${code} (${c.status}, profile ${c.rule})`);
      }
    }
    r.note(`errors: ${data.errors.length} code(s)`);
  },

  statecharts(fp, label, p, ctx, r) {
    const data = L.readJson(fp);
    const errs = L.validateSchema(L.loadSchema(p, 'statecharts.schema.json'), data);
    if (errs.length) { errs.forEach(e => r.error(`${label}: ${e}`)); return; }
    const opIds = new Set(ctx.ops.map(o => o.operationId));
    const machineIds = new Set();
    for (const m of data.machines) {
      const where = `${label}: machine ${m.id}`;
      if (machineIds.has(m.id)) r.error(`${label}: duplicate machine id ${m.id}`);
      machineIds.add(m.id);
      const states = new Map();
      for (const s of m.states) {
        if (states.has(s.id)) r.error(`${where}: duplicate state ${s.id}`);
        states.set(s.id, s);
      }
      if (!states.has(m.initial)) r.error(`${where}: initial state "${m.initial}" is not declared`);
      const outgoing = new Map([...states.keys()].map(k => [k, []]));
      const byFromEvent = new Map();
      for (const t of m.transitions) {
        const tw = `${where}: transition ${t.id}`;
        if (!t.id.startsWith(`${m.id}.`)) r.error(`${tw}: id must start with "${m.id}."`);
        if (ctx.transitions.has(t.id)) r.error(`${tw}: duplicate transition id`);
        ctx.transitions.set(t.id, { ...t, machine: m.id });
        if (!states.has(t.from)) r.error(`${tw}: from "${t.from}" is not a declared state`);
        if (!states.has(t.to)) r.error(`${tw}: to "${t.to}" is not a declared state`);
        if (states.get(t.from)?.terminal) r.error(`${tw}: leaves terminal state "${t.from}"`);
        if (outgoing.has(t.from)) outgoing.get(t.from).push(t.to);
        const fe = `${t.from}|${t.event}`;
        if (!byFromEvent.has(fe)) byFromEvent.set(fe, []);
        byFromEvent.get(fe).push(t);
        if (t.guardFailureError && ctx.errorCodes.size && !ctx.errorCodes.has(t.guardFailureError)) {
          r.error(`${tw}: guardFailureError ${t.guardFailureError} is not in errors.json`);
        }
        if (t.operationId && opIds.size && !opIds.has(t.operationId)) r.error(`${tw}: operationId ${t.operationId} is not in openapi`);
      }
      for (const [fe, ts] of byFromEvent) {
        if (ts.length > 1 && ts.some(t => !t.guard)) {
          r.error(`${where}: event ${fe.split('|')[1]} from ${fe.split('|')[0]} has ${ts.length} transitions and not all are guarded (nondeterministic)`);
        }
      }
      for (const [id, s] of states) {
        if (!s.terminal && !outgoing.get(id).length) r.error(`${where}: non-terminal state "${id}" has no outgoing transition (dangling state)`);
        if (s.terminal && !s.retention) r.warn(`${where}: terminal state "${id}" declares no retention policy (extraction-closure §1)`);
      }
      const seen = new Set([m.initial]);
      const queue = [m.initial];
      while (queue.length) for (const n of outgoing.get(queue.shift()) || []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
      for (const id of states.keys()) if (!seen.has(id)) r.error(`${where}: state "${id}" is unreachable from "${m.initial}"`);
      if (ctx.errorCodes.size && !ctx.errorCodes.has(m.illegalTransitionError)) {
        r.error(`${where}: illegalTransitionError ${m.illegalTransitionError} is not in errors.json`);
      }
      ctx.machines.push(m);
    }
    r.note(`statecharts: ${data.machines.length} machine(s), ${ctx.transitions.size} transition(s)`);
  },

  ddl(fp, label, p, ctx, r) {
    const text = fs.readFileSync(fp, 'utf8');
    if (fp.endsWith('.sql') && !/create\s+table/i.test(text)) r.error(`${label}: no CREATE TABLE statement`);
    if (fp.endsWith('.prisma') && !/\bmodel\s+\w+/.test(text)) r.error(`${label}: no model declaration`);
  },

  'json-schema'(fp, label, p, ctx, r) {
    const data = L.readJson(fp);
    if (!data.$schema && !data.type) r.warn(`${label}: declare "$schema" (JSON Schema 2020-12) and a root "type"`);
  },

  cli(fp, label, p, ctx, r) {
    const data = L.readJson(fp);
    const errs = L.validateSchema(L.loadSchema(p, 'cli.schema.json'), data);
    if (errs.length) { errs.forEach(e => r.error(`${label}: ${e}`)); return; }
    const names = new Set();
    for (const c of data.commands) {
      if (names.has(c.name)) r.error(`${label}: duplicate command "${c.name}"`);
      names.add(c.name);
      for (const x of c.exitCodes) {
        if (x.error && ctx.errorCodes.size && !ctx.errorCodes.has(x.error)) r.error(`${label}: ${c.name} exit ${x.code} cites ${x.error}, which is not in errors.json`);
      }
    }
    ctx.commands = data.commands;
    r.note(`cli: ${data.commands.length} command(s)`);
  },

  json(fp) { L.readJson(fp); },

  text() {},
};

// ========== Fixtures & coverage ==========

const { flatten: flattenSchema } = require('./probes.cjs');

const EXPECT_KEYS = {
  parallel: ['responses'],
  http: ['status', 'headers', 'body', 'bodyMatch'],
  query: ['rows', 'bodyMatch'],
  run: ['exitCode', 'stdout', 'stdoutJson', 'stderr', 'bodyMatch'],
};

function checkFixtures(p, ctx, r) {
  if (!exists(p.oracleConfig)) { r.error('missing specs/fixtures/oracle.config.json (Stage 04 output)'); return null; }
  let cfg;
  try {
    const loaded = L.loadOracleConfig(p);
    cfg = loaded.cfg;
    loaded.errors.forEach(e => r.error(e));
  } catch (e) { r.error(e.message); return null; }
  const patterns = [];
  for (const pat of cfg.variablePaths || []) {
    try { patterns.push(L.compilePathPattern(pat)); } catch (e) { r.error(`oracle.config.json variablePaths: ${e.message}`); }
  }
  const ifaces = ctx.manifest ? ctx.manifest.interfaces : [];
  const mustMask = [];
  if (ifaces.includes('http')) mustMask.push(['$.detail', 'ERR-2']);
  if (ifaces.includes('cli')) mustMask.push(['$.error.detail', 'CLI-2']);
  for (const [at, rule] of mustMask) {
    if (!patterns.some(re => re.test(at))) r.error(`oracle.config.json variablePaths must cover ${at} (free text, profile ${rule})`);
  }
  const hooks = cfg.hooks || {};
  for (const h of cfg.defaultSetup || []) if (!hooks[h]) r.error(`oracle.config.json defaultSetup references unknown hook "${h}"`);

  const { cases, errors } = L.loadCases(p);
  errors.forEach(e => r.error(e));
  const interfaces = ctx.manifest ? ctx.manifest.interfaces : [];
  const needsCases = interfaces.some(i => i !== 'browser');
  if (!cases.length && needsCases) r.error('no oracle cases found in specs/fixtures/cases/');

  const invariants = L.parseInvariants(readText(p.spec));
  const items = new Map();
  for (const op of ctx.ops) for (const st of op.statuses) if (st !== 'default') items.set(`op:${op.operationId}:${st}`, false);
  for (const id of ctx.transitions.keys()) items.set(`transition:${id}`, false);
  for (const m of ctx.machines) items.set(`illegal:${m.id}`, false);
  for (const v of invariants) items.set(`inv:${v}`, false);
  for (const code of ctx.errorCodes.keys()) items.set(`error:${code}`, false);
  for (const c of ctx.commands) for (const x of c.exitCodes) items.set(`cmd:${c.name}:${x.code}`, false);
  const cover = item => { if (items.has(item)) items.set(item, true); };

  const ids = new Set();
  const asserted = [];
  let httpSteps = 0;
  let runSteps = 0;
  for (const c of cases) {
    const where = `${c.file} ${c.id}`;
    if (ids.has(c.id)) r.error(`${where}: duplicate case id`);
    ids.add(c.id);
    const probe = !!c.probe;
    if (!probe && c.phase === undefined) r.error(`${where}: missing "phase"`);
    if (!probe && !(c.derivedFrom || []).length) r.error(`${where}: missing "derivedFrom" (oracle derives, never decides)`);
    for (const h of c.setup || []) if (!hooks[h]) r.error(`${where}: setup references unknown hook "${h}"`);

    const captured = new Set();
    c.steps.forEach((s, i) => {
      const sw = `${where} step ${i + 1}${s.id ? ` (${s.id})` : ''}`;
      const kinds = L.stepKind(s);
      if (kinds.length !== 1) { r.error(`${sw}: needs exactly one of http | query | run`); return; }
      const kind = kinds[0];
      if (kind === 'http') httpSteps++;
      if (kind === 'run') runSteps++;
      if (!probe && !s.expect) r.error(`${sw}: no "expect" (only probe cases may omit expectations)`);
      if (s.expect) {
        for (const k of Object.keys(s.expect)) if (!EXPECT_KEYS[kind].includes(k)) r.error(`${sw}: expect.${k} is not valid for a ${kind} step`);
        const lint = [];
        for (const [k, v] of Object.entries(s.expect)) if (k !== 'bodyMatch') L.lintMatchers(v, `expect.${k}`, lint);
        lint.forEach(e => r.error(`${sw}: ${e}`));
        if (kind === 'http' && s.expect.status === undefined) r.error(`${sw}: http expectations must assert status`);
        if (kind === 'run' && s.expect.exitCode === undefined) r.error(`${sw}: run expectations must assert exitCode`);
      }
      const used = L.templateVars([s[kind], s.expect]);
      for (const v of used) if (!captured.has(v)) r.error(`${sw}: uses {{${v}}} before any step captures it`);
      if (kind === 'query' && !(cfg.adapters && cfg.adapters.sql)) r.error(`${sw}: query steps need adapters.sql in oracle.config.json`);
      if (kind === 'http') {
        if (s.http.body !== undefined && s.http.rawBody !== undefined) r.error(`${sw}: use body or rawBody, not both`);
        const status = s.expect && typeof s.expect.status === 'number' ? s.expect.status : null;
        const op = ctx.ops.length ? L.matchOperation(ctx.ops, s.http.method, s.http.path) : null;
        if (ctx.ops.length && !op && !probe && ![404, 405].includes(status)) r.warn(`${sw}: ${s.http.method} ${s.http.path} matches no openapi operation`);
        if (op && !probe && s.expect && L.isPlainObject(s.expect) && status !== null) asserted.push({ op, status, body: s.expect.body });
        if (op && status !== null) {
          const declared = op.statuses.filter(st => st !== 'default' && L.statusCovers(st, status));
          if (!declared.length) r.error(`${sw}: expects ${status}, which ${op.operationId} does not declare in openapi responses`);
          if (!probe) declared.forEach(st => cover(`op:${op.operationId}:${st}`));
        }
        const code = s.expect && L.isPlainObject(s.expect.body) && typeof s.expect.body.code === 'string' ? s.expect.body.code : null;
        if (code) {
          const def = ctx.errorCodes.get(code);
          if (ctx.errorCodes.size && !def) r.error(`${sw}: error code ${code} is not in errors.json`);
          else if (def && status !== null && def.status !== status) r.error(`${sw}: ${code} is ${def.status} in errors.json but the case expects ${status}`);
          if (!probe) cover(`error:${code}`);
        }
      }
      if (kind === 'parallel') {
        const exps = s.expect && Array.isArray(s.expect.responses) ? s.expect.responses : null;
        if (s.expect && (!exps || exps.length !== s.parallel.length)) r.error(`${sw}: expect.responses must list one expectation per parallel request (${s.parallel.length})`);
        (exps || []).forEach((e, j) => {
          if (!L.isPlainObject(e) || e.status === undefined) { r.error(`${sw}: expect.responses[${j}] must assert status`); return; }
          for (const k of Object.keys(e)) if (!EXPECT_KEYS.http.includes(k)) r.error(`${sw}: expect.responses[${j}].${k} is not valid`);
        });
        if (s.capture) r.error(`${sw}: parallel steps cannot capture — which request wins a race is nondeterministic`);
        const hit = s.parallel.map(h => (ctx.ops.length ? L.matchOperation(ctx.ops, h.method, h.path) : null));
        for (const e of exps || []) {
          if (!L.isPlainObject(e) || typeof e.status !== 'number' || !hit.every(Boolean)) continue;
          if (!hit.some(o => o.statuses.some(st => st !== 'default' && L.statusCovers(st, e.status)))) {
            r.error(`${sw}: expects ${e.status}, which none of ${[...new Set(hit.map(o => o.operationId))].join(', ')} declares in openapi responses`);
          }
        }
        if (!probe && exps && hit[0] && hit.every(o => o === hit[0])) {
          for (const e of exps) {
            if (!L.isPlainObject(e) || typeof e.status !== 'number') continue;
            hit[0].statuses.filter(st => st !== 'default' && L.statusCovers(st, e.status)).forEach(st => cover(`op:${hit[0].operationId}:${st}`));
            asserted.push({ op: hit[0], status: e.status, body: e.body });
          }
        }
        for (const e of exps || []) {
          const code = L.isPlainObject(e) && L.isPlainObject(e.body) && typeof e.body.code === 'string' ? e.body.code : null;
          if (!code) continue;
          const def = ctx.errorCodes.get(code);
          if (ctx.errorCodes.size && !def) r.error(`${sw}: error code ${code} is not in errors.json`);
          else if (def && typeof e.status === 'number' && def.status !== e.status) r.error(`${sw}: ${code} is ${def.status} in errors.json but the case expects ${e.status}`);
          if (!probe) cover(`error:${code}`);
        }
      }
      for (const name of Object.keys(s.capture || {})) captured.add(name);
    });

    for (const ref of c.covers || []) {
      const [kind, ...restParts] = ref.split(':');
      const rest = restParts.join(':');
      let ok = true;
      if (kind === 'op') {
        const [opId, st] = rest.split(':');
        const op = ctx.ops.find(o => o.operationId === opId);
        ok = !!op && (st === undefined || op.statuses.includes(st));
      } else if (kind === 'transition') ok = ctx.transitions.has(rest);
      else if (kind === 'illegal') ok = ctx.machines.some(m => m.id === rest);
      else if (kind === 'inv') ok = invariants.includes(rest);
      else if (kind === 'error') ok = ctx.errorCodes.has(rest);
      else if (kind === 'cmd') ok = items.has(ref);
      if (!ok) r.error(`${where}: covers "${ref}", which does not exist in the spec/contracts`);
      else if (!probe) cover(ref);
    }
  }
  const resolves = ref => items.has(ref) || (ref.startsWith('op:') && ctx.ops.some(o => o.operationId === ref.slice(3)));

  if (interfaces.includes('http') && !httpSteps) r.error('interface "http" declared but no case has an http step');
  if ((interfaces.includes('cli') || interfaces.includes('library')) && !runSteps) r.error('interface "cli"/"library" declared but no case has a run step');
  if (interfaces.includes('browser')) {
    const ui = [];
    for (const f of L.listFiles(p.uiFixtures)) if (/\.(spec|test)\.[cm]?[jt]s$/.test(f)) ui.push(f);
    if (!ui.length) r.error('interface "browser" declared but specs/fixtures/ui/ contains no *.spec.ts|js UI specs');
    else r.note(`ui specs: ${ui.length} file(s) in specs/fixtures/ui/`);
    // UI specs declare coverage with comments: `// covers: transition:item.complete, inv:V2`
    for (const f of ui) {
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/covers:\s*([^\n]*)/g)) {
        for (const ref of m[1].split(/[\s,]+/).filter(x => /^(op|transition|illegal|inv|error|cmd):/.test(x))) {
          if (!resolves(ref)) r.error(`${L.rel(p.root, f)}: covers "${ref}", which does not exist in the spec/contracts`);
          else cover(ref);
        }
      }
    }
    if (!exists(path.join(p.uiFixtures, 'playwright.config.ts')) && !exists(path.join(p.uiFixtures, 'playwright.config.js'))) {
      r.error('specs/fixtures/ui/ needs a frozen playwright.config.ts (browser, viewport, locale, timezone, retries: 0) — oracle-standard.md §UI specs');
    }
  }

  const exempt = (ctx.manifest && ctx.manifest.coverageExempt) || {};
  for (const k of Object.keys(exempt)) {
    if (!items.has(k)) r.warn(`manifest.coverageExempt lists "${k}", which is not a coverage item`);
    else items.set(k, 'exempt');
  }
  const kinds = ['op', 'transition', 'illegal', 'inv', 'error', 'cmd'];
  const summary = kinds.map(k => {
    const all = [...items.entries()].filter(([i]) => i.startsWith(`${k}:`));
    const done = all.filter(([, v]) => v).length;
    return `${k} ${done}/${all.length}`;
  });
  r.note(`cases: ${cases.length} (${cases.filter(c => c.probe).length} probe); invariants in SPEC.md: ${invariants.length}`);
  r.note(`coverage: ${summary.join(' · ')}`);
  const uncovered = [...items.entries()].filter(([, v]) => !v).map(([i]) => i);
  if (uncovered.length) r.error(`uncovered (add cases, or justify in manifest.coverageExempt): ${uncovered.join(', ')}`);
  if (!invariants.length) r.warn('SPEC.md declares no invariants (expected "- **V1:** ..." bullets in §Invariants)');
  if (ctx.doc) fieldAssertionReport(ctx, asserted, patterns, r);

  if (exists(p.phases)) {
    const phases = L.parsePhases(readText(p.phases));
    if (!phases.length) r.error('IMPLEMENTATION_PHASES.md has no "## Phase N" headings');
    const byPhase = new Map(phases.map(n => [n, 0]));
    for (const c of cases.filter(x => !x.probe)) {
      if (!byPhase.has(c.phase)) r.error(`${c.file} ${c.id}: phase ${c.phase} is not in IMPLEMENTATION_PHASES.md`);
      else byPhase.set(c.phase, byPhase.get(c.phase) + 1);
    }
    for (const [n, count] of byPhase) {
      if (count) continue;
      if (interfaces.includes('browser')) r.warn(`Phase ${n} has no oracle cases (allowed only if graded by specs/fixtures/ui/ specs)`);
      else r.error(`Phase ${n} has no oracle cases (phase without fixture = gate fail)`);
    }
  }
  return { cfg, cases, uncovered };
}

// ========== Response-field assertion coverage ==========

function schemaFields(doc, schema, at, out, depth) {
  const s = flattenSchema(doc, schema);
  if (!s || depth > 5) return out;
  const t = Array.isArray(s.type) ? s.type.find(x => x !== 'null') : s.type || (s.properties ? 'object' : s.items ? 'array' : undefined);
  if (t === 'object' && s.properties) {
    for (const [k, v] of Object.entries(s.properties)) { out.add(`${at}.${k}`); schemaFields(doc, v, `${at}.${k}`, out, depth + 1); }
  } else if (t === 'array' && s.items) schemaFields(doc, s.items, `${at}[*]`, out, depth + 1);
  return out;
}

function literalLeaves(expected, at, out) {
  if (L.isMatcher(expected)) { if (!L.isVariableMatcher(expected) && !expected.$absent) out.add(at); return out; }
  if (Array.isArray(expected)) {
    if (!expected.length) out.add(at); // an exact [] pins the field and everything below it
    expected.forEach(e => literalLeaves(e, `${at}[*]`, out));
  } else if (L.isPlainObject(expected)) {
    if (!Object.keys(expected).length) out.add(at);
    for (const [k, v] of Object.entries(expected)) literalLeaves(v, `${at}.${k}`, out);
  } else out.add(at);
  return out;
}

/** Which declared response fields are never pinned to a literal value by any case (declared freedoms excluded)? */
function fieldAssertionReport(ctx, asserted, variablePatterns, r) {
  const fields = [];
  for (const o of ctx.ops) {
    for (const st of o.statuses) {
      if (st === 'default') continue;
      const resp = L.deref(ctx.doc, (o.op.responses || {})[st]) || {};
      const content = resp.content || {};
      const media = content['application/json'] || content['application/problem+json'];
      if (!media || !media.schema) continue;
      for (const f of schemaFields(ctx.doc, media.schema, '$', new Set(), 0)) {
        if (variablePatterns.some(re => re.test(f.replace(/\[\*\]/g, '[0]')))) continue;
        fields.push({ key: `op:${o.operationId}:${st}`, op: o, st, path: f });
      }
    }
  }
  if (!fields.length) return;
  const pinned = new Map();
  for (const a of asserted) {
    if (a.body === undefined) continue;
    for (const st of a.op.statuses.filter(x => x !== 'default' && L.statusCovers(x, a.status))) {
      const k = `op:${a.op.operationId}:${st}`;
      if (!pinned.has(k)) pinned.set(k, new Set());
      literalLeaves(a.body, '$', pinned.get(k));
    }
  }
  const isPinned = f => [...(pinned.get(f.key) || [])].some(x => x === f.path
    || x.startsWith(`${f.path}.`) || x.startsWith(`${f.path}[`) // a descendant is pinned
    || f.path.startsWith(`${x}.`) || f.path.startsWith(`${x}[`)); // an ancestor is pinned to an exact value
  const open = fields.filter(f => !isPinned(f));
  r.note(`response fields pinned to literal values: ${fields.length - open.length}/${fields.length} (declared variable paths excluded)`);
  if (open.length) {
    r.warn(`${open.length} declared response field(s) are never pinned by any case — builders may diverge there unnoticed: ${open.slice(0, 12).map(f => `${f.key} ${f.path}`).join(', ')}${open.length > 12 ? ', …' : ''}`);
  }
}

// ========== Markdown tables ==========

function parseTables(text) {
  const lines = text.split(/\r?\n/);
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|') || !/^\s*\|?\s*:?-+:?\s*\|/.test(lines[i + 1] || '')) continue;
    const header = cells(lines[i]);
    const rows = [];
    for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]));
    tables.push({ header, rows });
  }
  return tables;
}

/** Stage 02 Outcome Table ↔ contracts: every declared operation status / command exit code is listed, nothing extra. */
function outcomeTableGate(p, ctx) {
  const f = 'specs/logs/02-swarm.md';
  const tables = parseTables(readText(path.join(p.root, f)));
  const t = [...tables].reverse().find(x => x.header.some(h => /operation|command/i.test(h)) && x.header.some(h => /status|exit/i.test(h)));
  if (!t) return [false, `${f}: no Outcome Table (columns "Operation / command" and "Status / exit")`];
  const nameCol = t.header.findIndex(h => /operation|command/i.test(h));
  const statusCol = t.header.findIndex(h => /status|exit/i.test(h));
  const expected = new Map();
  for (const o of ctx.ops) for (const st of o.statuses) if (st !== 'default') expected.set(`${o.operationId}:${st}`, false);
  for (const c of ctx.commands) for (const x of c.exitCodes) expected.set(`${c.name}:${x.code}`, false);
  const known = new Set([...ctx.ops.map(o => o.operationId), ...ctx.commands.map(c => c.name)]);
  const extra = [];
  for (const row of t.rows) {
    const name = (row[nameCol] || '').replace(/`/g, '').trim();
    const code = Number(((row[statusCol] || '').match(/\d{1,3}/) || [])[0]);
    if (!name || /^\.+$/.test(name)) continue;
    if (!known.has(name)) { extra.push(`${name} (not an operation/command in the contracts)`); continue; }
    if (Number.isNaN(code)) { extra.push(`${name} (no status/exit code)`); continue; }
    const key = [...expected.keys()].find(k => k.startsWith(`${name}:`) && L.statusCovers(k.slice(name.length + 1), code));
    if (key) expected.set(key, true);
    else extra.push(`${name} ${code}`);
  }
  const missing = [...expected.entries()].filter(([, v]) => !v).map(([k]) => k.replace(':', ' '));
  if (!expected.size) return [true, 'Outcome Table: no operations or commands to enumerate'];
  if (missing.length || extra.length) {
    return [false, `Outcome Table vs contracts — ${missing.length ? `missing: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''}` : ''}${missing.length && extra.length ? '; ' : ''}${extra.length ? `not declared in contracts: ${extra.slice(0, 8).join(', ')}` : ''}`];
  }
  return [true, `Outcome Table lists all ${expected.size} declared outcome(s)`];
}

function runCheck(p, { contractsOnly }) {
  const r = new Report();
  const ctx = checkContracts(p, r);
  if (!contractsOnly) checkFixtures(p, ctx, r);
  return { r, ctx };
}

// ========== State & evidence ==========

function readState(p) {
  if (exists(p.state)) {
    try { return L.readJson(p.state); } catch { /* fall through to template */ }
  }
  const tpl = path.join(p.config, 'sdd-state.json.template');
  return exists(tpl) ? L.readJson(tpl) : { lastCompletedStep: 0, stepName: 'Project Initialization', projectType: '' };
}

function projectInfo(p, state) {
  const matrix = L.readJson(p.matrix);
  let manifest = null;
  try { manifest = exists(p.manifest) ? L.readJson(p.manifest) : null; } catch { manifest = null; }
  const projectType = (manifest && manifest.projectType) || state.projectType || '';
  const typeDef = matrix.types[projectType] || null;
  const interfaces = (manifest && manifest.interfaces) || (typeDef ? typeDef.defaultInterfaces : []);
  return { matrix, manifest, projectType, typeDef, ui: !!(typeDef && typeDef.ui), interfaces };
}

function latestReport(p, prefix, accept) {
  if (!exists(p.oracleLogs)) return null;
  const reports = fs.readdirSync(p.oracleLogs)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .map(f => { try { return L.readJson(path.join(p.oracleLogs, f)); } catch { return null; } })
    .filter(Boolean)
    .filter(accept)
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
  return reports[0] || null;
}

function oracleRunGate(p, lock, freshAfter) {
  // Stage evidence is the "default" target only: a green run on another target says nothing about this build.
  const rep = latestReport(p, 'run-default', x => x.target === 'default');
  if (!rep) return [false, 'no oracle run on target "default" (run: node specs/.sdd/scripts/oracle.cjs run)'];
  if (!lock || rep.lockHash !== lock.hash || !rep.lockValid) return [false, 'latest oracle run on "default" was not made against the current, intact lock; re-run'];
  if (rep.filtered) return [false, 'latest oracle run on "default" was filtered (--phase/--case/--suite/--bail); run the full oracle'];
  if (freshAfter && !(rep.finishedAt > freshAfter)) return [false, `latest oracle run (${rep.finishedAt}) predates this stage (${freshAfter}); re-run for fresh evidence`];
  if (rep.failed || rep.errored || !rep.total) return [false, `oracle run on "default": ${rep.passed}/${rep.total} passed, ${rep.failed} failed, ${rep.errored} errored`];
  return [true, `oracle run on "default": ${rep.passed}/${rep.total} passed against lock ${lock.hash.slice(0, 12)}`];
}

function uiSpecFiles(p) {
  return L.listFiles(p.uiFixtures).filter(f => /\.(spec|test)\.[cm]?[jt]s$/.test(f));
}

function uiGate(p, lock, freshAfter) {
  const f = path.join(p.logs, 'ui-e2e.json');
  if (!exists(f)) return [false, 'no specs/logs/ui-e2e.json (PLAYWRIGHT_JSON_OUTPUT_FILE=specs/logs/ui-e2e.json npx playwright test --config specs/fixtures/ui/playwright.config.ts --reporter=json)'];
  let rep;
  try { rep = L.readJson(f); } catch (e) { return [false, e.message]; }
  const mtime = fs.statSync(f).mtime.toISOString();
  if (!lock || !(mtime > lock.frozenAt)) return [false, 'specs/logs/ui-e2e.json predates the current lock; re-run the UI specs'];
  if (freshAfter && !(mtime > freshAfter)) return [false, 'specs/logs/ui-e2e.json predates this stage; re-run the UI specs'];
  const ran = new Set((rep.suites || []).map(s => path.basename(String(s.file || ''))));
  const missing = uiSpecFiles(p).map(x => path.basename(x)).filter(b => !ran.has(b));
  if (missing.length) return [false, `UI report did not run every frozen spec (missing: ${missing.join(', ')}); run the whole suite`];
  const st = rep.stats || {};
  // A flaky UI spec is observable nondeterminism, so it fails the gate like a hard failure.
  if (!(st.expected > 0) || st.unexpected || st.flaky) return [false, `UI specs: ${st.expected || 0} passed, ${st.unexpected || 0} failed, ${st.flaky || 0} flaky`];
  return [true, `UI specs: ${st.expected} passed, 0 failed, 0 flaky`];
}

function diffGate(p, lock, freshAfter, prefix, label) {
  const rep = latestReport(p, prefix, () => true);
  if (!rep) return [false, `no ${label} report between two independent builds (Stage 07 §L2)`];
  if (!lock || rep.lockHash !== lock.hash || !rep.lockValid) return [false, `${label}: build A was not on the current, intact lock; re-run`];
  if (rep.bLockHash !== lock.hash || !rep.bLockValid) return [false, `${label}: build B's workspace (--b-root) is not on the same intact lock (B ${rep.bLockHash ? rep.bLockHash.slice(0, 12) : 'unknown'}); re-export and rebuild B`];
  if (rep.filtered) return [false, `${label} was filtered; run it unfiltered`];
  if (freshAfter && !(rep.finishedAt > freshAfter)) return [false, `latest ${label} (${rep.finishedAt}) predates this stage; re-run`];
  if (rep.errored) return [false, `${label} ${rep.a} vs ${rep.b}: ${rep.errored} case(s) errored`];
  if (rep.divergentCases) return [false, `${label} ${rep.a} vs ${rep.b}: ${rep.divergentCases} divergent, ${rep.divergences.length} divergence(s) → Stage 00`];
  return [true, `${label} ${rep.a} vs ${rep.b}: ${rep.totalCases} observation(s), zero divergences`];
}

/** Interpretation diff: two independent authors predicted the same requests from the spec with zero gaps. */
function expectDiffGate(p, freshAfter, mustBindFixtures, minCases = 1) {
  const fixturesHash = exists(p.cases) ? L.hashTree(p.cases) : null;
  const rep = latestReport(p, 'expectdiff-', x => !mustBindFixtures || (fixturesHash && (x.aHash === fixturesHash || x.bHash === fixturesHash)));
  const what = mustBindFixtures ? 'interpretation diff of the final oracle (A = specs/fixtures/cases)' : 'interpretation diff of the Outcome Table';
  if (!rep) return [false, `no ${what}: oracle.cjs diff-expect --a … --b … (two independent authors)`];
  if (freshAfter && !(rep.finishedAt > freshAfter)) return [false, `${what} predates this stage; re-run it`];
  if (rep.identical || rep.aHash === rep.bHash) return [false, `${what}: A and B are byte-identical — B must be predicted independently from a strip-expect skeleton`];
  if ((rep.totalCases || 0) < minCases) return [false, `${what} compared ${rep.totalCases || 0} case(s); at least ${minCases} needed (one per operation/command)`];
  if (rep.divergentCases) return [false, `${what}: ${rep.gaps.length} gap(s) in ${rep.divergentCases} case(s) — resolve them in the spec`];
  return [true, `${what}: ${rep.totalCases} case(s), zero gaps`];
}

function lockGate(p) {
  const v = L.verifyLock(p.root);
  if (!v.exists) return [[false, 'no specs/spec.lock.json (freeze at end of Stage 04)'], v];
  if (!v.valid) return [[false, `frozen set modified since lock v${v.lock.lockVersion}: ${[...v.modified, ...v.added.map(f => `+${f}`), ...v.removed.map(f => `-${f}`)].join(', ') || 'lock file tampered'}`], v];
  return [[true, `lock v${v.lock.lockVersion} intact (${v.lock.hash.slice(0, 12)})`], v];
}

/** A required working file; with freshAfter it must also have been written during this stage. */
function fileGate(p, f, why, freshAfter) {
  const fp = path.join(p.root, f);
  if (!exists(fp)) return [false, `missing ${f}${why ? ` (${why})` : ''}`];
  if (freshAfter && !(fs.statSync(fp).mtime.toISOString() > freshAfter)) return [false, `${f} was not updated during this stage (older than ${freshAfter})`];
  return [true, `${f} ${freshAfter ? 'updated this stage' : 'exists'}`];
}

const VERDICT_PASS = /^\**Verdict:?\**:?\s*PASS\b/m;

/** Parse the reconciliation table(s): every row's Drift cell must be ✅ or ❌; any ❌ fails. */
function reconGate(p, freshAfter) {
  const f = 'specs/dev-swarm-reconciliation.md';
  const fg = fileGate(p, f, 'Stage 05 reconciliation', freshAfter);
  if (!fg[0]) return fg;
  const lines = readText(path.join(p.root, f)).split(/\r?\n/);
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  let rows = 0;
  let drift = 0;
  const odd = [];
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i].trim().startsWith('|') ? cells(lines[i]) : null;
    const col = head ? head.findIndex(c => /^drift\??$/i.test(c)) : -1;
    if (col < 0 || !/^\s*\|?\s*:?-+:?\s*\|/.test(lines[i + 1] || '')) continue; // GFM delimiter row
    for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
      const v = cells(lines[i])[col] || '';
      rows++;
      if (v === '❌') drift++;
      else if (v !== '✅') odd.push(v || '(empty)');
    }
  }
  if (!rows) return [false, `${f} has no table with a "Drift" column`];
  if (odd.length) return [false, `${f}: Drift cells must be ✅ or ❌ (found ${odd.slice(0, 3).join(', ')})`];
  if (drift) return [false, `${f}: ${drift} ❌ drift entr${drift === 1 ? 'y' : 'ies'}`];
  return [true, `reconciliation: ${rows} row(s), zero ❌ drift`];
}

// ========== Gap register, rulings ledger, slice cap (prototype-first pipeline) ==========

const GAPS_FILE = 'specs/GAPS.md';
const GAP_KINDS = ['policy', 'technical', 'builder', 'ui', 'oracle'];
const GAP_STATUSES = ['open', 'resolved', 'confirmed', 'deferred'];
const RULINGS_FILE = 'specs/logs/02-rulings.md';
const RULING_STATUSES = ['fixed', 'rejected', 'advisory', 'gap', 'open'];
const DEFAULT_SLICE_CAP = 150;
const SWARM_ROUND_CAP = 3;

function citesDecision(p, id) {
  return !!id && new RegExp(`\\b${id}\\b`).test(readText(p.decisionLog));
}

/** Rows of the first table carrying the required columns, as objects keyed by lower-case header. */
function ledgerRows(text, required) {
  const t = parseTables(text).find(x => required.every(col => x.header.some(h => h.toLowerCase() === col)));
  if (!t) return null;
  const keys = t.header.map(h => h.toLowerCase());
  return t.rows.filter(r => r.some(c => c && !/^\.+$/.test(c))).map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] || '').replace(/`/g, '').trim()])));
}

/** specs/GAPS.md → { rows, errors }; rows === null when the file does not exist. */
function readGaps(p) {
  const fp = path.join(p.root, GAPS_FILE);
  if (!exists(fp)) return { rows: null, errors: [] };
  const rows = ledgerRows(readText(fp), ['id', 'kind', 'status']);
  if (!rows) return { rows: [], errors: [`${GAPS_FILE}: no table with columns ID | Stage | Kind | Gap | Draft assumption | Status`] };
  const errors = [];
  for (const r of rows) {
    const where = `${GAPS_FILE} ${r.id || '(no id)'}`;
    if (!/^G-\d+$/.test(r.id)) errors.push(`${where}: ID must look like G-001`);
    r.kind = r.kind.toLowerCase();
    r.status = r.status.toLowerCase();
    if (!GAP_KINDS.includes(r.kind)) errors.push(`${where}: Kind "${r.kind}" is not one of ${GAP_KINDS.join('|')}`);
    if (!GAP_STATUSES.includes(r.status)) errors.push(`${where}: Status "${r.status}" is not one of ${GAP_STATUSES.join('|')}`);
    if (r.status === 'deferred') {
      const dec = (Object.values(r).join(' ').match(/\bDEC\d+\b/) || [])[0];
      if (!dec) errors.push(`${where}: deferred gaps must cite the DECnnn that moved them to a later slice`);
      else if (!citesDecision(p, dec)) errors.push(`${where}: cites ${dec}, which is not in specs/DECISION_LOG.md`);
    }
  }
  return { rows, errors };
}

/** allowOpen: Stage 03p records gaps; Stage 04 (freeze) requires every gap closed or deferred by decision. */
function gapsGate(p, { requireFile, allowOpen }) {
  const { rows, errors } = readGaps(p);
  if (rows === null) return requireFile ? [false, `missing ${GAPS_FILE} (gap register: every unresolved question and every uncited prototype decision)`] : [true, `no ${GAPS_FILE} (nothing recorded as open)`];
  if (errors.length) return [false, `${errors.length} malformed gap row(s): ${errors.slice(0, 3).join('; ')}`];
  const open = rows.filter(r => r.status === 'open');
  if (!allowOpen && open.length) {
    const policy = open.filter(r => r.kind === 'policy').length;
    return [false, `${GAPS_FILE}: ${open.length} open gap(s) (${policy} policy, need the user) — resolve, confirm, or defer to a later slice with a DECnnn before freezing`];
  }
  return [true, `${GAPS_FILE}: ${rows.length} row(s), ${open.length} open${allowOpen ? ' (allowed until Stage 04)' : ''}`];
}

/** Stage 02 rulings ledger: every triaged finding has a ruling; nothing is left open. */
function rulingsGate(p, freshAfter) {
  const fg = fileGate(p, RULINGS_FILE, 'Stage 02 rulings ledger', freshAfter);
  if (!fg[0]) return fg;
  const rows = ledgerRows(readText(path.join(p.root, RULINGS_FILE)), ['id', 'ruling', 'status']);
  if (!rows) return [false, `${RULINGS_FILE}: no table with columns ID | Round | Persona | Finding | Fork | Ruling | Status`];
  const bad = rows.filter(r => !RULING_STATUSES.includes(r.status.toLowerCase()));
  if (bad.length) return [false, `${RULINGS_FILE}: Status must be ${RULING_STATUSES.join('|')} (found ${bad.slice(0, 3).map(r => r.status || '(empty)').join(', ')})`];
  const open = rows.filter(r => r.status.toLowerCase() === 'open');
  if (open.length) return [false, `${RULINGS_FILE}: ${open.length} open finding(s) — rule each one (blocking findings left after round ${SWARM_ROUND_CAP} go to the user, or to ${GAPS_FILE} as status gap)`];
  const gaps = readGaps(p).rows || [];
  const ids = new Set(gaps.map(g => g.id));
  const dangling = rows.filter(r => r.status.toLowerCase() === 'gap').filter(r => !(Object.values(r).join(' ').match(/\bG-\d+\b/g) || []).some(g => ids.has(g)));
  if (dangling.length) return [false, `${RULINGS_FILE}: ${dangling.length} finding(s) ruled "gap" without a G-nnn row in ${GAPS_FILE} (${dangling.slice(0, 3).map(r => r.id).join(', ')})`];
  return [true, `rulings: ${rows.length} finding(s) ruled, none open`];
}

function readTransitions(p) {
  return readText(p.transitions).split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
}

/** `## 🔄 Iteration N` headings in the append-only swarm log, across every iteration so far. */
function swarmHeadings(p) {
  return (readText(path.join(p.root, 'specs/logs/02-swarm.md')).match(/^##\s+(?:🔄\s*)?Iteration\s+\d+/gm) || []).length;
}

/** Rounds of the current iteration: headings logged since the transition that opened it (01, 01b or 00 records the count it found). */
function swarmRounds(p) {
  const opened = readTransitions(p).filter(t => typeof t.swarmHeadings === 'number').pop();
  return Math.max(0, swarmHeadings(p) - (opened ? opened.swarmHeadings : 0));
}

/** Declared outcomes as coverage keys: every non-default operation status and every CLI exit code. */
function declaredOutcomes(ctx) {
  return [
    ...ctx.ops.flatMap(o => o.statuses.filter(x => x !== 'default').map(x => `op:${o.operationId}:${x}`)),
    ...ctx.commands.flatMap(c => c.exitCodes.map(x => `cmd:${c.name}:${x.code}`)),
  ];
}

/**
 * The slice is what this iteration adds: declared outcomes absent from the last lock (`freeze` records them).
 * No lock → the first slice, counted from zero. slice === null → the lock predates the record (the next freeze adds it).
 */
function sliceOutcomes(p, ctx) {
  const all = declaredOutcomes(ctx);
  if (!exists(p.lock)) return { total: all.length, slice: all.length };
  let frozen = null;
  try { frozen = L.readJson(p.lock).outcomes; } catch { /* unreadable lock: lockGate reports it */ }
  if (!Array.isArray(frozen)) return { total: all.length, slice: null };
  const prev = new Set(frozen);
  return { total: all.length, slice: all.filter(k => !prev.has(k)).length };
}

function sliceCapGate(p, ctx) {
  const m = ctx.manifest || {};
  const cap = m.sliceCap || DEFAULT_SLICE_CAP;
  const { total, slice } = sliceOutcomes(p, ctx);
  const needsDecision = cap > DEFAULT_SLICE_CAP;
  if (needsDecision && !citesDecision(p, m.sliceCapDecision)) return [false, `manifest.sliceCap ${cap} exceeds the default ${DEFAULT_SLICE_CAP}: manifest.sliceCapDecision must cite a DECnnn in specs/DECISION_LOG.md`];
  if (slice === null) return [true, `slice size unknown: specs/spec.lock.json predates outcome recording (the next freeze records it); ${total} declared outcome(s) in total (cap ${cap} per slice)`];
  if (slice > cap) return [false, `slice adds ${slice} declared outcome(s), cap ${cap} (${total} in total): split the scope into slices (each runs 02 → 07), or raise manifest.sliceCap with a recorded user decision`];
  return [true, `slice size: ${slice} new declared outcome(s) (cap ${cap}); ${total} in total`];
}

const RUN_LINE = /^\**Run:?\**:?\s*\S+/mi;

/** Stage 03p: the prototype record says how to start the prototype (Stage 04 records the oracle against it). */
function prototypeGate(p, freshAfter) {
  const f = 'specs/logs/03p-prototype.md';
  const fg = fileGate(p, f, 'prototype record', freshAfter);
  if (!fg[0]) return fg;
  const text = readText(path.join(p.root, f));
  if (!RUN_LINE.test(text)) return [false, `${f}: add a "**Run:** <start command>" line (Stage 04 records the oracle against the running prototype)`];
  return [true, `${f}: run command recorded`];
}

/**
 * Stage 03p acceptance is the user's, not the agent's: it is given on the command line and recorded in
 * transitions.jsonl, never typed into a file the agent also writes. `report` (readiness) skips it.
 */
function acceptanceGate(opts) {
  const by = typeof opts.approvedBy === 'string' ? opts.approvedBy.trim() : '';
  if (!by) return [false, 'missing --approved-by "<user>": the prototype stage ends only on the user\'s explicit acceptance, recorded in specs/logs/transitions.jsonl'];
  return [true, `prototype accepted by ${by} (recorded in transitions.jsonl)`];
}

/**
 * Stage 03p on an iteration (a lock exists): the prototype is the certified build A, and the previous slice's
 * oracle is its regression guard. Every existing case must stay green unless specs/DECISION_LOG.md names the
 * case as a declared behavior change (Stage 04 Part C step 7 then lists it in the changed-case ledger).
 */
function prototypeRegressionGate(p, freshAfter) {
  if (!exists(p.lock) || !exists(p.cases)) return null;
  const hash = L.hashTree(p.cases);
  const rep = latestReport(p, 'run-default', x => x.target === 'default' && x.fixturesHash === hash && !x.filtered);
  const what = 'iteration regression (previous slice\'s oracle against the prototype)';
  if (!rep) return [false, `${what}: no unfiltered oracle run on target "default" against the current fixtures — run node specs/.sdd/scripts/oracle.cjs run (results are a regression guard here, not evidence)`];
  if (freshAfter && !(rep.finishedAt > freshAfter)) return [false, `${what}: latest run (${rep.finishedAt}) predates this stage; re-run`];
  const failed = (rep.results || []).filter(x => x.status !== 'pass').map(x => x.id);
  const log = readText(p.decisionLog);
  const undeclared = failed.filter(id => !log.includes(id));
  if (undeclared.length) return [false, `${what}: ${undeclared.length} existing case(s) fail without a DECISION_LOG entry naming them (${undeclared.slice(0, 4).join(', ')}) — a regression, or an undeclared behavior change`];
  return [true, `${what}: ${rep.passed}/${rep.total} passed${failed.length ? `; ${failed.length} declared behavior change(s)` : ''}`];
}

/** Stage 04: generated profile cases had their second interpretation — an oracle run against the prototype on these exact fixtures. */
function generatedRunGate(p, freshAfter) {
  if (!exists(p.cases)) return null;
  const gen = L.loadCases(p).cases.filter(L.isGeneratedProfileCase);
  if (!gen.length) return null;
  const hash = L.hashTree(p.cases);
  const rep = latestReport(p, 'run-', x => x.fixturesHash === hash);
  const what = `${gen.length} generated profile case(s)`;
  if (!rep) return [false, `${what}: no oracle run against the prototype on the current fixtures (oracle.cjs run --target default; --suite is fine)`];
  if (freshAfter && !(rep.finishedAt > freshAfter)) return [false, `${what}: latest matching run (${rep.finishedAt}) predates this stage; re-run`];
  const byId = new Map((rep.results || []).map(r => [r.id, r.status]));
  const missing = gen.filter(c => !byId.has(c.id));
  const failed = gen.filter(c => byId.has(c.id) && byId.get(c.id) !== 'pass');
  if (missing.length) return [false, `${what}: ${missing.length} not in the latest matching run (${missing.slice(0, 4).map(c => c.id).join(', ')}); run them`];
  if (failed.length) return [false, `${what}: ${failed.length} fail against the prototype (${failed.slice(0, 4).map(c => c.id).join(', ')}) — triage each: generator bug, prototype bug (fix it, or drop the "generated" tag so the predictor checks the case), or spec gap`];
  return [true, `${what}: all pass against the prototype (target "${rep.target}")`];
}

function exitGates(stage, p, state, info, opts = {}) {
  const gates = [];
  const freshAfter = state.timestamp || null;
  const add = g => gates.push(g);
  const nonBrowser = info.interfaces.some(i => i !== 'browser');
  const browser = info.interfaces.includes('browser');
  const typeGate = () => [!!info.typeDef, info.typeDef ? `project type ${info.projectType}` : `project type unset or unknown ("${info.projectType}"); pass --project-type <${Object.keys(info.matrix.types).join('|')}>`];
  switch (stage) {
    case '00': {
      add([RESUME_TARGETS.includes(opts.resume), RESUME_TARGETS.includes(opts.resume) ? `resume at ${L.STAGES[opts.resume].name}` : `missing or invalid --resume <${RESUME_TARGETS.join('|')}> (where the pipeline continues)`]);
      add(fileGate(p, 'specs/backprop-log.md', 'append the backprop entry', freshAfter));
      add(exists(p.lock) ? lockGate(p)[0] : [false, `no specs/spec.lock.json: nothing is frozen yet, so a defect is ${PRE_FREEZE_ROUTE}`]);
      break;
    }
    case '01':
    case '01b': {
      add(typeGate());
      add(fileGate(p, 'specs/SPEC.md'));
      add(fileGate(p, 'specs/DECISION_LOG.md'));
      if (info.ui) add(fileGate(p, 'specs/DESIGN.md', 'UI project'));
      const spec = readText(p.spec);
      const placeholders = (spec.match(/\b(TBD|TODO|FIXME)\b/g) || []).length;
      add([!placeholders, placeholders ? `SPEC.md contains ${placeholders} TBD/TODO/FIXME placeholder(s)` : 'SPEC.md has no placeholders']);
      break;
    }
    case '02': {
      const { r, ctx } = runCheck(p, { contractsOnly: true });
      add([!r.errors.length, r.errors.length ? `sdd.cjs check --contracts: ${r.errors.length} error(s)` : 'sdd.cjs check --contracts passes']);
      if (!r.errors.length) add(sliceCapGate(p, ctx));
      const lg = fileGate(p, 'specs/logs/02-swarm.md', 'persisted iteration logs + Outcome Table', freshAfter);
      add(lg);
      if (lg[0]) {
        // Stage 02 runs round 1 only (the whole slice); rounds 2–3 attack the delta in Stage 03p, with the prototype running.
        const rounds = swarmRounds(p);
        add([rounds >= 1, rounds ? `${rounds} Red Team round(s) logged (round 1 here; rounds 2–3 in 03p; cap ${SWARM_ROUND_CAP})` : 'no Red Team round logged (a `## 🔄 Iteration 1` heading in specs/logs/02-swarm.md)']);
        add(outcomeTableGate(p, ctx));
      }
      add(rulingsGate(p, freshAfter));
      break;
    }
    case '03': {
      add([info.ui, info.ui ? 'UI project' : 'Stage 03 applies only to UI projects']);
      const html = exists(p.wireframes) ? fs.readdirSync(p.wireframes).filter(f => f.endsWith('.html')) : [];
      add([html.length > 0, `${html.length} wireframe(s) in specs/wireframes/`]);
      const design = readText(p.design);
      add([/^##\s+Approved Wireframes/m.test(design) && /\]\((\.\/)?wireframes\/[^)]+\.html\)/.test(design), 'DESIGN.md §Approved Wireframes links wireframes with relative paths']);
      break;
    }
    case '03p': {
      const { r, ctx } = runCheck(p, { contractsOnly: true });
      add([!r.errors.length, r.errors.length ? `sdd.cjs check --contracts: ${r.errors.length} error(s) (feedback edits must keep the contracts valid)` : 'sdd.cjs check --contracts passes']);
      if (!r.errors.length) add(sliceCapGate(p, ctx));
      add(prototypeGate(p, freshAfter));
      if (!opts.report) add(acceptanceGate(opts));
      add(fileGate(p, 'specs/logs/03p-decisions.md', 'prototype Decision Inventory', freshAfter));
      add(gapsGate(p, { requireFile: true, allowOpen: true }));
      // Hardening rounds 2–3 run here, against the running prototype; the cap counts every round of the iteration.
      const rounds = swarmRounds(p);
      add([true, `${rounds} Red Team round(s) logged this iteration (cap ${SWARM_ROUND_CAP})${rounds > SWARM_ROUND_CAP ? ' — over the cap: blocking findings left after the cap go to the user, not to another round' : ''}`]);
      add(rulingsGate(p, null));
      // Sample: one predicted case per operation/command, by authors who never saw the prototype. The full dual check runs once, in Stage 04.
      add(expectDiffGate(p, freshAfter, false, Math.max(1, ctx.ops.length + ctx.commands.length)));
      const rg = prototypeRegressionGate(p, freshAfter);
      if (rg) add(rg);
      break;
    }
    case '04': {
      const { r } = runCheck(p, { contractsOnly: false });
      add([!r.errors.length, r.errors.length ? `sdd.cjs check: ${r.errors.length} error(s)` : 'sdd.cjs check passes (contracts, fixtures, coverage, phases)']);
      add(fileGate(p, 'specs/IMPLEMENTATION_PHASES.md'));
      add(fileGate(p, 'specs/phase-integrity-check.md', 'Stage 04 Part C', freshAfter));
      add(gapsGate(p, { requireFile: false, allowOpen: false }));
      add(expectDiffGate(p, freshAfter, true));
      const gr = generatedRunGate(p, freshAfter);
      if (gr) add(gr);
      add(lockGate(p)[0]);
      break;
    }
    case '05': {
      const [lg, v] = lockGate(p);
      add(lg);
      if (nonBrowser) add(oracleRunGate(p, v.lock, null));
      if (browser) add(uiGate(p, v.lock, null));
      add(reconGate(p, freshAfter));
      break;
    }
    case '06': {
      const [lg, v] = lockGate(p);
      add([info.ui, info.ui ? 'UI project' : 'Stage 06 applies only to UI projects']);
      add(lg);
      add(uiGate(p, v.lock, freshAfter));
      add(fileGate(p, 'specs/vat-checklist.md', 'Stage 06 tracker', freshAfter));
      const vf = fileGate(p, 'specs/VAT_REPORT.md', 'Stage 06 report', freshAfter);
      add(vf[0] ? [VERDICT_PASS.test(readText(path.join(p.specs, 'VAT_REPORT.md'))), 'VAT_REPORT.md verdict PASS'] : vf);
      break;
    }
    case '07': {
      const [lg, v] = lockGate(p);
      add(lg);
      if (nonBrowser) add(oracleRunGate(p, v.lock, freshAfter));
      if (browser) add(uiGate(p, v.lock, freshAfter));
      add(reconGate(p, null));
      const open = (readText(p.phases).match(/^\s*- \[ \]/gm) || []).length;
      add([exists(p.phases) && !open, exists(p.phases) ? (open ? `IMPLEMENTATION_PHASES.md has ${open} unchecked task(s)` : 'all implementation tasks checked') : 'missing specs/IMPLEMENTATION_PHASES.md']);
      if (info.ui) add([VERDICT_PASS.test(readText(path.join(p.specs, 'VAT_REPORT.md'))), 'VAT_REPORT.md verdict PASS (Stage 06)']);
      add(fileGate(p, 'specs/EQUIVALENCE_REPORT.md', 'Stage 07 report', freshAfter));
      const target = info.manifest ? info.manifest.equivalenceTarget : 2;
      const cadence = (info.manifest && info.manifest.equivalenceCadence) || 'iteration';
      if (target === 2 && (cadence === 'iteration' || opts.release)) {
        if (nonBrowser) add(diffGate(p, v.lock, freshAfter, 'diff-', 'oracle diff'));
        if (browser) add(diffGate(p, v.lock, freshAfter, 'uidiff-', 'oracle diff-ui'));
      } else if (target === 2) {
        // Release cadence, intermediate slice: L1 now, L2 before the release. The report must say so.
        const pending = /\bL2 pending\b/.test(readText(path.join(p.specs, 'EQUIVALENCE_REPORT.md')));
        add([pending, pending ? 'equivalenceCadence "release": this slice certifies L1, report states "L2 pending" (pass --release when certifying L2)' : 'equivalenceCadence "release": EQUIVALENCE_REPORT.md must state "L2 pending" in its Certified level row (or pass --release and provide the dual-build diff)']);
        const ls = latestReport(p, 'diff-', x => x.lockHash === v.lock.hash);
        add([true, ls ? `lockstep diff on this lock: ${ls.a} vs ${ls.b}, ${ls.divergentCases} divergent case(s) at ${ls.finishedAt} (early warning, not evidence)` : 'no lockstep diff on this lock (Stage 05 tip: diff --phase N against an exported build B catches divergences early)']);
      } else add([true, `equivalence target L1 (${info.manifest.equivalenceTargetDecision}; dual-build diff not required)`]);
      break;
    }
    default:
      add([false, `unknown stage ${stage}`]);
  }
  return gates;
}

/** The value of lastCompletedStep after completing `stage` (non-UI projects skip 06; 03p and 03 both map to 3). */
function completedValue(stage, ui) {
  if (!ui && stage === '05') return 6;
  return L.STAGES[stage].num;
}

/** Stages completed since the transition that opened the current iteration (00, 01 or 01b), by stepName. */
function iterationStages(p) {
  const ts = readTransitions(p);
  let start = 0;
  ts.forEach((t, i) => { if ([STAGES_00, STAGES_01, STAGES_01B].includes(t.completed)) start = i + 1; });
  return new Set(ts.slice(start).map(t => t.completed));
}

const NEEDS_03P = `${L.STAGES['03p'].name} has not been completed: the oracle is recorded against the accepted prototype. Run 03p, or pass --override DECnnn citing the user's decision to skip it (e.g. a project already in Stage 04 before the upgrade)`;

/**
 * Is completing `stage` the next step of the pipeline from the current state?
 * Order: 01 → 02 → 03p → (03, UI only: wireframes are captured from the accepted prototype) → 04 → 05 → (06) → 07.
 * 03p and 03 share lastCompletedStep 3 (the extension's numeric state); stepName and transitions.jsonl tell them apart.
 */
function orderCheck(stage, state, info, p) {
  const last = typeof state.lastCompletedStep === 'number' ? state.lastCompletedStep : 0;
  const n = L.STAGES[stage].num;
  const name = state.stepName;
  if (stage === '00') return [true, 'Stage 00 may run at any time'];
  if ((stage === '03' || stage === '06') && !info.ui) return [false, `${L.STAGES[stage].name} applies only to UI projects`];
  if (stage === '03p') {
    if (last === 2) return [true, 'prototype on the reviewed spec draft'];
    if (last === 3) return [true, name === STAGES_03P ? 're-running the prototype stage' : name === STAGES_03 ? 're-running the prototype stage (re-run 03 afterwards if any screen changed)' : 'prototype on the reviewed spec draft'];
  } else if (stage === '03') {
    if (last === 3 && name === STAGES_03) return [true, 're-running 03_interactive_wireframing'];
    if (last === 3 && name === STAGES_03P) return [true, 'wireframes captured from the accepted prototype'];
    if (last === 2 || last === 3) return [false, `${L.STAGES['03p'].name} has not been completed: wireframes are captured from the accepted prototype (UI projects run 02 → 03p → 03 → 04)`];
  } else if (stage === '04' && last === 3) {
    // Stage 00 leaves last = resume - 1, and RESUME_TARGETS has no 03/03p, so 3 after 00 always means --resume 04.
    if (name === STAGES_00) return [true, 'resuming after Stage 00 (--resume 04); the accepted prototype is unchanged'];
    if (name === STAGES_03P) return info.ui ? [false, `${L.STAGES['03'].name} has not been completed: UI projects capture the wireframes from the accepted prototype before the oracle (02 → 03p → 03 → 04)`] : [true, 'next stage after the accepted prototype'];
    if (name === STAGES_03) return iterationStages(p).has(STAGES_03P) ? [true, 'next stage after the accepted prototype and its wireframes'] : [false, NEEDS_03P];
    return [false, NEEDS_03P];
  }
  if (completedValue(stage, info.ui) === last) return [true, `re-running ${L.STAGES[stage].name}`];
  if (stage === '01b' && last <= 0) return [true, 'adoption of an existing codebase'];
  if (stage === '01' && (last <= 0 || last === 7)) return [true, last === 7 ? 'new Class 1 iteration' : 'pipeline start'];
  if (stage === '04' && last === 1 && name === STAGES_01B) return [true, 'adoption option C (freeze as-is)'];
  if (stage === '05' && last === 7) return [true, 'Class 0 change on a certified build'];
  if (n === last + 1 && !['01b', '03p', '03'].includes(stage)) return [true, `next stage after lastCompletedStep=${last}`];
  return [false, `${L.STAGES[stage].name} is out of order: lastCompletedStep=${last} (${name || '—'}); run \`sdd.cjs status\` for the next stage, or pass --override DECnnn citing the user's decision to skip`];
}
const STAGES_00 = '00_backprop';
const STAGES_01 = '01_brainstorming';
const STAGES_01B = '01b_adoption';
const STAGES_03 = '03_interactive_wireframing';
const STAGES_03P = '03p_prototype';
// Where the pipeline may continue after Stage 00 (00_backprop/CONTEXT.md §Handoff). The prototype and wireframes are reworked via 02.
const RESUME_TARGETS = ['01', '01b', '02', '04', '05'];
const PRE_FREEZE_ROUTE = `not a Class 2 change — edit the spec in the current stage and add (or close) a ${GAPS_FILE} row instead of running Stage 00`;

function printGates(title, gates) {
  console.log(title);
  for (const [ok, label] of gates) console.log(`  ${ok ? '✓' : '✗'} ${label}`);
}

function nextStage(state, info) {
  const last = state.lastCompletedStep;
  if (last === -1) return '01b';
  if (last === 0) return '01';
  if (last === 1) return '02';
  if (last === 2) return '03p';
  if (last === 3) {
    if (state.stepName === STAGES_00 || state.stepName === STAGES_03) return '04';
    if (state.stepName === STAGES_03P) return info.ui ? '03' : '04';
    return '03p'; // a state file from before 03p existed (non-UI projects used to reach 3 straight from 02)
  }
  if (last === 4) return '05';
  if (last === 5) return info.ui ? '06' : '07';
  if (last === 6) return '07';
  return null;
}

// ========== Commands ==========

function cmdStatus(p) {
  const state = readState(p);
  const info = projectInfo(p, state);
  console.log('SDD status');
  console.log(`  state:  lastCompletedStep=${state.lastCompletedStep} (${state.stepName || '—'}) projectType=${info.projectType || 'unset'}${info.ui ? ' [UI]' : ''}`);
  if (state.notes) console.log(`          ${state.notes}`);
  const v = exists(p.lock) ? L.verifyLock(p.root) : null;
  if (!v) console.log(`  lock:   none (frozen set is not locked yet); a defect or spec gap found now is ${PRE_FREEZE_ROUTE}`);
  else console.log(`  lock:   v${v.lock.lockVersion} ${v.lock.hash.slice(0, 12)} — ${v.valid ? 'INTACT' : `MODIFIED (${v.modified.length} changed, ${v.added.length} added, ${v.removed.length} removed)`}`);
  const run = latestReport(p, 'run-', () => true);
  if (run) console.log(`  oracle: ${run.passed}/${run.total} passed on "${run.target}" at ${run.finishedAt}${v && run.lockHash === v.lock.hash ? '' : ' (STALE: different lock)'}${run.filtered ? ' (filtered)' : ''}`);
  const diff = latestReport(p, 'diff-', () => true);
  if (diff) console.log(`  diff:   ${diff.a} vs ${diff.b}: ${diff.divergentCases} divergent case(s) at ${diff.finishedAt}`);
  const gaps = readGaps(p).rows;
  if (gaps) {
    const open = gaps.filter(g => g.status === 'open');
    const deferred = gaps.filter(g => g.status === 'deferred').length;
    console.log(`  gaps:   ${open.length} open in ${GAPS_FILE} (${open.filter(g => g.kind === 'policy').length} policy, need the user)${deferred ? `, ${deferred} deferred (next-slice candidates)` : ''} — \`sdd.cjs readiness\` for detail`);
  }
  const next = nextStage(state, info);
  if (!next) {
    console.log('\nPipeline complete. Next change: Class 0 (non-observable) → 05; Class 1 (observable) → 01; Class 2 (defect) → 00.');
    return 0;
  }
  console.log(`\nNext stage: ${L.STAGES[next].name} → read specs/.sdd/${L.STAGES[next].name}/CONTEXT.md`);
  printGates(`Exit gates for ${next} (all must pass before \`sdd.cjs transition --completed ${next}\`):`, exitGates(next, p, state, info));
  return 0;
}

function cmdCheck(p, args) {
  const contractsOnly = !!args.flags.contracts;
  const { r } = runCheck(p, { contractsOnly });
  r.print(contractsOnly ? 'sdd check --contracts' : 'sdd check');
  return r.errors.length ? 1 : 0;
}

/** Report-only. Counts known gaps; it never scores, and later stages can still find more. */
function cmdReadiness(p) {
  const state = readState(p);
  const info = projectInfo(p, state);
  console.log('SDD readiness — distance from a freezable spec set (known gaps only; later stages can find more)');
  console.log(`  stage:   lastCompletedStep=${state.lastCompletedStep} (${state.stepName || '—'})${info.ui ? ' [UI]' : ''}`);
  const { r, ctx } = runCheck(p, { contractsOnly: false });
  if (ctx.manifest) {
    const cap = ctx.manifest.sliceCap || DEFAULT_SLICE_CAP;
    const { total, slice } = sliceOutcomes(p, ctx);
    console.log(`  slice:   ${slice === null ? 'unknown (lock predates outcome recording)' : `${slice} new declared outcome(s)`} (cap ${cap}); ${total} in total across ${ctx.ops.length + ctx.commands.length} operation(s)/command(s)`);
  } else console.log('  slice:   no contracts yet (Stage 02 output)');
  const { rows, errors } = readGaps(p);
  if (rows === null) console.log(`  gaps:    no ${GAPS_FILE} yet`);
  else {
    const open = rows.filter(g => g.status === 'open');
    const by = k => open.filter(g => g.kind === k).length;
    console.log(`  gaps:    ${open.length} open — ${by('policy')} policy (need the user), ${by('technical')} technical, ${by('builder')} builder, ${by('ui')} ui, ${by('oracle')} oracle`);
    console.log(`           closed: ${rows.filter(g => g.status === 'resolved' || g.status === 'confirmed').length} resolved/confirmed, ${rows.filter(g => g.status === 'deferred').length} deferred to a later slice`);
    if (errors.length) console.log(`           ⚠ ${errors.length} malformed row(s): ${errors[0]}`);
  }
  const rounds = swarmRounds(p);
  if (rounds) console.log(`  swarm:   ${rounds} Red Team round(s) logged (cap ${SWARM_ROUND_CAP})`);
  const coverage = r.notes.find(n => n.startsWith('coverage:'));
  console.log(`  oracle:  ${coverage || 'no oracle cases yet (Stage 04)'}`);
  const ed = latestReport(p, 'expectdiff-', () => true);
  if (ed) console.log(`           latest diff-expect "${ed.label}": ${ed.totalCases} compared, ${ed.divergentCases} with gaps${ed.skippedGenerated ? `, ${ed.skippedGenerated} generated skipped` : ''}`);
  // Every gate of every spec stage, freshness ignored: the question is "what is still missing", not "what was done this stage".
  const stages = ['02', '03p', ...(info.ui ? ['03'] : []), '04'];
  console.log('  gates (all stages, freshness ignored):');
  for (const s of stages) {
    const gates = exitGates(s, p, { ...state, timestamp: null }, info, { report: true });
    const failing = gates.filter(([ok]) => !ok);
    console.log(`    ${failing.length ? '✗' : '✓'} ${s} ${gates.length - failing.length}/${gates.length}`);
    for (const [, label] of failing) console.log(`        ✗ ${label}`);
  }
  return 0;
}

function cmdFreeze(p, args) {
  const reason = args.flags.reason;
  const by = args.flags['approved-by'];
  if (typeof reason !== 'string' || typeof by !== 'string') fail('freeze requires --reason "<why>" and --approved-by "<who approved>"');
  const { r, ctx } = runCheck(p, { contractsOnly: false });
  if (r.errors.length) { r.print('sdd check'); fail('\nfreeze refused: sdd.cjs check must pass first'); }
  const prev = exists(p.lock) ? L.verifyLock(p.root) : null;
  if (prev && prev.valid) { console.log(`Lock v${prev.lock.lockVersion} already matches the frozen set; nothing to freeze.`); return 0; }
  const cur = L.currentLockState(p.root);
  const now = new Date().toISOString();
  const history = prev
    ? [...(prev.lock.history || []), { lockVersion: prev.lock.lockVersion, frozenAt: prev.lock.frozenAt, reason: prev.lock.reason, approvedBy: prev.lock.approvedBy, hash: prev.lock.hash }]
    : [];
  const lock = {
    tool: 'sdd',
    toolVersion: L.TOOL_VERSION,
    lockVersion: prev ? prev.lock.lockVersion + 1 : 1,
    frozenAt: now,
    reason,
    approvedBy: by,
    hash: cur.hash,
    files: cur.files,
    // Baseline for the next slice's cap (sliceCapGate counts only outcomes not in this list). Not part of the hash.
    outcomes: declaredOutcomes(ctx).sort(),
    history,
  };
  if (prev) {
    console.log(`Re-freezing (v${prev.lock.lockVersion} → v${lock.lockVersion}). Changes:`);
    prev.modified.forEach(f => console.log(`  ~ ${f}`));
    prev.added.forEach(f => console.log(`  + ${f}`));
    prev.removed.forEach(f => console.log(`  - ${f}`));
  }
  L.writeJson(p.lock, lock);
  console.log(`Frozen ${Object.keys(cur.files).length} file(s) as lock v${lock.lockVersion} (${cur.hash.slice(0, 12)}) → specs/spec.lock.json`);
  return 0;
}

function cmdVerify(p) {
  const v = L.verifyLock(p.root);
  if (!v.exists) { console.log('✗ no specs/spec.lock.json — nothing is frozen yet'); return 1; }
  if (v.valid) { console.log(`✓ frozen set intact: lock v${v.lock.lockVersion} (${v.lock.hash.slice(0, 12)}), ${Object.keys(v.lock.files).length} file(s)`); return 0; }
  console.log(`✗ frozen set differs from lock v${v.lock.lockVersion}:`);
  if (!v.intact) console.log('  ! spec.lock.json hash does not match its own file list (lock edited by hand)');
  v.modified.forEach(f => console.log(`  ~ ${f}`));
  v.added.forEach(f => console.log(`  + ${f}`));
  v.removed.forEach(f => console.log(`  - ${f}`));
  console.log('Frozen files change only via a Stage 00 Spec Change Request approved by the user, then `sdd.cjs freeze`.');
  return 1;
}

function cmdTransition(p, args) {
  const stage = L.normalizeStage(args.flags.completed);
  if (!stage) fail(`transition requires --completed <stage>\n\n${USAGE}`);
  const resume = args.flags.resume !== undefined ? L.normalizeStage(args.flags.resume) : null;
  if (args.flags.resume !== undefined && !resume) fail(`invalid --resume ${args.flags.resume}`);
  const state = readState(p);
  const matrix = L.readJson(p.matrix);
  if (args.flags['project-type'] !== undefined) {
    if (!matrix.types[args.flags['project-type']]) fail(`unknown project type "${args.flags['project-type']}" (${Object.keys(matrix.types).join(', ')})`);
    state.projectType = args.flags['project-type'];
  }
  const info = projectInfo(p, state);
  if (resume && !RESUME_TARGETS.includes(resume)) {
    const hint = resume === '03' || resume === '03p' ? ' To rework the prototype or the wireframes, resume at 02 (03p and 03 follow it).' : '';
    fail(`--resume ${args.flags.resume} is not a resume target: use one of ${RESUME_TARGETS.join('|')} (00_backprop/CONTEXT.md §Handoff).${hint}`);
  }
  let order = orderCheck(stage, state, info, p);
  const override = args.flags.override;
  if (!order[0] && typeof override === 'string') {
    if (!/^DEC\d+$/.test(override) || !new RegExp(`\\b${override}\\b`).test(readText(p.decisionLog))) fail(`--override ${override} must cite a DECnnn entry in specs/DECISION_LOG.md recording the user's decision`);
    order = [true, `order overridden by ${override}`];
  }
  const approvedBy = typeof args.flags['approved-by'] === 'string' ? args.flags['approved-by'].trim() : '';
  const release = !!args.flags.release;
  const gates = [order, ...exitGates(stage, p, state, info, { resume, approvedBy, release })];
  printGates(`Exit gates for ${L.STAGES[stage].name}:`, gates);
  if (gates.some(([ok]) => !ok)) { console.log('\n✗ transition refused: fix the failing gates first.'); return 1; }

  let last = L.STAGES[stage].num;
  let note = typeof args.flags.note === 'string' ? args.flags.note : `Completed ${L.STAGES[stage].name}`;
  if (stage === '00') {
    // Resume means "that stage is next": 01b is reached from -1 (the extension's "Pending Adoption").
    last = resume === '01b' ? -1 : L.STAGES[resume].num - 1;
    note = `${note}; resume at ${L.STAGES[resume].name}`;
  } else if (!info.ui && stage === '05') {
    last = 6;
    note = `${note}; 06 skipped (non-UI project)`;
  }
  if (stage === '03p' && approvedBy) note = `${note}; prototype accepted by ${approvedBy}`;
  if (stage === '07' && release) note = `${note}; release certification (L2)`;
  const v = exists(p.lock) ? L.verifyLock(p.root) : null;
  const now = new Date().toISOString();
  // Preserve unknown fields: other tools (e.g. the SDD VS Code extension) share this file.
  const next = { ...state, lastCompletedStep: last, stepName: L.STAGES[stage].name, projectType: info.projectType, timestamp: now, notes: note };
  L.writeJson(p.state, next);
  fs.mkdirSync(p.logs, { recursive: true });
  const record = { ts: now, completed: L.STAGES[stage].name, resume: resume ? L.STAGES[resume].name : null, lastCompletedStep: last, lockHash: v && v.valid ? v.lock.hash : null, note };
  if (stage === '03p') record.approvedBy = approvedBy; // the user's acceptance of the prototype (never self-attested in a file the agent writes)
  if (stage === '07') record.release = release;
  // These open a new iteration: Stage 02's round cap counts swarm-log headings from here (swarmRounds).
  if (['00', '01', '01b'].includes(stage)) record.swarmHeadings = swarmHeadings(p);
  fs.appendFileSync(p.transitions, JSON.stringify(record) + '\n');
  console.log(`\n✓ ${L.STAGES[stage].name} complete → lastCompletedStep=${last}. ${note}`);
  return 0;
}

function cmdExport(p, args) {
  const dir = args._[1];
  if (!dir) fail('export requires a target directory');
  const out = path.resolve(dir);
  const update = !!args.flags.update;
  const bLock = path.join(out, 'specs', 'spec.lock.json');
  if (!update && exists(out) && fs.readdirSync(out).length) fail(`${out} exists and is not empty (use --update to resync an existing build-B workspace)`);
  if (update && !exists(bLock)) fail(`--update needs an existing exported workspace (no ${bLock})`);
  const v = L.verifyLock(p.root);
  if (!v.valid) fail('export refused: the frozen set must be locked and intact (sdd.cjs verify)');
  const bPhases = update && exists(path.join(out, 'specs', 'IMPLEMENTATION_PHASES.md')) ? fs.readFileSync(path.join(out, 'specs', 'IMPLEMENTATION_PHASES.md'), 'utf8') : '';
  const bState = update && exists(path.join(out, 'specs/.sdd/_config/sdd-state.json')) ? L.readJson(path.join(out, 'specs/.sdd/_config/sdd-state.json')) : null;
  if (update) {
    // Remove frozen files that no longer exist in the new lock; B's own code is never touched.
    for (const f of Object.keys(L.readJson(bLock).files)) if (!(f in v.lock.files)) fs.rmSync(path.join(out, f), { force: true });
  }
  const copy = (relPath, transform) => {
    const src = path.join(p.root, relPath);
    const dst = path.join(out, relPath);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (transform) fs.writeFileSync(dst, transform(fs.readFileSync(src, 'utf8')));
    else fs.copyFileSync(src, dst);
  };
  for (const f of Object.keys(v.lock.files)) copy(f);
  copy('specs/spec.lock.json');
  if (exists(p.phases)) {
    // Fresh export: every task unchecked. Update: keep B's progress on tasks whose text is unchanged.
    const doneInB = new Set(bPhases.split(/\r?\n/).filter(l => /^\s*- \[x\]/i.test(l)).map(l => l.replace(/^\s*- \[x\]/i, '').trim()));
    copy('specs/IMPLEMENTATION_PHASES.md', t => t.split(/\r?\n/).map(l => {
      const m = l.match(/^(\s*)- \[[ x]\](.*)$/i);
      if (!m) return l;
      return `${m[1]}- [${doneInB.has(m[2].trim()) ? 'x' : ' '}]${m[2]}`;
    }).join('\n'));
  }
  // Entry files are regenerated from the frozen entrypoint, never copied: a project's own
  // CLAUDE.md/AGENTS.md can carry information outside the spec (a side channel).
  if (exists(p.entrypoint)) {
    const entry = fs.readFileSync(p.entrypoint, 'utf8');
    for (const f of ['AGENTS.md', 'CLAUDE.md', '.cursorrules']) fs.writeFileSync(path.join(out, f), entry);
  }
  const state = readState(p);
  L.writeJson(path.join(out, 'specs/.sdd/_config/sdd-state.json'), {
    ...(bState || {}),
    lastCompletedStep: bState ? Math.min(bState.lastCompletedStep, 4) : 4,
    stepName: L.STAGES['04'].name,
    projectType: projectInfo(p, state).projectType,
    timestamp: new Date().toISOString(),
    notes: `Independent equivalence build ${update ? 'resynced to' : 'exported from'} lock v${v.lock.lockVersion} (${v.lock.hash.slice(0, 12)}). Build with Stage 05 using ONLY these files.`,
  });
  console.log(`${update ? 'Resynced' : 'Exported'} ${Object.keys(v.lock.files).length} frozen file(s) ${update ? 'into' : 'to'} ${out}`);
  console.log('Next: open that directory in a FRESH agent session (no access to the first implementation) and run Stage 05.');
  return 0;
}

function main() {
  const args = L.parseArgs(process.argv.slice(2));
  const root = typeof args.flags.root === 'string' ? path.resolve(args.flags.root) : L.defaultRoot();
  const p = L.projectPaths(root);
  const commands = { status: cmdStatus, check: cmdCheck, freeze: cmdFreeze, verify: cmdVerify, transition: cmdTransition, export: cmdExport, readiness: cmdReadiness };
  const cmd = commands[args._[0]];
  if (!cmd) { console.log(USAGE); return args._[0] ? 2 : 0; }
  return cmd(p, args);
}

// Exit quietly when stdout is closed early (e.g. piped into `head`).
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(process.exitCode || 0); throw e; });

process.exitCode = main();
