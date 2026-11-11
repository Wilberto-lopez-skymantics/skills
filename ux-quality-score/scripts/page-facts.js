/*
 * page-facts.js: mechanical measurements of the page currently shown in a browser.
 *
 * Evaluate this file's text in the page (Playwright page.evaluate, a browser automation tool's
 * "run JavaScript" action, or the devtools console) after the screen has settled, once per step and
 * screen size, and save the returned object as facts/<step>.<size>.json. It reads the page and changes
 * nothing. The numbers are measurements for a reviewer to weigh, not verdicts: contrast behind images
 * or gradients is reported as unknown, and nothing here sees keyboard focus or behaviour over time
 * (capture.cjs reads those in its probe pass, with page-probes.js).
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
  // The colour actually behind an element: walk up, stacking translucent layers, stop at the first image.
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

  // Targets: interactive elements and their size.
  const interactive = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=checkbox], [role=switch], [role=menuitem], [onclick], [tabindex]:not([tabindex="-1"])')].filter(visible);
  const under44 = [];
  const under24 = [];
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    const inlineLink = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
    if (inlineLink) continue; // links inside a sentence are exempt from target-size rules
    const item = { element: describe(el), width: Math.round(r.width), height: Math.round(r.height) };
    if (r.width < 24 || r.height < 24) under24.push(item);
    else if (r.width < 44 || r.height < 44) under44.push(item);
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
  for (const el of textElements) {
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
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
    layout: { document_width: docWidth, scrolls_sideways: docWidth > vw + 1, overflowing_elements: overflowing, page_height: document.documentElement.scrollHeight, screens_tall: Math.round((document.documentElement.scrollHeight / vh) * 10) / 10 },
    targets: { interactive_count: interactive.length, smaller_than_24px: cut(under24), between_24_and_44px: cut(under44) },
    labels: { form_fields: fields.length, fields_without_label: cut(unlabeled), fields_with_placeholder_only: cut(placeholderOnly), controls_without_name: cut(unnamedControls), images: images.length, images_without_alt: cut(imagesWithoutAlt), field_edges_below_3_to_1: cut(faintEdges), field_edges_unknown: edgesUnknown, field_types: fieldTypes },
    text: { elements_measured: textElements.length, smallest_font_px: smallest === null ? null : round1(smallest), smaller_than_12px: cut(smallText), sentences_smaller_than_16px: cut(sentencesUnder16), contrast_checked: contrastChecked, contrast_unknown_background: contrastUnknown, below_required_contrast: cut(lowContrast), meets_minimum_but_below_7_to_1: cut(below7), never_filled_in: cut(unfilled) },
    first_window: { height: firstHeight, headings: firstHeadings.slice(0, 10), buttons_and_links: cut(firstActions), form_fields: fields.filter(inFirst).length },
    links: { count: allLinks.length, lead_nowhere: cut(nowhere) },
    head: { title: long(document.title) || null, title_length: document.title.trim().length, description, description_length: description ? description.length : 0, canonical: canonical ? canonical.getAttribute('href') : null, robots: metaOf('meta[name="robots"]'), open_graph: { title: metaOf('meta[property="og:title"]'), description: metaOf('meta[property="og:description"]'), image: metaOf('meta[property="og:image"]'), url: metaOf('meta[property="og:url"]') }, twitter_card: metaOf('meta[name="twitter:card"]'), icon: Boolean(document.querySelector('link[rel~="icon"]')), structured_data_blocks: document.querySelectorAll('script[type="application/ld+json"]').length },
    structure: { lang: document.documentElement.getAttribute('lang') || null, h1_count: headings.filter((h) => h.level === 1).length, headings: headings.slice(0, 40), skipped_heading_levels: skipped, has_main_landmark: Boolean(document.querySelector('main, [role=main]')), has_nav_landmark: Boolean(document.querySelector('nav, [role=navigation]')), viewport_meta: (document.querySelector('meta[name=viewport]') || { content: null }).content, open_dialogs: dialogs }
  };
})()
