#!/usr/bin/env node
'use strict';
/**
 * ui-capture.cjs — capture one rendered screen state of the running prototype as a static wireframe
 * (Stage 03). The same capture procedure for every agent, so wireframes do not depend on who ran it.
 *
 *   node specs/.sdd/scripts/ui-capture.cjs --url http://localhost:3000/notes --name notes-list \
 *        [--wait "[data-testid=notes-list]"] [--out specs/wireframes] [--viewport 1280x800] [--aria] \
 *        [--setup ./capture-setup.cjs]
 *
 * Writes <out>/<name>.html: the document as rendered, with
 *   - every same-origin stylesheet rule inlined into one <style> block (the file renders on its own),
 *   - <script>, <noscript>, <link rel=stylesheet>, <template> removed, inline handlers and framework
 *     attributes (data-react*, data-v-*, ng-*, v-*, data-emotion, data-styled, data-radix-*) stripped,
 *   - <img>, <svg>, <video>, <canvas>, <picture>, <iframe> replaced by <div class="placeholder asset">
 *     carrying the alt/aria-label text (semantic placeholders, no binaries),
 *   - data-testid, data-key, ARIA attributes, visible text, form control state and DOM order preserved.
 * With --aria also writes <out>/<name>.aria.json: the ARIA snapshot and data-testid sequence (same shape
 * as ui-observe.cjs), the reference for `oracle.cjs diff-ui`. Always writes <out>/<name>.capture.json (url, path,
 * setup module, wait selector, viewport, test ids): the record ui-specgen.cjs turns into a per-state UI spec.
 *
 * --setup names a CommonJS module exporting `async (page) => {}`, run after navigation to drive the
 * prototype into the state to capture (log in, open a modal, trigger the empty state).
 *
 * Needs Playwright in the project (`npm i -D playwright` or `@playwright/test`), as UI projects already do
 * for the frozen UI specs. The tool itself has no dependencies.
 */
const fs = require('fs');
const path = require('path');
const L = require('./sdd-lib.cjs');

const USAGE = `Usage: node specs/.sdd/scripts/ui-capture.cjs --url URL --name NAME [--wait SELECTOR] [--out DIR] [--viewport WxH] [--aria] [--setup FILE]`;

function loadPlaywright(root) {
  for (const mod of ['playwright', '@playwright/test', 'playwright-core']) {
    try { return require(require.resolve(mod, { paths: [root, process.cwd()] })); } catch { /* next */ }
  }
  console.error('Playwright not found: npm i -D playwright (UI projects need it for the frozen UI specs too)');
  process.exit(2);
}

