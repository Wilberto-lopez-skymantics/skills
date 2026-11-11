#!/usr/bin/env node
'use strict';
/**
 * capture: saves the evidence a run needs (screenshots, page text, page measurements) by driving a
 * Chrome or Edge that is already installed. Zero dependencies and nothing to download: it starts the
 * browser headless and talks to it over its remote-control (DevTools) protocol.
 *
 *   node capture.cjs --config <config.json> --run <run-dir> [--plan <capture.json>] [--unit <id>]
 *                    [--controls] [--recapture-controls] [--browser <path>] [--headed] [--allow-remote]
 *
 * The plan (default: capture.json beside the config) says how to reach each step of each journey:
 * where to go, what to press, what to type. See references/config.md, "Capture plan".
 *
 * Each journey is replayed once per screen size in a fresh private browser context, so nothing
 * carries over from one pass to the next except what the application itself stored on its server.
 *
 * After those passes the journey is replayed once more, with motion left on, for what a still picture
 * cannot show (the probe pass): where the Tab key goes and what shows focus, how controls look when
 * hovered, focused and pressed, what moves and for how long, and a strip of frames for the steps the
 * plan names under "motion_steps". Its results go to keyboard/, states/, motion/ and frames/ beside
 * the screenshots; it never touches the screenshots themselves. "probes": false in the plan turns it off.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const uxq = require('./uxq.cjs');

const MAX_HEIGHT = 12000;
const ACTIONS = ['use', 'goto', 'click', 'hover', 'fill', 'select', 'press', 'wait_for', 'wait_gone', 'wait_ms', 'scroll', 'eval', 'plant'];
const IF_FOUND = ['stop', 'hide'];
const PROBES = ['keyboard', 'states', 'motion', 'frames'];
const MOVERS = ['click', 'press', 'hover', 'select'];
const MAX_STOPS = 60;
const MAX_CONTROLS = 4;
const FRAME_WINDOW_MS = 600;
const MAX_FRAMES = 5;
const KEYS = {
  Tab: { key: 'Tab', code: 'Tab', keyCode: 9 }, Enter: { key: 'Enter', code: 'Enter', keyCode: 13, text: '\r' },
  Escape: { key: 'Escape', code: 'Escape', keyCode: 27 }, Space: { key: ' ', code: 'Space', keyCode: 32, text: ' ' },
  Backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }, ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }, ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fail(msg) { console.error(`capture: ${msg}`); process.exit(1); }
const isLocalHost = (h) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(h) || h.endsWith('.localhost') || h.endsWith('.test');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[argv[i].slice(2)] = true;
    else { args[argv[i].slice(2)] = next; i += 1; }
  }
  return args;
}

// ---------------------------------------------------------------- browser
function findBrowser(explicit) {
  const env = process.env;
  const candidates = [
    explicit, env.UXQ_BROWSER,
    env.PROGRAMFILES && path.join(env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env['PROGRAMFILES(X86)'] && path.join(env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env['PROGRAMFILES(X86)'] && path.join(env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    env.PROGRAMFILES && path.join(env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge', '/snap/bin/chromium'
  ].filter((p) => typeof p === 'string');
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function launch(browserPath, headed) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'uxq-browser-'));
  const args = [`--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--hide-scrollbars', '--mute-audio', '--window-size=1280,900', 'about:blank'];
  if (!headed) args.unshift('--headless=new', '--disable-gpu');
  const child = spawn(browserPath, args, { stdio: 'ignore' });
  let exited = false;
  child.on('exit', () => { exited = true; });
  // The browser writes the port it chose, and the path of its control socket, into its profile folder.
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let waited = 0; waited < 20000; waited += 100) {
    if (exited) break;
    if (fs.existsSync(portFile)) {
      const lines = fs.readFileSync(portFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 2) return { child, profile, wsUrl: `ws://127.0.0.1:${lines[0]}${lines[1]}` };
    }
    await sleep(100);
  }
  try { child.kill(); } catch (_) { /* already gone */ }
  throw new Error(`the browser did not start: ${browserPath}`);
}

async function shutdown(browser, cdp) {
  try { await Promise.race([cdp.send('Browser.close'), sleep(3000)]); } catch (_) { /* closing */ }
  await sleep(300);
  try { browser.child.kill(); } catch (_) { /* already gone */ }
  for (let i = 0; i < 10; i += 1) {
    try { fs.rmSync(browser.profile, { recursive: true, force: true }); return; } catch (_) { await sleep(300); }
  }
}

// A minimal WebSocket client: enough to exchange text messages with a browser on this machine.
function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const socket = net.connect(Number(u.port), u.hostname);
    let buffer = Buffer.alloc(0);
    let open = false;
    const fragments = [];
    const frame = (opcode, payload) => {
      const mask = crypto.randomBytes(4);
      let header;
      if (payload.length < 126) header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
      else if (payload.length < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
      else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
      const masked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i += 1) masked[i] = payload[i] ^ mask[i & 3];
      socket.write(Buffer.concat([header, mask, masked]));
    };
    const ws = { onmessage() {}, onclose() {}, send(text) { frame(0x1, Buffer.from(text)); }, close() { socket.destroy(); } };
    socket.on('connect', () => socket.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!open) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        const head = buffer.slice(0, end).toString();
        if (!/^HTTP\/1\.1 101/.test(head)) { socket.destroy(); reject(new Error(`the browser refused the connection: ${head.split('\r\n')[0]}`)); return; }
        buffer = buffer.slice(end + 4);
        open = true;
        resolve(ws);
      }
      for (;;) {
        if (buffer.length < 2) return;
        const fin = (buffer[0] & 0x80) !== 0;
        const opcode = buffer[0] & 0x0f;
        let len = buffer[1] & 0x7f;
        let offset = 2;
        if (len === 126) { if (buffer.length < 4) return; len = buffer.readUInt16BE(2); offset = 4; } else if (len === 127) { if (buffer.length < 10) return; len = Number(buffer.readBigUInt64BE(2)); offset = 10; }
        if (buffer.length < offset + len) return;
        const payload = buffer.slice(offset, offset + len);
        buffer = buffer.slice(offset + len);
        if (opcode === 0x8) { socket.destroy(); return; }
        if (opcode === 0x9) { frame(0xA, payload); continue; }
        if (opcode === 0xA) continue;
        fragments.push(payload);
        if (fin) { const message = Buffer.concat(fragments).toString('utf8'); fragments.length = 0; ws.onmessage(message); }
      }
    });
    socket.on('error', (e) => { if (!open) reject(e); });
    socket.on('close', () => ws.onclose());
  });
}

