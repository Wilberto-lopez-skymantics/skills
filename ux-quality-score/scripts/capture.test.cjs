'use strict';
// Tests of capture.cjs against a small local page, with a real Chrome or Edge:
//   node --test scripts/capture.test.cjs
// Skipped when no browser is installed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { findBrowser, fromEnv, isLocalHost } = require('./capture.cjs');

const UXQ = path.join(__dirname, 'uxq.cjs');
const CAPTURE = path.join(__dirname, 'capture.cjs');
const browser = findBrowser(null);
const SECRET = 'not-a-real-password-91';

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Test desk</title>
<style>body{font-family:sans-serif;margin:0;padding:16px;color:#111;background:#fff} .wide{display:none} @media (min-width:800px){.wide{display:block}} button,input{min-height:44px;font-size:16px;display:block;margin:8px 0} #pw{min-height:0;height:30px} button:focus-visible{outline:4px solid #06c}</style></head>
<body><main><h1>Sign in to the desk</h1>
<form id="f"><label for="who">Name</label><input id="who"><label for="pw">Password</label><input id="pw" type="password"><button type="submit">Continue</button></form>
<p id="out" hidden></p><p class="wide">Wide layout only</p><aside id="demo">Demo accounts <button type="button">Sign in as Ada</button></aside></main>
<script>document.getElementById('f').addEventListener('submit', function (e) { e.preventDefault(); var o = document.getElementById('out'); o.hidden = false; o.textContent = 'Welcome ' + document.getElementById('who').value + ', password length ' + document.getElementById('pw').value.length; });</script>
</body></html>`;

// A second page for what a still picture cannot show: states, focus, motion.
const PROBE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Probe desk</title>
<style>
body{font-family:sans-serif;margin:0;padding:16px;color:#111;background:#fff}
button,input,a{font-size:16px;margin:8px 0}
.primary{display:block;min-height:44px;padding:0 16px;border:0;border-radius:8px;background:#0b5fff;color:#fff;transition:background-color 200ms ease-out, transform 120ms ease-out}
.primary:hover{background:#0847c2}
.primary:active{transform:scale(.97)}
.primary:focus-visible{outline:3px solid #111;outline-offset:2px}
.quiet{display:inline-block;color:#0b5fff}
.quiet:focus{outline:none}
.flat{display:block;min-height:44px;padding:0 16px;border:1px solid #888;background:#eee;color:#111}
.flat:focus{outline:none}
.flat:focus-visible{box-shadow:0 0 0 3px #0b5fff}
#panel{position:fixed;right:0;top:0;width:240px;height:100%;background:#222;color:#fff;padding:16px;transform:translateX(100%);transition:transform 300ms ease-out}
#panel.open{transform:none}
.spin{width:24px;height:24px;border:3px solid #ccc;border-top-color:#0b5fff;border-radius:50%;animation:turn 1s linear infinite}
@keyframes turn{to{transform:rotate(360deg)}}
.card{padding:12px;border:1px solid #ccc;transition:all 400ms ease-in}
@media (prefers-reduced-motion: reduce){#panel{transition:none}}
.fake{display:inline-block;padding:8px;background:#ddd;cursor:pointer}
</style></head>
<body><main><h1>Probe desk</h1>
<button class="primary" type="button" id="open">Open panel</button>
<a class="quiet" href="#somewhere">Read the terms</a>
<label for="who">Name</label><input id="who">
<button class="flat" type="button">Save</button>
<button class="flat" type="button" disabled>Send</button>
<div class="fake" onclick="void 0">Archive</div>
<div class="spin" aria-hidden="true"></div>
<div class="card">A card</div>
<button class="flat" type="button" tabindex="1">Early</button>
<div id="panel"><p>Panel content</p><button class="flat" type="button" id="close">Close</button></div>
</main>
<script>document.getElementById('open').addEventListener('click', function () { document.getElementById('panel').classList.add('open'); });</script>
</body></html>`;

// A third page, several windows tall: something that appears only once it has been scrolled to, and
// what a page says about itself in its head.
const LONG_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Long desk: one page, one offer</title>
<meta name="description" content="A sample page that is several windows tall."><link rel="canonical" href="https://example.test/long"><link rel="icon" href="data:,">
<meta property="og:title" content="Long desk"><meta property="og:image" content="https://example.test/card.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>
<style>body{font-family:sans-serif;margin:0;color:#111;background:#fff} section{min-height:900px;padding:16px} a.go{display:inline-block;min-height:44px;line-height:44px;padding:0 16px;background:#0b5fff;color:#fff}</style></head>
<body><main><section><h1>One offer, said once</h1><p>It costs {{price}} a month.</p><a class="go" href="/start">Start now</a> <a href="#">More</a></section>
<section><h2>How it works</h2><p>Three steps.</p></section>
<section id="late"><h2>What people say</h2><p id="proof">Waiting to be seen</p></section>
<section><h2>Questions</h2><p>Lorem ipsum dolor sit amet.</p><a class="go" href="/start">Start now</a></section></main>
<script>new IntersectionObserver(function (entries) { entries.forEach(function (e) { if (e.isIntersecting) document.getElementById('proof').textContent = 'Shown once scrolled to'; }); }).observe(document.getElementById('late'));</script>
</body></html>`;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(req.url.startsWith('/probe') ? PROBE_PAGE : req.url.startsWith('/long') ? LONG_PAGE : PAGE); });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// The page server lives in this process, so the driver must not be run synchronously.
function run(script, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...env } });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}
const pngSize = (file) => { const b = fs.readFileSync(file); assert.strictEqual(b.slice(1, 4).toString(), 'PNG'); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };

function setup(port) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxq-capture-'));
  const home = path.join(root, 'quality', 'ux');
  fs.mkdirSync(home, { recursive: true });
  const config = {
    app: { name: 'Test desk', description: 'A sample product for the test.' },
    viewports: [{ id: 'phone', width: 375, height: 700, touch: true }, { id: 'desktop', width: 1000, height: 700 }],
    personas: [{ id: 'member', description: 'A member who signs in once a month, on a phone.', viewport: 'phone' }],
    units: [
      { id: 'sign-in', persona: 'member', goal: 'Sign in.',
        steps: [{ id: '01-form', do: 'Opens the sign-in page.' }, { id: '02-welcome', do: 'Types name and password and presses Continue.' }, { id: '03-focus', do: 'Presses Tab until the button has focus.', roles: ['accessibility', 'interaction'] }] },
      { id: 'control-sign-in', persona: 'member', goal: 'Sign in.', viewports: ['phone'], roles: ['accessibility'], control: true,
        planted: [{ id: 'faint-heading', role: 'accessibility', criterion: 'A1', step: '01-form' }], steps: [{ id: '01-form', do: 'Opens the sign-in page.' }] }
    ]
  };
  const plan = {
    base_url: `http://127.0.0.1:${port}`, settle_ms: 50,
    flows: { open: [{ goto: '/' }, { wait_for: 'text=Sign in to the desk' }] },
    units: {
      'sign-in': { steps: {
        '01-form': [{ use: 'open' }],
        '02-welcome': [{ fill: ['label=Name', 'Ada'] }, { fill: ['#pw', '${UXQ_TEST_SECRET}'] }, { click: 'text=Continue' }, { wait_for: 'text=Welcome Ada' }],
        '03-focus': [{ click: 'h1' }, { press: 'Tab', times: 3 }]
      } },
      'control-sign-in': { steps: { '01-form': [{ use: 'open' }, { plant: [{ kind: 'low_contrast', selector: 'h1' }] }] } }
    }
  };
  const configFile = path.join(home, 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(home, 'capture.json'), JSON.stringify(plan, null, 2));
  const created = JSON.parse(spawnSync(process.execPath, [UXQ, 'new-run', '--config', configFile, '--commit', 'abc1234', '--date', '2026-01-15'], { encoding: 'utf8' }).stdout);
  return { root, home, configFile, plan, runDir: created.run_dir };
}

