#!/usr/bin/env node
'use strict';
/*
 * page-words.cjs: count the words a visitor reads on a landing page, section by section.
 *
 * The brief's Composition gives the page a length in words (references/composition.md, "Length").
 * A length that is only estimated is not kept, so this counts it.
 *
 * Usage:
 *   node scripts/page-words.cjs <page.html | page.txt> [--budget <words>] [--json]
 *
 * For a page that is built by a framework, count what the browser shows: save the rendered page
 * (its outer HTML) to a file, or its visible text, and count that file.
 *
 * What is counted: headings, running text, lists, tables, labels, buttons, and the questions and
 * their answers whether folded or open.
 * What is not: the navigation and the footer (<nav>, <footer>), anything hidden by an attribute
 * (hidden, aria-hidden="true"), the choices inside a <select>, scripts, styles, and the title and
 * description of a drawing. Words hidden by a stylesheet are counted: this reads no styles.
 * Counted apart: the words inside a picture made of text, such as a demonstration of the product
 * running on sample material. Mark its element data-words="off". They are reported as sample
 * words and are not part of the length.
 *
 * A part is a <header>, <section> or <article> that is not inside another one. It is named by its
 * first heading.
 *
 * Needs: Node >= 18. No npm dependencies. The page is read as text; nothing in it is run.
 * Exit codes: 0 ok, 1 usage error, 2 over the budget.
 */

const fs = require('fs');

const RAW = /^(script|style|noscript|template)$/;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
// Tags that sit inside a line of text. Any other tag ends a word.
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var']);
const PARTS = new Set(['header', 'section', 'article']);
const NEVER = new Set(['nav', 'footer', 'select', 'datalist', 'textarea', 'head', 'title', 'desc']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', times: '\u00d7', middot: '\u00b7', copy: '\u00a9' };

function fail(message) {
  process.stderr.write(`page-words: ${message}\n`);
  process.exit(1);
}

function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : ' ';
  });
}

const words = (text) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const dashes = (text) => (text.match(/\u2014|(?<=\s)--(?=\s)/g) || []).length;

// The attributes of one tag, names and values in lower case. An attribute without a value is ''.
function attributes(text) {
  const found = {};
  const one = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (let m = one.exec(text); m; m = one.exec(text)) found[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').toLowerCase();
  return found;
}

// Reads the page as a run of tags and text. It keeps only the three things it needs: whether the
// text is counted, which part it is in, and whether it is in a heading.
function read(html) {
  const parts = [];
  let part = null; // the open part, or null
  let partTag = null;
  let partDepth = 0;
  let outside = null; // text that is in no part
  let skip = null; // { tag, depth, sample }
  let heading = null; // { level, text }
  let first = null; // the first <h1>
  let sample = '';

  const here = () => {
    if (part) return part;
    if (!outside) { outside = { name: '(outside any section)', text: '', headings: [] }; parts.push(outside); }
    return outside;
  };
  const add = (text) => {
    if (skip) { if (skip.sample) sample += text; return; }
    if (!part && !outside && !/\S/.test(text)) return; // white space between the parts is in none of them
    here().text += text;
    if (heading) heading.text += text;
  };

  const token = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype[^>]*>|<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+|<)/gi;
  for (let m = token.exec(html); m; m = token.exec(html)) {
    if (m[5] !== undefined) { add(decode(m[5])); continue; }
    if (m[3] === undefined) { add(' '); continue; } // a comment, a doctype or a raw element
    const tag = m[3].toLowerCase();
    if (RAW.test(tag)) continue;
    const closing = m[2] === '/';
    const attrs = m[4] || '';
    const empty = VOID.has(tag) || /\/\s*$/.test(attrs);
    if (!INLINE.has(tag)) add(' ');

    if (skip) {
      if (tag !== skip.tag || empty) continue;
      if (!closing) skip.depth += 1;
      else if ((skip.depth -= 1) === 0) skip = null;
      continue;
    }
    if (closing) {
      if (heading && tag === `h${heading.level}`) {
        const text = heading.text.replace(/\s+/g, ' ').trim();
        here().headings.push(text);
        if (heading.level === 1 && first === null) first = text;
        heading = null;
      }
      if (part && tag === partTag && (partDepth -= 1) === 0) { part = null; partTag = null; }
      continue;
    }
    const has = attributes(attrs);
    const off = has['data-words'] === 'off';
    const hidden = has.hidden !== undefined || has['aria-hidden'] === 'true';
    if (!empty && (off || hidden || NEVER.has(tag))) { skip = { tag, depth: 1, sample: off && !hidden }; continue; }
    if (empty) continue;
    if (PARTS.has(tag)) {
      if (!part) { part = { name: null, text: '', headings: [] }; parts.push(part); partTag = tag; partDepth = 1; }
      else if (tag === partTag) partDepth += 1;
      continue;
    }
    const h = tag.match(/^h([1-6])$/);
    if (h && !heading) heading = { level: Number(h[1]), text: '' };
  }
  return { parts, first, sample };
}

function count(source) {
  const looksLikeHtml = /<[a-zA-Z!\/][^>]*>/.test(source);
  const { parts, first, sample } = looksLikeHtml ? read(source) : { parts: [{ name: '(the whole text)', text: source, headings: [] }], first: null, sample: '' };
  const rows = parts
    .map((p) => ({ name: p.name || p.headings[0] || '(no heading)', words: words(p.text).length, dashes: dashes(p.text) }))
    .filter((r) => r.words > 0);
  const total = rows.reduce((n, r) => n + r.words, 0);
  for (const r of rows) r.share = total ? Math.round((r.words / total) * 100) : 0;
  return {
    words: total,
    headline: first,
    headline_words: first === null ? null : words(first).length,
    dashes: rows.reduce((n, r) => n + r.dashes, 0),
    sample_words: words(sample).length,
    parts: rows.map(({ name, words: w, share }) => ({ name: name.length > 60 ? `${name.slice(0, 57)}...` : name, words: w, share })),
  };
}

function main(argv) {
  let file = null;
  let budget = null;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--budget') {
      budget = Number(argv[i += 1]);
      if (!Number.isInteger(budget) || budget <= 0) fail('--budget needs a whole number of words');
    } else if (a.startsWith('--')) fail(`unknown option ${a}`);
    else if (file === null) file = a;
    else fail('one page at a time');
  }
  if (file === null) fail('usage: node scripts/page-words.cjs <page.html | page.txt> [--budget <words>] [--json]');
  let source;
  try { source = fs.readFileSync(file, 'utf8'); } catch (e) { fail(`cannot read ${file}: ${e.code || e.message}`); }

  const counted = count(source);
  const result = { file, ...counted, budget, over: budget === null ? null : Math.max(0, counted.words - budget) };
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    const lines = [];
    const verdict = budget === null ? '' : result.over ? `, ${result.over} over the ${budget} in the brief` : `, within the ${budget} in the brief`;
    lines.push(`${result.words} words${verdict}`);
    if (result.headline !== null) lines.push(`headline: ${result.headline_words} words`);
    const width = Math.max(...result.parts.map((p) => String(p.words).length), 1);
    for (const p of result.parts) lines.push(`  ${String(p.words).padStart(width)}  ${String(p.share).padStart(3)}%  ${p.name}`);
    if (result.sample_words) lines.push(`sample words, counted apart: ${result.sample_words}`);
    if (result.dashes) lines.push(`dashes: ${result.dashes}`);
    process.stdout.write(`${lines.join('\n')}\n`);
  }
  process.exit(result.over ? 2 : 0);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { count, words };
