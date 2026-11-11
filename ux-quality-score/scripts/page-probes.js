/*
 * page-probes.js: what a still picture cannot show. Installed in the page by capture.cjs during the
 * probe pass (a separate replay of the journey, so the screenshots of the clean pass are not touched).
 * It only reads the page, with two exceptions that the keyboard walk needs: it lets focus move as the
 * Tab key moves it, and at the end it takes focus off the last stop and puts it back where it began.
 *
 *   window.__uxq.walkStart() / walkStep() / walkEnd()   the keyboard walk, one call per Tab press
 *   window.__uxq.controls(seen, max) / pick(i) / frame(i) / rest(i) / changes(i)   control states
 *   window.__uxq.motion()                                declared transitions and animations
 *   window.__uxq.settle(quiet, cap) / shifts()           time to stop changing, layout shifts
 *
 * The values are measurements for a reviewer to weigh, not verdicts. Nothing typed into a field is
 * ever read: names come from labels and captions only.
 */
(() => {
  if (window.__uxq) return true;
  const MAX_EXAMPLES = 8;
  const INTERACTIVE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=checkbox], [role=radio], [role=switch], [role=combobox], [role=slider], [tabindex]:not([tabindex="-1"]), [contenteditable=""], [contenteditable=true]';
  const COMPOSITE = '[role=tablist], [role=menu], [role=menubar], [role=radiogroup], [role=listbox], [role=toolbar], [role=grid], [role=tree]';
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const caption = (el) => (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type) ? el.value : '');
  // The name a person using a screen reader would most likely hear. Never the value typed into a field.
  const nameOf = (el) => {
    const by = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).filter(Boolean).map((n) => n.innerText || n.textContent).join(' ');
    const label = el.labels && el.labels.length ? [...el.labels].map((l) => l.innerText).join(' ') : '';
    const field = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
    const img = el.querySelector ? el.querySelector('img[alt], svg[aria-label], svg title') : null;
    const imgName = img ? (img.getAttribute('alt') || img.getAttribute('aria-label') || img.textContent) : '';
    return clean(el.getAttribute('aria-label') || by || label || (field ? '' : el.innerText) || caption(el) || imgName || el.getAttribute('title') || el.getAttribute('placeholder') || '');
  };
  const describe = (el) => {
    if (!el || !el.tagName) return 'something that is not an element';
    const name = nameOf(el);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${name ? ` "${name}"` : ''}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.display === 'none' || ps.visibility === 'hidden' || Number(ps.opacity) === 0) return false;
    }
    return true;
  };
  const cut = (list) => ({ count: list.length, examples: list.slice(0, MAX_EXAMPLES) });
  const round = (n) => Math.round(n);
  const disabled = (el) => el.disabled === true || el.getAttribute('aria-disabled') === 'true';
  const openDialog = () => [...document.querySelectorAll('dialog[open], [aria-modal=true]')].filter(visible).pop() || null;

  // ---------------------------------------------------------------- colour
  const parseColor = (str) => {
    const m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(/[,/ ]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = ({ r, g, b }) => {
    const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const backgroundOf = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let colour = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) colour = blend(layer, colour);
    return colour;
  };
  const contrast = (a, b) => { const x = luminance(a); const y = luminance(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };

  // ---------------------------------------------------------------- how an element looks
  const GROUPS = {
    outline: ['outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset'],
    shadow: ['boxShadow'],
    border: ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
    background: ['backgroundColor', 'backgroundImage'],
    text: ['color', 'textDecorationLine', 'fontWeight'],
    other: ['opacity', 'transform', 'filter']
  };
  const PROPS = Object.values(GROUPS).flat();
  const css = (prop) => prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const snap = (el, pseudo) => {
    const cs = getComputedStyle(el, pseudo || null);
    const o = {};
    for (const p of PROPS) o[p] = cs[p];
    // An outline with no style is not drawn, whatever width and colour it carries.
    if (o.outlineStyle === 'none' || parseFloat(o.outlineWidth) === 0) { o.outlineStyle = 'none'; o.outlineWidth = '0px'; o.outlineColor = ''; o.outlineOffset = ''; }
    return o;
  };
  // The element, what it draws before and after itself, and the things around it that often carry
  // its state instead: its first child, the element after it, its container.
  const look = (el) => ({
    itself: snap(el), 'its ::before': snap(el, '::before'), 'its ::after': snap(el, '::after'),
    'its first child': el.firstElementChild ? snap(el.firstElementChild) : null,
    'the element after it': el.nextElementSibling ? snap(el.nextElementSibling) : null,
    'its container': el.parentElement ? snap(el.parentElement) : null
  });
  const differences = (a, b) => {
    const out = [];
    for (const place of Object.keys(a)) {
      if (!a[place] || !b[place]) continue;
      for (const [kind, props] of Object.entries(GROUPS)) {
        const changed = props.filter((p) => a[place][p] !== b[place][p]);
        if (changed.length) out.push({ place, kind, properties: changed.map(css) });
      }
    }
    return out;
  };
  const ORDER = ['outline', 'shadow', 'border', 'background', 'text', 'other'];
  // What tells a sighted person that this element has focus: the strongest difference between the
  // element with focus and the same element without it.
  const indicator = (el, focused, atRest) => {
    const diffs = differences(focused, atRest).sort((x, y) => ORDER.indexOf(x.kind) - ORDER.indexOf(y.kind) || (x.place === 'itself' ? -1 : 0) - (y.place === 'itself' ? -1 : 0));
    if (!diffs.length) return { kind: 'none' };
    const best = diffs[0];
    const out = { kind: best.kind, on: best.place };
    if (best.kind === 'outline') {
      const f = focused[best.place];
      out.width_px = parseFloat(f.outlineWidth) || 0;
      const ring = parseColor(f.outlineColor);
      const behind = el.parentElement ? backgroundOf(el.parentElement) : null;
      if (ring && behind) out.contrast_with_surroundings = contrast(blend(ring, behind), behind);
    }
    if (diffs.length > 1) out.also = [...new Set(diffs.slice(1).map((d) => d.kind))];
    return out;
  };
  // Wait for a state change to finish drawing: transitions and animations that end, never ones that loop.
  const calm = async (els, cap = 450) => {
    const running = els.filter(Boolean).flatMap((e) => (e.getAnimations ? e.getAnimations({ subtree: true }) : [])).filter((a) => {
      try { return a.playState === 'running' && Number.isFinite(a.effect.getComputedTiming().endTime); } catch (_) { return false; }
    });
    if (!running.length) return;
    await Promise.race([Promise.allSettled(running.map((a) => a.finished)), new Promise((r) => setTimeout(r, cap))]);
  };

  // ---------------------------------------------------------------- keyboard walk
  let W = null;
  const active = () => {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a && a !== document.body && a !== document.documentElement ? a : null;
  };
  const textMark = () => { const t = document.body ? document.body.innerText : ''; let h = 0; for (let i = 0; i < t.length; i += 1) h = (h * 31 + t.charCodeAt(i)) | 0; return `${t.length}:${h}`; };
  const covered = (el, r) => {
    const x = r.left + r.width / 2; const y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
    const top = document.elementFromPoint(x, y);
    if (!top || el.contains(top) || top.contains(el)) return false;
    if (el.labels && [...el.labels].some((l) => l.contains(top))) return false;
    return true;
  };
  const walkStart = () => {
    const from = active();
    W = { from, x: window.scrollX, y: window.scrollY, mark: textMark(), ids: new Map(), prev: null, prevLook: null };
    return { starts_from: from ? describe(from) : 'where the step left the page (nothing had focus)' };
  };
  const walkStep = async () => {
    const el = active();
    if (el && el === W.prev) return { same: true, frame: el.tagName === 'IFRAME', element: describe(el) };
    await calm([el, W.prev]);
    let previous = null;
    if (W.prev) previous = W.prev.isConnected ? indicator(W.prev, W.prevLook, look(W.prev)) : { kind: 'unknown', why: 'it was removed from the page when focus left it' };
    W.prev = null;
    if (!el) return { previous, stop: null };
    const known = W.ids.get(el);
    W.prev = el; W.prevLook = look(el);
    if (known !== undefined) return { previous, again: known };
    const n = W.ids.size + 1;
    W.ids.set(el, n);
    const r = el.getBoundingClientRect();
    const doc = document.documentElement;
    const drawn = visible(el) && r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 && r.left + window.scrollX < Math.max(doc.scrollWidth, doc.clientWidth);
    const dialog = openDialog();
    const name = nameOf(el);
    return {
      previous,
      stop: {
        n, element: describe(el), ...(name ? {} : { no_name: true }),
        at: { x: round(r.left + window.scrollX), y: round(r.top + window.scrollY), width: round(r.width), height: round(r.height) },
        ...(drawn ? {} : { not_drawn: true }), ...(drawn && covered(el, r) ? { covered: true } : {}),
        ...(dialog && !dialog.contains(el) ? { outside_open_dialog: true } : {}), ...(el.tagName === 'IFRAME' ? { embedded_frame: true } : {})
      }
    };
  };
  const walkEnd = async () => {
    let last = null;
    if (W.prev) {
      const el = W.prev;
      el.blur();
      await calm([el]);
      last = el.isConnected ? indicator(el, W.prevLook, look(el)) : { kind: 'unknown', why: 'it was removed from the page when focus left it' };
    }
    const dialog = openDialog();
    const reached = [...W.ids.keys()];
    const near = (el) => reached.some((r) => r.contains(el) || el.contains(r));
    const missed = [...(dialog || document).querySelectorAll(INTERACTIVE)].filter((el) => visible(el) && !disabled(el) && !W.ids.has(el) && !near(el));
    // Tabs, menus and groups of radio buttons take one Tab stop and move inside with the arrow keys.
    const byArrows = (el) => el.getAttribute('tabindex') === '-1' || Boolean(el.closest(COMPOSITE)) || (el.type === 'radio' && el.name && reached.some((r) => r.type === 'radio' && r.name === el.name));
    // Something that asks to be clicked (a click handler in the markup, or a pointer cursor of its own)
    // without being a control: a keyboard cannot get to it at all.
    const pointer = (el) => getComputedStyle(el).cursor === 'pointer';
    const posing = [...(dialog || document).querySelectorAll('body *')].filter((el) => !el.closest(INTERACTIVE) && !el.querySelector(INTERACTIVE) && el.tagName !== 'LABEL' && !el.closest('label')
      && (el.hasAttribute('onclick') || (pointer(el) && !(el.parentElement && pointer(el.parentElement)))) && visible(el));
    const result = {
      last,
      never_reached: cut(missed.filter((el) => !byArrows(el)).map(describe)),
      looks_clickable_but_is_not_a_control: cut(posing.map(describe)),
      probably_reached_with_arrow_keys: missed.filter(byArrows).length,
      dialog_open: Boolean(dialog),
      page_changed_while_tabbing: textMark() !== W.mark
    };
    if (W.from && W.from.isConnected) W.from.focus({ preventScroll: true });
    window.scrollTo(W.x, W.y);
    W = null;
    return result;
  };

  // ---------------------------------------------------------------- control states
  let picked = [];
  const kindOf = (el) => {
    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? `[${el.type}]` : '';
    const role = el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : '';
    return `${tag}${type}${role}${[...el.classList].sort().map((c) => `.${c}`).join('')}`.slice(0, 200);
  };
  const rank = (el) => {
    const tag = el.tagName; const role = el.getAttribute('role');
    if (tag === 'BUTTON' || role === 'button' || caption(el)) return 0;
    if (['checkbox', 'radio'].includes(el.type) || ['checkbox', 'radio', 'switch'].includes(role)) return 2;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || role === 'combobox') return 1;
    if (['tab', 'menuitem', 'option'].includes(role) || tag === 'SUMMARY') return 3;
    if (tag === 'A') return 4;
    return 5;
  };
  // A checkbox drawn by its label: the input itself is invisible, so the picture is taken of the label.
  const boxOf = (el) => {
    if (visible(el) && el.getBoundingClientRect().width >= 8 && el.getBoundingClientRect().height >= 8) return el;
    const label = el.labels && [...el.labels].find(visible);
    return label || null;
  };
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; };
  // Up to `max` kinds of control on this screen that the journey has not shown yet, buttons first, and
  // up to two kinds of disabled control. "Kind" is the tag, type, role and classes: one per component.
  const controls = (seen, max) => {
    const taken = new Set(seen);
    const groups = new Map();
    const off = new Map();
    [...document.querySelectorAll(INTERACTIVE)].forEach((el, order) => {
      const box = boxOf(el);
      if (!box) return;
      const kind = kindOf(el);
      if (disabled(el)) { if (!taken.has(`disabled:${kind}`) && !off.has(kind)) off.set(kind, { el, box, kind: `disabled:${kind}` }); return; }
      if (taken.has(kind)) return;
      const g = groups.get(kind);
      if (!g) groups.set(kind, { el, box, kind, order, rank: rank(el) });
      else if (!inView(g.box) && inView(box)) { g.el = el; g.box = box; }
    });
    const chosen = [...groups.values()].sort((a, b) => a.rank - b.rank || a.order - b.order).slice(0, max);
    picked = [...chosen, ...[...off.values()].slice(0, 2)];
    const row = (p, i) => ({ i, kind: p.kind, element: describe(p.el) });
    return { controls: chosen.map(row), disabled: picked.slice(chosen.length).map((p, k) => row(p, chosen.length + k)) };
  };
  const pick = (i) => picked[i].el;
  // Brings the control into view and says where to take its picture (document coordinates, with room
  // around it for an outline or a shadow).
  const frame = (i) => {
    const p = picked[i];
    p.box.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const r = p.box.getBoundingClientRect();
    const pad = 12;
    const x = Math.max(0, r.left + window.scrollX - pad); const y = Math.max(0, r.top + window.scrollY - pad);
    const cs = getComputedStyle(p.el);
    return { clip: { x: round(x), y: round(y), width: round(Math.min(r.width + pad * 2, 900)), height: round(Math.min(r.height + pad * 2, 400)) }, cursor: cs.cursor, opacity: Number(cs.opacity) };
  };
  const rest = async (i) => { await calm([picked[i].el, picked[i].box]); picked[i].rest = look(picked[i].el); return true; };
  const changes = async (i) => {
    await calm([picked[i].el, picked[i].box]);
    return differences(look(picked[i].el), picked[i].rest).map((d) => `${d.properties.join(', ')} on ${d.place}`);
  };

  // ---------------------------------------------------------------- motion
  const ms = (s) => Math.max(0, ...String(s).split(',').map((x) => { const v = parseFloat(x); return /ms\s*$/.test(x.trim()) ? v : v * 1000; }).filter(Number.isFinite));
  const LAYOUT = /\b(width|height|top|left|right|bottom|inset|margin|padding|font-size|line-height|border-width)\b/;
  const MOVES = /\b(all|transform|translate|scale|rotate|width|height|top|left|right|bottom|inset|margin|padding)\b/;
  const startsSlow = (easing) => String(easing).split(/,(?![^(]*\))/).some((e) => { const t = e.trim(); return t === 'ease-in' || /^cubic-bezier\(0\.42,\s*0,\s*1,\s*1\)$/.test(t); });
  const motion = () => {
    const transitions = new Map(); const animations = new Map();
    const add = (map, key, base, el) => {
      const g = map.get(key) || { ...base, elements: 0, on_controls: 0, examples: [] };
      g.elements += 1;
      if (el.matches(INTERACTIVE)) g.on_controls += 1;
      if (g.examples.length < 3) g.examples.push(describe(el));
      map.set(key, g);
    };
    for (const el of [...document.querySelectorAll('body *')].slice(0, 5000)) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const d = ms(cs.transitionDuration);
      if (d >= 20) add(transitions, `${cs.transitionProperty}|${d}|${cs.transitionTimingFunction}`, { properties: cs.transitionProperty, duration_ms: d, delay_ms: ms(cs.transitionDelay), easing: cs.transitionTimingFunction }, el);
      if (cs.animationName && cs.animationName !== 'none' && ms(cs.animationDuration) >= 20) add(animations, `${cs.animationName}|${cs.animationDuration}|${cs.animationIterationCount}`, { name: cs.animationName, duration_ms: ms(cs.animationDuration), repeats: /infinite/.test(cs.animationIterationCount) ? 'forever' : cs.animationIterationCount, easing: cs.animationTimingFunction }, el);
    }
    const flagged = (g, isTransition) => {
      const notes = [];
      if (isTransition) {
        if (/\ball\b/.test(g.properties)) notes.push('every property is animated (transition: all)');
        if (LAYOUT.test(g.properties)) notes.push('a layout property is animated');
        if (MOVES.test(g.properties)) g.moves = true;
        if (g.on_controls > 0 && g.duration_ms > 300) notes.push('longer than 300 ms on a control');
      } else {
        g.moves = true;
        if (g.repeats === 'forever') notes.push('runs forever');
      }
      if (startsSlow(g.easing)) notes.push('starts slowly (ease-in)');
      return notes.length ? { ...g, notes } : g;
    };
    const top = (map, isTransition) => [...map.values()].sort((a, b) => b.elements - a.elements).slice(0, 12).map((g) => flagged(g, isTransition));
    const running = document.getAnimations().filter((a) => a.playState === 'running').slice(0, 12).map((a) => {
      let timing = {}; let keys = [];
      try { timing = a.effect.getComputedTiming(); keys = [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)); } catch (_) { /* no effect to read */ }
      const target = a.effect && a.effect.target;
      return { what: a.animationName || (a.transitionProperty ? `transition of ${a.transitionProperty}` : 'an animation started by script'), on: target ? `${describe(target)}${a.effect.pseudoElement || ''}` : 'unknown', duration_ms: Number.isFinite(timing.duration) ? round(timing.duration) : null, repeats: timing.iterations === Infinity ? 'forever' : timing.iterations, properties: keys.map(css) };
    });
    return { transitions: top(transitions, true), animations: top(animations, false), running_now: running };
  };
  // How long the page keeps changing: until nothing in it has changed and no finite animation has run
  // for `quiet` ms. Counted from the call; the caller adds the time since the last thing it pressed.
  const settle = (quiet = 150, cap = 5000) => new Promise((done) => {
    const t0 = performance.now();
    let last = t0; let changes = 0;
    const seen = new MutationObserver(() => { last = performance.now(); changes += 1; });
    seen.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    const tick = () => {
      const now = performance.now();
      const moving = document.getAnimations().some((a) => { try { return a.playState === 'running' && Number.isFinite(a.effect.getComputedTiming().endTime); } catch (_) { return false; } });
      if (moving) last = now;
      if (now - last >= quiet || now - t0 >= cap) { seen.disconnect(); done({ kept_changing_ms: round(last - t0), settled: now - t0 < cap, changes }); } else setTimeout(tick, 30);
    };
    tick();
  });
  // Layout shifts the browser recorded since the last call (window.__uxqShifts is filled by a small
  // observer that capture.cjs installs before the page's own scripts run).
  const shifts = () => {
    const list = (window.__uxqShifts || []).splice(0);
    const sum = (xs) => Math.round(xs.reduce((n, s) => n + s.value, 0) * 1000) / 1000;
    const unexpected = list.filter((s) => !s.recent_input);
    const largest = unexpected.slice().sort((a, b) => b.value - a.value)[0];
    return {
      unexpected: { count: unexpected.length, total: sum(unexpected), ...(largest ? { largest: { value: Math.round(largest.value * 1000) / 1000, moved: largest.nodes.filter((n) => n && n.nodeType === 1 && n.isConnected).map(describe).slice(0, 3) } } : {}) },
      right_after_input: { count: list.length - unexpected.length, total: sum(list.filter((s) => s.recent_input)) }
    };
  };

  window.__uxq = { walkStart, walkStep, walkEnd, controls, pick, frame, rest, changes, motion, settle, shifts };
  return true;
})()