test('helpers: local addresses and values read from the environment', () => {
  assert.ok(isLocalHost('localhost') && isLocalHost('127.0.0.1') && isLocalHost('app.localhost') && isLocalHost('shop.test'));
  assert.ok(!isLocalHost('example.com') && !isLocalHost('localhost.example.com'));
  process.env.UXQ_TEST_VALUE = 'abc';
  assert.strictEqual(fromEnv('x-${UXQ_TEST_VALUE}'), 'x-abc');
  assert.throws(() => fromEnv('${UXQ_TEST_MISSING_VALUE}'), /UXQ_TEST_MISSING_VALUE is not set/);
});

test('captures every step at every size, at the true width, and plants control defects', { skip: browser ? false : 'no Chrome or Edge installed' }, async () => {
  const server = await startServer();
  const t = setup(server.address().port);
  try {
    const args = ['--config', t.configFile, '--run', t.runDir];
    const first = await run(CAPTURE, args, { UXQ_TEST_SECRET: SECRET });
    assert.strictEqual(first.status, 0, first.stderr + first.stdout);
    const out = JSON.parse(first.stdout);
    assert.strictEqual(out.captured, 6, 'three steps at each of two screen sizes');
    assert.deepStrictEqual(out.failures, []);
    assert.deepStrictEqual(out.skipped.map((s) => s.unit), ['control-sign-in']);
    assert.ok(!first.stdout.includes(SECRET), 'a value read from the environment is never printed');

    const ev = path.join(t.runDir, 'evidence', 'sign-in');
    // The picture is exactly as wide as the configured screen, and the page was really laid out at that width.
    assert.strictEqual(pngSize(path.join(ev, 'screens', '01-form.phone.png')).width, 375);
    assert.strictEqual(pngSize(path.join(ev, 'screens', '01-form.desktop.png')).width, 1000);
    assert.ok(pngSize(path.join(ev, 'screens', '02-welcome.phone.png')).height >= 700);
    const facts = JSON.parse(fs.readFileSync(path.join(ev, 'facts', '01-form.phone.json'), 'utf8'));
    assert.deepStrictEqual(facts.measured_at.viewport, { width: 375, height: 700 });
    assert.strictEqual(facts.layout.scrolls_sideways, false);
    assert.strictEqual(facts.labels.form_fields, 2);
    assert.ok(fs.readFileSync(path.join(ev, 'pages', '01-form.desktop.txt'), 'utf8').includes('Wide layout only'));
    assert.ok(!fs.readFileSync(path.join(ev, 'pages', '01-form.phone.txt'), 'utf8').includes('Wide layout only'));
    // Typing, a value from the environment, a click by visible text, and waiting for the result.
    assert.match(fs.readFileSync(path.join(ev, 'pages', '02-welcome.phone.txt'), 'utf8'), new RegExp(`Welcome Ada, password length ${SECRET.length}`));
    // What was typed into a field never reaches the evidence, even for a field the measurements list.
    const welcomeFacts = fs.readFileSync(path.join(ev, 'facts', '02-welcome.phone.json'), 'utf8');
    assert.ok(JSON.parse(welcomeFacts).targets.between_24_and_44px.examples.some((e) => e.element.startsWith('input#pw')), 'the password field is among the measured controls');
    for (const kind of ['facts', 'pages']) for (const f of fs.readdirSync(path.join(ev, kind))) assert.ok(!fs.readFileSync(path.join(ev, kind, f), 'utf8').includes(SECRET), `${kind}/${f} must not contain the typed password`);
    // The focus step, for the accessibility and interaction reviewers only, is captured at both sizes; the earlier steps were replayed to reach it.
    assert.ok(fs.existsSync(path.join(ev, 'screens', '03-focus.phone.png')) && fs.existsSync(path.join(ev, 'screens', '03-focus.desktop.png')));
    assert.ok(fs.readFileSync(path.join(ev, 'pages', '03-focus.desktop.txt'), 'utf8').includes('Welcome Ada'));

    // With the evidence in place, bundling goes ahead for the real journey.
    const bundled = spawnSync(process.execPath, [UXQ, 'bundle', ...args, '--unit', 'sign-in', '--tmp', path.join(t.root, 'tmp')], { encoding: 'utf8' });
    assert.strictEqual(bundled.status, 0, bundled.stderr);
    assert.strictEqual(JSON.parse(bundled.stdout).length, 12, 'six roles, two reviewers each');

    // Something a real user would never see is on these screens. Named in the plan, it stops the capture...
    const writePlan = () => fs.writeFileSync(path.join(t.home, 'capture.json'), JSON.stringify(t.plan));
    const notesFile = path.join(t.runDir, 'capture-notes.json');
    assert.ok(fs.readFileSync(path.join(ev, 'pages', '01-form.phone.txt'), 'utf8').includes('Demo accounts'));
    assert.ok(!fs.existsSync(notesFile), 'nothing hidden, nothing noted');
    t.plan.not_product = [{ selector: '#demo', what: 'demo accounts' }];
    writePlan();
    const stopped = await run(CAPTURE, [...args, '--unit', 'sign-in'], { UXQ_TEST_SECRET: SECRET });
    assert.strictEqual(stopped.status, 2);
    assert.match(JSON.parse(stopped.stdout).failures[0].error, /on screen but not part of the product: demo accounts \(#demo\)/);
    // ...unless the plan says to hide it, and then the run keeps a note of every screen it was hidden on.
    t.plan.not_product[0].if_found = 'hide';
    writePlan();
    const hid = await run(CAPTURE, [...args, '--unit', 'sign-in'], { UXQ_TEST_SECRET: SECRET });
    assert.strictEqual(hid.status, 0, hid.stderr + hid.stdout);
    assert.strictEqual(JSON.parse(hid.stdout).hidden.length, 6, 'hidden on all three steps at both sizes, also later in the same page');
    for (const f of fs.readdirSync(path.join(ev, 'pages'))) assert.ok(!fs.readFileSync(path.join(ev, 'pages', f), 'utf8').includes('Demo accounts'), `${f} no longer shows it`);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(ev, 'facts', '01-form.phone.json'), 'utf8')).targets.interactive_count, facts.targets.interactive_count - 1, 'nor do the measurements');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(notesFile, 'utf8')).hidden[0], { unit: 'sign-in', step: '01-form', size: 'phone', what: 'demo accounts', selector: '#demo', elements: 1 });
    t.plan.not_product = [{ selector: '#demo' }];
    writePlan();
    assert.match((await run(CAPTURE, args)).stderr, /not_product 1: needs "what"/);
    delete t.plan.not_product;
    writePlan();

    // The control unit is captured only on request, with its defect planted, and never a second time.
    const controls = await run(CAPTURE, [...args, '--controls', '--unit', 'control-sign-in']);
    assert.strictEqual(controls.status, 0, controls.stderr + controls.stdout);
    assert.deepStrictEqual(JSON.parse(controls.stdout).planted, [{ unit: 'control-sign-in', size: 'phone', kind: 'low_contrast', selector: 'h1', elements: 1 }]);
    const planted = JSON.parse(fs.readFileSync(path.join(t.home, 'controls', 'control-sign-in', 'facts', '01-form.phone.json'), 'utf8'));
    assert.ok(planted.text.below_required_contrast.examples.some((e) => e.element.startsWith('h1')), 'the measurements see the planted defect');
    assert.strictEqual(facts.text.below_required_contrast.count, 0, 'and the real page has none');
    const again = await run(CAPTURE, [...args, '--controls', '--unit', 'control-sign-in']);
    assert.match(JSON.parse(again.stdout).skipped[0].why, /must stay the same/);

    // A plan that cannot be followed stops that pass, says which action failed, and keeps a picture.
    t.plan.units['sign-in'].steps['02-welcome'] = [{ fill: ['label=Name', 'Ada'] }, { click: '#no-such-button' }];
    t.plan.timeout_ms = 600;
    fs.writeFileSync(path.join(t.home, 'capture.json'), JSON.stringify(t.plan));
    const broken = await run(CAPTURE, args, { UXQ_TEST_SECRET: SECRET });
    assert.strictEqual(broken.status, 2);
    const report = JSON.parse(broken.stdout);
    assert.strictEqual(report.failures.length, 2, 'one per screen size');
    assert.strictEqual(report.failures[0].step, '02-welcome');
    assert.match(report.failures[0].error, /waiting for "#no-such-button" to appear/);
    assert.ok(fs.existsSync(report.failures[0].stopped_at));

    // A remote address is refused unless explicitly allowed.
    t.plan.base_url = 'https://example.com';
    fs.writeFileSync(path.join(t.home, 'capture.json'), JSON.stringify(t.plan));
    const remote = await run(CAPTURE, args);
    assert.strictEqual(remote.status, 1);
    assert.match(remote.stderr, /not a local address/);
  } finally {
    server.close();
    fs.rmSync(t.root, { recursive: true, force: true });
  }
});