function createCdp(ws) {
  let nextId = 0;
  const pending = new Map();
  const handlers = [];
  ws.onmessage = (raw) => {
    const m = JSON.parse(raw);
    if (m.id === undefined) { for (const h of handlers) h(m); return; }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.error) p.reject(new Error(`${p.method}: ${m.error.message}`)); else p.resolve(m.result);
  };
  ws.onclose = () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('the browser closed the connection')); } pending.clear(); };
  return {
    on(fn) { handlers.push(fn); },
    send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const id = (nextId += 1);
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 60000);
        pending.set(id, { resolve, reject, timer, method });
        ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
      });
    }
  };
}

// ---------------------------------------------------------------- in-page helpers
// Finds the first visible element for a target. Targets: a CSS selector, "text=..." (a control by its
// visible text, exact match first) or "label=..." (a form field by its label, aria-label or placeholder).
const FIND = `(target) => {
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const pick = (list, textOf, want) => list.find((e) => textOf(e) === want) || list.find((e) => textOf(e).includes(want)) || null;
  if (target.startsWith('text=')) {
    const controls = [...document.querySelectorAll('button, a, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], input[type=submit], input[type=button], summary, label, [onclick]')].filter(visible);
    return pick(controls, (e) => norm(e.innerText || e.value || e.getAttribute('aria-label')), norm(target.slice(5)));
  }
  if (target.startsWith('label=')) {
    const want = norm(target.slice(6));
    const label = pick([...document.querySelectorAll('label')].filter((l) => l.control && visible(l.control)), (l) => norm(l.innerText), want);
    if (label) return label.control;
    return pick([...document.querySelectorAll('input, select, textarea')].filter(visible), (e) => norm(e.getAttribute('aria-label') || e.getAttribute('placeholder')), want);
  }
  return [...document.querySelectorAll(target)].find(visible) || null;
}`;
const inPage = (target, body) => `(() => { const el = (${FIND})(${JSON.stringify(target)}); if (!el) return null; ${body} })()`;

function createPage(cdp, sessionId, timeoutMs) {
  const send = (method, params) => cdp.send(method, params, sessionId);
  // A click that loads a new page destroys the script context for a moment; try again briefly.
  const evaluate = async (expression) => {
    let lastError;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(`page script failed: ${(r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text}`);
        return r.result.value;
      } catch (e) {
        lastError = e;
        if (!/context|navigat|Cannot find/i.test(e.message)) throw e;
        await sleep(250);
      }
    }
    throw lastError;
  };
  const until = async (probe, what) => {
    for (let waited = 0; waited <= timeoutMs; waited += 100) {
      let ok = false;
      try { ok = await probe(); } catch (_) { ok = false; }
      if (ok) return;
      await sleep(100);
    }
    throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
  };
  const present = (target) => (target.startsWith('text=')
    ? evaluate(`document.body && document.body.innerText.replace(/\\s+/g, ' ').toLowerCase().includes(${JSON.stringify(target.slice(5).replace(/\s+/g, ' ').trim().toLowerCase())})`)
    : evaluate(inPage(target, 'return true;')).then(Boolean));
  // Mouse events are placed in the visible part of the window. On a phone-sized screen a page wider
  // than the screen is laid out wider and panned, so the visible part can sit away from the layout
  // origin: the element's position is corrected by that offset, or the click lands beside it.
  const pointOf = async (target) => {
    let point = null;
    await until(async () => { point = await evaluate(inPage(target, "el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); const vv = window.visualViewport; return { x: r.left + r.width / 2 - (vv ? vv.offsetLeft : 0), y: r.top + r.height / 2 - (vv ? vv.offsetTop : 0) };")); return Boolean(point); }, `"${target}" to appear`);
    return point;
  };
  const loaded = () => until(() => evaluate("document.readyState === 'complete'"), 'the page to load');
  return {
    send, evaluate, until, present, loaded,
    locate: pointOf,
    // The click alone, without waiting for what it causes.
    async clickNow(target) {
      const p = await pointOf(target);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    },
    async click(target) {
      await this.clickNow(target);
      await sleep(100);
      await loaded();
    },
    async hover(target) { const p = await pointOf(target); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y }); },
    async fill(target, value) {
      await pointOf(target);
      await evaluate(inPage(target, "el.focus(); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, 'value'); if (setter && setter.set) setter.set.call(el, ''); else el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); return true;"));
      if (value !== '') await send('Input.insertText', { text: value });
    },
    async select(target, value) {
      await pointOf(target);
      const ok = await evaluate(inPage(target, `const want = ${JSON.stringify(value)}; const o = [...el.options].find((x) => x.value === want) || [...el.options].find((x) => x.text.trim() === want); if (!o) return false; el.value = o.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true;`));
      if (!ok) throw new Error(`"${target}" has no option "${value}"`);
    },
    async press(name, times, shift) {
      const k = KEYS[name];
      if (!k) throw new Error(`unknown key "${name}" (known: ${Object.keys(KEYS).join(', ')})`);
      const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode, nativeVirtualKeyCode: k.keyCode, modifiers: shift ? 8 : 0 };
      for (let i = 0; i < times; i += 1) {
        await send('Input.dispatchKeyEvent', { ...base, type: k.text ? 'keyDown' : 'rawKeyDown', ...(k.text ? { text: k.text } : {}) });
        await send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
        await sleep(40);
      }
    },
    // Wait until the page has loaded, fonts are in and the screen has had time to stop moving.
    async settle(ms) {
      await loaded();
      await evaluate(`new Promise((done) => { const finish = () => setTimeout(done, ${Number(ms)}); const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(); Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]).then(finish, finish); })`);
    }
  };
}