// Runs inside the page: returns the static document.
function serialize() {
  const STRIP_ATTR = /^(on[a-z]+|data-react.*|data-v-.*|ng-.*|v-.*|data-emotion.*|data-styled.*|data-radix-.*|data-headlessui-.*|data-reactroot|data-reactid|_ngcontent.*|_nghost.*)$/i;
  const MEDIA = 'img, svg, video, audio, canvas, picture, iframe, object, embed';
  const css = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try { for (const rule of Array.from(sheet.cssRules)) css.push(rule.cssText); } catch { /* cross-origin sheet: skipped */ }
  }
  const doc = document.documentElement.cloneNode(true);
  doc.querySelectorAll('script, noscript, template, link[rel="stylesheet"], link[rel="preload"], link[rel="modulepreload"], style').forEach(e => e.remove());
  doc.querySelectorAll(MEDIA).forEach(e => {
    const ph = document.createElement('div');
    ph.className = 'placeholder asset';
    const label = e.getAttribute('alt') || e.getAttribute('aria-label') || e.getAttribute('title') || e.tagName.toLowerCase();
    ph.textContent = label;
    for (const a of ['data-testid', 'data-key', 'role', 'aria-label', 'aria-hidden', 'class']) if (e.hasAttribute(a)) ph.setAttribute(a, e.getAttribute(a));
    if (e.hasAttribute('class')) ph.setAttribute('class', `placeholder asset ${e.getAttribute('class')}`);
    e.replaceWith(ph);
  });
  doc.querySelectorAll('*').forEach(e => {
    for (const a of Array.from(e.attributes)) if (STRIP_ATTR.test(a.name)) e.removeAttribute(a.name);
    // Form control state is observable: freeze it into attributes so the static file shows it.
    if (e instanceof HTMLInputElement) {
      if (e.type === 'checkbox' || e.type === 'radio') { if (e.checked) e.setAttribute('checked', ''); else e.removeAttribute('checked'); } else e.setAttribute('value', e.value);
    } else if (e instanceof HTMLTextAreaElement) e.textContent = e.value;
    else if (e instanceof HTMLSelectElement) Array.from(e.options).forEach(o => { if (o.selected) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
  });
  const head = doc.querySelector('head') || doc.insertBefore(document.createElement('head'), doc.firstChild);
  head.querySelectorAll('meta[http-equiv], base').forEach(e => e.remove());
  const style = document.createElement('style');
  style.textContent = `\n${css.join('\n')}\n.placeholder.asset{display:inline-flex;align-items:center;justify-content:center;min-width:2rem;min-height:2rem;border:1px dashed currentColor;opacity:.6;font:inherit}\n`;
  head.appendChild(style);
  return `<!doctype html>\n${doc.outerHTML}\n`;
}

async function main() {
  const args = L.parseArgs(process.argv.slice(2));
  const url = args.flags.url;
  const name = args.flags.name;
  if (typeof url !== 'string' || typeof name !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) { console.error(`${USAGE}\n--name is kebab-case (screen[-state]).`); return 2; }
  const root = typeof args.flags.root === 'string' ? path.resolve(args.flags.root) : L.defaultRoot();
  const outDir = path.resolve(root, typeof args.flags.out === 'string' ? args.flags.out : 'specs/wireframes');
  const [w, h] = String(args.flags.viewport || '1280x800').split('x').map(Number);
  const { chromium } = loadPlaywright(root);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: w || 1280, height: h || 800 }, locale: 'en-US', timezoneId: 'UTC' });
    await page.goto(url, { waitUntil: 'networkidle' });
    if (typeof args.flags.setup === 'string') {
      const setup = require(path.resolve(root, args.flags.setup));
      await (setup.default || setup)(page);
    }
    if (typeof args.flags.wait === 'string') await page.waitForSelector(args.flags.wait, { state: 'visible' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const html = await page.evaluate(serialize);
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${name}.html`);
    fs.writeFileSync(file, html);
    const testids = await page.locator('[data-testid]').evaluateAll(els => els.map(e => e.getAttribute('data-testid')));
    console.log(`Captured ${L.rel(root, file)} (${Math.round(Buffer.byteLength(html) / 1024)} KB, ${testids.length} data-testid${testids.length === 1 ? '' : 's'})`);
    if (!testids.length) console.log('⚠ no data-testid in this screen: the frozen UI specs select by test id (profile UI-1); fix the prototype, re-capture');
    // Capture record: how this state was reached, so ui-specgen.cjs can generate a per-state smoke spec from it.
    const record = {
      name,
      url,
      path: new URL(page.url()).pathname + new URL(page.url()).search,
      setup: typeof args.flags.setup === 'string' ? L.rel(root, path.resolve(root, args.flags.setup)) : null,
      wait: typeof args.flags.wait === 'string' ? args.flags.wait : null,
      viewport: { width: w || 1280, height: h || 800 },
      testids,
      covers: [],
      capturedAt: new Date().toISOString(),
    };
    const recFile = path.join(outDir, `${name}.capture.json`);
    fs.writeFileSync(recFile, JSON.stringify(record, null, 2) + '\n');
    if (args.flags.aria) {
      const aria = await page.locator('body').ariaSnapshot();
      const ariaFile = path.join(outDir, `${name}.aria.json`);
      fs.writeFileSync(ariaFile, JSON.stringify({ name, path: new URL(page.url()).pathname, testids, aria }, null, 2) + '\n');
      console.log(`ARIA snapshot → ${L.rel(root, ariaFile)}`);
    }
    return 0;
  } finally {
    await browser.close();
  }
}

main().then(code => { process.exitCode = code; }, e => { console.error(e.stack || String(e)); process.exitCode = 1; });