test('probes: where Tab goes, how controls answer, what moves, and frames of a step that moves', { skip: browser ? false : 'no Chrome or Edge installed' }, async () => {
  const server = await startServer();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxq-probes-'));
  try {
    const home = path.join(root, 'quality', 'ux');
    fs.mkdirSync(home, { recursive: true });
    const config = {
      app: { name: 'Probe desk', description: 'A sample product for the test.' },
      viewports: [{ id: 'phone', width: 375, height: 700, touch: true }, { id: 'desktop', width: 1000, height: 700 }],
      personas: [{ id: 'member', description: 'A member who opens the panel now and then.', viewport: 'phone' }],
      units: [{ id: 'panel', persona: 'member', goal: 'Open the panel.', steps: [{ id: '01-page', do: 'Opens the page.' }, { id: '02-panel', do: 'Types a name and opens the panel.' }] }]
    };
    const plan = {
      base_url: `http://127.0.0.1:${server.address().port}`, settle_ms: 50,
      units: { panel: { motion_steps: ['02-panel'], steps: {
        '01-page': [{ goto: '/probe' }, { wait_for: 'text=Probe desk' }],
        '02-panel': [{ fill: ['label=Name', '${UXQ_TEST_SECRET}'] }, { click: 'text=Open panel' }, { wait_for: 'text=Panel content' }]
      } } }
    };
    const configFile = path.join(home, 'config.json');
    const writePlan = () => fs.writeFileSync(path.join(home, 'capture.json'), JSON.stringify(plan));
    fs.writeFileSync(configFile, JSON.stringify(config));
    writePlan();
    const runDir = JSON.parse(spawnSync(process.execPath, [UXQ, 'new-run', '--config', configFile, '--commit', 'abc1234', '--date', '2026-01-15'], { encoding: 'utf8' }).stdout).run_dir;
    const args = ['--config', configFile, '--run', runDir];
    const first = await run(CAPTURE, args, { UXQ_TEST_SECRET: SECRET });
    assert.strictEqual(first.status, 0, first.stderr + first.stdout);
    const out = JSON.parse(first.stdout);
    assert.strictEqual(out.captured, 4, 'the probe pass adds no screens');
    assert.deepStrictEqual(out.probes, [{ unit: 'panel', size: 'desktop', steps: 2, kinds: ['keyboard', 'states', 'motion', 'frames'] }], 'once per journey, at the first size without touch');
    assert.deepStrictEqual(out.probe_notes, []);
    const ev = path.join(runDir, 'evidence', 'panel');
    const read = (file) => JSON.parse(fs.readFileSync(path.join(ev, file), 'utf8'));

    // The keyboard walk: every stop in order, what shows focus there, and what Tab cannot get to.
    const keys = read('keyboard/01-page.desktop.json');
    assert.deepStrictEqual(keys.stops.map((s) => s.element), ['button "Early"', 'button#open "Open panel"', 'a "Read the terms"', 'input#who "Name"', 'button "Save"', 'button#close "Close"']);
    assert.match(keys.ended, /came back to stop 1/);
    assert.deepStrictEqual(keys.summary.nothing_shows_focus, { count: 1, examples: ['stop 3 a "Read the terms"'] }, 'outline: none and nothing in its place');
    assert.deepStrictEqual(keys.stops[1].focus_shown_by, { kind: 'outline', on: 'itself', width_px: 3, contrast_with_surroundings: keys.stops[1].focus_shown_by.contrast_with_surroundings });
    assert.ok(keys.stops[1].focus_shown_by.contrast_with_surroundings > 10);
    assert.strictEqual(keys.stops[4].focus_shown_by.kind, 'shadow', 'a ring drawn with a shadow counts');
    assert.strictEqual(keys.summary.order_goes_backwards.count, 1, 'a positive tabindex pulls the last button to the front');
    assert.deepStrictEqual(keys.summary.focus_on_something_not_drawn.examples, ['stop 6 button#close "Close"'], 'the closed panel is off screen and still takes focus');
    assert.deepStrictEqual(keys.summary.looks_clickable_but_is_not_a_control.examples, ['div "Archive"']);
    assert.strictEqual(keys.summary.never_reached.count, 0, 'a disabled button is not expected to take focus');
    assert.strictEqual(read('keyboard/02-panel.desktop.json').summary.focus_on_something_not_drawn.count, 0, 'with the panel open its button is on screen');

    // Control states: one of each kind of control, the styles of each state applied without clicking anything.
    const states = read('states/01-page.desktop.json');
    assert.deepStrictEqual(states.controls.map((c) => c.element), ['button#open "Open panel"', 'button "Save"', 'input#who "Name"', 'a "Read the terms"']);
    const [primary, flat, , link] = states.controls;
    assert.deepStrictEqual(primary.no_change_on, []);
    assert.deepStrictEqual(primary.changes.hover, ['background-color on itself']);
    assert.ok(primary.changes.pressed.includes('transform on itself'));
    assert.deepStrictEqual(flat.no_change_on, ['hover', 'pressed']);
    assert.deepStrictEqual(link.no_change_on, ['hover', 'focus', 'pressed']);
    const picture = (file) => fs.readFileSync(path.join(ev, file));
    assert.ok(!picture(primary.pictures.rest).equals(picture(primary.pictures.hover)), 'the hovered picture really shows the hovered look');
    assert.ok(!picture(primary.pictures.rest).equals(picture(primary.pictures.focus)));
    assert.ok(picture(link.pictures.rest).equals(picture(link.pictures.focus)), 'and a state with no change looks the same');
    assert.ok(pngSize(path.join(ev, primary.pictures.rest)).width < 300, 'a picture of the control, not of the page');
    assert.deepStrictEqual(states.disabled.map((c) => c.element), ['button "Send"']);
    assert.ok(!fs.existsSync(path.join(ev, 'states', '02-panel.desktop.json')), 'kinds of control already shown are not shown again');
    assert.match(fs.readFileSync(path.join(ev, 'pages', '02-panel.desktop.txt'), 'utf8'), /Panel content/);

    // Motion: what the styles declare, and what is left of it for someone who asked for less.
    const motion = read('motion/01-page.desktop.json');
    assert.deepStrictEqual(motion.measured_at, { size: 'desktop', viewport: { width: 1000, height: 700 }, motion: 'on' });
    const all = motion.transitions.find((t) => t.properties === 'all');
    assert.deepStrictEqual([all.duration_ms, all.notes], [400, ['every property is animated (transition: all)', 'starts slowly (ease-in)']]);
    assert.deepStrictEqual(motion.animations.map((a) => [a.name, a.repeats]), [['turn', 'forever']]);
    assert.strictEqual(motion.running_now[0].what, 'turn');
    assert.strictEqual(motion.with_reduced_motion.elements_that_can_move_normally, 4);
    assert.strictEqual(motion.with_reduced_motion.elements_that_can_still_move, 3, 'only the panel honours the preference');
    assert.ok(!motion.with_reduced_motion.transitions_that_move.some((t) => t.examples[0].startsWith('div#panel')));
    assert.strictEqual(motion.layout_shift.unexpected.count, 0);

    // Frames: pictures while the step's last click plays out.
    const frames = read('frames/02-panel.desktop.json');
    assert.strictEqual(frames.after, 'a click on text=Open panel');
    assert.ok(frames.frames.length >= 3 && frames.frames.length <= 7, `${frames.frames.length} frames`);
    assert.strictEqual(frames.frames[0].when, 'before');
    assert.strictEqual(frames.frames[frames.frames.length - 1].when, 'after the screen settled');
    for (const f of frames.frames) assert.deepStrictEqual(pngSize(path.join(ev, f.file)), { width: 1000, height: 700 });
    assert.ok(!fs.existsSync(path.join(ev, 'frames', '01-page.desktop.json')), 'only for the steps the plan names');

    // Every file is named <step>.<size>.…, and what was typed never reaches the new evidence.
    for (const kind of ['keyboard', 'states', 'motion', 'frames']) {
      for (const f of fs.readdirSync(path.join(ev, kind))) {
        assert.match(f, /^0[12]-(page|panel)\.desktop\./);
        if (f.endsWith('.json')) assert.ok(!fs.readFileSync(path.join(ev, kind, f), 'utf8').includes(SECRET), `${kind}/${f} must not contain what was typed`);
      }
    }

    // The plan can ask for fewer probes, or none; evidence from an earlier capture does not stay behind.
    plan.units.panel.probes = ['keyboard'];
    writePlan();
    const fewer = JSON.parse((await run(CAPTURE, args, { UXQ_TEST_SECRET: SECRET })).stdout);
    assert.deepStrictEqual(fewer.probes[0].kinds, ['keyboard']);
    assert.ok(fs.existsSync(path.join(ev, 'keyboard')) && !fs.existsSync(path.join(ev, 'states')) && !fs.existsSync(path.join(ev, 'frames')));
    delete plan.units.panel.probes;
    plan.probes = false;
    writePlan();
    const none = JSON.parse((await run(CAPTURE, args, { UXQ_TEST_SECRET: SECRET })).stdout);
    assert.deepStrictEqual([none.captured, none.probes], [4, []]);
    assert.ok(!fs.existsSync(path.join(ev, 'keyboard')));

    // A plan that asks for the impossible is refused before the browser starts.
    plan.probes = ['sound'];
    writePlan();
    assert.match((await run(CAPTURE, args)).stderr, /probes/);
    delete plan.probes;
    plan.units.panel.motion_steps = ['01-page'];
    writePlan();
    assert.match((await run(CAPTURE, args)).stderr, /motion step "01-page" needs a click, press, hover or select action/);
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a long page: the first window pictured alone, scrolled through before the whole page is pictured, and what the page says in its head', { skip: browser ? false : 'no Chrome or Edge installed' }, async () => {
  const server = await startServer();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uxq-long-'));
  try {
    const home = path.join(root, 'quality', 'ux');
    fs.mkdirSync(home, { recursive: true });
    const steps = [{ id: '01-arrive', do: 'Opens the page.' }, { id: '02-read', do: 'Scrolls down the page.' }];
    const config = {
      app: { name: 'Long desk', description: 'A sample page for the test.' },
      viewports: [{ id: 'phone', width: 375, height: 700, touch: true }, { id: 'desktop', width: 1000, height: 700 }],
      personas: [{ id: 'visitor', description: 'Someone who followed a link, on a phone.', viewport: 'phone' }],
      units: [{ id: 'visit', persona: 'visitor', goal: 'See what is offered.', steps }, { id: 'glance', persona: 'visitor', goal: 'See what is offered.', viewports: ['phone'], steps }]
    };
    const arrive = [{ goto: '/long' }, { wait_for: 'text=One offer, said once' }];
    const plan = {
      base_url: `http://127.0.0.1:${server.address().port}`, settle_ms: 50, probes: false,
      units: {
        visit: { window_steps: ['01-arrive'], steps: { '01-arrive': arrive, '02-read': [{ scroll: 'through' }] } },
        glance: { steps: { '01-arrive': arrive, '02-read': [{ wait_ms: 10 }] } }
      }
    };
    const configFile = path.join(home, 'config.json');
    const writePlan = () => fs.writeFileSync(path.join(home, 'capture.json'), JSON.stringify(plan));
    fs.writeFileSync(configFile, JSON.stringify(config));
    writePlan();
    const runDir = JSON.parse(spawnSync(process.execPath, [UXQ, 'new-run', '--config', configFile, '--commit', 'abc1234', '--date', '2026-01-15'], { encoding: 'utf8' }).stdout).run_dir;
    const args = ['--config', configFile, '--run', runDir];
    const first = await run(CAPTURE, args);
    assert.strictEqual(first.status, 0, first.stderr + first.stdout);
    assert.deepStrictEqual(JSON.parse(first.stdout).failures, []);
    const ev = path.join(runDir, 'evidence', 'visit');
    const text = (unit, file) => fs.readFileSync(path.join(runDir, 'evidence', unit, 'pages', file), 'utf8');

    // A step named under window_steps is pictured as the window alone; every other step is the whole page.
    for (const size of [['phone', 375], ['desktop', 1000]]) {
      assert.deepStrictEqual(pngSize(path.join(ev, 'screens', `01-arrive.${size[0]}.png`)), { width: size[1], height: 700 });
      assert.ok(pngSize(path.join(ev, 'screens', `02-read.${size[0]}.png`)).height >= 3600, 'four sections of 900px');
    }
    assert.ok(pngSize(path.join(runDir, 'evidence', 'glance', 'screens', '01-arrive.phone.png')).height >= 3600, 'without window_steps, the whole page as before');

    // Scrolling through makes what waits to be seen appear, and ends back at the top.
    assert.ok(text('visit', '01-arrive.phone.txt').includes('Waiting to be seen'));
    assert.ok(text('visit', '02-read.phone.txt').includes('Shown once scrolled to') && text('visit', '02-read.desktop.txt').includes('Shown once scrolled to'));
    assert.ok(text('glance', '02-read.phone.txt').includes('Waiting to be seen'), 'and a page that was not scrolled is pictured as it stood');

    // The measurements say what is in the first window, what the head holds, and what was left unfinished.
    const facts = JSON.parse(fs.readFileSync(path.join(ev, 'facts', '01-arrive.phone.json'), 'utf8'));
    assert.strictEqual(facts.first_window.height, 700);
    assert.deepStrictEqual(facts.first_window.headings, [{ level: 1, text: 'One offer, said once' }]);
    assert.deepStrictEqual([facts.first_window.buttons_and_links.count, facts.first_window.form_fields], [2, 0]);
    assert.ok(facts.first_window.buttons_and_links.examples[0].element.includes('Start now'));
    assert.ok(facts.layout.screens_tall > 5 && facts.layout.screens_tall < 6, `${facts.layout.screens_tall} windows tall`);
    assert.deepStrictEqual(facts.links, { count: 3, lead_nowhere: { count: 1, examples: facts.links.lead_nowhere.examples } });
    assert.ok(facts.links.lead_nowhere.examples[0].includes('More'));
    assert.deepStrictEqual(facts.text.never_filled_in, { count: 2, examples: ['{{price}}', 'Lorem ipsum'] });
    assert.deepStrictEqual(facts.head, {
      title: 'Long desk: one page, one offer', title_length: 30, description: 'A sample page that is several windows tall.', description_length: 43,
      canonical: 'https://example.test/long', robots: null,
      open_graph: { title: 'Long desk', description: null, image: 'https://example.test/card.png', url: null },
      twitter_card: null, icon: true, structured_data_blocks: 1
    });

    // A plan that asks for what the driver cannot do is refused before the browser starts.
    plan.units.visit.steps['02-read'] = [{ scroll: 'down' }];
    writePlan();
    assert.match((await run(CAPTURE, args)).stderr, /scroll takes "through"/);
    plan.units.visit.steps['02-read'] = [{ scroll: 'through' }];
    plan.units.visit.window_steps = ['09-nowhere'];
    writePlan();
    assert.match((await run(CAPTURE, args)).stderr, /window_steps names "09-nowhere", which has no actions in the plan/);
    plan.units.visit.window_steps = '01-arrive';
    writePlan();
    assert.match((await run(CAPTURE, args)).stderr, /window_steps must be a list of step ids/);
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