// ---------------------------------------------------------------- plan
function loadPlan(file) {
  if (!fs.existsSync(file)) fail(`capture plan not found: ${file}`);
  let plan;
  try { plan = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { fail(`capture plan is not valid JSON: ${e.message}`); }
  const problems = [];
  if (!plan.base_url) problems.push('base_url is required');
  const checkList = (list, where) => {
    if (!Array.isArray(list)) { problems.push(`${where}: must be a list of actions`); return; }
    list.forEach((a, i) => {
      const keys = a && typeof a === 'object' ? Object.keys(a).filter((k) => ACTIONS.includes(k)) : [];
      if (keys.length !== 1) { problems.push(`${where} action ${i + 1}: needs exactly one of ${ACTIONS.join(', ')}`); return; }
      if (keys[0] === 'use' && !(plan.flows || {})[a.use]) problems.push(`${where} action ${i + 1}: unknown flow "${a.use}"`);
      if ((keys[0] === 'fill' || keys[0] === 'select') && !(Array.isArray(a[keys[0]]) && a[keys[0]].length === 2)) problems.push(`${where} action ${i + 1}: ${keys[0]} takes [target, value]`);
      if (keys[0] === 'scroll' && a.scroll !== 'through') problems.push(`${where} action ${i + 1}: scroll takes "through"`);
    });
  };
  const checkProbes = (value, where) => {
    if (value === undefined || typeof value === 'boolean') return;
    if (!Array.isArray(value) || value.some((k) => !PROBES.includes(k))) problems.push(`${where}: probes must be true, false or a list of ${PROBES.join(', ')}`);
  };
  checkProbes(plan.probes, 'plan');
  for (const [name, list] of Object.entries(plan.flows || {})) checkList(list, `flow ${name}`);
  for (const [unit, u] of Object.entries(plan.units || {})) {
    if (u.start !== undefined) checkList(u.start, `unit ${unit} start`);
    if (u.keep_not_product !== undefined && typeof u.keep_not_product !== 'boolean') problems.push(`unit ${unit}: keep_not_product must be true or false`);
    for (const [step, list] of Object.entries(u.steps || {})) checkList(list, `unit ${unit} step ${step}`);
    checkProbes(u.probes, `unit ${unit}`);
    if (u.window_steps !== undefined) {
      if (!Array.isArray(u.window_steps)) problems.push(`unit ${unit}: window_steps must be a list of step ids`);
      else for (const step of u.window_steps) if (!Array.isArray((u.steps || {})[step])) problems.push(`unit ${unit}: window_steps names "${step}", which has no actions in the plan`);
    }
    if (u.motion_steps !== undefined) {
      if (!Array.isArray(u.motion_steps)) problems.push(`unit ${unit}: motion_steps must be a list of step ids`);
      else if (!problems.length) for (const step of u.motion_steps) {
        const list = (u.steps || {})[step];
        if (!Array.isArray(list)) problems.push(`unit ${unit}: motion_steps names "${step}", which has no actions in the plan`);
        else if (!flatten(list, plan).some((a) => MOVERS.some((k) => a[k] !== undefined))) problems.push(`unit ${unit}: motion step "${step}" needs a click, press, hover or select action for the frames to follow`);
      }
    }
  }
  if (plan.not_product !== undefined) {
    if (!Array.isArray(plan.not_product)) problems.push('not_product: must be a list');
    else plan.not_product.forEach((n, i) => {
      if (!n || typeof n.selector !== 'string' || !n.selector.trim()) problems.push(`not_product ${i + 1}: needs a CSS "selector"`);
      if (!n || typeof n.what !== 'string' || !n.what.trim()) problems.push(`not_product ${i + 1}: needs "what", a few words saying what it is`);
      if (n && n.if_found !== undefined && !IF_FOUND.includes(n.if_found)) problems.push(`not_product ${i + 1}: if_found must be one of ${IF_FOUND.join(', ')}`);
    });
  }
  if (problems.length) fail(`capture plan is invalid:\n  - ${problems.join('\n  - ')}`);
  return plan;
}

// A step's actions with every "use" replaced by the actions of the flow it names.
function flatten(list, plan) { return list.flatMap((a) => (a.use ? flatten((plan.flows || {})[a.use] || [], plan) : [a])); }

// "${NAME}" in a value is read from the environment, so passwords need not be written into the plan.
function fromEnv(value) {
  return String(value).replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    if (process.env[name] === undefined) throw new Error(`environment variable ${name} is not set`);
    return process.env[name];
  });
}
const describe = (action) => JSON.stringify(action.fill ? { ...action, fill: [action.fill[0], '***'] } : action);

async function runActions(page, list, ctx) {
  for (const action of list) {
    try {
      if (action.use) await runActions(page, ctx.plan.flows[action.use], ctx);
      else if (action.goto !== undefined) {
        const url = new URL(fromEnv(action.goto), ctx.base);
        if (url.origin !== ctx.base.origin && !ctx.allowRemote) throw new Error(`goto leaves ${ctx.base.origin}; pass --allow-remote if that is intended`);
        await page.send('Page.navigate', { url: url.href });
        await sleep(150);
        await page.loaded();
      } else if (action.click) await page.click(action.click);
      else if (action.hover) await page.hover(action.hover);
      else if (action.fill) await page.fill(action.fill[0], fromEnv(action.fill[1]));
      else if (action.select) await page.select(action.select[0], fromEnv(action.select[1]));
      else if (action.press) await page.press(action.press, action.times || 1, Boolean(action.shift));
      else if (action.wait_for) await page.until(() => page.present(action.wait_for), `"${action.wait_for}" to appear`);
      else if (action.wait_gone) await page.until(async () => !(await page.present(action.wait_gone)), `"${action.wait_gone}" to go away`);
      else if (action.wait_ms !== undefined) await sleep(Number(action.wait_ms));
      else if (action.scroll) {
        // Down the page a window at a time and back to the top, as a reader goes: what appears on
        // scrolling has appeared, and pictures that wait to be near the window have loaded.
        await page.evaluate(`(async () => {
          const pause = (ms) => new Promise((r) => setTimeout(r, ms));
          const stride = Math.max(200, Math.round(window.innerHeight * 0.8));
          for (let y = 0, n = 0; y < document.documentElement.scrollHeight && n < 80; y += stride, n++) { window.scrollTo(0, y); await pause(120); }
          window.scrollTo(0, document.documentElement.scrollHeight); await pause(250);
          window.scrollTo(0, 0); await pause(250);
          return true;
        })()`);
      } else if (action.eval) await page.evaluate(action.eval);
      else if (action.plant) {
        await page.evaluate(`window.__uxqPlants = ${JSON.stringify(action.plant)}; true`);
        const result = await page.evaluate(ctx.plantSource);
        if (result.not_found.length) throw new Error(`planted nothing for ${JSON.stringify(result.not_found)}`);
        ctx.planted.push(...result.applied);
      }
    } catch (e) {
      if (!e.action) { e.action = describe(action); }
      throw e;
    }
  }
}

