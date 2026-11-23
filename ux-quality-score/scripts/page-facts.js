/*
 * page-facts.js: mechanical measurements of the page currently shown in a browser.
 *
 * Evaluate this file's text in the page (Playwright page.evaluate, a browser automation tool's
 * "run JavaScript" action, or the devtools console) after the screen has settled, once per step and
 * screen size, and save the returned object as facts/<step>.<size>.json. It reads the page and changes
 * nothing. The numbers are measurements for a reviewer to weigh, not verdicts: contrast behind images
 * or gradients is reported as unknown, and nothing here sees keyboard focus or behaviour over time
 * (capture.cjs reads those in its probe pass, with page-probes.js).
 *
 * Four of its readings are worked out from where things lie, not read off one element, and say so
 * where they can be wrong: what lies on what (layout.lies_on_something_else), how close small controls
 * are (targets), how many looks one kind of thing has (styles), and what the pictures are (pictures).
 * Each was tried on real pages and narrowed until it stopped reporting what was there on purpose.
 */
(() => {
  const MAX_EXAMPLES = 10;
  // The layout size, not window.innerWidth: a phone browser widens the window it reports when the page
  // overflows sideways, which would hide exactly the overflow this is here to measure.
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = document.documentElement.clientHeight || window.innerHeight;
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : '';
    // Never what someone typed into a field: that can be a password. Only a button's own caption.
    const caption = el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type) ? el.value : '';
    const text = clean(el.getAttribute('aria-label') || el.innerText || caption || el.getAttribute('placeholder') || el.getAttribute('title') || '');
    return `${el.tagName.toLowerCase()}${id}${text ? ` "${text}"` : ''}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    // Content of a collapsed <details> keeps its size but is not drawn (content-visibility: hidden).
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.display === 'none' || ps.visibility === 'hidden') return false;
    }
    return true;
  };
  // visible() asks whether an element is laid out and not hidden by its own style. Two more things decide
  // whether a person sees it: something above it at opacity 0 hides everything inside, and a container
  // that clips what runs past it cuts away whatever lies outside its box.
  const fadedRoots = new Map();
  const fadedRoot = (el) => {
    if (!el || el.nodeType !== 1) return null;
    if (fadedRoots.has(el)) return fadedRoots.get(el);
    const root = fadedRoot(el.parentElement) || (Number(getComputedStyle(el).opacity) === 0 ? el : null);
    fadedRoots.set(el, root);
    return root;
  };
  // Null when the element is painted, else the outermost thing that hides it and how.
  const hiddenBy = (el) => {
    const faded = fadedRoot(el);
    if (faded) return { root: faded, why: 'opacity 0' };
    if (getComputedStyle(el).visibility === 'visible') return null;
    let root = el;
    while (root.parentElement && getComputedStyle(root.parentElement).visibility !== 'visible') root = root.parentElement;
    return { root, why: 'visibility hidden' };
  };
  // The part of the window that what is inside an element can show in. A container clips its contents
  // only when it is in their containing chain: something positioned absolutely is clipped by the element
  // it is placed against, and something fixed by nothing.
  const NO_CLIP = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 };
  const NOTHING_SHOWS = { l: 0, t: 0, r: 0, b: 0 };
  const clips = new Map();
  const clipInside = (el) => {
    if (!el || el === document.documentElement || el === document.body) return NO_CLIP;
    if (clips.has(el)) return clips.get(el);
    const cs = getComputedStyle(el);
    let c = clipInside(cs.position === 'fixed' ? null : cs.position === 'absolute' ? el.offsetParent : el.parentElement);
    // Kept for a screen reader and cut out of sight on purpose.
    if ((cs.clip && cs.clip !== 'auto' && cs.position === 'absolute') || /inset\(\s*(50|100)%/.test(cs.clipPath || '')) c = NOTHING_SHOWS;
    else if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const r = el.getBoundingClientRect();
      const x = cs.overflowX !== 'visible'; const y = cs.overflowY !== 'visible';
      c = { l: x ? Math.max(c.l, r.left) : c.l, r: x ? Math.min(c.r, r.right) : c.r, t: y ? Math.max(c.t, r.top) : c.t, b: y ? Math.min(c.b, r.bottom) : c.b };
    }
    clips.set(el, c);
    return c;
  };
  const within = (r, c) => { const b = { l: Math.max(r.left, c.l), t: Math.max(r.top, c.t), r: Math.min(r.right, c.r), b: Math.min(r.bottom, c.b) }; return b.r > b.l && b.b > b.t ? b : null; };
  // A computed colour is rgb() or rgba() on most pages. Where the page mixes colours (color-mix) or names
  // them in another colour space, the browser reports color(srgb ...), oklab(...) and the like: those are
  // painted on one pixel and read back, so any colour the browser can draw is a colour that is measured.
  const painted = new Map();
  let ink = null;
  const paint = (str) => {
    if (painted.has(str)) return painted.get(str);
    let colour = null;
    try {
      if (!ink) { const c = document.createElement('canvas'); c.width = 1; c.height = 1; ink = c.getContext('2d', { willReadFrequently: true }); }
      // A string the canvas does not understand leaves the fill as it was: set it over two different fills.
      ink.fillStyle = '#000'; ink.fillStyle = str; const one = ink.fillStyle;
      ink.fillStyle = '#fff'; ink.fillStyle = str;
      if (one === ink.fillStyle) {
        ink.clearRect(0, 0, 1, 1); ink.fillRect(0, 0, 1, 1);
        const d = ink.getImageData(0, 0, 1, 1).data;
        colour = { r: d[0], g: d[1], b: d[2], a: Math.round((d[3] / 255) * 100) / 100 };
      }
    } catch (e) { colour = null; }
    painted.set(str, colour);
    return colour;
  };
  const parseColor = (str) => {
    const s = String(str || '').trim();
    const m = s.match(/^rgba?\(([^)]+)\)$/);
    if (!m) return s ? paint(s) : null;
    const parts = m[1].split(/[,/ ]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const luminance = ({ r, g, b }) => {
    const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  // The colour actually behind an element: walk up, stacking translucent layers, stop at the first image.
  const backgroundOf = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = parseColor(cs.backgroundColor);
      if (!c) return null; // a fill that cannot be read is an unknown background, not an absent one
      if (c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let colour = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) colour = blend(layer, colour);
    return colour;
  };

  // Layout: sideways overflow and what causes it.
  // A body scaled with CSS zoom reports its width in its own unscaled pixels: scale it back, or a page
  // zoomed to 85 % would read as wider than the window when nothing scrolls.
  const bodyZoom = document.body ? (parseFloat(getComputedStyle(document.body).zoom) || 1) : 1;
  const docWidth = Math.max(document.documentElement.scrollWidth, document.body ? Math.round(document.body.scrollWidth * bodyZoom) : 0);
  const overflowing = [];
  if (docWidth > vw + 1) {
    for (const el of document.querySelectorAll('body *')) {
      if (overflowing.length >= MAX_EXAMPLES) break;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width <= docWidth && !el.querySelector('*:not(br)')) overflowing.push({ element: describe(el), right_edge: Math.round(r.right) });
    }
  }

  // What stays in the window while the page scrolls: a bar fixed to an edge, a footer that sticks. The
  // picture of a step is the whole page, where such a bar is drawn once, at one place, and a panel that
  // scrolls is drawn at its full height, so its sticking footer appears at its end. Only this says it is
  // within reach the whole way down.
  const pinned = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (!visible(el) || pinned.some((p) => p.el.contains(el))) continue;
    const r = el.getBoundingClientRect();
    let edge = null;
    if (cs.position === 'sticky') {
      if (r.width < vw * 0.5) continue; // a sticking cell or column heading, not a bar
      edge = cs.top !== 'auto' ? 'top' : cs.bottom !== 'auto' ? 'bottom' : null;
    } else {
      if (r.width >= vw * 0.8 && r.height >= vh * 0.8) continue; // a layer over the whole window: see open_dialogs
      edge = r.top <= 1 && r.bottom < vh * 0.5 ? 'top' : r.bottom >= vh - 1 && r.top > vh * 0.5 ? 'bottom' : 'elsewhere';
    }
    if (edge) pinned.push({ el, element: describe(el), how: cs.position, edge, height: Math.round(r.height) });
  }
  const staysInWindow = pinned.map(({ el, ...rest }) => rest);

  // Targets: interactive elements and their size.
  const interactive = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=checkbox], [role=switch], [role=menuitem], [onclick], [tabindex]:not([tabindex="-1"])')].filter(visible);
  const under44 = [];
  const under24 = [];
  const sized = []; // every control that is not a link inside a sentence, with its box
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    const inlineLink = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
    if (inlineLink) continue; // links inside a sentence are exempt from target-size rules
    if (r.width < 4 || r.height < 4) continue; // cut down to a dot and kept for a screen reader: nobody presses it
    const item = { element: describe(el), width: Math.round(r.width), height: Math.round(r.height) };
    if (r.width < 24 || r.height < 24) under24.push(item);
    else if (r.width < 44 || r.height < 44) under44.push(item);
    if (sized.length < 1500) sized.push({ el, r, item });
  }
  // How close a small control is to the next one. A control under 24 px still passes when a circle 24 px
  // across, centred on it, touches no other control and no other small control's circle: that is the
  // room a near miss needs. Any control under 44 px with another less than 8 px away is listed too.
  const gapBetween = (a, b) => Math.hypot(Math.max(0, a.left - b.right, b.left - a.right), Math.max(0, a.top - b.bottom, b.top - a.bottom));
  const centreOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const small = (r) => r.width < 24 || r.height < 24;
  const noRoomAround = [];
  const closeTogether = [];
  for (const a of sized) {
    if (a.r.width >= 44 && a.r.height >= 44) continue;
    let nearest = null;
    let crowded = null;
    for (const b of sized) {
      if (b === a || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // A small control set inside a field belongs to that field: the cross that clears it, the eye that shows a password.
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(b.el.tagName) && a.r.left >= b.r.left && a.r.right <= b.r.right && a.r.top >= b.r.top && a.r.bottom <= b.r.bottom) continue;
      const gap = gapBetween(a.r, b.r);
      if (!nearest || gap < nearest.gap) nearest = { gap, b };
      if (crowded || !small(a.r)) continue;
      const ca = centreOf(a.r);
      const toBox = Math.hypot(Math.max(0, b.r.left - ca.x, ca.x - b.r.right), Math.max(0, b.r.top - ca.y, ca.y - b.r.bottom));
      const cb = centreOf(b.r);
      if (toBox < 12 || (small(b.r) && Math.hypot(ca.x - cb.x, ca.y - cb.y) < 24)) crowded = b;
    }
    if (crowded) noRoomAround.push({ ...a.item, beside: describe(crowded.el) });
    if (nearest && nearest.gap < 8) closeTogether.push({ ...a.item, beside: describe(nearest.b.el), gap_px: Math.round(nearest.gap) });
  }

  // Names and labels.
  const nameOf = (el) => clean(el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => (document.getElementById(id) || {}).innerText || '').join(' ') || el.innerText || el.getAttribute('title') || el.getAttribute('alt') || (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type) ? el.value : '') || [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join(' '));
  const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]), select, textarea')].filter(visible);
  const unlabeled = [];
  const placeholderOnly = [];
  for (const el of fields) {
    const hasLabel = (el.labels && el.labels.length > 0) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
    if (hasLabel) continue;
    (el.getAttribute('placeholder') ? placeholderOnly : unlabeled).push(describe(el));
  }
  // What each field is, so a reader can tell whether a phone brings up the right keyboard for it.
  const fieldTypes = fields.slice(0, 30).map((el) => ({
    field: describe(el).slice(0, 80),
    type: el.tagName === 'INPUT' ? (el.getAttribute('type') || 'text') : el.tagName.toLowerCase(),
    inputmode: el.getAttribute('inputmode') || null,
    autocomplete: el.getAttribute('autocomplete') || null,
  }));
  const unnamedControls = interactive.filter((el) => !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && !nameOf(el)).map(describe);
  const images = [...document.querySelectorAll('img')].filter(visible);
  const imagesWithoutAlt = images.filter((i) => !i.hasAttribute('alt')).map((i) => clean(i.getAttribute('src')));

  // Text: size and contrast.
  const textElements = [];
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let node = walker.nextNode(); node && textElements.length < 600; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || seen.has(el) || !node.nodeValue.trim() || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !visible(el)) continue;
    seen.add(el);
    textElements.push(el);
  }
  let smallest = null;
  const smallText = [];
  const sentencesUnder16 = [];
  const lowContrast = [];
  const below7 = [];
  let contrastUnknown = 0;
  let contrastChecked = 0;
  const contrastBetween = (a, b) => { const l1 = luminance(a); const l2 = luminance(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  // The sizes, weights and typefaces the text is set in: how many of each this screen uses.
  const GENERIC_FACES = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', '-apple-system', 'blinkmacsystemfont'];
  const facesOf = (stack) => String(stack || '').split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  const sizesUsed = new Map();
  const weightsUsed = new Map();
  const facesUsed = new Map();
  const bump = (map, key, el) => { const e = map.get(key) || { n: 0, el }; e.n += 1; map.set(key, e); };
  for (const el of textElements) {
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    bump(sizesUsed, round1(size), el);
    bump(weightsUsed, Number(cs.fontWeight) || cs.fontWeight, el);
    const stack = facesOf(cs.fontFamily);
    const first = stack[0] || '';
    const face = GENERIC_FACES.includes(first.toLowerCase()) ? "the device's own face" : first;
    if (!facesUsed.has(face)) facesUsed.set(face, { n: 0, el, stack });
    facesUsed.get(face).n += 1;
    if (smallest === null || size < smallest) smallest = size;
    if (size < 12) smallText.push({ element: describe(el), font_size: round1(size) });
    // Running text: the element's own words make a sentence (40 characters or more, six words or more).
    // Labels, table cells, badges and button captions are shorter and are not counted here.
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
    const sentence = own.length >= 40 && own.split(' ').length >= 6;
    if (sentence && size < 16) sentencesUnder16.push({ element: describe(el), font_size: round1(size) });
    const fg = parseColor(cs.color);
    const bg = backgroundOf(el);
    if (!fg || !bg) { contrastUnknown += 1; continue; }
    contrastChecked += 1;
    const colour = fg.a < 1 ? blend(fg, bg) : fg;
    const ratio = contrastBetween(colour, bg);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    const needed = large ? 3 : 4.5;
    if (ratio < needed) lowContrast.push({ element: describe(el), ratio: Math.round(ratio * 100) / 100, needed, font_size: round1(size) });
    else if (!large && ratio < 7) below7.push({ element: describe(el), ratio: Math.round(ratio * 100) / 100, font_size: round1(size), sentence });
  }
  function round1(n) { return Math.round(n * 10) / 10; }
  lowContrast.sort((a, b) => a.ratio - b.ratio);
  below7.sort((a, b) => a.ratio - b.ratio);

  // Field edges: what separates a field from what is around it is its border or its own fill.
  const faintEdges = [];
  let edgesUnknown = 0;
  for (const el of fields) {
    const cs = getComputedStyle(el);
    const around = el.parentElement ? backgroundOf(el.parentElement) : null;
    const fillImage = cs.backgroundImage && cs.backgroundImage !== 'none';
    if (!around || fillImage) { edgesUnknown += 1; continue; }
    const fill = parseColor(cs.backgroundColor);
    const border = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' ? parseColor(cs.borderTopColor) : null;
    const byBorder = border && border.a > 0 ? contrastBetween(border.a < 1 ? blend(border, around) : border, around) : 1;
    const byFill = fill && fill.a > 0 ? contrastBetween(fill.a < 1 ? blend(fill, around) : fill, around) : 1;
    const ratio = Math.max(byBorder, byFill);
    if (ratio < 3) faintEdges.push({ element: describe(el), ratio: Math.round(ratio * 100) / 100 });
  }
  faintEdges.sort((a, b) => a.ratio - b.ratio);

  // Structure.
  const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role=heading]')].filter(visible).map((h) => ({ level: Number(h.getAttribute('aria-level')) || Number(h.tagName[1]) || null, text: clean(h.innerText) }));
  const skipped = [];
  headings.forEach((h, i) => { if (i > 0 && h.level && headings[i - 1].level && h.level > headings[i - 1].level + 1) skipped.push(`h${headings[i - 1].level} to h${h.level} at "${h.text}"`); });
  const dialogs = [...document.querySelectorAll('dialog[open], [role=dialog], [role=alertdialog]')].filter(visible).map((d) => {
    const r = d.getBoundingClientRect();
    return { element: describe(d).slice(0, 80), width: Math.round(r.width), height: Math.round(r.height), exceeds_viewport: r.width > vw + 1 || r.height > vh + 1 || r.left < -1 || r.top < -1 };
  });
  const cut = (list) => ({ count: list.length, examples: list.slice(0, MAX_EXAMPLES) });

  // The first window: what is in front of someone before they scroll. Its height is the configured
  // window's; capture.cjs passes it, because it may have grown the window to picture a scrolling panel.
  const firstHeight = Number(window.__uxqFirstWindow) || vh;
  const place = (el) => { const r = el.getBoundingClientRect(); const top = Math.round(r.top + window.scrollY); return { top, bottom: Math.round(top + r.height), across: r.left < vw && r.right > 0 }; };
  const inFirst = (el) => { const at = place(el); return at.across && at.top < firstHeight && at.bottom > 0; };
  const isAction = (el) => el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button' || (el.tagName === 'INPUT' && ['submit', 'button'].includes(el.type));
  const firstActions = interactive.filter((el) => isAction(el) && inFirst(el)).map((el) => { const at = place(el); return { element: describe(el), top: at.top, ...(at.bottom > firstHeight ? { cut_off_at_the_bottom: true } : {}) }; });
  const firstHeadings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role=heading]')].filter((h) => visible(h) && inFirst(h)).map((h) => ({ level: Number(h.getAttribute('aria-level')) || Number(h.tagName[1]) || null, text: clean(h.innerText) }));

  // Words: how much there is to read on this screen, what kind of words they are, and how they fall
  // down the page, one window at a time. A word is a run of characters with a letter or a figure in it.
  // Running text is what is left when headings, the words of controls (a button, a link, a field's
  // label) and values (a table's cells, a list of terms, code) are taken out: sentences, descriptions,
  // hints. A table full of names is many words and nothing to cut; running text is where a screen that
  // says too much says it. One more count leaves out the navigation, the footer and anything the page
  // marks data-words="off" (a picture made of words, such as a demonstration on sample material): it is
  // the count to hold against a length that was agreed for the page.
  const KINDS = [
    ['in_controls', 'a, button, label, summary, option, [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [role=checkbox], [role=switch], [role=radio]'],
    ['headings', 'h1, h2, h3, h4, h5, h6, [role=heading]'],
    ['in_tables_and_term_lists', 'td, th, dt, dd, [role=cell], [role=gridcell], [role=rowheader], [role=columnheader], pre, code, kbd, samp, output']
  ];
  const kindOf = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { for (const [kind, selector] of KINDS) if (n.matches(selector)) return kind; } return 'running_text'; };
  const countWords = (str) => str.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const blockOf = (el) => { let n = el; while (n.parentElement && n !== document.body && getComputedStyle(n).display.startsWith('inline')) n = n.parentElement; return n; };
  const drawn = new Map();
  const isDrawn = (el) => { if (!drawn.has(el)) drawn.set(el, visible(el)); return drawn.get(el); };
  const ofWhich = { running_text: 0, headings: 0, in_controls: 0, in_tables_and_term_lists: 0 };
  const perWindow = [];
  const blocks = new Map();
  let wordsOnScreen = 0;
  let wordsInBody = 0;
  let wordsInSamples = 0;
  let runningFirst = 0;
  let textNodes = 0;
  const span = document.createRange();
  // Two more things are read off the same walk. Words that keep their room on the page and are not
  // painted (something above them is at opacity 0, or they are set not to show): a gap where a section
  // waits for a script or an animation to reveal it. And where each painted line of text lies, for
  // what lies on what (below).
  const MAX_LINES = 6000;
  const lines = [];
  const blockCache = new Map();
  const blockFor = (el) => { if (!blockCache.has(el)) blockCache.set(el, blockOf(el)); return blockCache.get(el); };
  const unseen = new Map();
  const noteUnseen = (node, el, n, gone) => {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return; // not laid out: no room is kept for it
    const position = getComputedStyle(gone.root).position;
    if (position === 'absolute' || position === 'fixed') return; // laid over the page (a tip, a closed menu), not a gap in it
    span.selectNodeContents(node);
    const box = within(span.getBoundingClientRect(), clipInside(el));
    if (!box || box.r - box.l < 2 || box.b - box.t < 4 || box.r <= 0 || box.l >= docWidth) return;
    const entry = unseen.get(gone.root) || { words: 0, why: gone.why };
    entry.words += n;
    unseen.set(gone.root, entry);
  };
  const everyText = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = everyText.nextNode(); node && textNodes < 20000; node = everyText.nextNode()) {
    const el = node.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
    const n = countWords(node.nodeValue);
    if (!n) continue;
    const gone = hiddenBy(el);
    if (gone) noteUnseen(node, el, n, gone);
    if (!isDrawn(el)) continue;
    span.selectNodeContents(node);
    const box = span.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    textNodes += 1;
    if (!gone && lines.length < MAX_LINES) {
      const clip = clipInside(el);
      for (const r of span.getClientRects()) {
        const b = within(r, clip);
        if (b && b.r - b.l >= 2 && b.b - b.t >= 4) lines.push({ ...b, el, block: blockFor(el) });
      }
    }
    const top = Math.max(0, box.top + window.scrollY);
    const kind = kindOf(el);
    ofWhich[kind] += n;
    wordsOnScreen += n;
    if (el.closest('[data-words="off"]')) wordsInSamples += n;
    else if (!el.closest('nav, [role=navigation], footer, [role=contentinfo]')) wordsInBody += n;
    const band = Math.min(Math.floor(top / firstHeight), 39);
    perWindow[band] = (perWindow[band] || 0) + n;
    if (kind === 'running_text') {
      if (top < firstHeight) runningFirst += n;
      const block = blockOf(el);
      blocks.set(block, (blocks.get(block) || 0) + n);
    }
  }
  for (let i = 0; i < perWindow.length; i += 1) perWindow[i] = perWindow[i] || 0;
  const longestBlocks = [...blocks].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([el, n]) => ({ element: describe(el).slice(0, 80), words: n }));
  // Left out: what waits its turn in a place where something else is showing (the other slides of a
  // carousel, the other lines of a headline that changes). Room is kept for it, but not empty room.
  const sharesItsPlace = (root) => {
    const r = root.getBoundingClientRect();
    const area = r.width * r.height;
    if (!area) return false;
    for (let n = root, level = 0; n.parentElement && level < 3; n = n.parentElement, level += 1) {
      for (const sib of n.parentElement.children) {
        if (sib === n || !visible(sib) || fadedRoot(sib)) continue;
        const q = sib.getBoundingClientRect();
        const w = Math.min(r.right, q.right) - Math.max(r.left, q.left); const h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (w > 0 && h > 0 && w * h >= 0.5 * area && clean(sib.innerText)) return true;
      }
    }
    return false;
  };
  for (const root of [...unseen.keys()]) if (sharesItsPlace(root)) unseen.delete(root);
  // What it says, read from the page's text itself: what is not painted has no text as a person sees it.
  const saidIn = (root) => { const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const parts = []; for (let n = walk.nextNode(); n && parts.length < 40; n = walk.nextNode()) if (n.nodeValue.trim()) parts.push(n.nodeValue.trim()); return clean(parts.join(' ')); };
  const notDrawn = [...unseen].sort((a, b) => b[1].words - a[1].words).map(([root, e]) => ({ element: `${root.tagName.toLowerCase()}${root.id ? `#${root.id}` : ''} "${saidIn(root)}"`, words: e.words, why: e.why }));

  // What lies on what. Two lines of text from different blocks, two controls, or a line of text and a
  // control it does not belong to, whose boxes cross. Text on text is reported only where both still
  // show, so that one is read through the other. A menu, a tip or a card with a fill of its own that is
  // painted above what it covers is one thing in front of another, not two things colliding, and is
  // left out; so is anything pinned to the window, which passes over the page by design. Two controls
  // are reported also where the fill of one hides part of the other: two buttons half on each other.
  const lifted = (cs) => cs.position !== 'static' || cs.transform !== 'none' || Number(cs.opacity) < 1 || (cs.filter && cs.filter !== 'none') || cs.isolation === 'isolate'
    || (cs.mixBlendMode && cs.mixBlendMode !== 'normal') || /paint|layout|strict|content/.test(cs.contain || '') || /transform|opacity/.test(cs.willChange || '') || (cs.containerType && cs.containerType !== 'normal');
  const hasFill = (cs) => { if (cs.backgroundImage && cs.backgroundImage !== 'none') return true; const c = parseColor(cs.backgroundColor); return Boolean(c && c.a >= 0.5); };
  // The edges an element draws: each side with a width, a line style and a colour that shows.
  const edges = (cs) => ['Top', 'Right', 'Bottom', 'Left'].map((side) => { const w = parseFloat(cs[`border${side}Width`]) || 0; const style = cs[`border${side}Style`]; const col = w > 0 && style !== 'none' && style !== 'hidden' ? parseColor(cs[`border${side}Color`]) : null; return col && col.a > 0.05 ? { w, col } : null; }).filter(Boolean);
  // What an animation is moving as this is read (a row that slides, a ticker): where it crosses something
  // depends on the moment, so it is left out.
  const movingNow = new Set();
  try {
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running' || !a.effect || !a.effect.target || !a.effect.getKeyframes) continue;
      if (a.effect.getKeyframes().some((k) => Object.keys(k).some((prop) => /^(transform|translate|rotate|scale|left|right|top|bottom|inset|margin|offset|width|height)/.test(prop)))) movingNow.add(a.effect.target);
    }
  } catch (e) { /* this browser does not list what is running */ }
  const sharedAbove = (a, b) => { const up = new Set(); for (let n = a; n; n = n.parentElement) up.add(n); for (let n = b; n; n = n.parentElement) if (up.has(n)) return n; return document.documentElement; };
  // One side of a pair: what is between it and what the two share, whether any of that is pinned, and
  // the outermost part of it that is painted as a layer of its own (with the fills that layer carries
  // at the point in question).
  const sideOf = (el, top, x, y) => {
    const chain = [];
    for (let n = el; n && n !== top; n = n.parentElement) chain.push({ n, cs: getComputedStyle(n) });
    const pinnedHere = chain.some((c) => c.cs.position === 'fixed' || c.cs.position === 'sticky' || movingNow.has(c.n));
    // Inside a strip that holds more than it shows and is moved sideways: the slides of a carousel, a ticker.
    const inStrip = chain.some((c) => c.cs.overflowX !== 'visible' && c.n.scrollWidth > c.n.clientWidth + 8);
    let outer = -1;
    chain.forEach((c, i) => { if (lifted(c.cs)) outer = i; }); // the last one found is the nearest to what they share
    const layer = outer < 0 ? null : chain[outer];
    const z = layer && layer.cs.position !== 'static' ? (parseInt(layer.cs.zIndex, 10) || 0) : 0;
    // What this side would hide if it is the one painted above: nothing, with its own fill only (a
    // button over a line of text), or with the fill of something it sits in (a menu, a tip, a card).
    let covers = null;
    if (layer) chain.slice(0, outer + 1).forEach((c, i) => { if (!hasFill(c.cs)) return; const r = c.n.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) covers = i === 0 && covers !== 'a layer' ? 'itself' : 'a layer'; });
    return { pinnedHere, inStrip, layer: layer ? layer.n : null, z, covers };
  };
  // How two things that cross stand to each other at a point: null when either is pinned to the window
  // or being moved, when one is in a strip that slides sideways and the other is laid over that strip
  // (the arrows of a carousel, a button that pauses a ticker), or when a third thing with a fill is in front of both there (the browser says so for
  // a point inside the window), else which of the two is painted above ('first' or 'second', or neither when both lie in the page's
  // own flow, where text is painted over every fill) and what that one hides there.
  const crossingOf = (a, b, x, y) => {
    const top = sharedAbove(a, b);
    const A = sideOf(a, top, x, y); const B = sideOf(b, top, x, y);
    if (A.pinnedHere || B.pinnedHere || A.inStrip !== B.inStrip) return null; // one of them slides under the other
    if (x >= 0 && x < vw && y >= 0 && y < vh && document.elementsFromPoint) {
      for (const e of document.elementsFromPoint(x, y)) {
        if (e === a || e === b || a.contains(e) || b.contains(e)) break;
        if (!e.contains(a) && !e.contains(b) && hasFill(getComputedStyle(e))) return null;
      }
    }
    if (!A.layer && !B.layer) return { above: null, hides: null };
    let first;
    if (A.layer && B.layer) first = A.z !== B.z ? A.z > B.z : !(A.layer.compareDocumentPosition(B.layer) & Node.DOCUMENT_POSITION_FOLLOWING);
    else first = A.layer ? A.z >= 0 : B.z < 0;
    return { above: first ? 'first' : 'second', hides: (first ? A : B).covers };
  };
  const bothShow = (a, b, x, y) => { const c = crossingOf(a, b, x, y); return Boolean(c) && !c.hides; };
  const glyphs = (b) => { const d = (b.b - b.t) * 0.18; return { l: b.l, r: b.r, t: b.t + d, b: b.b - d }; }; // a line's box is taller than its letters
  const crossing = (a, b) => ({ w: Math.min(a.r, b.r) - Math.max(a.l, b.l), h: Math.min(a.b, b.b) - Math.max(a.t, b.t), x: (Math.max(a.l, b.l) + Math.min(a.r, b.r)) / 2, y: (Math.max(a.t, b.t) + Math.min(a.b, b.b)) / 2 });
  const pairs = (map, one, other, area, what) => { if (!map.has(one)) map.set(one, new Map()); const had = map.get(one).get(other); if (!had || had.area < area) map.get(one).set(other, { area, ...what }); };
  const listed = (map) => [...map.values()].flatMap((m) => [...m.values()]).sort((p, q) => q.area - p.area).map(({ area, ...what }) => what);
  const spot = (c) => ({ top: Math.round(c.y + window.scrollY), left: Math.round(c.x + window.scrollX) });
  lines.sort((p, q) => p.t - q.t);
  // The words of a control are the control: where they cross other words, that is told under text_and_control.
  const controls = new Set(sized.map((s) => s.el));
  const inControl = new Map();
  const ofControl = (el) => { if (!inControl.has(el)) { let found = null; for (let n = el; n && !found; n = n.parentElement) if (controls.has(n)) found = n; inControl.set(el, found); } return inControl.get(el); };
  const worded = new Set(lines.map((l) => ofControl(l.el)).filter(Boolean)); // the controls that show words
  const sameWords = (a, b) => clean(a.textContent) === clean(b.textContent);
  const textOnText = new Map();
  for (let i = 0; i < lines.length; i += 1) {
    const one = lines[i]; const a = glyphs(one);
    for (let j = i + 1; j < lines.length && lines[j].t < one.b; j += 1) {
      const other = lines[j];
      if (other.block === one.block) continue; // lines of one block are as far apart as their line height puts them
      if (ofControl(one.el) || ofControl(other.el)) continue;
      if (sameWords(one.block, other.block)) continue; // the same words drawn twice in one place: an effect, not two things
      const b = glyphs(other);
      const c = crossing(a, b);
      if (c.w < 4 || c.h < 3 || c.h < 0.25 * Math.min(a.b - a.t, b.b - b.t)) continue;
      if (!bothShow(one.el, other.el, c.x, c.y)) continue;
      pairs(textOnText, one.block, other.block, c.w * c.h, { one: describe(one.block).slice(0, 80), other: describe(other.block).slice(0, 80), where: spot(c), by_px: `${Math.round(c.w)}x${Math.round(c.h)}` });
    }
  }
  // A control counts here when it is a box of its own (one set inside a line wraps with the line, and
  // its outline then takes in its neighbours) and when it paints something: an empty area that only
  // catches a press lies on nothing a person can see.
  const paints = (el) => { const cs = getComputedStyle(el); const c = parseColor(cs.backgroundColor); return worded.has(el) || (cs.backgroundImage && cs.backgroundImage !== 'none') || Boolean(c && c.a > 0.05) || edges(cs).length > 0 || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || [...el.querySelectorAll('img, svg, canvas, video')].some((m) => visible(m) && !fadedRoot(m)); };
  const boxes = sized.map((s) => ({ ...s, box: fadedRoot(s.el) || getComputedStyle(s.el).display === 'inline' || !paints(s.el) ? null : within(s.r, clipInside(s.el.parentElement)) })).filter((s) => s.box);
  const controlOnControl = new Map();
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const one = boxes[i]; const other = boxes[j];
      if (one.el.contains(other.el) || other.el.contains(one.el)) continue;
      const c = crossing(one.box, other.box);
      if (c.w < 4 || c.h < 4) continue;
      const smaller = Math.min((one.box.r - one.box.l) * (one.box.b - one.box.t), (other.box.r - other.box.l) * (other.box.b - other.box.t));
      // One wholly inside the other is a control placed in another on purpose: the cross that clears a field.
      if (c.w * c.h < 0.15 * smaller || c.w * c.h > 0.9 * smaller) continue;
      const how = crossingOf(one.el, other.el, c.x, c.y);
      if (!how || how.hides === 'a layer') continue; // one of them is in a menu or a panel that is in front
      pairs(controlOnControl, one.el, other.el, c.w * c.h, { one: one.item.element, other: other.item.element, where: spot(c), by_px: `${Math.round(c.w)}x${Math.round(c.h)}` });
    }
  }
  const textOnControl = new Map();
  for (const control of boxes) {
    let from = 0;
    for (let lo = 0, hi = lines.length; lo < hi;) { const mid = (lo + hi) >> 1; if (lines[mid].t < control.box.t - 300) { lo = mid + 1; from = lo; } else hi = mid; }
    for (let j = from; j < lines.length && lines[j].t < control.box.b; j += 1) {
      const line = lines[j];
      if (control.el.contains(line.el) || line.el.contains(control.el) || ofControl(line.el)) continue; // a control's own words on another control: told under control_on_control
      const label = line.el.closest('label');
      if (label && (label.control === control.el || label.contains(control.el))) continue; // a label set on its own field
      const g = glyphs(line);
      const c = crossing(g, control.box);
      if (c.w < 4 || c.h < 3 || c.h < 0.25 * (g.b - g.t)) continue;
      if (c.w * c.h > 0.9 * (g.r - g.l) * (g.b - g.t)) continue; // wholly inside the control: words set in it on purpose
      const how = crossingOf(line.el, control.el, c.x, c.y);
      // Only where both show: words over a control, or a control with no fill over words. A button laid on purpose over what
      // slides under it (the arrows of a carousel, a button that pauses a ticker) hides the words with its own fill, and is left out.
      if (!how || how.hides) continue;
      pairs(textOnControl, line.block, control.el, c.w * c.h, { text: describe(line.block).slice(0, 80), control: control.item.element, where: spot(c), by_px: `${Math.round(c.w)}x${Math.round(c.h)}` });
    }
  }
  // What a bar pinned to the window covers wherever the page is scrolled: a line or a control that can
  // be brought neither above the bar nor below it, because the page ends there. The first lines under a
  // header that stays, the last lines under a banner along the bottom.
  // The window a pinned bar is placed against. On a phone a page that overflows sideways is shown
  // zoomed out, in a window larger than the one it was laid out for, and the bar sits at that one's edge.
  const pageHeight = document.documentElement.scrollHeight;
  const windowHeight = Math.max(vh, window.innerHeight || 0);
  const maxScroll = Math.max(0, pageHeight - windowHeight);
  const neverClear = [];
  const coverers = pinned.filter((p) => p.how === 'fixed' && hasFill(getComputedStyle(p.el))).map((p) => ({ ...p, r: p.el.getBoundingClientRect() }));
  const coveredBy = (box, el) => {
    const top = box.t + window.scrollY; const bottom = box.b + window.scrollY; // where it lies on the page
    for (const bar of coverers) {
      if (bar.el.contains(el) || Math.min(box.r, bar.r.right) - Math.max(box.l, bar.r.left) < 4) continue;
      const height = bottom - top;
      const above = height <= bar.r.top && bottom - bar.r.top <= maxScroll; // some scroll puts it wholly above the bar
      const below = height <= windowHeight - bar.r.bottom && top >= bar.r.bottom; // or wholly below it
      if (!above && !below) return bar;
    }
    return null;
  };
  if (coverers.length) {
    const seenBlocks = new Set();
    for (const line of lines) {
      if (seenBlocks.has(line.block)) continue;
      const bar = coveredBy(glyphs(line), line.el);
      if (bar) { seenBlocks.add(line.block); neverClear.push({ element: describe(line.block).slice(0, 80), under: bar.element.slice(0, 60) }); }
    }
    for (const control of boxes) {
      if (seenBlocks.has(control.el) || [...seenBlocks].some((b) => control.el.contains(b) || b.contains(control.el))) continue;
      const bar = coveredBy(control.box, control.el);
      if (bar) neverClear.push({ element: control.item.element, under: bar.element.slice(0, 60) });
    }
  }

  // One system: how many different looks the same kind of thing has on this screen. A look is what a
  // person would tell apart: fill, text colour, border, corners, height, the size and weight of its
  // words, and the room at its sides. A product has a few kinds of button on purpose; the list is for
  // seeing which two of them are one kind drawn twice.
  const MAX_LOOKS = 8;
  const hex = (c) => { if (!c) return 'a colour that could not be read'; const h = (v) => Math.round(v).toString(16).padStart(2, '0'); return `#${h(c.r)}${h(c.g)}${h(c.b)}${c.a < 1 ? ` at ${Math.round(c.a * 100)}%` : ''}`; };
  const cornerOf = (cs, r) => {
    const px = Math.max(...['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map((k) => { const first = String(cs[`border${k}Radius`] || '0').split(' ')[0]; return first.endsWith('%') ? (parseFloat(first) / 100) * Math.min(r.width, r.height) : parseFloat(first) || 0; }));
    if (px < 0.5) return 'square';
    return px >= Math.min(r.width, r.height) / 2 - 0.5 ? 'fully rounded' : `${Math.round(px * 2) / 2}px`;
  };
  const fillOf = (cs) => { if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'a gradient or a picture'; const c = parseColor(cs.backgroundColor); return c && c.a > 0.05 ? hex(c) : null; };
  const looks = (map, unit) => ({ count: map.size, examples: [...map].sort((a, b) => b[1].n - a[1].n).slice(0, MAX_LOOKS).map(([look, e]) => ({ look, [unit]: e.n, example: describe(e.el).slice(0, 60) })) });
  const buttonLooks = new Map();
  const linkLooks = new Map();
  for (const el of document.querySelectorAll('button, [role=button], input[type=submit], input[type=button], input[type=reset], a[href]')) {
    if (!visible(el) || fadedRoot(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const fill = fillOf(cs);
    const edged = edges(cs);
    const type = `${round1(parseFloat(cs.fontSize))}px weight ${cs.fontWeight}`;
    if (el.tagName === 'A' && !fill && edged.length < 3) {
      if (!clean(el.innerText)) continue; // a link round a picture has no look of its own
      const colour = parseColor(cs.color);
      const own = colour && colour.r === 0 && colour.g === 0 && colour.b === 238 ? " (the browser's own blue)" : '';
      bump(linkLooks, [`colour ${hex(colour)}${own}`, /underline/.test(cs.textDecorationLine || cs.textDecoration || '') ? 'underlined' : 'not underlined', type].join(', '), el);
      continue;
    }
    const widest = edged.sort((a, b) => b.w - a.w)[0];
    const corner = cornerOf(cs, r);
    bump(buttonLooks, [fill ? `fill ${fill}` : 'no fill', `text ${hex(parseColor(cs.color))}`, widest ? `border ${round1(widest.w)}px ${hex(widest.col)}` : 'no border',
      corner === 'square' ? 'square corners' : corner === 'fully rounded' ? 'fully rounded ends' : `corners ${corner}`, `${Math.round(r.height)}px tall`, type, `${Math.round(parseFloat(cs.paddingLeft) || 0)}px of room at each side`].join(', '), el);
  }
  // Corners, shadows and boxes inside boxes, over everything that is drawn. A box is something drawn
  // round its content: three or more edges, a shadow, or a fill unlike what is behind it. A band that
  // runs the width of the page is a ground, not a box, and a control or a table is not one either.
  const NOT_A_BOX = 'a, button, input, select, textarea, label, summary, img, svg, video, canvas, picture, iframe, table, thead, tbody, tfoot, tr, td, th, [role=button]';
  const cornersUsed = new Map();
  const shadowsUsed = new Map();
  const boxDepth = new Map();
  const deepBoxes = [];
  let squareCorners = 0;
  let backgroundPictures = 0;
  let deepest = 0;
  let lookedAt = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (lookedAt >= 6000) break;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility !== 'visible' || fadedRoot(el)) continue;
    lookedAt += 1;
    const picture = /url\(/.test(cs.backgroundImage || '');
    if (picture) backgroundPictures += 1;
    const colour = parseColor(cs.backgroundColor);
    const fill = (cs.backgroundImage && cs.backgroundImage !== 'none') || Boolean(colour && colour.a > 0.05);
    const edged = edges(cs).length;
    const shadow = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow.replace(/\s+/g, ' ') : null;
    if (fill || edged || shadow || ['IMG', 'VIDEO', 'CANVAS'].includes(el.tagName)) {
      const corner = cornerOf(cs, r);
      if (corner === 'square') squareCorners += 1; else bump(cornersUsed, corner, el);
    }
    if (shadow) bump(shadowsUsed, shadow.length > 90 ? `${shadow.slice(0, 90)}...` : shadow, el);
    if (r.width < 120 || r.height < 60 || r.width >= docWidth * 0.98 || el.matches(NOT_A_BOX) || el.closest('a, button, label, summary, [role=button]')) continue;
    let box = edged >= 3 || Boolean(shadow);
    if (!box && fill) {
      const behind = el.parentElement ? backgroundOf(el.parentElement) : null;
      const mine = colour && colour.a > 0.05 ? (colour.a < 1 && behind ? blend(colour, behind) : colour) : null;
      box = picture || !behind || !mine || Math.abs(mine.r - behind.r) + Math.abs(mine.g - behind.g) + Math.abs(mine.b - behind.b) > 12;
    }
    if (!box) continue;
    let depth = 1;
    for (let p = el.parentElement; p; p = p.parentElement) if (boxDepth.has(p)) { depth = boxDepth.get(p) + 1; break; }
    boxDepth.set(el, depth);
    if (depth > deepest) deepest = depth;
    if (depth >= 3) deepBoxes.push(`${describe(el).slice(0, 70)} (${depth} deep)`);
  }
  // A typeface is drawn when one of the files the page brings for it has arrived, or when text set in it
  // is as wide as nothing else makes it: measured against three generic faces, so that a face which
  // never arrived, and is replaced by one of them, shows.
  let pen = null;
  const SAMPLE = 'mmmmmmmmmmlli 0123 WQgy';
  const widthIn = (stack) => { if (!pen) pen = document.createElement('canvas').getContext('2d'); pen.font = `72px ${stack}`; return pen.measureText(SAMPLE).width; };
  const GENERICS = ['monospace', 'serif', 'sans-serif'];
  const generic = {};
  const here = new Map();
  const onThisMachine = (family) => {
    if (GENERIC_FACES.includes(family.toLowerCase())) return true;
    if (!here.has(family)) {
      let found = false;
      try { for (const g of GENERICS) { if (generic[g] === undefined) generic[g] = widthIn(g); if (Math.abs(widthIn(`"${family.replace(/["\\]/g, '')}", ${g}`) - generic[g]) > 0.5) found = true; } } catch (e) { found = true; } // cannot tell: say nothing
      here.set(family, found);
    }
    return here.get(family);
  };
  const comesWithThePage = new Map();
  try { for (const f of document.fonts) { const name = String(f.family).replace(/^["']|["']$/g, '').toLowerCase(); comesWithThePage.set(name, [...(comesWithThePage.get(name) || []), f.status]); } } catch (e) { /* this browser does not list the faces a page declares */ }
  const typefaces = [...facesUsed].sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([family, e]) => {
    if (family === "the device's own face") return { family, text_elements: e.n, drawn: true };
    const statuses = comesWithThePage.get(family.toLowerCase());
    const drawn = Boolean(statuses && statuses.includes('loaded')) || onThisMachine(family);
    const out = { family, text_elements: e.n, drawn, comes_with_the_page: Boolean(statuses) };
    if (!drawn) {
      if (statuses) out.its_files = statuses.includes('error') ? 'failed to load' : statuses.includes('loading') ? 'had not arrived when this was measured' : 'were never asked for';
      out.drawn_instead = e.stack.slice(1).find((f) => onThisMachine(f)) || "the browser's default face";
    }
    return out;
  });
  const levelSizes = new Map();
  for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!visible(h) || fadedRoot(h)) continue;
    const level = Number(h.tagName[1]);
    levelSizes.set(level, (levelSizes.get(level) || new Set()).add(round1(parseFloat(getComputedStyle(h).fontSize))));
  }
  const unevenHeadings = [...levelSizes].filter(([, set]) => set.size > 1).sort((a, b) => a[0] - b[0]).map(([level, set]) => ({ level, sizes_px: [...set].sort((a, b) => b - a) }));
  const counted = (map, name, unit) => [...map].sort((a, b) => b[1].n - a[1].n).slice(0, MAX_LOOKS).map(([key, e]) => ({ [name]: key, [unit]: e.n, example: describe(e.el).slice(0, 60) }));

  // Pictures: whether each arrived, whether it is drawn larger than its file or out of proportion,
  // whether the page says how large it is before it arrives, whether one is used twice, what they weigh.
  const picName = (img) => { const src = img.currentSrc || img.getAttribute('src') || ''; const file = /^data:/i.test(src) ? 'embedded in the page' : (src.split(/[?#]/)[0].split('/').pop() || src).slice(-50); const alt = clean(img.getAttribute('alt')); return `${alt ? `"${alt}" ` : ''}(${file})`; };
  const bytesOf = new Map();
  try { for (const e of performance.getEntriesByType('resource')) bytesOf.set(e.name, e.encodedBodySize || e.transferSize || 0); } catch (e) { /* no record of what was fetched */ }
  const didNotLoad = [];
  const enlarged = [];
  const outOfProportion = [];
  const noSize = [];
  const uses = new Map();
  const weights = new Map();
  let stillArriving = 0;
  let standIns = 0;
  let weightUnknown = 0;
  for (const img of images) {
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (!img.complete) { stillArriving += 1; continue; }
    if (!img.naturalWidth || !img.naturalHeight) { didNotLoad.push(picName(img)); continue; }
    if (img.naturalWidth <= 2 && img.naturalHeight <= 2) { standIns += 1; continue; } // a dot standing where a picture is drawn some other way, or has yet to be fetched
    const cs = getComputedStyle(img);
    const w = img.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const h = img.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    if (w < 1 || h < 1) continue;
    const sizes = { file_px: `${img.naturalWidth}x${img.naturalHeight}`, drawn_px: `${Math.round(w)}x${Math.round(h)}` };
    const vector = /\.svg$/i.test(src.split(/[?#]/)[0]) || /^data:image\/svg/i.test(src);
    const sx = w / img.naturalWidth; const sy = h / img.naturalHeight;
    const fit = cs.objectFit || 'fill';
    const scale = fit === 'contain' ? Math.min(sx, sy) : fit === 'none' ? 1 : fit === 'scale-down' ? Math.min(1, sx, sy) : Math.max(sx, sy);
    if (!vector && w >= 24 && scale > 1.2) enlarged.push({ picture: picName(img), ...sizes, enlarged: `${round1(scale)} times` });
    if (!vector && fit === 'fill' && w >= 24 && h >= 24 && Math.abs(sx / sy - 1) > 0.05) outOfProportion.push({ picture: picName(img), ...sizes });
    if (!(img.getAttribute('width') && img.getAttribute('height')) && !(img.style.width && img.style.height) && (cs.aspectRatio || 'auto') === 'auto') noSize.push(picName(img));
    if (w >= 100 && h >= 100) { const key = src.split('#')[0]; if (!uses.has(key)) uses.set(key, { n: 0, img }); uses.get(key).n += 1; }
    if (!weights.has(src)) {
      let bytes = bytesOf.get(src) || 0;
      if (/^data:/i.test(src)) { const comma = src.indexOf(','); bytes = Math.round((src.length - comma - 1) * (/;base64/i.test(src.slice(0, comma)) ? 0.75 : 1)); }
      if (bytes) weights.set(src, { bytes, img, drawn_px: sizes.drawn_px }); else weightUnknown += 1;
    }
  }
  const usedTwice = [...uses.values()].filter((u) => u.n > 1).map((u) => ({ picture: picName(u.img), times: u.n }));
  const heaviest = [...weights.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 3).map((p) => ({ picture: picName(p.img), kilobytes: Math.round(p.bytes / 102.4) / 10, drawn_px: p.drawn_px }));
  const totalKilobytes = Math.round([...weights.values()].reduce((sum, p) => sum + p.bytes, 0) / 102.4) / 10;

  // What the page says about itself to a search engine and to a link preview.
  const long = (s) => (s === null || s === undefined ? null : String(s).replace(/\s+/g, ' ').trim().slice(0, 300));
  const metaOf = (selector) => { const m = document.querySelector(selector); return m ? long(m.getAttribute('content')) : null; };
  const description = metaOf('meta[name="description"]');
  const canonical = document.querySelector('link[rel="canonical"]');

  // Links that lead nowhere, and text that was never filled in.
  const allLinks = [...document.querySelectorAll('a')].filter(visible);
  const nowhere = allLinks.filter((a) => { const h = (a.getAttribute('href') || '').trim(); return h === '' || h === '#' || /^javascript:/i.test(h); }).map(describe);
  const bodyText = document.body ? document.body.innerText : '';
  const unfilled = [...new Set(bodyText.match(/\{\{[^{}\n]{1,40}\}\}|lorem ipsum/gi) || [])];

  return {
    measured_at: { url_path: location.pathname + location.hash, title: document.title, viewport: { width: vw, height: vh }, device_pixel_ratio: window.devicePixelRatio },
    layout: { document_width: docWidth, scrolls_sideways: docWidth > vw + 1, overflowing_elements: overflowing, page_height: document.documentElement.scrollHeight, screens_tall: Math.round((document.documentElement.scrollHeight / vh) * 10) / 10, stays_in_window_while_scrolling: cut(staysInWindow),
      lies_on_something_else: { lines_of_text_compared: lines.length, ...(lines.length >= MAX_LINES ? { not_every_line_was_compared: true } : {}), text_on_text: cut(listed(textOnText)), control_on_control: cut(listed(controlOnControl)), text_and_control: cut(listed(textOnControl)) },
      under_a_pinned_bar_wherever_the_page_is_scrolled: cut(neverClear),
      takes_room_but_is_not_drawn: { count: notDrawn.length, words: notDrawn.reduce((sum, e) => sum + e.words, 0), examples: notDrawn.slice(0, MAX_EXAMPLES) } },
    targets: { interactive_count: interactive.length, smaller_than_24px: cut(under24), between_24_and_44px: cut(under44), smaller_than_24px_with_no_room_around: cut(noRoomAround), under_44px_and_closer_than_8px_to_another: cut(closeTogether.sort((a, b) => a.gap_px - b.gap_px)) },
    labels: { form_fields: fields.length, fields_without_label: cut(unlabeled), fields_with_placeholder_only: cut(placeholderOnly), controls_without_name: cut(unnamedControls), images: images.length, images_without_alt: cut(imagesWithoutAlt), field_edges_below_3_to_1: cut(faintEdges), field_edges_unknown: edgesUnknown, field_types: fieldTypes },
    text: { elements_measured: textElements.length, smallest_font_px: smallest === null ? null : round1(smallest), smaller_than_12px: cut(smallText), sentences_smaller_than_16px: cut(sentencesUnder16), contrast_checked: contrastChecked, contrast_unknown_background: contrastUnknown, below_required_contrast: cut(lowContrast), meets_minimum_but_below_7_to_1: cut(below7), never_filled_in: cut(unfilled) },
    first_window: { height: firstHeight, headings: firstHeadings.slice(0, 10), buttons_and_links: cut(firstActions), form_fields: fields.filter(inFirst).length },
    words: { on_the_screen: wordsOnScreen, of_which: ofWhich, outside_navigation_footer_and_samples: wordsInBody, in_marked_samples: wordsInSamples, in_the_first_window: perWindow[0] || 0, running_text_in_the_first_window: runningFirst, in_each_window_down_the_page: perWindow, longest_blocks_of_running_text: longestBlocks },
    styles: {
      button_looks: looks(buttonLooks, 'buttons'), link_looks: looks(linkLooks, 'links'),
      corners: { different: cornersUsed.size, used: counted(cornersUsed, 'corners', 'elements'), elements_with_square_corners: squareCorners },
      shadows: { different: shadowsUsed.size, used: counted(shadowsUsed, 'shadow', 'elements') },
      text_sizes_px: [...sizesUsed.keys()].sort((a, b) => b - a), text_weights: [...weightsUsed.keys()].sort((a, b) => a - b), typefaces,
      heading_levels_drawn_at_more_than_one_size: unevenHeadings,
      boxes_inside_boxes: { boxes: boxDepth.size, deepest, three_or_more_deep: cut(deepBoxes) }
    },
    pictures: {
      count: images.length, did_not_load: cut(didNotLoad), still_arriving_when_measured: stillArriving, one_pixel_stand_ins: standIns, drawn_larger_than_the_file: cut(enlarged), out_of_proportion: cut(outOfProportion),
      no_size_in_the_markup: cut(noSize), used_more_than_once: cut(usedTwice), heaviest, total_kilobytes: totalKilobytes, weight_not_known_for: weightUnknown, drawn_as_backgrounds_and_not_measured: backgroundPictures
    },
    links: { count: allLinks.length, lead_nowhere: cut(nowhere) },
    head: { title: long(document.title) || null, title_length: document.title.trim().length, description, description_length: description ? description.length : 0, canonical: canonical ? canonical.getAttribute('href') : null, robots: metaOf('meta[name="robots"]'), open_graph: { title: metaOf('meta[property="og:title"]'), description: metaOf('meta[property="og:description"]'), image: metaOf('meta[property="og:image"]'), url: metaOf('meta[property="og:url"]') }, twitter_card: metaOf('meta[name="twitter:card"]'), icon: Boolean(document.querySelector('link[rel~="icon"]')), structured_data_blocks: document.querySelectorAll('script[type="application/ld+json"]').length },
    structure: { lang: document.documentElement.getAttribute('lang') || null, h1_count: headings.filter((h) => h.level === 1).length, headings: headings.slice(0, 40), skipped_heading_levels: skipped, has_main_landmark: Boolean(document.querySelector('main, [role=main]')), has_nav_landmark: Boolean(document.querySelector('nav, [role=navigation]')), viewport_meta: (document.querySelector('meta[name=viewport]') || { content: null }).content, open_dialogs: dialogs }
  };
})()
