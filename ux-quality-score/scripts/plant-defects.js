/*
 * plant-defects.js: put known defects into the page in front of you, to make control evidence.
 *
 * A control unit is a set of screens with defects you put there on purpose. Reviewers are shown it
 * like any other journey, and the share of planted defects they catch tells you how strict they were.
 * Use this only while capturing a control unit, in the browser, on a test instance. It changes the
 * page in memory and nothing else: never put a planted defect into the product's own code or data.
 *
 * How to use: in the page, first set the list of defects, then evaluate this file's text, then take
 * the screenshot, the page text and the page facts as usual.
 *
 *   window.__uxqPlants = [
 *     { kind: 'low_contrast', selector: 'main p' },
 *     { kind: 'jargon', selector: 'button[type=submit]', text: 'Remit' }
 *   ];
 *
 * Kinds, and which reviewer, under which criterion of its rubric, should report each:
 *   low_contrast  text too faint to read comfortably        accessibility A1
 *   tiny_target   a control too small to tap                responsive R3
 *   remove_label  a form field left with a placeholder only accessibility A2
 *   overflow      the page scrolls sideways                 responsive R1
 *   misalign      an element knocked off the shared edge    visual V3
 *   hide          something removed, e.g. a confirmation    interaction I2; a user's U3
 *   jargon        a label replaced with an obscure word     content C2; a user's U2
 *
 * Returns { applied: [...], not_found: [...] }. A selector that matches nothing plants nothing, so
 * read the result before you capture.
 */
(() => {
  const plants = Array.isArray(window.__uxqPlants) ? window.__uxqPlants : [];
  const set = (el, props) => { for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v, 'important'); };
  const parse = (str) => { const m = String(str).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const backgroundOf = (el) => {
    for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a >= 0.5) return c; }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const kinds = {
    // Move the text colour most of the way to its background: readable to a careless eye, well under 3 to 1.
    low_contrast(el) {
      const bg = backgroundOf(el);
      const fg = parse(getComputedStyle(el).color) || { r: 0, g: 0, b: 0 };
      const mix = (a, b) => Math.round(a * 0.28 + b * 0.72);
      set(el, { color: `rgb(${mix(fg.r, bg.r)}, ${mix(fg.g, bg.g)}, ${mix(fg.b, bg.b)})` });
    },
    tiny_target(el) { set(el, { padding: '0 3px', 'font-size': '10px', 'line-height': '16px', height: '16px', 'min-height': '0', 'min-width': '0', width: 'auto' }); },
    remove_label(el) {
      const labels = el.labels ? [...el.labels] : [];
      const words = labels.map((l) => l.innerText.trim()).filter(Boolean).join(' ') || el.getAttribute('aria-label') || '';
      for (const l of labels) l.remove();
      for (const a of ['aria-label', 'aria-labelledby', 'title']) el.removeAttribute(a);
      if (words && !el.getAttribute('placeholder')) el.setAttribute('placeholder', words);
    },
    overflow(el) { set(el, { 'min-width': '160vw' }); },
    misalign(el) { set(el, { transform: 'translate(13px, 5px)' }); },
    hide(el) { set(el, { display: 'none' }); },
    jargon(el, plant) { el.textContent = plant.text; }
  };
  const applied = [];
  const notFound = [];
  for (const plant of plants) {
    const fn = kinds[plant.kind];
    let found = [];
    // Only elements a person can see: a defect planted on a hidden element is not in the screenshot.
    const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    try { found = fn ? [...document.querySelectorAll(plant.selector)].filter(onScreen) : []; } catch (_) { found = []; }
    if (!fn || !found.length || (plant.kind === 'jargon' && !plant.text)) { notFound.push({ kind: plant.kind, selector: plant.selector, reason: !fn ? 'unknown kind' : !found.length ? 'selector matched nothing visible' : 'jargon needs "text"' }); continue; }
    const targets = plant.all ? found : found.slice(0, 1);
    for (const el of targets) fn(el, plant);
    applied.push({ kind: plant.kind, selector: plant.selector, elements: targets.length });
  }
  return { applied, not_found: notFound };
})()