// ---------------------------------------------------------------- capture
// Things a real user would never see (seeded sign-in shortcuts, debug bars) would be reviewed and
// scored as if they were the product. The plan names them under "not_product". By default finding one
// on screen stops the capture, because the honest fix is a build without it. With "if_found": "hide"
// it is hidden by a style rule instead (which survives the page redrawing itself), and the run keeps a
// note that the scorecard repeats.
const NOT_PRODUCT = `(items) => {
  const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  // Look with our own hiding rule switched off, so a screen later in the same page still reports what is there.
  const ours = document.getElementById('uxq-not-product');
  if (ours) ours.disabled = true;
  const found = items.map((it) => { try { return { ...it, elements: [...document.querySelectorAll(it.selector)].filter(shown).length }; } catch (e) { return { ...it, elements: 0, error: 'not a valid CSS selector' }; } });
  if (ours) ours.disabled = false;
  const hide = found.filter((it) => it.if_found === 'hide' && !it.error);
  if (hide.length && !ours) {
    const style = document.createElement('style');
    style.id = 'uxq-not-product';
    style.textContent = hide.map((it) => it.selector + ' { display: none !important; }').join(' ');
    document.head.appendChild(style);
  }
  return found;
}`;
async function setAsideNotProduct(page, items) {
  if (!items.length) return [];
  const found = await page.evaluate(`(${NOT_PRODUCT})(${JSON.stringify(items.map((n) => ({ selector: n.selector, what: n.what, if_found: n.if_found || 'stop' })))})`);
  const bad = found.find((n) => n.error);
  if (bad) throw new Error(`not_product "${bad.what}": ${bad.selector} is ${bad.error}`);
  const stop = found.filter((n) => n.elements > 0 && n.if_found !== 'hide');
  if (stop.length) throw new Error(`on screen but not part of the product: ${stop.map((n) => `${n.what} (${n.selector})`).join('; ')}. Capture a build or mode without it; if that is not possible, set "if_found": "hide" for it in the capture plan and the scorecard will say it was hidden.`);
  const hidden = found.filter((n) => n.elements > 0);
  if (hidden.length) await sleep(120);
  return hidden.map((n) => ({ what: n.what, selector: n.selector, elements: n.elements }));
}

// The picture of a step is the whole page, as scrolling would show it. For a step the plan lists under
// "window_steps" it is the window alone, as it stands on arrival: what someone sees before they scroll.
async function captureStep(page, viewport, outDir, stepId, factsSource, windowOnly = false) {
  // A browser that refuses a narrow window lays the page out wider and crops the picture. That would be
  // scored as a defect of the product, so refuse to save it. The layout width is the document's client
  // width: window.innerWidth is no use here, because a phone browser reports a wider window when the
  // page overflows sideways, and that overflow is a finding to record, not a reason to stop.
  const laidOut = await page.evaluate('document.documentElement.clientWidth');
  if (laidOut !== viewport.width) throw new Error(`the page is laid out ${laidOut} px wide, not the configured ${viewport.width}`);
  // Back to the top before the picture: pressing something scrolls it into view, and a header that
  // sticks to the top of the window would otherwise be drawn across the middle of the full page.
  await page.evaluate('window.scrollTo(0, 0)');
  await sleep(150);
  // An application that scrolls inside a panel (the window itself never scrolls) would be photographed
  // one screenful deep, its panel cut off. Grow the window by what the main panel hides, so the picture
  // shows the whole screen as scrolling would, then put the window back for the next step.
  const hidden = await page.evaluate(`(() => {
    const d = document.documentElement;
    if (d.scrollHeight > window.innerHeight + 2) return 0;
    let most = 0;
    for (const e of document.querySelectorAll('body *')) {
      const st = getComputedStyle(e);
      if (!/(auto|scroll)/.test(st.overflowY)) continue;
      const r = e.getBoundingClientRect();
      if (r.width < window.innerWidth * 0.6 || r.height < window.innerHeight * 0.4) continue;
      most = Math.max(most, e.scrollHeight - e.clientHeight);
    }
    return Math.max(0, Math.min(most, ${MAX_HEIGHT}));
  })()`);
  const grown = hidden > 8 && !windowOnly ? Math.min(viewport.height + hidden, MAX_HEIGHT) : viewport.height;
  if (grown > viewport.height) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: grown, deviceScaleFactor: 1, mobile: Boolean(viewport.touch) });
    await sleep(300);
  }
  const facts = await page.evaluate(`window.__uxqFirstWindow = ${viewport.height};\n${factsSource}`);
  const text = await page.evaluate("document.body ? document.body.innerText : ''");
  const metrics = await page.send('Page.getLayoutMetrics', {});
  const content = metrics.cssContentSize || metrics.contentSize;
  const height = windowOnly ? viewport.height : Math.max(grown, Math.min(Math.ceil(content.height), MAX_HEIGHT));
  const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !windowOnly, clip: { x: 0, y: 0, width: viewport.width, height, scale: 1 } });
  if (grown > viewport.height) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: Boolean(viewport.touch) });
    await sleep(150);
  }
  const name = `${stepId}.${viewport.id}`;
  for (const kind of ['screens', 'pages', 'facts']) fs.mkdirSync(path.join(outDir, kind), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'screens', `${name}.png`), Buffer.from(shot.data, 'base64'));
  fs.writeFileSync(path.join(outDir, 'pages', `${name}.txt`), `${text}\n`);
  fs.writeFileSync(path.join(outDir, 'facts', `${name}.json`), `${JSON.stringify(facts, null, 2)}\n`);
  return { step: stepId, size: viewport.id, height, ...(windowOnly ? { window_only: true } : {}), ...(grown > viewport.height ? { panel_grown_by: grown - viewport.height } : {}), cut_off: !windowOnly && Math.ceil(content.height) > MAX_HEIGHT || hidden >= MAX_HEIGHT };
}

// ---------------------------------------------------------------- probes
// What a still picture cannot show. The probe pass replays the journey once more, with motion on, at
// the journey's first screen size without touch (else its first), and at each step it reads:
//   motion/    transitions and animations the page declares, with and without the reduced-motion
//              preference; what is running; layout shifts; whether the page ever stops changing
//   states/    the main controls at rest, hovered, focused and pressed (the browser is told to apply
//              each state's styles, so no event is fired and nothing is activated), with what changed
//   keyboard/  where the Tab key goes: every stop in order, what shows focus there, what is skipped
//   frames/    for the steps the plan names under "motion_steps": pictures taken while the step's
//              last click, key, hover or selection plays out
const SHIFT_OBSERVER = `(() => { try { window.__uxqShifts = []; new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__uxqShifts.push({ value: e.value, recent_input: e.hadRecentInput, nodes: (e.sources || []).slice(0, 3).map((s) => s.node) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (_) { /* this browser does not report layout shifts */ } })();`;

