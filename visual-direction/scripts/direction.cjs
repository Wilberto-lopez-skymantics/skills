#!/usr/bin/env node
'use strict';
// visual-direction: the look of a product, chosen once by its owner from candidates that have to differ.
// No dependencies. Node 18 or later.   node direction.cjs <command> --dir <direction folder> [...]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SKILL = path.resolve(__dirname, '..');

// What two candidates are compared on. Each is read from the candidate's own values, never declared.
const AXES = ['display_type', 'text_type', 'accent_hue', 'neutrals', 'ground', 'corners', 'separation', 'density'];
const TYPE_AXES = ['display_type', 'text_type'];
const COLOUR_AXES = ['accent_hue', 'neutrals', 'ground'];
const CLASSES = ['serif', 'sans', 'slab', 'mono', 'script'];
const WIDTHS = ['condensed', 'normal', 'wide'];
const SEPARATIONS = ['rules', 'shadow', 'fill', 'space'];
const BANDS = ['accent', 'inverse', 'raised'];
const KINDS = ['own-world', 'other-craft', 'other-software', 'same-category', 'owner'];
const SURFACES = ['product', 'landing'];
const STATUSES = ['success', 'warning', 'danger', 'info'];
const ROLES = [
  'surface', 'surface-raised', 'text-default', 'text-muted', 'border', 'border-control',
  'accent', 'text-on-accent', 'text-accent', 'focus-ring',
  'danger', 'text-on-danger', 'text-danger', 'text-warning', 'text-success', 'text-info'
];
// A look may draw a status as a filled patch with its word on it, and not as a coloured mark and word.
// It then gives these too (danger and its label are among the roles above already).
const PATCH_ROLES = ['success', 'text-on-success', 'warning', 'text-on-warning', 'info', 'text-on-info'];
const PATCH_PAIRS = [
  ['text-on-success', 'success', 'The word on a patch for done and passed', 4.5],
  ['text-on-warning', 'warning', 'The word on a patch for a warning', 4.5],
  ['text-on-info', 'info', 'The word on a patch for a note', 4.5]
];
// The colour contract: every pair a screen is allowed to put together, and the ratio it must reach.
// The two fills are waived where the main action carries an edge (shape.action_edge).
const PAIRS = [
  ['text-default', 'surface', 'Body text, table cells', 4.5],
  ['text-default', 'surface-raised', 'Text on cards, panels and dialogs', 4.5],
  ['text-muted', 'surface', 'Captions, helper text, placeholders', 4.5],
  ['text-muted', 'surface-raised', 'Captions and helper text on cards and dialogs', 4.5],
  ['text-on-accent', 'accent', 'Label of the main action', 4.5],
  ['text-accent', 'surface', 'Links and quiet actions', 4.5],
  ['text-accent', 'surface-raised', 'Links and quiet actions on cards and dialogs', 4.5],
  ['text-danger', 'surface', 'Error messages', 4.5],
  ['text-danger', 'surface-raised', 'Error messages on cards and dialogs', 4.5],
  ['text-on-danger', 'danger', 'Label of a destructive button', 4.5],
  ['text-warning', 'surface', 'Warnings, with an icon and a word', 4.5],
  ['text-warning', 'surface-raised', 'Warnings on cards and in tables', 4.5],
  ['text-success', 'surface', 'Done and passed, with an icon and a word', 4.5],
  ['text-success', 'surface-raised', 'Done and passed, on cards and in tables', 4.5],
  ['text-info', 'surface', 'Notes, with an icon and a word', 4.5],
  ['text-info', 'surface-raised', 'Notes on cards and in tables', 4.5],
  ['border-control', 'surface', 'Edges of fields, checkboxes and quiet buttons', 3],
  ['border-control', 'surface-raised', 'Edges of fields on cards and dialogs', 3],
  ['focus-ring', 'surface', 'Focus indicator', 3],
  ['focus-ring', 'surface-raised', 'Focus indicator on cards and dialogs', 3],
  ['accent', 'surface', 'The fill of the main action against the page', 3, 'fill'],
  ['danger', 'surface', 'The fill of a destructive button against the page', 3, 'fill']
];

const patches = (c) => isObj(c.shape) && c.shape.status === 'patch';
const pairsOf = (c) => (patches(c) ? [...PAIRS, ...PATCH_PAIRS] : PAIRS);
const rolesOf = (c) => (patches(c) ? [...ROLES, ...PATCH_ROLES] : ROLES);

class Refusal extends Error {}
const refuse = (msg) => { throw new Refusal(msg); };

// ---------------------------------------------------------------------------------------- small things

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = true;
    else { out[a.slice(2)] = next; i++; }
  }
  return out;
}
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// Days are the days of whoever is working, not of Greenwich.
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => day(new Date());
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const sentence = (s) => { const t = String(s).trim(); return /[.!?]$/.test(t) ? t : `${t}.`; };
const round1 = (n) => Math.round(n * 10) / 10;
const floor2 = (n) => Math.floor(n * 100) / 100;   // a ratio is never rounded up to a pass

