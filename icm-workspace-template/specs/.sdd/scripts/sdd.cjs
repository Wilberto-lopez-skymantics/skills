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
  sdd.cjs check [--contracts | --spec]   Validate contracts (+ fixtures, coverage, phases unless --contracts);
                                         --spec: the SPEC.md draft only, before contracts exist (Stages 01–02:
                                         placeholders and unfilled sections are reported, never errors)
  sdd.cjs freeze --reason R --approved-by U   Lock the frozen set (refused unless check passes)
  sdd.cjs verify                         Exit 1 if any frozen file changed since the last freeze
  sdd.cjs transition --completed S [--resume S] [--project-type T] [--note N] [--override DECnnn]
                     [--approved-by U] [--release]
                                         Record a completed stage; refused unless it is the next stage
                                         (or --override cites a DECISION_LOG entry) and its exit gates pass.
                                         02 needs --approved-by (the user who accepted the prototype);
                                         07 with manifest.equivalenceCadence "release" needs --release to certify L2
  sdd.cjs export <dir> [--update]        Copy only the frozen set into <dir> for an independent build
                                         (--update resyncs an existing build-B workspace after a re-freeze)
  sdd.cjs readiness                      Report-only: how far the spec set is from freezable (open gaps,
                                         policy questions for the user, coverage, failing gates per stage)
  sdd.cjs agenda [--write]               The questions only people outside the agent can answer: open policy
                                         gaps and every decision tagged [PENDING-<ROLE>], grouped by role
                                         (--write → specs/logs/agenda.md)
  sdd.cjs metrics                        Per-stage metrics from specs/logs/transitions.jsonl (questions, versions,
                                         rounds, gaps, outcomes, cases), one row per transition
  sdd.cjs spec-outline                   Size of every SPEC section (and module) in KB, to plan a module split
  sdd.cjs upgrade --from <template-root> Replace specs/.sdd with that template's copy (state file kept and mapped
                                         from older stage names, legacy logs renamed, entry files regenerated) and
                                         write specs/logs/upgrade-<version>.md
  sdd.cjs dashboard [--out F] [--json] [--open]
                                         One self-contained HTML page with the pipeline and its state (stages, next
                                         action, gates, budgets, gaps, agenda, oracle, lock, history); default
                                         specs/logs/dashboard.html, also rewritten by every transition. --json: the
                                         same data as JSON (stdout, or F with --out)
Stages: 00 01 01b 02 03 04 05 06 07`;

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
  if (!exists(p.manifest)) { r.error('missing specs/contracts/manifest.json (Stage 03 output; before that, `sdd.cjs check --spec` checks the draft)'); checkSpecText(p, ctx, r); return ctx; }
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
  checkSpecText(p, ctx, r);
  return ctx;
}

// ========== Spec text (the mechanical half of the former spec self-review) ==========

const SPEC_SECTIONS = ['0. Meta', '1. Scope', '2. Glossary', '3. Actors', '4. Domain Model', '5. Operations', '6. Data', '7. Errors', '8. Invariants', '9. Equivalence Boundary', '10. Observable Environment', '11. Equivalence Profile Overrides', '12. Configuration', '13. Limits'];
// The sections a prototype cannot be built without (Stage 01 writes them; the rest may stay "TBD — Stage 03" until hardening). §14 is added for UI projects.
const DRAFT_SECTIONS = ['0', '1', '3', '4', '5'];
const HEDGES = [
  [/\b(approximately|around|about|roughly|circa)\s+\d/i, 'approximate number'],
  [/\b(e\.g\.|for example|such as)\b[^\n.]{0,40}\b\d+\s*(ms|s|sec|seconds?|min|minutes?|hours?|days?|KB|MB|GB|items?|rows?|requests?|%)\b/i, 'example standing in for a parameter value'],
  [/\b(periodically|occasionally|sometimes|from time to time|regularly)\b/i, 'interval not defined'],
  [/\b(fast|slow|quick|large|small|many|few|reasonable|appropriate|sufficient)\s+(enough|number|amount|size|limit|timeout|delay|window|batch|page)\b/i, 'adjective used as a parameter'],
  [/\b(TBD|TODO|FIXME)\b/, 'placeholder'],
];

/** Lines of one spec file with their 1-based numbers, code fences excluded (examples legitimately contain hedges). */
function specLines(text) {
  const out = [];
  let fence = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*```/.test(line)) { fence = !fence; return; }
    if (!fence) out.push([i + 1, line]);
  });
  return out;
}