function probesFor(plan, unitPlan) {
  const kinds = (v) => (v === undefined ? null : v === true ? PROBES : v === false ? [] : v);
  return kinds(unitPlan.probes) || kinds(plan.probes) || PROBES;
}
const writeJson = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`); };
const examples = (list) => ({ count: list.length, examples: list.slice(0, 8) });

async function walkKeyboard(page) {
  const start = await page.evaluate('window.__uxq.walkStart()');
  const stops = [];
  let open = null; // the stop whose focus indicator is read once focus has moved on
  let same = 0; let left = 0; let real = 0;
  let ended = `stopped after ${MAX_STOPS} stops; there are more`;
  const close = (shownBy) => { if (open && shownBy) open.focus_shown_by = shownBy; open = null; };
  for (let presses = 0; presses < MAX_STOPS + 40 && real < MAX_STOPS; presses += 1) {
    await page.press('Tab', 1, false);
    const r = await page.evaluate('window.__uxq.walkStep()');
    if (r.same) {
      same += 1;
      if (same >= (r.frame ? 25 : 2)) { ended = r.frame ? 'focus stayed inside an embedded frame' : `focus is stuck on ${r.element}: Tab does not leave it`; break; }
      continue;
    }
    same = 0;
    close(r.previous);
    if (r.again !== undefined) { ended = `came back to stop ${r.again}: every stop was visited`; break; }
    if (!r.stop) {
      left += 1;
      if (left >= 2) { ended = 'focus left the page and did not come back'; break; }
      stops.push({ leaves_the_page: true });
      continue;
    }
    left = 0; real += 1;
    stops.push(r.stop);
    open = r.stop;
  }
  const end = await page.evaluate('window.__uxq.walkEnd()');
  close(end.last);
  while (stops.length && stops[stops.length - 1].leaves_the_page) stops.pop();
  const visited = stops.filter((s) => s.n);
  const backwards = [];
  for (let i = 1; i < stops.length; i += 1) {
    const a = stops[i - 1]; const b = stops[i];
    if (!a.n || !b.n || a.not_drawn || b.not_drawn) continue;
    // Moving up into a column further right is how columns read; moving up in place, or to the left, is not.
    const above = b.at.y + b.at.height <= a.at.y && b.at.x < a.at.x + a.at.width;
    const sameRow = b.at.y < a.at.y + a.at.height && a.at.y < b.at.y + b.at.height;
    if (above || (sameRow && b.at.x + b.at.width <= a.at.x)) backwards.push(`stop ${a.n} ${a.element} -> stop ${b.n} ${b.element} (${above ? 'back up' : 'back left'})`);
  }
  const label = (s) => `stop ${s.n} ${s.element}`;
  return {
    how_to_read: `Tab was pressed from where the step left focus, until focus came back to a stop already visited (at most ${MAX_STOPS} stops). "focus_shown_by" is the strongest visible difference between the element with focus and without it; "none" means nothing a sighted person could see changed. Positions are in page pixels from the top left.`,
    ...start, ended,
    summary: {
      stops: visited.length,
      nothing_shows_focus: examples(visited.filter((s) => s.focus_shown_by && s.focus_shown_by.kind === 'none').map(label)),
      focus_on_something_not_drawn: examples(visited.filter((s) => s.not_drawn).map(label)),
      focus_covered_by_something_else: examples(visited.filter((s) => s.covered).map(label)),
      stops_without_a_name: examples(visited.filter((s) => s.no_name).map(label)),
      order_goes_backwards: examples(backwards),
      never_reached: end.never_reached,
      looks_clickable_but_is_not_a_control: end.looks_clickable_but_is_not_a_control,
      probably_reached_with_arrow_keys: end.probably_reached_with_arrow_keys,
      dialog_open: end.dialog_open,
      ...(end.dialog_open ? { stops_outside_the_open_dialog: examples(visited.filter((s) => s.outside_open_dialog).map(label)) } : {}),
      page_changed_while_tabbing: end.page_changed_while_tabbing
    },
    stops
  };
}

async function probeStates(page, outDir, name, seen) {
  const found = await page.evaluate(`window.__uxq.controls(${JSON.stringify([...seen])}, ${MAX_CONTROLS})`);
  if (!found.controls.length && !found.disabled.length) return null;
  await page.send('DOM.getDocument', { depth: 0 });
  const shoot = async (clip, file) => {
    const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    fs.mkdirSync(path.join(outDir, 'states'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'states', file), Buffer.from(shot.data, 'base64'));
    return `states/${file}`;
  };
  const out = {
    how_to_read: 'Each control is shown at rest, then with the styles the page applies when it is hovered, focused from the keyboard and pressed. The browser was told to apply each state, so nothing was clicked; an effect made by script (a tooltip, a menu opening) does not show here. "changes" lists the style properties that differ from rest; "no_change_on" lists the states that look exactly like rest. A kind of control already shown at an earlier step of the journey is not repeated.',
    controls: [], disabled: []
  };
  for (const c of found.controls) {
    seen.add(c.kind);
    const id = `c${seen.size}`;
    const handle = await page.send('Runtime.evaluate', { expression: `window.__uxq.pick(${c.i})` });
    const { nodeId } = await page.send('DOM.requestNode', { objectId: handle.result.objectId });
    const where = await page.evaluate(`window.__uxq.frame(${c.i})`);
    await sleep(60);
    await page.evaluate(`window.__uxq.rest(${c.i})`);
    const entry = { id, element: c.element, pictures: { rest: await shoot(where.clip, `${name}.${id}.rest.png`) }, changes: {}, no_change_on: [] };
    try {
      for (const [state, classes] of [['hover', ['hover']], ['focus', ['focus', 'focus-visible']], ['pressed', ['hover', 'active']]]) {
        await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: classes });
        const changed = await page.evaluate(`window.__uxq.changes(${c.i})`);
        entry.pictures[state] = await shoot(where.clip, `${name}.${id}.${state}.png`);
        if (changed.length) entry.changes[state] = changed; else entry.no_change_on.push(state);
      }
    } finally {
      await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }).catch(() => {});
    }
    await page.evaluate(`window.__uxq.changes(${c.i})`);
    out.controls.push(entry);
  }
  for (const c of found.disabled) {
    seen.add(c.kind);
    const id = `c${seen.size}`;
    const where = await page.evaluate(`window.__uxq.frame(${c.i})`);
    await sleep(60);
    out.disabled.push({ id, element: c.element, picture: await shoot(where.clip, `${name}.${id}.disabled.png`), cursor: where.cursor, opacity: where.opacity });
  }
  return out;
}

async function probeMotion(page, settled) {
  const withMotion = await page.evaluate('window.__uxq.motion()');
  const shifts = await page.evaluate('window.__uxq.shifts()');
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await sleep(120);
  const reduced = await page.evaluate('window.__uxq.motion()');
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await sleep(60);
  const count = (m) => m.transitions.filter((t) => t.moves).reduce((n, t) => n + t.elements, 0) + m.animations.reduce((n, a) => n + a.elements, 0);
  return {
    how_to_read: 'What the page declares in its styles, read with motion on: each row is one combination of properties, duration and easing, with how many elements on this screen carry it. "moves" marks motion that can change position or size (a fade or a colour change does not). "with_reduced_motion" is the same reading with the reduced-motion preference set: movement that is still listed there ignores the preference. Motion a script runs frame by frame shows only under "running_now", and only while it runs.',
    ...(settled ? { still_changing_for_ms: settled.kept_changing_ms, ...(settled.settled ? {} : { never_stopped_changing: true }) } : {}),
    layout_shift: shifts,
    transitions: withMotion.transitions, animations: withMotion.animations, running_now: withMotion.running_now,
    with_reduced_motion: {
      elements_that_can_still_move: count(reduced), elements_that_can_move_normally: count(withMotion),
      transitions_that_move: reduced.transitions.filter((t) => t.moves), animations: reduced.animations, running_now: reduced.running_now
    }
  };
}

// Runs a step's actions, taking pictures while its last click, key, hover or selection plays out.
async function runWithFrames(page, list, ctx) {
  const acts = flatten(list, ctx.plan);
  let at = -1;
  acts.forEach((a, i) => { if (MOVERS.some((k) => a[k] !== undefined)) at = i; });
  await runActions(page, acts.slice(0, at), ctx);
  const mover = acts[at];
  const shots = [];
  const grab = async (ms) => {
    try { shots.push({ at_ms: ms, data: (await page.send('Page.captureScreenshot', { format: 'png' })).data }); } catch (_) { /* between two documents */ }
  };
  try {
    if (mover.click || mover.hover) await page.locate(mover.click || mover.hover);
    await sleep(80);
    await grab(null);
    const t0 = Date.now();
    if (mover.click) await page.clickNow(mover.click);
    else if (mover.hover) await page.hover(mover.hover);
    else if (mover.select) await page.select(mover.select[0], fromEnv(mover.select[1]));
    else await page.press(mover.press, mover.times || 1, Boolean(mover.shift));
    while (Date.now() - t0 < FRAME_WINDOW_MS && shots.length < 24) await grab(Date.now() - t0);
    if (mover.click) { await sleep(50); await page.loaded(); }
  } catch (e) {
    if (!e.action) e.action = describe(mover);
    throw e;
  }
  await runActions(page, acts.slice(at + 1), ctx);
  const what = mover.click ? `a click on ${mover.click}` : mover.hover ? `the pointer moving over ${mover.hover}` : mover.select ? `choosing an option in ${mover.select[0]}` : `pressing ${mover.shift ? 'Shift+' : ''}${mover.press}${mover.times > 1 ? ` ${mover.times} times` : ''}`;
  return { shots, after: what, grab };
}

function writeFrames(outDir, name, filmed) {
  // Shots that look exactly like the one before add nothing: keep the first of each run.
  const distinct = filmed.shots.filter((s, i) => i === 0 || s.data !== filmed.shots[i - 1].data);
  const middle = distinct.slice(1, -1);
  const kept = middle.length <= MAX_FRAMES ? middle : Array.from({ length: MAX_FRAMES }, (_, i) => middle[Math.round((i * (middle.length - 1)) / (MAX_FRAMES - 1))]);
  const strip = distinct.length > 1 ? [distinct[0], ...kept, distinct[distinct.length - 1]] : distinct;
  fs.mkdirSync(path.join(outDir, 'frames'), { recursive: true });
  const frames = strip.map((s, i) => {
    const file = `${name}.${String(i).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(outDir, 'frames', file), Buffer.from(s.data, 'base64'));
    return { file: `frames/${file}`, when: s.at_ms === null ? 'before' : s.at_ms === 'settled' ? 'after the screen settled' : `about ${s.at_ms} ms after` };
  });
  const changing = distinct.filter((s) => typeof s.at_ms === 'number');
  let seen;
  if (distinct.length === 1) seen = 'Nothing on screen changed.';
  else if (changing.length <= 1) seen = 'The screen changed in one go: no movement in between was seen.';
  else seen = `The screen was seen in ${changing.length} different states over about ${changing[changing.length - 1].at_ms} ms.`;
  writeJson(path.join(outDir, 'frames', `${name}.json`), {
    how_to_read: `Pictures of the visible part of the screen taken while the action played out, for up to ${FRAME_WINDOW_MS} ms, then once more when the screen had settled. The pointer stays where it clicked, so a control under it shows its hovered look. Pictures identical to the one before are left out, and at most ${MAX_FRAMES + 2} are kept. Times are approximate: taking a picture takes a few tens of milliseconds, so a very short movement can fall between two pictures.`,
    after: filmed.after, seen, frames
  });
}

