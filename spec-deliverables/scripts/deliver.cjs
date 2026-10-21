#!/usr/bin/env node
'use strict';
/**
 * deliver.cjs — derive reader-facing deliverables from an SDD spec set. Node only; no dependencies beyond the
 * project's own pipeline library (specs/.sdd/scripts/sdd-lib.cjs), so the contracts parse exactly as the oracle reads them.
 *
 *   node deliver.cjs build [api|manual|test-plan|all] [--write] [--root R] [--out docs]
 *       Generate the markdown deliverable(s) under <out>/<deliverable>/ (a summary without --write).
 *   node deliver.cjs compile [api|manual|test-plan|all] [--root R] [--out docs]
 *       Compile each deliverable's markdown into one self-contained index.html (no scripts; the manual embeds the wireframes).
 *   node deliver.cjs check [--root R] [--out docs]
 *   Common flags: --root (default: the enclosing SDD workspace), --out (default docs), --lib (the pipeline library,
 *   default specs/.sdd/scripts/sdd-lib.cjs of the project or of a template above it).
 *       Compare each deliverable's baseline.json with the spec set now: exit 1 when a deliverable is stale.
 *
 * Every file written is derived; nothing under specs/ is ever touched.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const DELIVERABLES = {
  api: { dir: 'api-reference', title: 'API reference' },
  manual: { dir: 'user-manual', title: 'User manual' },
  'test-plan': { dir: 'test-plan', title: 'Test plan' },
};
const BANNER = (what) => `> **Derived by \`deliver.cjs\` from the frozen spec set; do not edit by hand.** ${what} Where this document and the spec set differ, the spec set wins and the difference is a defect here.`;

// ---------------------------------------------------------------- args, root, library
function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out.flags[name] = next; i++; } else out.flags[name] = true;
  }
  return out;
}
function findRoot(start) {
  let d = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(d, 'specs/.sdd/scripts/sdd-lib.cjs'))) return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}
const exists = f => fs.existsSync(f);
const readText = f => (exists(f) ? fs.readFileSync(f, 'utf8') : '');
const readJsonSafe = f => { try { return JSON.parse(readText(f)); } catch { return null; } };
const sha = s => require('crypto').createHash('sha256').update(s).digest('hex');
const rel = (root, f) => path.relative(root, f).split(path.sep).join('/');

// ---------------------------------------------------------------- spec set loader
function parseSections(text, file) {
  const lines = text.split(/\r?\n/);
  const heads = [];
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) fence = !fence;
    if (fence) continue;
    const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) heads.push({ i, level: m[1].length, title: m[2] });
  }
  const out = [];
  heads.forEach((h, k) => {
    let end = lines.length;
    for (let j = k + 1; j < heads.length; j++) if (heads[j].level <= h.level) { end = heads[j].i; break; }
    let own = end;
    for (let j = k + 1; j < heads.length; j++) if (heads[j].i < end) { own = heads[j].i; break; }
    const num = (h.title.match(/^(\d+(?:\.\d+)*)\.?\s/) || [])[1] || null;
    out.push({ level: h.level, num, title: h.title.replace(/^\d+(?:\.\d+)*\.?\s+/, ''), raw: h.title, body: lines.slice(h.i + 1, end).join('\n'), own: lines.slice(h.i + 1, own).join('\n'), file });
  });
  return out;
}
function parseTable(block) {
  const rows = block.split(/\r?\n/).filter(l => /^\s*\|/.test(l));
  if (rows.length < 2) return null;
  const cells = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  const header = cells(rows[0]);
  const body = rows.slice(1).filter(l => !/^\s*\|\s*:?-+/.test(l)).map(cells);
  return { header, rows: body };
}
function firstTable(block, mustHave) {
  const parts = block.split(/\n\s*\n/);
  for (const p of parts) {
    const t = parseTable(p);
    if (t && (!mustHave || mustHave.every(h => t.header.some(x => x.toLowerCase().includes(h))))) return t;
  }
  return null;
}
function allTables(block) {
  return block.split(/\n\s*\n/).map(parseTable).filter(Boolean);
}

function findLib(root, flag) {
  if (flag) return path.resolve(flag);
  let d = root;
  for (;;) { const f = path.join(d, 'specs/.sdd/scripts/sdd-lib.cjs'); if (exists(f)) return f; const up = path.dirname(d); if (up === d) return null; d = up; }
}
function loadSpecSet(root, libPath) {
  const lib = require(libPath);
  const p = lib.projectPaths(root);
  const S = { root, lib, p, inputs: new Set() };
  const use = f => { if (exists(f)) S.inputs.add(rel(root, f)); return f; };
  S.specFiles = lib.specFiles(root);
  S.specFiles.forEach(f => use(path.join(root, f)));
  S.specTextMain = readText(path.join(root, 'specs/SPEC.md'));
  S.specText = S.specFiles.map(f => readText(path.join(root, f))).join('\n');
  S.title = (S.specTextMain.match(/^#\s+(.+?)\s*$/m) || [])[1] || path.basename(root);
  S.sections = S.specFiles.flatMap(f => parseSections(readText(path.join(root, f)), f));
  S.section = num => S.sections.find(s => s.num === num);
  S.sectionBody = num => (S.section(num) || {}).body || '';
  S.children = num => S.sections.filter(s => s.num && s.num.startsWith(num + '.') && s.num.split('.').length === num.split('.').length + 1);
  S.manifest = readJsonSafe(use(p.manifest));
  S.design = readText(use(p.design));
  S.decisionLog = readText(use(p.decisionLog));
  S.phasesText = readText(use(path.join(root, 'specs/IMPLEMENTATION_PHASES.md')));
  S.prototypeRecord = readText(use(path.join(root, 'specs/logs/02-prototype.md')));
  S.lock = readJsonSafe(use(p.lock));
  S.pipeline = lib.pipelineVersion ? lib.pipelineVersion(root) : ((readText(path.join(root, 'specs/.sdd/WORKSPACE_ROUTING.md')).match(/<!--\s*version:\s*(.+?)\s*-->/) || [])[1] || 'unknown');
  try { S.commit = cp.execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { S.commit = null; }
  // contracts
  const art = (S.manifest && S.manifest.artifacts) || {};
  S.openapi = null;
  if (art.openapi && exists(path.join(p.contracts, art.openapi))) {
    try { const o = lib.loadOpenApi(use(path.join(p.contracts, art.openapi)), root); S.openapi = o.doc; S.ops = o.ops.filter(x => x.operationId); } catch (e) { S.openapiError = e.message; S.ops = []; }
  } else S.ops = [];
  S.errors = art.errors ? (readJsonSafe(use(path.join(p.contracts, art.errors))) || {}).errors || [] : [];
  S.errorsDoc = art.errors ? readJsonSafe(path.join(p.contracts, art.errors)) || {} : {};
  S.statecharts = art.statecharts ? readJsonSafe(use(path.join(p.contracts, art.statecharts))) : null;
  S.cli = art.cli ? readJsonSafe(use(path.join(p.contracts, art.cli))) : null;
  // oracle
  let cases = [];
  try { const r = lib.loadCases(p); cases = r.cases; r.files.forEach(f => use(f)); } catch { cases = []; }
  if (!cases.length && exists(p.cases)) {
    for (const f of fs.readdirSync(p.cases).filter(x => x.endsWith('.json'))) {
      const d = readJsonSafe(use(path.join(p.cases, f))); if (d && Array.isArray(d.cases)) cases.push(...d.cases.map(c => ({ ...c, suite: d.suite || f.replace(/\.json$/, ''), file: `specs/fixtures/cases/${f}`, suiteDescription: d.description || '' })));
    }
  } else {
    for (const f of exists(p.cases) ? fs.readdirSync(p.cases).filter(x => x.endsWith('.json')) : []) {
      const d = readJsonSafe(path.join(p.cases, f)); if (!d) continue;
      cases.filter(c => c.file === `specs/fixtures/cases/${f}`).forEach(c => { c.suiteDescription = d.description || ''; });
    }
  }
  S.cases = cases;
  S.oracleConfig = readJsonSafe(use(p.oracleConfig));
  S.uiSpecs = [];
  if (exists(p.uiFixtures)) {
    for (const f of fs.readdirSync(p.uiFixtures).filter(x => /\.(spec|test)\.[cm]?[jt]s$/.test(x)).sort()) {
      const t = readText(use(path.join(p.uiFixtures, f)));
      S.uiSpecs.push({ file: f, tests: [...t.matchAll(/^\s*test\(\s*(['"`])(.+?)\1/gm)].map(m => m[2]), covers: [...t.matchAll(/\/\/\s*covers:\s*(.*)$/gm)].map(m => m[1].trim()), observes: [...new Set([...t.matchAll(/observe\([^,]+,\s*(['"`])([^'"`]+)\1/g)].map(m => m[2]))], generated: /generated|ui-specgen/i.test(t.slice(0, 400)) });
    }
  }
  S.runs = [];
  if (exists(p.oracleLogs)) {
    for (const f of fs.readdirSync(p.oracleLogs).filter(x => x.startsWith('run-') && x.endsWith('.json'))) { const r = readJsonSafe(path.join(p.oracleLogs, f)); if (r) S.runs.push({ ...r, file: f }); }
    S.runs.sort((a, b) => String(a.finishedAt).localeCompare(String(b.finishedAt)));
  }
  S.latestRun = [...S.runs].reverse().find(r => r.target === 'default' && !r.filtered) || [...S.runs].pop() || null;
  if (S.latestRun) use(path.join(p.oracleLogs, S.latestRun.file));
  S.uiRun = readJsonSafe(use(path.join(p.logs, 'ui-e2e.json')));
  S.results = new Map((S.latestRun && S.latestRun.results || []).map(r => [r.id, r]));
  // wireframes
  S.wireframes = [];
  const wfDir = path.join(root, 'specs/wireframes');
  if (exists(wfDir)) {
    for (const f of fs.readdirSync(wfDir).filter(x => x.endsWith('.html')).sort()) {
      const t = readText(use(path.join(wfDir, f)));
      S.wireframes.push({ file: f, title: ((t.match(/<title>(.*?)<\/title>/s) || [])[1] || f).trim(), frames: [...t.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)].map(m => m[1].replace(/<[^>]+>/g, '').trim()), testids: [...new Set([...t.matchAll(/data-testid="([^"]+)"/g)].map(m => m[1]))].sort() });
    }
  }
  // invariants, copy table, state matrix, glossary
  S.invariants = {};
  for (const m of S.specText.matchAll(/^\s*[-*]\s+\*\*(V\d+)[:.]?\*\*:?\s*(.+)$/gm)) S.invariants[m[1]] = m[2].trim();
  S.copy = {};
  for (const t of allTables(S.sectionBody('14.4'))) {
    const ki = t.header.findIndex(h => /key/i.test(h)); const ti = t.header.findIndex(h => /text|string|copy/i.test(h));
    if (ki < 0 || ti < 0) continue;
    for (const r of t.rows) { const k = (r[ki] || '').replace(/`/g, '').trim(); if (k) S.copy[k] = (r[ti] || '').replace(/^`|`$/g, ''); }
  }
  S.stateMatrix = [];
  const sm = S.design.includes('## UI State Matrix') ? S.design.slice(S.design.indexOf('## UI State Matrix')) : '';
  const smt = firstTable(sm, ['component']);
  if (smt) S.stateMatrix = smt.rows.map(r => Object.fromEntries(smt.header.map((h, i) => [h.toLowerCase(), r[i] || ''])));
  S.screens = [];
  const aw = S.design.includes('## Approved Wireframes') ? S.design.slice(S.design.indexOf('## Approved Wireframes')) : '';
  for (const m of aw.matchAll(/^### (.+?): \[([^\]]+)\]\(wireframes\/([^)]+)\)\s*\n([\s\S]*?)(?=^### |^## |(?![\s\S]))/gm)) S.screens.push({ title: m[1].trim(), name: m[2], file: m[3], body: m[4].trim() });
  return S;
}

// ---------------------------------------------------------------- helpers for rendering
const esc = s => String(s === undefined || s === null ? '' : s);
const cell = s => esc(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const clip = (s, n) => { s = esc(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const firstSentence = s => { const m = esc(s).replace(/\s+/g, ' ').match(/^(.+?[.!?])(\s|$)/); return m ? m[1] : clip(s, 200); };
const slug = s => esc(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/[`*]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-');
const humanize = s => esc(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/-/g, ' ');
const table = (header, rows) => (rows.length ? [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.map(cell).join(' | ')} |`)].join('\n') : '_none_');
const fence = (lang, s) => '```' + lang + '\n' + s + '\n```';
const jsonBlock = (v, maxLines = 40) => { const s = JSON.stringify(v, null, 2); const ls = s.split('\n'); return fence('json', ls.length > maxLines ? ls.slice(0, maxLines).join('\n') + `\n… (${ls.length - maxLines} more lines)` : s); };
function baselineBlock(S, what) {
  const rows = [['Spec', `${S.title}`], ['Pipeline', S.pipeline], ['Lock', S.lock ? `v${S.lock.lockVersion} \`${String(S.lock.hash).slice(0, 12)}\`${S.lock.frozenAt ? ` (frozen ${String(S.lock.frozenAt).slice(0, 10)})` : ''}` : 'none (the spec set is not frozen yet: this is a preview, not a baseline)'], ['Commit', S.commit || '—'], ['Generated', new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC']];
  return `## Baseline\n\n${table(['Item', 'Value'], rows)}\n\n${what}`;
}
function schemaName(doc, node) {
  if (!node) return '—';
  if (node.$ref) return '`' + String(node.$ref).split('/').pop() + '`';
  if (node.type === 'array') return `array of ${schemaName(doc, node.items)}`;
  if (node.type) return node.type + (node.format ? ` (${node.format})` : '') + (node.enum ? ` [${node.enum.slice(0, 6).join(', ')}${node.enum.length > 6 ? ', …' : ''}]` : '');
  if (node.oneOf) return 'one of ' + node.oneOf.map(x => schemaName(doc, x)).join(', ');
  if (node.allOf) return node.allOf.map(x => schemaName(doc, x)).join(' + ');
  if (node.properties) return 'object';
  return '—';
}
function constraints(sc) {
  if (!sc) return '';
  const c = [];
  for (const k of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'default', 'multipleOf']) if (sc[k] !== undefined) c.push(`${k} ${typeof sc[k] === 'string' ? '`' + clip(sc[k], 40) + '`' : JSON.stringify(sc[k])}`);
  if (sc.enum) c.push(`enum: ${sc.enum.slice(0, 8).map(v => '`' + v + '`').join(', ')}${sc.enum.length > 8 ? ', …' : ''}`);
  if (sc.nullable) c.push('nullable');
  return c.join('; ');
}

// ---------------------------------------------------------------- API reference
function opGroups(S) {
  const byId = new Map(S.ops.map(o => [o.operationId, o]));
  const groups = [];
  const seen = new Set();
  for (const sec of S.children('5')) {
    const ids = [...new Set([...sec.body.matchAll(/`([a-z][A-Za-z0-9]+)`/g)].map(m => m[1]))].filter(id => byId.has(id) && !seen.has(id));
    if (!ids.length) continue;
    ids.forEach(id => seen.add(id));
    groups.push({ num: sec.num, title: sec.title, ops: ids.map(id => byId.get(id)), file: `${sec.num.replace(/\./g, '-')}-${slug(sec.title)}.md` });
  }
  const rest = S.ops.filter(o => !seen.has(o.operationId));
  if (rest.length) {
    const byTag = new Map();
    for (const o of rest) { const t = (o.op.tags && o.op.tags[0]) || o.path.split('/').filter(Boolean)[0] || 'other'; if (!byTag.has(t)) byTag.set(t, []); byTag.get(t).push(o); }
    for (const [t, ops] of byTag) groups.push({ num: null, title: humanize(t).replace(/^./, c => c.toUpperCase()), ops, file: `ops-${slug(t)}.md` });
  }
  return groups;
}
function opSpecEntry(S, id) {
  // The SPEC §5 paragraph that opens with **`opId`** — …, with its bullet list.
  const re = new RegExp('^\\*\\*`' + id + '`\\*\\*\\s*[—–-]+\\s*(.*)$', 'm');
  const m = S.specText.match(re);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = S.specText.slice(start);
  const end = rest.search(/\n\s*\n(?!\s*[-*\d]|\s{2,})|\n\*\*`|\n#{1,6} /);
  const body = rest.slice(0, end < 0 ? rest.length : end).replace(/^\n/, '');
  return { lead: m[1].trim(), body: body.trim() };
}
function opCases(S, o) {
  const out = [];
  for (const c of S.cases) {
    const steps = (c.steps || []).filter(s => s.http && S.lib.matchOperation(S.ops, s.http.method, s.http.path) === o);
    if (steps.length) out.push({ c, steps });
  }
  return out;
}
function renderExample(S, o, c, step, label) {
  const h = step.http;
  const q = h.query ? '?' + Object.entries(h.query).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&') : '';
  const headers = Object.entries(h.headers || {}).map(([k, v]) => `${k}: ${/authorization/i.test(k) ? 'Bearer <token>' : esc(v)}`);
  const req = [`${h.method} ${h.path}${q}`, ...headers].join('\n') + (h.body !== undefined ? '\n\n' + JSON.stringify(h.body, null, 2) : '');
  const ex = step.expect || {};
  const res = `HTTP ${ex.status}` + (ex.headers && ex.headers['content-type'] ? `\ncontent-type: ${ex.headers['content-type']}` : '');
  const body = ex.body !== undefined ? ex.body : ex.bodyMatch;
  return `**${label}** (oracle case \`${c.id}\`${c.title ? ` — ${clip(c.title, 90)}` : ''}; a \`{"$type": …}\` value stands for any value of that type)\n\n${fence('http', req)}\n\n${fence('http', res)}\n\n${body !== undefined ? jsonBlock(body, 30) : '_no body_'}`;
}
function renderOperation(S, o) {
  const doc = S.openapi;
  const L = [];
  const spec = opSpecEntry(S, o.operationId);
  const sum = o.op.summary || (spec ? firstSentence(spec.lead) : '') || (o.op.description ? firstSentence(o.op.description) : '');
  L.push(`### \`${o.operationId}\``, '', `**${o.method} \`${o.path}\`**${sum ? ' — ' + esc(sum) : ''}`, '');
  const actor = (o.op.description || '').match(/Actor:\s*([^.\n]+)/) || (spec ? spec.lead.match(/Actor:\s*([^.\n]+)/) : null);
  const rows = [];
  if (actor) rows.push(['Who may call it', actor[1].trim()]);
  rows.push(['Authentication', Array.isArray(o.op.security) && !o.op.security.length ? 'none (public)' : 'bearer token (see Authentication)']);
  if (o.op.tags && o.op.tags.length) rows.push(['Tags', o.op.tags.join(', ')]);
  const specSec = S.children('5').find(s => s.body.includes('`' + o.operationId + '`'));
  if (specSec) rows.push(['Specified in', `SPEC §${specSec.num} ${specSec.title}`]);
  L.push(table(['', ''], rows), '');
  if (spec && spec.body) L.push('**Rules** (from the spec):', '', spec.body, '');
  else if (o.op.description) L.push(clip(o.op.description, 1200), '');
  const params = [...(o.pathParams || []), ...((o.op.parameters || []).map(x => S.lib.deref(doc, x)))].filter(Boolean);
  if (params.length) {
    L.push('**Parameters**', '', table(['Name', 'In', 'Required', 'Type', 'Description'], params.map(pr => { const sc = S.lib.deref(doc, pr.schema) || {}; return [`\`${pr.name}\``, pr.in, pr.required ? 'yes' : 'no', schemaName(doc, pr.schema) + (constraints(sc) ? `; ${constraints(sc)}` : ''), clip(pr.description || '', 220)]; })), '');
  }
  const rb = o.op.requestBody ? S.lib.deref(doc, o.op.requestBody) : null;
  if (rb) {
    const ct = Object.entries(rb.content || {})[0];
    L.push(`**Request body** (${ct ? ct[0] : 'application/json'}${rb.required === false ? ', optional' : ''}): ${ct ? schemaName(doc, ct[1].schema) : '—'}${rb.description ? ' — ' + clip(rb.description, 300) : ''}`, '');
  }
  const resp = Object.entries(o.op.responses || {}).map(([st, r]) => { const rr = S.lib.deref(doc, r) || {}; const ct = Object.entries(rr.content || {})[0]; return [st, clip(rr.description || '', 160), ct ? schemaName(doc, ct[1].schema) : '—']; });
  if (resp.length) L.push('**Responses**', '', table(['Status', 'Meaning', 'Body'], resp), '');
  const outcomes = Array.isArray(o.op['x-outcomes']) ? o.op['x-outcomes'] : [];
  if (outcomes.length) L.push('**Every observable outcome** (`x-outcomes`; the oracle grades each one):', '', table(['Status', 'Code', 'When', 'Profile rule'], outcomes.map(x => [String(x.status), x.code ? `\`${x.code}\`` : '— (success)', clip(x.trigger || '', 260), x.rule || ''])), '');
  const cases = opCases(S, o);
  const okStep = cases.flatMap(x => x.steps.map(s => [x.c, s])).find(([, s]) => s.expect && s.expect.status >= 200 && s.expect.status < 300);
  const errStep = cases.flatMap(x => x.steps.map(s => [x.c, s])).find(([, s]) => s.expect && s.expect.status >= 400);
  if (okStep || errStep) {
    L.push('**Examples** (recorded in the oracle; every build must answer exactly this way)', '');
    if (okStep) L.push(renderExample(S, o, okStep[0], okStep[1], 'Success'), '');
    if (errStep) L.push(renderExample(S, o, errStep[0], errStep[1], 'Failure'), '');
  }
  const vs = [...new Set(cases.flatMap(x => (x.c.derivedFrom || []).flatMap(d => [...String(d).matchAll(/\bV(\d+)\b/g)].map(m => 'V' + m[1]))))].sort((a, b) => +a.slice(1) - +b.slice(1));
  if (vs.length) L.push('**Invariants exercised**', '', ...vs.map(v => `- **${v}** ${S.invariants[v] ? clip(S.invariants[v], 200) : ''}`), '');
  L.push(`Oracle coverage: ${cases.length ? `${cases.length} case(s) — ${cases.slice(0, 12).map(x => '`' + x.c.id + '`').join(', ')}${cases.length > 12 ? ', …' : ''}` : 'no recorded case yet'}${cases.length && S.latestRun ? `; latest run: ${cases.filter(x => (S.results.get(x.c.id) || {}).status === 'pass').length} pass, ${cases.filter(x => S.results.has(x.c.id) && S.results.get(x.c.id).status !== 'pass').length} fail` : ''}`, '');
  return L.join('\n');
}
function buildApi(S) {
  const files = {};
  const doc = S.openapi;
  if (!doc) {
    files['README.md'] = `# ${S.title} — API reference\n\n${BANNER('No OpenAPI contract exists yet (Stage 03 compiles it against the accepted prototype); this reference is empty until then.')}\n\n${baselineBlock(S, '')}\n`;
    return files;
  }
  const info = doc.info || {};
  const groups = opGroups(S);
  const L = [`# ${info.title || S.title} — API reference`, '', BANNER('Built from `openapi.yaml` (operations, parameters, schemas, every declared outcome), `errors.json` (the error catalogue), SPEC §5 (the rules in words) and the oracle cases (recorded request/response examples).'), ''];
  L.push(`Version ${info.version || '—'} · ${S.ops.length} operations in ${groups.length} groups · ${Object.keys((doc.components || {}).schemas || {}).length} schemas · ${S.errors.length} error codes`, '');
  L.push('## Contents', '', '- [Conventions](#conventions) · [Authentication](#authentication) · [Errors](errors.md) · [Schemas](schemas.md)', ...groups.map(g => `- [${g.num ? '§' + g.num + ' ' : ''}${g.title}](${g.file}) — ${g.ops.length} operation(s)`), '');
  if (info.description) L.push('## Conventions', '', ...String(info.description).split(/\n+/).map(x => x.trim()).filter(Boolean).flatMap(x => [x, '']));
  const sec = (doc.components || {}).securitySchemes || {};
  L.push('## Authentication', '');
  if (Object.keys(sec).length) L.push(table(['Scheme', 'Type', 'How'], Object.entries(sec).map(([k, v]) => [k, `${v.type}${v.scheme ? ' ' + v.scheme : ''}${v.in ? ` (${v.in}: ${v.name})` : ''}`, clip(v.description || '', 300)])), '');
  else L.push('No security scheme is declared: every operation is public.', '');
  const pub = S.ops.filter(o => Array.isArray(o.op.security) && !o.op.security.length);
  if (pub.length) L.push(`Public operations (no token): ${pub.map(o => '`' + o.operationId + '`').join(', ')}.`, '');
  L.push('## Operation index', '', table(['Operation', 'Method and path', 'Purpose', 'Outcomes'], groups.flatMap(g => g.ops.map(o => [`[\`${o.operationId}\`](${g.file}#${slug(o.operationId)})`, `${o.method} \`${o.path}\``, clip(o.op.summary || (opSpecEntry(S, o.operationId) || {}).lead || firstSentence(o.op.description || ''), 140), String((o.op['x-outcomes'] || []).length || o.statuses.length)]))), '');
  L.push(baselineBlock(S, ''), '');
  files['README.md'] = L.join('\n');
  for (const g of groups) {
    const G = [`# ${g.num ? '§' + g.num + ' ' : ''}${g.title}`, '', BANNER('One section per operation: purpose, who may call it, the rules in the spec\'s words, parameters, responses, every declared outcome, recorded examples and the invariants the oracle exercises through it.'), '', `[← Index](README.md) · ${g.ops.length} operation(s): ${g.ops.map(o => `[\`${o.operationId}\`](#${slug(o.operationId)})`).join(' · ')}`, ''];
    const intro = g.num ? (S.section(g.num) || {}).own || '' : '';
    const common = intro.split(/\n\s*\n/).find(x => /^\*\*Common rules/.test(x.trim()));
    if (common) G.push('## Common rules', '', common.trim(), '');
    G.push('## Operations', '');
    for (const o of g.ops) G.push(renderOperation(S, o), '---', '');
    files[g.file] = G.join('\n');
  }
  // errors
  const E = [`# Errors`, '', BANNER('The error catalogue from `errors.json` and the problem envelope from `openapi.yaml`.'), '', '[← Index](README.md)', ''];
  const problem = ((doc.components || {}).schemas || {}).Problem;
  if (S.errorsDoc.typeBaseUri) E.push(`Every failure is an RFC 9457 problem document (\`application/problem+json\`). \`type\` is \`${S.errorsDoc.typeBaseUri}<CODE>\`; \`code\` is the catalogue code below; \`retryable\` says whether the same request may succeed later.`, '');
  if (problem && problem.properties) E.push('## Problem envelope', '', table(['Member', 'Type', 'Meaning'], Object.entries(problem.properties).map(([k, v]) => [`\`${k}\``, schemaName(doc, v), clip(v.description || '', 220)])), '');
  E.push('## Catalogue', '', table(['Code', 'HTTP', 'Title', 'Retryable', 'When it is returned'], S.errors.map(e => [`\`${e.code}\``, String(e.status || ''), e.title || '', e.retryable ? 'yes' : 'no', clip(e.description || '', 320)])), '');
  const used = new Map();
  for (const o of S.ops) for (const x of o.op['x-outcomes'] || []) if (x.code) { if (!used.has(x.code)) used.set(x.code, new Set()); used.get(x.code).add(o.operationId); }
  if (used.size) E.push('## Where each code can occur', '', table(['Code', 'Operations'], [...used.entries()].sort().map(([c, ops]) => [`\`${c}\``, [...ops].sort().slice(0, 20).map(x => '`' + x + '`').join(', ') + (ops.size > 20 ? ` … (${ops.size} operations)` : '')])), '');
  files['errors.md'] = E.join('\n');
  // schemas
  const schemas = (doc.components || {}).schemas || {};
  const C = [`# Schemas`, '', BANNER('Every component schema of `openapi.yaml`, as the contract declares it.'), '', '[← Index](README.md)', '', Object.keys(schemas).sort().map(n => `[\`${n}\`](#${slug(n)})`).join(' · '), ''];
  for (const n of Object.keys(schemas).sort()) {
    const sc = S.lib.deref(doc, schemas[n]) || {};
    C.push(`## \`${n}\``, '');
    if (sc.description) C.push(clip(sc.description, 600), '');
    const kind = sc.type || (sc.oneOf ? 'oneOf' : sc.allOf ? 'allOf' : sc.properties ? 'object' : '—');
    C.push(`Type: ${kind}${sc.format ? ` (${sc.format})` : ''}${constraints(sc) ? '; ' + constraints(sc) : ''}${sc.additionalProperties === false ? '; no additional properties' : ''}`, '');
    const props = sc.properties || (sc.allOf || []).map(x => S.lib.deref(doc, x) || {}).reduce((a, x) => Object.assign(a, x.properties || {}), {});
    const req = new Set([...(sc.required || []), ...((sc.allOf || []).flatMap(x => (S.lib.deref(doc, x) || {}).required || []))]);
    if (Object.keys(props).length) C.push(table(['Member', 'Type', 'Required', 'Constraints', 'Meaning'], Object.entries(props).map(([k, v]) => { const d = S.lib.deref(doc, v) || {}; return [`\`${k}\``, schemaName(doc, v), req.has(k) ? 'yes' : 'no', constraints(d), clip(d.description || v.description || '', 220)]; })), '');
    if (sc.oneOf) C.push('One of: ' + sc.oneOf.map(x => schemaName(doc, x)).join(', '), '');
    if (sc.items) C.push('Items: ' + schemaName(doc, sc.items), '');
  }
  files['schemas.md'] = C.join('\n');
  return files;
}

// ---------------------------------------------------------------- User manual
function resolveCopy(S, text) {
  return esc(text).replace(/`((?:[a-z]+\.)+[a-z0-9_.{}-]+)`/g, (m, k) => (S.copy[k] ? `“${S.copy[k]}”` : m));
}
function readable(S, text) {
  // Component names and copy keys in spec prose become words and strings a user recognises.
  return resolveCopy(S, text).replace(/`([A-Z][A-Za-z0-9]+)`/g, (m, n) => humanize(n)).replace(/\[DEC\d+\]/g, '').replace(/\(DEC\d+(?:, DEC\d+)*\)/g, '');
}
function buildManual(S) {
  const files = {};
  const roles = (() => { const t = firstTable(S.sectionBody('3'), ['#']); return t ? t.header.slice(2) : []; })();
  const chapters = [['01-getting-started.md', 'Getting started'], ['02-screens.md', 'Screens'], ['03-roles-and-permissions.md', 'Roles and permissions'], ['04-concepts.md', 'Concepts and glossary'], ['05-messages.md', 'Messages and labels'], ['06-errors.md', 'Errors you may see'], ['07-administration.md', 'Administration and configuration']];
  const R = [`# ${S.title} — User manual`, '', BANNER('Built from SPEC §14 (screens, navigation, interaction rules, every user-visible string), DESIGN.md (the approved wireframes and the state of every component), SPEC §2–§4 (concepts), SPEC §3 (roles), SPEC §12 (configuration) and `errors.json`.'), ''];
  R.push(`For ${roles.length ? roles.join(', ') : 'every user'} of ${S.title}.`, '');
  R.push('## Contents', '', ...chapters.map(([f, t]) => `- [${t}](${f})`), '');
  if (S.screens.length) R.push('## Screens at a glance', '', table(['Screen', 'What it is for', 'Wireframe'], S.screens.map(s => [s.title, clip(readable(S, s.body.split(/\n\s*\n/)[0]), 200), `[${s.name}](../../specs/wireframes/${s.file})`])), '');
  R.push(baselineBlock(S, ''), '');
  files['README.md'] = R.join('\n');
  // 01 getting started
  const G = ['# Getting started', '', BANNER('From SPEC §14.2 (screen flow) and the sign-in strings of the copy table.'), ''];
  const flow = S.sectionBody('14.2');
  if (flow.trim()) G.push('## How the application opens and navigates', '', readable(S, flow.trim()), '');
  const login = Object.entries(S.copy).filter(([k]) => /login|sign[-_ ]?in|auth/i.test(k));
  if (login.length) G.push('## Signing in', '', table(['On screen', 'Text'], login.map(([k, v]) => [k, v])), '');
  const start = S.screens.find(s => /start|login|splash/i.test(s.title + s.file));
  if (start) G.push(`See the [${start.title}](02-screens.md#${slug(start.title)}) screen.`, '');
  files['01-getting-started.md'] = G.join('\n');
  // 02 screens
  const Sc = ['# Screens', '', BANNER('One section per approved screen: what it shows (DESIGN.md §Approved Wireframes), the wireframe itself, its states (DESIGN.md UI State Matrix) and the strings it uses (SPEC §14.4).'), ''];
  if (!S.screens.length) Sc.push('_No approved wireframes yet (Stage 03 captures them from the accepted prototype)._', '');
  for (const s of S.screens) {
    const wf = S.wireframes.find(w => w.file === s.file) || { frames: [], testids: [] };
    Sc.push(`## ${s.title}`, '', `Wireframe: [${s.name}](../../specs/wireframes/${s.file})`, '', `<iframe class="wireframe" src="../../specs/wireframes/${s.file}" title="${s.title}" loading="lazy"></iframe>`, '');
    Sc.push(readable(S, s.body), '');
    if (wf.frames.length) Sc.push('**States shown in the wireframe**', '', ...wf.frames.map(f => `- ${f}`), '');
    const rows = S.stateMatrix.filter(r => wf.testids.includes((r.component || '').replace(/`/g, '')));
    if (rows.length) {
      const cols = Object.keys(rows[0]).filter(k => k !== 'component');
      Sc.push('**What each part does in every state**', '', table(['Part', ...cols.map(c => c.replace(/^./, x => x.toUpperCase()))], rows.map(r => [humanize((r.component || '').replace(/`/g, '')), ...cols.map(c => clip(readable(S, r[c]), 260))])), '');
    }
    const keys = [...new Set([...(s.body + rows.map(r => Object.values(r).join(' ')).join(' ')).matchAll(/`((?:[a-z]+\.)+[a-z0-9_.-]+)`/g)].map(m => m[1]).filter(k => S.copy[k]))];
    if (keys.length) Sc.push('**Strings on this screen**', '', table(['Text', 'Key'], keys.map(k => [S.copy[k], `\`${k}\``])), '');
  }
  files['02-screens.md'] = Sc.join('\n');
  // 03 roles
  const Ro = ['# Roles and permissions', '', BANNER('SPEC §3, as written.'), '', readable(S, S.sectionBody('3').trim()) || '_SPEC §3 is empty._', ''];
  files['03-roles-and-permissions.md'] = Ro.join('\n');
  // 04 concepts
  const Co = ['# Concepts and glossary', '', BANNER('SPEC §2 (glossary) and the headings of SPEC §4 (domain model) with their opening paragraphs.'), ''];
  const gl = firstTable(S.sectionBody('2'), ['term']);
  if (gl) { const di = gl.header.findIndex(h => /def|mean/i.test(h)); Co.push('## Glossary', '', table(['Term', 'Meaning'], gl.rows.map(r => [r[0], readable(S, r[di >= 0 ? di : 1] || '')])), ''); }
  const dm = S.children('4');
  if (dm.length) { Co.push('## How the system is organised', ''); for (const s of dm) Co.push(`### ${s.title}`, '', readable(S, clip(s.own.split(/\n\s*\n/).map(x => x.trim()).filter(x => x && !x.startsWith('|') && !x.startsWith('```'))[0] || '', 700)), ''); }
  files['04-concepts.md'] = Co.join('\n');
  // 05 messages
  const M = ['# Messages and labels', '', BANNER('SPEC §14.4, the copy table: every fixed string the application shows, character-exact.'), ''];
  const ph = firstTable(S.sectionBody('14.4'), ['placeholder']);
  if (ph) M.push('## Placeholders', '', table(ph.header, ph.rows), '');
  const groupsC = new Map();
  for (const [k, v] of Object.entries(S.copy)) { const g = k.split('.')[0]; if (!groupsC.has(g)) groupsC.set(g, []); groupsC.get(g).push([k, v]); }
  for (const [g, rows] of [...groupsC.entries()].sort()) M.push(`## ${g}`, '', table(['Key', 'Text'], rows.map(([k, v]) => [`\`${k}\``, v])), '');
  if (!groupsC.size) M.push('_No copy table yet._', '');
  files['05-messages.md'] = M.join('\n');
  // 06 errors
  const advice = e => (e.retryable ? 'Try again; the same request may succeed later.' : e.status === 401 ? 'Sign in again.' : e.status === 403 ? 'You are not allowed to do this; ask an administrator.' : e.status === 404 ? 'The item does not exist or is not visible to you.' : e.status === 409 ? 'The current state does not allow it; refresh and check.' : e.status === 412 ? 'Someone changed it meanwhile; reload and retry.' : e.status === 422 ? 'Correct the input.' : e.status >= 500 ? 'Try again later; if it persists, contact support.' : 'See the explanation.');
  const Er = ['# Errors you may see', '', BANNER('`errors.json`: every error the server can answer, in the order of the catalogue, with what to do.'), '', table(['Message', 'Code', 'What it means', 'What to do'], S.errors.map(e => [e.title || e.code, `\`${e.code}\``, clip(readable(S, firstSentence(e.description || '')), 240), advice(e)])), ''];
  files['06-errors.md'] = Er.join('\n');
  // 07 administration
  const Ad = ['# Administration and configuration', '', BANNER('SPEC §12 (configuration) and the administrator rows of SPEC §3.'), ''];
  const cfg = firstTable(S.sectionBody('12'), ['env', 'var']) || firstTable(S.sectionBody('12'));
  if (cfg) Ad.push('## Configuration variables', '', table(cfg.header, cfg.rows.map(r => r.map(c => readable(S, c)))), '');
  const pm = firstTable(S.sectionBody('3'), ['#']);
  if (pm) { const ai = pm.header.findIndex(h => /admin/i.test(h)); if (ai > 0) Ad.push('## What administrators can do', '', table(['Action', 'Administrator'], pm.rows.filter(r => r[ai] && r[ai] !== '✗').map(r => [readable(S, r[1]), r[ai]])), ''); }
  files['07-administration.md'] = Ad.join('\n');
  return files;
}

// ---------------------------------------------------------------- Test plan
function caseStatus(S, id) { const r = S.results.get(id); return r ? r.status : 'not run'; }
function buildTestPlan(S) {
  const files = {};
  const run = S.latestRun;
  const onLock = run && S.lock && run.lockHash === S.lock.hash && run.lockValid;
  const phases = [...S.phasesText.matchAll(/^##\s+Phase\s+(\d+)[:.]?\s*(.*)$/gm)].map(m => { const n = +m[1]; const body = S.phasesText.slice(m.index + m[0].length).split(/\n##\s+Phase\s+\d+/)[0]; const tasks = [...body.matchAll(/^\s*-\s+\[( |x|X)\]/gm)]; const ver = (body.match(/\*\*Verification:\*\*\s*(.+)$/m) || [])[1]; return { n, title: m[2].trim(), tasks: tasks.length, done: tasks.filter(t => t[1] !== ' ').length, verification: ver ? ver.trim() : '' }; });
  const casesByPhase = n => S.cases.filter(c => c.phase === n);
  const stat = cs => { const st = cs.map(c => caseStatus(S, c.id)); return { pass: st.filter(x => x === 'pass').length, fail: st.filter(x => x !== 'pass' && x !== 'not run').length, notRun: st.filter(x => x === 'not run').length }; };
  const targets = S.oracleConfig && S.oracleConfig.targets ? Object.entries(S.oracleConfig.targets) : [];
  const runLine = (S.prototypeRecord.match(/^\*\*Run:\*\*\s*(.+)$/m) || [])[1];
  const targetLine = (S.prototypeRecord.match(/^\*\*Target:\*\*\s*(.+)$/m) || [])[1];
  const buildEnv = S.oracleConfig && S.oracleConfig.buildEnv ? Object.keys(S.oracleConfig.buildEnv).length : 0;
  const eqTarget = S.manifest && S.manifest.equivalenceTarget;
  const R = [`# ${S.title} — Test plan`, '', BANNER('Built from the oracle cases (`specs/fixtures/cases`), the frozen UI specs (`specs/fixtures/ui`), `oracle.config.json`, `IMPLEMENTATION_PHASES.md`, the prototype record and the oracle run reports.'), ''];
  R.push('## Contents', '', '- [Traceability](01-traceability.md) — invariants and operations to cases, with their latest result', '- [Procedures](02-procedures.md) — every oracle case, step by step', '- [UI procedures](03-ui-procedures.md) — the frozen browser specs', '- [Schedule](04-schedule.md) — cases bound to implementation phases', '- [Results](05-results.md) — the latest run and the run history', '');
  R.push('## Purpose and scope', '', `This plan verifies that a build of **${S.title}** is observationally equivalent to its frozen specification: every declared operation outcome, every invariant and every screen state the spec set pins down. The oracle (\`specs/.sdd/scripts/oracle.cjs\`) is the single grader; a test a builder writes is never evidence.`, '');
  R.push(table(['Item under test', 'Count', 'Source'], [['Operations', String(S.ops.length), 'openapi.yaml'], ['Declared outcomes', String(S.ops.reduce((a, o) => a + ((o.op['x-outcomes'] || []).length || o.statuses.length), 0)), 'x-outcomes'], ['Invariants', String(Object.keys(S.invariants).length), 'SPEC §8'], ['Error codes', String(S.errors.length), 'errors.json'], ['Oracle cases', String(S.cases.length) + (S.cases.some(c => c.probe) ? ` (${S.cases.filter(c => c.probe).length} probes)` : ''), 'specs/fixtures/cases'], ['Browser specs', `${S.uiSpecs.length} file(s), ${S.uiSpecs.reduce((a, u) => a + u.tests.length, 0)} test(s)`, 'specs/fixtures/ui'], ['Screens (wireframes)', String(S.wireframes.length), 'specs/wireframes'], ['Implementation phases', String(phases.length), 'IMPLEMENTATION_PHASES.md']]), '');
  R.push('## Strategy', '', `- **Black-box, contract-driven.** Each case sends real requests to a running build and compares every status, header and body member with the value the spec predicts; a \`{"$type": …}\` matcher stands for a value the spec leaves free.`, `- **Levels.** L1: the oracle is green against the locked spec set. L2: two builds made independently from the frozen set alone are both green and their observable behaviour is diffed with zero divergences.${eqTarget ? ` This project targets **L${eqTarget}** (manifest.equivalenceTarget).` : ''}`, '- **User interface.** The frozen browser specs grade screens by test id, role, accessible name and copy text only, against the approved wireframes; Stage 06 visual acceptance walks every screen state.', '- **Phases.** Every implementation phase binds to the cases of its number; a phase is complete only when `oracle.cjs run --phase N` is green.', '- **Defects.** A failing case is a build defect; a case the spec cannot justify is a spec defect and goes through a Spec Change Request, never a fixture edit.', '');
  R.push('## Environment', '');
  if (runLine) R.push(`- **Start the system:** ${runLine}`);
  if (targetLine) R.push(`- **Target:** ${targetLine}`);
  if (targets.length) R.push(`- **Oracle targets** (\`oracle.config.json\`): ${targets.map(([k, v]) => `\`${k}\` → \`${v.baseUrl}\``).join('; ')}`);
  if (buildEnv) R.push(`- **Build environment:** ${buildEnv} variable(s) frozen in \`oracle.config.json#buildEnv\`; every target runs with them.`);
  if (S.oracleConfig && S.oracleConfig.defaultSetup) R.push(`- **Per-case setup:** ${S.oracleConfig.defaultSetup.map(x => '`' + x + '`').join(', ')} (hooks in \`oracle.config.json\`).`);
  R.push('', '## Entry and exit criteria', '', '| Gate | Criterion |', '|---|---|', '| Start testing a phase | The phase\'s tasks are implemented; `sdd.cjs verify` passes (the frozen set is intact). |', '| Phase complete | `oracle.cjs run --phase N` green; no case skipped. |', '| Build complete (L1) | `oracle.cjs run` green on the current lock; UI specs green; `EQUIVALENCE_REPORT.md` written by Stage 07. |', '| Release (L2) | Both builds green and `oracle.cjs diff a b` reports zero divergent cases. |', '');
  R.push('## Status now', '', run ? `Latest run: **${run.passed}/${run.total} passed** on target \`${run.target}\` at ${String(run.finishedAt).slice(0, 16).replace('T', ' ')}${onLock ? ' (bound to the current lock: evidence)' : ' (**not bound to the current lock: not evidence**)'}${run.filtered ? ' (filtered run)' : ''}. See [Results](05-results.md).` : 'No oracle run recorded yet.', '');
  R.push(baselineBlock(S, ''), '');
  files['README.md'] = R.join('\n');
  // 01 traceability
  const T = ['# Traceability', '', BANNER('Each invariant and operation with the cases that cite it (`derivedFrom`) and their latest result.'), '', '[← Plan](README.md)', ''];
  const caseV = c => [...new Set([...(c.derivedFrom || []).filter(d => !/^recorded:/.test(String(d))).flatMap(d => [...String(d).matchAll(/\bV(\d+)\b/g)].map(m => 'V' + m[1])), ...((c.covers || []).filter(x => /^inv:V\d+$/.test(x)).map(x => x.slice(4)))])];
  const exempt = (S.manifest && S.manifest.coverageExempt) || {};
  const exemptClasses = (S.manifest && S.manifest.coverageExemptClasses) || {};
  const exemptionOf = v => { for (const [k, why] of Object.entries(exempt)) { if (!k.startsWith('inv:')) continue; const pat = new RegExp('^' + k.slice(4).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); if (pat.test(v)) return typeof why === 'string' ? why : (why && why.class ? `class ${why.class}` : 'exempt'); } return null; };
  const byV = new Map();
  for (const c of S.cases) for (const v of caseV(c)) { if (!byV.has(v)) byV.set(v, []); byV.get(v).push(c); }
  const allV = Object.keys(S.invariants).sort((a, b) => +a.slice(1) - +b.slice(1));
  const exemptV = allV.filter(v => !byV.has(v) && exemptionOf(v));
  const uncoveredV = allV.filter(v => !byV.has(v) && !exemptionOf(v));
  T.push(`## Invariants → cases`, '', `${allV.length} invariants: ${allV.length - uncoveredV.length - exemptV.length} cited by at least one case (\`derivedFrom\` or \`covers: inv:Vn\`), ${exemptV.length} exempt from black-box coverage by the manifest (\`coverageExempt\`), ${uncoveredV.length} uncovered.`, '');
  if (Object.keys(exemptClasses).length) T.push('Exemption classes (one justification each, reviewed at the freeze):', '', ...Object.entries(exemptClasses).map(([k, why]) => `- **${k}** — ${clip(why, 300)}`), '');
  T.push(table(['Invariant', 'Statement', 'Cases', 'Latest'], allV.map(v => { const cs = byV.get(v) || []; const s = stat(cs); const ex = cs.length ? null : exemptionOf(v); return [`**${v}**`, clip(S.invariants[v], 160), cs.length ? cs.slice(0, 8).map(c => '`' + c.id + '`').join(', ') + (cs.length > 8 ? ` … (${cs.length})` : '') : ex ? `exempt: ${clip(ex, 60)}` : '—', cs.length ? (s.fail ? `✗ ${s.fail} failing` : s.notRun === cs.length ? 'not run' : `✓ ${s.pass}/${cs.length}`) : ex ? 'exempt' : 'uncovered']; })), '');
  const byOp = new Map(S.ops.map(o => [o.operationId, []]));
  for (const c of S.cases) for (const s of c.steps || []) if (s.http) { const o = S.lib.matchOperation(S.ops, s.http.method, s.http.path); if (o && byOp.has(o.operationId) && !byOp.get(o.operationId).includes(c)) byOp.get(o.operationId).push(c); }
  T.push('## Operations → cases', '', table(['Operation', 'Cases', 'Latest'], [...byOp.entries()].map(([id, cs]) => { const s = stat(cs); return [`\`${id}\``, cs.length ? cs.slice(0, 8).map(c => '`' + c.id + '`').join(', ') + (cs.length > 8 ? ` … (${cs.length})` : '') : '—', cs.length ? (s.fail ? `✗ ${s.fail} failing` : s.notRun === cs.length ? 'not run' : `✓ ${s.pass}/${cs.length}`) : 'uncovered']; })), '');
  if (S.wireframes.length) T.push('## Screens → browser specs', '', table(['Wireframe', 'Frames', 'Specs that cover it'], S.wireframes.map(w => [w.file, String(w.frames.length), S.uiSpecs.filter(u => u.covers.join(' ').includes(w.file.replace('.html', '')) || u.observes.some(o => w.file.startsWith(o.split('-')[0]))).map(u => '`' + u.file + '`').join(', ') || '—'])), '');
  files['01-traceability.md'] = T.join('\n');
  // 02 procedures
  const P = ['# Procedures', '', BANNER('Every oracle case: its origin in the spec, its steps and what each must answer.'), '', '[← Plan](README.md)', ''];
  const suites = new Map();
  for (const c of S.cases) { if (!suites.has(c.suite)) suites.set(c.suite, { desc: c.suiteDescription || '', cases: [] }); suites.get(c.suite).cases.push(c); }
  P.push(table(['Suite', 'Cases', 'Description'], [...suites.entries()].map(([s, v]) => [`[${s}](#${slug('suite ' + s)})`, String(v.cases.length), clip(v.desc, 200)])), '');
  for (const [s, v] of suites) {
    P.push(`## Suite ${s}`, '');
    if (v.desc) P.push(esc(v.desc), '');
    for (const c of v.cases) {
      P.push(`### ${c.id} — ${esc(c.title || '')}`, '', `Phase ${c.phase || '—'}${c.probe ? ' · probe (profile-generic)' : ''} · latest: **${caseStatus(S, c.id)}**`, '');
      if (c.derivedFrom && c.derivedFrom.length) P.push('Derived from: ' + c.derivedFrom.map(d => '`' + esc(d) + '`').join(', '), '');
      const steps = (c.steps || []).map((st, i) => {
        if (st.http) { const q = st.http.query ? '?' + Object.entries(st.http.query).map(([k, vv]) => `${k}=${vv}`).join('&') : ''; const ex = st.expect || {}; const code = ex.body && ex.body.code ? ` \`${ex.body.code}\`` : ''; return [String(i + 1), `${st.http.method} \`${st.http.path}${q}\`${st.http.body !== undefined ? ' + body' : ''}`, `${ex.status || '—'}${code}${ex.bodyMatch ? ' (partial match)' : ''}${st.capture ? ' · captures ' + Object.keys(st.capture).map(k => '`' + k + '`').join(', ') : ''}`]; }
        if (st.parallel) return [String(i + 1), `parallel: ${st.parallel.length} request(s)`, (st.expect && st.expect.responses) ? `${st.expect.responses.length} response(s) expected` : '—'];
        if (st.query) return [String(i + 1), `SQL query`, st.expect ? 'rows as expected' : '—'];
        if (st.run) return [String(i + 1), `run \`${clip(JSON.stringify(st.run), 80)}\``, st.expect ? `exit ${st.expect.exitCode !== undefined ? st.expect.exitCode : '—'}` : '—'];
        return [String(i + 1), clip(JSON.stringify(st), 80), '—'];
      });
      P.push(table(['Step', 'Request', 'Expect'], steps), '');
    }
  }
  files['02-procedures.md'] = P.join('\n');
  // 03 ui
  const U = ['# UI procedures', '', BANNER('The frozen browser specs under `specs/fixtures/ui`: one table per file, with the spec references each cites and the screen states it observes.'), '', '[← Plan](README.md)', ''];
  if (!S.uiSpecs.length) U.push('_No browser specs yet (Stage 04 writes them from the captured wireframes)._', '');
  for (const u of S.uiSpecs) {
    const r = S.uiRun && S.uiRun.suites ? S.uiRun.suites.find(x => String(x.file || '').endsWith(u.file)) : null;
    U.push(`## ${u.file}${u.generated ? ' (generated)' : ''}`, '');
    if (u.covers.length) U.push('Covers: ' + u.covers.map(x => '`' + x + '`').join('; '), '');
    U.push(table(['#', 'Test', 'Observes'], u.tests.map((t, i) => [String(i + 1), t, ''])), '');
    if (u.observes.length) U.push('Screen states observed (diff-ui): ' + u.observes.map(x => '`' + x + '`').join(', '), '');
    if (r) U.push(`Latest browser run: ${r.specs ? r.specs.length + ' spec(s)' : 'recorded'} in \`specs/logs/ui-e2e.json\`.`, '');
  }
  files['03-ui-procedures.md'] = U.join('\n');
  // 04 schedule
  const Sch = ['# Schedule', '', BANNER('IMPLEMENTATION_PHASES.md with the cases bound to each phase and their latest result.'), '', '[← Plan](README.md)', ''];
  Sch.push(table(['Phase', 'Title', 'Tasks done', 'Verification', 'Cases', 'Latest'], phases.map(ph => { const cs = casesByPhase(ph.n); const s = stat(cs); return [String(ph.n), ph.title, `${ph.done}/${ph.tasks}`, ph.verification || '—', String(cs.length), cs.length ? (s.fail ? `✗ ${s.fail} failing` : s.notRun === cs.length ? 'not run' : `✓ ${s.pass}/${cs.length}`) : '—']; })), '');
  const unbound = S.cases.filter(c => !phases.some(ph => ph.n === c.phase));
  if (unbound.length) Sch.push(`${unbound.length} case(s) bind to no listed phase: ${unbound.slice(0, 12).map(c => '`' + c.id + '`').join(', ')}${unbound.length > 12 ? ', …' : ''}.`, '');
  files['04-schedule.md'] = Sch.join('\n');
  // 05 results
  const Re = ['# Results', '', BANNER('The latest oracle run report and the history of runs under `specs/logs/oracle/`.'), '', '[← Plan](README.md)', ''];
  if (run) {
    Re.push('## Latest run', '', table(['Item', 'Value'], [['Report', `\`specs/logs/oracle/${run.file}\``], ['Finished', String(run.finishedAt)], ['Target', `\`${run.target}\` (${run.baseUrl || '—'})`], ['Result', `${run.passed}/${run.total} passed, ${run.failed || 0} failed, ${run.errored || 0} errored`], ['Lock binding', onLock ? `current lock v${S.lock.lockVersion}: evidence` : `lock ${run.lockVersion ? 'v' + run.lockVersion : '—'} \`${String(run.lockHash || '').slice(0, 12)}\`: ${S.lock ? 'not the current lock, not evidence' : 'no lock'}`], ['Mode', `${run.mode || '—'}${run.filtered ? ' (filtered: ' + JSON.stringify(run.filters) + ')' : ''}`], ['Tool', `${run.tool || 'oracle.cjs'} ${run.toolVersion || ''}`]]), '');
    const failures = (run.results || []).filter(r => r.status !== 'pass');
    if (failures.length) Re.push(`## Failures (${failures.length})`, '', table(['Case', 'Title', 'Status', 'Failures'], failures.map(r => [`\`${r.id}\``, clip(r.title || '', 100), r.status, clip((r.failures || []).map(f => typeof f === 'string' ? f : f.message || JSON.stringify(f)).join(' · '), 300)])), '');
    else Re.push('## Failures', '', 'None.', '');
  } else Re.push('No oracle run recorded yet.', '');
  if (S.runs.length) Re.push('## Run history', '', table(['Finished', 'Target', 'Passed', 'Lock', 'Report'], [...S.runs].reverse().map(r => [String(r.finishedAt).slice(0, 16).replace('T', ' '), r.target || '—', `${r.passed}/${r.total}`, r.lockHash ? `v${r.lockVersion || '?'} \`${String(r.lockHash).slice(0, 8)}\`${S.lock && r.lockHash === S.lock.hash ? ' (current)' : ''}` : '—', `\`${r.file}\``])), '');
  if (S.uiRun && S.uiRun.stats) Re.push('## Browser specs', '', table(['Item', 'Value'], [['Started', String(S.uiRun.startTime || '—')], ['Expected (passed)', String(S.uiRun.stats.expected)], ['Unexpected (failed)', String(S.uiRun.stats.unexpected)], ['Flaky', String(S.uiRun.stats.flaky)], ['Skipped', String(S.uiRun.stats.skipped)]]), '');
  files['05-results.md'] = Re.join('\n');
  return files;
}

// ---------------------------------------------------------------- baseline, write, check
function baseline(S, key) {
  const inputs = {};
  for (const f of [...S.inputs].sort()) { const fp = path.join(S.root, f); if (exists(fp)) inputs[f] = sha(fs.readFileSync(fp)).slice(0, 16); }
  return { deliverable: key, generatedAt: new Date().toISOString(), pipeline: S.pipeline, commit: S.commit, lock: S.lock ? { version: S.lock.lockVersion, hash: S.lock.hash } : null, inputs };
}
function build(S, keys, outDir, write) {
  const builders = { api: buildApi, manual: buildManual, 'test-plan': buildTestPlan };
  for (const key of keys) {
    const files = builders[key](S);
    const dir = path.join(outDir, DELIVERABLES[key].dir);
    const names = Object.keys(files);
    let changed = 0;
    for (const [name, text] of Object.entries(files)) {
      const fp = path.join(dir, name);
      const cur = exists(fp) ? readText(fp) : null;
      if (cur !== text + '\n' && cur !== text) changed++;
      if (write) { fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, text.endsWith('\n') ? text : text + '\n'); }
    }
    if (write) {
      for (const f of exists(dir) ? fs.readdirSync(dir) : []) if (f.endsWith('.md') && !names.includes(f)) fs.unlinkSync(path.join(dir, f)); // files from an earlier spec shape
      fs.writeFileSync(path.join(dir, 'baseline.json'), JSON.stringify(baseline(S, key), null, 1) + '\n');
    }
    const bytes = Object.values(files).reduce((a, t) => a + t.length, 0);
    console.log(`${write ? 'Wrote' : 'Would write'} ${rel(S.root, dir)}/: ${names.length} file(s), ${(bytes / 1024).toFixed(0)} KB, ${changed} changed${write ? '' : ' (add --write)'}`);
  }
}
function check(S, outDir) {
  let stale = 0;
  for (const [key, d] of Object.entries(DELIVERABLES)) {
    const bp = path.join(outDir, d.dir, 'baseline.json');
    if (!exists(bp)) { console.log(`· ${d.dir}: not built (deliver.cjs build ${key} --write)`); continue; }
    const b = readJsonSafe(bp) || {};
    const now = baseline(S, key);
    const reasons = [];
    if ((b.lock && b.lock.hash) !== (now.lock && now.lock.hash)) reasons.push(`lock ${b.lock ? 'v' + b.lock.version : 'none'} → ${now.lock ? 'v' + now.lock.version : 'none'}`);
    const changed = Object.keys(now.inputs).filter(f => b.inputs && b.inputs[f] && b.inputs[f] !== now.inputs[f]);
    const added = Object.keys(now.inputs).filter(f => !(b.inputs && b.inputs[f]));
    const removed = Object.keys(b.inputs || {}).filter(f => !now.inputs[f]);
    if (changed.length) reasons.push(`${changed.length} input(s) changed: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ', …' : ''}`);
    if (added.length) reasons.push(`${added.length} input(s) new`);
    if (removed.length) reasons.push(`${removed.length} input(s) gone`);
    if (b.pipeline !== now.pipeline) reasons.push(`pipeline ${b.pipeline} → ${now.pipeline}`);
    if (reasons.length) { stale++; console.log(`✗ ${d.dir}: stale since ${String(b.generatedAt).slice(0, 16).replace('T', ' ')} — ${reasons.join('; ')}`); }
    else console.log(`✓ ${d.dir}: current (generated ${String(b.generatedAt).slice(0, 16).replace('T', ' ')}${b.lock ? `, lock v${b.lock.version}` : ', no lock'})`);
  }
  return stale ? 1 : 0;
}

// ---------------------------------------------------------------- markdown → HTML (single page per deliverable)
function inlineHtml(s, fileSlug, files) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(`<code>${c.replace(/[&<>]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))}</code>`); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/[&<>]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]));
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => {
    if (/^(https?:)?\/\//.test(url) || url.startsWith('../')) return `<a href="${url}">${label}</a>`;
    const [file, frag] = url.split('#');
    if (file && files.includes(file)) return `<a href="#${slug(file.replace(/\.md$/, ''))}${frag ? '--' + frag : ''}">${label}</a>`;
    if (!file && frag) return `<a href="#${fileSlug}--${frag}">${label}</a>`;
    return `<a href="${url}">${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>').replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => codes[+i]);
}
function mdToHtml(md, fileSlug, files) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  const listStack = [];
  const closeLists = (toDepth = 0) => { while (listStack.length > toDepth) out.push(`</li></${listStack.pop()}>`); };
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*```/.test(l)) { closeLists(); const lang = l.trim().slice(3).trim(); const buf = []; i++; while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre class="lang-${lang || 'text'}"><code>${buf.join('\n').replace(/[&<>]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))}</code></pre>`); continue; }
    const h = l.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h) { closeLists(); const lvl = h[1].length; const id = `${fileSlug}--${slug(h[2])}`; out.push(`<h${lvl} id="${id}">${inlineHtml(h[2], fileSlug, files)}</h${lvl}>`); i++; continue; }
    if (/^\s*\|/.test(l)) { closeLists(); const buf = []; while (i < lines.length && /^\s*\|/.test(lines[i])) buf.push(lines[i++]); const t = parseTable(buf.join('\n')); if (t) out.push(`<table class="c${t.header.length}"><thead><tr>${t.header.map(c => `<th>${inlineHtml(c, fileSlug, files)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${t.header.map((_, k) => `<td>${inlineHtml(r[k] || '', fileSlug, files)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; }
    if (/^\s*>/.test(l)) { closeLists(); const buf = []; while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, '')); out.push(`<blockquote>${inlineHtml(buf.join(' '), fileSlug, files)}</blockquote>`); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { closeLists(); out.push('<hr>'); i++; continue; }
    const li = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const depth = Math.floor(li[1].replace(/\t/g, '  ').length / 2) + 1; const tag = /\d/.test(li[2]) ? 'ol' : 'ul';
      while (listStack.length > depth) out.push(`</li></${listStack.pop()}>`);
      if (listStack.length === depth) out.push('</li>');
      while (listStack.length < depth) { out.push(`<${tag}>`); listStack.push(tag); if (listStack.length < depth) out.push('<li>'); }
      out.push(`<li>${inlineHtml(li[3], fileSlug, files)}`);
      i++;
      // continuation lines (indented paragraphs / tables under a list item)
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i])) { if (/^\s*\|/.test(lines[i])) { const buf = []; while (i < lines.length && /^\s*\|/.test(lines[i])) buf.push(lines[i++]); const t = parseTable(buf.join('\n')); if (t) out.push(`<table class="c${t.header.length}"><thead><tr>${t.header.map(c => `<th>${inlineHtml(c, fileSlug, files)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${t.header.map((_, k) => `<td>${inlineHtml(r[k] || '', fileSlug, files)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); } else out.push(`<p>${inlineHtml(lines[i++].trim(), fileSlug, files)}</p>`); }
      continue;
    }
    if (/^\s*<(iframe|div|span|br|img)/.test(l)) { closeLists(); out.push(l.trim()); i++; continue; }
    if (!l.trim()) { if (listStack.length && i + 1 < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i + 1])) { i++; continue; } closeLists(); i++; continue; }
    closeLists();
    const buf = [l]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|\s*\||\s*>|\s*([-*]|\d+\.)\s|\s*<(iframe|div))/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inlineHtml(buf.join(' '), fileSlug, files)}</p>`);
  }
  closeLists();
  return out.join('\n');
}
function compile(S, keys, outDir) {
  for (const key of keys) {
    const d = DELIVERABLES[key];
    const dir = path.join(outDir, d.dir);
    if (!exists(path.join(dir, 'README.md'))) { console.log(`· ${d.dir}: not built yet (deliver.cjs build ${key} --write)`); continue; }
    const files = ['README.md', ...fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md').sort()];
    const b = readJsonSafe(path.join(dir, 'baseline.json')) || {};
    const sections = files.map(f => { const md = readText(path.join(dir, f)); const title = (md.match(/^#\s+(.+)$/m) || [, f])[1]; return { f, s: slug(f.replace(/\.md$/, '')), title, html: mdToHtml(md.replace(/^#\s+.+\n/, ''), slug(f.replace(/\.md$/, '')), files) }; });
    const toc = sections.map(x => `<li><a href="#${x.s}">${inlineHtml(x.title, '', [])}</a></li>`).join('');
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${inlineHtml(sections[0].title, '', [])}</title>
<style>
:root{color-scheme:light;--bg:#f3f3f0;--card:#fcfcfb;--text:#0b0b0b;--text2:#52514e;--muted:#7b7a75;--line:#e2e1dc;--line2:#edece8;--accent:#2a78d6;--accent-soft:#d8e5f7}
@media (prefers-color-scheme: dark){:root:where(:not([data-theme="light"])){color-scheme:dark;--bg:#121211;--card:#1a1a19;--text:#f0efec;--text2:#c3c2b7;--muted:#8f8e87;--line:#2e2e2b;--line2:#262624;--accent:#3987e5;--accent-soft:#1f3b5e}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#121211;--card:#1a1a19;--text:#f0efec;--text2:#c3c2b7;--muted:#8f8e87;--line:#2e2e2b;--line2:#262624;--accent:#3987e5;--accent-soft:#1f3b5e}
*{box-sizing:border-box;min-width:0}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}
.layout{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh}nav{position:sticky;top:0;height:100vh;overflow:auto;padding:20px 16px;border-right:1px solid var(--line);background:var(--card);font-size:.9rem}nav ol{list-style:none;padding:0;margin:0}nav li{margin:4px 0}nav a{color:var(--text2);text-decoration:none}nav a:hover{color:var(--accent)}nav .meta{color:var(--muted);font-size:.8rem;margin-top:14px}
main{padding:28px 40px 80px;max-width:1100px}@media (max-width:900px){.layout{grid-template-columns:1fr}nav{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}main{padding:20px 16px}}
h1{font-size:1.6rem;margin:0 0 14px}section.chapter{margin-top:36px;padding-top:24px;border-top:2px solid var(--line)}section.chapter>h1{font-size:1.35rem}h2{font-size:1.12rem;margin:28px 0 10px}h3{font-size:1rem;margin:22px 0 8px}h4{font-size:.95rem;margin:16px 0 6px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.85em;background:var(--line2);padding:0 4px;border-radius:4px}pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 14px;overflow:auto;font-size:.82rem;line-height:1.45}pre code{background:none;padding:0}
table{width:100%;border-collapse:collapse;font-size:.88rem;margin:8px 0 14px;table-layout:fixed}table.c2,table.c3,table.c4,table.c5,table.c6{table-layout:auto}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line2);vertical-align:top}th{color:var(--muted);font-weight:600;font-size:.8rem}
blockquote{margin:0 0 16px;padding:8px 14px;border-left:4px solid var(--accent);background:var(--accent-soft);border-radius:0 8px 8px 0;font-size:.9rem}hr{border:0;border-top:1px dashed var(--line);margin:22px 0}
a{color:var(--accent)}iframe.wireframe{width:100%;height:620px;border:1px solid var(--line);border-radius:8px;background:#fff;margin:6px 0 14px}ul,ol{padding-left:22px}li{margin:2px 0}
</style></head><body><div class="layout"><nav><strong>${inlineHtml(d.title, '', [])}</strong><ol>${toc}</ol><div class="meta">${b.lock ? `lock v${b.lock.version} · ` : 'no lock · '}${b.pipeline || ''}<br>generated ${String(b.generatedAt || '').slice(0, 16).replace('T', ' ')}<br>regenerate: <code>node deliver.cjs build ${key} --write &amp;&amp; node deliver.cjs compile ${key}</code></div></nav><main>
${sections.map((x, k) => `<section class="chapter" id="${x.s}"${k === 0 ? ' style="margin-top:0;border:0;padding-top:0"' : ''}><h1>${inlineHtml(x.title, '', [])}</h1>${x.html}</section>`).join('\n')}
</main></div></body></html>
`;
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    console.log(`Wrote ${rel(S.root, path.join(dir, 'index.html'))} (${(html.length / 1024).toFixed(0)} KB, ${sections.length} chapter(s))`);
  }
}

// ---------------------------------------------------------------- main
function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || !['build', 'compile', 'check'].includes(cmd)) { console.log(fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, '')); return cmd ? 2 : 0; }
  const root = typeof args.flags.root === 'string' ? path.resolve(args.flags.root) : findRoot(process.cwd());
  if (!root) { console.error('No SDD workspace found (specs/.sdd/scripts/sdd-lib.cjs): pass --root'); return 2; }
  const outDir = path.resolve(root, typeof args.flags.out === 'string' ? args.flags.out : 'docs');
  const which = args._[1] && args._[1] !== 'all' ? [args._[1]] : Object.keys(DELIVERABLES);
  if (which.some(k => !DELIVERABLES[k])) { console.error(`unknown deliverable ${args._[1]} (api | manual | test-plan | all)`); return 2; }
  const libPath = findLib(root, typeof args.flags.lib === 'string' ? args.flags.lib : null);
  if (!libPath) { console.error('No specs/.sdd/scripts/sdd-lib.cjs found in the project or above it: pass --lib <path>'); return 2; }
  const S = loadSpecSet(root, libPath);
  if (S.openapiError) console.log(`⚠ openapi.yaml did not parse: ${S.openapiError} (the API reference will be empty)`);
  if (cmd === 'build') { build(S, which, outDir, !!args.flags.write); return 0; }
  if (cmd === 'compile') { compile(S, which, outDir); return 0; }
  return check(S, outDir);
}
process.exitCode = main();