function readText(file, what) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return refuse(`${what || file} is not there: ${file}`); }
}
function readJson(file, what) {
  const text = readText(file, what);
  try { return JSON.parse(text); } catch (e) { return refuse(`${file} is not valid JSON: ${e.message}`); }
}
function writeFile(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
function strArg(args, key, why) {
  if (!isStr(args[key])) refuse(`--${key} is needed${why ? `: ${why}` : ''}.`);
  return String(args[key]).trim();
}
function dateArg(args) {
  const d = args.date === undefined ? today() : String(args.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) refuse('--date is a day written YYYY-MM-DD.');
  return d;
}
function namesArg(value, flag, allowed) {
  if (!isStr(value)) return [];
  const names = String(value).split(',').map((s) => s.trim()).filter(Boolean);
  for (const n of names) if (allowed && !allowed.includes(n)) refuse(`--${flag}: "${n}" is not one of ${allowed.join(', ')}.`);
  if (new Set(names).size !== names.length) refuse(`--${flag} names something twice.`);
  return names;
}

// ---------------------------------------------------------------------------------------- colour

function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  const t = hex.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(t);
  if (m) return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16) / 255);
  m = /^#([0-9a-f]{6})$/i.exec(t);
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : null;
}
const linear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function luminance(rgb) { const [r, g, b] = rgb.map(linear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function contrast(hexA, hexB) {
  const a = luminance(parseHex(hexA)), b = luminance(parseHex(hexB));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
// Lightness, colourfulness and hue as people see them (OKLCH), which is what "a different colour" means here.
function oklch(hex) {
  const [r, g, b] = parseHex(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(A, B), h };
}
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const COLOURLESS = 0.04;   // below this an accent reads as a grey, whatever its hue
function hueName(h) {
  const names = [[12, 'rose'], [33, 'red'], [72, 'orange'], [115, 'yellow'], [160, 'green'], [205, 'teal'], [250, 'sky'], [280, 'blue'], [315, 'violet'], [345, 'magenta'], [361, 'rose']];
  return names.find(([upTo]) => h < upTo)[1];
}

// ---------------------------------------------------------------------------------------- the candidate

function blankCandidate(id, surfaces) {
  const family = () => ({ family: '', class: '', width: 'normal', fallback: '', source: '', licence: '' });
  const c = {
    id, name: '', idea: '', gives_up: '',
    drawn_from: [{ ref: '', took: '' }, { ref: '', took: '' }],
    brings_to_mind: ['', '', ''],
    refuses: ['', ''],
    signature: [{ what: '' }],
    signature_css: '',
    type: { families: { text: family(), display: family(), mono: family() }, numerals: 'tabular', labels: { case: 'sentence', tracking_em: 0 } },
    colour: { default_mode: 'light', modes: { light: Object.fromEntries(ROLES.map((r) => [r, ''])) }, meanings: { accent: '', danger: '', warning: '', success: '', info: '' } },
    shape: { radius_control: null, radius_container: null, border_width: null, separation: '', shadow: '', action_edge: false, status: 'mark', icons: { family: '', stroke: null, licence: '' } },
    space: { scale: [] },
    motion: { reduced: '', control_ms: null, section_ms: null },
    imagery: { kind: '', treatment: '', never: '' },
    voice: { speaks_to: '', tone: '', capitalisation: '', uses: [], avoids: [] }
  };
  if (surfaces.includes('product')) {
    c.signature[0].product = '';
    c.type.product = { caption: null, control: null, body: null, heading: null, title: null, weight_text: null, weight_label: null, weight_heading: null, line_height: null };
    c.colour.product_use = '';
    c.space.product = { control_height: null, row_height: null, touch_control_height: null, gutter: null };
    c.motion.product = '';
  }
  if (surfaces.includes('landing')) {
    c.signature[0].landing = '';
    c.type.landing = { body: null, lead: null, h3: null, h2: null, display: null, display_weight: null, display_tracking_em: null, display_line_height: null, measure_ch: null };
    c.colour.landing_use = '';
    c.colour.landing_band = 'accent';
    c.space.landing = { control_height: null, section_gap: null, gutter: null };
    c.motion.landing = '';
  }
  return c;
}

// Everything one candidate has to be before it is worth showing: complete, and above the floor that no
// choice of look may go below. ctx: { id, surfaces, refs (by id) or null, adopt }.
function checkCandidate(c, ctx) {
  const problems = [], warnings = [];
  const P = (m) => { problems.push(m); return false; };
  const out = { problems, warnings, axes: null, contrast: [] };
  if (!isObj(c)) { P('It is not an object.'); return out; }
  const surfaces = ctx.surfaces;
  const str = (v, where, what) => (isStr(v) ? true : P(`${where} is empty${what ? `: ${what}` : ''}.`));
  const num = (v, where, min, why) => {
    if (!isNum(v)) return P(`${where} is not a number.`);
    if (min !== undefined && v < min) return P(`${where} is ${v}, and at least ${min} is needed${why ? `: ${why}` : ''}.`);
    return true;
  };
  const strings = (v, where, min, max, what) => {
    if (!Array.isArray(v) || v.some((x) => !isStr(x))) return P(`${where} is a list of ${what}, none of them empty.`);
    if (v.length < min || v.length > max) return P(`${where} holds ${v.length}, and ${min === max ? min : `${min} to ${max}`} ${min === max && min === 1 ? 'is' : 'are'} needed: ${what}.`);
    return true;
  };

  if (ctx.id && c.id !== ctx.id) P(`id is ${JSON.stringify(c.id)}, and the file is named for "${ctx.id}".`);
  str(c.name, 'name', 'the name the owner will know it by');
  str(c.idea, 'idea', 'the direction in one sentence');
  const dressed = !ctx.adopt && isStr(c.idea) && c.idea.match(/\b(?:page|site|product|app|interface|screen)s?\s+as\s+(?:a|an|the)\s+[^,:.;]+/i);
  if (dressed) warnings.push(`idea says what the product is dressed as ("${dressed[0].trim()}"). Say what the look does with type, colour and line, and where each came from. A look that acts one object out in every part is read as a costume, and is one of the surest signs of a generated page.`);

  if (!ctx.adopt) {
    str(c.gives_up, 'gives_up', 'what the product loses by taking this look, in a sentence, so that the owner hears it from you and not from a user');
    strings(c.brings_to_mind, 'brings_to_mind', 3, 3, 'three words the look should bring to mind');
    strings(c.refuses, 'refuses', 2, 6, 'things this look never does, each one checkable on a screen');
    if (!Array.isArray(c.signature) || c.signature.length < 1 || c.signature.length > 3) P('signature holds one to three things that are this look\'s own.');
    else c.signature.forEach((s, i) => {
      if (!isObj(s)) { P(`signature[${i}] is not an object.`); return; }
      str(s.what, `signature[${i}].what`, 'the thing itself');
      for (const surface of surfaces) str(s[surface], `signature[${i}].${surface}`, `where it shows in the ${surface === 'product' ? 'product' : 'landing page'}`);
    });
    if (!Array.isArray(c.drawn_from) || c.drawn_from.length < 2) P('drawn_from names at least two references: a direction taken from one thing is a copy of it.');
    else {
      const ids = [];
      c.drawn_from.forEach((d, i) => {
        if (!isObj(d) || !isStr(d.ref)) { P(`drawn_from[${i}].ref is empty: the id of a note in references.md, such as R2.`); return; }
        str(d.took, `drawn_from[${i}].took`, 'which of its properties this direction takes');
        ids.push(d.ref.trim());
        if (ctx.refs && !ctx.refs[d.ref.trim()]) P(`drawn_from[${i}].ref is ${d.ref.trim()}, and references.md has no note with that id.`);
      });
      if (new Set(ids).size !== ids.length) P('drawn_from names the same reference twice.');
      if (ctx.refs && ids.length >= 2 && ids.every((id) => ctx.refs[id] && ctx.refs[id].kind === 'same-category')) {
        P('drawn_from holds only products of the same category: those show what to stand apart from, and a direction has to come from somewhere else as well.');
      }
    }
  }
  if (c.signature_css !== undefined && c.signature_css !== '') {
    if (typeof c.signature_css !== 'string') P('signature_css is CSS as one string.');
    else {
      const css = c.signature_css;
      const bad = [
        [/display\s*:\s*none|visibility\s*:\s*hidden|content-visibility|clip-path|text-indent\s*:\s*-|opacity\s*:\s*0?\.?0+\s*(;|\}|$)|(font-size|(max-)?height|(max-)?width)\s*:\s*0(px|em|rem|%)?\s*(;|\}|$)/im, 'hides something'],
        [/content\s*:\s*["'][^"']*[A-Za-z0-9][^"']*["']/i, 'writes words onto the page'],
        [/@import|url\s*\(/i, 'brings in a file from outside'],
        [/<\s*\/?\s*style|<\s*script/i, 'leaves the style element'],
        [/\border\s*:|position\s*:\s*(absolute|fixed)|float\s*:/i, 'moves something out of its place']
      ].filter(([re]) => re.test(css)).map(([, what]) => what);
      if (bad.length) P(`signature_css ${list(bad)}. It may change how the parts are drawn, never which words are on the page or where the parts are: every candidate is shown on the same skeleton.`);
      const small = [...css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 12);
      if (small.length) P(`signature_css sets text at ${list([...new Set(small)].map((n) => `${n} px`))}. Nothing a person needs to read is below 12 px.`);
      const own = [...new Set((css.match(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black)\b|background(?:-color)?\s*:\s*currentcolor/gi) || []).map((m) => m.toLowerCase().replace(/\s+/g, ' ')))];
      if (own.length) warnings.push(`signature_css brings colours of its own (${own.slice(0, 4).join(', ')}${own.length > 4 ? ', ...' : ''}). They do not follow the modes, and the pairs they make are not measured here. Use the --vd-* colours; for words on a filled patch, shape.status "patch" gives roles that are measured. Where a pair of its own remains, measure it and say so when the candidate is shown.`);
    }
  }

  // type
  const fams = isObj(c.type) && isObj(c.type.families) ? c.type.families : null;
  let typeOk = !!fams;
  if (!fams) P('type.families is missing.');
  else {
    if (!isObj(fams.text)) typeOk = P('type.families.text is missing: the family running text is set in.');
    for (const role of ['text', 'display', 'mono']) {
      const f = fams[role];
      if (f === undefined) continue;
      const where = `type.families.${role}`;
      if (!isObj(f)) { typeOk = P(`${where} is not an object.`); continue; }
      if (!isStr(f.family)) { typeOk = P(`${where}.family is empty: name the family${role === 'text' ? '' : `, or take ${where} out if the direction has none`}.`); continue; }
      if (/["\\;{}<>\n]/.test(f.family)) typeOk = P(`${where}.family holds a character a family name cannot have.`);
      if (!CLASSES.includes(f.class)) typeOk = P(`${where}.class is ${JSON.stringify(f.class)}: one of ${CLASSES.join(', ')}.`);
      if (f.width !== undefined && !WIDTHS.includes(f.width)) typeOk = P(`${where}.width is ${JSON.stringify(f.width)}: one of ${WIDTHS.join(', ')}.`);
      if (!isStr(f.fallback) || !/^[A-Za-z0-9 ,'-]+$/.test(f.fallback)) P(`${where}.fallback is the family to fall back on, such as "sans-serif" or "Georgia, serif".`);
      if (!isStr(f.licence)) P(`${where}.licence is empty: say under what licence this family may be used, or that it is still to be bought.`);
      else if (/\b(to be bought|not bought|not yet bought|unlicensed|unknown|to be confirmed|tbc|tbd)\b/i.test(f.licence)) warnings.push(`${where}.licence says the family is not in hand yet ("${f.licence.trim()}"). Say so, and what it costs, when this candidate is shown.`);
      const s = f.source;
      const okSource = s === 'system'
        || (isObj(s) && isStr(s.stylesheet) && /^https:\/\/[^\s"'<>]+$/.test(s.stylesheet))
        || (isObj(s) && Array.isArray(s.files) && s.files.length > 0 && s.files.every((x) => isObj(x) && isStr(x.path) && !/["'()<>\\]|^\/|\.\./.test(x.path)));
      if (!okSource) P(`${where}.source says where the family is loaded from: "system", {"stylesheet": "https://..."}, or {"files": [{"path": "fonts/x.woff2", "weight": "400", "style": "normal"}]} with paths inside the direction folder.`);
    }
    if (c.type.numerals !== undefined && !['tabular', 'proportional'].includes(c.type.numerals)) P('type.numerals is "tabular" or "proportional".');
    if (c.type.labels !== undefined) {
      if (!isObj(c.type.labels) || !['sentence', 'upper'].includes(c.type.labels.case) || !isNum(c.type.labels.tracking_em)) P('type.labels is {"case": "sentence" or "upper", "tracking_em": a number}.');
    }
    if (surfaces.includes('product')) {
      const p = c.type.product;
      if (!isObj(p)) P('type.product is missing: the sizes and weights of the product.');
      else {
        num(p.caption, 'type.product.caption', 12, 'nothing a person needs to read is below 12 px');
        num(p.control, 'type.product.control', 13, 'supporting text is at least 13 px');
        num(p.body, 'type.product.body', 16, 'body text is at least 16 px');
        num(p.heading, 'type.product.heading'); num(p.title, 'type.product.title');
        if ([p.caption, p.control, p.body, p.heading, p.title].every(isNum) && !(p.caption <= p.control && p.control <= p.body && p.body < p.heading && p.heading <= p.title)) {
          P('type.product sizes do not rise from caption to title: caption, control, body, then a heading larger than body, then the title.');
        }
        num(p.weight_text, 'type.product.weight_text', 400, 'text below 18 px is not set lighter than regular');
        num(p.weight_label, 'type.product.weight_label', 400); num(p.weight_heading, 'type.product.weight_heading', 400);
        num(p.line_height, 'type.product.line_height', 1.4, 'text that wraps needs line spacing of at least 1.4');
      }
    }
    if (surfaces.includes('landing')) {
      const l = c.type.landing;
      if (!isObj(l)) P('type.landing is missing: the sizes of the landing page.');
      else {
        num(l.body, 'type.landing.body', 16, 'body text is at least 16 px');
        num(l.lead, 'type.landing.lead'); num(l.h3, 'type.landing.h3'); num(l.h2, 'type.landing.h2'); num(l.display, 'type.landing.display');
        if ([l.body, l.lead, l.h3, l.h2, l.display].every(isNum) && !(l.body <= l.lead && l.lead <= l.h2 && l.h3 <= l.h2 && l.h2 < l.display)) {
          P('type.landing sizes do not rise: body, lead, the headings, then a display size larger than every heading.');
        }
        num(l.display_weight, 'type.landing.display_weight', 100);
        if (!isNum(l.display_tracking_em)) P('type.landing.display_tracking_em is not a number.');
        else if (l.display_tracking_em < -0.04) warnings.push(`type.landing.display_tracking_em is ${l.display_tracking_em}. Below -0.04 em letters lose their own shapes.`);
        if (isNum(l.display) && l.display > 96) warnings.push(`type.landing.display is ${l.display} px. Above 96 px a window holds a few words and little else, so a headline that is a sentence pushes the line under it and the action out. Keep it only for a headline of a few words, and say so when this candidate is shown.`);
        if (!isNum(l.display_line_height) || l.display_line_height < 0.9 || l.display_line_height > 1.4) P('type.landing.display_line_height is between 0.9 and 1.4.');
        if (!isNum(l.measure_ch) || l.measure_ch < 45 || l.measure_ch > 75) P('type.landing.measure_ch is the length of a line of running text, 45 to 75 characters.');
      }
    }
  }

  // shape and space
  const shape = c.shape;
  let shapeOk = isObj(shape);
  if (!shapeOk) P('shape is missing.');
  else {
    shapeOk = num(shape.radius_control, 'shape.radius_control', 0) && shapeOk;
    num(shape.radius_container, 'shape.radius_container', 0);
    num(shape.border_width, 'shape.border_width', 1, 'a field and a quiet button are found by their edge');
    if (!SEPARATIONS.includes(shape.separation)) shapeOk = P(`shape.separation is how one thing is told from the next: one of ${SEPARATIONS.join(', ')}.`);
    if (!isStr(shape.shadow) || !/^[#\w\s.,%()\/-]+$/.test(shape.shadow)) P('shape.shadow is a CSS shadow, or "none".');
    else if (shape.separation === 'shadow' && shape.shadow.trim() === 'none') P('shape.separation is "shadow" and shape.shadow is "none".');
    if (shape.action_edge !== undefined && typeof shape.action_edge !== 'boolean') P('shape.action_edge is true or false.');
    if (shape.status !== undefined && !['mark', 'patch'].includes(shape.status)) P('shape.status is how a status is drawn: "mark" for a coloured icon and word, or "patch" for the word on a filled patch.');
    if (!isObj(shape.icons) || !isStr(shape.icons.family) || !isNum(shape.icons.stroke) || !isStr(shape.icons.licence)) P('shape.icons is {"family": the one icon family, "stroke": its line in px, "licence": its licence}.');
  }
  const space = c.space;
  let spaceOk = isObj(space);
  if (!spaceOk) P('space is missing.');
  else {
    const scale = space.scale;
    const scaleOk = Array.isArray(scale) && scale.length >= 7 && scale.every(isNum) && scale.every((v, i) => v > 0 && (i === 0 || v > scale[i - 1]));
    if (!scaleOk) spaceOk = P('space.scale is the spacing steps in px, rising, at least seven of them.');
    if (surfaces.includes('product')) {
      const p = space.product;
      if (!isObj(p)) spaceOk = P('space.product is missing.');
      else {
        num(p.control_height, 'space.product.control_height', 24, 'no target is smaller than 24 px');
        if (!num(p.row_height, 'space.product.row_height', 24)) spaceOk = false;
        num(p.touch_control_height, 'space.product.touch_control_height', 44, 'on touch screens main controls are 44 px');
        if (num(p.gutter, 'space.product.gutter', 0) && scaleOk && !scale.includes(p.gutter)) P(`space.product.gutter is ${p.gutter}, which is not a step of the scale.`);
      }
    }
    if (surfaces.includes('landing')) {
      const l = space.landing;
      if (!isObj(l)) spaceOk = P('space.landing is missing.');
      else {
        num(l.control_height, 'space.landing.control_height', 44, 'the main action is at least 44 px high');
        if (!num(l.section_gap, 'space.landing.section_gap', 0)) spaceOk = false;
        else if (scaleOk && !scale.includes(l.section_gap)) P(`space.landing.section_gap is ${l.section_gap}, which is not a step of the scale.`);
        if (num(l.gutter, 'space.landing.gutter', 0) && scaleOk && !scale.includes(l.gutter)) P(`space.landing.gutter is ${l.gutter}, which is not a step of the scale.`);
      }
    }
  }

  // motion, imagery, voice
  if (!isObj(c.motion)) P('motion is missing.');
  else {
    for (const surface of surfaces) str(c.motion[surface], `motion.${surface}`, `what moves in the ${surface === 'product' ? 'product' : 'landing page'}, or that nothing does`);
    str(c.motion.reduced, 'motion.reduced', 'what happens when a person has asked for less motion');
    num(c.motion.control_ms, 'motion.control_ms', 0); num(c.motion.section_ms, 'motion.section_ms', 0);
  }
  if (surfaces.includes('landing') || c.imagery !== undefined) {
    if (!isObj(c.imagery)) P('imagery is missing: what the pictures are.');
    else { str(c.imagery.kind, 'imagery.kind', 'what the pictures are of'); str(c.imagery.treatment, 'imagery.treatment', 'how they are shown'); str(c.imagery.never, 'imagery.never', 'what is never used as a picture'); }
  }
  if (!isObj(c.voice)) P('voice is missing.');
  else {
    str(c.voice.speaks_to, 'voice.speaks_to'); str(c.voice.tone, 'voice.tone'); str(c.voice.capitalisation, 'voice.capitalisation');
    for (const k of ['uses', 'avoids']) if (!Array.isArray(c.voice[k]) || c.voice[k].some((x) => !isStr(x))) P(`voice.${k} is a list of words, which may be empty.`);
  }

  // colour
  const colour = c.colour;
  let colourOk = isObj(colour) && isObj(colour.modes) && Object.keys(colour.modes).length > 0;
  if (!colourOk) P('colour.modes is missing: at least one mode, each with every colour role.');
  else {
    for (const [mode, values] of Object.entries(colour.modes)) {
      if (!/^[a-z][a-z0-9-]*$/.test(mode)) colourOk = P(`colour.modes: "${mode}" is not a name for a mode: small letters, digits and hyphens.`);
      if (!isObj(values)) { colourOk = P(`colour.modes.${mode} is not an object.`); continue; }
      for (const role of rolesOf(c)) if (!parseHex(values[role])) colourOk = P(`colour.modes.${mode}.${role} is ${JSON.stringify(values[role])}: a colour written #rrggbb${PATCH_ROLES.includes(role) ? ', needed because shape.status is "patch"' : ''}.`);
      const extra = Object.keys(values).filter((k) => !ROLES.includes(k) && !PATCH_ROLES.includes(k));
      if (extra.length) P(`colour.modes.${mode} holds ${list(extra)}, which ${extra.length === 1 ? 'is not a role' : 'are not roles'}. The roles are: ${ROLES.join(', ')}; and, where shape.status is "patch", ${PATCH_ROLES.join(', ')}.`);
      const unused = patches(c) ? [] : Object.keys(values).filter((k) => PATCH_ROLES.includes(k));
      if (unused.length) warnings.push(`colour.modes.${mode} gives ${list(unused)}, which are used only where shape.status is "patch".`);
    }
    if (!isStr(colour.default_mode) || !colour.modes[colour.default_mode]) colourOk = P('colour.default_mode names one of the modes.');
    if (!isObj(colour.meanings)) P('colour.meanings is missing: what the accent and each status colour mean.');
    else for (const k of ['accent', ...STATUSES]) str(colour.meanings[k], `colour.meanings.${k}`, 'the one thing this colour means');
    for (const surface of surfaces) str(colour[`${surface}_use`], `colour.${surface}_use`, `how much colour the ${surface === 'product' ? 'product' : 'landing page'} uses, and where`);
    if (surfaces.includes('landing') && !BANDS.includes(colour.landing_band)) P(`colour.landing_band is what a full-width band is filled with: one of ${BANDS.join(', ')}.`);
  }
  if (colourOk) {
    const edge = isObj(shape) && shape.action_edge === true;
    for (const [mode, values] of Object.entries(colour.modes)) {
      for (const [fg, bg, use, min, kind] of pairsOf(c)) {
        const ratio = contrast(values[fg], values[bg]);
        const waived = kind === 'fill' && edge;
        const ok = waived || ratio >= min;
        out.contrast.push({ mode, foreground: fg, background: bg, used_for: use, ratio: floor2(ratio), minimum: min, ok, ...(waived && ratio < min ? { waived: 'the main action carries an edge' } : {}) });
        if (!ok) {
          P(`colour.modes.${mode}: ${fg} on ${bg} measures ${floor2(ratio)} to 1, and ${min} to 1 is needed (${use.toLowerCase()})${kind === 'fill' ? '. Darken or lighten it, or give the main action an edge: shape.action_edge true' : ''}.`);
        }
      }
      // One colour, one meaning: the accent is not also the colour of an error.
      const accent = oklch(values.accent), danger = oklch(values.danger);
      if (accent.C >= COLOURLESS && danger.C >= COLOURLESS && hueGap(accent.h, danger.h) < 30) {
        P(`colour.modes.${mode}: accent and danger are ${Math.round(hueGap(accent.h, danger.h))} degrees of hue apart. One colour has one meaning: the accent cannot also read as an error.`);
      }
      for (const s of ['text-warning', 'text-success', 'text-info']) {
        const o = oklch(values[s]);
        if (accent.C >= COLOURLESS && o.C >= COLOURLESS && hueGap(accent.h, o.h) < 20) warnings.push(`colour.modes.${mode}: accent and ${s} are ${Math.round(hueGap(accent.h, o.h))} degrees of hue apart, so the accent may read as that status.`);
      }
      const statusText = ['text-danger', 'text-warning', 'text-success', 'text-info'].map((r) => [r, oklch(values[r])]);
      for (let i = 0; i < statusText.length; i++) for (let j = i + 1; j < statusText.length; j++) {
        const [a, x] = statusText[i], [b, y] = statusText[j];
        if (x.C >= COLOURLESS && y.C >= COLOURLESS && hueGap(x.h, y.h) < 20) warnings.push(`colour.modes.${mode}: ${a} and ${b} are ${Math.round(hueGap(x.h, y.h))} degrees of hue apart. They are told apart by their icon and word only.`);
      }
    }
  }

  if (typeOk && colourOk && shapeOk && spaceOk) out.axes = axesOf(c, surfaces);
  return out;
}

// Where a candidate sits on each thing candidates are compared on.
function axesOf(c, surfaces) {
  const fams = c.type.families;
  const display = fams.display || fams.text;
  const mode = c.colour.modes[c.colour.default_mode];
  const accent = oklch(mode.accent);
  // The temperature of the greys is that of the paper and the ink: the most coloured of the two surfaces
  // and the two text colours. Lines are left out, since a look may rule a warm page in a cool colour.
  let tint = { C: 0, h: 0 };
  for (const role of ['surface', 'surface-raised', 'text-default', 'text-muted']) { const o = oklch(mode[role]); if (o.C > tint.C) tint = o; }
  const control = c.shape.radius_control;
  let density;
  if (surfaces.includes('product')) { const row = c.space.product.row_height; density = row <= 32 ? 'compact' : row < 44 ? 'regular' : 'roomy'; }
  else { const gap = c.space.landing.section_gap; density = gap <= 64 ? 'compact' : gap <= 112 ? 'regular' : 'roomy'; }
  return {
    display_type: `${display.class}, ${display.width || 'normal'}`,
    text_type: `${fams.text.class}, ${fams.text.width || 'normal'}`,
    accent_hue: accent.C < COLOURLESS ? 'no colour' : `${hueName(accent.h)}, ${Math.round(accent.h)} degrees`,
    neutrals: tint.C < 0.01 ? 'neutral' : (tint.h >= 115 && tint.h < 335 ? 'cool' : 'warm'),
    ground: oklch(mode.surface).L >= 0.6 ? 'light' : 'dark',
    corners: control <= 2 ? 'sharp' : control <= 8 ? 'soft' : 'round',
    separation: c.shape.separation,
    density,
    accent,
    // Not compared between candidates: only held against the looks that are everywhere.
    display_class: display.class,
    display_width: display.width || 'normal',
    labels: c.type.labels ? c.type.labels.case : 'sentence',
    ground_colour: oklch(mode.surface).C >= 0.08 ? 'saturated' : 'quiet',
    display_weight: surfaces.includes('landing') ? (c.type.landing || {}).display_weight : (c.type.product || {}).weight_heading,
    shadow: shadowKind(c.shape.shadow)
  };
}
// A shadow with an offset and no blur is a hard one: "4px 4px 0 #000".
function shadowKind(shadow) {
  if (!isStr(shadow) || shadow.trim() === 'none') return 'none';
  const lengths = (shadow.split(',')[0].match(/(?:^|\s)-?\d*\.?\d+(?:px|rem|em)?(?=\s|$)/g) || []).map((x) => parseFloat(x));
  if (lengths.length < 2) return 'soft';
  const [x, y, blur = 0] = lengths;
  return blur === 0 && (x !== 0 || y !== 0) ? 'hard' : 'soft';
}
function axisDiffers(axis, a, b) {
  if (axis !== 'accent_hue') return a[axis] !== b[axis];
  const none = [a.accent.C < COLOURLESS, b.accent.C < COLOURLESS];
  if (none[0] || none[1]) return none[0] !== none[1];
  return hueGap(a.accent.h, b.accent.h) >= 45;
}
const publicAxes = (axes) => Object.fromEntries(AXES.map((k) => [k, axes[k]]));
const freeFamilies = (c, held) => [
  !held.includes('text_type') && c.type.families.text.family,
  !held.includes('display_type') && c.type.families.display && c.type.families.display.family
].filter(Boolean).map((f) => f.trim().toLowerCase());

// Looks a great many generated interfaces share. A candidate that sits in one is said to, not refused.
function loadLooks(D) {
  const own = path.join(D, 'common-looks.json');
  const file = fs.existsSync(own) ? own : path.join(SKILL, 'assets', 'common-looks.json');
  const data = readJson(file, 'The list of common looks');
  const strings = (v) => (Array.isArray(v) ? v.filter(isStr) : []);
  // A mark is found by its words in a candidate's signature and by its CSS in signature_css. Both are
  // regular expressions; one that does not compile is said, and the mark is left out.
  const marks = [], broken = [];
  for (const m of Array.isArray(data.marks) ? data.marks : []) {
    if (!isObj(m) || !isStr(m.id) || !isStr(m.what)) continue;
    const compile = (list, kind) => strings(list).map((src) => { try { return new RegExp(src, 'i'); } catch { broken.push(`${m.id}.${kind}: ${src}`); return null; } }).filter(Boolean);
    marks.push({ id: m.id, what: m.what, words: compile(m.words, 'words'), css: compile(m.css, 'css') });
  }
  return { file, own: file === own, as_of: data.as_of, looks: Array.isArray(data.looks) ? data.looks : [], faces: strings(data.faces), marks, broken };
}
function exampleFamilies() {
  const out = {};
  const dir = path.join(SKILL, 'assets', 'example', 'studies', '1', 'candidates');
  try {
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const c = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      for (const role of ['text', 'display']) {
        const f = c.type && c.type.families && c.type.families[role];
        if (f && isStr(f.family)) (out[f.family.trim().toLowerCase()] = out[f.family.trim().toLowerCase()] || []).push(c.id);
      }
    }
  } catch { /* the example is not installed: nothing to hold candidates against */ }
  return out;
}
function inLook(look, c, axes) {
  const tests = isObj(look.tests) ? look.tests : {};
  const matched = [];
  let listed = 0;
  if (Array.isArray(tests.families)) {
    listed++;
    const mine = [c.type.families.text, c.type.families.display].filter(Boolean).map((f) => f.family.trim().toLowerCase());
    if (tests.families.some((f) => mine.includes(String(f).toLowerCase()))) matched.push('its typeface');
  }
  const said = { neutrals: 'its greys', ground: 'its ground', corners: 'its corners', separation: 'how it separates things', display_class: 'its display type', labels: 'its labels', ground_colour: 'the colour of its ground', shadow: 'its shadow', display_width: 'the width of its display type' };
  for (const k of Object.keys(said)) {
    if (!Array.isArray(tests[k])) continue;
    listed++;
    if (tests[k].includes(axes[k])) matched.push(`${said[k]} (${k === 'labels' && axes[k] === 'upper' ? 'capitals' : axes[k]})`);
  }
  if (Array.isArray(tests.accent_hue)) {
    listed++;
    const a = axes.accent;
    if (a.C >= COLOURLESS && tests.accent_hue.some(([lo, hi]) => a.h >= lo && a.h <= hi)) matched.push(`its accent (${hueName(a.h)})`);
  }
  if (Array.isArray(tests.display_weight)) {
    listed++;
    if (isNum(axes.display_weight) && tests.display_weight.some(([lo, hi]) => axes.display_weight >= lo && axes.display_weight <= hi)) matched.push(`the weight of its display type (${axes.display_weight})`);
  }
  const needs = Number.isInteger(look.needs) ? look.needs : listed;
  return listed > 0 && matched.length >= needs ? matched : null;
}

// ---------------------------------------------------------------------------------------- the study's other files

function sections(text) {
  const out = {};
  let current = null;
  for (const line of text.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) { current = h[1].toLowerCase(); out[current] = ''; continue; }
    if (/^#\s/.test(line)) { current = null; continue; }
    if (current !== null) out[current] += `${line}\n`;
  }
  return out;
}
function checkBrief(text) {
  const problems = [];
  const s = sections(text);
  const needed = { product: 'what the product is', people: 'who meets it, where, and on what', held: 'what every candidate must keep, or "Nothing"', feel: 'three words the look should bring to mind and three it should not, in the owner\'s words' };
  for (const [name, what] of Object.entries(needed)) if (!isStr(s[name])) problems.push(`brief.md: "## ${name[0].toUpperCase()}${name.slice(1)}" is empty: ${what}.`);
  return problems;
}
function parseReferences(text) {
  const refs = [];
  let current = null, last = null;
  for (const line of text.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
    const h = /^##\s+(R\d+)\b[\s:.–—-]*(.*)$/.exec(line);
    if (h) { current = { id: h[1], title: h[2].trim() }; last = null; refs.push(current); continue; }
    if (/^#{1,2}\s/.test(line)) { current = null; continue; }
    if (!current) continue;
    const f = /^\s*[-*]\s+\*{0,2}([A-Za-z ]+?)\s*:\*{0,2}\s*(.*)$/.exec(line);
    if (f) { last = f[1].trim().toLowerCase(); current[last] = f[2].trim(); }
    else if (last && /^\s+\S/.test(line)) current[last] = `${current[last]} ${line.trim()}`.trim();
  }
  return refs;
}
// How a thing was met: looked at, on a day; remembered; or described by someone who has seen it.
const SEEN = [[/^looked at (\d{4}-\d{2}-\d{2})(?!\d)/i, 'looked_at'], [/^from memory\b/i, 'from_memory'], [/^described by \S/i, 'described']];
function checkReferences(refs, candidates) {
  const problems = [], warnings = [];
  const seen = { looked_at: 0, from_memory: 0, described: 0 };
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const ids = refs.map((r) => r.id);
  for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) problems.push(`references.md: ${id} is the id of two notes.`);
  for (const r of refs) {
    if (!isStr(r.title)) problems.push(`references.md: ${r.id} has no name after its id: say what the thing is.`);
    if (!KINDS.includes(r.kind)) problems.push(`references.md: ${r.id} has Kind ${JSON.stringify(r.kind || '')}: one of ${KINDS.join(', ')}.`);
    for (const [key, what] of [['where', 'where it can be seen'], ['seen', '"looked at" and the day, "from memory", or "described by" and who'], ['does', 'what it does with type, colour, shape and space'], ['take', 'the properties worth taking'], ['leave', 'what stays with it, starting with everything that is its own']]) {
      if (!isStr(r[key])) problems.push(`references.md: ${r.id} has no "${key[0].toUpperCase()}${key.slice(1)}": ${what}.`);
    }
    if (isStr(r.seen)) {
      const how = SEEN.find(([re]) => re.test(r.seen.trim()));
      if (!how) problems.push(`references.md: ${r.id} has Seen "${r.seen.trim()}": write "looked at" and the day (looked at 2026-01-31), "from memory", or "described by" and who described it.`);
      else {
        seen[how[1]]++;
        const when = how[1] === 'looked_at' && how[0].exec(r.seen.trim())[1];
        if (when && (Number.isNaN(Date.parse(when)) || when > day(tomorrow))) problems.push(`references.md: ${r.id} was looked at on ${when}, which is not a day that has been.`);
      }
    }
  }
  const need = Math.max(4, (candidates || 3) * 2);
  if (refs.length < need) problems.push(`references.md holds ${refs.length} note${refs.length === 1 ? '' : 's'}, and ${candidates ? `${candidates} candidates need` : 'three candidates would need'} at least ${need}: two each, so that no direction is one thing copied.`);
  const kinds = new Set(refs.map((r) => r.kind).filter((k) => KINDS.includes(k)));
  if (!kinds.has('own-world')) problems.push('references.md has no note of the kind own-world: the things the product\'s own people read and handle are where a look that belongs to it comes from.');
  if (!kinds.has('other-craft')) problems.push('references.md has no note of the kind other-craft: something that is not software.');
  if (kinds.size < 3) problems.push(`references.md holds ${kinds.size} kind${kinds.size === 1 ? '' : 's'} of reference, and three are needed. Notes that are all of one kind lead to candidates that are all of one kind.`);
  const unseen = seen.from_memory + seen.described;
  if (refs.length && unseen * 2 > refs.length) warnings.push(`references.md: ${unseen} of ${refs.length} notes are of things that were not looked at (${seen.from_memory} from memory, ${seen.described} described by someone else). What is remembered of a thing is the average of things like it; look at the thing where it can be looked at.`);
  return { problems, warnings, kinds: [...kinds], seen };
}

function checkWords(w, surfaces) {
  const problems = [];
  const P = (m) => problems.push(`words.json: ${m}`);
  if (!isObj(w)) { P('it is not an object.'); return problems; }
  if (w.example === true) P('these are the words of the example. Write the product\'s own (its real navigation, a real table, its real headline) and take the "example" line out.');
  const str = (v, where) => { if (!isStr(v)) P(`${where} is empty.`); };
  // What a product may not have is left out, and the specimen is drawn without it. It is never filled in.
  const may = (v, where) => { if (v !== undefined && !isStr(v)) P(`${where} is empty: write the product's own words, or take the line out and the specimen is drawn without it.`); };
  const strs = (v, where, min) => { if (!Array.isArray(v) || v.length < min || v.some((x) => !isStr(x))) P(`${where} is a list of at least ${min} words or phrases, none empty.`); };
  str(w.name, 'name');
  if (surfaces.includes('product')) {
    const p = w.product;
    if (!isObj(p)) P('product is missing.');
    else {
      strs(p.nav, 'product.nav', 3);
      if (!Number.isInteger(p.current) || !Array.isArray(p.nav) || p.current < 0 || p.current >= p.nav.length) P('product.current is the position in product.nav of the screen shown, counting from 0.');
      str(p.user, 'product.user');
      const sc = p.screen;
      if (!isObj(sc)) P('product.screen is missing.');
      else { for (const k of ['title', 'search_label', 'filter_label', 'primary_action', 'secondary_action']) str(sc[k], `product.screen.${k}`); strs(sc.filter_options, 'product.screen.filter_options', 2); }
      const t = p.table;
      if (!isObj(t)) P('product.table is missing.');
      else {
        strs(t.columns, 'product.table.columns', 4);
        const n = Array.isArray(t.columns) ? t.columns.length : 0;
        for (const k of ['code_columns', 'numeric_columns']) if (!Array.isArray(t[k]) || t[k].some((i) => !Number.isInteger(i) || i < 0 || i >= n)) P(`product.table.${k} is a list of column positions, counting from 0 (it may be empty).`);
        if (!Number.isInteger(t.status_column) || t.status_column < 0 || t.status_column >= n) P('product.table.status_column is the position of the column that shows a status.');
        if (!Array.isArray(t.rows) || t.rows.length < 5) P('product.table.rows holds at least five rows.');
        else t.rows.forEach((r, i) => {
          if (!isObj(r) || !Array.isArray(r.cells) || r.cells.length !== n || r.cells.some((x) => !isStr(x))) P(`product.table.rows[${i}].cells holds one entry for each of the ${n} columns.`);
          if (!isObj(r) || !STATUSES.includes(r.status)) P(`product.table.rows[${i}].status is one of ${STATUSES.join(', ')}.`);
        });
      }
      if (!isObj(p.statuses)) P('product.statuses is missing.'); else for (const k of STATUSES) str(p.statuses[k], `product.statuses.${k}`);
      str(p.notice, 'product.notice');
      may(p.states_title, 'product.states_title');
      const d = p.detail;
      if (!isObj(d)) P('product.detail is missing.');
      else {
        for (const k of ['title', 'form_title', 'field_label', 'field_value', 'error_label', 'error_message', 'select_label', 'checkbox_label', 'save', 'cancel', 'quiet', 'destructive', 'disabled']) str(d[k], `product.detail.${k}`);
        for (const k of ['field_help', 'error_value']) may(d[k], `product.detail.${k}`);
        strs(d.select_options, 'product.detail.select_options', 2);
        if (!Array.isArray(d.facts) || d.facts.length < 2 || d.facts.some((f) => !Array.isArray(f) || f.length !== 2 || f.some((x) => !isStr(x)))) P('product.detail.facts is a list of at least two pairs: a label and its value.');
      }
      if (!isObj(p.empty)) P('product.empty is missing.'); else for (const k of ['title', 'body', 'action']) str(p.empty[k], `product.empty.${k}`);
    }
  }
  if (surfaces.includes('landing')) {
    const l = w.landing;
    if (!isObj(l)) P('landing is missing.');
    else {
      for (const k of ['action', 'headline', 'lead', 'proof']) str(l[k], `landing.${k}`);
      for (const k of ['quiet_link', 'picture_caption', 'band', 'band_source', 'closing_headline', 'footer']) may(l[k], `landing.${k}`);
      if (l.nav !== undefined && (!Array.isArray(l.nav) || !l.nav.length || l.nav.some((x) => !isStr(x)))) P('landing.nav is the links at the top of the page: write the page\'s own, or take the line out and the specimen is drawn without them.');
      if (l.band_source !== undefined && l.band === undefined) P('landing.band_source says whose words landing.band holds, and there is no landing.band.');
      if (!Array.isArray(l.benefits) || l.benefits.length !== 3 || l.benefits.some((b) => !isObj(b) || !isStr(b.title) || !isStr(b.body))) P('landing.benefits holds three, each with a title and a body.');
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------- where things are

function directionDir(args) {
  if (!isStr(args.dir)) refuse('Say where the direction is kept: --dir <folder>.');
  return path.resolve(String(args.dir));
}
function studyNumbers(D) {
  const base = path.join(D, 'studies');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter((n) => /^\d+$/.test(n) && fs.existsSync(path.join(base, n, 'study.json'))).map(Number).sort((a, b) => a - b);
}
function loadStudy(D, args) {
  const all = studyNumbers(D);
  if (!all.length) refuse(`There is no study in ${D}. Open one: open --dir <folder>.`);
  const n = args.study === undefined ? all[all.length - 1] : Number(args.study);
  if (!all.includes(n)) refuse(`There is no study ${args.study} in ${D}. There ${all.length === 1 ? 'is' : 'are'}: ${all.join(', ')}.`);
  const dir = path.join(D, 'studies', String(n));
  return { n, dir, state: readJson(path.join(dir, 'study.json')) };
}
const candidateFile = (study, id) => path.join(study.dir, 'candidates', `${id}.json`);

// Everything `check` looks at, read once.
function inspect(D, study) {
  const st = study.state;
  const surfaces = st.surfaces, held = st.held || [];
  const problems = [], warnings = [];
  const briefFile = path.join(study.dir, 'brief.md'), refsFile = path.join(study.dir, 'references.md'), wordsFile = path.join(study.dir, 'words.json');
  if (!fs.existsSync(briefFile)) problems.push('brief.md is not there.'); else problems.push(...checkBrief(fs.readFileSync(briefFile, 'utf8')));
  let refs = [], refsSeen = null;
  if (!fs.existsSync(refsFile)) problems.push('references.md is not there.');
  else {
    refs = parseReferences(fs.readFileSync(refsFile, 'utf8'));
    const r = checkReferences(refs, st.candidates.length);
    problems.push(...r.problems); warnings.push(...r.warnings);
    refsSeen = r.seen;
  }
  if (!st.candidates.length) problems.push('No candidates are named yet. When you know what each is drawn from: candidates --names <name,name,name>.');
  const refsById = Object.fromEntries(refs.map((r) => [r.id, r]));
  let words = null;
  if (!fs.existsSync(wordsFile)) problems.push('words.json is not there.');
  else {
    try { words = JSON.parse(fs.readFileSync(wordsFile, 'utf8')); } catch (e) { problems.push(`words.json is not valid JSON: ${e.message}`); }
    if (words) { const wp = checkWords(words, surfaces); problems.push(...wp); if (wp.length) words = wp.every((m) => /words of the example/.test(m)) ? words : null; }
  }

  const candidates = {};
  for (const id of st.candidates) {
    const file = candidateFile(study, id);
    const entry = { file: path.relative(D, file), problems: [], warnings: [], axes: null, common_looks: [] };
    candidates[id] = entry;
    if (!fs.existsSync(file)) { entry.problems.push('The file is not there.'); continue; }
    let c;
    const text = fs.readFileSync(file, 'utf8');
    try { c = JSON.parse(text); } catch (e) { entry.problems.push(`It is not valid JSON: ${e.message}`); continue; }
    const r = checkCandidate(c, { id, surfaces, refs: refsById });
    Object.assign(entry, { problems: r.problems, warnings: r.warnings, contrast: r.contrast, data: c, sha: sha(text), full: r.axes, axes: r.axes ? publicAxes(r.axes) : null });
  }

  // A typeface that this skill's own example uses is more likely the example speaking than the references.
  const exampleFaces = exampleFamilies();
  for (const id of st.candidates) {
    const e = candidates[id];
    if (!e.data || !isObj(e.data.type) || !isObj(e.data.type.families)) continue;
    for (const role of ['text', 'display']) {
      const f = e.data.type.families[role];
      const users = isObj(f) && isStr(f.family) ? exampleFaces[f.family.trim().toLowerCase()] : null;
      if (users && !users.includes(id)) e.warnings.push(`type.families.${role} is ${f.family.trim()}, which this skill's own example uses. Make sure it came from your references and not from there.`);
    }
  }

  // Each candidate against the looks that are everywhere: its typefaces, the marks it calls its own, then the look whole.
  const looks = loadLooks(D);
  for (const b of looks.broken) problems.push(`${path.relative(D, looks.file) || looks.file}: the mark ${b} is not a regular expression.`);
  const everywhere = looks.faces.map((f) => f.trim().toLowerCase());
  const heldRoles = { text: held.includes('text_type'), display: held.includes('display_type') };
  for (const id of st.candidates) {
    const e = candidates[id];
    if (!e.data) continue;
    const fams = isObj(e.data.type) && isObj(e.data.type.families) ? e.data.type.families : {};
    for (const role of ['text', 'display', 'mono']) {
      const f = fams[role];
      if (!isObj(f) || !isStr(f.family) || heldRoles[role]) continue;
      const mine = f.family.trim().toLowerCase();
      if (everywhere.some((x) => mine === x || mine.startsWith(`${x} `))) e.warnings.push(`type.families.${role} is ${f.family.trim()}, one of the faces a great many generated pages are set in. Keep it only if a reference in drawn_from is set in it, and say so when this candidate is shown.`);
    }
    const marks = Array.isArray(e.data.signature) ? e.data.signature.filter(isObj) : [];
    const css = isStr(e.data.signature_css) ? e.data.signature_css : '';
    for (const mark of looks.marks) {
      const inWords = marks.map((m) => [m.what, m.product, m.landing].filter(isStr).join('. ')).find((text) => mark.words.some((re) => re.test(text)));
      const inCss = mark.css.some((re) => re.test(css));
      if (!inWords && !inCss) continue;
      const where = inWords ? `signature ("${inWords.length > 90 ? `${inWords.slice(0, 87)}...` : inWords}")` : 'signature_css';
      e.warnings.push(`Its ${where} looks like ${mark.what}: one of the marks a great many generated pages carry (${mark.id}). A signature is something the references had that other products do not. If that is what this is, take it out and say what the look does in its place.`);
    }
  }
  const inCommon = [];
  for (const id of st.candidates) {
    const e = candidates[id];
    if (!e.full) continue;
    for (const look of looks.looks) {
      const matched = inLook(look, e.data, e.full);
      if (matched) e.common_looks.push({ look: look.id, what: look.what, matched });
    }
    if (e.common_looks.length) {
      inCommon.push(id);
      e.warnings.push(`It sits in a look a great many generated interfaces share (${e.common_looks.map((l) => l.look).join(', ')}): ${list(e.common_looks[0].matched)}. Keep it only as the familiar one of the set, and say so when it is shown.`);
    }
  }
  if (inCommon.length > 1) problems.push(`${list(inCommon)} each sit in a look that is everywhere. At most one candidate may: the others have to come from somewhere else.`);

  // Each pair against each other.
  const free = AXES.filter((a) => !held.includes(a));
  const mustDiffer = Math.max(2, Math.floor(free.length / 2));
  const pairs = [];
  const ids = st.candidates;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = candidates[ids[i]], b = candidates[ids[j]];
    if (!a.full || !b.full) continue;
    const differ = free.filter((axis) => axisDiffers(axis, a.full, b.full));
    const pair = { a: ids[i], b: ids[j], differ_on: differ, same_on: free.filter((x) => !differ.includes(x)), ok: true, problems: [] };
    if (differ.length < mustDiffer) pair.problems.push(`${ids[i]} and ${ids[j]} differ on ${differ.length} of the ${free.length} things compared (${differ.join(', ') || 'none'}), and ${mustDiffer} are needed. They are the same on: ${pair.same_on.join(', ')}.`);
    const typeFree = TYPE_AXES.filter((x) => free.includes(x));
    if (typeFree.length && !typeFree.some((x) => differ.includes(x))) pair.problems.push(`${ids[i]} and ${ids[j]} are set in the same kind of typeface (${a.axes.display_type} for display, ${a.axes.text_type} for text). Type carries more of a look than anything else: one of the two has to change.`);
    const colourFree = COLOUR_AXES.filter((x) => free.includes(x));
    if (colourFree.length && !colourFree.some((x) => differ.includes(x))) pair.problems.push(`${ids[i]} and ${ids[j]} have the same colouring: accent ${a.axes.accent_hue} and ${b.axes.accent_hue}, ${a.axes.neutrals} greys, a ${a.axes.ground} ground. One of those has to change.`);
    const shared = freeFamilies(a.data, held).filter((f) => freeFamilies(b.data, held).includes(f));
    if (shared.length) pair.problems.push(`${ids[i]} and ${ids[j]} both use the family ${list(shared.map((f) => `"${f}"`))}.`);
    if (Array.isArray(a.data.drawn_from) && Array.isArray(b.data.drawn_from)) {
      const refsA = (a.data.drawn_from || []).map((d) => d.ref), refsB = (b.data.drawn_from || []).map((d) => d.ref);
      if (refsA[0] && refsA[0] === refsB[0]) pair.problems.push(`${ids[i]} and ${ids[j]} are both drawn first from ${refsA[0]}. Each candidate starts from a different reference.`);
      else if (refsA.filter((r) => refsB.includes(r)).length > 1) pair.problems.push(`${ids[i]} and ${ids[j]} share more than one reference (${list(refsA.filter((r) => refsB.includes(r)))}).`);
    }
    pair.ok = pair.problems.length === 0;
    problems.push(...pair.problems);
    delete pair.problems;
    pairs.push(pair);
  }
  const mains = ids.map((id) => candidates[id].data && candidates[id].data.drawn_from && candidates[id].data.drawn_from[0] && refsById[candidates[id].data.drawn_from[0].ref]).filter(Boolean);
  if (mains.length === ids.length && ids.length > 1 && new Set(mains.map((r) => r.kind)).size < 2) {
    problems.push(`Every candidate is drawn first from a reference of the kind ${mains[0].kind}. Start at least one from another kind.`);
  }
  for (const id of ids) for (const m of candidates[id].problems) problems.push(`${id}: ${m}`);
  for (const id of ids) for (const m of candidates[id].warnings) warnings.push(`${id}: ${m}`);
  return { surfaces, held, free, mustDiffer, refs, refsSeen, refsById, words, candidates, pairs, looks, problems, warnings, ok: problems.length === 0 };
}

// ---------------------------------------------------------------------------------------- tokens

function tokens(c, surfaces, base) {
  const fams = c.type.families;
  const stack = (f) => `"${f.family}", ${f.fallback}`;
  const px = (n) => `${n}px`;
  const root = [];
  root.push(['font-text', stack(fams.text)], ['font-display', stack(fams.display || fams.text)], ['font-mono', stack(fams.mono || fams.text)]);
  root.push(['label-tracking', `${c.type.labels ? c.type.labels.tracking_em : 0}em`]);
  if (surfaces.includes('product')) {
    const p = c.type.product, s = c.space.product;
    root.push(['p-caption', px(p.caption)], ['p-control', px(p.control)], ['p-body', px(p.body)], ['p-heading', px(p.heading)], ['p-title', px(p.title)],
      ['p-weight-text', p.weight_text], ['p-weight-label', p.weight_label], ['p-weight-heading', p.weight_heading], ['p-line-height', p.line_height],
      ['p-control-height', px(s.control_height)], ['p-row-height', px(s.row_height)], ['p-touch-height', px(s.touch_control_height)], ['p-gutter', px(s.gutter)]);
  }
  if (surfaces.includes('landing')) {
    const l = c.type.landing, s = c.space.landing;
    root.push(['l-body', px(l.body)], ['l-lead', px(l.lead)], ['l-h3', px(l.h3)], ['l-h2', px(l.h2)], ['l-display', px(l.display)],
      ['l-display-weight', l.display_weight], ['l-display-tracking', `${l.display_tracking_em}em`], ['l-display-line-height', l.display_line_height], ['l-measure', `${l.measure_ch}ch`],
      ['l-control-height', px(s.control_height)], ['l-section-gap', px(s.section_gap)], ['l-gutter', px(s.gutter)]);
  }
  root.push(['radius-control', px(c.shape.radius_control)], ['radius-container', px(c.shape.radius_container)], ['border-width', px(c.shape.border_width)],
    ['shadow', c.shape.shadow.trim()], ['icon-stroke', c.shape.icons.stroke]);
  c.space.scale.forEach((v, i) => root.push([`space-${i + 1}`, px(v)]));
  root.push(['ms-control', `${c.motion.control_ms}ms`], ['ms-section', `${c.motion.section_ms}ms`]);

  const modeBlock = (values) => {
    const lines = rolesOf(c).map((r) => [r, values[r].trim().toLowerCase()]);
    lines.push(['current-mark', c.shape.action_edge ? 'var(--vd-text-default)' : 'var(--vd-accent)']);
    if (surfaces.includes('landing')) {
      const band = { accent: ['accent', 'text-on-accent'], inverse: ['text-default', 'surface'], raised: ['surface-raised', 'text-default'] }[c.colour.landing_band];
      lines.push(['l-band', `var(--vd-${band[0]})`], ['l-band-text', `var(--vd-${band[1]})`]);
    }
    return lines;
  };
  const block = (selector, lines) => `${selector} {\n${lines.map(([k, v]) => `  --vd-${k}: ${v};`).join('\n')}\n}`;
  const faces = [];
  for (const f of Object.values(fams)) {
    if (!isObj(f.source) || !Array.isArray(f.source.files)) continue;
    for (const file of f.source.files) {
      const format = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }[path.extname(file.path).slice(1).toLowerCase()];
      faces.push(`@font-face { font-family: "${f.family}"; src: url("${base}${file.path}")${format ? ` format("${format}")` : ''}; font-weight: ${file.weight || 400}; font-style: ${file.style || 'normal'}; font-display: swap; }`);
    }
  }
  const def = c.colour.default_mode;
  const css = [
    ...faces,
    block(':root', root),
    block(`:root, [data-mode="${def}"]`, modeBlock(c.colour.modes[def])),
    ...Object.entries(c.colour.modes).filter(([m]) => m !== def).map(([m, v]) => block(`[data-mode="${m}"]`, modeBlock(v)))
  ].join('\n\n');
  const sheets = [...new Set(Object.values(fams).map((f) => isObj(f.source) && f.source.stylesheet).filter(Boolean))];
  return { css, sheets, families: Object.values(fams).map((f) => f.family) };
}

// ---------------------------------------------------------------------------------------- the specimen

const ICON = {
  success: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M5.2 8.3l1.9 1.9 3.7-4.1"/></svg>',
  warning: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2l6.2 11H1.8z"/><path d="M8 6.6v3.1M8 11.5v.2"/></svg>',
  danger: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.3 1.8h5.4l3.5 3.5v5.4l-3.5 3.5H5.3l-3.5-3.5V5.3z"/><path d="M8 5v3.6M8 10.8v.2"/></svg>',
  info: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M8 7.3v3.6M8 5v.2"/></svg>'
};
// Words are written as words, never as markup. A fact that does not exist yet stays a marker, and is
// drawn as one, so that nobody takes it for the page's own words.
const say = (text) => esc(text).replace(/\{\{[^{}]*\}\}/g, (m) => `<span class="vd-marker">${m}</span>`);
const status = (kind, word) => `<span class="status status-${kind}">${ICON[kind]}<span>${say(word)}</span></span>`;

function tableHtml(p, rows, only) {
  const t = p.table;
  const cols = t.columns.map((_, i) => i).filter((i) => !only || only.includes(i));
  // On a phone a row is rebuilt as a block: what names the row first, its state beside that, then the
  // rest, each with its heading. The classes say which cell is which.
  const code = cols.find((i) => t.code_columns.includes(i));
  const name = cols.find((i) => i !== code && i !== t.status_column && !t.numeric_columns.includes(i) && !t.code_columns.includes(i));
  const lead = code === undefined ? name : code;
  const part = (i) => (i === lead ? 'c-lead' : i === t.status_column ? 'c-status' : i === name ? 'c-main' : 'c-more');
  // A heading is never set in the face kept for codes; only the codes themselves are.
  const cls = (i, head) => [head ? '' : part(i), t.numeric_columns.includes(i) ? 'num' : '', !head && t.code_columns.includes(i) ? 'code' : ''].filter(Boolean).join(' ');
  const attr = (i, head) => (cls(i, head) ? ` class="${cls(i, head)}"` : '');
  const head = cols.map((i) => `<th scope="col"${attr(i, true)}>${say(t.columns[i])}</th>`).join('');
  const body = t.rows.slice(0, rows).map((r) => `<tr>${cols.map((i) => `<td${attr(i)} data-label="${esc(t.columns[i])}">${i === t.status_column ? status(r.status, r.cells[i]) : say(r.cells[i])}</td>`).join('')}</tr>`).join('\n          ');
  return `<table class="p-table">\n        <thead><tr>${head}</tr></thead>\n        <tbody>\n          ${body}\n        </tbody>\n      </table>`;
}

// The skeleton: the same parts, in the same order, with the same words, for every candidate. Nothing in it
// comes from a candidate. A part whose words the product does not have is left out.
function skeleton(words, surfaces) {
  const parts = [];
  const options = (items) => items.map((o) => `<option>${esc(o)}</option>`).join('');
  if (surfaces.includes('product')) {
    const p = words.product, sc = p.screen, d = p.detail;
    parts.push(`<section class="vd-part" data-part="product" aria-label="The product">
  <div class="p-app">
    <header class="p-bar">
      <span class="p-name">${say(words.name)}</span>
      <nav class="p-nav" aria-label="Main">${p.nav.map((n, i) => `<a href="#"${i === p.current ? ' aria-current="page"' : ''}>${say(n)}</a>`).join('')}</nav>
      <span class="p-user">${say(p.user)}</span>
    </header>
    <div class="p-main">
      <div class="p-work">
        <div class="p-head">
          <h1 class="p-title">${say(sc.title)}</h1>
          <div class="p-tools">
            <label class="field"><span class="label">${say(sc.search_label)}</span><input type="text"></label>
            <label class="field"><span class="label">${say(sc.filter_label)}</span><select>${options(sc.filter_options)}</select></label>
            <button class="btn btn-secondary" type="button">${say(sc.secondary_action)}</button>
            <button class="btn btn-primary" type="button">${say(sc.primary_action)}</button>
          </div>
        </div>
        <div class="card p-tablecard">
      ${tableHtml(p, 8)}
        </div>
        <div class="p-row2">
          <div class="card p-empty">
            <h2 class="p-h">${say(p.empty.title)}</h2>
            <p>${say(p.empty.body)}</p>
            <button class="btn btn-secondary" type="button">${say(p.empty.action)}</button>
          </div>
          <div class="card p-states">
            ${p.states_title ? `<h2 class="p-h">${say(p.states_title)}</h2>` : ''}
            <ul class="p-statuslist">${STATUSES.map((k) => `<li>${status(k, p.statuses[k])}</li>`).join('')}</ul>
            <p class="p-notice" role="status">${ICON.info}<span>${say(p.notice)}</span></p>
          </div>
        </div>
      </div>
      <aside class="card p-detail" aria-label="${esc(d.title)}">
        <h2 class="p-h">${say(d.title)}</h2>
        <dl class="p-facts">${d.facts.map(([k, v]) => `<dt>${say(k)}</dt><dd>${say(v)}</dd>`).join('')}</dl>
        <h3 class="p-h3">${say(d.form_title)}</h3>
        <label class="field"><span class="label">${say(d.field_label)}</span><input type="text" value="${esc(d.field_value)}">${d.field_help ? `<span class="help">${say(d.field_help)}</span>` : ''}</label>
        <label class="field is-error"><span class="label">${say(d.error_label)}</span><input type="text" value="${esc(d.error_value || '')}" aria-invalid="true"><span class="error">${ICON.danger}<span>${say(d.error_message)}</span></span></label>
        <label class="field"><span class="label">${say(d.select_label)}</span><select>${options(d.select_options)}</select></label>
        <label class="check"><input type="checkbox" checked><span>${say(d.checkbox_label)}</span></label>
        <div class="p-actions">
          <button class="btn btn-primary is-focus" type="button">${say(d.save)}</button>
          <button class="btn btn-secondary" type="button">${say(d.cancel)}</button>
          <button class="btn btn-quiet" type="button">${say(d.quiet)}</button>
        </div>
        <div class="p-actions">
          <button class="btn btn-danger" type="button">${say(d.destructive)}</button>
          <button class="btn btn-secondary" type="button" disabled>${say(d.disabled)}</button>
        </div>
      </aside>
    </div>
  </div>
</section>`);
  }
  if (surfaces.includes('landing')) {
    const l = words.landing;
    // The picture is the product, in this look. Where there is no product to show (a study of a page
    // alone), there is no picture: an empty frame would say nothing about the look.
    const picture = surfaces.includes('product')
      ? `<figure class="l-picture">
        <div class="card l-shot" aria-hidden="true"><div class="l-shot-bar"><span class="p-name">${say(words.name)}</span></div>\n      ${tableHtml(words.product, 4, [0, 1, words.product.table.status_column])}\n      </div>
        ${l.picture_caption ? `<figcaption>${say(l.picture_caption)}</figcaption>` : ''}
      </figure>`
      : '';
    const action = (extra) => `<a class="btn btn-primary${extra}" href="#">${say(l.action)}</a>`;
    // With no words for the band, the last call to act is the band, so that the band's colour is still shown.
    const close = `<h2 class="l-h2">${say(l.closing_headline || l.headline)}</h2>${action(' btn-l')}`;
    const band = l.band
      ? `<div class="l-band"><div class="l-band-in"><p class="l-band-say">${say(l.band)}</p>${l.band_source ? `<p class="l-band-src">${say(l.band_source)}</p>` : ''}</div></div>\n    <div class="l-close">${close}</div>`
      : `<div class="l-band"><div class="l-band-in l-band-close">${close}</div></div>`;
    parts.push(`<section class="vd-part" data-part="landing" aria-label="The landing page">
  <div class="l-page">
    <header class="l-nav">
      <span class="l-name">${say(words.name)}</span>
      ${l.nav ? `<nav aria-label="Page">${l.nav.map((n) => `<a href="#">${say(n)}</a>`).join('')}</nav>` : ''}
      ${action('')}
    </header>
    <div class="l-hero${picture ? '' : ' l-hero-solo'}">
      <div class="l-say">
        <h1 class="l-display">${say(l.headline)}</h1>
        <p class="l-lead">${say(l.lead)}</p>
        <div class="l-actions">${action(' btn-l')}${l.quiet_link ? `<a class="l-quiet" href="#">${say(l.quiet_link)}</a>` : ''}</div>
        <p class="l-proof">${say(l.proof)}</p>
      </div>
      ${picture}
    </div>
    <div class="l-benefits">${l.benefits.map((b) => `<div><h3 class="l-h3">${say(b.title)}</h3><p>${say(b.body)}</p></div>`).join('')}</div>
    ${band}
    ${l.footer ? `<footer class="l-foot">${say(l.footer)}</footer>` : ''}
  </div>
</section>`);
  }
  return parts.join('\n');
}

// The third part is the candidate's own: its values, shown in itself.
function valuesHtml(c, name, surfaces, contrastRows, refsById) {
  const fams = c.type.families;
  const sample = (role, label) => {
    const f = fams[role];
    if (!f) return '';
    return `<div class="v-face"><p class="v-sample" style="font-family:var(--vd-font-${role})">${esc(name)} 0123456789</p><p class="v-meta">${label}: ${esc(f.family)} (${esc(f.class)}${f.width && f.width !== 'normal' ? `, ${esc(f.width)}` : ''}). ${esc(sentence(f.licence))}</p></div>`;
  };
  const ladder = (pairs, family) => pairs.map(([size, label]) => `<p class="v-step" style="font-size:${size}px;${family ? `font-family:var(--vd-font-${family});` : ''}">${size} px <span class="v-meta">${label}</span></p>`).join('');
  const blocks = [];
  blocks.push(`<div class="card v-block"><h2 class="label">Type</h2>${sample('display', 'Display')}${sample('text', 'Text')}${sample('mono', 'Codes')}
    ${surfaces.includes('product') ? `<div class="v-ladder">${ladder([[c.type.product.title, 'screen title'], [c.type.product.heading, 'section heading']], 'display')}${ladder([[c.type.product.body, 'body'], [c.type.product.control, 'controls and table cells'], [c.type.product.caption, 'captions']])}</div>` : ''}
    ${surfaces.includes('landing') ? `<div class="v-ladder">${ladder([[Math.min(c.type.landing.display, 72), `landing headline${c.type.landing.display > 72 ? ` (shown at 72, set at ${c.type.landing.display})` : ''}`], [c.type.landing.h2, 'landing section heading']], 'display')}${ladder([[c.type.landing.lead, 'landing lead'], [c.type.landing.body, 'landing body']])}</div>` : ''}</div>`);
  // The colours and what they measure are shown for the mode on screen, each mode in a block of its own.
  const modeNames = Object.keys(c.colour.modes);
  const modeLabel = (m) => `${esc(m)}${modeNames.length > 1 && m === c.colour.default_mode ? ', the default' : ''}`;
  for (const m of modeNames) {
    const v = c.colour.modes[m];
    const swatches = rolesOf(c).map((r) => `<li><span class="v-sw" style="background:${v[r].trim().toLowerCase()}"></span><span class="code">${r}</span><span class="code v-meta">${v[r].trim().toLowerCase()}</span></li>`).join('');
    blocks.push(`<div class="card v-block v-mode" data-for="${m}"><h2 class="label">Colour (${modeLabel(m)})</h2><ul class="v-swatches">${swatches}</ul>
    <ul class="v-list">${['accent', ...STATUSES].map((k) => `<li><b>${k}</b> ${esc(c.colour.meanings[k])}</li>`).join('')}</ul></div>`);
  }
  blocks.push(`<div class="card v-block"><h2 class="label">Shape and space</h2>
    <div class="v-shapes"><span class="v-shape v-shape-control">control ${c.shape.radius_control} px</span><span class="v-shape v-shape-container">container ${c.shape.radius_container} px</span></div>
    <p class="v-meta">Told apart by: ${esc(c.shape.separation)}. Icons: ${esc(c.shape.icons.family)}, ${c.shape.icons.stroke} px line.</p>
    <div class="v-scale">${c.space.scale.map((v, i) => `<span style="width:var(--vd-space-${i + 1})" title="${v} px"></span>`).join('')}</div><p class="v-meta">${c.space.scale.join(', ')} px</p></div>`);
  for (const m of modeNames) {
    const pairs = contrastRows.filter((r) => r.mode === m).map((r) => `<tr><td class="code">${r.foreground}</td><td class="code">${r.background}</td><td class="num">${r.ratio.toFixed(2)}</td><td class="num">${r.waived ? 'an edge' : r.minimum}</td></tr>`).join('');
    blocks.push(`<div class="card v-block v-block-wide v-mode" data-for="${m}"><h2 class="label">Contrast (${modeLabel(m)})</h2><div class="v-scroll"><table class="p-table v-pairs"><thead><tr><th scope="col">Foreground</th><th scope="col">Background</th><th scope="col" class="num">Measures</th><th scope="col" class="num">Needs</th></tr></thead><tbody>${pairs}</tbody></table></div></div>`);
  }
  if (Array.isArray(c.signature) || Array.isArray(c.refuses)) {
    blocks.push(`<div class="card v-block">${Array.isArray(c.signature) ? `<h2 class="label">Its own marks</h2><ul class="v-list">${c.signature.map((s) => `<li>${esc(s.what)}</li>`).join('')}</ul>` : ''}${Array.isArray(c.refuses) ? `<h2 class="label">It never</h2><ul class="v-list">${c.refuses.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div>`);
  }
  if (Array.isArray(c.drawn_from)) {
    blocks.push(`<div class="card v-block"><h2 class="label">Drawn from</h2><ul class="v-list">${c.drawn_from.map((d) => `<li><b>${esc(refsById[d.ref] ? refsById[d.ref].title : d.ref)}</b> ${esc(d.took)}</li>`).join('')}</ul></div>`);
  }
  return `<section class="vd-part" data-part="values" aria-label="The values">
  <div class="v-wrap">
    <h1 class="p-title">${esc(c.name)}</h1>
    <p class="v-idea">${esc(c.idea)}</p>${isStr(c.gives_up) ? `\n    <p class="v-idea"><b>What it gives up.</b> ${esc(c.gives_up)}</p>` : ''}
    <div class="v-grid">${blocks.join('\n    ')}</div>
  </div>
</section>`;
}

// What runs inside a specimen: it shows the part and the mode it is asked for, says how tall it is, and
// says so on the page when a typeface did not load, because then it is not showing the candidate.
function specimenScript(id, families) {
  return `(function(){
  var ID=${JSON.stringify(id)}, FAMILIES=${JSON.stringify(families).replace(/</g, '\\u003c')}, root=document.documentElement;
  function tell(){ if(window.parent!==window){ window.parent.postMessage({vd:'height', id:ID, height:Math.ceil(document.body.getBoundingClientRect().height)}, '*'); } }
  function show(part, mode){
    var parts=document.querySelectorAll('.vd-part');
    for(var i=0;i<parts.length;i++){ parts[i].hidden=!!part && parts[i].getAttribute('data-part')!==part; }
    if(mode){ root.setAttribute('data-mode', mode); }
    tell();
  }
  function fromHash(){ var q={}; location.hash.replace(/^#/,'').split('&').forEach(function(p){ var kv=p.split('='); if(kv[0]){ q[kv[0]]=kv[1]||''; } }); show(q.part||'', q.mode||''); }
  window.addEventListener('message', function(e){ var d=e.data; if(d && d.vd==='show'){ show(d.part||'', d.mode||''); } });
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('resize', tell);
  function width(family, generic){ var s=document.createElement('span'); s.textContent='mmmmmmmmmmlliWW@#0123'; s.style.cssText='position:absolute;left:-9999px;top:0;font-size:72px;white-space:nowrap;font-family:"'+family+'",'+generic; document.body.appendChild(s); var w=s.getBoundingClientRect().width; s.remove(); return w; }
  function fonts(){
    var missing=FAMILIES.filter(function(f){ return Math.abs(width(f,'monospace')-width(f,'serif'))>0.5; });
    var warn=document.querySelector('.vd-fontwarn');
    if(missing.length){ warn.textContent='This is not the candidate: '+missing.join(', ')+' did not load, and another typeface is standing in.'; warn.hidden=false; } else { warn.hidden=true; }
    root.setAttribute('data-fonts', missing.length ? 'missing' : 'loaded');
    tell();
  }
  var loads=(document.fonts && document.fonts.load) ? FAMILIES.map(function(f){ return document.fonts.load('16px "'+f+'"', 'mW0').catch(function(){}); }) : [];
  Promise.all(loads).then(function(){ setTimeout(fonts, 60); });
  fromHash();
})();`;
}

function specimenPage(c, ctx) {
  const t = tokens(c, ctx.surfaces, ctx.base);
  const labels = c.type.labels ? c.type.labels.case : 'sentence';
  return `<!doctype html>
<html lang="en" data-mode="${c.colour.default_mode}" data-separation="${c.shape.separation}" data-labels="${labels}" data-numerals="${c.type.numerals || 'tabular'}" data-action-edge="${c.shape.action_edge === true}" data-status="${patches(c) ? 'patch' : 'mark'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ctx.words.name)}: ${esc(c.name)}</title>
${t.sheets.map((s) => `<link rel="stylesheet" href="${esc(s)}">`).join('\n')}
<style>
/* The candidate: its values. */
${t.css}

/* Of the values, only the mode on screen is shown. */
.v-mode { display: none; }
${Object.keys(c.colour.modes).map((m) => `[data-mode="${m}"] .v-mode[data-for="${m}"] { display: grid; }`).join('\n')}

/* The skeleton: the same for every candidate. It sits in a layer, so that whatever the candidate
   adds below wins over it, however the two are written. */
@layer skeleton {
${ctx.skeletonCss}
}
${isStr(c.signature_css) ? `\n/* The candidate: its own marks. */\n${c.signature_css}\n` : ''}</style>
</head>
<body>
<p class="vd-fontwarn" hidden></p>
${ctx.body}
${valuesHtml(c, ctx.words.name, ctx.surfaces, ctx.contrast, ctx.refsById)}
<script>
${specimenScript(c.id, t.families)}
</script>
</body>
</html>
`;
}

function sheetPage(ctx) {
  const parts = [...ctx.surfaces.map((s) => [s, s === 'product' ? 'Product' : 'Landing page']), ['values', 'Values']];
  const modes = [...new Set(ctx.candidates.flatMap((c) => Object.keys(c.data.colour.modes)))];
  const figures = ctx.candidates.map((c) => {
    const frame = ctx.embed
      ? `<iframe id="f-${c.id}" title="${esc(c.data.name)}" srcdoc="${esc(c.html)}"`
      : `<iframe id="f-${c.id}" title="${esc(c.data.name)}" src="specimens/${c.id}/index.html"`;
    return `<figure>
  <figcaption><b>${esc(c.data.name)}</b><span>${esc(c.data.idea)}</span>${isStr(c.data.gives_up) ? `<span>Gives up: ${esc(c.data.gives_up)}</span>` : ''}${c.common ? `<span class="flag">${esc(c.common)}</span>` : ''}${ctx.embed ? '' : `<a href="specimens/${c.id}/index.html" target="_blank" rel="noopener">Open it alone</a>`}</figcaption>
  <div class="frame">${frame} data-modes="${Object.keys(c.data.colour.modes).join(' ')}" data-default="${c.data.colour.default_mode}"></iframe></div>
</figure>`;
  }).join('\n');
  const group = (legend, name, items) => `<fieldset><legend>${legend}</legend>${items.map(([value, label], i) => `<button type="button" data-set="${name}" data-value="${value}" aria-pressed="${i === 0}">${label}</button>`).join('')}</fieldset>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ctx.words.name)}: ${ctx.draft ? 'draft, not ready to show' : 'directions to choose from'}</title>
<style>
:root { color-scheme: light dark; --bg: #f2f2ef; --fg: #161616; --mut: #5a5a57; --line: #c6c6c0; }
@media (prefers-color-scheme: dark) { :root { --bg: #171717; --fg: #f0f0ec; --mut: #a8a8a2; --line: #3b3b38; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.45 system-ui, sans-serif; }
header { display: flex; flex-wrap: wrap; gap: 12px 28px; align-items: end; padding: 16px 20px; border-bottom: 1px solid var(--line); }
h1 { margin: 0; font-size: 18px; }
.note { margin: 4px 0 0; color: var(--mut); max-width: 72ch; }
.draft { margin: 0; padding: 10px 20px; background: #000; color: #fff; font-weight: 600; }
fieldset { display: flex; gap: 6px; align-items: center; margin: 0; padding: 0; border: 0; }
legend { float: left; margin-right: 8px; padding: 0; color: var(--mut); }
button { padding: 6px 12px; border: 1px solid var(--mut); border-radius: 4px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
button[aria-pressed="true"] { border-color: var(--fg); background: var(--fg); color: var(--bg); }
main { display: grid; grid-template-columns: repeat(${ctx.candidates.length}, minmax(0, 1fr)); grid-template-rows: auto auto; gap: 0 20px; padding: 20px; }
@media (max-width: 900px) { main { grid-template-columns: minmax(0, 1fr); } }
figure { display: grid; grid-row: span 2; grid-template-rows: subgrid; min-width: 0; margin: 0 0 20px; }
figcaption { display: grid; align-content: start; gap: 2px; padding-bottom: 10px; }
figcaption b { font-size: 16px; }
figcaption span { color: var(--mut); }
figcaption .flag { color: var(--fg); }
figcaption a { color: inherit; }
.frame { position: relative; overflow: hidden; border: 1px solid var(--line); background: #fff; }
iframe { display: block; border: 0; transform-origin: 0 0; }
</style>
</head>
<body>
${ctx.draft ? '<p class="draft">Draft: the check has not passed, so this is not ready to show to the owner.</p>' : ''}
<header>
  <div><h1>${esc(ctx.words.name)}: ${ctx.candidates.length} directions</h1><p class="note">The same screens with the same words, in each direction. Only the look differs: how the page is arranged is settled elsewhere, and is not what is being chosen here.</p></div>
  ${group('Show', 'part', parts)}
  ${modes.length > 1 ? group('Mode', 'mode', [['', 'Each its own'], ...modes.map((m) => [m, m])]) : ''}
  ${group('Width', 'width', [['1280', 'Desk'], ['768', 'Tablet'], ['390', 'Phone']])}
</header>
<main>
${figures}
</main>
<script>
(function(){
  var frames=[].slice.call(document.querySelectorAll('iframe')), state={part:${JSON.stringify(parts[0][0])}, mode:'', width:1280}, heights={};
  function send(f){ var modes=f.getAttribute('data-modes').split(' '); var mode=modes.indexOf(state.mode)>=0 ? state.mode : f.getAttribute('data-default'); try{ f.contentWindow.postMessage({vd:'show', part:state.part, mode:mode}, '*'); }catch(e){} }
  function fit(){ frames.forEach(function(f){ var box=f.parentNode, k=Math.min(1, box.clientWidth/state.width), h=heights[f.id]||900; f.style.width=state.width+'px'; f.style.height=h+'px'; f.style.transform='scale('+k+')'; box.style.height=Math.ceil(h*k)+'px'; }); }
  window.addEventListener('message', function(e){ var d=e.data; if(d && d.vd==='height'){ heights['f-'+d.id]=d.height; fit(); } });
  window.addEventListener('resize', fit);
  frames.forEach(function(f){ f.addEventListener('load', function(){ send(f); }); });
  var buttons=[].slice.call(document.querySelectorAll('button[data-set]'));
  function set(name, value){
    var one=buttons.filter(function(b){ return b.getAttribute('data-set')===name && b.getAttribute('data-value')===String(value); })[0];
    if(!one){ return; }
    buttons.forEach(function(b){ if(b.getAttribute('data-set')===name){ b.setAttribute('aria-pressed', String(b===one)); } });
    state[name]= name==='width' ? Number(value) : String(value);
  }
  buttons.forEach(function(b){ b.addEventListener('click', function(){ set(b.getAttribute('data-set'), b.getAttribute('data-value')); fit(); frames.forEach(send); }); });
  // The sheet can be opened in any state: sheet.html#part=landing&mode=dark&width=390
  function fromHash(){ location.hash.replace(/^#/,'').split('&').forEach(function(p){ var kv=p.split('='); if(kv[0]){ set(kv[0], kv[1]||''); } }); fit(); frames.forEach(send); }
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------------------- the record

const SEPARATION_SENTENCE = {
  rules: (c) => `Things are told apart by lines ${c.shape.border_width} px wide (\`--vd-border\`). No shadows.`,
  shadow: () => 'Cards and panels are lifted by a shadow (`--vd-shadow`), not outlined.',
  fill: () => 'Cards and panels are told from the page by their fill (`--vd-surface-raised`). No outlines and no shadows.',
  space: () => 'Things are told apart by space alone. Lines appear only between the rows of a table.'
};
function familiesLine(c) {
  const f = c.type.families;
  const bits = [`${f.text.family} for the interface and running text (\`--vd-font-text\`)`];
  if (f.display) bits.push(`${f.display.family} for the product's name, titles and headlines (\`--vd-font-display\`)`);
  if (f.mono) bits.push(`${f.mono.family} for codes (\`--vd-font-mono\`)`);
  return `${bits.join('; ')}. No other family.`;
}
const labelsLine = (c) => (c.type.labels && c.type.labels.case === 'upper' ? `Labels and table headings are in capitals, spaced ${c.type.labels.tracking_em} em.` : 'Labels and table headings are in sentence case.');
function contractTable(c, mode) {
  const edge = c.shape.action_edge === true;
  const rows = pairsOf(c).filter(([, , , , kind]) => !(kind === 'fill' && edge)).map(([fg, bg, use, min]) => `| \`--vd-${fg}\` | \`--vd-${bg}\` | ${use} | ${min}:1 |`);
  return [`Colour contract (${mode}):`, '', '| Foreground | Background | Used for | Minimum contrast |', '|---|---|---|---|', ...rows].join('\n');
}
function marksAndNevers(c) {
  const bits = [];
  if (Array.isArray(c.signature) && c.signature.length) bits.push(`Its own marks: ${c.signature.map((s) => s.what.trim().replace(/[.]$/, '')).join('; ')}.`);
  if (Array.isArray(c.refuses) && c.refuses.length) bits.push(`What it refuses: ${c.refuses.map((r) => r.trim().replace(/[.]$/, '')).join('; ')}.`);
  return bits.join(' ');
}
const chosenLine = (d) => `the direction "${d.direction.name}", ${d.chosen.adopted ? 'written down' : 'chosen'} by ${d.chosen.by} on ${d.chosen.date}`;
const lookDecision = (d) => d.decisions.filter((x) => x.look).slice(-1)[0];

// The Style section of a decisions file, in the form a product-interface skill reads.
function styleBlock(d) {
  const c = d.direction;
  if (!d.surfaces.includes('product')) refuse('This direction was settled for the landing page only: it has no values for the product.');
  const p = c.type.product, s = c.space.product, m = c.colour.modes[c.colour.default_mode];
  const others = Object.keys(c.colour.modes).filter((x) => x !== c.colour.default_mode);
  const dec = lookDecision(d);
  return [
    '## Style', '',
    `The look is ${chosenLine(d)}. It is kept in \`visual-direction.md\`, and its values in \`direction.css\`. Change it there and write this section again; do not change it here.`, '',
    '### Type', '',
    `- ${familiesLine(c)}`,
    `- Sizes in use: ${p.caption} px captions and table headings, ${p.control} px controls and table cells, ${p.body} px body, ${p.heading} px section headings, ${p.title} px screen titles. Nothing below ${p.caption} px.`,
    `- Weights: ${p.weight_text} for text, ${p.weight_label} for labels and table headings, ${p.weight_heading} for headings. Line spacing ${p.line_height}.`,
    `- ${labelsLine(c)} Numbers in columns use ${c.type.numerals === 'proportional' ? 'proportional' : 'equal-width'} digits.`, '',
    '### Colour', '',
    `- Accent (\`--vd-accent\`, ${m.accent.toLowerCase()}): ${sentence(c.colour.meanings.accent)}`,
    `- Status: danger (${m['text-danger'].toLowerCase()}) means ${sentence(c.colour.meanings.danger)} Warning (${m['text-warning'].toLowerCase()}) means ${sentence(c.colour.meanings.warning)} Success (${m['text-success'].toLowerCase()}) means ${sentence(c.colour.meanings.success)} Info (${m['text-info'].toLowerCase()}) means ${sentence(c.colour.meanings.info)} ${patches(c) ? 'A status is drawn as a filled patch with its word on it and an icon beside the word (`--vd-success`, `--vd-warning`, `--vd-danger`, `--vd-info`, each with its `--vd-text-on-...`).' : 'A status is always shown with an icon and a word as well.'}`,
    `- ${sentence(c.colour.product_use)}`,
    others.length ? `- Modes: ${c.colour.default_mode} (the default)${others.length ? `, ${others.join(', ')}` : ''}. Every pair below holds in each of them.` : `- One mode: ${c.colour.default_mode}.`, '',
    contractTable(c, c.colour.default_mode), '',
    '### Spacing', '',
    `- Scale: ${c.space.scale.join(', ')} px (\`--vd-space-1\` to \`--vd-space-${c.space.scale.length}\`). Nothing between the steps.`,
    `- Between panels, and at the edge of the screen: ${s.gutter} px.`, '',
    '### Shape', '',
    `- Corners: ${c.shape.radius_control} px on controls, ${c.shape.radius_container} px on cards, panels and dialogs.`,
    `- ${SEPARATION_SENTENCE[c.shape.separation](c)}`,
    `- One icon family: ${c.shape.icons.family}, ${c.shape.icons.stroke} px line.`,
    ...(c.shape.action_edge ? ['- The main action carries an edge (`--vd-border-control`), because its fill alone does not stand out from the page.'] : []), '',
    '### Density', '',
    `- Pointer screens: controls ${s.control_height} px high, table rows ${s.row_height} px high.`,
    `- Touch screens: controls at least ${s.touch_control_height} px high.`, '',
    '### Motion', '',
    `- ${sentence(c.motion.product)}`,
    `- A control answers in ${c.motion.control_ms} ms.`,
    `- Under reduced motion: ${sentence(c.motion.reduced)}`, '',
    '### Voice', '',
    `- Speaks to ${sentence(c.voice.speaks_to)} ${sentence(c.voice.tone)}`,
    `- ${sentence(c.voice.capitalisation)}`,
    ...(c.voice.uses.length || c.voice.avoids.length ? [`- ${c.voice.uses.length ? `The product says ${list(c.voice.uses.map((w) => `"${w}"`))}.` : ''}${c.voice.uses.length && c.voice.avoids.length ? ' ' : ''}${c.voice.avoids.length ? `It does not say ${list(c.voice.avoids.map((w) => `"${w}"`))}.` : ''}`] : []), '',
    '## Decisions', '',
    'Add this entry under the next free number of the decisions file:', '',
    `### D-NNN  The product's look is the direction "${c.name}"`, '',
    `- Date: ${dec.date}`,
    `- Decision: ${sentence(c.idea)}${marksAndNevers(c) ? ` ${marksAndNevers(c)}` : ''} The values are the Style section above.`,
    `- Why: ${sentence(dec.why)}`,
    '- Applies to: The whole product.',
    '- Supersedes: nothing.', ''
  ].join('\n');
}

// The Brand section of a page brief, in the form a landing-page skill reads.
function brandBlock(d) {
  const c = d.direction;
  if (!d.surfaces.includes('landing')) refuse('This direction was settled for the product only: it has no values for a landing page.');
  const l = c.type.landing, s = c.space.landing, f = c.type.families, m = c.colour.modes[c.colour.default_mode];
  const dec = lookDecision(d);
  const band = { accent: 'the accent', inverse: 'the text colour, with the page colour for its words', raised: 'the raised surface' }[c.colour.landing_band];
  return [
    '## Brand', '',
    `The look is ${chosenLine(d)}. It is kept in \`visual-direction.md\`, and its values in \`direction.css\`. Change it there and write this section again; do not change it here.`, '',
    `- **Type:** ${(f.display || f.text).family} for headlines, weight ${l.display_weight}: ${l.display} px at full width, line spacing ${l.display_line_height}, section headings ${l.h2} and ${l.h3} px. ${f.text.family} for running text: ${l.body} px, the line under the headline ${l.lead} px, lines of about ${l.measure_ch} characters.${f.mono ? ` ${f.mono.family} for codes.` : ''} No other family.`,
    `- **Colour:** in \`direction.css\`. ${sentence(c.colour.landing_use)} The accent (\`--vd-accent\`, ${m.accent.toLowerCase()}) means: ${sentence(c.colour.meanings.accent)} A full-width band is filled with ${band}.`,
    `- **Shape:** corners ${c.shape.radius_control} px on controls, ${c.shape.radius_container} px on panels. ${SEPARATION_SENTENCE[c.shape.separation](c)}${c.shape.action_edge ? ' The main action carries an edge.' : ''} One icon family: ${c.shape.icons.family}, ${c.shape.icons.stroke} px line.`,
    `- **Spacing:** the scale in \`direction.css\` (${c.space.scale.join(', ')} px). ${s.section_gap} px between sections, ${s.gutter} px at the edge of the page. The main action is ${s.control_height} px high.`,
    `- **Motion:** ${sentence(c.motion.landing)} Under reduced motion: ${sentence(c.motion.reduced)}`,
    `- **Imagery:** ${sentence(c.imagery.kind)} ${sentence(c.imagery.treatment)} Never: ${sentence(c.imagery.never)}`,
    `- **Voice:** speaks to ${sentence(c.voice.speaks_to)} ${sentence(c.voice.tone)} ${sentence(c.voice.capitalisation)}`, '',
    '## Decisions', '',
    'Add this entry under the next free number of the page brief:', '',
    '### D-NNN',
    `- **Date:** ${dec.date}`,
    `- **Decision:** The page's look is the direction "${c.name}": ${sentence(c.idea)}${marksAndNevers(c) ? ` ${marksAndNevers(c)}` : ''}`,
    `- **Why:** ${sentence(dec.why)}`,
    '- **Applies to:** every section',
    '- **Supersedes:** none', ''
  ].join('\n');
}
// Only the section itself, without the entry to add: what `compare` holds a project's file against.
const sectionOf = (block) => block.split('\n## Decisions')[0].trim();

function recordMarkdown(d) {
  const c = d.direction, m = c.colour.modes;
  const out = [
    `# Visual direction: ${d.product}`, '',
    `**${c.name}.** ${sentence(c.idea)}`, '', ...(isStr(c.gives_up) ? [`What it gives up: ${sentence(c.gives_up)}`, ''] : []),
    d.chosen.adopted
      ? `Written down by ${d.chosen.by} on ${d.chosen.date}, from ${sentence(d.chosen.source)} ${sentence(d.chosen.why)}`
      : `Chosen by ${d.chosen.by} on ${d.chosen.date}, from ${d.chosen.from.length} candidates (${d.chosen.from.join(', ')}; study ${d.chosen.study}): ${sentence(d.chosen.why)}`, '',
    'This file is written from `direction.json` beside it. To change the look, change that file (an owner\'s decision, added to its `decisions`) and run `render`; do not edit this one.', ''
  ];
  if (Array.isArray(c.brings_to_mind)) out.push(`It should bring to mind: ${c.brings_to_mind.join(', ')}.`, '');
  if (d.held.length) out.push(`Held from the start, the same in every candidate: ${d.held.join(', ')}.`, '');
  if (Array.isArray(c.signature)) {
    out.push('## Its own marks', '');
    for (const s of c.signature) out.push(`- **${sentence(s.what)}**${s.product ? ` In the product: ${sentence(s.product)}` : ''}${s.landing ? ` On the landing page: ${sentence(s.landing)}` : ''}`);
    out.push('');
  }
  if (Array.isArray(c.refuses)) { out.push('## It never', ''); for (const r of c.refuses) out.push(`- ${sentence(r)}`); out.push(''); }
  out.push('## Type', '');
  for (const [role, label] of [['display', 'Display'], ['text', 'Text'], ['mono', 'Codes']]) {
    const f = c.type.families[role];
    if (!f) continue;
    const src = f.source === 'system' ? 'installed on the device' : f.source.stylesheet ? `loaded from ${f.source.stylesheet}` : `files: ${f.source.files.map((x) => x.path).join(', ')}`;
    out.push(`- **${label}:** ${f.family} (${f.class}${f.width && f.width !== 'normal' ? `, ${f.width}` : ''}), falling back to ${f.fallback}. Licence: ${sentence(f.licence)} Source: ${src}.`);
  }
  out.push(`- ${labelsLine(c)} Numbers use ${c.type.numerals === 'proportional' ? 'proportional' : 'equal-width'} digits.`, '');
  out.push('## Colour', '');
  for (const k of ['accent', ...STATUSES]) out.push(`- **${k}** means: ${sentence(c.colour.meanings[k])}`);
  out.push('');
  const modeNames = Object.keys(m);
  out.push(`| Role | ${modeNames.map((x) => (x === c.colour.default_mode ? `${x} (default)` : x)).join(' | ')} |`, `|---|${modeNames.map(() => '---').join('|')}|`);
  for (const r of rolesOf(c)) out.push(`| \`--vd-${r}\` | ${modeNames.map((x) => m[x][r].toLowerCase()).join(' | ')} |`);
  out.push('');
  const measured = checkCandidate(c, { surfaces: d.surfaces, refs: null, adopt: !!d.chosen.adopted }).contrast;
  out.push('Every pair a screen may put together, and what it measures:', '', `| Foreground | Background | Used for | Needs | ${modeNames.join(' | ')} |`, `|---|---|---|---|${modeNames.map(() => '---').join('|')}|`);
  for (const [fg, bg, use, min] of pairsOf(c)) {
    const cells = modeNames.map((x) => { const row = measured.find((r) => r.mode === x && r.foreground === fg && r.background === bg); return `${row.ratio.toFixed(2)}${row.waived ? ' (the action carries an edge)' : ''}`; });
    out.push(`| \`${fg}\` | \`${bg}\` | ${use} | ${min}:1 | ${cells.join(' | ')} |`);
  }
  out.push('', '## Shape and space', '',
    `- Corners: ${c.shape.radius_control} px on controls, ${c.shape.radius_container} px on containers.`,
    `- ${SEPARATION_SENTENCE[c.shape.separation](c)}${c.shape.shadow.trim() !== 'none' ? ` Shadow: \`${c.shape.shadow.trim()}\`.` : ''}`,
    `- Icons: ${c.shape.icons.family}, ${c.shape.icons.stroke} px line. Licence: ${sentence(c.shape.icons.licence)}`,
    `- Spacing scale: ${c.space.scale.join(', ')} px.`, '');
  out.push('## Two registers', '', 'One look, said at two volumes: quietly where people work, aloud where a visitor is met.', '');
  const rows = [];
  const P = d.surfaces.includes('product'), L = d.surfaces.includes('landing');
  const cell = (on, v) => (on ? v : 'not settled');
  rows.push(['Body text', cell(P, `${P && c.type.product.body} px`), cell(L, `${L && c.type.landing.body} px`)]);
  rows.push(['Largest text', cell(P, `${P && c.type.product.title} px screen title`), cell(L, `${L && c.type.landing.display} px headline, weight ${L && c.type.landing.display_weight}`)]);
  rows.push(['Main control', cell(P, `${P && c.space.product.control_height} px high (${P && c.space.product.touch_control_height} px on touch screens)`), cell(L, `${L && c.space.landing.control_height} px high`)]);
  rows.push(['Rhythm', cell(P, `table rows ${P && c.space.product.row_height} px, ${P && c.space.product.gutter} px between panels`), cell(L, `${L && c.space.landing.section_gap} px between sections`)]);
  rows.push(['Colour', cell(P, P && sentence(c.colour.product_use)), cell(L, L && sentence(c.colour.landing_use))]);
  rows.push(['Motion', cell(P, P && sentence(c.motion.product)), cell(L, L && sentence(c.motion.landing))]);
  out.push('| | In the product | On the landing page |', '|---|---|---|', ...rows.map((r) => `| ${r.join(' | ')} |`), '');
  out.push(`Under reduced motion: ${sentence(c.motion.reduced)}`, '');
  if (isObj(c.imagery)) out.push('## Imagery', '', `- ${sentence(c.imagery.kind)}`, `- ${sentence(c.imagery.treatment)}`, `- Never: ${sentence(c.imagery.never)}`, '');
  out.push('## Voice', '', `- Speaks to ${sentence(c.voice.speaks_to)} ${sentence(c.voice.tone)}`, `- ${sentence(c.voice.capitalisation)}`);
  if (c.voice.uses.length) out.push(`- Says: ${c.voice.uses.join(', ')}.`);
  if (c.voice.avoids.length) out.push(`- Does not say: ${c.voice.avoids.join(', ')}.`);
  out.push('');
  if (d.sources.length) {
    out.push('## Where it came from', '', 'What was taken from each is a property, never the thing itself: no mark, picture or wording of a source is used.', '');
    for (const s of d.sources) out.push(`- **${s.title}** (${s.kind}; ${s.where.trim().replace(/[.]$/, '')}). Taken: ${sentence(s.took)} Left: ${sentence(s.leave)}`);
    out.push('');
  }
  out.push('## Decisions', '');
  for (const x of d.decisions) out.push(`### ${x.id}  ${x.title}`, '', `- Date: ${x.date}`, `- By: ${x.by}`, `- Decision: ${sentence(x.decision)}`, `- Why: ${sentence(x.why)}`, `- Applies to: ${sentence(x.applies_to)}`, `- Supersedes: ${x.supersedes}.`, '');
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function directionCss(d) {
  const t = tokens(d.direction, d.surfaces, '');
  const imports = t.sheets.map((s) => `@import url("${s}");`).join('\n');
  return `/* ${d.product}: the direction "${d.direction.name}", ${d.chosen.adopted ? 'written down' : 'chosen'} by ${d.chosen.by} on ${d.chosen.date}.\n   Written from direction.json by the visual-direction skill. Do not edit: change direction.json and run render. */\n${imports ? `${imports}\n\n` : '\n'}${t.css}\n`;
}

function loadDirection(D) {
  const file = path.join(D, 'direction.json');
  if (!fs.existsSync(file)) refuse(`No direction has been settled in ${D}: there is no direction.json. A study ends with pick; an existing brand is written down with adopt.`);
  const d = readJson(file);
  if (!isObj(d) || !isObj(d.direction) || !isObj(d.chosen) || !Array.isArray(d.decisions) || !Array.isArray(d.surfaces)) refuse(`${file} is not a direction this script wrote.`);
  const r = checkCandidate(d.direction, { surfaces: d.surfaces, refs: null, adopt: !!d.chosen.adopted });
  if (r.problems.length) refuse(`direction.json no longer holds a direction that can be used:\n- ${r.problems.join('\n- ')}`);
  return d;
}
function writeRecord(D, d) {
  writeJson(path.join(D, 'direction.json'), d);
  writeFile(path.join(D, 'visual-direction.md'), recordMarkdown(d));
  writeFile(path.join(D, 'direction.css'), directionCss(d));
  return ['direction.json', 'visual-direction.md', 'direction.css'].map((f) => path.join(D, f));
}
function settle(D, d, entry) {
  const file = path.join(D, 'direction.json');
  let earlier = [];
  if (fs.existsSync(file)) { const old = readJson(file); if (isObj(old) && Array.isArray(old.decisions)) earlier = old.decisions; }
  const previous = earlier.filter((x) => x.look).slice(-1)[0];
  const id = `D-${String(earlier.length + 1).padStart(3, '0')}`;
  d.decisions = [...earlier, { id, look: true, ...entry, applies_to: 'Every screen of the product and every page that speaks for it', supersedes: previous ? previous.id : 'nothing' }];
  return writeRecord(D, d);
}

// ---------------------------------------------------------------------------------------- commands

const BRIEF = `# The look of <the product>: brief

<!-- Written with the owner before any reference is gathered. Replace every comment. -->

## Product

<!-- What it is, in a sentence or two, for someone who has never seen it. -->

## People

<!-- Who meets it, where, on what, and in what state of mind: the people who work in the product,
     and the visitors who meet its landing page. -->

## Held

<!-- What every candidate must keep, each with its reason. Two sources. What the owner brings: an
     existing mark, colour or typeface; a typeface already paid for, or no money for one. And what
     the setting fixes, whether or not the owner said so: a dark ground for a dim room, tall rows
     for gloved hands, the modes the product needs (light, dark, both). Write "Nothing" only if
     neither applies. What is held here is named with --held when the candidates are named. -->

## Feel

<!-- In the owner's own words: three words the look should bring to mind, and three it should not.
     Then anything they said it must not resemble, as they said it. -->
`;
const REFERENCES = `# References

<!-- One note for each thing looked at. Kinds: own-world, other-craft, other-software,
     same-category, owner. Every note is of one thing, not of a kind of thing.

## R1  <what the thing is>

- Kind: own-world
- Where: <a link, or where it can be seen>
- Seen: looked at 2026-01-31        (or: from memory; or: described by the owner)
- Does: <what it does with type, colour, shape, space and emphasis, in words and in numbers>
- Take: <the properties worth taking>
- Leave: <what stays with it: its mark, its pictures, its words, and anything that would make
  a screen be mistaken for it>
-->
`;

function candidateNames(value, flag) {
  const names = namesArg(value, flag);
  if (names.length < 2 || names.length > 4) refuse(`A study compares two to four candidates: --${flag} <name,name,name>. Three is usual: one close to what people who use products like this expect, one drawn from the product's own world, one further out.`);
  for (const n of names) if (!/^[a-z][a-z0-9-]*$/.test(n)) refuse(`"${n}" is not a name for a candidate: small letters, digits and hyphens, starting with a letter.`);
  return names;
}
function heldNames(value) {
  const held = namesArg(value, 'held', AXES);
  if (AXES.length - held.length < 3) refuse(`With ${held.length} of the ${AXES.length} things held, too little is left to compare. What is held is the look already: write it down with adopt, and settle what it leaves open with the owner.`);
  return held;
}
const namingThen = (dir, n) => `Write each candidate from its references, its own marks first and its values after (references/direction-format.md has every field). ${n} candidates need at least ${Math.max(4, n * 2)} notes in references.md. Then: check --dir ${dir}`;

function cmdOpen(args) {
  const D = directionDir(args);
  const names = args.candidates === undefined ? [] : candidateNames(args.candidates, 'candidates');
  const surfaces = args.surfaces === undefined ? SURFACES.slice() : namesArg(args.surfaces, 'surfaces', SURFACES);
  if (!surfaces.length) refuse(`--surfaces is ${SURFACES.join(', ')}, or both.`);
  const held = heldNames(args.held);
  for (const n of studyNumbers(D)) {
    const st = readJson(path.join(D, 'studies', String(n), 'study.json'));
    if (st.state === 'open') refuse(`Study ${n} is still open. Finish it with pick, or end it with close --why "<why none was chosen>".`);
  }
  const n = (studyNumbers(D).slice(-1)[0] || 0) + 1;
  const dir = path.join(D, 'studies', String(n));
  writeJson(path.join(dir, 'study.json'), { study: n, state: 'open', opened: dateArg(args), candidates: names, surfaces, held });
  writeFile(path.join(dir, 'brief.md'), BRIEF);
  writeFile(path.join(dir, 'references.md'), REFERENCES);
  const example = readJson(path.join(SKILL, 'assets', 'example', 'studies', '1', 'words.json'));
  writeJson(path.join(dir, 'words.json'), { example: true, ...example });
  for (const id of names) writeJson(path.join(dir, 'candidates', `${id}.json`), blankCandidate(id, surfaces));
  return {
    study: n, folder: dir, candidates: names, surfaces, held,
    files: ['brief.md', 'references.md', 'words.json', ...names.map((id) => `candidates/${id}.json`)],
    then: `Write brief.md with the owner. Gather references of at least three kinds into references.md, looking at each. Put the product's own words in words.json. ${names.length ? namingThen(args.dir, names.length) : `The candidates are named after that, when you know what each is drawn from and what the brief holds: candidates --dir ${args.dir} --names <name,name,name> [--held <thing,thing>]`}`
  };
}

// The candidates are named once the references are in, and may be named again until the owner has chosen:
// one dropped is set aside, never deleted, and one added gets an empty file.
function cmdCandidates(args) {
  const D = directionDir(args);
  const study = loadStudy(D, args);
  if (study.state.state !== 'open') refuse(`Study ${study.n} is ${study.state.state}: its candidates are what they were.`);
  const names = candidateNames(args.names, 'names');
  const held = args.held === undefined ? (study.state.held || []) : heldNames(args.held);
  const dropped = (study.state.candidates || []).filter((id) => !names.includes(id));
  const added = [];
  for (const id of names) {
    if (fs.existsSync(candidateFile(study, id))) continue;
    writeJson(candidateFile(study, id), blankCandidate(id, study.state.surfaces));
    added.push(`candidates/${id}.json`);
  }
  const aside = [];
  for (const id of dropped) {
    if (!fs.existsSync(candidateFile(study, id))) continue;
    const to = path.join(study.dir, 'candidates', 'set-aside', `${id}.json`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(candidateFile(study, id), to);
    aside.push(`candidates/set-aside/${id}.json`);
  }
  const shown = !!study.state.specimens;
  Object.assign(study.state, { candidates: names, held });
  delete study.state.specimens;
  writeJson(path.join(study.dir, 'study.json'), study.state);
  return {
    out: {
      study: study.n, candidates: names, held, new_files: added, set_aside: aside,
      then: `${shown ? 'The specimens made before no longer stand for this study: make them again before anyone chooses. ' : ''}${namingThen(args.dir, names.length)}`
    },
    code: 0
  };
}

function report(D, study, seen, full) {
  const candidates = {};
  for (const [id, e] of Object.entries(seen.candidates)) {
    candidates[id] = { file: e.file, axes: e.axes, common_looks: e.common_looks.map((l) => ({ look: l.look, matched: l.matched })), problems: e.problems.length, warnings: e.warnings.length };
    if (e.contrast && e.contrast.length) {
      const lowest = e.contrast.filter((r) => !r.waived).reduce((lo, r) => (!lo || r.ratio - r.minimum < lo.ratio - lo.minimum ? r : lo), null);
      candidates[id].closest_pair = lowest && `${lowest.foreground} on ${lowest.background}, ${lowest.mode}: ${lowest.ratio} to 1 where ${lowest.minimum} is needed`;
      if (full) candidates[id].contrast = e.contrast;
    }
  }
  return {
    ok: seen.ok, study: study.n, folder: study.dir, surfaces: seen.surfaces, held: seen.held,
    compared_on: seen.free, must_differ_on: seen.mustDiffer,
    references: { notes: seen.refs.length, kinds: [...new Set(seen.refs.map((r) => r.kind).filter(Boolean))], ...(seen.refsSeen ? { seen: seen.refsSeen } : {}) },
    common_looks: { list: seen.looks.own ? 'the project\'s own, common-looks.json in the direction folder' : 'the one that comes with the skill', as_of: seen.looks.as_of },
    candidates, pairs: seen.pairs, problems: seen.problems, warnings: seen.warnings
  };
}
function cmdCheck(args) {
  const D = directionDir(args);
  const study = loadStudy(D, args);
  const seen = inspect(D, study);
  const out = report(D, study, seen, args.full === true);
  out.then = seen.ok
    ? `Make the specimens and look at every one yourself, at each width and in each mode, before the owner does: specimen --dir ${args.dir}`
    : 'Put right what is listed under problems, in the files it names, and check again. Do not change a value only to get past the check: a candidate that differs on paper and not to the eye wastes the owner\'s choice.';
  return { out, code: seen.ok ? 0 : 2 };
}

function cmdSpecimen(args) {
  const D = directionDir(args);
  const study = loadStudy(D, args);
  if (study.state.state !== 'open') refuse(`Study ${study.n} is ${study.state.state}: its specimens are what the owner was shown, and are not made again.`);
  const seen = inspect(D, study);
  const draft = args.draft === true;
  if (!seen.ok && !draft) refuse(`The check has not passed (${seen.problems.length} problem${seen.problems.length === 1 ? '' : 's'}; run check to read them), so there is nothing to show the owner yet. To look at unfinished candidates yourself: specimen --draft.`);
  if (!seen.words) refuse('words.json cannot be used yet: run check to see what it lacks.');
  const ready = study.state.candidates.filter((id) => seen.candidates[id].full);
  if (!ready.length) refuse('No candidate is complete enough to draw: run check to see what each lacks.');
  const skeletonCss = readText(path.join(SKILL, 'assets', 'specimen.css'), 'The skeleton of the specimen');
  const body = skeleton(seen.words, seen.surfaces);
  const made = [];
  const sheetCandidates = [];
  const drawn = [];
  for (const id of ready) {
    const e = seen.candidates[id];
    const ctx = { surfaces: seen.surfaces, words: seen.words, skeletonCss, body, contrast: e.contrast, refsById: seen.refsById };
    const file = path.join(study.dir, 'specimens', id, 'index.html');
    let page, inSheet = '';
    try {
      page = specimenPage(e.data, { ...ctx, base: '../../../../' });
      if (args.embed === true) inSheet = specimenPage(e.data, { ...ctx, base: '../../' });
    } catch (err) {
      // Only a draft can get here: a candidate with a part still missing cannot be drawn at all.
      if (!draft) throw err;
      continue;
    }
    writeFile(file, page);
    made.push(file);
    drawn.push(id);
    sheetCandidates.push({ id, data: e.data, common: e.common_looks.length ? `Sits in a look a great many generated interfaces share: ${e.common_looks.map((l) => l.what).join(' ')}` : '', html: inSheet });
  }
  if (!drawn.length) refuse('No candidate is complete enough to draw: run check to see what each lacks.');
  const sheet = path.join(study.dir, 'sheet.html');
  writeFile(sheet, sheetPage({ words: seen.words, surfaces: seen.surfaces, candidates: sheetCandidates, embed: args.embed === true, draft }));
  const skeletonSha = sha(body + skeletonCss);
  if (!draft) {
    study.state.specimens = { made: dateArg(args), skeleton: skeletonSha, words: sha(JSON.stringify(seen.words)), candidates: Object.fromEntries(ready.map((id) => [id, seen.candidates[id].sha])) };
    writeJson(path.join(study.dir, 'study.json'), study.state);
  }
  return {
    out: {
      study: study.n, draft, sheet, specimens: made, skeleton: skeletonSha, embedded: args.embed === true,
      not_drawn: study.state.candidates.filter((id) => !drawn.includes(id)),
      then: draft
        ? 'This is a draft for your own eyes. Put right what check lists, then make the specimens again without --draft.'
        : 'Open sheet.html and look at every candidate yourself first, each part, each width, each mode. A specimen that says a typeface did not load is not showing the candidate. Fix what looks wrong and make them again. Then show the owner the sheet, say which candidate (if any) sits in a common look, and record their choice: pick --candidate <id> --by "<their name>" --why "<their reason>"'
    },
    code: 0
  };
}

function sourcesOf(c, refsById) {
  return (c.drawn_from || []).map((d) => {
    const r = refsById[d.ref] || {};
    return { id: d.ref, title: r.title || d.ref, kind: r.kind || '', where: r.where || '', took: d.took, leave: r.leave || '' };
  });
}

function cmdPick(args) {
  const D = directionDir(args);
  const study = loadStudy(D, args);
  if (study.state.state !== 'open') refuse(`Study ${study.n} is ${study.state.state}${study.state.picked ? `: ${study.state.picked.candidate} was chosen by ${study.state.picked.by}` : ''}. Another choice is another study.`);
  const id = strArg(args, 'candidate', 'the candidate the owner chose');
  if (!study.state.candidates.includes(id)) refuse(`"${id}" is not a candidate of study ${study.n}. They are: ${study.state.candidates.join(', ')}.`);
  const by = strArg(args, 'by', 'the name of the person who chose. The choice is the owner\'s, never yours');
  const why = strArg(args, 'why', 'their reason, in their words');
  const seen = inspect(D, study);
  if (!seen.ok) refuse(`The check no longer passes (${seen.problems.length} problem${seen.problems.length === 1 ? '' : 's'}): run check, put it right, make the specimens again and show the owner.`);
  const sp = study.state.specimens;
  if (!sp) refuse('No specimens have been made, so the owner has been shown nothing: run specimen, show them the sheet, then record the choice.');
  const changed = study.state.candidates.filter((c) => sp.candidates[c] !== seen.candidates[c].sha);
  if (changed.length || sp.words !== sha(JSON.stringify(seen.words))) refuse(`${changed.length ? `${list(changed)} changed` : 'words.json changed'} after the specimens were made, so the owner was shown something else. Make the specimens again, show them, and then record the choice.`);
  const date = dateArg(args);
  const c = seen.candidates[id].data;
  study.state.state = 'picked';
  study.state.picked = { candidate: id, by, why, date };
  writeJson(path.join(study.dir, 'study.json'), study.state);
  const d = {
    format: 1, product: seen.words.name, surfaces: seen.surfaces, held: seen.held,
    chosen: { candidate: id, by, why, date, study: study.n, from: study.state.candidates },
    direction: c, sources: sourcesOf(c, seen.refsById)
  };
  const files = settle(D, d, { title: `The look of ${seen.words.name} is the direction "${c.name}"`, date, by, decision: sentence(c.idea), why });
  return { out: { study: study.n, picked: id, by, files, then: thenUse(args.dir, seen.surfaces) }, code: 0 };
}
const thenUse = (dir, surfaces) => `Hand the look to whoever builds. ${surfaces.includes('product') ? `For the product: render --dir ${dir} --style prints the Style section for its decisions file. ` : ''}${surfaces.includes('landing') ? `For a landing page: render --dir ${dir} --brand prints the Brand section for its page brief. ` : ''}Each comes with a decision entry to add in the owner's name. compare tells you later whether those files still say what the direction says.`;

function cmdClose(args) {
  const D = directionDir(args);
  const study = loadStudy(D, args);
  if (study.state.state !== 'open') refuse(`Study ${study.n} is already ${study.state.state}.`);
  study.state.state = 'closed';
  study.state.closed = { why: strArg(args, 'why', 'why none of them was chosen, in the owner\'s words where they gave any'), date: dateArg(args) };
  writeJson(path.join(study.dir, 'study.json'), study.state);
  return { out: { study: study.n, state: 'closed', then: 'The folder stays as the record of what was tried. A new study starts from what the owner said was wrong with these: open.' }, code: 0 };
}

function cmdAdopt(args) {
  const D = directionDir(args);
  const from = path.resolve(strArg(args, 'from', 'the file that holds the look, in the form of a candidate'));
  const c = readJson(from);
  const surfaces = args.surfaces === undefined ? SURFACES.slice() : namesArg(args.surfaces, 'surfaces', SURFACES);
  if (!surfaces.length) refuse(`--surfaces is ${SURFACES.join(', ')}, or both.`);
  const by = strArg(args, 'by', 'the name of the person who says this is the look');
  const why = strArg(args, 'why', 'why it is being written down now');
  const source = strArg(args, 'source', 'where the look is already set out: the brand guidelines, the token file, the live product');
  const product = strArg(args, 'product', 'the name of the product');
  const r = checkCandidate(c, { surfaces, refs: null, adopt: true });
  if (r.problems.length) return { out: { ok: false, problems: r.problems, warnings: r.warnings, then: 'A look that is written down still has to meet the floor. Where the brand itself falls below it (a pair that does not reach its contrast), that goes to the owner: it is theirs to change, and it is not written down as though it passed.' }, code: 2 };
  const date = dateArg(args);
  const d = { format: 1, product, surfaces, held: [], chosen: { adopted: true, by, why, date, source }, direction: c, sources: [] };
  const files = settle(D, d, { title: `The look of ${product} is "${c.name}", as already set out`, date, by, decision: `${sentence(c.idea)} It is set out in ${sentence(source)}`, why });
  return { out: { ok: true, adopted: c.name, files, warnings: r.warnings, then: thenUse(args.dir, surfaces) }, code: 0 };
}

function cmdRender(args) {
  const D = directionDir(args);
  const d = loadDirection(D);
  if (args.style === true) return { text: styleBlock(d), code: 0 };
  if (args.brand === true) return { text: brandBlock(d), code: 0 };
  return { out: { files: writeRecord(D, d), then: thenUse(args.dir, d.surfaces) }, code: 0 };
}

// A change to a look that is already settled: the values are changed in direction.json by hand, and this
// records whose decision it was and writes the record again. It is refused if the change went below the floor.
function cmdDecide(args) {
  const D = directionDir(args);
  const d = loadDirection(D);
  const title = strArg(args, 'title', 'the decision in one line');
  const decision = strArg(args, 'decision', 'what was decided, stated so that it can be checked on a screen');
  const by = strArg(args, 'by', 'the name of the person who decided. A change to the look is the owner\'s, never yours');
  const why = strArg(args, 'why', 'their reason');
  const date = dateArg(args);
  let supersedes = 'nothing';
  if (args.supersedes !== undefined) {
    supersedes = String(args.supersedes).trim();
    if (!d.decisions.some((x) => x.id === supersedes)) refuse(`--supersedes names ${supersedes}, and the decisions are: ${d.decisions.map((x) => x.id).join(', ')}.`);
  }
  const id = `D-${String(d.decisions.length + 1).padStart(3, '0')}`;
  d.decisions.push({ id, title, date, by, decision, why, applies_to: isStr(args['applies-to']) ? String(args['applies-to']).trim() : 'Every screen of the product and every page that speaks for it', supersedes });
  const files = writeRecord(D, d);
  return { out: { decision: id, files, then: `The record and the tokens now say it. The Style and Brand sections written from them earlier do not: write them again (render --style, render --brand), and compare will tell you which files still lag.` }, code: 0 };
}

function cmdCompare(args) {
  const D = directionDir(args);
  const d = loadDirection(D);
  if (!isStr(args.decisions) && !isStr(args.brief)) refuse('Say which file to hold against the direction: --decisions <the decisions file> or --brief <a page brief>, or both.');
  const squash = (s) => s.replace(/\s+/g, ' ').trim();
  const one = (file, heading, block) => {
    const text = readText(path.resolve(file));
    const start = text.search(new RegExp(`^##\\s+${heading}\\s*$`, 'm'));
    if (start < 0) return { file, state: 'missing', says: `It has no "## ${heading}" section.` };
    const rest = text.slice(start).replace(/^##[^\n]*\n/, '');
    const end = rest.search(/^##\s/m);
    const theirs = squash(end < 0 ? rest : rest.slice(0, end));
    const missing = sectionOf(block).split('\n').slice(1).map(squash).filter((line) => line && !/^\|[-|\s]+\|$/.test(line) && !theirs.includes(line));
    return missing.length ? { file, state: 'differs', lines_not_found: missing } : { file, state: 'same' };
  };
  const out = {};
  if (isStr(args.decisions)) out.decisions = one(args.decisions, 'Style', styleBlock(d));
  if (isStr(args.brief)) out.brief = one(args.brief, 'Brand', brandBlock(d));
  const off = Object.values(out).some((x) => x.state !== 'same');
  out.then = off
    ? 'The file no longer says what the direction says. If the look was meant to change, that is the owner\'s decision: change direction.json, add the decision to it, render, and write the section again. If it was not, write the section again from render.'
    : 'These files say what the direction says.';
  return { out, code: off ? 2 : 0 };
}

function cmdStatus(args) {
  const D = directionDir(args);
  const out = { folder: D, direction: null, studies: [] };
  if (fs.existsSync(path.join(D, 'direction.json'))) {
    const d = readJson(path.join(D, 'direction.json'));
    out.direction = { name: d.direction && d.direction.name, by: d.chosen && d.chosen.by, date: d.chosen && d.chosen.date, surfaces: d.surfaces, decisions: Array.isArray(d.decisions) ? d.decisions.length : 0 };
  }
  for (const n of studyNumbers(D)) {
    const st = readJson(path.join(D, 'studies', String(n), 'study.json'));
    out.studies.push({ study: n, state: st.state, candidates: st.candidates, specimens: st.specimens ? st.specimens.made : null, picked: st.picked || null, closed: st.closed || null });
  }
  const open = out.studies.find((s) => s.state === 'open');
  out.then = open
    ? (open.specimens ? `Study ${open.study} has specimens: show the owner the sheet and record their choice with pick. If a candidate changed since, run specimen again first.` : open.candidates.length ? `Study ${open.study} is open: check, then specimen.` : `Study ${open.study} is open and its candidates are not named yet: the brief, the references and the words first, then candidates --names <name,name,name>.`)
    : out.direction ? thenUse(args.dir, out.direction.surfaces || SURFACES) : 'No look has been settled here. Open a study (open), or write an existing brand down with adopt.';
  return { out, code: 0 };
}

const COMMANDS = { open: (a) => ({ out: cmdOpen(a), code: 0 }), candidates: cmdCandidates, check: cmdCheck, specimen: cmdSpecimen, pick: cmdPick, close: cmdClose, adopt: cmdAdopt, decide: cmdDecide, render: cmdRender, compare: cmdCompare, status: cmdStatus };
const USAGE = `usage: direction.cjs <${Object.keys(COMMANDS).join('|')}> --dir <direction folder> [...]`;

function main(argv) {
  const args = parseArgs(argv);
  const run = COMMANDS[args._[0]];
  if (!run) { console.error(USAGE); process.exit(1); }
  try {
    const r = run(args);
    if (r.text !== undefined) process.stdout.write(r.text);
    else process.stdout.write(`${JSON.stringify(r.out, null, 2)}\n`);
    process.exitCode = r.code;
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    console.error(`direction: ${e.message}`);
    process.exit(1);
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { AXES, ROLES, PAIRS, KINDS, contrast, oklch, hueGap, checkCandidate, axesOf, axisDiffers, parseReferences, checkReferences, checkBrief, checkWords, blankCandidate, tokens, skeleton, styleBlock, brandBlock, sectionOf };