async function probePass(page, ctx, o) {
  const { unit, unitPlan, viewport, outDir, expected, kinds, current, summary } = o;
  const seen = new Set();
  for (const kind of PROBES) fs.rmSync(path.join(outDir, kind), { recursive: true, force: true });
  const measuredAt = { size: viewport.id, viewport: { width: viewport.width, height: viewport.height }, motion: 'on' };
  let steps = 0;
  await runActions(page, unitPlan.start || [], ctx);
  for (const step of unit.steps) {
    current.step = step.id;
    const wanted = expected.some((x) => x.step === step.id && x.size === viewport.id);
    let filmed = null;
    if (wanted && kinds.includes('frames') && (unitPlan.motion_steps || []).includes(step.id)) filmed = await runWithFrames(page, unitPlan.steps[step.id], ctx);
    else await runActions(page, unitPlan.steps[step.id], ctx);
    if (!wanted) continue;
    const name = `${step.id}.${viewport.id}`;
    // One probe that cannot be read is noted and the rest go on; a step that cannot be reached ends the pass.
    const attempt = async (probe, fn) => {
      try { return await fn(); } catch (e) { summary.probe_notes.push({ unit: unit.id, size: viewport.id, step: step.id, probe, error: e.message }); return null; }
    };
    await page.evaluate(`window.__uxq ? true : ${o.probesSource}`);
    const settled = kinds.includes('motion') ? await attempt('motion', () => page.evaluate('window.__uxq.settle()')) : null;
    await page.settle(o.settleMs);
    if (!unitPlan.keep_not_product) await setAsideNotProduct(page, o.notProduct);
    if (filmed) { await filmed.grab('settled'); await attempt('frames', () => writeFrames(outDir, name, filmed)); }
    if (kinds.includes('motion')) {
      const motion = await attempt('motion', () => probeMotion(page, settled));
      if (motion) writeJson(path.join(outDir, 'motion', `${name}.json`), { measured_at: measuredAt, ...motion });
    }
    if (kinds.includes('states')) {
      const states = await attempt('states', () => probeStates(page, outDir, name, seen));
      if (states) writeJson(path.join(outDir, 'states', `${name}.json`), { measured_at: measuredAt, ...states });
    }
    if (kinds.includes('keyboard')) {
      const keyboard = await attempt('keyboard', () => walkKeyboard(page));
      if (keyboard) writeJson(path.join(outDir, 'keyboard', `${name}.json`), { measured_at: measuredAt, ...keyboard });
    }
    steps += 1;
  }
  summary.probes.push({ unit: unit.id, size: viewport.id, steps, kinds });
}

