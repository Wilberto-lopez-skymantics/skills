#!/usr/bin/env node
'use strict';
/*
 * update-sources.cjs: keep the vendored design sources honest.
 *
 * The files under sources/<id>/ are third-party skill files copied byte for byte from a pinned
 * commit of each source repository, each with its licence. sources/sources.lock.json records the
 * pin, the paths taken and a hash of every file. This script checks the copies against the lock
 * and moves a pin forward.
 *
 * Usage:
 *   node scripts/update-sources.cjs --check
 *       Recompute every hash. Exit 0 when the copies match the lock, 2 on any drift: a file
 *       edited locally, a file missing, or a file the lock does not know.
 *   node scripts/update-sources.cjs --update [--source <id>] [--to <commit>] [--force]
 *       Fetch <commit> (default: the tip of the repository's default branch) with git into a
 *       temporary directory, replace the included paths, rewrite the lock and print which files
 *       changed, were added or were removed, so references/ownership.md and the rubrics under review/roles/
 *       can be reviewed against them. --to needs --source. Refuses (exit 2) when a vendored file
 *       was edited locally, unless --force.
 *
 * Nothing from a fetched repository is ever executed. The fetch goes into a bare repository (no
 * working tree, so no hooks or filters run) and file contents are read as blobs and written as
 * data. Symbolic links and submodules in a source are refused.
 *
 * Needs: Node >= 18 and git on PATH (git only for --update). No npm dependencies.
 * Exit codes: 0 ok, 1 usage or environment error, 2 drift found.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCES_DIR = path.join(ROOT, 'sources');
const LOCK_PATH = path.join(SOURCES_DIR, 'sources.lock.json');
const LICENCE_RE = /^(LICEN[SC]E|COPYING)(\.[A-Za-z0-9]+)?$/i;

function fail(msg) {
  process.stderr.write(`update-sources: ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  const flags = new Set(['check', 'update', 'force', 'help']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    if (flags.has(key)) { out[key] = true; continue; }
    if (key !== 'source' && key !== 'to') fail(`unknown option ${a}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) fail(`${a} needs a value`);
    out[key] = v;
    i++;
  }
  return out;
}

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// Plain code-unit order, so the result never depends on the machine's locale.
function byName(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// One hash over a set of files: for each path in order, the path, a zero byte, the content, a
// zero byte. `files` maps a forward-slash relative path to a Buffer.
function treeHash(files) {
  const h = crypto.createHash('sha256');
  for (const rel of Object.keys(files).sort(byName)) {
    h.update(rel, 'utf8');
    h.update('\0');
    h.update(files[rel]);
    h.update('\0');
  }
  return h.digest('hex');
}

function fileHashes(files) {
  const out = {};
  for (const rel of Object.keys(files).sort(byName)) out[rel] = sha(files[rel]);
  return out;
}

// Every regular file under dir, as { 'a/b.md': Buffer }. Symbolic links are an error.
function readTree(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  const walk = (abs, rel) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const childAbs = path.join(abs, ent.name);
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isSymbolicLink()) fail(`symbolic link in vendored sources: ${childAbs}`);
      if (ent.isDirectory()) walk(childAbs, childRel);
      else if (ent.isFile()) out[childRel] = fs.readFileSync(childAbs);
    }
  };
  walk(dir, '');
  return out;
}

function readLock() {
  if (!fs.existsSync(LOCK_PATH)) fail(`no lock file at ${LOCK_PATH}`);
  let lock;
  try { lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8')); }
  catch (e) { fail(`cannot parse ${LOCK_PATH}: ${e.message}`); }
  if (!lock || !Array.isArray(lock.sources)) fail('lock file has no "sources" list');
  for (const s of lock.sources) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id || '')) fail(`bad source id in lock: ${s.id}`);
    if (!/^https:\/\//.test(s.repo || '')) fail(`source ${s.id}: repo must be an https URL`);
    if (!Array.isArray(s.include) || !s.include.length) fail(`source ${s.id}: empty include list`);
    for (const p of s.include) checkRelPath(p, `source ${s.id} include`);
  }
  return lock;
}

function writeLock(lock) {
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');
}

function checkRelPath(p, what) {
  if (typeof p !== 'string' || !p || p.startsWith('/') || p.includes('\\') || p.includes('\0')
    || p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
    fail(`${what}: unsafe path ${JSON.stringify(p)}`);
  }
}

// What differs between the lock's record of a source and the files on disk.
function compare(source) {
  const dir = path.join(SOURCES_DIR, source.id);
  const disk = fileHashes(readTree(dir));
  const locked = source.files || {};
  const modified = [];
  const missing = [];
  const unexpected = [];
  for (const rel of Object.keys(locked)) {
    if (!(rel in disk)) missing.push(rel);
    else if (disk[rel] !== locked[rel]) modified.push(rel);
  }
  for (const rel of Object.keys(disk)) if (!(rel in locked)) unexpected.push(rel);
  const tree = treeHash(readTree(dir));
  return {
    id: source.id,
    commit: source.commit,
    files: Object.keys(disk).length,
    tree_sha256: tree,
    tree_matches: tree === source.tree_sha256,
    modified: modified.sort(byName),
    missing: missing.sort(byName),
    unexpected: unexpected.sort(byName),
  };
}

function isClean(r) {
  return r.tree_matches && !r.modified.length && !r.missing.length && !r.unexpected.length;
}

function check() {
  const lock = readLock();
  const results = lock.sources.map(compare);
  const ok = results.every(isClean);
  process.stdout.write(JSON.stringify({ ok, sources: results }, null, 2) + '\n');
  process.exit(ok ? 0 : 2);
}

// ---------------------------------------------------------------- update

function git(cwd, args, opts = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    });
  } catch (e) {
    const err = e.stderr ? String(e.stderr).trim() : e.message;
    fail(`git ${args.slice(0, 2).join(' ')} failed: ${err}`);
  }
}

// The files of one source at one commit, read as blobs from a bare repository in a temporary
// directory: the licence at the repository root and everything under the included paths.
function fetchSource(source, wanted) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `interface-craft-${source.id}-`));
  try {
    git(tmp, ['init', '-q', '--bare', '.']);
    git(tmp, ['fetch', '-q', '--depth', '1', source.repo, wanted || 'HEAD']);
    const commit = git(tmp, ['rev-parse', 'FETCH_HEAD']).toString().trim();
    if (wanted && /^[0-9a-f]{40}$/.test(wanted) && commit !== wanted) {
      fail(`source ${source.id}: asked for ${wanted}, fetched ${commit}`);
    }
    const commitDate = git(tmp, ['show', '-s', '--format=%cI', commit]).toString().trim();

    const files = {};
    const modes = {};
    const take = (entries) => {
      for (const e of entries) {
        if (e.mode === '120000') fail(`source ${source.id}: ${e.path} is a symbolic link`);
        if (e.type !== 'blob') fail(`source ${source.id}: ${e.path} is a ${e.type}, not a file`);
        checkRelPath(e.path, `source ${source.id}`);
        files[e.path] = git(tmp, ['cat-file', 'blob', e.sha]);
        modes[e.path] = e.mode === '100755' ? 0o755 : 0o644;
      }
    };

    const rootEntries = lsTree(tmp, commit, false, []);
    const licences = rootEntries.filter((e) => e.type === 'blob' && LICENCE_RE.test(e.path));
    if (!licences.length) {
      fail(`source ${source.id}: no licence file at the root of ${source.repo} at ${commit}; `
        + 'nothing was changed');
    }
    take(licences);

    for (const inc of source.include) {
      const entries = lsTree(tmp, commit, true, [inc]);
      if (!entries.length) {
        fail(`source ${source.id}: included path ${inc} does not exist at ${commit}; `
          + 'nothing was changed. Edit "include" in the lock if the source moved or dropped it.');
      }
      take(entries);
    }
    return { commit, commitDate, files, modes };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function lsTree(repo, commit, recursive, paths) {
  const args = ['ls-tree', '-z'];
  if (recursive) args.push('-r');
  args.push(commit);
  if (paths.length) args.push('--', ...paths);
  return git(repo, args).toString('utf8').split('\0').filter(Boolean).map((line) => {
    const tab = line.indexOf('\t');
    const [mode, type, objectSha] = line.slice(0, tab).split(' ');
    return { mode, type, sha: objectSha, path: line.slice(tab + 1) };
  });
}

function pruneEmptyDirs(dir, keep) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) pruneEmptyDirs(path.join(dir, ent.name), false);
  }
  if (!keep && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
}

function update(args) {
  const lock = readLock();
  if (args.to && !args.source) fail('--to needs --source');
  const targets = args.source ? lock.sources.filter((s) => s.id === args.source) : lock.sources;
  if (!targets.length) {
    fail(`no source "${args.source}" in the lock (have: ${lock.sources.map((s) => s.id).join(', ')})`);
  }

  if (!args.force) {
    const dirty = targets.map(compare).filter((r) => !isClean(r));
    if (dirty.length) {
      process.stdout.write(JSON.stringify({ ok: false, reason: 'local drift', sources: dirty }, null, 2) + '\n');
      process.stderr.write('update-sources: vendored files differ from the lock; restore them or pass --force\n');
      process.exit(2);
    }
  }

  // Fetch everything first, so a failure leaves the working copy untouched.
  const fetched = targets.map((source) => ({ source, got: fetchSource(source, args.to) }));

  const report = [];
  for (const { source, got } of fetched) {
    const dir = path.join(SOURCES_DIR, source.id);
    const before = fileHashes(readTree(dir));
    const after = fileHashes(got.files);
    const changed = [];
    const added = [];
    const removed = [];
    for (const rel of Object.keys(after)) {
      if (!(rel in before)) added.push(rel);
      else if (before[rel] !== after[rel]) changed.push(rel);
    }
    for (const rel of Object.keys(before)) if (!(rel in after)) removed.push(rel);

    for (const rel of removed) fs.rmSync(path.join(dir, rel));
    for (const rel of [...added, ...changed]) {
      const abs = path.join(dir, rel);
      if (!path.resolve(abs).startsWith(path.resolve(dir) + path.sep)) fail(`unsafe path ${rel}`);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, got.files[rel]);
      fs.chmodSync(abs, got.modes[rel]);
    }
    pruneEmptyDirs(dir, true);

    const previous = source.commit;
    source.commit = got.commit;
    source.commit_date = got.commitDate;
    source.files = after;
    source.tree_sha256 = treeHash(got.files);

    report.push({
      id: source.id,
      from: previous,
      to: got.commit,
      commit_date: got.commitDate,
      tree_sha256: source.tree_sha256,
      unchanged: Object.keys(after).length - added.length - changed.length,
      changed: changed.sort(byName),
      added: added.sort(byName),
      removed: removed.sort(byName),
      licence_changed: [...changed, ...added, ...removed].some((rel) => LICENCE_RE.test(rel)),
    });
  }
  writeLock(lock);

  const touched = report.some((r) => r.changed.length || r.added.length || r.removed.length);
  process.stdout.write(JSON.stringify({
    ok: true,
    no_op: !touched,
    sources: report,
    next: touched
      ? 'Review references/ownership.md and the rubrics under review/roles/ '
        + 'against the files listed above: a changed value, a new file or a removed file can move '
        + 'an owner or break a route. A changed licence file needs reading before anything else.'
      : 'Nothing changed.',
  }, null, 2) + '\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args._.length) fail(`unexpected argument ${args._[0]}`);
  if (args.help || (!args.check && !args.update)) {
    process.stdout.write('usage: update-sources.cjs --check | --update [--source <id>] [--to <commit>] [--force]\n');
    process.exit(args.help ? 0 : 1);
  }
  if (args.check && args.update) fail('pick one of --check and --update');
  if (args.check) check();
  else update(args);
}

if (require.main === module) main();
else module.exports = { treeHash, fileHashes, readTree, sha };
