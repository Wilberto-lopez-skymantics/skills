#!/usr/bin/env node
'use strict';
/**
 * uxq: the mechanical half of the ux-quality-score skill. Zero dependencies (Node >= 18).
 *
 * Six kinds of reviewer each look at a journey through their own rubric and return a score from 0 to
 * 100 with the reason for it and the issues behind it: five specialists (accessibility, visual design,
 * interaction, content, responsive design) and the person the journey is for. A config may name another
 * set of specialists with "rubric_set" (see useRubricSet); the person is in every set. The script owns
 * everything that must not depend on anyone's opinion: what each reviewer is shown, the prompt a
 * reviewer is given, whether a result follows the rules, whether a score agrees with its own issues,
 * how scores combine, and what goes in the ledger.
 *
 *   node uxq.cjs new-run  --config <config.json> [--confirm] [--commit <sha>] [--date YYYY-MM-DD]   --confirm: `judges` per role and the control units
 *   node uxq.cjs bundle   --config <config.json> --run <run-dir> [--unit <id>] [--role <role>] [--judges N] [--tmp <dir>] [--allow-missing]
 *   node uxq.cjs collect  --config <config.json> --run <run-dir> [--discard-bad]
 *   node uxq.cjs challenge --config <config.json> --run <run-dir> [--unit <id>] [--tmp <dir>]       a second look at each major or blocker only one reviewer reported
 *   node uxq.cjs score    --config <config.json> --run <run-dir> [--no-ledger] [--rescore]
 *   node uxq.cjs regress  --config <config.json> --run <run-dir> [--against <run-dir>] [--unit <id>] what the capture measured worse than in the earlier run
 *   node uxq.cjs status   --config <config.json> --run <run-dir> [--unit <id>]     where a run stands, what to do next
 *   node uxq.cjs progress --config <config.json> --target <N>                      where each journey stands against the user's target
 *   node uxq.cjs trend    --config <config.json>
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
// The reviewer set in use: where its rubrics and briefs are, its roles, and what each specialist is
// handed. These start as the set this skill ships and change only in useRubricSet, before anything is
// read, when the config names a set of its own.
const DEFAULT_JUDGE_DIR = path.join(SKILL_DIR, 'judge');
let JUDGE_DIR = DEFAULT_JUDGE_DIR;
let ROLES = ['accessibility', 'visual', 'interaction', 'content', 'responsive', 'user'];
let SPECIALISTS = ROLES.filter((r) => r !== 'user');
let RUBRIC_SET = null;
const SEVERITIES = ['blocker', 'major', 'minor', 'polish'];
const SEVERITY_WEIGHT = { blocker: 8, major: 4, minor: 2, polish: 1 };
// A score must agree with the issues its reviewer recorded: a blocker means 24 or less, a major 74 or
// less. A score above that is counted at the ceiling, and the scorecard says so.
const CAP = { blocker: 24, major: 74, minor: 100, polish: 100 };
// A person who did not get it done reported a blocker; one not sure it worked, a major.
const FINISHED_CAP = { sure: 100, unsure: 74, no: 24 };
const OUTCOMES = ['smooth', 'hesitated', 'struggled', 'gave_up'];
// A person never names a severity: it follows from how the step went for them.
const OUTCOME_SEVERITY = { smooth: 'polish', hesitated: 'minor', struggled: 'major', gave_up: 'blocker' };
// Below this score a reviewer must record at least one issue: every point lost is something to fix.
const ISSUE_BELOW = 100;
// Reviewers of one role disagree when their scores are this far apart (see disagree()).
const CONTESTED_SPREAD = 25;
const STALL_GAIN = 2;
const DEFAULT_JUDGES = 2;
const DEFAULT_CONTROL_THRESHOLD = 0.67;
const DEFAULT_FALSE_ALARM_THRESHOLD = 0.34;
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
const ID_RE = /^[a-z0-9][a-z0-9_-]*$/;
const BRIEF_FILES = ['reviewer-brief.md', 'user-brief.md', 'check-brief.md'];
// What a specialist is handed: the screenshots, the page text, the measured facts, and of the rest
// (the keyboard walk, the states of controls, the motion, the frames of a change) only the kinds its
// rubric asks about. The target user is handed the screenshots alone, as a person would be.
const EVIDENCE_ALL = ['screens', 'pages', 'facts', 'keyboard', 'states', 'motion', 'frames'];
let EVIDENCE_KINDS = {
  accessibility: ['screens', 'pages', 'facts', 'keyboard', 'motion', 'states'],
  visual: ['screens', 'pages', 'facts', 'states', 'frames', 'motion'],
  interaction: ['screens', 'pages', 'facts', 'keyboard', 'motion', 'states', 'frames'],
  content: ['screens', 'pages', 'facts'],
  responsive: ['screens', 'pages', 'facts']
};
// A second look at one issue says whether it holds and how serious it is ("none" when it does not hold).
const HOLDS = ['yes', 'partly', 'no'];
// When a second look lowers or removes a reviewer's most serious issue, that reviewer's score is counted
// at no less than the anchor for what still stands (see reviewerResult).
const REBASE = { nothing_or_polish: 90, one_minor: 86, two_or_three_minors: 80, four_or_more_minors: 75, major: 50 };
// The arithmetic is part of the yardstick: a run scored under other rules is not comparable. Changing a
// constant here changes the rubric hash by itself; raise `rules` when a formula changes without one.
const scoringRules = () => JSON.stringify({ rules: 8, CAP, FINISHED_CAP, OUTCOME_SEVERITY, ISSUE_BELOW, CONTESTED_SPREAD, EVIDENCE_KINDS, REBASE, combine: 'per role: mean of counted scores; with config.combine "floor", held to the lowest ceiling any reviewer of the role set; journey = mean of its roles', second_look: 'a major or blocker one reviewer alone reported may be checked; a verdict keeps or lowers it, never raises it' });
const COMBINES = ['mean', 'floor'];
// Grouping issues that describe the same problem (fix order only, never a score).
const ALIKE = { same_check_and_step: 0.2, same_step: 0.3, elsewhere: 0.45 };
// The only words a reviewer ever receives from the caller. Nothing may be added to it.
const spawnPrompt = (dir) => `Open the folder ${dir} and read README.md there. Do exactly what it asks, using only the files in that folder.`;

function fail(msg) { console.error(`uxq: ${msg}`); process.exit(1); }
function sha(text, n = 12) { return crypto.createHash('sha256').update(text).digest('hex').slice(0, n); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); }
function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }
function round(n, d = 1) { const f = 10 ** d; return Math.round(n * f) / f; }
function pad(n) { return String(n).padStart(2, '0'); }
// A set brings its own rubrics; a brief it does not bring is this skill's.
function readJudgeFile(name) {
  const own = path.join(JUDGE_DIR, name);
  return fs.readFileSync(fs.existsSync(own) ? own : path.join(DEFAULT_JUDGE_DIR, name), 'utf8');
}
const mean = (list) => (list.length ? round(list.reduce((a, b) => a + b, 0) / list.length) : null);
const notNull = (x) => x !== null && x !== undefined;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { args._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}
const opt = (args, key) => (args[key] && args[key] !== true ? String(args[key]) : null);

// ---------------------------------------------------------------- rubrics
// A config may name a reviewer set of its own with "rubric_set": a folder, relative to the config, that
// holds set.json, one rubric per role under roles/, and any of the three briefs it words differently.
// set.json names the set and maps each specialist role to the kinds of evidence it is handed:
//   { "name": "landing-page", "specialists": { "conversion": ["screens", "pages", "facts"], ... } }
// The role "user" is in every set: the person the journey is for, who walks it one screen at a time
// (roles/user.md). Everything else (what a result must hold, how scores combine) is the same for any set.
function useRubricSet(configPath) {
  if (!configPath || configPath === true) return;
  const file = path.resolve(configPath);
  let config;
  try { config = readJson(file); } catch (_) { return; } // loadConfig reports a config that cannot be read
  if (config.rubric_set === undefined) return;
  if (typeof config.rubric_set !== 'string' || !config.rubric_set.trim()) fail('rubric_set: must be the path of a folder, relative to the config');
  const dir = path.resolve(path.dirname(file), config.rubric_set);
  const setFile = path.join(dir, 'set.json');
  if (!fs.existsSync(setFile)) fail(`rubric_set: ${dir} has no set.json`);
  let set;
  try { set = readJson(setFile); } catch (e) { fail(`rubric_set: ${setFile} is not valid JSON: ${e.message}`); }
  const problems = [];
  if (typeof set.name !== 'string' || !ID_RE.test(set.name)) problems.push('"name" must be lowercase letters, digits, "-" or "_"');
  const specialists = set.specialists && typeof set.specialists === 'object' && !Array.isArray(set.specialists) ? set.specialists : {};
  if (!Object.keys(specialists).length) problems.push('"specialists" must map each specialist role to the kinds of evidence it is handed');
  for (const [role, kinds] of Object.entries(specialists)) {
    if (!/^[a-z]+$/.test(role) || role === 'user') { problems.push(`a specialist role is named in lowercase letters, and "user" is the person every set has: ${role}`); continue; }
    if (!Array.isArray(kinds) || !kinds.includes('screens') || kinds.some((k) => !EVIDENCE_ALL.includes(k))) problems.push(`${role}: its evidence must include "screens" and name only ${EVIDENCE_ALL.join(', ')}`);
    if (!fs.existsSync(path.join(dir, 'roles', `${role}.md`))) problems.push(`roles/${role}.md is missing`);
  }
  if (!fs.existsSync(path.join(dir, 'roles', 'user.md'))) problems.push('roles/user.md is missing');
  if (problems.length) fail(`rubric_set ${dir} is invalid:\n  - ${problems.join('\n  - ')}`);
  JUDGE_DIR = dir;
  ROLES = [...Object.keys(specialists), 'user'];
  SPECIALISTS = Object.keys(specialists);
  EVIDENCE_KINDS = specialists;
  RUBRIC_SET = set.name;
}

// One rubric per role, under roles/ of the set in use. A rubric opens with "# <title>", carries a
// "Rubric version:" line (the same in every rubric of the set), and lists its criteria as "- **ID** text".
// Called with the config's path, so that a config naming its own set is read against that set.
function loadRubric(configPath) {
  useRubricSet(configPath);
  const roles = {};
  for (const role of ROLES) {
    const file = path.join(JUDGE_DIR, 'roles', `${role}.md`);
    const text = fs.readFileSync(file, 'utf8');
    const version = (text.match(/^Rubric version:\s*(\S+)/m) || [])[1];
    if (!version) fail(`roles/${role}.md has no "Rubric version:" line`);
    const title = ((text.match(/^# (.+)$/m) || [])[1] || role).trim();
    const criteria = [...text.matchAll(/^- \*\*([A-Z][0-9]+)\*\* (.+)$/gm)].map((m) => ({ id: m[1], text: m[2].trim() }));
    if (!criteria.length) fail(`roles/${role}.md lists no criteria`);
    if (new Set(criteria.map((c) => c.id)).size !== criteria.length) fail(`roles/${role}.md: criterion ids must be unique`);
    roles[role] = { role, title, version, criteria, ids: criteria.map((c) => c.id), file };
  }
  const versions = [...new Set(ROLES.map((r) => roles[r].version))];
  if (versions.length !== 1) fail(`every rubric under ${path.join(JUDGE_DIR, 'roles')} must carry the same rubric version (found ${versions.join(', ')})`);
  const measured = [...ROLES.map((r) => path.join('roles', `${r}.md`)), ...BRIEF_FILES].map((f) => `${f}\n${readJudgeFile(f).replace(/\r\n/g, '\n')}`).join('\n');
  return { version: versions[0], sha: sha(`${measured}\nscoring\n${scoringRules()}`), roles, set: RUBRIC_SET };
}

// ---------------------------------------------------------------- config
function loadConfig(configPath, rubric) {
  if (!configPath || configPath === true) fail('--config <config.json> is required');
  const file = path.resolve(configPath);
  if (!fs.existsSync(file)) fail(`config not found: ${file}`);
  const config = readJson(file);
  const home = path.dirname(file);
  const problems = [];
  if (!config.app || !config.app.name || !config.app.description) problems.push('app.name and app.description are required');
  const viewports = config.viewports || [];
  if (!viewports.length) problems.push('at least one viewport is required');
  for (const v of viewports) if (!ID_RE.test(v.id || '') || !v.width || !v.height) problems.push(`viewport needs id, width, height: ${JSON.stringify(v)}`);
  const hasViewport = (id) => viewports.some((v) => v.id === id);
  const personas = new Map((config.personas || []).map((p) => [p.id, p]));
  for (const p of personas.values()) if (p.viewport && !hasViewport(p.viewport)) problems.push(`persona ${p.id}: unknown viewport ${p.viewport}`);
  const units = config.units || [];
  if (!units.length) problems.push('at least one unit is required');
  const roleList = (list) => Array.isArray(list) && list.length > 0 && list.every((r) => ROLES.includes(r));

  const unitViewports = (u) => (u.viewports || viewports.map((v) => v.id)).map((id) => viewports.find((v) => v.id === id)).filter(Boolean);
  const stepsFor = (u, role) => (u.steps || []).filter((s) => !s.roles || s.roles.includes(role));
  const unitRoles = (u) => (u.roles || ROLES).filter((r) => stepsFor(u, r).length > 0);
  const userViewport = (u) => {
    const persona = personas.get(u.persona) || {};
    const own = unitViewports(u);
    const id = u.user_viewport || (persona.viewport && own.some((v) => v.id === persona.viewport) ? persona.viewport : (own[0] || {}).id);
    return viewports.find((v) => v.id === id);
  };

  const seen = new Set();
  for (const u of units) {
    if (!ID_RE.test(u.id || '')) problems.push(`unit id must be lowercase letters, digits, "-" or "_": ${u.id}`);
    if (seen.has(u.id)) problems.push(`duplicate unit id: ${u.id}`);
    seen.add(u.id);
    if (!personas.has(u.persona)) problems.push(`unit ${u.id}: unknown persona ${u.persona}`);
    if (!u.goal) problems.push(`unit ${u.id}: goal is required`);
    if (!Array.isArray(u.steps) || !u.steps.length) { problems.push(`unit ${u.id}: at least one step is required`); continue; }
    if (u.roles !== undefined && !roleList(u.roles)) problems.push(`unit ${u.id}: roles must list some of ${ROLES.join(', ')}`);
    for (const s of u.steps) {
      if (!ID_RE.test(s.id || '') || !s.do) problems.push(`unit ${u.id}: each step needs an id (no dots) and "do"`);
      if (s.roles !== undefined && !roleList(s.roles)) problems.push(`unit ${u.id} step ${s.id}: roles must list some of ${ROLES.join(', ')}`);
    }
    for (const v of u.viewports || []) if (!hasViewport(v)) problems.push(`unit ${u.id}: unknown viewport ${v}`);
    if (u.user_viewport && !unitViewports(u).some((v) => v.id === u.user_viewport)) problems.push(`unit ${u.id}: user_viewport must be one of the unit's viewports`);
    for (const key of ['planted', 'clean']) if (u[key] && !u.control) problems.push(`unit ${u.id}: "${key}" is only allowed on a control unit`);
    if (u.control) {
      if (!Array.isArray(u.planted) || !u.planted.length) problems.push(`control unit ${u.id}: "planted" must list at least one planted defect`);
      if (u.clean !== undefined && !Array.isArray(u.clean)) problems.push(`control unit ${u.id}: "clean" must be a list`);
      // A control entry names a role and where that role's reviewers should (planted) or should not
      // (clean) report an issue: a criterion of that role's rubric, a step, or both.
      const key = (e) => `${e.role}|${e.criterion || '*'}|${e.step || '*'}`;
      const planted = new Set((u.planted || []).map(key));
      for (const [kind, list] of [['planted', u.planted || []], ['clean', Array.isArray(u.clean) ? u.clean : []]]) {
        for (const e of list) {
          const where = `control unit ${u.id}: ${kind} entry ${e.id || JSON.stringify(e)}`;
          if (!unitRoles(u).includes(e.role)) { problems.push(`${where} needs a "role" the unit is reviewed by`); continue; }
          if (!e.criterion && !e.step) problems.push(`${where} needs a "criterion", a "step" or both`);
          if (e.criterion && !rubric.roles[e.role].ids.includes(e.criterion)) problems.push(`${where}: ${e.criterion} is not a criterion of the ${e.role} rubric`);
          if (e.step && !stepsFor(u, e.role).some((s) => s.id === e.step)) problems.push(`${where}: step ${e.step} is not one the ${e.role} reviewers see`);
          if (kind === 'clean' && planted.has(key(e))) problems.push(`${where} cannot be both planted and clean`);
        }
      }
    }
  }
  for (const key of ['judges', 'screening_judges']) {
    if (config[key] !== undefined && typeof config[key] !== 'number') {
      if (typeof config[key] !== 'object' || Array.isArray(config[key])) problems.push(`${key}: a number, or an object of numbers by role`);
      else for (const r of Object.keys(config[key])) if (!ROLES.includes(r)) problems.push(`${key}: unknown role ${r}`);
    }
  }
  if (config.combine !== undefined && !COMBINES.includes(config.combine)) problems.push(`combine: one of ${COMBINES.join(', ')}`);
  if (config.reviewer_model !== undefined && !(typeof config.reviewer_model === 'string' && config.reviewer_model.trim())) problems.push('reviewer_model: must be the name of a model to start reviewers with');
  // The project's recorded design decisions, handed to every specialist so that a choice the project
  // made on purpose is not reported as an issue. Not part of the config hash: the file grows by appending.
  const decisionsFile = typeof config.decisions === 'string' && config.decisions.trim() ? path.resolve(home, config.decisions) : null;
  if (config.decisions !== undefined && !(decisionsFile && fs.existsSync(decisionsFile) && fs.statSync(decisionsFile).isFile())) problems.push('decisions: must be the path of a file that exists, relative to the config');
  if (problems.length) fail(`config is invalid:\n  - ${problems.join('\n  - ')}`);
  // Which model plays the reviewers is part of the measurement. Unset means whatever the session uses.
  const reviewerModel = config.reviewer_model ? config.reviewer_model.trim() : null;

  const judges = {};
  for (const r of ROLES) judges[r] = typeof config.judges === 'number' ? config.judges : ((config.judges || {})[r] || DEFAULT_JUDGES);
  // Screening runs (the default) start this many reviewers per role; a confirming run (new-run --confirm)
  // starts `judges`. Unset, both are the same, so a config without it behaves as before.
  const screening = {};
  for (const r of ROLES) screening[r] = typeof config.screening_judges === 'number' ? config.screening_judges : ((config.screening_judges || {})[r] || judges[r]);
  // How a role's reviewers combine into its score for a journey: their mean, or the lowest of them.
  const combine = config.combine || 'mean';
  const controlThreshold = config.control_threshold !== undefined ? Number(config.control_threshold) : DEFAULT_CONTROL_THRESHOLD;
  const falseAlarmThreshold = config.false_alarm_threshold !== undefined ? Number(config.false_alarm_threshold) : DEFAULT_FALSE_ALARM_THRESHOLD;
  // Anything that changes what is measured or how it is combined changes this hash, and so breaks comparability.
  const configSha = sha(JSON.stringify({
    app: config.app,
    viewports,
    personas: [...personas.values()].map((p) => ({ id: p.id, description: p.description, viewport: p.viewport || null })),
    units: units.map((u) => ({
      id: u.id, persona: u.persona, goal: u.goal, weight: u.weight || 1, roles: unitRoles(u), viewports: unitViewports(u).map((v) => v.id),
      user_viewport: (userViewport(u) || {}).id || null, steps: u.steps.map((s) => ({ id: s.id, do: s.do, expect: s.expect || null, roles: s.roles || ROLES })),
      live: Boolean(u.live), control: Boolean(u.control), planted: u.planted || [], clean: u.clean || []
    })),
    judges, controlThreshold, falseAlarmThreshold, ...(reviewerModel ? { reviewerModel } : {}),
    // Only when set, so the hash of a config that does not use them is unchanged.
    ...(config.screening_judges !== undefined ? { screening } : {}), ...(config.combine !== undefined ? { combine } : {})
  }));
  // Reviewers per role a run starts: `judges` in a confirming run, `screening_judges` otherwise. A run
  // opened before runs had a mode counts as confirming, as every run did then.
  const confirming = (run) => !run || !run.meta || run.meta.mode !== 'screen';
  const wanted = (run, role) => (confirming(run) ? judges[role] : screening[role]);
  // What the orchestrator needs to start one reviewer: the prompt, and the model when the config names one.
  const starter = (dir) => ({ dir, prompt: spawnPrompt(dir), ...(reviewerModel ? { model: reviewerModel } : {}) });
  // A control unit's evidence is captured once and kept beside the config, so it is the same in every run.
  const evidenceDir = (run, u) => (u.control ? path.join(home, 'controls', u.id) : path.join(run.dir, 'evidence', u.id));
  return { file, home, config, personas, units, viewports, judges, screening, combine, confirming, wanted, controlThreshold, falseAlarmThreshold, reviewerModel, decisionsFile, starter, unitViewports, stepsFor, unitRoles, userViewport, evidenceDir, configSha };
}

function findEvidence(evidenceDir, kind, step, size, exts) {
  for (const ext of exts) {
    const rel = `${kind}/${step}.${size}${ext}`;
    if (fs.existsSync(path.join(evidenceDir, rel))) return rel;
  }
  return null;
}

// The screenshots a role needs: a specialist sees its steps at every size, the user its steps at the user's size.
function screensFor(cfg, unit, role) {
  const sizes = role === 'user' ? [cfg.userViewport(unit)] : cfg.unitViewports(unit);
  return cfg.stepsFor(unit, role).flatMap((s) => sizes.map((v) => ({ step: s.id, size: v.id })));
}

// Every screenshot a unit needs, for all of its roles.
function expectedScreens(cfg, unit) {
  const list = [];
  for (const role of cfg.unitRoles(unit)) for (const x of screensFor(cfg, unit, role)) if (!list.some((y) => y.step === x.step && y.size === x.size)) list.push(x);
  const order = (x) => [unit.steps.findIndex((s) => s.id === x.step), cfg.viewports.findIndex((v) => v.id === x.size)];
  return list.sort((a, b) => order(a)[0] - order(b)[0] || order(a)[1] - order(b)[1]);
}

function missingScreens(cfg, run, unit, role) {
  const dir = cfg.evidenceDir(run, unit);
  const wanted = role ? screensFor(cfg, unit, role) : expectedScreens(cfg, unit);
  return wanted.filter((x) => !findEvidence(dir, 'screens', x.step, x.size, IMAGE_EXTS)).map((x) => `screens/${x.step}.${x.size}.png`);
}

function sizesTable(viewportList) {
  const lines = ['## Screen sizes', '', '| Size | Width x height | Input |', '|---|---|---|'];
  for (const v of viewportList) lines.push(`| \`${v.id}\` | ${v.width} x ${v.height} | ${v.touch ? 'touch' : 'mouse and keyboard'} |`);
  return lines;
}

// What a specialist is told about the journey: the product, the person, the goal, its steps and the sizes.
function journeyMd(cfg, unit, role) {
  const persona = cfg.personas.get(unit.persona);
  const lines = ['# Journey', '', `**Product.** ${cfg.config.app.name}: ${cfg.config.app.description}`, '',
    `**Person.** ${persona.description}`, '', `**Goal.** ${unit.goal}`, '',
    '## Steps', '', '| Step | What the person does | What they expect to happen |', '|---|---|---|'];
  for (const s of cfg.stepsFor(unit, role)) lines.push(`| \`${s.id}\` | ${s.do} | ${s.expect || ''} |`);
  lines.push('', ...sizesTable(cfg.unitViewports(unit)));
  return lines.join('\n') + '\n';
}

function newBundleDir(tmpRoot) {
  // Neutral, random names: a path must not tell its reader which run, which round or which reviewer this
  // is. Each folder also gets a parent of its own, so that the folder next door is not another reviewer's.
  const parent = path.join(tmpRoot, crypto.randomBytes(8).toString('hex'));
  const dir = path.join(parent, `review-${crypto.randomBytes(5).toString('hex')}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Once a result is in the run (or the reviewer is discarded) its folder goes, so a reviewer started
// later cannot come across an earlier one's work. Only folders this script made are removed.
function retireBundleDir(dir) {
  if (!dir || !/^review-[0-9a-f]{10}$/.test(path.basename(dir))) return;
  const parent = path.dirname(dir);
  fs.rmSync(/^[0-9a-f]{16}$/.test(path.basename(parent)) ? parent : dir, { recursive: true, force: true });
}

function copyEvidence(evidenceDir, dir, stepIds, sizeIds, kinds = ['screens', 'pages', 'facts']) {
  for (const kind of kinds) {
    const src = path.join(evidenceDir, kind);
    if (!fs.existsSync(src)) continue;
    const wanted = fs.readdirSync(src).filter((f) => stepIds.some((s) => sizeIds.some((v) => f.startsWith(`${s}.${v}.`))));
    if (!wanted.length) continue;
    fs.mkdirSync(path.join(dir, kind), { recursive: true });
    for (const f of wanted) fs.copyFileSync(path.join(src, f), path.join(dir, kind, f));
  }
}

function loadRun(runArg, flag = '--run') {
  if (!runArg || runArg === true) fail(`${flag} <run-dir> is required`);
  const dir = path.resolve(runArg);
  const file = path.join(dir, 'run.json');
  if (!fs.existsSync(file)) fail(`not a run directory (no run.json): ${dir}`);
  const bundlesFile = path.join(dir, 'bundles.json');
  return { dir, meta: readJson(file), bundlesFile, bundles: fs.existsSync(bundlesFile) ? readJson(bundlesFile) : [] };
}

function tmpRootFor(args) { return path.resolve(opt(args, 'tmp') || os.tmpdir()); }

function accessText(cfg, unit) {
  const live = Boolean(unit.live && cfg.config.live && cfg.config.live.base_url);
  return {
    block: live
      ? `## The running product\n\nThe product is also running at ${cfg.config.live.base_url}. ${cfg.config.live.access_note || ''}\nUse it for what still images cannot show: keyboard focus, error messages, responses to actions.\nStay inside this journey and do not change or delete anything beyond what its steps require.`
      : '',
    suffix: live ? ' and the running product at that address' : ''
  };
}

// ---------------------------------------------------------------- new-run
function cmdNewRun(args) {
  const rubric = loadRubric(args.config);
  const cfg = loadConfig(args.config, rubric);
  let commit = opt(args, 'commit');
  if (!commit) {
    try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: cfg.home, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (_) { commit = 'nocommit'; }
  }
  const date = opt(args, 'date') || new Date().toISOString().slice(0, 10);
  const runsDir = path.join(cfg.home, 'runs');
  let runId = `${date.replace(/-/g, '')}-${commit}`;
  for (let n = 2; fs.existsSync(path.join(runsDir, runId)); n += 1) runId = `${date.replace(/-/g, '')}-${commit}-${n}`;
  const runDir = path.join(runsDir, runId);
  const run = { dir: runDir };
  // The decisions are copied into the run once, so that every reviewer of the run is handed the same
  // file, whatever happens to the project's own copy meanwhile.
  let decisionsSha = null;
  if (cfg.decisionsFile) {
    const body = fs.readFileSync(cfg.decisionsFile, 'utf8');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'decisions.md'), body);
    decisionsSha = sha(body.replace(/\r\n/g, '\n'));
  }
  const expected = {};
  const controlsMissing = {};
  for (const u of cfg.units) {
    if (u.control) {
      const missing = missingScreens(cfg, run, u, null);
      if (missing.length) controlsMissing[u.id] = missing;
      continue;
    }
    const ev = path.join(runDir, 'evidence', u.id);
    for (const kind of ['screens', 'pages', 'facts']) fs.mkdirSync(path.join(ev, kind), { recursive: true });
    expected[u.id] = expectedScreens(cfg, u).map((x) => `screens/${x.step}.${x.size}.png`);
  }
  // Screening is the default only when the config sets screening_judges; otherwise every run confirms, as before.
  const mode = args.confirm || cfg.config.screening_judges === undefined ? 'confirm' : 'screen';
  writeJson(path.join(runDir, 'run.json'), { run_id: runId, date, created_at: new Date().toISOString(), commit, mode, rubric_version: rubric.version, rubric_sha: rubric.sha, ...(rubric.set ? { rubric_set: rubric.set } : {}), config_sha: cfg.configSha, ...(decisionsSha ? { decisions_sha: decisionsSha } : {}), units: cfg.units.map((u) => u.id) });
  // A screening run reviews the journeys only; a confirming run adds the control units at `judges` per role.
  const count = (per, withControls) => cfg.units.filter((u) => withControls || !u.control).reduce((n, u) => n + cfg.unitRoles(u).reduce((m, r) => m + per[r], 0), 0);
  const reviewers = mode === 'confirm' ? count(cfg.judges, true) : count(cfg.screening, false);
  const out = { run_dir: runDir, run_id: runId, mode, reviewers_per_full_run: reviewers, reviewers_per_screening_run: count(cfg.screening, false), reviewers_per_confirming_run: count(cfg.judges, true), capture: expected, note: 'Also save pages/<step>.<size>.txt and facts/<step>.<size>.json beside each screenshot where you can.' };
  if (decisionsSha) out.decisions = `${cfg.decisionsFile} copied into the run (${decisionsSha}); the specialists are handed it`;
  if (!cfg.units.some((u) => u.control)) out.no_control_set = 'The config has no control unit, so whether the reviewers are too kind or too harsh will not be measured in this run.';
  if (Object.keys(controlsMissing).length) out.controls_missing = { where: path.join(cfg.home, 'controls'), files: controlsMissing };
  console.log(JSON.stringify(out, null, 2));
}

// ---------------------------------------------------------------- bundle
// What every specialist folder holds, whatever it is for: the brief, the role's rubric, the journey, the
// project's decisions where the run has them, and the evidence the role is handed.
function fillSpecialistDir(cfg, rubric, run, unit, role, dir, briefFile) {
  const access = accessText(cfg, unit);
  const readme = readJudgeFile(briefFile)
    .replace('{{ROLE_TITLE}}', () => rubric.roles[role].title.replace(/ rubric$/i, '').toLowerCase())
    .replace('{{ACCESS_BLOCK}}', () => access.block)
    .replace('{{ACCESS_SUFFIX}}', () => access.suffix);
  fs.writeFileSync(path.join(dir, 'README.md'), readme);
  fs.copyFileSync(rubric.roles[role].file, path.join(dir, 'rubric.md'));
  fs.writeFileSync(path.join(dir, 'journey.md'), journeyMd(cfg, unit, role));
  const decisions = path.join(run.dir, 'decisions.md');
  if (fs.existsSync(decisions)) fs.copyFileSync(decisions, path.join(dir, 'decisions.md'));
  copyEvidence(cfg.evidenceDir(run, unit), dir, cfg.stepsFor(unit, role).map((s) => s.id), cfg.unitViewports(unit).map((v) => v.id), EVIDENCE_KINDS[role]);
}

function buildSpecialistBundle(cfg, rubric, run, unit, role, judge, tmpRoot) {
  const dir = newBundleDir(tmpRoot);
  fillSpecialistDir(cfg, rubric, run, unit, role, dir, 'reviewer-brief.md');
  return { kind: 'judge', role, unit: unit.id, judge, dir };
}

// A folder for a second look at one issue: what a reviewer of that role is handed, and the claim. It
// says nothing of who made the claim or what else was reported.
function buildCheckBundle(cfg, rubric, run, unit, issue, tmpRoot) {
  const dir = newBundleDir(tmpRoot);
  fillSpecialistDir(cfg, rubric, run, unit, issue.role, dir, 'check-brief.md');
  const criterion = rubric.roles[issue.role].criteria.find((c) => c.id === issue.criterion);
  fs.writeFileSync(path.join(dir, 'claim.md'), [
    '# The claim', '',
    '| | |', '|---|---|',
    `| Criterion | \`${issue.criterion}\` ${criterion ? cell(criterion.text) : ''} |`,
    `| Severity claimed | \`${issue.severity}\` |`,
    `| Step | ${issue.step ? `\`${issue.step}\`` : 'every step'} |`,
    `| Screen size | ${issue.size ? `\`${issue.size}\`` : 'every size'} |`, '',
    `**The problem, as claimed.** ${issue.statement}`, '',
    ...(issue.impact ? [`**What it is said to cost the person.** ${issue.impact}`, ''] : []),
    `**Files cited.** ${issue.evidence.map((e) => `\`${e}\``).join(', ')}`, ''
  ].join('\n'));
  return { issue: issue.id, unit: unit.id, role: issue.role, severity: issue.severity, dir };
}

// A user reviewer gets only what the person would have: the screens, in order, on their own device,
// under names that give nothing away, with each step saying only how they got there.
function buildUserBundle(cfg, rubric, run, unit, judge, tmpRoot) {
  const dir = newBundleDir(tmpRoot);
  const steps = cfg.stepsFor(unit, 'user');
  const viewport = cfg.userViewport(unit);
  const persona = cfg.personas.get(unit.persona);
  const access = accessText(cfg, unit);
  const readme = readJudgeFile('user-brief.md')
    .replace('{{STEP_COUNT}}', () => String(steps.length))
    .replace('{{ACCESS_BLOCK}}', () => access.block)
    .replace('{{ACCESS_SUFFIX}}', () => access.suffix);
  fs.writeFileSync(path.join(dir, 'README.md'), readme);
  fs.copyFileSync(rubric.roles.user.file, path.join(dir, 'rubric.md'));
  fs.writeFileSync(path.join(dir, 'start.md'), [
    '# Where you start', '',
    `**The product.** ${cfg.config.app.name}: ${cfg.config.app.description}`, '',
    `**Who you are.** ${persona.description}`, '',
    `**What you want to do.** ${unit.goal}`, '',
    `**What you are using.** ${viewport.touch ? 'A touch screen' : 'A screen with a mouse and keyboard'}, ${viewport.width} by ${viewport.height} pixels.`, '',
    'Begin with `steps/step-01.md`.', ''
  ].join('\n'));
  fs.mkdirSync(path.join(dir, 'steps'));
  fs.mkdirSync(path.join(dir, 'screens'));
  const evidenceDir = cfg.evidenceDir(run, unit);
  const map = steps.map((s, i) => {
    const n = pad(i + 1);
    const source = findEvidence(evidenceDir, 'screens', s.id, viewport.id, IMAGE_EXTS);
    const shown = `screens/screen-${n}${source ? path.extname(source) : '.png'}`;
    if (source) fs.copyFileSync(path.join(evidenceDir, source), path.join(dir, shown));
    const last = i === steps.length - 1;
    fs.writeFileSync(path.join(dir, 'steps', `step-${n}.md`), [
      `# Step ${i + 1} of ${steps.length}`, '',
      `**${i === 0 ? 'Where you begin' : 'How you got here'}.** ${s.do}`, '',
      `Now look at \`${shown}\`. That is what is in front of you.`, '',
      `Write down your answers for this step before you open anything else.${last ? ' This is the last step.' : ` When you have, go on to \`steps/step-${pad(i + 2)}.md\`.`}`, ''
    ].join('\n'));
    return { step: s.id, source: source || `screens/${s.id}.${viewport.id}.png`, shown };
  });
  return { kind: 'judge', role: 'user', unit: unit.id, judge, dir, viewport: viewport.id, steps: map };
}

function cmdBundle(args) {
  const rubric = loadRubric(args.config);
  const cfg = loadConfig(args.config, rubric);
  const run = loadRun(args.run);
  const tmpRoot = tmpRootFor(args);
  // A screening run never reviews the control units: they measure the reviewers of a confirming run.
  const units = (opt(args, 'unit') ? cfg.units.filter((u) => u.id === args.unit) : cfg.units).filter((u) => cfg.confirming(run) || !u.control);
  if (!units.length) fail(opt(args, 'unit') && cfg.units.some((u) => u.id === args.unit) ? `${args.unit} is a control unit: it is reviewed only in a confirming run (new-run --confirm)` : `no such unit: ${args.unit}`);
  if (opt(args, 'role') && !ROLES.includes(args.role)) fail(`--role must be one of ${ROLES.join(', ')}`);
  const out = [];
  for (const unit of units) {
    for (const role of cfg.unitRoles(unit).filter((r) => !opt(args, 'role') || r === args.role)) {
      const missing = missingScreens(cfg, run, unit, role);
      if (missing.length && !args['allow-missing']) fail(`unit ${unit.id} is missing screenshots in ${cfg.evidenceDir(run, unit)} (pass --allow-missing to bundle anyway):\n  - ${missing.join('\n  - ')}`);
      const mine = run.bundles.filter((b) => b.unit === unit.id && b.role === role);
      const active = mine.filter((b) => !b.discarded).length;
      const lastIndex = mine.reduce((m, b) => Math.max(m, b.judge), 0);
      // With no --judges, top the unit up to the configured number, so a discarded reviewer is simply replaced.
      const wanted = opt(args, 'judges') ? Number(args.judges) : Math.max(cfg.wanted(run, role) - active, 0);
      for (let k = 1; k <= wanted; k += 1) {
        const bundle = role === 'user'
          ? buildUserBundle(cfg, rubric, run, unit, lastIndex + k, tmpRoot)
          : buildSpecialistBundle(cfg, rubric, run, unit, role, lastIndex + k, tmpRoot);
        run.bundles.push(bundle);
        out.push({ unit: unit.id, role, judge: bundle.judge, ...cfg.starter(bundle.dir) });
      }
    }
  }
  writeJson(run.bundlesFile, run.bundles);
  console.log(JSON.stringify(out, null, 2));
}

// ---------------------------------------------------------------- validation
const isObject = (x) => x && typeof x === 'object' && !Array.isArray(x);
const text = (x) => typeof x === 'string' && x.trim().length > 0;
const wholeScore = (x) => Number.isInteger(x) && x >= 0 && x <= 100;
function evidenceOk(list, dir) {
  return Array.isArray(list) && list.length > 0 && list.every((rel) => typeof rel === 'string' && !rel.includes('..') && fs.existsSync(path.join(dir, rel)));
}

function validateSpecialist(j, criteria, stepIds, sizeIds, dir) {
  if (!isObject(j)) return ['judgment.json is not a JSON object'];
  const errors = [];
  if (!wholeScore(j.score)) errors.push('score must be a whole number from 0 to 100');
  if (!text(j.reason)) errors.push('reason is required');
  if (!Array.isArray(j.issues)) errors.push('issues must be an array');
  const issues = Array.isArray(j.issues) ? j.issues : [];
  if (j.strengths !== undefined && !(Array.isArray(j.strengths) && j.strengths.every((s) => typeof s === 'string'))) errors.push('strengths must be a list of sentences');
  issues.forEach((f, i) => {
    const tag = `issue ${i + 1}`;
    if (!isObject(f)) { errors.push(`${tag}: must be an object`); return; }
    if (!criteria.includes(f.criterion)) errors.push(`${tag}: criterion must be one of ${criteria.join(', ')}`);
    if (!SEVERITIES.includes(f.severity)) errors.push(`${tag}: severity must be one of ${SEVERITIES.join(', ')}`);
    if (notNull(f.step) && !stepIds.includes(f.step)) errors.push(`${tag}: step ${f.step} is not a step of this journey`);
    if (notNull(f.size) && !sizeIds.includes(f.size)) errors.push(`${tag}: size ${f.size} is not a screen size of this journey`);
    if (!text(f.problem)) errors.push(`${tag}: problem is required`);
    if (!evidenceOk(f.evidence, dir)) errors.push(`${tag}: evidence must cite at least one file that exists in the folder`);
  });
  if (wholeScore(j.score) && j.score < ISSUE_BELOW && !issues.length) errors.push(`a score below ${ISSUE_BELOW} needs at least one issue that says what cost the points`);
  return errors;
}

function validateUser(j, stepCount, kinds, dir) {
  if (!isObject(j)) return ['judgment.json is not a JSON object'];
  const errors = [];
  if (!Array.isArray(j.steps) || j.steps.length !== stepCount) return [`steps must be an array with one entry for each of the ${stepCount} steps`];
  let trouble = 0;
  j.steps.forEach((s, i) => {
    const tag = `step ${i + 1}`;
    if (!isObject(s)) { errors.push(`${tag}: must be an object`); return; }
    if (s.step !== i + 1) errors.push(`${tag}: "step" must be ${i + 1}`);
    if (!text(s.saw)) errors.push(`${tag}: saw is required`);
    if (!OUTCOMES.includes(s.outcome)) errors.push(`${tag}: outcome must be one of ${OUTCOMES.join(', ')}`);
    if (i < stepCount - 1 && !text(s.next)) errors.push(`${tag}: next is required`);
    if (s.good !== undefined && !Array.isArray(s.good)) errors.push(`${tag}: good must be a list`);
    const list = Array.isArray(s.trouble) ? s.trouble : [];
    if (s.trouble !== undefined && !Array.isArray(s.trouble)) errors.push(`${tag}: trouble must be a list`);
    list.forEach((m, k) => {
      if (!isObject(m) || !kinds.includes(m.kind)) { errors.push(`${tag} trouble ${k + 1}: kind must be one of ${kinds.join(', ')}`); return; }
      if (!text(m.what)) errors.push(`${tag} trouble ${k + 1}: what is required`);
      if (!evidenceOk(m.evidence, dir)) errors.push(`${tag} trouble ${k + 1}: evidence must name at least one screenshot that exists in the folder`);
    });
    trouble += list.length;
    if (OUTCOMES.includes(s.outcome) && s.outcome !== 'smooth' && !list.length) errors.push(`${tag}: an outcome other than smooth needs trouble that says why`);
  });
  if (!(j.finished in FINISHED_CAP)) errors.push(`finished must be one of ${Object.keys(FINISHED_CAP).join(', ')}`);
  if (!wholeScore(j.score)) errors.push('score must be a whole number from 0 to 100');
  if (!text(j.reason)) errors.push('reason is required');
  if (wholeScore(j.score) && j.score < ISSUE_BELOW && !trouble) errors.push(`a score below ${ISSUE_BELOW} needs at least one piece of trouble that says what cost the points`);
  return errors;
}

function validateVerdict(v) {
  if (!isObject(v)) return ['verdict.json is not a JSON object'];
  const errors = [];
  if (!HOLDS.includes(v.holds)) errors.push(`holds must be one of ${HOLDS.join(', ')}`);
  if (![...SEVERITIES, 'none'].includes(v.severity)) errors.push(`severity must be one of ${SEVERITIES.join(', ')}, or none`);
  if ((v.holds === 'no') !== (v.severity === 'none')) errors.push('severity is "none" when, and only when, holds is "no"');
  if (!text(v.reason)) errors.push('reason is required');
  return errors;
}

// ---------------------------------------------------------------- collect
function bundleFiles(run, b) {
  const dest = path.join(run.dir, 'judgments', b.unit, `${b.role}-${b.judge}.json`);
  return { src: path.join(b.dir, 'judgment.json'), dest, stored: fs.existsSync(dest) };
}

function cmdCollect(args) {
  const rubric = loadRubric(args.config);
  const cfg = loadConfig(args.config, rubric);
  const run = loadRun(args.run);
  const report = [];
  for (const b of run.bundles) {
    const unit = cfg.units.find((u) => u.id === b.unit);
    if (!unit || b.discarded) continue;
    const note = (status, extra = {}) => report.push({ unit: b.unit, role: b.role, judge: b.judge, status, ...extra });
    const { src, dest, stored } = bundleFiles(run, b);
    if (stored) { retireBundleDir(b.dir); note('collected'); continue; }
    if (!fs.existsSync(src)) { note('missing', { dir: b.dir }); continue; }
    let parsed;
    try { parsed = readJson(src); } catch (e) { note('invalid', { dir: b.dir, errors: [`judgment.json is not valid JSON: ${e.message}`] }); continue; }
    if (b.role === 'user') {
      const errors = validateUser(parsed, b.steps.length, rubric.roles.user.ids, b.dir);
      if (errors.length) { note('invalid', { dir: b.dir, errors }); continue; }
      // Put the real step ids and file names back, so the stored report lines up with the evidence.
      const original = (rel) => { const hit = b.steps.find((s) => s.shown === String(rel).replace(/\\/g, '/')); return hit ? hit.source : rel; };
      writeJson(dest, {
        viewport: b.viewport,
        steps: parsed.steps.map((s, i) => ({
          step: b.steps[i].step, screen: b.steps[i].source, saw: s.saw, outcome: s.outcome, next: s.next || '', good: s.good || [],
          trouble: (s.trouble || []).map((m) => ({ kind: m.kind, what: m.what, evidence: m.evidence.map(original) }))
        })),
        finished: parsed.finished, score: parsed.score, reason: parsed.reason
      });
    } else {
      const errors = validateSpecialist(parsed, rubric.roles[b.role].ids, cfg.stepsFor(unit, b.role).map((s) => s.id), cfg.unitViewports(unit).map((v) => v.id), b.dir);
      if (errors.length) { note('invalid', { dir: b.dir, errors }); continue; }
      writeJson(dest, parsed);
    }
    retireBundleDir(b.dir);
    note('collected');
  }
  // Second looks (challenge): one verdict per issue, kept under <run>/checks/.
  const checks = loadChecks(run);
  for (const c of checks.list) {
    if (c.discarded) continue;
    const note = (status, extra = {}) => report.push({ check: c.issue, unit: c.unit, role: c.role, status, ...extra });
    const dest = verdictFile(run, c.issue);
    if (fs.existsSync(dest)) { retireBundleDir(c.dir); note('collected'); continue; }
    const src = path.join(c.dir, 'verdict.json');
    if (!fs.existsSync(src)) { note('missing', { dir: c.dir }); continue; }
    let parsed;
    try { parsed = readJson(src); } catch (e) { note('invalid', { dir: c.dir, errors: [`verdict.json is not valid JSON: ${e.message}`] }); continue; }
    const errors = validateVerdict(parsed);
    if (errors.length) { note('invalid', { dir: c.dir, errors }); continue; }
    writeJson(dest, { issue: c.issue, unit: c.unit, role: c.role, reported: c.severity, holds: parsed.holds, severity: parsed.severity, reason: parsed.reason });
    retireBundleDir(c.dir);
    note('collected');
  }
  // --discard-bad retires every reviewer whose result is missing or invalid. A discarded reviewer is never
  // asked again: the next `bundle` (or `challenge`) starts a replacement in a new folder.
  if (args['discard-bad']) {
    for (const r of report.filter((x) => x.status !== 'collected')) {
      (run.bundles.find((x) => x.dir === r.dir) || checks.list.find((x) => x.dir === r.dir)).discarded = true;
      retireBundleDir(r.dir);
      r.status = 'discarded';
    }
  }
  writeJson(run.bundlesFile, run.bundles);
  if (checks.list.length) writeJson(checks.file, checks.list);
  console.log(JSON.stringify(report, null, 2));
  if (report.some((r) => r.status === 'missing' || r.status === 'invalid')) process.exitCode = 2;
}

// ---------------------------------------------------------------- status
// Where a run stands and what to do next. Reads only; safe to call at any time, in any session.
function cmdStatus(args) {
  const rubric = loadRubric(args.config);
  const cfg = loadConfig(args.config, rubric);
  const run = loadRun(args.run);
  const only = opt(args, 'unit');
  const inScope = (id) => !only || id === only;
  const live = run.bundles.filter((b) => !b.discarded && inScope(b.unit));
  const waiting = live.filter((b) => !bundleFiles(run, b).stored).map((b) => ({ unit: b.unit, role: b.role, judge: b.judge, result_written: fs.existsSync(bundleFiles(run, b).src), ...cfg.starter(b.dir) }));
  const units = cfg.units.filter((u) => inScope(u.id) && (cfg.confirming(run) || !u.control)).map((unit) => {
    const roles = {};
    for (const role of cfg.unitRoles(unit)) {
      const mine = live.filter((b) => b.unit === unit.id && b.role === role);
      roles[role] = { wanted: cfg.wanted(run, role), collected: mine.filter((b) => bundleFiles(run, b).stored).length, waiting: mine.filter((b) => !bundleFiles(run, b).stored).length, to_start: Math.max(cfg.wanted(run, role) - mine.length, 0) };
    }
    const missing = missingScreens(cfg, run, unit, null);
    const started = Object.values(roles).some((r) => r.collected + r.waiting > 0);
    const all = Object.values(roles).every((r) => r.collected >= r.wanted);
    const state = !started && missing.length ? 'not captured' : !started ? 'captured, no reviewers yet' : !all ? 'reviewers outstanding' : 'ready to score';
    return { unit: unit.id, ...(unit.control ? { control: true } : {}), state, screenshots_missing: missing.length, roles };
  });
  // Second looks: folders waiting for a verdict, and serious issues one reviewer alone reported that
  // have neither a verdict nor a folder yet.
  const verdicts = loadVerdicts(run);
  const checks = loadChecks(run).list.filter((c) => !c.discarded && inScope(c.unit));
  const checksWaiting = checks.filter((c) => !verdicts[c.issue]).map((c) => ({ check: c.issue, unit: c.unit, role: c.role, result_written: fs.existsSync(path.join(c.dir, 'verdict.json')), ...cfg.starter(c.dir) }));
  const unchecked = loneSerious(cfg, run).filter((f) => inScope(f.unit) && !verdicts[f.id] && !checks.some((c) => c.issue === f.id));
  const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])) : []);
  const newest = [...walk(path.join(run.dir, 'judgments')), ...walk(path.join(run.dir, 'checks'))].reduce((m, f) => Math.max(m, fs.statSync(f).mtimeMs), 0);
  const cardFile = path.join(run.dir, 'scorecard.json');
  const scored = fs.existsSync(cardFile) && fs.statSync(cardFile).mtimeMs >= newest;
  const next = [];
  const stale = run.meta.rubric_sha !== rubric.sha ? 'a rubric, a brief or the scoring rules' : run.meta.config_sha !== cfg.configSha ? 'the config' : null;
  if (stale) next.push(`This run was opened under a different yardstick (${stale} changed since). It cannot be scored: open a new run with new-run.`);
  else {
    const written = waiting.filter((w) => w.result_written).length;
    const silent = waiting.length - written;
    const active = units.filter((u) => u.state !== 'not captured' && u.state !== 'captured, no reviewers yet');
    const toStart = active.reduce((n, u) => n + Object.values(u.roles).reduce((m, r) => m + r.to_start, 0), 0);
    if (written) next.push(`${written} reviewer folder(s) hold a result not yet taken into the run: run collect.`);
    if (silent) next.push(`${silent} reviewer folder(s) have no result yet (listed under "waiting"). If their agents are still running in this session, wait for them. If this is a new session they are gone: run collect --discard-bad, then bundle again, and start one fresh agent per entry printed.`);
    if (toStart) next.push(`${toStart} reviewer(s) still to start for journeys already under review: run bundle and start one fresh agent per entry printed.`);
    const idle = units.filter((u) => u.state === 'captured, no reviewers yet' || u.state === 'not captured');
    if (idle.length && !active.length) next.push(idle.some((u) => u.state === 'not captured') ? 'Nothing is under review. Capture the evidence (capture.cjs), then run bundle.' : 'Evidence is in place and nothing is under review: run bundle and start one fresh agent per entry printed.');
    const verdictsWritten = checksWaiting.filter((w) => w.result_written).length;
    if (verdictsWritten) next.push(`${verdictsWritten} second-look folder(s) hold a verdict not yet taken into the run: run collect.`);
    if (checksWaiting.length - verdictsWritten) next.push(`${checksWaiting.length - verdictsWritten} second-look folder(s) have no verdict yet (listed under "second_looks"). If their agents are still running in this session, wait for them. If this is a new session they are gone: run collect --discard-bad, then challenge again.`);
    const second = `${unchecked.length} major or blocker issue(s) rest on one reviewer's word`;
    if (active.length && active.every((u) => u.state === 'ready to score') && !waiting.length && !checksWaiting.length) {
      next.push(!scored
        ? (unchecked.length ? `Every result is in, and ${second}: run challenge, start one fresh agent per entry printed, run collect, then run score.` : 'Every result is in: run score.')
        : unchecked.length ? `Scored, but ${second} and were counted without a second look: run challenge, start one fresh agent per entry printed, run collect, then run score --rescore.`
          : 'Scored and up to date: read scorecard.md. Any role below target, or whose reviewers disagree, is not done: fix the top of the fix order, commit, run regress on the new capture, and review again in a new run with fresh reviewers.');
    }
  }
  console.log(JSON.stringify({ run_id: run.meta.run_id, commit: run.meta.commit, scored, next, units, waiting, second_looks: { still_to_start: unchecked.map((f) => f.id), waiting: checksWaiting } }, null, 2));
}

// ---------------------------------------------------------------- scoring
// Whether the reviewers of one role disagree: their highest and lowest counted scores are
// CONTESTED_SPREAD or more apart. A role whose reviewers disagree is not at target, whatever its average.
function disagree(scores) {
  return scores.length > 1 && Math.max(...scores) - Math.min(...scores) >= CONTESTED_SPREAD;
}

function loadJudgments(run, unit) {
  const dir = path.join(run.dir, 'judgments', unit.id);
  if (!fs.existsSync(dir)) return [];
  const re = /^([a-z]+)-(\d+)\.json$/;
  return fs.readdirSync(dir).filter((f) => re.test(f) && ROLES.includes(f.match(re)[1]))
    .map((f) => ({ role: f.match(re)[1], judge: Number(f.match(re)[2]), data: readJson(path.join(dir, f)) }))
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.judge - b.judge);
}

// A second look at one issue (see challenge): whether it holds, and how serious it is. One file per
// issue under <run>/checks/, written by collect.
function loadVerdicts(run) {
  const dir = path.join(run.dir, 'checks');
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const v = readJson(path.join(dir, f));
    if (v && v.issue) out[v.issue] = v;
  }
  return out;
}
const verdictFile = (run, issueId) => path.join(run.dir, 'checks', `${issueId}.json`);
function loadChecks(run) {
  const file = path.join(run.dir, 'check-bundles.json');
  return { file, list: fs.existsSync(file) ? readJson(file) : [] };
}
const worstOf = (issues) => issues.reduce((s, f) => (s === null || SEVERITY_WEIGHT[f.severity] > SEVERITY_WEIGHT[s] ? f.severity : s), null);

// One reviewer's result: the issues that stand, the score it gave, and the score that counts: the score
// given, held to the ceiling its standing issues set. `verdicts` are second looks at single issues: one
// can leave an issue as it was, lower it, or find it is not there. It never raises one.
function reviewerResult(unit, j, verdicts = {}) {
  const base = { unit: unit.id, role: j.role, judge: j.judge };
  let reported;
  let cap;
  let capBecause = null;
  if (j.role === 'user') {
    reported = j.data.steps.flatMap((s, i) => s.trouble.map((m, k) => ({
      ...base, id: `${unit.id}.${j.role}${j.judge}.s${i + 1}.t${k + 1}`, criterion: m.kind, severity: OUTCOME_SEVERITY[s.outcome],
      step: s.step, size: j.data.viewport, statement: m.what, evidence: m.evidence
    })));
    cap = FINISHED_CAP[j.data.finished];
    if (cap < 100) capBecause = `finished: ${j.data.finished}`;
  } else {
    reported = (j.data.issues || []).map((f, i) => ({
      ...base, id: `${unit.id}.${j.role}${j.judge}.i${i + 1}`, criterion: f.criterion, severity: f.severity, step: f.step || null, size: f.size || null,
      statement: f.problem, impact: f.impact, fix: f.fix, evidence: f.evidence
    }));
    cap = 100;
  }
  const issues = [];
  const refuted = [];
  for (const f of reported) {
    const v = verdicts[f.id];
    if (!v) { issues.push(f); continue; }
    const second = { holds: v.holds, severity: v.severity, reason: v.reason };
    if (v.severity === 'none') { refuted.push({ ...f, second_look: second }); continue; }
    const lowered = SEVERITY_WEIGHT[v.severity] < SEVERITY_WEIGHT[f.severity];
    issues.push({ ...f, ...(lowered ? { severity: v.severity, reported: f.severity } : {}), second_look: second });
  }
  for (const f of issues) if (CAP[f.severity] < cap) { cap = CAP[f.severity]; capBecause = `a ${f.severity} issue`; }
  const given = j.data.score;
  let counted = Math.min(given, cap);
  let rebased = null;
  // The reviewer chose its score with its most serious issue in mind. When a second look lowers or
  // removes that issue, the score is counted at no less than the anchor for what still stands.
  const was = worstOf(reported);
  const now = worstOf(issues);
  if (was !== now) {
    const minors = issues.filter((f) => f.severity === 'minor').length;
    const anchor = now === 'major' ? REBASE.major
      : now === 'minor' ? (minors === 1 ? REBASE.one_minor : minors <= 3 ? REBASE.two_or_three_minors : REBASE.four_or_more_minors)
        : REBASE.nothing_or_polish;
    const again = Math.min(Math.max(given, anchor), cap);
    if (again !== counted) rebased = { from: counted, because: `its most serious issue was a ${was}; after a second look ${now ? `the most serious left is a ${now}` : 'no issue is left'}` };
    counted = again;
  }
  return { ...base, given, counted, ceiling: cap, capped: given > cap ? capBecause : null, rebased, reason: j.data.reason, issues, refuted, strengths: j.data.strengths || [] };
}

function scoreUnit(cfg, run, unit, verdicts = {}) {
  const results = loadJudgments(run, unit).filter((j) => cfg.unitRoles(unit).includes(j.role)).map((j) => reviewerResult(unit, j, verdicts));
  const roles = {};
  for (const role of cfg.unitRoles(unit)) {
    const mine = results.filter((r) => r.role === role);
    if (!mine.length) { roles[role] = { score: null, raw: [], given: [], contested: false, judges: 0 }; continue; }
    const counted = mine.map((r) => r.counted);
    const average = mean(counted);
    // mean: the reviewers' counted scores, averaged. floor: the same average, held to the lowest ceiling
    // any one of them set, so that one reviewer's standing major or blocker is not averaged away.
    const ceiling = Math.min(...mine.map((r) => r.ceiling));
    const held = cfg.combine === 'floor' && ceiling < average;
    roles[role] = { score: held ? ceiling : average, raw: counted, given: mine.map((r) => r.given), contested: disagree(counted), judges: mine.length, ...(held ? { held_to: ceiling } : {}) };
  }
  const scored = Object.values(roles).filter((r) => r.score !== null).map((r) => r.score);
  return { id: unit.id, weight: unit.weight || 1, control: Boolean(unit.control), overall: mean(scored), roles, results };
}

// Issues that rest on one reviewer's word: a major or a blocker that a specialist reported and that no
// other reviewer of the same journey reported. Each is given a second look (challenge) before it holds
// a score down. Grouped as the fix order groups them, from the issues as they were reported.
function loneSerious(cfg, run) {
  const issues = cfg.units.filter((u) => !u.control)
    .flatMap((unit) => loadJudgments(run, unit).filter((j) => cfg.unitRoles(unit).includes(j.role)).flatMap((j) => reviewerResult(unit, j).issues))
    .map((f) => ({ ...f, check: f.criterion }));
  const clustersFile = path.join(run.dir, 'clusters.json');
  const lone = [];
  for (const g of groupFindings(issues, fs.existsSync(clustersFile) ? readJson(clustersFile) : {})) {
    for (const f of g.members) {
      if (f.role === 'user' || SEVERITY_WEIGHT[f.severity] < SEVERITY_WEIGHT.major) continue;
      const reporters = new Set(g.members.filter((m) => m.unit === f.unit).map((m) => `${m.role}.${m.judge}`));
      if (reporters.size === 1) lone.push(f);
    }
  }
  return lone.sort((a, b) => a.id.localeCompare(b.id));
}

// How strict the reviewers were, measured on the control screens: the share of planted defects they
// reported (too low: the reviewers are too kind) and the share of things known to be right that they
// reported as wrong (too high: too harsh). This measures the reviewers, not the product.
function measureSensitivity(cfg, unitResults) {
  const matches = (issue, e) => (!e.criterion || issue.criterion === e.criterion) && (!e.step || !issue.step || issue.step === e.step);
  const blank = () => ({ planted: 0, answers: 0, caught: 0, clean: 0, clean_answers: 0, false_alarms: 0 });
  const total = blank();
  const byRole = {};
  const missed = [];
  const alarmed = [];
  for (const unit of cfg.units.filter((u) => u.control)) {
    const res = unitResults[unit.id];
    for (const [kind, list] of [['planted', unit.planted || []], ['clean', unit.clean || []]]) {
      for (const e of list) {
        const reviewers = res.results.filter((r) => r.role === e.role);
        if (!reviewers.length) continue;
        const hits = reviewers.filter((r) => r.issues.some((i) => matches(i, e))).length;
        const t = (byRole[e.role] = byRole[e.role] || blank());
        for (const acc of [t, total]) {
          if (kind === 'planted') { acc.planted += 1; acc.answers += reviewers.length; acc.caught += hits; } else { acc.clean += 1; acc.clean_answers += reviewers.length; acc.false_alarms += hits; }
        }
        const name = e.id || `${e.role} ${e.criterion || ''} ${e.step || ''}`.trim();
        if (kind === 'planted' && hits * 2 < reviewers.length) missed.push({ unit: unit.id, role: e.role, planted: name, caught_by: hits, of: reviewers.length });
        if (kind === 'clean' && hits * 2 > reviewers.length) alarmed.push({ unit: unit.id, role: e.role, clean: name, flagged_by: hits, of: reviewers.length });
      }
    }
  }
  const rates = (t) => ({ ...t, rate: t.answers ? round(t.caught / t.answers, 2) : null, false_alarm_rate: t.clean_answers ? round(t.false_alarms / t.clean_answers, 2) : null });
  if (!total.answers && !total.clean_answers) return null;
  return { ...rates(total), by_role: Object.fromEntries(Object.entries(byRole).map(([r, t]) => [r, rates(t)])), missed, alarmed };
}

// Reviewers describe one problem in different words, and several reviewers describe it once each.
// This groups issues that are about the same thing, by the distinctive words their statements share,
// so the fix order and the counts show each problem once. It never changes a score.
// `manual` (clusters.json: label -> issue ids) overrides the grouping for the ids it names.
const COMMON_WORDS = new Set('the and for that this with not but are was were has have had its from they them their there what which when where who how does did than then into onto out off per any all one two can could would should will just only also very more most some such about above below after before again been being both each few other over same under until while your you dont cant didnt mine'.split(' '));
function distinctiveWords(statement) {
  return [...new Set(String(statement).toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9@.%$]+/).map((t) => t.replace(/^\.+|\.+$/g, '')).filter((t) => t.length >= 3 && !COMMON_WORDS.has(t)))];
}
function groupFindings(findings, manual = {}) {
  const labelOf = {};
  for (const [label, ids] of Object.entries(manual)) for (const id of ids) labelOf[id] = label;
  const words = new Map(findings.map((f) => [f.id, distinctiveWords(f.statement)]));
  const seenIn = new Map();
  for (const list of words.values()) for (const w of list) seenIn.set(w, (seenIn.get(w) || 0) + 1);
  // A word many issues use says little about which problem an issue is about; a rare one says a lot.
  const vectors = new Map(findings.map((f) => {
    const v = new Map(words.get(f.id).map((w) => [w, Math.log(1 + findings.length / seenIn.get(w))]));
    return [f.id, { v, length: Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)) || 1 }];
  }));
  const alike = (a, b) => {
    const x = vectors.get(a.id); const y = vectors.get(b.id);
    let dot = 0;
    for (const [w, weight] of x.v) if (y.v.has(w)) dot += weight * y.v.get(w);
    return dot / (x.length * y.length);
  };
  const needed = (a, b) => {
    if (a.unit !== b.unit || a.step !== b.step) return ALIKE.elsewhere;
    return a.check && a.check === b.check ? ALIKE.same_check_and_step : ALIKE.same_step;
  };
  const groups = [];
  const byLabel = new Map();
  // Strongest first, so a group is named by its most serious report; the id keeps the order stable.
  const ordered = [...findings].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || a.id.localeCompare(b.id));
  for (const f of ordered) {
    if (labelOf[f.id]) {
      if (!byLabel.has(labelOf[f.id])) { byLabel.set(labelOf[f.id], { label: labelOf[f.id], members: [] }); groups.push(byLabel.get(labelOf[f.id])); }
      byLabel.get(labelOf[f.id]).members.push(f);
      continue;
    }
    let best = null; let bestScore = 0;
    for (const g of groups) {
      if (byLabel.has(g.label) && byLabel.get(g.label) === g) continue;
      for (const m of g.members) {
        const s = alike(f, m);
        if (s >= needed(f, m) && s > bestScore) { best = g; bestScore = s; }
      }
    }
    if (best) best.members.push(f);
    else groups.push({ label: f.statement, members: [f] });
  }
  return groups;
}

function computeScorecard(cfg, rubric, run) {
  const warnings = [];
  const verdicts = loadVerdicts(run);
  const unitResults = {};
  for (const unit of cfg.units) {
    unitResults[unit.id] = scoreUnit(cfg, run, unit, verdicts);
    for (const [role, r] of Object.entries(unitResults[unit.id].roles)) if (r.judges && r.judges < cfg.wanted(run, role)) warnings.push(`unit ${unit.id}: ${r.judges} ${role} result(s), ${cfg.wanted(run, role)} wanted`);
  }
  const real = cfg.units.filter((u) => !u.control).map((u) => unitResults[u.id]);
  // An application score per role: the journeys' scores for that role, weighted by journey weight.
  const roleScores = {};
  for (const role of ROLES) {
    const have = real.filter((u) => u.roles[role] && u.roles[role].score !== null);
    const w = have.reduce((s, u) => s + u.weight, 0);
    roleScores[role] = w ? round(have.reduce((s, u) => s + u.weight * u.roles[role].score, 0) / w) : null;
  }
  const overall = mean(Object.values(roleScores).filter(notNull));
  const contested = real.flatMap((u) => Object.entries(u.roles).filter(([, r]) => r.contested).map(([role, r]) => ({ unit: u.id, role, scores: r.raw })));
  const capped = real.flatMap((u) => u.results.filter((r) => r.capped).map((r) => ({ unit: u.id, role: r.role, judge: r.judge, given: r.given, counted: r.counted, because: r.capped })));
  const rebased = real.flatMap((u) => u.results.filter((r) => r.rebased).map((r) => ({ unit: u.id, role: r.role, judge: r.judge, given: r.given, from: r.rebased.from, counted: r.counted, because: r.rebased.because })));
  // Every issue that was given a second look, and how it came out.
  const brief = (f, outcome) => ({ id: f.id, unit: f.unit, role: f.role, criterion: f.criterion, step: f.step, size: f.size, statement: f.statement, reported: f.reported || f.severity, outcome, severity: outcome === 'not upheld' ? 'none' : f.severity, reason: f.second_look.reason });
  const secondLooks = real.flatMap((u) => u.results.flatMap((r) => [
    ...r.issues.filter((f) => f.second_look).map((f) => brief(f, f.reported ? 'lowered' : 'upheld')),
    ...r.refuted.map((f) => brief(f, 'not upheld'))
  ]));
  const unchecked = loneSerious(cfg, run).filter((f) => !verdicts[f.id]);
  if (unchecked.length) warnings.push(`${unchecked.length} major or blocker issue(s) were reported by one reviewer only and have not been given a second look, so each still holds its score down on that reviewer's word: run challenge, start one fresh agent per entry printed, run collect, and score again`);

  const sensitivity = measureSensitivity(cfg, unitResults);
  const reliable = !(sensitivity && sensitivity.rate !== null && sensitivity.rate < cfg.controlThreshold);
  const tooHarsh = Boolean(sensitivity && sensitivity.false_alarm_rate !== null && sensitivity.false_alarm_rate > cfg.falseAlarmThreshold);
  if (!cfg.units.some((u) => u.control)) warnings.push('no control unit: whether the reviewers are too kind or too harsh is not measured');
  else if (!cfg.confirming(run)) warnings.push(`screening run: ${cfg.combine === 'floor' ? 'each role held to the ceiling of the most serious issue any of its reviewers left standing, ' : ''}control units not reviewed, so how strict the reviewers were is not measured; a confirming run (new-run --confirm) settles the target`);
  if (!reliable) warnings.push(`the reviewers caught ${sensitivity.caught} of ${sensitivity.answers} planted defects (${sensitivity.rate}); below ${cfg.controlThreshold}, so the scores are likely too kind`);
  if (tooHarsh) warnings.push(`the reviewers flagged ${sensitivity.false_alarms} of ${sensitivity.clean_answers} things known to be right (${sensitivity.false_alarm_rate}); above ${cfg.falseAlarmThreshold}, so the scores are likely too harsh`);
  const notesFile = path.join(run.dir, 'capture-notes.json');
  const notes = fs.existsSync(notesFile) ? readJson(notesFile) : {};
  const hidden = (notes.hidden || []).filter((h) => real.some((u) => u.id === h.unit));
  for (const what of [...new Set(hidden.map((h) => h.what))]) warnings.push(`the capture hid "${what}" on ${hidden.filter((h) => h.what === what).length} screenshot(s) because the capture plan says it is not part of the product; the reviewers saw those pages without it`);
  // Where the capture could not record the keyboard walk, the control states or the motion, the
  // specialists who are handed those had nothing to judge them by.
  const unprobed = [...new Set((notes.probe_notes || []).filter((n) => real.some((u) => u.id === n.unit)).map((n) => n.unit))];
  if (unprobed.length) warnings.push(`the capture could not record all of the keyboard walk, control states and motion for ${unprobed.map((u) => `\`${u}\``).join(', ')} (see probe_notes in capture-notes.json); keyboard, state and motion criteria were judged there on less than the full evidence`);
  const decisionsFile = path.join(run.dir, 'decisions.md');
  const decisions = run.meta.decisions_sha
    ? { sha: run.meta.decisions_sha, entries: fs.existsSync(decisionsFile) ? numberedDecisions(fs.readFileSync(decisionsFile, 'utf8')) : null }
    : null;

  // Fix order: each problem once, however many reviewers reported it. Grouping never changes a score.
  const allIssues = real.flatMap((u) => u.results.flatMap((r) => r.issues)).map((f) => ({ ...f, check: f.criterion }));
  const clustersFile = path.join(run.dir, 'clusters.json');
  const groups = groupFindings(allIssues, fs.existsSync(clustersFile) ? readJson(clustersFile) : {});
  const standing = Object.fromEntries(real.map((u) => [u.id, Object.fromEntries(SEVERITIES.map((s) => [s, 0]))]));
  const fixList = groups.map((g) => {
    const unitIds = [...new Set(g.members.map((m) => m.unit))];
    const roles = [...new Set(g.members.map((m) => m.role))];
    // Reach: the weight of each journey where it shows, times the share of the reporting roles' reviewers there who reported it.
    const reach = unitIds.reduce((s, id) => {
      const u = unitResults[id];
      const reporters = new Set(g.members.filter((m) => m.unit === id).map((m) => `${m.role}.${m.judge}`)).size;
      const of = roles.reduce((n, r) => n + ((u.roles[r] || {}).judges || 0), 0) || 1;
      return s + u.weight * Math.min(1, reporters / of);
    }, 0);
    const severity = worstOf(g.members);
    // What stands in each journey, each problem once, at the most serious level it was reported there.
    for (const id of unitIds) standing[id][worstOf(g.members.filter((m) => m.unit === id))] += 1;
    const fix = (g.members.find((m) => m.fix) || {}).fix || null;
    return { label: g.label, severity, roles, units: unitIds, reports: g.members.length, priority: round(SEVERITY_WEIGHT[severity] * reach, 2), fix, issues: g.members.map((m) => m.id) };
  }).sort((a, b) => b.priority - a.priority || b.reports - a.reports || a.label.localeCompare(b.label));

  const units = cfg.units.map((u) => {
    const r = unitResults[u.id];
    return { id: r.id, weight: r.weight, control: r.control, overall: r.overall, roles: r.roles, ...(r.control ? {} : { standing: standing[u.id] }), reviewers: r.results.map(({ issues, refuted, ...rest }) => ({ ...rest, issues: issues.length, not_upheld: refuted.length })) };
  });
  return {
    run_id: run.meta.run_id, date: run.meta.date, commit: run.meta.commit, mode: cfg.confirming(run) ? 'confirm' : 'screen', combine: cfg.combine,
    rubric_version: rubric.version, rubric_sha: rubric.sha, config_sha: cfg.configSha, decisions,
    overall_score: overall, role_scores: roleScores, units, contested, capped, rebased, second_looks: secondLooks, unchecked: unchecked.map((f) => f.id),
    sensitivity, reliable, too_harsh: tooHarsh, warnings, hidden_not_product: hidden,
    problem_counts: Object.fromEntries(SEVERITIES.map((s) => [s, fixList.filter((g) => g.severity === s).length])),
    issue_counts: Object.fromEntries(SEVERITIES.map((s) => [s, allIssues.filter((f) => f.severity === s).length])),
    fix_list: fixList, issues: allIssues
  };
}

// How many decisions the file records, where it numbers them (`### D-001`). Any markdown file may be the
// decisions file: one that does not number its entries has no count to give, which is not a count of none.
function numberedDecisions(text) {
  return (text.match(/^###\s+D-\d+/gm) || []).length || null;
}

function readLedger(cfg) {
  const file = path.join(cfg.home, 'ledger.jsonl');
  const entries = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
  return { file, entries };
}
const show = (n) => (n === null || n === undefined ? 'n/a' : String(n));
const delta = (now, before) => (before === null || before === undefined || now === null || now === undefined ? '' : `${now - before >= 0 ? '+' : ''}${round(now - before)}`);
const cell = (s) => String(s).replace(/\|/g, '/').replace(/\s+/g, ' ');

function renderScorecard(card, cfg, rubric, previous, previousUnits) {
  const title = (role) => rubric.roles[role].title.replace(/ rubric$/i, '').replace(/^What to report$/, 'Target user');
  const real = card.units.filter((u) => !u.control);
  const lines = [`# Interface quality scorecard: ${cfg.config.app.name}`, '',
    `Run \`${card.run_id}\` (${card.date}, commit \`${card.commit}\`), rubric ${card.rubric_version} (\`${card.rubric_sha}\`), config \`${card.config_sha}\`; ${card.mode === 'screen' ? 'a screening run (journeys only, no control units)' : 'a confirming run'}.`, '',
    `**Overall: ${show(card.overall_score)}**${previous ? ` (${delta(card.overall_score, previous.overall_score)} against run \`${previous.run_id}\`)` : ''}. Every score is 0 to 100: the mean of what the reviewers of each role scored, each held to the ceiling of its own issues${card.combine === 'floor' ? ', and the role held to the lowest of those ceilings' : ''}.`, ''];
  if (card.decisions) lines.push(`The specialists were handed the project's design decisions (\`${card.decisions.sha}\`${card.decisions.entries !== null ? `, ${card.decisions.entries} recorded decision(s)` : ''}): a choice recorded there is not an issue.`, '');
  lines.push('## Roles, weakest first', '', '| Role | Score | Change | Weakest journey |', '|---|---|---|---|');
  const ranked = ROLES.filter((r) => card.role_scores[r] !== null).sort((a, b) => card.role_scores[a] - card.role_scores[b]);
  for (const role of ranked) {
    const weakest = real.filter((u) => u.roles[role] && u.roles[role].score !== null).sort((a, b) => a.roles[role].score - b.roles[role].score)[0];
    lines.push(`| ${title(role)} | **${card.role_scores[role]}** | ${previous && previous.role_scores ? delta(card.role_scores[role], previous.role_scores[role]) : ''} | ${weakest ? `\`${weakest.id}\` ${weakest.roles[role].score}` : ''} |`);
  }
  const used = ROLES.filter((r) => real.some((u) => u.roles[r]));
  lines.push('', '## Journeys, weakest first', '', `| Journey | Overall | ${used.map(title).join(' | ')} |`, `|---|---|${used.map(() => '---').join('|')}|`);
  [...real].filter((u) => u.overall !== null).sort((a, b) => a.overall - b.overall).forEach((u) => {
    const prev = (previousUnits || {})[u.id];
    const cellFor = (r) => { const x = u.roles[r]; if (!x || x.score === null) return ''; return `${x.score}${x.held_to !== undefined ? ' (held)' : ''}${x.contested ? ' (disagree)' : ''}${prev && prev.roles ? ` ${delta(x.score, prev.roles[r])}` : ''}`; };
    lines.push(`| \`${u.id}\` | ${u.overall}${prev ? ` ${delta(u.overall, prev.overall)}` : ''} | ${used.map(cellFor).join(' | ')} |`);
  });
  const stand = real.filter((u) => u.overall !== null && u.standing);
  if (stand.length) {
    lines.push('', '## What stands in each journey', '', 'Problems left standing, each counted once however many reviewers reported it.', '', `| Journey | ${SEVERITIES.join(' | ')} |`, `|---|${SEVERITIES.map(() => '---').join('|')}|`);
    for (const u of stand) lines.push(`| \`${u.id}\` | ${SEVERITIES.map((x) => u.standing[x]).join(' | ')} |`);
  }
  lines.push('', '## How strict the reviewers were', '');
  const s = card.sensitivity;
  if (!s) lines.push('Not measured: the config has no control unit.', '');
  else {
    lines.push('| | Chances | Reported | Rate | Verdict |', '|---|---|---|---|---|',
      `| Planted defects | ${s.answers} | ${s.caught} | ${show(s.rate)} | ${s.rate !== null && s.rate < cfg.controlThreshold ? `TOO KIND (below ${cfg.controlThreshold}): treat the scores as an upper bound` : 'acceptable'} |`,
      `| Things known to be right | ${s.clean_answers} | ${s.false_alarms} | ${show(s.false_alarm_rate)} | ${s.false_alarm_rate !== null && s.false_alarm_rate > cfg.falseAlarmThreshold ? `TOO HARSH (above ${cfg.falseAlarmThreshold}): treat the scores as a lower bound` : s.clean_answers ? 'acceptable' : 'not measured'} |`, '');
    if (s.missed.length) lines.push(`Missed by most of their role: ${s.missed.map((m) => `${m.planted} (${m.role}, ${m.caught_by} of ${m.of})`).join('; ')}.`, '');
    if (s.alarmed.length) lines.push(`Flagged by most of their role though known to be right: ${s.alarmed.map((m) => `${m.clean} (${m.role}, ${m.flagged_by} of ${m.of})`).join('; ')}.`, '');
  }
  if (card.warnings.length) lines.push('**Warnings**', '', ...card.warnings.map((w) => `- ${w}`), '');
  if (card.contested.length) lines.push('## Reviewers disagree', '', 'A role whose reviewers disagree is not at target, whatever its average. What they reported is in the fix order: fix it, commit, and review again with fresh reviewers.', '', ...card.contested.map((c) => `- \`${c.unit}\`, ${title(c.role)}: ${c.scores.join(', ')}`), '');
  if (card.capped.length) lines.push('## Scores held to their own issues', '', ...card.capped.map((c) => `- \`${c.unit}\`, ${title(c.role)} reviewer ${c.judge}: gave ${c.given}, counted ${c.counted}, because of ${c.because}`), '');
  if ((card.second_looks || []).length) {
    lines.push('## Issues given a second look', '', 'A major or blocker that one reviewer alone reported is checked by a fresh specialist who sees only that claim and the evidence. The check can keep it, lower it, or find that it does not hold; it cannot raise it.', '',
      '| Journey | Role | Issue | Reported | Now | Why |', '|---|---|---|---|---|---|');
    for (const x of card.second_looks) lines.push(`| \`${x.unit}\` | ${title(x.role)} ${x.criterion} | ${cell(x.statement).slice(0, 140)} | ${x.reported} | ${x.outcome === 'not upheld' ? 'not upheld' : x.severity} | ${cell(x.reason)} |`);
    lines.push('');
  }
  if ((card.rebased || []).length) lines.push('## Scores counted again after a second look', '', 'A reviewer scores with its most serious issue in mind. Where a second look lowered or removed that issue, the score is counted at no less than the anchor for what still stands.', '', ...card.rebased.map((c) => `- \`${c.unit}\`, ${title(c.role)} reviewer ${c.judge}: gave ${c.given}, counted ${c.counted} (was ${c.from}): ${c.because}`), '');
  lines.push('## Fix order (top 20)', '', `Problems: ${SEVERITIES.map((x) => `${card.problem_counts[x]} ${x}`).join(', ')}. Reports: ${SEVERITIES.map((x) => `${card.issue_counts[x]} ${x}`).join(', ')}.`, '',
    '| # | Priority | Severity | Roles | Journeys | Problem | Suggested fix |', '|---|---|---|---|---|---|---|');
  card.fix_list.slice(0, 20).forEach((f, i) => lines.push(`| ${i + 1} | ${f.priority} | ${f.severity} | ${f.roles.map(title).join(', ')} | ${f.units.map((u) => `\`${u}\``).join(', ')} | ${cell(f.label)} | ${f.fix ? cell(f.fix) : ''} |`));
  lines.push('', '## What each reviewer said', '');
  for (const u of real) {
    if (!u.reviewers.length) continue;
    lines.push(`### \`${u.id}\``, '', '| Role | Reviewer | Score | Reason |', '|---|---|---|---|');
    for (const r of u.reviewers) lines.push(`| ${title(r.role)} | ${r.judge} | ${r.counted}${r.counted !== r.given ? ` (gave ${r.given})` : ''} | ${cell(r.reason)} |`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

function renderFindings(card, rubric) {
  const title = (role) => rubric.roles[role].title.replace(/ rubric$/i, '').replace(/^What to report$/, 'Target user');
  const lines = ['# Issues', '', `Run \`${card.run_id}\`. Every issue as its reviewer recorded it. A target user never names a severity: it follows from how that step went for them.`, ''];
  for (const unitId of [...new Set(card.issues.map((f) => f.unit))]) {
    lines.push(`## \`${unitId}\``, '');
    for (const f of card.issues.filter((x) => x.unit === unitId).sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || a.id.localeCompare(b.id))) {
      lines.push(`- **${f.severity}**, ${title(f.role)} ${f.criterion}, \`${f.id}\`${f.step ? `, step \`${f.step}\`` : ''}${f.size ? `, ${f.size}` : ''}: ${f.statement}`);
      if (f.second_look) lines.push(`  - Second look: ${f.reported ? `reported as ${f.reported}, stands as ${f.severity}` : `upheld as ${f.severity}`}. ${f.second_look.reason}`);
      if (f.impact) lines.push(`  - Impact: ${f.impact}`);
      if (f.fix) lines.push(`  - Fix: ${f.fix}`);
      lines.push(`  - Evidence: ${f.evidence.map((e) => `\`${e}\``).join(', ')}`);
    }
    lines.push('');
  }
  const dropped = (card.second_looks || []).filter((x) => x.outcome === 'not upheld');
  if (dropped.length) {
    lines.push(`## Not upheld on a second look (${dropped.length})`, '', 'Reported by one reviewer, checked against the evidence by another, and found not to hold. They are not in the fix order and hold no score down.', '');
    for (const x of dropped) lines.push(`- \`${x.unit}\`, ${title(x.role)} ${x.criterion}, \`${x.id}\`, reported as ${x.reported}: ${x.statement}`, `  - Why not: ${x.reason}`);
    lines.push('');
  }
  const grouped = card.fix_list.filter((g) => g.issues.length > 1);
  if (grouped.length) {
    lines.push(`## Reports taken as one problem (${grouped.length})`, '', 'Grouped by shared wording for the fix order and the problem counts only; no score depends on it. To correct a grouping, write `clusters.json` in the run (a label mapped to the issue ids of one problem) and score again with `--rescore --no-ledger`.', '');
    for (const g of grouped) lines.push(`- ${cell(g.label).slice(0, 160)}`, `  - ${g.issues.map((id) => `\`${id}\``).join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

function cmdScore(args) {
  const rubric = loadRubric(args.config);
  const cfg = loadConfig(args.config, rubric);
  const run = loadRun(args.run);
  if (run.meta.rubric_sha !== rubric.sha) fail(`a rubric, a brief or the scoring rules changed since this run was created (${run.meta.rubric_sha} -> ${rubric.sha}); start a new run`);
  if (run.meta.config_sha !== cfg.configSha) fail(`the config changed since this run was created (${run.meta.config_sha} -> ${cfg.configSha}); start a new run`);
  const card = computeScorecard(cfg, rubric, run);
  if (card.overall_score === null) fail('nothing to score: no collected results');
  const ledger = readLedger(cfg);
  // A run may cover only some journeys (one journey re-reviewed after a fix). Its overall score is then
  // those journeys' score: it is compared with nothing, and each journey is compared with the last time
  // that journey was scored.
  const realUnits = card.units.filter((u) => !u.control);
  const scoredUnits = realUnits.filter((u) => u.overall !== null);
  const complete = scoredUnits.length === realUnits.length;
  card.complete = complete;
  if (!complete) card.warnings.push(`partial run: ${scoredUnits.length} of ${realUnits.length} journeys were reviewed (${scoredUnits.map((u) => u.id).join(', ')}), so the overall and role scores are those journeys' scores, not the application's`);
  const comparable = [...ledger.entries].reverse().filter((e) => e.kind === 'score' && e.run_id !== card.run_id && e.rubric_sha === card.rubric_sha && e.config_sha === card.config_sha);
  const previous = complete ? comparable.find((e) => e.complete !== false) || null : null;
  const previousUnits = {};
  for (const u of scoredUnits) {
    const hit = comparable.map((e) => (e.unit_scores || []).find((x) => x.id === u.id && x.overall !== null)).find(Boolean);
    if (hit) previousUnits[u.id] = hit;
  }
  // The decisions the specialists were handed are part of what they measured against. A change does not
  // break comparison (the file grows by appending), but the scorecard says when it happened.
  const before = comparable[0];
  if (before && (before.decisions_sha || null) !== ((card.decisions || {}).sha || null)) card.warnings.push(`the design decisions handed to the specialists changed since run ${before.run_id} (${before.decisions_sha || 'none'} -> ${(card.decisions || {}).sha || 'none'}); part of any change in score may come from that`);
  writeJson(path.join(run.dir, 'scorecard.json'), card);
  fs.writeFileSync(path.join(run.dir, 'scorecard.md'), renderScorecard(card, cfg, rubric, previous, previousUnits));
  fs.writeFileSync(path.join(run.dir, 'findings.md'), renderFindings(card, rubric));
  const s = card.sensitivity;
  const entry = {
    kind: 'score', run_id: card.run_id, date: card.date, commit: card.commit, mode: card.mode, combine: card.combine, rubric_version: card.rubric_version, rubric_sha: card.rubric_sha, config_sha: card.config_sha, decisions_sha: (card.decisions || {}).sha || null,
    complete, overall_score: card.overall_score, role_scores: card.role_scores, reliable: card.reliable, too_harsh: card.too_harsh,
    sensitivity: s ? { planted: s.planted, answers: s.answers, caught: s.caught, rate: s.rate, clean: s.clean, clean_answers: s.clean_answers, false_alarms: s.false_alarms, false_alarm_rate: s.false_alarm_rate } : null,
    unit_scores: realUnits.map((u) => ({
      id: u.id, overall: u.overall,
      roles: Object.fromEntries(Object.entries(u.roles).map(([r, x]) => [r, x.score])),
      contested: Object.entries(u.roles).filter(([, x]) => x.contested).map(([r]) => r),
      judges: Object.fromEntries(Object.entries(u.roles).map(([r, x]) => [r, x.judges])),
      standing: u.standing
    })),
    problem_counts: card.problem_counts, issue_counts: card.issue_counts, capped: card.capped.length,
    second_looks: Object.fromEntries(['upheld', 'lowered', 'not upheld'].map((o) => [o, card.second_looks.filter((x) => x.outcome === o).length])), unchecked: card.unchecked.length,
    warnings: card.warnings.length
  };
  let ledgerNote = 'not written (--no-ledger)';
  if (!args['no-ledger']) {
    if (ledger.entries.some((e) => e.kind === 'score' && e.run_id === card.run_id) && !args.rescore) ledgerNote = 'already has this run; pass --rescore to append a corrected entry';
    else {
      if (args.rescore) entry.rescore = true;
      // Append only: the ledger is the lifetime record, so earlier lines are never rewritten.
      fs.appendFileSync(ledger.file, JSON.stringify(entry) + '\n');
      ledgerNote = `appended to ${ledger.file}`;
    }
  }
  console.log(JSON.stringify({
    overall_score: card.overall_score, role_scores: card.role_scores, complete, reliable: card.reliable, too_harsh: card.too_harsh,
    previous: previous ? { run_id: previous.run_id, overall_score: previous.overall_score } : null,
    contested: card.contested, capped: card.capped, rebased: card.rebased, second_looks: card.second_looks.map(({ id, reported, outcome, severity }) => ({ id, reported, outcome, severity })), unchecked: card.unchecked,
    sensitivity: card.sensitivity, problem_counts: card.problem_counts,
    warnings: card.warnings, scorecard: path.join(run.dir, 'scorecard.md'), ledger: ledgerNote
  }, null, 2));
}

// ---------------------------------------------------------------- trend
function cmdTrend(args) {
  const rubric = loadRubric(args.config);
  const cfg = loadConfig(args.config, rubric);
  const { entries } = readLedger(cfg);
  if (!entries.length) { console.log('The ledger is empty.'); return; }
  const lines = [`| Date | Run | Commit | Overall | ${ROLES.join(' | ')} | Reviewers | Rubric | Comparable with previous |`, `|---|---|---|---|${ROLES.map(() => '---').join('|')}|---|---|---|`];
  let prev = null;
  for (const e of entries.filter((x) => x.kind === 'score')) {
    const comparable = !prev ? 'first run' : (prev.rubric_sha === e.rubric_sha && prev.config_sha === e.config_sha ? 'yes' : (prev.rubric_sha !== e.rubric_sha ? 'no: rubric changed' : 'no: config changed'));
    const strict = e.sensitivity ? `caught ${e.sensitivity.caught}/${e.sensitivity.answers}${e.sensitivity.clean_answers ? `, false alarms ${e.sensitivity.false_alarms}/${e.sensitivity.clean_answers}` : ''}${e.reliable === false ? ', too kind' : ''}${e.too_harsh ? ', too harsh' : ''}` : 'not measured';
    lines.push(`| ${e.date} | ${e.run_id}${e.rescore ? ' (rescore)' : ''}${e.complete === false ? ' (some journeys only)' : ''} | ${e.commit} | ${show(e.overall_score)} | ${ROLES.map((r) => show((e.role_scores || {})[r])).join(' | ')} | ${strict} | ${e.rubric_version} | ${comparable} |`);
    prev = e;
  }
  console.log(lines.join('\n'));
}

// ---------------------------------------------------------------- progress
// Where every journey stands against a target, read from the ledger alone, so an improvement effort can
// be picked up in any session: which journeys are there, which is next, which have stopped moving.
function cmdProgress(args) {
  const rubric = loadRubric(args.config);
  const cfg = loadConfig(args.config, rubric);
  // The target is the user's to set; there is no default, so a loop never runs to a number nobody chose.
  if (!opt(args, 'target')) fail('--target <N> is required: ask the user which score every role of every journey must reach, and record it in improve.md');
  const target = Number(args.target);
  if (!(target > 0 && target <= 100)) fail('--target must be a number from 1 to 100');
  const { entries } = readLedger(cfg);
  // Only lines measured with today's yardstick and journey list, and only the last line of each run.
  const series = entries.filter((e) => e.kind === 'score' && e.rubric_sha === rubric.sha && e.config_sha === cfg.configSha);
  const lastOfRun = series.filter((e, i) => !series.slice(i + 1).some((x) => x.run_id === e.run_id));
  const real = cfg.units.filter((u) => !u.control);
  const journeys = real.map((unit, order) => {
    const history = lastOfRun.map((e, at) => ({ at, e, u: (e.unit_scores || []).find((x) => x.id === unit.id && x.overall !== null) })).filter((h) => h.u);
    const base = { journey: unit.id, weight: unit.weight || 1, order };
    if (!history.length) return { ...base, state: 'not reviewed', rounds: 0 };
    const last = history[history.length - 1];
    const below = Object.entries(last.u.roles).filter(([, s]) => s !== null && s < target).map(([role, score]) => ({ role, score })).sort((a, b) => a.score - b.score);
    // A role whose reviewers disagree is not at target either, whatever its average: what they reported
    // is fixed and the journey reviewed again with fresh reviewers, like any role below target.
    const disputed = last.u.contested || [];
    const gains = history.slice(1).map((h, i) => round(h.u.overall - history[i].u.overall));
    // Stopped moving: two rounds in a row, each gaining less than STALL_GAIN on the journey's overall
    // score. A stalled journey is not given up: it waits until nothing else is open, then needs a
    // different approach from the rounds that stalled.
    const open = below.length > 0 || disputed.length > 0;
    const stalled = open && gains.length >= 2 && gains.slice(-2).every((g) => g < STALL_GAIN);
    const state = !open ? 'at target' : stalled ? 'stalled' : 'below target';
    return { ...base, state, rounds: history.length, last_run: last.e.run_id, last_at: last.at, overall: last.u.overall, roles: last.u.roles, below, disputed, ...(last.u.standing ? { standing: last.u.standing } : {}), last_gain: gains.length ? gains[gains.length - 1] : null };
  });
  // Next: carry on with the journey worked on most recently if it is still open; otherwise the heaviest
  // untouched one; and when only stalled journeys are left, the one that has waited longest.
  const open = journeys.filter((j) => j.state === 'below target').sort((a, b) => b.last_at - a.last_at);
  const fresh = journeys.filter((j) => j.state === 'not reviewed').sort((a, b) => b.weight - a.weight || a.order - b.order);
  const waited = journeys.filter((j) => j.state === 'stalled').sort((a, b) => a.last_at - b.last_at || b.weight - a.weight);
  const nextJourney = (open[0] || fresh[0] || waited[0] || {}).journey || null;
  // The target is settled only by a confirming run (a line with no mode predates modes and counts as one).
  const isConfirm = (e) => e.mode !== 'screen';
  const lastComplete = [...lastOfRun].reverse().find((e) => e.complete !== false) || null;
  const full = [...lastOfRun].reverse().find((e) => e.complete !== false && isConfirm(e)) || null;
  const screenAllAtTarget = journeys.length > 0 && journeys.every((j) => j.state === 'at target');
  const fullAtTarget = full ? (full.unit_scores || []).every((u) => Object.values(u.roles || {}).every((s) => s === null || s >= target)) : false;
  const fullDisputed = full ? (full.unit_scores || []).filter((u) => (u.contested || []).length).map((u) => ({ journey: u.id, roles: u.contested })) : [];
  const measured = Boolean(full && full.sensitivity && full.sensitivity.rate !== null && full.sensitivity.rate !== undefined);
  const count = (state) => journeys.filter((j) => j.state === state).length;
  // What the number asks for, in issues: the bands the reviewers score in tie a score to what they left standing.
  const inIssues = target >= 90 ? 'no reviewer leaves a blocker, a major or a minor issue standing; only polish is left'
    : target >= 86 ? 'no reviewer leaves a blocker or a major standing, and none leaves more than one minor issue'
      : target >= 80 ? 'no reviewer leaves a blocker or a major standing, and none leaves more than three minor issues'
        : target >= 75 ? 'no reviewer leaves a blocker or a major issue standing'
          : target >= 25 ? 'no reviewer leaves a blocker standing' : 'nothing in particular: a score this low allows a blocker';
  const out = {
    target, target_in_issue_terms: `For every role of every journey, ${target} or more means roughly: ${inIssues}.`, journeys_at_target: count('at target'), below_target: count('below target'), stalled: count('stalled'), not_reviewed: count('not reviewed'),
    next_journey: nextJourney,
    last_screening_full_run: lastComplete && !isConfirm(lastComplete) ? { run_id: lastComplete.run_id, overall_score: lastComplete.overall_score, role_scores: lastComplete.role_scores } : null,
    last_full_run: full ? { run_id: full.run_id, date: full.date, overall_score: full.overall_score, role_scores: full.role_scores, every_role_at_target: fullAtTarget, reviewers_agree: !fullDisputed.length, disputed: fullDisputed, reviewers_strict_enough: full.reliable, reviewers_too_harsh: Boolean(full.too_harsh) } : null,
    // The target is met only by one run of every journey together: every role of every journey at target,
    // the reviewers agreeing on every one, and the control journey showing the reviewers catch enough.
    target_met: Boolean(full && fullAtTarget && !fullDisputed.length && full.reliable && measured),
    journeys: journeys.map(({ order, last_at, ...j }) => j)
  };
  // A plateau: the scores have stopped answering to the work. Either the last two runs of every journey
  // together each gained under STALL_GAIN overall and nothing has been tried since, or every journey
  // still open has itself stopped moving. Going on is then the user's call, not the loop's.
  const completeRuns = lastOfRun.filter((e) => e.complete !== false && notNull(e.overall_score));
  const overallGains = completeRuns.slice(1).map((e, i) => round(e.overall_score - completeRuns[i].overall_score));
  const stillOpen = count('below target') + count('stalled') > 0;
  const flat = stillOpen && overallGains.length >= 2 && overallGains.slice(-2).every((g) => g < STALL_GAIN) && lastOfRun[lastOfRun.length - 1] === completeRuns[completeRuns.length - 1];
  const onlyStalled = count('stalled') > 0 && count('below target') === 0 && count('not reviewed') === 0;
  out.plateau = !out.target_met && (flat || onlyStalled);
  const next = journeys.find((j) => j.journey === nextJourney);
  const what = (j) => [...j.below.map((b) => `${b.role} at ${b.score}`), ...j.disputed.filter((r) => !j.below.some((b) => b.role === r)).map((r) => `${r} reviewers disagree`)].join(', ');
  if (!out.target_met) {
    const why = flat
      ? `the last two runs of every journey together gained ${overallGains.slice(-2).join(' and ')} points overall, each under ${STALL_GAIN}`
      : next && next.state === 'stalled' ? `only stalled journeys are left below target; ${next.journey} has waited longest (${what(next)}): two reviews in a row gained under ${STALL_GAIN} points` : '';
    out.then = out.plateau
      ? `Stop and ask the user: ${why}. More of the same fixing is unlikely to move the score. Their choices: accept the scores as they stand; try a different approach (say what changes from the work recorded in improve.md); lower the target; or go through the standing issues by hand (findings.md of the last run) and choose which are worth fixing. Record the answer in improve.md before any more fixing.${full && full.too_harsh ? ' The control screens show the reviewers flagging things known to be right: tell the user, since the target may be out of reach for the reviewers rather than for the product.' : ''}`
      : next && next.state === 'below target' ? `Work on ${next.journey} (${what(next)}): fix the top of its fix order, commit, and review it again in a new run with fresh reviewers.`
        : nextJourney ? `Review ${nextJourney}: it has not been reviewed yet.`
          : screenAllAtTarget && !(full && fullAtTarget && !fullDisputed.length) ? 'Every journey is at target in screening runs: confirm it with a confirming run of every journey and the control journey (new-run --confirm).'
          : full && fullAtTarget && !fullDisputed.length ? 'Every role is at target in the last confirming run, but how strict the reviewers were was not shown: run a confirming run with the control journey.'
            : 'No journey is left to work on one at a time: run every journey together in a confirming run (new-run --confirm), with the control journey.';
  }
  console.log(JSON.stringify(out, null, 2));
}

// ---------------------------------------------------------------- challenge
// A second look at every major or blocker that one reviewer alone reported: one folder per issue, for a
// fresh specialist of the same role who sees the claim and the evidence and nothing else.
function cmdChallenge(args) {
  const rubric = loadRubric(args.config);
  const cfg = loadConfig(args.config, rubric);
  const run = loadRun(args.run);
  if (run.meta.rubric_sha !== rubric.sha) fail(`a rubric, a brief or the scoring rules changed since this run was created (${run.meta.rubric_sha} -> ${rubric.sha}); start a new run`);
  const only = opt(args, 'unit');
  if (only && !cfg.units.some((u) => u.id === only && !u.control)) fail(`no such journey: ${only}`);
  const tmpRoot = tmpRootFor(args);
  const checks = loadChecks(run);
  const verdicts = loadVerdicts(run);
  const out = [];
  for (const issue of loneSerious(cfg, run)) {
    if (only && issue.unit !== only) continue;
    if (verdicts[issue.id] || checks.list.some((c) => c.issue === issue.id && !c.discarded)) continue;
    const unit = cfg.units.find((u) => u.id === issue.unit);
    const bundle = buildCheckBundle(cfg, rubric, run, unit, issue, tmpRoot);
    checks.list.push(bundle);
    out.push({ issue: issue.id, unit: issue.unit, role: issue.role, severity: issue.severity, ...cfg.starter(bundle.dir) });
  }
  if (checks.list.length) writeJson(checks.file, checks.list);
  console.log(JSON.stringify(out, null, 2));
}

// ---------------------------------------------------------------- regress
// What the capture measured worse than in the earlier run of the same journey, read from the evidence
// alone, before any reviewer is started: a fix that breaks something else shows here first.
const count = (x) => (typeof x === 'number' ? x : typeof x === 'boolean' ? Number(x) : Array.isArray(x) ? x.length : x && typeof x.count === 'number' ? x.count : undefined);
const at = (o, p) => p.split('.').reduce((x, k) => (x === null || x === undefined ? undefined : x[k]), o);
const flip = (x) => (x === undefined ? undefined : Number(!x));
const MEASURES = {
  facts: [
    ['the page scrolls sideways', (f) => count(at(f, 'layout.scrolls_sideways'))],
    ['elements wider than the page', (f) => count(at(f, 'layout.overflowing_elements'))],
    ['controls smaller than 24 px', (f) => count(at(f, 'targets.smaller_than_24px'))],
    ['form fields without a label', (f) => count(at(f, 'labels.fields_without_label'))],
    ['controls without a name', (f) => count(at(f, 'labels.controls_without_name'))],
    ['images without a text alternative', (f) => count(at(f, 'labels.images_without_alt'))],
    ['text below the required contrast', (f) => count(at(f, 'text.below_required_contrast'))],
    ['text smaller than 12 px', (f) => count(at(f, 'text.smaller_than_12px'))],
    ['text that was never filled in', (f) => count(at(f, 'text.never_filled_in'))],
    ['links that lead nowhere', (f) => count(at(f, 'links.lead_nowhere'))],
    ['skipped heading levels', (f) => count(at(f, 'structure.skipped_heading_levels'))],
    ['not exactly one top-level heading', (f) => (typeof at(f, 'structure.h1_count') === 'number' ? Number(f.structure.h1_count !== 1) : undefined)],
    ['no main landmark', (f) => flip(at(f, 'structure.has_main_landmark'))],
    ['dialogs larger than the screen', (f) => (Array.isArray(at(f, 'structure.open_dialogs')) ? f.structure.open_dialogs.filter((d) => d.exceeds_viewport).length : undefined)]
  ],
  keyboard: [
    ['keyboard stops that show no focus', (k) => count(at(k, 'summary.nothing_shows_focus'))],
    ['controls the keyboard never reached', (k) => count(at(k, 'summary.never_reached'))],
    ['keyboard stops covered by something else', (k) => count(at(k, 'summary.focus_covered_by_something_else'))]
  ],
  motion: [
    ['things that still move when reduced motion is asked for', (m) => count(at(m, 'with_reduced_motion.elements_that_can_still_move'))]
  ]
};
function measuresOf(evidenceDir) {
  const out = new Map();
  for (const [kind, list] of Object.entries(MEASURES)) {
    const dir = path.join(evidenceDir, kind);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      let data;
      try { data = readJson(path.join(dir, file)); } catch (_) { continue; }
      const key = file.replace(/\.json$/, '');
      for (const [what, read] of list) {
        const n = read(data);
        if (n === undefined) continue;
        if (!out.has(key)) out.set(key, {});
        out.get(key)[what] = n;
      }
    }
  }
  return out;
}

function cmdRegress(args) {
  const rubric = loadRubric(args.config);
  const cfg = loadConfig(args.config, rubric);
  const run = loadRun(args.run);
  const against = opt(args, 'against') ? loadRun(args.against, '--against') : null;
  const only = opt(args, 'unit');
  const runsDir = path.dirname(run.dir);
  // When a run was opened: what it recorded itself, or the time of its run.json for runs opened before that was recorded.
  const born = (dir) => { const file = path.join(dir, 'run.json'); let at = NaN; try { at = Date.parse(readJson(file).created_at); } catch (_) { /* fall through */ } return Number.isNaN(at) ? fs.statSync(file).mtimeMs : at; };
  const earlier = against ? [against.dir]
    : fs.readdirSync(runsDir).map((d) => path.join(runsDir, d)).filter((d) => d !== run.dir && fs.existsSync(path.join(d, 'run.json')) && born(d) < born(run.dir)).sort((a, b) => born(b) - born(a));
  const out = {
    how_to_read: 'Each entry under "regressions" is something the capture counted that is higher than in the earlier capture of the same journey, step and screen size. A rise is a reason to look at that screen and put it right before any reviewer is started; it is not a verdict, and a rise that is intended can be left. "fixed" lists what went down.',
    against: {}, regressions: [], fixed: [], not_compared: []
  };
  for (const unit of cfg.units.filter((u) => !u.control && (!only || u.id === only))) {
    const now = measuresOf(path.join(run.dir, 'evidence', unit.id));
    if (!now.size) { out.not_compared.push({ unit: unit.id, why: 'this run holds no measurements for it' }); continue; }
    const prevDir = earlier.find((d) => measuresOf(path.join(d, 'evidence', unit.id)).size > 0);
    if (!prevDir) { out.not_compared.push({ unit: unit.id, why: 'no earlier run holds measurements for it' }); continue; }
    out.against[unit.id] = path.basename(prevDir);
    const before = measuresOf(path.join(prevDir, 'evidence', unit.id));
    for (const [key, values] of now) {
      const [step, size] = key.split('.');
      const old = before.get(key);
      if (!old) { out.not_compared.push({ unit: unit.id, step, size, why: 'not in the earlier capture' }); continue; }
      for (const [what, after] of Object.entries(values)) {
        if (old[what] === undefined || old[what] === after) continue;
        (after > old[what] ? out.regressions : out.fixed).push({ unit: unit.id, step, size, what, before: old[what], after });
      }
    }
  }
  console.log(JSON.stringify(out, null, 2));
  if (out.regressions.length) process.exitCode = 2;
}

const COMMANDS = { status: cmdStatus, progress: cmdProgress, 'new-run': cmdNewRun, bundle: cmdBundle, collect: cmdCollect, challenge: cmdChallenge, score: cmdScore, regress: cmdRegress, trend: cmdTrend };

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const cmd = COMMANDS[args._[0]];
  if (!cmd) fail(`usage: uxq.cjs <${Object.keys(COMMANDS).join('|')}> --config <config.json> [--run <run-dir>] ...`);
  cmd(args);
}

// The roles and their evidence are read when asked for: they are the set's once a config names one.
module.exports = { get ROLES() { return ROLES; }, get SPECIALISTS() { return SPECIALISTS; }, get EVIDENCE_KINDS() { return EVIDENCE_KINDS; }, REBASE, disagree, reviewerResult, validateVerdict, numberedDecisions, groupFindings, validateSpecialist, validateUser, loadRubric, loadConfig, loadRun, expectedScreens, spawnPrompt, CAP, FINISHED_CAP, OUTCOME_SEVERITY, SEVERITY_WEIGHT };