/** Section body between `## N.` and the next `## ` heading, or null when the heading is missing. */
function specSection(text, n) {
  const m = text.match(new RegExp(`^##\\s+${n}\\.[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm'));
  return m ? m[1] : null;
}

const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function draftSections(ui) { return ui ? [...DRAFT_SECTIONS, '14'] : DRAFT_SECTIONS; }

/** A section counts as filled when its body says something beyond a placeholder (TBD/TODO/FIXME lines and blanks). */
function sectionFilled(text, n) {
  const body = specSection(text, n);
  if (body === null) return false;
  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.some(l => !/\b(TBD|TODO|FIXME)\b/.test(l));
}

/** Stage 01/02 gate: the SPEC.md draft has the sections a prototype is built from; everything else may still be a placeholder. */
function draftGate(p, info) {
  if (!exists(p.spec)) return [false, 'missing specs/SPEC.md'];
  const all = L.specText(p.root);
  const need = draftSections(info.ui);
  const unfilled = need.filter(n => !sectionFilled(all, n));
  if (unfilled.length) return [false, `SPEC.md draft: section(s) ${unfilled.map(n => `§${n}`).join(', ')} missing or still a placeholder (the prototype needs §0 Meta, §1 Scope, §3 Actors, §4 Domain, §5 Operations${info.ui ? ', §14 UI' : ''}; the rest may stay "TBD — Stage 03")`];
  return [true, `SPEC.md draft: ${need.map(n => `§${n}`).join(', ')} filled (placeholders elsewhere are allowed until Stage 03)`];
}

function checkSpecText(p, ctx, r) {
  const files = L.specFiles(p.root);
  if (!files.length) return;
  const texts = files.map(f => [f, readText(path.join(p.root, f))]);
  const all = texts.map(([, t]) => t).join('\n');
  ctx.specText = all;
  const index = texts[0][1];

  // Modules: SPEC.md is the index and links each one; agents reading SPEC.md must learn that the module exists.
  const modules = files.slice(1);
  for (const m of modules) {
    const relFromIndex = m.replace(/^specs\//, '');
    if (!index.includes(`](${relFromIndex})`) && !index.includes(`](./${relFromIndex})`)) r.error(`${m} is not linked from specs/SPEC.md (SPEC.md is the index: add [title](${relFromIndex}))`);
  }
  // Size: a spec no agent reads in one pass is read partially, and partial reading is itself a source of divergence.
  let totalKb = 0;
  for (const [f, t] of texts) {
    const kb = Math.round(Buffer.byteLength(t) / 1024);
    totalKb += kb;
    if (kb > SPEC_SIZE_WARN_KB) r.warn(`${f} is ${kb} KB (> ${SPEC_SIZE_WARN_KB} KB): agents read a file this large partially. Move restated tables (statuses, error codes, fields) into specs/contracts/ and point to them; split the rest into specs/spec/<module>.md with SPEC.md as the index`);
  }
  r.note(`spec: ${files.length} file(s), ${totalKb} KB${modules.length ? ` (${modules.length} module(s) under specs/spec/)` : ''}`);

  // Placeholders and hedges, with file:line. Placeholders are errors once the spec must be complete (Stage 03 on);
  // in draft mode (Stages 01–02, `check --spec`) they are the normal state of the sections hardening fills later.
  const hedgeHits = [];
  const placeholders = [];
  for (const [f, t] of texts) {
    for (const [n, line] of specLines(t)) {
      for (const [re, why] of HEDGES) {
        const m = line.match(re);
        if (!m) continue;
        if (why === 'placeholder') placeholders.push(`${f}:${n}: placeholder "${m[0]}"`);
        else hedgeHits.push(`${f}:${n} (${why}: "${m[0]}")`);
      }
    }
  }
  if (placeholders.length) {
    if (ctx.draft) r.note(`draft: ${placeholders.length} placeholder(s) left for Stage 03 (${placeholders.slice(0, 4).join('; ')}${placeholders.length > 4 ? '; …' : ''})`);
    else for (const ph of placeholders) r.error(`${ph} — the spec is not finished`);
  }
  if (hedgeHits.length) r.warn(`${hedgeHits.length} unquantified parameter(s) — every number must be an exact value, bounded range or formula: ${hedgeHits.slice(0, 8).join('; ')}${hedgeHits.length > 8 ? '; …' : ''}`);

  // Required sections (spec-template.md), anywhere in SPEC.md or a module; §14 for UI projects.
  const missing = SPEC_SECTIONS.map(s => s.split('.')[0]).filter(n => !new RegExp(`^##\\s+${n}\\.`, 'm').test(all));
  if (ctx.typeDef && ctx.typeDef.ui && !/^##\s+14\./m.test(all)) missing.push('14');
  if (missing.length) {
    const msg = `spec is missing section(s) ${missing.map(n => `§${n}`).join(', ')} (structure: specs/.sdd/_config/spec-template.md; "N/A — <why>" is an acceptable body, a missing heading is not)`;
    if (ctx.draft) r.warn(msg); else r.error(msg);
  }
  if (ctx.draft) {
    const need = draftSections(ctx.typeDef && ctx.typeDef.ui);
    const unfilled = need.filter(n => !sectionFilled(all, n));
    r.note(unfilled.length ? `draft sections still to fill before the prototype: ${unfilled.map(n => `§${n}`).join(', ')}` : `draft sections filled: ${need.map(n => `§${n}`).join(', ')} (the prototype can be built)`);
  }
  const boundary = specSection(all, 9);
  if (boundary !== null && !boundary.trim()) r.warn('§9 Equivalence Boundary is empty: list every declared degree of freedom (ids, timestamps, cursors, free text) or state "none"');

  // Cross-artifact: the spec names every operation (it points to the contract instead of restating it, but it must point).
  const unnamed = (ctx.ops || []).map(o => o.operationId).filter(id => !all.includes(id));
  if (unnamed.length) r.warn(`spec never names operation(s) ${unnamed.slice(0, 8).join(', ')}${unnamed.length > 8 ? ', …' : ''} (§5 lists every operation by operationId and points to the contract)`);

  // Profile overrides: SPEC §11 rows and manifest.profileOverrides carry the same rule ids.
  const overrides = (ctx.manifest && ctx.manifest.profileOverrides) || [];
  const sec11 = specSection(all, 11) || '';
  const specRules = new Set([...sec11.matchAll(/^\|\s*`?([A-Z]+-\d+)`?\s*\|/gm)].map(m => m[1]));
  for (const o of overrides) if (!specRules.has(o.rule) && !sec11.includes(o.rule)) r.error(`profile override ${o.rule} is in manifest.profileOverrides but not in SPEC §11 (both must list it, same rule id)`);
  for (const rule of specRules) if (!overrides.some(o => o.rule === rule)) r.error(`profile override ${rule} is in SPEC §11 but not in manifest.profileOverrides`);

  // UI: DESIGN.md components (kebab-case) ↔ SPEC §14 Component Hierarchy (PascalCase). Warnings: the extraction is heuristic.
  if (ctx.typeDef && ctx.typeDef.ui && exists(p.design)) {
    const design = readText(p.design);
    const designKeys = new Set();
    for (const block of design.matchAll(/```ya?ml\s*\n([\s\S]*?)```/g)) {
      try {
        const doc = L.parseYaml(block[1]);
        if (doc && L.isPlainObject(doc.components)) for (const k of Object.keys(doc.components)) designKeys.add(k);
      } catch { /* a malformed block is reported by the design checklist, not here */ }
    }
    const sec14 = specSection(all, 14) || '';
    const specComponents = new Set([...sec14.matchAll(/^\s*(?:[-*]|\d+\.)\s+`?([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+)`?\b/gm)].map(m => m[1]));
    if (designKeys.size && specComponents.size) {
      const noDesign = [...specComponents].filter(c => !designKeys.has(kebab(c)));
      const noSpec = [...designKeys].filter(k => ![...specComponents].some(c => kebab(c) === k));
      if (noDesign.length) r.warn(`SPEC §14 component(s) without a DESIGN.md components entry: ${noDesign.join(', ')} (kebab-case key = data-testid)`);
      if (noSpec.length) r.warn(`DESIGN.md component(s) not in SPEC §14 Component Hierarchy: ${noSpec.join(', ')} (layout-only containers: justify in DESIGN.md)`);
    }
  }
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

  const invariants = L.parseInvariants(ctx.specText !== undefined ? ctx.specText : L.specText(p.root));
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
  const citedInv = new Set();
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
    // A case whose expectations derive from an invariant exercises it: credit `inv:Vn` from derivedFrom citations
    // (SPEC §8 V12, "V12"), not only from an explicit covers entry. Recorded citations never count.
    if (!probe) {
      for (const d of L.specCitations(c)) {
        for (const v of String(d).match(/\bV\d+\b/g) || []) {
          if (invariants.includes(v) && !items.get(`inv:${v}`)) { cover(`inv:${v}`); citedInv.add(v); }
        }
      }
    }
  }
  if (citedInv.size) r.note(`invariants credited from derivedFrom citations: ${citedInv.size} (an explicit covers entry is still the stronger claim)`);
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

  // Exemptions: exact item keys or `*` wildcards; a value is a justification string, or { class } naming a
  // manifest.coverageExemptClasses entry so related exemptions are reviewed as one class, not as free text.
  const exempt = (ctx.manifest && ctx.manifest.coverageExempt) || {};
  const classes = (ctx.manifest && ctx.manifest.coverageExemptClasses) || {};
  const perClass = new Map();
  for (const [k, v] of Object.entries(exempt)) {
    const cls = typeof v === 'object' && v ? v.class : null;
    if (cls && !classes[cls]) r.error(`manifest.coverageExempt "${k}" cites class "${cls}", which is not in manifest.coverageExemptClasses`);
    const re = new RegExp(`^${k.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    const hits = [...items.keys()].filter(i => re.test(i));
    if (!hits.length) r.warn(`manifest.coverageExempt lists "${k}", which matches no coverage item`);
    for (const i of hits) { items.set(i, 'exempt'); perClass.set(cls || '(uncategorized)', (perClass.get(cls || '(uncategorized)') || 0) + 1); }
  }
  for (const cls of Object.keys(classes)) if (!perClass.has(cls)) r.warn(`manifest.coverageExemptClasses "${cls}" is used by no exemption`);
  if (perClass.size) r.note(`coverage exemptions: ${[...perClass.entries()].map(([c, n]) => `${c} ${n}`).join(' · ')}`);
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

/** Stage 03 Outcome Table ↔ contracts: every declared operation status / command exit code is listed, nothing extra. */
function outcomeTableGate(p, ctx) {
  const f = SWARM_FILE;
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

function runCheck(p, { contractsOnly, specOnly, info }) {
  const r = new Report();
  decisionDriftReport(p, r);
  decisionSupersessionReport(p, r);
  if (specOnly) {
    // Draft mode: no contracts yet (Stages 01–02). The project type comes from the state file, not a manifest.
    const ctx = { ops: [], errorCodes: new Map(), machines: [], transitions: new Map(), commands: [], manifest: null, typeDef: (info && info.typeDef) || null, matrix: null, draft: true };
    if (!exists(p.spec)) r.error('missing specs/SPEC.md');
    else checkSpecText(p, ctx, r);
    return { r, ctx };
  }
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
  if (!v.valid) return [[false, `frozen set modified since lock v${v.lock.lockVersion}: ${lockChanges(v).join('; ') || 'lock file tampered'}`], v];
  return [[true, `lock v${v.lock.lockVersion} intact (${v.lock.hash.slice(0, 12)})`], v];
}

/** Every difference between the lock and the frozen set: the pipeline pin as one line, then the spec files. */
function lockChanges(v) {
  const out = [];
  const pl = L.pipelineLine(v);
  if (pl) out.push(pl);
  const files = [...v.modified.map(f => `~${f}`), ...v.added.map(f => `+${f}`), ...v.removed.map(f => `-${f}`)];
  if (files.length) out.push(files.join(', '));
  return out;
}

/** Spec-file counts for a modified lock, e.g. "2 changed, 1 added, 0 removed" — or null when only the pipeline moved. */
function specFileCounts(v) {
  if (!v.modified.length && !v.added.length && !v.removed.length) return null;
  return `${v.modified.length} changed, ${v.added.length} added, ${v.removed.length} removed`;
}

const lockFileCount = l => l.modified.length + l.added.length + l.removed.length;
const lockTileText = l => { const n = lockFileCount(l); return [l.pipeline.changed ? 'pipeline changed' : null, n ? `${n} spec file(s) changed` : null].filter(Boolean).join(', '); };

const REFREEZE_HINT = v => v && v.pipeline && v.pipeline.changed && !specFileCounts(v) ? ` — re-freeze with the user's approval: \`sdd.cjs freeze --reason "upgrade: ${v.pipeline.to}" --approved-by "<user>"\`` : '';

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

// ========== Decision log: append-only ==========

const DECISIONS_FP = 'specs/logs/decisions.fingerprint.json';

/** Every `| DECnnn |` row of specs/DECISION_LOG.md → a short hash of the row (whitespace-normalized). */
function decisionRows(p) {
  const out = {};
  for (const line of readText(p.decisionLog).split(/\r?\n/)) {
    const m = line.match(/^\|\s*(DEC\d{3})\s*\|/);
    if (m) out[m[1]] = require('crypto').createHash('sha256').update(line.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);
  }
  return out;
}

/** Written at every transition: the rows as they were. The log is append-only; a later edit of an earlier row is drift. */
function writeDecisionFingerprint(p, ts) {
  if (!exists(p.decisionLog)) return;
  fs.mkdirSync(p.logs, { recursive: true });
  L.writeJson(path.join(p.root, DECISIONS_FP), { ts, rows: decisionRows(p) });
}

function decisionDrift(p) {
  const fp = path.join(p.root, DECISIONS_FP);
  if (!exists(fp) || !exists(p.decisionLog)) return null;
  let base;
  try { base = L.readJson(fp); } catch { return null; }
  const now = decisionRows(p);
  const changed = Object.keys(base.rows || {}).filter(k => now[k] && now[k] !== base.rows[k]);
  const removed = Object.keys(base.rows || {}).filter(k => !now[k]);
  return { ts: base.ts, changed, removed };
}

function decisionDriftReport(p, r) {
  const d = decisionDrift(p);
  if (!d) return;
  if (d.changed.length) r.warn(`DECISION_LOG.md is append-only, but ${d.changed.length} row(s) recorded at ${d.ts} were rewritten since: ${d.changed.slice(0, 8).join(', ')}${d.changed.length > 8 ? ', …' : ''} — a changed decision is a new entry that cites the old one; derived artifacts (traceability, design packages) cite rows by id`);
  if (d.removed.length) r.warn(`DECISION_LOG.md: ${d.removed.length} row(s) recorded at ${d.ts} are gone: ${d.removed.slice(0, 8).join(', ')} — never delete an entry; supersede it`);
}

// Supersession: a row whose text says `supersedes DECnnn` (case-insensitive, one or more ids) replaces those rows.
// The replaced rows stay in the log (append-only) but no longer count: a [PENDING-<ROLE>] row that is superseded
// drops off the agenda, readiness and the dashboard.
const PENDING_TAG = /\[PENDING-([A-Z][A-Z0-9-]*)\]/g;
const DECISION_ROW = /^\|\s*(DEC\d{3})\s*\|\s*((?:[^|\\]|\\.)*?)\s*\|/;

/** The ids a row says it supersedes: `supersedes DEC003`, `Supersedes DEC003, DEC005 and DEC007`. */
function supersededIdsIn(line) {
  const ids = [];
  for (const m of line.matchAll(/\bsupersedes\s+((?:DEC\d{3}\b[\s,;&]*(?:and\s+)?)+)/gi)) {
    for (const id of m[1].match(/DEC\d{3}/gi) || []) ids.push(id.toUpperCase());
  }
  return ids;
}

/** Every `| DECnnn |` row of specs/DECISION_LOG.md in file order: { id, title, roles, supersedes, line }. */
function decisionEntries(p) {
  const out = [];
  for (const line of readText(p.decisionLog).split(/\r?\n/)) {
    const m = line.match(DECISION_ROW);
    if (!m) continue;
    out.push({ id: m[1], title: m[2].replace(/\s+/g, ' ').slice(0, 160), roles: [...new Set([...line.matchAll(PENDING_TAG)].map(x => x[1]))], supersedes: supersededIdsIn(line).filter(id => id !== m[1]), line });
  }
  return out;
}

/** The set of ids that some row of the log supersedes. */
function supersededDecisions(p) {
  const out = new Set();
  for (const e of decisionEntries(p)) for (const id of e.supersedes) out.add(id);
  return out;
}

/** The [PENDING-<ROLE>]-tagged rows that no row supersedes — the agenda's, readiness's and the dashboard's one rule. */
function pendingDecisions(p) {
  const superseded = supersededDecisions(p);
  return decisionEntries(p).filter(e => e.roles.length && !superseded.has(e.id));
}
const pendingTagCount = p => pendingDecisions(p).reduce((n, e) => n + e.roles.length, 0);

/** `supersedes` must name rows that exist; a pending row cited by a later row that does not say `supersedes` is probably an answer that forgot the word. */
function decisionSupersessionReport(p, r) {
  const entries = decisionEntries(p);
  if (!entries.length) return;
  const known = new Set(entries.map(e => e.id));
  for (const e of entries) for (const id of e.supersedes) if (!known.has(id)) r.error(`DECISION_LOG.md: ${e.id} supersedes ${id}, which is not in specs/DECISION_LOG.md`);
  const superseded = supersededDecisions(p);
  entries.forEach((e, i) => {
    if (!e.roles.length || superseded.has(e.id)) return;
    const citing = entries.slice(i + 1).filter(later => new RegExp(`\\b${e.id}\\b`).test(later.line)).map(later => later.id);
    if (citing.length) r.warn(`DECISION_LOG.md: ${citing.join(', ')} cite${citing.length === 1 ? 's' : ''} pending ${e.id} without superseding it — if that row is the answer, write "supersedes ${e.id}" in it so ${e.id} drops off the agenda`);
  });
}

// ========== Gap register, rulings ledger, slice cap (prototype-first pipeline) ==========

const GAPS_FILE = 'specs/GAPS.md';
const GAP_KINDS = ['policy', 'technical', 'builder', 'ui', 'oracle'];
const GAP_STATUSES = ['open', 'resolved', 'confirmed', 'deferred'];
// G-001 by default; projects that already number gaps keep their scheme (G04-01, G-S2, G-UI1).
const GAP_ID = /^G[0-9A-Za-z]*-[0-9A-Za-z]+$/;
const GAP_REF = /\bG[0-9A-Za-z]*-[0-9A-Za-z]+\b/g;
// Stage 03 (hardening) working files: Outcome Table + Red Team rounds, rulings ledger, prototype Decision Inventory.
const SWARM_FILE = 'specs/logs/03-swarm.md';
const RULINGS_FILE = 'specs/logs/03-rulings.md';
const DECISIONS_FILE = 'specs/logs/03-decisions.md';
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
    if (!GAP_ID.test(r.id)) errors.push(`${where}: ID must look like G-001 (a project prefix is fine: G04-01, G-S2)`);
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

/** allowOpen: Stages 01–03 record gaps; Stage 04 (freeze) requires every gap closed or deferred by decision. */
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

/** Stage 03 rulings ledger: every triaged finding has a ruling; nothing is left open. */
function rulingsGate(p, freshAfter) {
  const fg = fileGate(p, RULINGS_FILE, 'Stage 03 rulings ledger', freshAfter);
  if (!fg[0]) return fg;
  const rows = ledgerRows(readText(path.join(p.root, RULINGS_FILE)), ['id', 'ruling', 'status']);
  if (!rows) return [false, `${RULINGS_FILE}: no table with columns ID | Round | Persona | Finding | Fork | Ruling | Status`];
  const bad = rows.filter(r => !RULING_STATUSES.includes(r.status.toLowerCase()));
  if (bad.length) return [false, `${RULINGS_FILE}: Status must be ${RULING_STATUSES.join('|')} (found ${bad.slice(0, 3).map(r => r.status || '(empty)').join(', ')})`];
  const open = rows.filter(r => r.status.toLowerCase() === 'open');
  if (open.length) return [false, `${RULINGS_FILE}: ${open.length} open finding(s) — rule each one (blocking findings left after round ${SWARM_ROUND_CAP} go to the user, or to ${GAPS_FILE} as status gap)`];
  const gaps = readGaps(p).rows || [];
  const ids = new Set(gaps.map(g => g.id));
  const dangling = rows.filter(r => r.status.toLowerCase() === 'gap').filter(r => !(Object.values(r).join(' ').match(GAP_REF) || []).some(g => ids.has(g)));
  if (dangling.length) return [false, `${RULINGS_FILE}: ${dangling.length} finding(s) ruled "gap" without a G-nnn row in ${GAPS_FILE} (${dangling.slice(0, 3).map(r => r.id).join(', ')})`];
  return [true, `rulings: ${rows.length} finding(s) ruled, none open`];
}

function readTransitions(p) {
  return readText(p.transitions).split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
}

/** `## 🔄 Iteration N` headings in the append-only swarm log, across every iteration so far. */
function swarmHeadings(p) {
  return (readText(path.join(p.root, SWARM_FILE)).match(/^##\s+(?:🔄\s*)?Iteration\s+\d+/gm) || []).length;
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

/** Operation ids named in SPEC.md §5 (bullet, table row or heading starting with a backticked identifier), index and modules together. */
function specOperationNames(p) {
  const files = L.specFiles(p.root);
  if (!files.length) return [];
  const sec = specSection(files.map(f => readText(path.join(p.root, f))).join('\n'), 5) || '';
  return [...new Set([...sec.matchAll(/^\s*(?:[-*]|\||#+)\s*(?:[\d.]+\s+)?`([A-Za-z_][\w.-]*)`/gm)].map(m => m[1]))];
}

/**
 * What the accepted prototype declares, recorded in its Stage 02 transition row (sliceLedger reads it back at Stage 03).
 * Contract outcome keys when the contracts exist and check clean; else the operations SPEC.md §5 names (`spec:<id>`);
 * else null with a note. The row keeps every other field.
 */
function acceptedOutcomes(p) {
  if (exists(p.manifest)) {
    try {
      const { r, ctx } = runCheck(p, { contractsOnly: true });
      if (!r.errors.length) return { outcomes: declaredOutcomes(ctx).sort(), outcomesSource: 'contracts' };
    } catch { /* unreadable contracts: fall back to the spec */ }
  }
  const ops = specOperationNames(p);
  if (ops.length) return { outcomes: ops.map(n => `spec:${n}`), outcomesSource: 'spec' };
  return { outcomes: null, outcomesSource: null, outcomesNote: 'no contracts and no operation named in SPEC.md §5 at acceptance: under a rolling cadence this slice\'s outcomes are counted with the next accepted prototype\'s (or as the whole set)' };
}

const outcomeOp = k => String(k).split(':')[1] || '';

/**
 * Rolling cadence: one entry per prototype accepted since the last lock (Stage 02 rows of transitions.jsonl), each sized by the
 * current declared outcomes it introduced. An outcome belongs to the first slice whose row recorded its key, else to the first slice
 * whose row recorded its operation (spec rows name operations only), else — added while hardening, under no accepted prototype —
 * to the last slice (`hardening` counts them). Outcomes in the lock belong to no slice. slice === null: the lock predates recording.
 * No row since the lock → slices is empty and `slice` is the whole set (the default cadence's count).
 */
function sliceLedger(p, ctx) {
  const all = declaredOutcomes(ctx);
  let lockKeys = [];
  let since = null;
  if (exists(p.lock)) {
    let lock = null;
    try { lock = L.readJson(p.lock); } catch { /* unreadable lock: lockGate reports it */ }
    if (!lock || !Array.isArray(lock.outcomes)) return { total: all.length, slice: null, slices: null };
    lockKeys = lock.outcomes;
    since = lock.frozenAt || null;
  }
  const lockSet = new Set(lockKeys);
  const seenKeys = new Set(lockKeys);
  const seenOps = new Set(lockKeys.map(outcomeOp));
  const slices = [];
  for (const t of readTransitions(p).filter(t => t.completed === L.STAGES['02'].name && (!since || t.ts > since))) {
    const keys = Array.isArray(t.outcomes) ? t.outcomes : [];
    const ops = new Set(keys.map(outcomeOp).filter(o => o && !seenOps.has(o)));
    const fresh = new Set(keys.filter(k => !seenKeys.has(k)));
    slices.push({ n: slices.length + 1, ts: t.ts, approvedBy: t.approvedBy || null, source: t.outcomesSource || null, size: 0, hardening: 0, _keys: fresh, _ops: ops });
    keys.forEach(k => seenKeys.add(k));
    ops.forEach(o => seenOps.add(o));
  }
  const fresh = all.filter(k => !lockSet.has(k));
  if (!slices.length) return { total: all.length, slice: fresh.length, slices: [] };
  for (const k of fresh) {
    let s = slices.find(x => x._keys.has(k)) || slices.find(x => x._ops.has(outcomeOp(k)));
    if (!s) { s = slices[slices.length - 1]; s.hardening++; }
    s.size++;
  }
  return { total: all.length, slice: fresh.length, slices: slices.map(({ _keys, _ops, ...rest }) => rest) };
}

/** "#1 9, #2 21 (3 added in hardening)" — one entry per accepted slice. */
function sliceList(slices) {
  return slices.map(s => `#${s.n} ${s.size}${s.hardening ? ` (${s.hardening} added in hardening)` : ''}`).join(', ');
}

function sliceCapGate(p, ctx) {
  const m = ctx.manifest || {};
  const cap = m.sliceCap || DEFAULT_SLICE_CAP;
  const needsDecision = cap > DEFAULT_SLICE_CAP;
  if (needsDecision && !citesDecision(p, m.sliceCapDecision)) return [false, `manifest.sliceCap ${cap} exceeds the default ${DEFAULT_SLICE_CAP}: manifest.sliceCapDecision must cite a DECnnn in specs/DECISION_LOG.md`];
  const split = 'split the slice with the user, or raise manifest.sliceCap with a recorded user decision';
  if (m.prototypeCadence === 'rolling') {
    // Several prototypes were accepted before this hardening pass: the cap reads per accepted slice, not for their sum.
    const { total, slice, slices } = sliceLedger(p, ctx);
    if (slice === null) return [true, `slice size unknown: specs/spec.lock.json predates outcome recording (the next freeze records it); ${total} declared outcome(s) in total (cap ${cap} per slice)`];
    if (!slices.length) {
      if (slice > cap) return [false, `rolling cadence, but no accepted prototype recorded its outcomes since the last lock: the whole set counts as one slice — ${slice} new declared outcome(s), cap ${cap} (${total} in total): ${split}`];
      return [true, `rolling cadence: no accepted prototype recorded its outcomes since the last lock, so the whole set counts as one slice — ${slice} new declared outcome(s) (cap ${cap}); ${total} in total`];
    }
    const over = slices.filter(s => s.size > cap);
    if (over.length) return [false, `rolling cadence: slice ${over.map(s => `#${s.n} (accepted ${String(s.ts).slice(0, 10)}${s.approvedBy ? ` by ${s.approvedBy}` : ''}) adds ${s.size}`).join('; ')} declared outcome(s), cap ${cap} per slice — slices since the last lock: ${sliceList(slices)}; ${total} in total: ${split}`];
    return [true, `rolling cadence: ${slices.length} accepted slice(s) since the last lock, each within cap ${cap} — ${sliceList(slices)} new declared outcome(s); ${total} in total`];
  }
  const { total, slice } = sliceOutcomes(p, ctx);
  if (slice === null) return [true, `slice size unknown: specs/spec.lock.json predates outcome recording (the next freeze records it); ${total} declared outcome(s) in total (cap ${cap} per slice)`];
  if (slice > cap) return [false, `slice adds ${slice} declared outcome(s), cap ${cap} (${total} in total): split the scope into slices (each runs 01 → 07), or raise manifest.sliceCap with a recorded user decision`];
  return [true, `slice size: ${slice} new declared outcome(s) (cap ${cap}); ${total} in total`];
}

const RUN_LINE = /^\**Run:?\**:?\s*\S+/mi;
const PROTOTYPE_FILE = 'specs/logs/02-prototype.md';
const INTERVIEW_FILE = 'specs/logs/01-interview.md';

// Budgets are counts shown against actuals (never a block); manifest.budgets overrides them per project.
// 12 interview questions: the interview stops at the slice's core flow; the rest is asked at a demo, with the product on screen.
const DEFAULT_BUDGETS = { interviewQuestions: 12, prototypeVersions: 3, swarmRounds: SWARM_ROUND_CAP };
function budgets(info) { return { ...DEFAULT_BUDGETS, ...((info && info.manifest && info.manifest.budgets) || {}) }; }

/** Rows of the Stage 01 interview log: one question per row, with its answer and where it was recorded. */
function interviewRows(p) {
  const fp = path.join(p.root, INTERVIEW_FILE);
  return exists(fp) ? ledgerRows(readText(fp), ['question', 'answer']) : null;
}

/** Rows of the prototype record's Versions table: one demo the user saw per row. */
function prototypeVersions(p) {
  const fp = path.join(p.root, PROTOTYPE_FILE);
  return exists(fp) ? ledgerRows(readText(fp), ['version']) : null;
}

/** Stage 02: the prototype record says how to start the prototype (Stage 04 records the oracle against it) and lists every demo. */
function prototypeGate(p, freshAfter) {
  const fg = fileGate(p, PROTOTYPE_FILE, 'prototype record', freshAfter);
  if (!fg[0]) return fg;
  const text = readText(path.join(p.root, PROTOTYPE_FILE));
  if (!RUN_LINE.test(text)) return [false, `${PROTOTYPE_FILE}: add a "**Run:** <start command>" line (Stage 04 records the oracle against the running prototype)`];
  const versions = prototypeVersions(p);
  if (!versions || !versions.length) return [false, `${PROTOTYPE_FILE}: no Versions table (| Version | Date | Changed | Gaps closed | Decisions |) — every demo the user saw is one row`];
  return [true, `${PROTOTYPE_FILE}: run command recorded, ${versions.length} prototype version(s) shown`];
}

/**
 * Stage 02 acceptance is the user's, not the agent's: it is given on the command line and recorded in
 * transitions.jsonl, never typed into a file the agent also writes. `report` (readiness) skips it.
 */
function acceptanceGate(opts) {
  const by = typeof opts.approvedBy === 'string' ? opts.approvedBy.trim() : '';
  if (!by) return [false, 'missing --approved-by "<user>": the prototype stage ends only on the user\'s explicit acceptance, recorded in specs/logs/transitions.jsonl'];
  return [true, `prototype accepted by ${by} (recorded in transitions.jsonl)`];
}

/**
 * Stages 02 and 03 on an iteration (a lock exists): the prototype is the certified build A, and the previous slice's
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
      // The draft: the sections a prototype is built from. Placeholders elsewhere are the normal state until Stage 03.
      add(draftGate(p, info));
      add(fileGate(p, 'specs/DECISION_LOG.md'));
      if (info.ui) add(fileGate(p, 'specs/DESIGN.md', 'UI project'));
      {
        // The interview is the audit trail of "every business decision is made with the user"; its length is a budget, not a gate.
        // Adoption (01b) asks the same way: only what the code cannot answer, within the same budget.
        const ig = fileGate(p, INTERVIEW_FILE, 'one row per question asked', freshAfter);
        if (!ig[0]) add(ig);
        else {
          const rows = interviewRows(p);
          const b = budgets(info).interviewQuestions;
          add([!!(rows && rows.length), rows && rows.length ? `${INTERVIEW_FILE}: ${rows.length} question(s) (budget ${b})${rows.length > b ? ' — over budget: the rest belongs in the prototype demos' : ''}` : `${INTERVIEW_FILE}: no table with columns # | Question | Answer | Recorded in`]);
        }
      }
      // Open gaps are allowed: every unanswered question is a row with a provisional assumption the prototype will build.
      add(gapsGate(p, { requireFile: false, allowOpen: true }));
      break;
    }
    case '02': {
      // The prototype stage ends on the user's acceptance of a running product. No contracts, rounds or oracle yet: Stage 03.
      add(draftGate(p, info));
      if (info.ui) add(fileGate(p, 'specs/DESIGN.md', 'UI project'));
      add(prototypeGate(p, freshAfter));
      if (!opts.report) add(acceptanceGate(opts));
      add(gapsGate(p, { requireFile: false, allowOpen: true }));
      const rg = prototypeRegressionGate(p, freshAfter);
      if (rg) add(rg);
      break;
    }
    case '03': {
      // Hardening: contracts + a complete spec (check errors on placeholders from here on), Outcome Table, Decision Inventory,
      // Red Team rounds against the running prototype, a sampled interpretation diff, and (UI) the captured wireframes.
      const { r, ctx } = runCheck(p, { contractsOnly: true });
      add([!r.errors.length, r.errors.length ? `sdd.cjs check --contracts: ${r.errors.length} error(s) (contracts valid, spec complete: no placeholders, every section)` : 'sdd.cjs check --contracts passes (contracts valid, spec complete)']);
      if (!r.errors.length) add(sliceCapGate(p, ctx));
      const lg = fileGate(p, SWARM_FILE, 'Outcome Table + Red Team rounds', freshAfter);
      add(lg);
      if (lg[0] && !r.errors.length) add(outcomeTableGate(p, ctx));
      add(fileGate(p, DECISIONS_FILE, 'prototype Decision Inventory', freshAfter));
      add(gapsGate(p, { requireFile: false, allowOpen: true }));
      const rounds = swarmRounds(p);
      add([rounds >= 1, rounds ? `${rounds} Red Team round(s) logged this iteration (cap ${SWARM_ROUND_CAP})${rounds > SWARM_ROUND_CAP ? ' — over the cap: blocking findings left after the cap go to the user, not to another round' : ''}` : `no Red Team round logged (round 1 attacks the whole slice with the prototype running; \`## 🔄 Iteration 1\` heading in ${SWARM_FILE})`]);
      add(rulingsGate(p, freshAfter));
      // Sample: one predicted case per operation/command, by authors who never saw the prototype. The full dual check runs once, in Stage 04.
      add(expectDiffGate(p, freshAfter, false, Math.max(1, ctx.ops.length + ctx.commands.length)));
      if (info.ui) {
        const html = exists(p.wireframes) ? fs.readdirSync(p.wireframes).filter(f => f.endsWith('.html')) : [];
        add([html.length > 0, html.length ? `${html.length} wireframe(s) captured in specs/wireframes/` : 'no wireframes in specs/wireframes/ (UI project: capture every screen state from the prototype with ui-capture.cjs)']);
        const design = readText(p.design);
        add([/^##\s+Approved Wireframes/m.test(design) && /\]\((\.\/)?wireframes\/[^)]+\.html\)/.test(design), 'DESIGN.md §Approved Wireframes links wireframes with relative paths']);
      }
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

/** The value of lastCompletedStep after completing `stage` (non-UI projects skip 06). */
function completedValue(stage, ui) {
  if (!ui && stage === '05') return 6;
  return L.STAGES[stage].num;
}

/**
 * Is completing `stage` the next step of the pipeline from the current state?
 * Order: 01 (or 01b) → 02 prototype → 03 hardening → 04 oracle + freeze → 05 build → (06, UI) → 07. Linear for every project type.
 */
function orderCheck(stage, state, info) {
  const last = typeof state.lastCompletedStep === 'number' ? state.lastCompletedStep : 0;
  const n = L.STAGES[stage].num;
  const name = state.stepName;
  if (stage === '00') return [true, 'Stage 00 may run at any time'];
  // manifest.prototypeCadence "rolling": several slices are prototyped (01 → 02 each) before one hardening pass;
  // the next slice's brief may follow an accepted prototype. The slice cap still applies at Stage 03.
  if (stage === '01' && last === 2 && info.manifest && info.manifest.prototypeCadence === 'rolling') return [true, 'rolling prototypes (manifest.prototypeCadence): the next slice\'s brief follows the accepted prototype; hardening is deferred and the slice cap applies per accepted slice at Stage 03'];
  // Before Stage 03 there is no manifest to declare a cadence: the user chooses at acceptance (harden now, or another slice first; recorded as a DECnnn that Stage 03 writes into the manifest).
  if (stage === '01' && last === 2 && !info.manifest) return [true, 'next slice before hardening (no contracts yet: the cadence is the user\'s choice at acceptance, recorded as a DECnnn; Stage 03 declares it in manifest.prototypeCadence)'];
  if (stage === '06' && !info.ui) return [false, `${L.STAGES[stage].name} applies only to UI projects`];
  if (completedValue(stage, info.ui) === last) return [true, `re-running ${L.STAGES[stage].name}`];
  if (stage === '01b' && last <= 0) return [true, 'adoption of an existing codebase'];
  if (stage === '01' && (last <= 0 || last === 7)) return [true, last === 7 ? 'new Class 1 iteration' : 'pipeline start'];
  if (stage === '02' && last === 1) return [true, name === STAGES_01B ? 'walkthrough of the adopted system as the prototype' : 'prototype of the slice brief'];
  if (stage === '04' && last === 3 && name === STAGES_00) return [true, 'resuming after Stage 00 (--resume 04); the accepted prototype is unchanged'];
  if (stage === '05' && last === 7) return [true, 'Class 0 change on a certified build'];
  if (n === last + 1 && stage !== '01b') return [true, `next stage after lastCompletedStep=${last}`];
  return [false, `${L.STAGES[stage].name} is out of order: lastCompletedStep=${last} (${name || '—'}); run \`sdd.cjs status\` for the next stage, or pass --override DECnnn citing the user's decision to skip`];
}
const STAGES_00 = '00_backprop';
const STAGES_01B = '01b_adoption';
// Where the pipeline may continue after Stage 00 (00_backprop/CONTEXT.md §Handoff): 02 reworks the prototype, 03 re-hardens.
const RESUME_TARGETS = ['01', '01b', '02', '03', '04', '05'];
const PRE_FREEZE_ROUTE = `not a Class 2 change — edit the spec in the current stage and add (or close) a ${GAPS_FILE} row instead of running Stage 00`;

/** Counts recorded with every transition (never a score): swarm rounds, gap register, rulings, declared outcomes, oracle cases. */
function stageMetrics(p) {
  const m = { swarmRounds: swarmRounds(p) };
  const gaps = readGaps(p).rows;
  if (gaps) { m.gapsOpen = gaps.filter(g => g.status === 'open').length; m.gapsDeferred = gaps.filter(g => g.status === 'deferred').length; m.gapsTotal = gaps.length; }
  const rulings = exists(path.join(p.root, RULINGS_FILE)) ? ledgerRows(readText(path.join(p.root, RULINGS_FILE)), ['id', 'ruling', 'status']) : null;
  if (rulings) m.rulings = rulings.length;
  const questions = interviewRows(p);
  if (questions) m.interviewQuestions = questions.length;
  const versions = prototypeVersions(p);
  if (versions) m.prototypeVersions = versions.length;
  try {
    if (exists(p.manifest)) {
      const { r, ctx } = runCheck(p, { contractsOnly: true });
      if (!r.errors.length) m.declaredOutcomes = declaredOutcomes(ctx).length;
    }
    if (exists(p.cases)) { const cs = L.loadCases(p).cases; m.cases = cs.length; m.probes = cs.filter(c => c.probe).length; }
  } catch { /* metrics never block a transition */ }
  return m;
}

function printGates(title, gates) {
  console.log(title);
  for (const [ok, label] of gates) console.log(`  ${ok ? '✓' : '✗'} ${label}`);
}

function nextStage(state, info) {
  const last = state.lastCompletedStep;
  if (last === -1) return '01b';
  if (last === 0) return '01';
  if (last === 1) return '02';
  if (last === 2) return '03';
  if (last === 3) return '04';
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
  else {
    const counts = specFileCounts(v);
    const pl = L.pipelineLine(v);
    console.log(`  lock:   v${v.lock.lockVersion} ${v.lock.hash.slice(0, 12)} — ${v.valid ? 'INTACT' : `MODIFIED (${counts ? `spec files: ${counts}${pl ? '; pipeline, see below' : ''}` : 'pipeline only'}${!v.intact ? '; lock file edited by hand' : ''})`}`);
    if (pl) console.log(`          ${pl}${REFREEZE_HINT(v)}`);
  }
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
  const drift = decisionDrift(p);
  if (drift && (drift.changed.length || drift.removed.length)) console.log(`  log:    ⚠ DECISION_LOG.md rows rewritten or removed since ${drift.ts}: ${[...drift.changed, ...drift.removed.map(x => '-' + x)].slice(0, 6).join(', ')} (append-only: supersede, never edit) — \`sdd.cjs check\` for detail`);
  const next = nextStage(state, info);
  if (!next) {
    console.log('\nPipeline complete. Next change: Class 0 (non-observable) → 05; Class 1 (observable) → 01; Class 2 (defect) → 00.');
    return 0;
  }
  console.log(`\nNext stage: ${L.STAGES[next].name} → read specs/.sdd/${L.STAGES[next].name}/CONTEXT.md`);
  if (next === '03' && info.manifest && info.manifest.prototypeCadence === 'rolling') console.log('        (rolling cadence: `transition --completed 01` for the next slice is also in order; hardening when the user says so)');
  else if (next === '03' && !info.manifest) console.log('        (no contracts yet: `transition --completed 01` for another slice is also in order — the user chooses at acceptance; Stage 03 writes the choice into manifest.prototypeCadence)');
  printGates(`Exit gates for ${next} (all must pass before \`sdd.cjs transition --completed ${next}\`):`, exitGates(next, p, state, info));
  return 0;
}

function cmdCheck(p, args) {
  const contractsOnly = !!args.flags.contracts;
  const specOnly = !!args.flags.spec;
  const { r } = runCheck(p, { contractsOnly, specOnly, info: specOnly ? projectInfo(p, readState(p)) : null });
  r.print(specOnly ? 'sdd check --spec (draft)' : contractsOnly ? 'sdd check --contracts' : 'sdd check');
  return r.errors.length ? 1 : 0;
}

/** The stages left before the freeze, in plain words, with the next action that is the user's. */
function specPath(info) {
  return [
    ['01', 'interview → slice brief: spec draft, decisions, gap register', 'answer the interview, one question per message, then OK the slice brief'],
    ['02', 'prototype demos (numbered versions), your policy answers with the product on screen, your acceptance', 'try the prototype, answer the open policy questions, accept with `sdd.cjs transition --completed 02 --approved-by "<you>"`'],
    ['03', `contracts compiled against the prototype, spec completed, Red Team rounds, sampled interpretation diff${info.ui ? ', wireframes captured from the prototype' : ''} (agent, prototype running)`, `answer the batched policy questions a round raises${info.ui ? '; review each captured screen' : ''}`],
    ['04', 'oracle recorded from the prototype and predicted from the spec, phases, freeze', 'approve the freeze'],
  ];
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
    const across = `across ${ctx.ops.length + ctx.commands.length} operation(s)/command(s)`;
    if (ctx.manifest.prototypeCadence === 'rolling') {
      const { total, slice, slices } = sliceLedger(p, ctx);
      const sizes = slice === null ? 'unknown (lock predates outcome recording)' : slices.length ? `${slices.length} accepted slice(s) since the last lock: ${sliceList(slices)} new declared outcome(s)` : `${slice} new declared outcome(s) (no accepted prototype recorded its outcomes since the last lock: counted as one slice)`;
      console.log(`  slice:   rolling cadence — ${sizes} (cap ${cap} per slice); ${total} in total ${across}`);
    } else {
      const { total, slice } = sliceOutcomes(p, ctx);
      console.log(`  slice:   ${slice === null ? 'unknown (lock predates outcome recording)' : `${slice} new declared outcome(s)`} (cap ${cap}); ${total} in total ${across}`);
    }
  } else console.log('  slice:   no contracts yet (Stage 03 compiles them against the accepted prototype)');
  const { rows, errors } = readGaps(p);
  if (rows === null) console.log(`  gaps:    no ${GAPS_FILE} yet`);
  else {
    const open = rows.filter(g => g.status === 'open');
    const by = k => open.filter(g => g.kind === k).length;
    console.log(`  gaps:    ${open.length} open — ${by('policy')} policy (need the user), ${by('technical')} technical, ${by('builder')} builder, ${by('ui')} ui, ${by('oracle')} oracle`);
    console.log(`           closed: ${rows.filter(g => g.status === 'resolved' || g.status === 'confirmed').length} resolved/confirmed, ${rows.filter(g => g.status === 'deferred').length} deferred to a later slice`);
    if (errors.length) console.log(`           ⚠ ${errors.length} malformed row(s): ${errors[0]}`);
  }
  // Budgets vs actuals: counts the user can read, never a score and never a block.
  const b = budgets(info);
  const q = interviewRows(p);
  const versions = prototypeVersions(p);
  const rounds = swarmRounds(p);
  const over = (n, lim) => (n > lim ? ' ⚠ over budget' : '');
  console.log(`  budget:  interview ${q ? q.length : 0}/${b.interviewQuestions} question(s)${q ? over(q.length, b.interviewQuestions) : ''} · prototype ${versions ? versions.length : 0}/${b.prototypeVersions} version(s)${versions ? over(versions.length, b.prototypeVersions) : ''} · Red Team ${rounds}/${b.swarmRounds} round(s)${over(rounds, b.swarmRounds)}`);
  const coverage = r.notes.find(n => n.startsWith('coverage:'));
  console.log(`  oracle:  ${coverage || 'no oracle cases yet (Stage 04)'}`);
  const ed = latestReport(p, 'expectdiff-', () => true);
  if (ed) console.log(`           latest diff-expect "${ed.label}": ${ed.totalCases} compared, ${ed.divergentCases} with gaps${ed.skippedGenerated ? `, ${ed.skippedGenerated} generated skipped` : ''}`);

  // The user's own questions, verbatim: a policy gap is a decision only they can make; the prototype builds the provisional answer meanwhile.
  const policy = (rows || []).filter(g => g.status === 'open' && g.kind === 'policy');
  if (policy.length) {
    console.log(`  your questions (${policy.length} open policy gap(s); the prototype builds the provisional answer until you decide):`);
    for (const g of policy) console.log(`    ${g.id}: ${g.gap || '(no text)'} — provisional: ${g['draft assumption'] || '(none)'}`);
  }
  const pendingTags = pendingTagCount(p);
  if (pendingTags) console.log(`  pending:  ${pendingTags} [PENDING-<ROLE>] tag(s) in DECISION_LOG.md (superseded rows not counted) — \`sdd.cjs agenda\` lists them with the open policy gaps`);
  const otherOpen = (rows || []).filter(g => g.status === 'open' && g.kind !== 'policy').length;
  if (otherOpen) console.log(`  agent questions: ${otherOpen} open technical/builder/ui/oracle gap(s) — resolved by the swarm via the profile, no user time`);

  // Path to a full spec: the stages left before the freeze, in plain words, with the next action that is the user's.
  const next = nextStage(state, info);
  const SPEC_PATH = specPath(info);
  const idx = next ? SPEC_PATH.findIndex(([s]) => s === next) : -1;
  if (idx >= 0) {
    console.log('  path to a full (frozen) spec:');
    SPEC_PATH.slice(idx).forEach(([s, what], i) => console.log(`    ${i === 0 ? '→' : ' '} ${s}: ${what}`));
    console.log('      then 05 build (agent only) → ' + (info.ui ? '06 visual acceptance → ' : '') + '07 certification report');
    console.log(`  next action (yours): ${SPEC_PATH[idx][2]}`);
  } else if (next) console.log(`  spec frozen; next stage ${next} (${next === '05' ? 'build, agent only' : next === '06' ? 'visual acceptance' : 'certification'})`);

  // Every gate of every spec stage, freshness ignored: the question is "what is still missing", not "what was done this stage".
  const stages = ['01', '02', '03', '04'];
  console.log('  gates (all spec stages, freshness ignored):');
  for (const s of stages) {
    const gates = exitGates(s, p, { ...state, timestamp: null }, info, { report: true });
    const failing = gates.filter(([ok]) => !ok);
    console.log(`    ${failing.length ? '✗' : '✓'} ${s} ${gates.length - failing.length}/${gates.length}`);
    for (const [, label] of failing) console.log(`        ✗ ${label}`);
  }
  return 0;
}

// ========== agenda, metrics, spec-outline, upgrade ==========

/** The questions only people outside the agent can answer: open policy gaps, and every decision tagged [PENDING-<ROLE>] that no later row supersedes. */
function agendaData(p) {
  const gaps = (readGaps(p).rows || []).filter(g => g.status === 'open' && g.kind === 'policy');
  const byRole = new Map();
  for (const e of pendingDecisions(p)) {
    for (const role of e.roles) {
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role).push({ id: e.id, title: e.title });
    }
  }
  return { gaps, byRole };
}

function cmdAgenda(p, args) {
  const { gaps, byRole } = agendaData(p);
  const L_ = [];
  L_.push('# Agenda — questions for people outside the pipeline');
  L_.push('');
  L_.push(`Derived by \`sdd.cjs agenda\` on ${new Date().toISOString().slice(0, 10)} from ${GAPS_FILE} (open policy rows) and specs/DECISION_LOG.md (\`[PENDING-<ROLE>]\` tags). Regenerate, do not edit; an answer becomes a DECISION_LOG entry (a new row whose text says \`supersedes DECnnn\`, naming the pending row) and a spec edit, which removes the item from the next run.`);
  L_.push('');
  L_.push(`## Open policy questions for the product owner (${gaps.length})`);
  L_.push('');
  if (gaps.length) {
    L_.push('| Gap | Question | Provisional answer (what the prototype does) |');
    L_.push('|---|---|---|');
    for (const g of gaps) L_.push(`| ${g.id} | ${g.gap} | ${g['draft assumption'] || ''} |`);
  } else L_.push('none');
  for (const [role, rows] of [...byRole.entries()].sort()) {
    L_.push('');
    L_.push(`## Working assumptions pending ${role} (${rows.length})`);
    L_.push('');
    L_.push('| Decision | Working assumption (tagged row) |');
    L_.push('|---|---|');
    for (const r of rows) L_.push(`| ${r.id} | ${r.title.replace(/\|/g, '\\|')} |`);
  }
  if (!byRole.size) { L_.push(''); L_.push('No decision carries a `[PENDING-<ROLE>]` tag that a later row has not superseded.'); }
  const text = L_.join('\n') + '\n';
  if (args.flags.write) {
    const f = path.join(p.logs, 'agenda.md');
    fs.mkdirSync(p.logs, { recursive: true });
    fs.writeFileSync(f, text);
    console.log(`Wrote ${L.rel(p.root, f)}: ${gaps.length} open policy gap(s), ${[...byRole.values()].reduce((a, b) => a + b.length, 0)} pending decision(s) across ${byRole.size} role(s)`);
  } else process.stdout.write(text);
  return 0;
}

/** One row per transition with its recorded metrics: where the time went, comparable across slices and projects. */
function cmdMetrics(p) {
  const ts = readTransitions(p);
  if (!ts.length) { console.log('No transitions yet (specs/logs/transitions.jsonl).'); return 0; }
  const cols = ['interviewQuestions', 'prototypeVersions', 'swarmRounds', 'gapsOpen', 'gapsDeferred', 'rulings', 'declaredOutcomes', 'cases', 'probes'];
  const short = { interviewQuestions: 'quest', prototypeVersions: 'vers', swarmRounds: 'rounds', gapsOpen: 'open', gapsDeferred: 'defer', rulings: 'rulings', declaredOutcomes: 'outcomes', cases: 'cases', probes: 'probes' };
  const rows = ts.map(t => [String(t.ts || '').slice(0, 10), String(t.completed || '').slice(0, 24), t.approvedBy ? 'yes' : '', ...cols.map(c => (t.metrics && t.metrics[c] !== undefined ? String(t.metrics[c]) : '·'))]);
  const head = ['date', 'stage completed', 'accepted', ...cols.map(c => short[c])];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const fmt = r => r.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(fmt(head));
  console.log(widths.map(w => '-'.repeat(w)).join('  '));
  rows.forEach(r => console.log(fmt(r)));
  console.log('\nquest = interview questions · vers = prototype versions · rounds = Red Team rounds this iteration · open/defer = GAPS.md rows · outcomes = declared operation outcomes · cases/probes = oracle cases');
  return 0;
}

/** Section sizes of SPEC.md and its modules, to plan a split into specs/spec/<module>.md (check warns above the limit per file). */
function cmdSpecOutline(p) {
  const files = L.specFiles(p.root);
  if (!files.length) { console.log('No specs/SPEC.md yet.'); return 0; }
  let total = 0;
  for (const f of files) {
    const text = readText(path.join(p.root, f));
    const kb = Buffer.byteLength(text) / 1024;
    total += kb;
    console.log(`${f} — ${kb.toFixed(0)} KB${kb > SPEC_SIZE_WARN_KB ? `  ⚠ over ${SPEC_SIZE_WARN_KB} KB: split` : ''}`);
    const lines = text.split(/\r?\n/);
    const heads = [];
    lines.forEach((l, i) => { const m = l.match(/^(##|###) (.+)$/); if (m) heads.push([i, m[1].length, m[2]]); });
    heads.forEach(([i, lvl, title], k) => {
      let end = lines.length;
      for (let j = k + 1; j < heads.length; j++) if (heads[j][1] <= lvl) { end = heads[j][0]; break; }
      const size = Buffer.byteLength(lines.slice(i, end).join('\n')) / 1024;
      if (size >= 1 || lvl === 2) console.log(`  ${lvl === 2 ? '' : '  '}${title.slice(0, 70).padEnd(lvl === 2 ? 72 : 70)} ${size.toFixed(0).padStart(5)} KB ${'█'.repeat(Math.min(40, Math.round(size / 4)))}`);
    });
  }
  console.log(`\nTotal ${total.toFixed(0)} KB across ${files.length} file(s). Rule of thumb: one module per surface or area (its §4 entities, §5 operations, §7 errors, §14 screens together), SPEC.md as the index; keep every file under ${SPEC_SIZE_WARN_KB} KB so an agent reads it whole.`);
  return 0;
}

// Older pipelines numbered the stages differently; the state keeps its meaning, not its number (03p = the accepted prototype = Stage 02 complete).
const LEGACY_STATES = {
  '03p_prototype': ['02', 'the accepted prototype (03p in the older pipeline) is Stage 02 complete; hardening (03) is next'],
  '02_adversarial_swarm_analysis': ['01', 'contracts were written before a prototype ran (older pipeline): the brief is done, the prototype (02) is next; Stage 03 re-hardens against it'],
  '03_interactive_wireframing': ['01', 'wireframes were approved before a prototype ran (older pipeline): the prototype (02) is next and supersedes them; Stage 03 captures wireframes from it'],
};
const LEGACY_LOGS = [['specs/logs/03p-prototype.md', PROTOTYPE_FILE], ['specs/logs/02-swarm.md', SWARM_FILE], ['specs/logs/02-rulings.md', RULINGS_FILE], ['specs/logs/03p-decisions.md', DECISIONS_FILE]];

function templateVersion(dir) {
  const m = readText(path.join(dir, 'WORKSPACE_ROUTING.md')).match(/<!--\s*version:\s*(.+?)\s*-->/);
  return m ? m[1] : 'unknown';
}

/** Replace specs/.sdd with the template's copy: state file kept, legacy logs renamed, entry files regenerated, upgrade log written. */
function cmdUpgrade(p, args) {
  const from = typeof args.flags.from === 'string' ? path.resolve(args.flags.from) : null;
  if (!from) fail('upgrade requires --from <template-root> (the folder holding specs/.sdd of the new template)');
  const srcSdd = exists(path.join(from, 'specs/.sdd/WORKSPACE_ROUTING.md')) ? path.join(from, 'specs/.sdd') : (exists(path.join(from, 'WORKSPACE_ROUTING.md')) ? from : null);
  if (!srcSdd) fail(`${from}: no specs/.sdd/WORKSPACE_ROUTING.md (point --from at the template's root)`);
  const dstSdd = path.join(p.root, 'specs/.sdd');
  const oldVersion = exists(dstSdd) ? templateVersion(dstSdd) : 'none';
  const newVersion = templateVersion(srcSdd);
  const state = exists(p.state) ? readText(p.state) : null;
  const oldEntry = exists(p.entrypoint) ? readText(p.entrypoint) : null;
  const oldFiles = exists(dstSdd) ? Object.fromEntries(L.listFiles(dstSdd).map(f => [path.relative(dstSdd, f), L.hashFile(f)])) : {};
  // replace the pipeline files
  if (exists(dstSdd)) fs.rmSync(dstSdd, { recursive: true, force: true });
  fs.cpSync(srcSdd, dstSdd, { recursive: true, filter: s => !/sdd-state\.json$|__pycache__|\.DS_Store$/.test(s) });
  fs.mkdirSync(path.dirname(p.state), { recursive: true });
  if (state !== null) fs.writeFileSync(p.state, state);
  // legacy stage names → today's numbering (the only time the tool rewrites the state outside a transition)
  let mapped = null;
  if (state !== null) {
    try {
      const s = JSON.parse(state);
      const m = LEGACY_STATES[s.stepName];
      if (m) {
        const [target, why] = m;
        mapped = `${s.stepName} (lastCompletedStep=${s.lastCompletedStep}) → ${L.STAGES[target].name} (${L.STAGES[target].num}): ${why}`;
        L.writeJson(p.state, { ...s, lastCompletedStep: L.STAGES[target].num, stepName: L.STAGES[target].name, notes: `${s.notes ? s.notes + '; ' : ''}upgrade ${newVersion}: mapped legacy stage ${s.stepName} → ${L.STAGES[target].name}` });
      }
    } catch { /* unreadable state: left as is */ }
  }
  const newFiles = Object.fromEntries(L.listFiles(dstSdd).map(f => [path.relative(dstSdd, f), L.hashFile(f)]));
  const added = Object.keys(newFiles).filter(f => !(f in oldFiles));
  const removed = Object.keys(oldFiles).filter(f => !(f in newFiles) && !/sdd-state\.json$/.test(f));
  const changed = Object.keys(newFiles).filter(f => f in oldFiles && oldFiles[f] !== newFiles[f]);
  // legacy log names
  const renamed = [];
  for (const [oldRel, newRel] of LEGACY_LOGS) {
    const o = path.join(p.root, oldRel), n = path.join(p.root, newRel);
    if (exists(o) && !exists(n)) { fs.renameSync(o, n); renamed.push(`${oldRel} → ${newRel}`); }
  }
  // entry files: regenerated when they still equal the old entrypoint (or are missing); a customized one is left alone
  const newEntry = readText(p.entrypoint);
  const entries = [];
  for (const f of ['CLAUDE.md', 'AGENTS.md', '.cursorrules']) {
    const fp = path.join(p.root, f);
    const cur = exists(fp) ? readText(fp) : null;
    if (cur === null || cur === oldEntry || cur === newEntry) { fs.writeFileSync(fp, newEntry); entries.push(`${f}: regenerated`); }
    else entries.push(`${f}: left as is (customized; append the new entrypoint by hand — specs/.sdd/_config/entrypoint.md)`);
  }
  // upgrade log
  const tag = newVersion.replace(/[^0-9A-Za-z.-]+/g, '-');
  let logFile = path.join(p.logs, `upgrade-${tag}.md`);
  fs.mkdirSync(p.logs, { recursive: true });
  for (let n = 2; exists(logFile); n++) logFile = path.join(p.logs, `upgrade-${tag}-${n}.md`); // an earlier, filled-in log is never overwritten
  // The pipeline is one entry of the lock: after an upgrade the lock differs by that pin alone (unless spec files moved too).
  const lockV = exists(p.lock) ? L.verifyLock(p.root) : null;
  const lockNote = !lockV
    ? 'No lock exists yet; the first freeze (end of Stage 04) pins this pipeline version.'
    : lockV.valid
      ? `The lock v${lockV.lock.lockVersion} still matches (same pipeline files).`
      : `The lock v${lockV.lock.lockVersion} now differs ${specFileCounts(lockV) ? `by the pipeline pin (${L.pipelineLine(lockV)}) and by spec files (${specFileCounts(lockV)})` : `only by the pipeline pin: ${L.pipelineLine(lockV)}`}. Re-freeze with the user's approval: \`sdd.cjs freeze --reason "upgrade: ${newVersion}" --approved-by "<user>"\` (every gate from Stage 04 on refuses until then).`;
  const cp = require('child_process');
  const run = cmd => { const r = cp.spawnSync(process.execPath, [__filename, cmd, '--root', p.root], { encoding: 'utf8' }); return (r.stdout + r.stderr).trim(); };
  const body = `# Upgrade to pipeline ${newVersion} (${new Date().toISOString().slice(0, 10)})

Resume with: "Read ${L.rel(p.root, logFile)}, run \`node specs/.sdd/scripts/sdd.cjs status\` and \`readiness\`, continue from Next actions."

## What changed in this workspace
- \`specs/.sdd/\` → template \`${newVersion}\` (was \`${oldVersion}\`): ${added.length} file(s) added, ${changed.length} changed, ${removed.length} removed. State file ${mapped ? `mapped: ${mapped}` : `untouched${state === null ? ' (none existed)' : ''}`}.
- Logs renamed: ${renamed.length ? renamed.join('; ') : 'none needed'}.
- Entry files: ${entries.join('; ')}.
- Written by \`sdd.cjs upgrade --from ${from}\`. ${lockNote}

### Files added
${added.map(f => `- ${f}`).join('\n') || '- none'}

### Files removed
${removed.map(f => `- ${f}`).join('\n') || '- none'}

## What the tooling says (right after the upgrade)

\`\`\`
${run('status')}
\`\`\`

\`\`\`
${run('readiness')}
\`\`\`

## Where the project really is
_(agent: one paragraph per slice — what is built, accepted, hardened, frozen; what the gates above mean here)_

## Next actions
_(agent: numbered, each the user's or the agent's; the first is usually "read the new stage contracts the status points to")_

## Standing constraints
No \`transition\` or \`freeze\` without the user's explicit word; never hand-edit \`sdd-state.json\`; frozen files change only through the pipeline's own stages or a user-approved SCR; only the oracle grades.
`;
  fs.writeFileSync(logFile, body);
  console.log(`Upgraded specs/.sdd: ${oldVersion} → ${newVersion} (${added.length} added, ${changed.length} changed, ${removed.length} removed)`);
  if (lockV && !lockV.valid) console.log(`  lock: ${lockNote}`);
  if (mapped) console.log(`  state mapped: ${mapped}`);
  renamed.forEach(x => console.log(`  renamed ${x}`));
  entries.forEach(x => console.log(`  ${x}`));
  console.log(`Wrote ${L.rel(p.root, logFile)} — fill in "Where the project really is" and "Next actions", then show it to the user.`);
  return 0;
}

// ========== dashboard ==========

const DASHBOARD_FILE = 'dashboard.html';
const STAGE_LABELS = { '01': 'Brainstorm', '01b': 'Adopt', '02': 'Prototype', '03': 'Hardening', '04': 'Oracle + freeze', '05': 'Build', '06': 'Visual acceptance', '07': 'Certification' };

/** Everything the dashboard shows, from the same functions status/readiness/agenda/metrics print. Never a score. */
function dashboardData(p) {
  const state = readState(p);
  const info = projectInfo(p, state);
  const last = typeof state.lastCompletedStep === 'number' ? state.lastCompletedStep : 0;
  const next = nextStage(state, info);
  const v = exists(p.lock) ? L.verifyLock(p.root) : null;
  const { r, ctx } = runCheck(p, { contractsOnly: false });
  const { rows, errors: gapErrors } = readGaps(p);
  const transitions = readTransitions(p);
  const b = budgets(info);
  const q = interviewRows(p);
  const versions = prototypeVersions(p);
  const rounds = swarmRounds(p);
  const adopted = state.stepName === STAGES_01B || transitions.some(t => t.completed === STAGES_01B);
  const stages = ['01', '02', '03', '04', '05', ...(info.ui ? ['06'] : []), '07'].map(s => {
    const id = s === '01' && adopted ? '01b' : s;
    const done = s === '05' && !info.ui ? last >= 6 : last >= L.STAGES[s].num;
    return { id, name: L.STAGES[id].name, label: STAGE_LABELS[id], done, next: next === s };
  });
  const open = (rows || []).filter(g => g.status === 'open');
  const by = k => open.filter(g => g.kind === k).length;
  const agenda = agendaData(p);
  const pendingTags = pendingTagCount(p);
  const drift = decisionDrift(p);
  const run = latestReport(p, 'run-', () => true);
  const diff = latestReport(p, 'diff-', () => true);
  const ed = latestReport(p, 'expectdiff-', () => true);
  const sp = specPath(info);
  const idx = next ? sp.findIndex(([s]) => s === next) : -1;
  let slice = null;
  if (ctx.manifest) {
    const rolling = ctx.manifest.prototypeCadence === 'rolling';
    const so = rolling ? sliceLedger(p, ctx) : sliceOutcomes(p, ctx);
    // Under a rolling cadence `slices` lists every prototype accepted since the last lock with the outcomes it introduced (the cap reads per entry).
    slice = { declared: so.slice, total: so.total, cap: ctx.manifest.sliceCap || DEFAULT_SLICE_CAP, operations: ctx.ops.length + ctx.commands.length, cadence: rolling ? 'rolling' : 'slice', slices: rolling ? so.slices : null };
  }
  const m = info.manifest || {};
  return {
    generatedAt: new Date().toISOString(),
    tool: L.TOOL_VERSION,
    pipeline: templateVersion(p.sdd),
    project: { title: (readText(p.spec).match(/^#\s+(.+?)\s*$/m) || [])[1] || path.basename(p.root), root: p.root, type: info.projectType || 'unset', ui: info.ui, interfaces: info.interfaces || [] },
    state: { lastCompletedStep: last, stepName: state.stepName || '', notes: state.notes || '', timestamp: state.timestamp || null, stage00: state.stepName === STAGES_00 },
    settings: {
      prototypeCadence: m.prototypeCadence || (info.manifest ? 'slice (default)' : 'not declared yet (the user chooses at each acceptance; Stage 03 writes it into manifest.json)'),
      equivalenceCadence: m.equivalenceCadence || (info.manifest ? 'slice (default)' : '—'),
      equivalenceTarget: m.equivalenceTarget ? `L${m.equivalenceTarget}` : (info.manifest ? '—' : 'L2 (default)'),
      sliceCap: m.sliceCap || DEFAULT_SLICE_CAP,
      budgets: b,
    },
    stages,
    next: next ? { id: next, name: L.STAGES[next].name, label: STAGE_LABELS[next], rollingHint: next === '03' && (m.prototypeCadence === 'rolling' || !info.manifest) } : null,
    path: idx >= 0 ? { stages: sp.slice(idx).map(([s, what]) => ({ id: s, what })), yours: sp[idx][2], after: `05 build (agent only) → ${info.ui ? '06 visual acceptance → ' : ''}07 certification report` } : null,
    gates: next ? exitGates(next, p, state, info).map(([ok, label]) => ({ ok, label })) : [],
    specGates: ['01', '02', '03', '04'].map(s => { const g = exitGates(s, p, { ...state, timestamp: null }, info, { report: true }); return { id: s, label: STAGE_LABELS[s], passed: g.filter(([ok]) => ok).length, total: g.length, failing: g.filter(([ok]) => !ok).map(([, l]) => l) }; }),
    budgets: { interview: { used: q ? q.length : 0, budget: b.interviewQuestions }, prototype: { used: versions ? versions.length : 0, budget: b.prototypeVersions }, redTeam: { used: rounds, budget: b.swarmRounds } },
    gaps: rows === null ? null : { open: open.length, policy: by('policy'), technical: by('technical'), builder: by('builder'), ui: by('ui'), oracle: by('oracle'), closed: rows.filter(g => g.status === 'resolved' || g.status === 'confirmed').length, deferred: rows.filter(g => g.status === 'deferred').length, malformed: gapErrors.length, questions: agenda.gaps.map(g => ({ id: g.id, question: g.gap || '', provisional: g['draft assumption'] || '' })) },
    pending: { tags: pendingTags, byRole: [...agenda.byRole.entries()].sort().map(([role, items]) => ({ role, items })) },
    decisions: { count: Object.keys(decisionRows(p)).length, drift: drift && (drift.changed.length || drift.removed.length) ? { since: drift.ts, changed: drift.changed, removed: drift.removed } : null },
    check: { errors: r.errors.length, warnings: r.warnings.length, firstErrors: r.errors.slice(0, 8), coverage: r.notes.find(n => n.startsWith('coverage:')) || null },
    oracle: { run: run ? { passed: run.passed, total: run.total, target: run.target, at: run.finishedAt, stale: !(v && run.lockHash === v.lock.hash), filtered: !!run.filtered } : null, diff: diff ? { a: diff.a, b: diff.b, divergent: diff.divergentCases, at: diff.finishedAt } : null, expectDiff: ed ? { label: ed.label, compared: ed.totalCases, divergent: ed.divergentCases, at: ed.finishedAt } : null },
    lock: v ? { version: v.lock.lockVersion, hash: v.lock.hash, intact: v.valid, modified: v.modified, added: v.added, removed: v.removed, pipeline: { version: v.pipeline.legacy ? null : v.lock.pipeline.version, changed: v.pipeline.changed, from: v.pipeline.from, to: v.pipeline.to, line: L.pipelineLine(v) }, frozenAt: v.lock.frozenAt || v.lock.createdAt || null } : null,
    slice,
    versions: versions || [],
    transitions: transitions.map(t => ({ ts: t.ts, completed: t.completed, resume: t.resume || null, approvedBy: t.approvedBy || null, release: !!t.release, note: t.note || '', metrics: t.metrics || {} })),
  };
}

function renderDashboard(d) {
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Tool output and spec rows carry a little markdown (`code`, **bold**); render those two, nothing else.
  const md = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const when = s => (s ? esc(String(s).replace('T', ' ').slice(0, 16)) : '—');
  const n = x => (typeof x === 'number' ? x.toLocaleString('en-US') : esc(x));
  // Slice sizes: one count for the default cadence; under rolling, one per prototype accepted since the last lock.
  const sliceText = sl => {
    if (sl.declared === null) return 'this slice: unknown new (lock predates outcome recording)';
    if (sl.cadence !== 'rolling') return `this slice: ${n(sl.declared)} new`;
    if (!sl.slices || !sl.slices.length) return `${n(sl.declared)} new, counted as one slice (no accepted prototype recorded its outcomes since the last lock)`;
    return `per accepted slice since the last lock: ${sl.slices.map(x => `#${x.n} ${n(x.size)}${x.hardening ? ` (+${n(x.hardening)} in hardening)` : ''}`).join(' · ')} new`;
  };
  const details = (summary, body, openIt) => `<details${openIt ? ' open' : ''}><summary>${summary}</summary><div class="dbody">${body}</div></details>`;
  const pill = (kind, text) => `<span class="pill ${kind}">${{ ok: '✓', warn: '!', bad: '✗', neutral: '·' }[kind]} ${esc(text)}</span>`;
  // A long message folds: its first clause stays on the line; a comma list of paths becomes columns.
  const fold = label => {
    const cut = label.indexOf(': ');
    if (label.length <= 140 || cut <= 0 || cut > 120) return md(label);
    const rest = label.slice(cut + 2);
    const items = rest.split(/,\s+/);
    const body = items.length > 4 ? `<ul class="cols mono">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p class="small">${md(rest)}</p>`;
    return md(label.slice(0, cut)) + details(items.length > 4 ? `${items.length} items` : 'detail', body);
  };
  const gate = g => `<li class="${g.ok ? 'ok' : 'bad'}"><span class="mark">${g.ok ? '✓' : '✗'}</span><div>${fold(g.label)}</div></li>`;
  const meter = (used, limit, kind) => `<div class="track" role="img" aria-label="${used} of ${limit}"><div class="fill ${kind || ''}" style="width:${Math.min(100, Math.round((used / Math.max(1, limit)) * 100))}%"></div></div>`;
  const budget = (label, used, limit) => `<div class="budget"><div class="row"><span>${esc(label)}</span><span class="num">${used}<span class="muted">/${limit}</span>${used > limit ? ` ${pill('warn', 'over budget')}` : ''}</span></div>${meter(used, limit, used > limit ? 'warn' : '')}</div>`;
  const table = (cols, rows, opts = {}) => {
    const foldAbove = opts.foldAbove === undefined ? 8 : opts.foldAbove;
    if (!rows.length) return '<p class="muted">none</p>';
    const widths = opts.widths || cols.map(() => `${Math.floor(100 / cols.length)}%`);
    const html = `<table><colgroup>${widths.map(w => `<col style="width:${w}">`).join('')}</colgroup><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return rows.length > foldAbove ? details(`${rows.length} rows`, html) : html;
  };
  const tile = (label, value, sub, kind) => `<div class="tile t-${kind || 'neutral'}"><div class="tlabel">${esc(label)}</div><div class="tvalue">${value}</div>${sub ? `<div class="tsub">${sub}</div>` : ''}</div>`;

  const s = d.settings;
  const failing = d.gates.filter(g => !g.ok).length;
  const strip = d.stages.map(st => `<div class="stage ${st.done ? 'done' : st.next ? 'next' : 'todo'}"><div class="num">${esc(st.id)}</div><div class="lbl">${esc(st.label)}</div><div class="st">${st.done ? 'done' : st.next ? 'next' : 'later'}</div></div>`).join('<div class="arrow">→</div>');
  const now = d.next
    ? `<div class="callout"><div><b>Next stage: ${esc(d.next.id)} ${esc(d.next.label)}</b> <span class="muted">· specs/.sdd/${esc(d.next.name)}/CONTEXT.md</span>${d.next.rollingHint ? `<div class="small muted">or another slice's brief first (<code>transition --completed 01</code>): the cadence is the user's call</div>` : ''}</div>${d.path ? `<div><b>Next action (yours):</b> ${md(d.path.yours)}</div>` : ''}</div>`
    : '<div class="callout">Pipeline complete. Next change: Class 0 (non-observable) → 05; Class 1 (observable) → 01; Class 2 (defect) → 00.</div>';
  const pathList = d.path ? `<ol class="path">${d.path.stages.map(p => `<li><b>${esc(p.id)}</b> ${esc(p.what)}</li>`).join('')}</ol><p class="note" style="margin-top:2px">then ${esc(d.path.after)}</p>` : '';

  const tiles = [
    d.next ? tile(`Gates for ${d.next.id}`, `${d.gates.length - failing}<span class="muted">/${d.gates.length}</span>`, failing ? pill('bad', `${failing} failing`) : pill('ok', 'all pass'), failing ? 'bad' : 'ok') : tile('Gates', '—', pill('ok', 'pipeline complete'), 'ok'),
    d.gaps ? tile('Open gaps', `${d.gaps.open}`, d.gaps.policy ? pill('warn', `${d.gaps.policy} need you`) : pill('ok', 'none need you'), d.gaps.policy ? 'warn' : 'ok') : tile('Open gaps', '—', '<span class="muted">no GAPS.md yet</span>'),
    tile('Pending decisions', `${d.pending.tags}`, d.pending.byRole.length ? `<span class="muted">${esc(d.pending.byRole.map(r => `${r.items.length} ${r.role}`).join(', '))}</span>` : '<span class="muted">no [PENDING-ROLE] tags</span>', d.pending.tags ? 'warn' : 'ok'),
    d.oracle.run ? tile('Oracle', `${n(d.oracle.run.passed)}<span class="muted">/${n(d.oracle.run.total)}</span>`, d.oracle.run.stale ? pill('warn', 'stale lock') : pill(d.oracle.run.passed === d.oracle.run.total ? 'ok' : 'bad', d.oracle.run.passed === d.oracle.run.total ? 'green' : `${d.oracle.run.total - d.oracle.run.passed} failing`), d.oracle.run.stale ? 'warn' : d.oracle.run.passed === d.oracle.run.total ? 'ok' : 'bad') : tile('Oracle', '—', '<span class="muted">no run yet</span>'),
    d.lock ? tile('Lock', `v${esc(d.lock.version)}`, d.lock.intact ? pill('ok', 'intact') : pill('bad', lockTileText(d.lock)), d.lock.intact ? 'ok' : 'bad') : tile('Lock', '—', '<span class="muted">not frozen yet</span>'),
    tile('Check', `${d.check.errors}<span class="muted"> err</span>`, d.check.warnings ? pill('warn', `${d.check.warnings} warnings`) : pill('ok', 'no warnings'), d.check.errors ? 'bad' : d.check.warnings ? 'warn' : 'ok'),
  ].join('');

  const specGates = d.specGates.map(g => `<li class="${g.failing.length ? 'bad' : 'ok'}"><span class="mark">${g.failing.length ? '✗' : '✓'}</span><div class="sg"><div class="row"><span>${esc(g.id)} ${esc(g.label)}</span><span class="num">${g.passed}<span class="muted">/${g.total}</span></span></div>${meter(g.passed, g.total, g.failing.length ? 'bad' : 'ok')}${g.failing.length ? details(`${g.failing.length} missing`, `<ul class="gates small">${g.failing.map(f => `<li class="bad"><span class="mark">✗</span><div>${fold(f)}</div></li>`).join('')}</ul>`) : ''}</div></li>`).join('');

  let gapsBlock = '<p class="muted">no specs/GAPS.md yet (Stage 01 opens it)</p>';
  if (d.gaps) {
    const segs = [['Open, need you', d.gaps.policy, 'warn'], ['Open, agent', d.gaps.open - d.gaps.policy, 'accent'], ['Deferred', d.gaps.deferred, 'neutral'], ['Closed', d.gaps.closed, 'ok']];
    const total = segs.reduce((a, x) => a + x[1], 0) || 1;
    gapsBlock = `<div class="stack">${segs.filter(x => x[1]).map(x => `<div class="seg ${x[2]}" style="width:${(x[1] / total) * 100}%" title="${esc(x[0])}: ${x[1]}"></div>`).join('')}</div><div class="legend">${segs.map(x => `<span><i class="sw ${x[2]}"></i>${esc(x[0])} <b>${x[1]}</b></span>`).join('')}${d.gaps.malformed ? `<span class="bad">${d.gaps.malformed} malformed row(s)</span>` : ''}</div>`
      + (d.gaps.questions.length ? `<h3>Your questions (${d.gaps.questions.length}) <span class="muted">— the prototype builds the provisional answer until you decide</span></h3>${table(['Gap', 'Question', 'Provisional answer (what the prototype does)'], d.gaps.questions.map(g => [`<code>${esc(g.id)}</code>`, md(g.question), md(g.provisional)]), { widths: ['9%', '31%', '60%'] })}` : '');
  }
  const pendingBlock = d.pending.byRole.map(r => `<h3>Working assumptions pending ${esc(r.role)} (${r.items.length})</h3>${table(['Decision', 'Working assumption'], r.items.map(i => [`<code>${esc(i.id)}</code>`, md(i.title)]), { widths: ['12%', '88%'] })}`).join('');

  const lockRow = !d.lock ? '<span class="muted">none yet — the frozen set is not locked; a defect found now is a gap row in the current stage, not a Stage 00 change</span>'
    : d.lock.intact ? `${pill('ok', `v${d.lock.version} intact`)} <code>${esc(String(d.lock.hash).slice(0, 12))}</code>${d.lock.frozenAt ? ` <span class="muted">frozen ${when(d.lock.frozenAt)}</span>` : ''}`
      : `${pill('bad', `v${d.lock.version} modified`)} ${d.lock.pipeline.changed ? `<b>${esc(d.lock.pipeline.line)}</b>${lockFileCount(d.lock) ? '; ' : ''}` : ''}${lockFileCount(d.lock) ? `spec files: ${d.lock.modified.length} changed, ${d.lock.added.length} added, ${d.lock.removed.length} removed` : ''} — ${d.lock.pipeline.changed && !lockFileCount(d.lock) ? `re-frozen with the user's approval: <code>sdd.cjs freeze --reason "upgrade: ${esc(d.lock.pipeline.to)}"</code>` : 're-frozen only with the user\'s approval at the next Stage 04 or through an SCR'}${lockFileCount(d.lock) ? details('files', `<ul class="cols mono">${[...d.lock.modified.map(f => `~ ${f}`), ...d.lock.added.map(f => `+ ${f}`), ...d.lock.removed.map(f => `− ${f}`)].map(f => `<li>${esc(f)}</li>`).join('')}</ul>`) : ''}`;
  const checkRow = `${pill(d.check.errors ? 'bad' : 'ok', `${d.check.errors} error(s)`)} ${pill(d.check.warnings ? 'warn' : 'neutral', `${d.check.warnings} warning(s)`)}${d.check.coverage ? `<div class="small muted">${esc(d.check.coverage)}</div>` : ''}${d.check.firstErrors.length ? details('first errors', `<ul class="gates small">${d.check.firstErrors.map(e => `<li class="bad"><span class="mark">✗</span><div>${md(e)}</div></li>`).join('')}</ul>`) : ''}`;
  const oracleRow = d.oracle.run ? `${pill(d.oracle.run.passed === d.oracle.run.total ? 'ok' : 'bad', `${d.oracle.run.passed}/${d.oracle.run.total} passed`)} on "${esc(d.oracle.run.target)}" at ${when(d.oracle.run.at)}${d.oracle.run.stale ? ` ${pill('warn', 'stale: different lock')}` : ''}${d.oracle.run.filtered ? ' <span class="muted">(filtered)</span>' : ''}` : '<span class="muted">no run yet — Stage 04 derives the cases, Stage 05 runs them</span>';
  const evidence = `<dl class="kv"><dt>Lock</dt><dd>${lockRow}</dd><dt>Check</dt><dd>${checkRow}</dd><dt>Oracle</dt><dd>${oracleRow}</dd>${d.oracle.diff ? `<dt>Diff</dt><dd>${esc(d.oracle.diff.a)} vs ${esc(d.oracle.diff.b)}: ${pill(d.oracle.diff.divergent ? 'bad' : 'ok', `${d.oracle.diff.divergent} divergent`)} at ${when(d.oracle.diff.at)}</dd>` : ''}${d.oracle.expectDiff ? `<dt>Diff-expect</dt><dd>"${esc(d.oracle.expectDiff.label)}": ${d.oracle.expectDiff.compared} compared, ${d.oracle.expectDiff.divergent} with gaps at ${when(d.oracle.expectDiff.at)}</dd>` : ''}<dt>Decisions</dt><dd>${d.decisions.count} row(s)${d.pending.tags ? `, ${d.pending.tags} pending tag(s)` : ''}${d.decisions.drift ? ` ${pill('bad', 'append-only violated')} rows rewritten or removed since ${when(d.decisions.drift.since)}: <code>${esc([...d.decisions.drift.changed, ...d.decisions.drift.removed.map(x => '-' + x)].join(', '))}</code>` : ''}</dd></dl>`;

  const vkeys = d.versions.length ? Object.keys(d.versions[0]) : [];
  const vwidths = vkeys.map(k => (k === 'version' ? '8%' : k === 'date' ? '11%' : /changed|what|summary|description/.test(k) ? null : '14%'));
  const flex = vwidths.filter(w => w === null).length;
  const fixed = vwidths.reduce((a, w) => a + (w ? parseInt(w, 10) : 0), 0);
  const versions = table(vkeys, d.versions.map(v => vkeys.map(k => md(v[k]))), { widths: vwidths.map(w => w || `${Math.max(20, Math.floor((100 - fixed) / Math.max(1, flex)))}%`) });

  const mcols = [['interviewQuestions', 'quest'], ['prototypeVersions', 'vers'], ['swarmRounds', 'rounds'], ['gapsOpen', 'open'], ['gapsDeferred', 'defer'], ['rulings', 'rulings'], ['declaredOutcomes', 'outcomes'], ['cases', 'cases'], ['probes', 'probes']];
  const history = table(['When', 'Completed', 'Accepted by', 'Note', ...mcols.map(([, h]) => h)],
    [...d.transitions].reverse().map(t => [when(t.ts), `<code>${esc(t.completed)}</code>${t.resume ? `<div class="small muted">→ ${esc(t.resume)}</div>` : ''}`, esc(t.approvedBy || (t.release ? 'release (L2)' : '')), md(t.note), ...mcols.map(([c]) => (t.metrics[c] === undefined ? '<span class="muted">·</span>' : `<span class="num">${n(t.metrics[c])}</span>`))]),
    { widths: ['8%', '13%', '8%', '17%', ...mcols.map(() => '6%')], foldAbove: 25 });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SDD dashboard — ${esc(d.project.title)}</title>
<style>
:root{color-scheme:light;--bg:#f3f3f0;--card:#fcfcfb;--text:#0b0b0b;--text2:#52514e;--muted:#7b7a75;--line:#e2e1dc;--line2:#edece8;--accent:#2a78d6;--accent-soft:#d8e5f7;--good:#0ca30c;--good-text:#006300;--good-soft:#dff3df;--warn:#fab219;--warn-text:#7a4f00;--warn-soft:#fdf0cc;--bad:#d03b3b;--bad-text:#a52b2b;--bad-soft:#f8dcdc;--neutral:#b9b8b2}
@media (prefers-color-scheme: dark){:root:where(:not([data-theme="light"])){color-scheme:dark;--bg:#121211;--card:#1a1a19;--text:#f0efec;--text2:#c3c2b7;--muted:#8f8e87;--line:#2e2e2b;--line2:#262624;--accent:#3987e5;--accent-soft:#1f3b5e;--good:#0ca30c;--good-text:#7ddc7d;--good-soft:#17331a;--warn:#fab219;--warn-text:#f2c35a;--warn-soft:#3d2f0f;--bad:#e66767;--bad-text:#f08c8c;--bad-soft:#3f1c1c;--neutral:#5c5b56}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#121211;--card:#1a1a19;--text:#f0efec;--text2:#c3c2b7;--muted:#8f8e87;--line:#2e2e2b;--line2:#262624;--accent:#3987e5;--accent-soft:#1f3b5e;--good:#0ca30c;--good-text:#7ddc7d;--good-soft:#17331a;--warn:#fab219;--warn-text:#f2c35a;--warn-soft:#3d2f0f;--bad:#e66767;--bad-text:#f08c8c;--bad-soft:#3f1c1c;--neutral:#5c5b56}
*{box-sizing:border-box;min-width:0}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}
.wrap{max-width:1200px;margin:0 auto;padding:24px 16px 48px}header{margin-bottom:16px}h1{font-size:1.45rem;margin:0 0 2px}.meta{color:var(--muted);font-size:.88rem}
h2{font-size:.78rem;margin:0 0 12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700}h3{font-size:.95rem;margin:18px 0 8px;font-weight:600}h3 .muted{font-weight:400}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86em;background:var(--line2);padding:0 4px;border-radius:4px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.82rem}.num{font-variant-numeric:tabular-nums;font-weight:600}.small{font-size:.86rem}.muted{color:var(--muted)}span.bad{color:var(--bad-text)}
.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:start}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 20px;grid-column:span 12}.c6{grid-column:span 6}@media (max-width:860px){.c6{grid-column:span 12}}
.strip{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 10px}.stage{flex:1 1 110px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;text-align:center;background:var(--bg)}.stage .num{font-family:ui-monospace,Menlo,monospace;font-size:.78rem;color:var(--muted);font-weight:500}.stage .lbl{font-weight:600;font-size:.95rem}.stage .st{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.stage.done{border-color:var(--good);background:var(--good-soft)}.stage.done .st{color:var(--good-text)}.stage.next{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);background:var(--card)}.stage.next .st{color:var(--accent)}.stage.todo{opacity:.65}.arrow{color:var(--muted);flex:0 0 auto}@media (max-width:600px){.arrow{display:none}}
.callout{display:grid;gap:6px;border-left:4px solid var(--accent);background:var(--accent-soft);padding:10px 14px;border-radius:0 8px 8px 0;margin:10px 0}.callout code{background:rgba(127,127,127,.15)}
ol.path{margin:8px 0 0;padding-left:20px;font-size:.9rem}ol.path li{margin:2px 0}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.tile{border:1px solid var(--line);border-radius:8px;padding:12px 14px;border-top:3px solid var(--neutral)}.tile.t-ok{border-top-color:var(--good)}.tile.t-warn{border-top-color:var(--warn)}.tile.t-bad{border-top-color:var(--bad)}.tlabel{font-size:.8rem;color:var(--muted)}.tvalue{font-size:1.6rem;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums;margin:2px 0 6px}.tsub{font-size:.82rem;color:var(--text2)}
.pill{display:inline-block;border-radius:999px;padding:0 9px;font-size:.78rem;font-weight:600;line-height:1.6;white-space:nowrap}.pill.ok{background:var(--good-soft);color:var(--good-text)}.pill.bad{background:var(--bad-soft);color:var(--bad-text)}.pill.warn{background:var(--warn-soft);color:var(--warn-text)}.pill.neutral{background:var(--line2);color:var(--muted)}
ul.gates{list-style:none;padding:0;margin:0}ul.gates li{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--line2);font-size:.92rem}ul.gates li:last-child{border:0}ul.gates li>div{flex:1}ul.gates li.ok .mark{color:var(--good-text)}ul.gates li.bad .mark{color:var(--bad-text)}.mark{flex:0 0 1.1em;font-weight:700}ul.gates.small li{font-size:.84rem;padding:3px 0}
.sg{flex:1}.sg .row{display:flex;justify-content:space-between;gap:8px}
.budget{margin:8px 0 12px}.row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:.92rem}.track{height:6px;background:var(--accent-soft);border-radius:3px;overflow:hidden;margin-top:5px}.fill{height:100%;background:var(--accent);border-radius:3px}.fill.warn{background:var(--warn)}.fill.bad{background:var(--bad)}.fill.ok{background:var(--good)}.sg .track{background:var(--line2)}
.stack{display:flex;gap:2px;height:14px;border-radius:4px;overflow:hidden;margin:4px 0 8px}.seg.warn{background:var(--warn)}.seg.accent{background:var(--accent)}.seg.neutral{background:var(--neutral)}.seg.ok{background:var(--good)}.legend{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:.88rem;color:var(--text2)}.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}.sw.warn{background:var(--warn)}.sw.accent{background:var(--accent)}.sw.neutral{background:var(--neutral)}.sw.ok{background:var(--good)}
table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.88rem}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line2);vertical-align:top}th{color:var(--muted);font-weight:600;font-size:.75rem;overflow-wrap:normal}td .num{font-weight:500}
dl.kv{display:grid;grid-template-columns:7.5rem minmax(0,1fr);gap:8px 14px;margin:0;font-size:.92rem}dl.kv dt{color:var(--muted)}dl.kv dd{margin:0}
details{margin-top:4px}summary{cursor:pointer;color:var(--accent);font-size:.86rem;font-weight:500;user-select:none}.dbody{margin-top:6px}ul.cols{list-style:none;margin:0;padding:0;columns:3 220px;column-gap:18px;font-size:.78rem;line-height:1.5}ul.cols li{break-inside:avoid}
.note{font-size:.82rem;color:var(--muted);margin:10px 0 0}
</style></head><body><div class="wrap">
<header><h1>${esc(d.project.title)}</h1><div class="meta">SDD dashboard · ${esc(d.project.type)}${d.project.ui ? ' · UI' : ''} · pipeline ${esc(d.pipeline)} · generated ${when(d.generatedAt)} · regenerate with <code>node specs/.sdd/scripts/sdd.cjs dashboard</code></div></header>
<div class="grid">
<section class="card"><h2>Pipeline</h2><div class="strip">${strip}</div>
<div class="meta">lastCompletedStep=${esc(d.state.lastCompletedStep)} (${esc(d.state.stepName || '—')})${d.state.timestamp ? ` at ${when(d.state.timestamp)}` : ''}${d.state.notes ? ` — ${esc(d.state.notes)}` : ''}</div>
${d.state.stage00 ? '<div class="callout">Stage 00 is in progress: a Spec Change Request is open and the pipeline resumes where the transition said.</div>' : ''}
${now}${pathList}
</section>
<section class="card"><h2>At a glance</h2><div class="tiles">${tiles}</div></section>
<section class="card c6"><h2>Exit gates for ${d.next ? esc(d.next.id) + ' ' + esc(d.next.label) : '—'}</h2>${d.gates.length ? `<ul class="gates">${d.gates.map(gate).join('')}</ul>` : '<p class="muted">none</p>'}
<h3>All spec stages <span class="muted">(freshness ignored: what is still missing, not what was done this stage)</span></h3><ul class="gates">${specGates}</ul></section>
<section class="card c6"><h2>Budgets</h2>${budget('Interview questions', d.budgets.interview.used, d.budgets.interview.budget)}${budget('Prototype versions', d.budgets.prototype.used, d.budgets.prototype.budget)}${budget('Red Team rounds, this iteration', d.budgets.redTeam.used, d.budgets.redTeam.budget)}
<p class="note">Counts the user can read: never a score, never a block.</p>
<h2 style="margin-top:20px">Settings</h2><dl class="kv"><dt>Cadence</dt><dd>prototype <b>${esc(s.prototypeCadence)}</b> · equivalence ${esc(s.equivalenceCadence)}</dd><dt>Equivalence</dt><dd>${esc(s.equivalenceTarget)}</dd><dt>Slice cap</dt><dd>${esc(s.sliceCap)} declared outcomes${d.slice && d.slice.cadence === 'rolling' ? ' per accepted slice' : ''}${d.slice ? `<div class="small muted">${sliceText(d.slice)} · ${n(d.slice.total)} in total across ${d.slice.operations} operation(s)</div>` : '<div class="small muted">no contracts yet (Stage 03)</div>'}</dd><dt>Budgets</dt><dd>${s.budgets.interviewQuestions} questions · ${s.budgets.prototypeVersions} versions · ${s.budgets.swarmRounds} rounds</dd><dt>Interfaces</dt><dd>${esc(d.project.interfaces.join(', ') || '—')}</dd></dl></section>
<section class="card"><h2>Gaps and questions</h2>${gapsBlock}${pendingBlock}</section>
<section class="card"><h2>Evidence</h2>${evidence}</section>
<section class="card"><h2>Prototype versions</h2>${versions}</section>
<section class="card"><h2>History</h2>${history}<p class="note">quest = interview questions · vers = prototype versions · rounds = Red Team rounds · open/defer = GAPS.md rows · outcomes = declared operation outcomes · cases/probes = oracle cases</p></section>
</div></div></body></html>
`;
}

function cmdDashboard(p, args) {
  const d = dashboardData(p);
  const json = !!args.flags.json;
  if (json && typeof args.flags.out !== 'string') { process.stdout.write(JSON.stringify(d, null, 2) + '\n'); return 0; }
  const out = typeof args.flags.out === 'string' ? path.resolve(args.flags.out) : path.join(p.logs, DASHBOARD_FILE);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json ? JSON.stringify(d, null, 2) + '\n' : renderDashboard(d));
  const shown = path.relative(p.root, out).startsWith('..') ? out : L.rel(p.root, out);
  console.log(`Wrote ${shown}: ${d.next ? `next ${d.next.id} ${d.next.label}, ${d.gates.filter(g => !g.ok).length} gate(s) failing` : 'pipeline complete'}${d.gaps ? `, ${d.gaps.open} open gap(s)` : ''}${d.lock ? `, lock ${d.lock.intact ? 'intact' : 'modified'}` : ''}`);
  if (args.flags.open) {
    const cp = require('child_process');
    const opener = process.platform === 'darwin' ? ['open', [out]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', out]] : ['xdg-open', [out]];
    try { cp.spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { console.log(`  could not open a browser: ${e.message}`); }
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
    ? [...(prev.lock.history || []), { lockVersion: prev.lock.lockVersion, frozenAt: prev.lock.frozenAt, reason: prev.lock.reason, approvedBy: prev.lock.approvedBy, hash: prev.lock.hash, pipeline: prev.lock.pipeline ? prev.lock.pipeline.version : null }]
    : [];
  const lock = {
    tool: 'sdd',
    toolVersion: L.TOOL_VERSION,
    lockVersion: prev ? prev.lock.lockVersion + 1 : 1,
    frozenAt: now,
    reason,
    approvedBy: by,
    hash: cur.hash,
    // The pipeline (specs/.sdd/** except the state file) pinned as one entry: its version and one hash over its files.
    pipeline: cur.pipeline,
    // Spec content, one hash per file.
    files: cur.files,
    // Baseline for the next slice's cap (sliceCapGate counts only outcomes not in this list). Not part of the hash.
    outcomes: declaredOutcomes(ctx).sort(),
    history,
  };
  if (prev) {
    console.log(`Re-freezing (v${prev.lock.lockVersion} → v${lock.lockVersion}). Changes:`);
    if (L.pipelineLine(prev)) console.log(`  ~ ${L.pipelineLine(prev)}`);
    prev.modified.forEach(f => console.log(`  ~ ${f}`));
    prev.added.forEach(f => console.log(`  + ${f}`));
    prev.removed.forEach(f => console.log(`  - ${f}`));
  }
  L.writeJson(p.lock, lock);
  console.log(`Frozen ${Object.keys(cur.files).length} spec file(s) + pipeline ${cur.pipeline.version} as lock v${lock.lockVersion} (${cur.hash.slice(0, 12)}) → specs/spec.lock.json`);
  return 0;
}

function cmdVerify(p) {
  const v = L.verifyLock(p.root);
  if (!v.exists) { console.log('✗ no specs/spec.lock.json — nothing is frozen yet'); return 1; }
  if (v.valid) { console.log(`✓ frozen set intact: lock v${v.lock.lockVersion} (${v.lock.hash.slice(0, 12)}), ${Object.keys(v.lock.files).length} spec file(s) + pipeline ${v.lock.pipeline.version}`); return 0; }
  console.log(`✗ frozen set differs from lock v${v.lock.lockVersion}:`);
  if (!v.intact) console.log('  ! spec.lock.json hash does not match its own file list (lock edited by hand)');
  if (L.pipelineLine(v)) console.log(`  ~ ${L.pipelineLine(v)}${REFREEZE_HINT(v)}`);
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
    fail(`--resume ${args.flags.resume} is not a resume target: use one of ${RESUME_TARGETS.join('|')} (00_backprop/CONTEXT.md §Handoff).`);
  }
  let order = orderCheck(stage, state, info);
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
  if (stage === '02' && approvedBy) note = `${note}; prototype accepted by ${approvedBy}`;
  if (stage === '07' && release) note = `${note}; release certification (L2)`;
  const v = exists(p.lock) ? L.verifyLock(p.root) : null;
  const now = new Date().toISOString();
  // Preserve unknown fields: other tools (e.g. the SDD VS Code extension) share this file.
  const next = { ...state, lastCompletedStep: last, stepName: L.STAGES[stage].name, projectType: info.projectType, timestamp: now, notes: note };
  L.writeJson(p.state, next);
  fs.mkdirSync(p.logs, { recursive: true });
  const record = { ts: now, completed: L.STAGES[stage].name, resume: resume ? L.STAGES[resume].name : null, lastCompletedStep: last, lockHash: v && v.valid ? v.lock.hash : null, note };
  if (stage === '02') {
    record.approvedBy = approvedBy; // the user's acceptance of the prototype (never self-attested in a file the agent writes)
    Object.assign(record, acceptedOutcomes(p)); // what this slice declares: the per-slice cap under a rolling cadence reads it at Stage 03
  }
  if (stage === '07') record.release = release;
  record.metrics = stageMetrics(p); // where the time went: rounds, gaps, outcomes, cases per stage, comparable across projects
  // These open a new iteration: Stage 03's round cap counts swarm-log headings from here (swarmRounds).
  if (['00', '01', '01b'].includes(stage)) record.swarmHeadings = swarmHeadings(p);
  fs.appendFileSync(p.transitions, JSON.stringify(record) + '\n');
  writeDecisionFingerprint(p, now); // the log is append-only from here: `check` warns when an earlier row changes
  console.log(`\n✓ ${L.STAGES[stage].name} complete → lastCompletedStep=${last}. ${note}`);
  try { fs.writeFileSync(path.join(p.logs, DASHBOARD_FILE), renderDashboard(dashboardData(p))); console.log(`  dashboard: specs/logs/${DASHBOARD_FILE} (open it in a browser; \`sdd.cjs dashboard\` regenerates it any time)`); } catch { /* a derived page never blocks a transition */ }
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
  // The frozen set: the spec files listed in the lock plus the pipeline (pinned as one entry, copied file by file).
  const frozen = [...Object.keys(v.lock.files), ...L.pipelineFiles(p.root)];
  if (update) {
    // Remove frozen files that no longer exist in the new lock; B's own code is never touched.
    const keep = new Set(frozen);
    const stale = [...Object.keys(L.readJson(bLock).files || {}), ...L.pipelineFiles(out)];
    for (const f of stale) if (!keep.has(f)) fs.rmSync(path.join(out, f), { force: true });
  }
  const copy = (relPath, transform) => {
    const src = path.join(p.root, relPath);
    const dst = path.join(out, relPath);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (transform) fs.writeFileSync(dst, transform(fs.readFileSync(src, 'utf8')));
    else fs.copyFileSync(src, dst);
  };
  for (const f of frozen) copy(f);
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
  console.log(`${update ? 'Resynced' : 'Exported'} ${frozen.length} frozen file(s) (${Object.keys(v.lock.files).length} spec + pipeline ${v.lock.pipeline.version}) ${update ? 'into' : 'to'} ${out}`);
  console.log('Next: open that directory in a FRESH agent session (no access to the first implementation) and run Stage 05.');
  return 0;
}

function main() {
  const args = L.parseArgs(process.argv.slice(2));
  const root = typeof args.flags.root === 'string' ? path.resolve(args.flags.root) : L.defaultRoot();
  const p = L.projectPaths(root);
  const commands = { status: cmdStatus, check: cmdCheck, freeze: cmdFreeze, verify: cmdVerify, transition: cmdTransition, export: cmdExport, readiness: cmdReadiness, agenda: cmdAgenda, metrics: cmdMetrics, 'spec-outline': cmdSpecOutline, upgrade: cmdUpgrade, dashboard: cmdDashboard };
  const cmd = commands[args._[0]];
  if (!cmd) { console.log(USAGE); return args._[0] ? 2 : 0; }
  return cmd(p, args);
}

// Exit quietly when stdout is closed early (e.g. piped into `head`).
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(process.exitCode || 0); throw e; });

process.exitCode = main();