// plan.clock = { at: ISO instant, since_file: path (relative to the review home) holding the server's start epoch in ms }
function readClock(plan, home) {
  if (!plan.clock) return null;
  const at = Date.parse(plan.clock.at);
  if (Number.isNaN(at)) fail('clock.at must be an ISO instant');
  let since = Date.now();
  if (plan.clock.since_file) {
    const file = path.resolve(home, plan.clock.since_file);
    if (!fs.existsSync(file)) fail(`clock.since_file not found: ${file} (start the application with the same clock first)`);
    since = Number(fs.readFileSync(file, 'utf8').replace(/\u001b\[[0-9;]*m/g, '').replace(/[^0-9]/g, ''));
    if (!Number.isFinite(since)) fail(`clock.since_file must hold an epoch in ms: ${file}`);
  }
  return { offset: at - since };
}
function clockShim(clock) {
  return `(() => { const R = Date, off = ${clock.offset};
    function D(...a) { if (!new.target) return new R(R.now() + off).toString(); return a.length ? new R(...a) : new R(R.now() + off); }
    D.prototype = R.prototype; D.now = () => R.now() + off; D.UTC = R.UTC; D.parse = R.parse;
    Object.defineProperty(D, 'name', { value: 'Date' }); window.Date = D; })();`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rubric = uxq.loadRubric(args.config);
  const cfg = uxq.loadConfig(args.config, rubric);
  const run = uxq.loadRun(args.run);
  const plan = loadPlan(path.resolve(typeof args.plan === 'string' ? args.plan : path.join(cfg.home, 'capture.json')));
  const base = new URL(plan.base_url);
  if (!isLocalHost(base.hostname) && !args['allow-remote']) fail(`${base.hostname} is not a local address. Capture signs in and presses things, so it runs against a local or test instance; pass --allow-remote only for a test instance you own.`);
  const browserPath = findBrowser(typeof args.browser === 'string' ? args.browser : null);
  if (!browserPath) fail('no Chrome, Edge or Chromium found; pass --browser <path> or set UXQ_BROWSER');
  const factsSource = fs.readFileSync(path.join(__dirname, 'page-facts.js'), 'utf8');
  const plantSource = fs.readFileSync(path.join(__dirname, 'plant-defects.js'), 'utf8');
  const probesSource = fs.readFileSync(path.join(__dirname, 'page-probes.js'), 'utf8').trim().replace(/;\s*$/, '');
  const settleMs = plan.settle_ms !== undefined ? Number(plan.settle_ms) : 400;
  const clock = readClock(plan, cfg.home);
  const timeoutMs = plan.timeout_ms !== undefined ? Number(plan.timeout_ms) : 8000;

  const summary = { browser: path.basename(browserPath), captured: [], failures: [], skipped: [], dialogs: [], planted: [], hidden: [], probes: [], probe_notes: [] };
  const todo = [];
  for (const unit of cfg.units.filter((u) => typeof args.unit !== 'string' || u.id === args.unit)) {
    const outDir = cfg.evidenceDir(run, unit);
    const expected = uxq.expectedScreens(cfg, unit);
    if (unit.control) {
      if (!args.controls && !args['recapture-controls']) { summary.skipped.push({ unit: unit.id, why: 'control unit: pass --controls to capture it (once)' }); continue; }
      const complete = expected.every((x) => fs.existsSync(path.join(outDir, 'screens', `${x.step}.${x.size}.png`)));
      // The control screens are the fixed yardstick: capturing them again would move it.
      if (complete && !args['recapture-controls']) { summary.skipped.push({ unit: unit.id, why: 'control unit already captured; it must stay the same from run to run' }); continue; }
    }
    const unitPlan = (plan.units || {})[unit.id];
    if (!unitPlan) { summary.failures.push({ unit: unit.id, error: 'the capture plan has no entry for this unit' }); continue; }
    const missing = unit.steps.filter((s) => !Array.isArray((unitPlan.steps || {})[s.id])).map((s) => s.id);
    if (missing.length) { summary.failures.push({ unit: unit.id, error: `the capture plan has no actions for step(s): ${missing.join(', ')} (use [] for a step that needs none)` }); continue; }
    const sizes = cfg.viewports.filter((v) => expected.some((x) => x.size === v.id));
    for (const viewport of sizes) todo.push({ unit, unitPlan, viewport, outDir, expected });
    // The probe pass: once per journey, after its screenshots, at its first size without touch.
    const kinds = probesFor(plan, unitPlan);
    if (kinds.length && sizes.length) todo.push({ unit, unitPlan, viewport: sizes.find((v) => !v.touch) || sizes[0], outDir, expected, kinds });
    else for (const kind of PROBES) fs.rmSync(path.join(outDir, kind), { recursive: true, force: true }); // nothing stale stays beside new screens
  }

  if (todo.length) {
    const browser = await launch(browserPath, Boolean(args.headed));
    const cdp = createCdp(await connectWebSocket(browser.wsUrl));
    const userAgent = (await cdp.send('Browser.getVersion')).userAgent.replace('HeadlessChrome', 'Chrome');
    let current = null;
    // A native alert or confirm box cannot be photographed and would block the page: accept it and say so.
    cdp.on((m) => {
      if (m.method !== 'Page.javascriptDialogOpening' || !current) return;
      summary.dialogs.push({ unit: current.unit, size: current.size, step: current.step, type: m.params.type, message: m.params.message });
      cdp.send('Page.handleJavaScriptDialog', { accept: plan.dialogs !== 'dismiss' }, m.sessionId).catch(() => {});
    });
    try {
      for (const { unit, unitPlan, viewport, outDir, expected, kinds } of todo) {
        if (kinds && summary.failures.some((f) => f.unit === unit.id)) { summary.probe_notes.push({ unit: unit.id, note: 'not probed: capturing this journey failed' }); continue; }
        current = { unit: unit.id, size: viewport.id, step: null };
        if (plan.reset_command) execSync(plan.reset_command, { cwd: cfg.home, stdio: 'ignore' });
        const { browserContextId } = await cdp.send('Target.createBrowserContext', { disposeOnDetach: true });
        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
        const page = createPage(cdp, sessionId, timeoutMs);
        const ctx = { plan, base, allowRemote: Boolean(args['allow-remote']), plantSource, planted: [] };
        try {
          await page.send('Page.enable', {});
          await page.send('Runtime.enable', {});
          // A pinned clock: the page's Date runs from plan.clock.at, counted from when the application's
          // server started (plan.clock.since_file holds that epoch in ms), so every capture sees the same
          // day and hour as a server started with the same instant.
          if (clock) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: clockShim(clock) });
          if (kinds) {
            await page.send('DOM.enable', {});
            await page.send('CSS.enable', {});
            await page.send('Page.addScriptToEvaluateOnNewDocument', { source: SHIFT_OBSERVER });
            await page.send('Page.addScriptToEvaluateOnNewDocument', { source: probesSource });
          }
          await page.send('Emulation.setUserAgentOverride', { userAgent });
          await page.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: Boolean(viewport.touch) });
          if (viewport.touch) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
          await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
          if (kinds) {
            await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
            await probePass(page, ctx, { unit, unitPlan, viewport, outDir, expected, kinds, current, summary, probesSource, settleMs, notProduct: plan.not_product || [] });
            continue;
          }
          if (plan.reduce_motion !== false) await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
          await runActions(page, unitPlan.start || [], ctx);
          for (const step of unit.steps) {
            current.step = step.id;
            await runActions(page, unitPlan.steps[step.id], ctx);
            if (!expected.some((x) => x.step === step.id && x.size === viewport.id)) continue;
            await page.settle(settleMs);
            // A journey whose subject is the demo itself (a prospect trying it) keeps what is otherwise not the product.
            for (const h of unitPlan.keep_not_product ? [] : await setAsideNotProduct(page, plan.not_product || [])) summary.hidden.push({ unit: unit.id, step: step.id, size: viewport.id, ...h });
            summary.captured.push({ unit: unit.id, ...(await captureStep(page, viewport, outDir, step.id, factsSource, (unitPlan.window_steps || []).includes(step.id))) });
          }
          for (const p of ctx.planted) summary.planted.push({ unit: unit.id, size: viewport.id, ...p });
        } catch (e) {
          // The screenshots are already saved: a probe pass that cannot follow the plan is noted, not a failed capture.
          if (kinds) { summary.probe_notes.push({ unit: unit.id, size: viewport.id, step: current.step || 'start', action: e.action || null, error: e.message, note: 'the probe pass stopped here; later steps have no keyboard, states, motion or frames evidence' }); continue; }
          // Keep a picture of where it stopped, outside the evidence, so the plan can be put right.
          let debug = null;
          try {
            const shot = await page.send('Page.captureScreenshot', { format: 'png' });
            debug = path.join(run.dir, 'capture-debug', `${unit.id}.${viewport.id}.${current.step || 'start'}.png`);
            fs.mkdirSync(path.dirname(debug), { recursive: true });
            fs.writeFileSync(debug, Buffer.from(shot.data, 'base64'));
          } catch (_) { debug = null; }
          summary.failures.push({ unit: unit.id, size: viewport.id, step: current.step || 'start', action: e.action || null, error: e.message, stopped_at: debug });
        } finally {
          await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
          await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
        }
      }
    } finally {
      await shutdown(browser, cdp);
    }
  }
  // Keep what was hidden, and where the probe pass fell short, with the run, so the scorecard can say
  // so. A pass captured again replaces its own earlier notes; notes for passes not touched this time stay.
  if (todo.length) {
    const notesFile = path.join(run.dir, 'capture-notes.json');
    const redone = new Set(todo.filter((t) => !t.kinds).map((t) => `${t.unit.id}.${t.viewport.id}`));
    const probed = new Set(todo.filter((t) => t.kinds).map((t) => t.unit.id));
    const before = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : {};
    const hidden = [...(before.hidden || []).filter((h) => !redone.has(`${h.unit}.${h.size}`)), ...summary.hidden];
    const probeNotes = [...(before.probe_notes || []).filter((n) => !probed.has(n.unit)), ...summary.probe_notes];
    if (hidden.length || probeNotes.length || fs.existsSync(notesFile)) fs.writeFileSync(notesFile, `${JSON.stringify({ hidden, ...(probeNotes.length ? { probe_notes: probeNotes } : {}) }, null, 2)}\n`);
  }
  const cut = summary.captured.filter((c) => c.cut_off);
  if (cut.length) summary.note = `${cut.length} screenshot(s) were cut at ${MAX_HEIGHT} px of height.`;
  console.log(JSON.stringify({ ...summary, captured: summary.captured.length, files: summary.captured.map((c) => `${c.unit}/screens/${c.step}.${c.size}.png`) }, null, 2));
  process.exit(summary.failures.length ? 2 : 0);
}

if (require.main === module) main().catch((e) => fail(e.stack || e.message));

module.exports = { findBrowser, fromEnv, isLocalHost };
