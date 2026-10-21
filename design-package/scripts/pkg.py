#!/usr/bin/env python3
"""Helper for the design-package skill. Standard library only.

Subcommands (run from anywhere inside the repo):
  fingerprint [--rev REV] [--out FILE]   Fingerprint the SDD spec set (working tree, or a git revision).
  index       [--out FILE]               Parse the design package into an index (ids, sources, links, counts).
  impact      [--rev REV] [--json]       What changed in the spec set since the manifest's baseline, and which
                                         package items and diagrams that touches. Also prints next free ids.
  check       [--strict]                 Consistency checks on the package against the current spec set.
                                         Exit 1 on errors (and on warnings with --strict).
  stamp       --revision N [--rev REV] [--date YYYY-MM-DD] [--note TEXT]
                                         Write manifest.json: baseline fingerprint, id registry, diagram map.
  compile     [--pdf]                    Compile markdown chapters and SVG diagrams into index.html (and PDF).
  derive      [--write]                  Regenerate the derived chapters and blocks from the spec set: 09-change-control.md,
                                         10-verification-status.md, 11-ui-design.md, the GAPS.md block in 08-open-items.md
                                         and the VCRM block in 07-traceability.md (print a diff summary without --write).
  verify      [--json]                   Per-requirement verification status from the oracle cases, UI specs and the
                                         latest run reports (what 10-verification-status.md is built from).
  review      --resolve [RC-nn] | --draft RC-nn --kind scr|gap
                                         Review loop: resolve a review comment's targets to their sources, or draft the
                                         change request it asks for under specs/changes/review/ (never touching specs/).

Conventions parsed here are documented in ../references/package-format.md. Keep the two in sync.
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys

PKG_DIR = 'docs/design-package'
SPEC = 'specs/SPEC.md'
DECLOG = 'specs/DECISION_LOG.md'
DESIGN = 'specs/DESIGN.md'
SPEC_MODULES_DIR = 'specs/spec'
GAPS = 'specs/GAPS.md'
CHANGES_DIR = 'specs/changes'
BACKPROP = 'specs/backprop-log.md'
TRANSITIONS = 'specs/logs/transitions.jsonl'
PROTOTYPE_RECORD = 'specs/logs/02-prototype.md'
RULINGS = 'specs/logs/03-rulings.md'
ORACLE_LOGS = 'specs/logs/oracle'
UI_REPORT = 'specs/logs/ui-e2e.json'
CASES_DIR = 'specs/fixtures/cases'
UI_SPECS_DIR = 'specs/fixtures/ui'
WIREFRAMES_DIR = 'specs/wireframes'
EXTRA_FILES = ['specs/logs/roadmap.md', 'specs/logs/01-sme-review.md', GAPS, BACKPROP, TRANSITIONS, PROTOTYPE_RECORD, RULINGS]
TREE_DIRS = ['specs/contracts', 'specs/fixtures', 'specs/wireframes', CHANGES_DIR, SPEC_MODULES_DIR]
LOCK = 'specs/spec.lock.json'
REVIEW_DRAFTS_DIR = 'specs/changes/review'

REQ_FILE = '02-system-requirements.md'
DD_FILE = '03-design-decisions.md'
IF_FILE = '06-external-interfaces.md'
TRACE_FILE = '07-traceability.md'
OPEN_FILE = '08-open-items.md'
CHANGE_FILE = '09-change-control.md'
VERIFY_FILE = '10-verification-status.md'
UI_FILE = '11-ui-design.md'
REVIEW_FILE = '12-review-log.md'
README = 'README.md'
DERIVED_BANNER = '> **Derived by `pkg.py derive`; do not edit by hand.** Regenerated from the spec set at every revision; '

VERIFY_METHODS = ('Test', 'Demonstration', 'Analysis', 'Inspection')
DESIGN_TERMS = ['PostgreSQL', 'PostGIS', 'TypeScript', 'Node.js', 'React', 'MapLibre', 'deck.gl',
                'worker thread', 'partition', 'monolith', 'SQL']


# ---------------------------------------------------------------- helpers
def h(text):
    """Short content hash, insensitive to trailing whitespace and line endings."""
    t = '\n'.join(line.rstrip() for line in text.replace('\r\n', '\n').split('\n')).strip('\n')
    return hashlib.sha256(t.encode('utf-8')).hexdigest()[:12]


def git(root, *args):
    r = subprocess.run(['git', '-C', root, *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def repo_root(start=None):
    root = git(start or os.getcwd(), 'rev-parse', '--show-toplevel')
    if not root:
        sys.exit('pkg.py: not inside a git repository')
    return root


def read_bytes(root, path, rev=None):
    """File bytes from the working tree, or from a git revision (None if absent)."""
    if rev:
        r = subprocess.run(['git', '-C', root, 'show', f'{rev}:{path}'], capture_output=True)
        return r.stdout if r.returncode == 0 else None
    p = os.path.join(root, path)
    return open(p, 'rb').read() if os.path.exists(p) else None


def read(root, path, rev=None):
    """File text from the working tree, or from a git revision (None if absent). Binary content never
    raises: undecodable bytes are replaced (such files are only ever hashed, see fingerprint)."""
    b = read_bytes(root, path, rev)
    return b.decode('utf-8', errors='replace') if b is not None else None


def hb(data):
    """Short hash of bytes (binary files in the spec tree: fonts, images)."""
    return hashlib.sha256(data).hexdigest()[:12]


def list_tree(root, d, rev=None):
    if rev:
        out = git(root, 'ls-tree', '-r', '--name-only', rev, '--', d)
        return sorted(out.splitlines()) if out else []
    base = os.path.join(root, d)
    files = []
    for dp, _, fns in os.walk(base):
        for fn in fns:
            files.append(os.path.relpath(os.path.join(dp, fn), root))
    return sorted(files)


def norm_title(t):
    t = re.sub(r'\[[^\]]*\]', '', t)          # traceability tags
    t = t.replace('`', '')
    t = re.sub(r'\s+', ' ', t).strip(' .:—-').lower()
    return t


# ---------------------------------------------------------------- spec parsing
HEAD_RE = re.compile(r'^(#{2,6}) (.+?)\s*$')
NUM_RE = re.compile(r'^([A-Z]?\d+(?:\.\d+)*)\.?\s+(.*)$')


def spec_sections(text):
    """Map section keys to (title, hash). Numbered headings give keys '4' / '4.1';
    unnumbered headings nest as '<numbered parent>/<normalized title>'."""
    lines = text.splitlines()
    heads = []
    for i, line in enumerate(lines):
        m = HEAD_RE.match(line)
        if m:
            heads.append((i, len(m.group(1)), m.group(2)))
    out = {}
    stack = []  # (level, key)
    for idx, (i, level, title) in enumerate(heads):
        end = len(lines)
        for j, lvl2, _ in heads[idx + 1:]:
            if lvl2 <= level:
                end = j
                break
        body = '\n'.join(lines[i + 1:end])
        while stack and stack[-1][0] >= level:
            stack.pop()
        m = NUM_RE.match(title)
        if m and level <= 3:
            key = m.group(1)
        else:
            parent = next((k for _, k in reversed(stack) if '/' not in k), None)
            if parent is None:
                continue
            key = f'{parent}/{norm_title(title)}'
            n = 2
            while key in out:
                key = f'{parent}/{norm_title(title)}#{n}'
                n += 1
        out[key] = {'title': title, 'hash': h(body)}
        stack.append((level, key))
    return out


def spec_invariants(text):
    out = {}
    for m in re.finditer(r'^\s*[-*]\s+\*\*(V\d+):\*\*(.*)$', text, re.M):
        out[m.group(1)] = h(m.group(2).strip())
    return out


def spec_modules(text):
    m = re.search(r'^### 0\.3[^\n]*\n(.*?)(?=^### |^## )', text, re.M | re.S)
    if not m:
        return []
    body = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', m.group(1).strip())   # markdown links hide dots in file names
    first = re.split(r'\.(?:\s|$)', body, maxsplit=1)[0]
    return re.findall(r'`([a-z][a-z0-9_-]*)`', first)


def _to_snake(s):
    return re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s).lower()


def spec_statecharts(text, sc_json=None):
    names = {_to_snake(x) for x in re.findall(r'(?:[Ss]tatechart|[Mm]achine) `([A-Za-z_][A-Za-z0-9_]*)`', text)}
    names.update(_to_snake(x) for x in re.findall(r'^#{3,6} [^\n]*\(`([A-Za-z_][A-Za-z0-9_]*)`\)\s*$', text, re.M))
    if sc_json:
        try:
            for m in json.loads(sc_json).get('machines', []):
                if isinstance(m, dict) and m.get('id'):
                    names.add(_to_snake(m['id']))
        except ValueError:
            pass
    return sorted(names)


def spec_env(text):
    """Environment variables: the names in the SPEC §12 configuration table, plus every token sharing their
    prefixes (and SDD_) anywhere in the spec. Project-agnostic: the prefix comes from the table, not from this file."""
    names = set(re.findall(r'^\| `([A-Z][A-Z0-9]*_[A-Z0-9_]+)` \|', text, re.M))
    prefixes = {n.split('_', 1)[0] for n in names} | {'SDD'}
    pat = r'\b((?:' + '|'.join(sorted(map(re.escape, prefixes))) + r')_[A-Z0-9_]+)\b'
    return sorted(set(re.findall(pat, text)) | names)


def spec_units(text):
    """Deployment unit names from SPEC §0.2 (first column of its table), as allocation targets."""
    m = re.search(r'^### 0\.2[^\n]*\n(.*?)(?=^### |^## )', text, re.M | re.S)
    if not m:
        return []
    out = []
    for row in m.group(1).splitlines():
        if row.startswith('|') and not re.match(r'^\|\s*:?-', row) and not row.startswith('| Unit'):
            cell = split_cells(row)[0]
            out.append(cell.strip('`').lower())
    return out


def spec_errors(text, errors_json=None):
    out = set()
    m = re.search(r'^## 7\.[^\n]*\n(.*?)(?=^## )', text, re.M | re.S)
    if m:
        out.update(re.findall(r'^\| `?([A-Z][A-Z_]+)`? \|', m.group(1), re.M))
    if errors_json:
        try:
            for e in json.loads(errors_json).get('errors', []):
                if isinstance(e, dict) and e.get('code'):
                    out.add(e['code'])
        except ValueError:
            pass
    return sorted(out)


DEC_ROW = re.compile(r'^\| (DEC\d{3}) \| ((?:[^|\\]|\\.)*?) \|', re.M)


def decisions(text):
    out = {}
    for line in text.splitlines():
        m = DEC_ROW.match(line)
        if not m:
            continue
        dec, title = m.group(1), m.group(2).strip()
        if '[PENDING-SME]' in title:
            sme = 'full'
        elif 'PENDING-SME' in re.sub(r'\bno\s+`?\[?PENDING-SME\]?`?', '', line, flags=re.I):
            sme = 'partial'
        else:
            sme = None
        refs = sorted(set(re.findall(r'\bDEC\d{3}\b', line)) - {dec})
        out[dec] = {'title': re.sub(r'\s+', ' ', title)[:140], 'hash': h(line), 'sme': sme,
                    'na_legacy': '[N/A-LEGACY]' in title, 'refs': refs}
    return out


def design_sections(text):
    out = {}
    for m in re.finditer(r'^## (.+?)\n(.*?)(?=^## |\Z)', text, re.M | re.S):
        out[m.group(1).strip()] = h(m.group(2))
    fm = text.split('---\n')
    comps = []
    if len(fm) > 2:
        cm = re.search(r'^components:\n(.*?)(?=^[a-zA-Z]|\Z)', fm[1], re.M | re.S)
        if cm:
            comps = re.findall(r'^  ([a-z][a-z0-9-]+):\s*$', cm.group(1), re.M)
    return out, comps


def spec_module_files(root, rev=None):
    """specs/spec/*.md modules (part of the spec: SPEC.md is the index that links them)."""
    return [f for f in list_tree(root, SPEC_MODULES_DIR, rev) if f.endswith('.md')]


def spec_full_text(root, rev=None):
    """SPEC.md followed by every module, for invariants, env vars, error codes and operation names."""
    parts = [read(root, SPEC, rev) or '']
    for f in spec_module_files(root, rev):
        parts.append(read(root, f, rev) or '')
    return '\n\n'.join(parts)


def spec_all_sections(root, rev=None):
    """Sections of SPEC.md (keys unchanged) plus each module's sections; a module key that collides with a
    SPEC.md key is prefixed with the module's file stem."""
    out = spec_sections(read(root, SPEC, rev) or '')
    for f in spec_module_files(root, rev):
        stem = os.path.splitext(os.path.basename(f))[0]
        for k, v in spec_sections(read(root, f, rev) or '').items():
            key = k if k not in out else f'{stem}:{k}'
            out[key] = {'title': v['title'], 'hash': v['hash'], 'module': f}
    return out


def fingerprint(root, rev=None):
    spec = spec_full_text(root, rev)
    declog = read(root, DECLOG, rev) or ''
    design = read(root, DESIGN, rev) or ''
    sc_json = read(root, 'specs/contracts/statecharts.json', rev)
    err_json = read(root, 'specs/contracts/errors.json', rev)
    commit = git(root, 'rev-parse', rev or 'HEAD')
    fp = {
        'schema': 1,
        'commit': commit,
        'short': commit[:7] if commit else None,
        'from': 'git' if rev else 'working-tree',
        'specs_dirty': bool(git(root, 'status', '--porcelain', '--', 'specs')) if not rev else False,
        'lock': None,
        'decisions': decisions(declog),
        'spec_sections': {k: v['hash'] for k, v in spec_all_sections(root, rev).items()},
        'spec_titles': {k: v['title'] for k, v in spec_all_sections(root, rev).items() if '/' not in k},
        'spec_modules': spec_module_files(root, rev),
        'invariants': spec_invariants(spec),
        'modules': spec_modules(spec),
        'statecharts': spec_statecharts(spec, sc_json),
        'env_vars': spec_env(spec),
        'error_codes': spec_errors(spec, err_json),
        'files': {},
    }
    ds, comps = design_sections(design)
    fp['design_sections'] = ds
    fp['design_components'] = comps
    for f in EXTRA_FILES:
        t = read(root, f, rev)
        if t is not None:
            fp['files'][f] = h(t)
    for d in TREE_DIRS:
        for f in list_tree(root, d, rev):
            if d == CHANGES_DIR and not re.match(r'^specs/changes/SCR-\d{3}\.md$', f):
                continue   # only the change requests themselves; their scratch folders, drafts and tools are not spec
            b = read_bytes(root, f, rev)
            if b is None or '__pycache__' in f:
                continue
            try:
                fp['files'][f] = h(b.decode('utf-8'))
            except UnicodeDecodeError:
                fp['files'][f] = hb(b)
    gaps_text = read(root, GAPS, rev)
    fp['gaps'] = {g['id']: {'status': g['status'], 'hash': g['hash']} for g in parse_gaps_md(gaps_text or '')}
    lock = read(root, LOCK, rev)
    if lock:
        try:
            lj = json.loads(lock)
            fp['lock'] = {'version': lj.get('lockVersion'), 'hash': lj.get('hash')}
        except ValueError:
            fp['lock'] = {'version': None, 'hash': h(lock)}
    return fp


# ---------------------------------------------------------------- package parsing
SR_HEAD = re.compile(r'^#### ((?:[A-Z]+)-SR-([A-Z]+)-(\d{3})) · (.+?)\s*$')
DD_HEAD = re.compile(r'^## ((?:[A-Z]+)-DD-(\d{3})) · (.+?)\s*$')
ATTR = re.compile(r'^\| (Rationale|Source|SPEC|Invariants|Verification|Status|Allocated to) \| (.*) \|\s*$')


def v_ids(text):
    """Invariant ids in text, expanding ranges such as 'V27–V32' or 'V27-V32'."""
    out = set()
    for a, b in re.findall(r'\bV(\d+)\s*[–-]\s*V(\d+)\b', text):
        a, b = int(a), int(b)
        if 0 < b - a <= 200:
            out.update(f'V{i}' for i in range(a, b + 1))
    out.update(re.findall(r'\bV\d+\b', text))
    return sorted(out, key=lambda v: int(v[1:]))


def ids_in(text, kind):
    pats = {'dec': r'\bDEC\d{3}\b', 'v': r'\bV\d+\b', 'sr': r'\b[A-Z]+-SR-[A-Z]+-\d{3}\b',
            'dd': r'\b[A-Z]+-DD-\d{3}\b', 'if': r'\b[A-Z]+-IF-\d{2,3}\b', 'tbr': r'\bTBR-\d+\b',
            'gap': r'\bG-\d+\b', 'dia': r'\b[A-Z]+-DIA-\d{2}[a-z]?\b'}
    return sorted(set(re.findall(pats[kind], text)))


def spec_refs(text):
    """'§4.1 NAS reference elements; §5.1 resolveIdentifier' -> [('4.1','NAS reference elements'), ...]"""
    out = []
    for m in re.finditer(r'§(\d+(?:\.\d+)*)\s*([^;§|]*)', text):
        out.append((m.group(1), m.group(2).strip().rstrip('.,')))
    return out


def split_cells(line):
    """Cells of a markdown table row; honours escaped pipes."""
    inner = line.strip()
    inner = inner[1:] if inner.startswith('|') else inner
    inner = inner[:-1] if inner.endswith('|') and not inner.endswith('\\|') else inner
    return [c.strip().replace('\\|', '|') for c in re.split(r'(?<!\\)\|', inner)]


def table_rows(text, first_cell_pat, continuation=False):
    """Rows whose first cell matches the pattern. With continuation=True, rows with an empty first
    cell that follow a matching row are returned too (first cell copied from the row they continue)."""
    rows = []
    last = None
    for line in text.splitlines():
        if not line.startswith('|') or re.match(r'^\|\s*:?-', line):
            continue
        cells = split_cells(line)
        if cells and re.search(first_cell_pat, cells[0]):
            rows.append(cells)
            last = cells[0]
        elif continuation and last and cells and cells[0] == '' and any(cells[1:]):
            rows.append([last] + cells[1:])
        else:
            last = None if cells and cells[0] and not re.search(first_cell_pat, cells[0]) else last
    return rows


def parse_requirements(text):
    reqs = {}
    lines = text.splitlines()
    cur = None
    area = None
    for line in lines:
        if line.startswith('### '):
            area = line[4:].strip()
        elif line.startswith('## '):
            area = None
        m = SR_HEAD.match(line)
        if m:
            cur = {'id': m.group(1), 'cat': m.group(2), 'title': m.group(4), 'statement': '', 'attrs': {}, 'area': area}
            reqs[cur['id']] = cur
            continue
        if cur is None:
            continue
        if line.startswith('#### ') or line.startswith('## ') or line.startswith('### '):
            cur = None
            continue
        if line.startswith('> ') and not cur['attrs']:
            cur['statement'] += (' ' if cur['statement'] else '') + line[2:].strip()
        a = ATTR.match(line)
        if a:
            cur['attrs'][a.group(1)] = a.group(2).strip()
    for r in reqs.values():
        at = r['attrs']
        r['dec'] = ids_in(at.get('Source', ''), 'dec')
        r['v'] = v_ids(at.get('Invariants', ''))
        r['spec'] = spec_refs(at.get('SPEC', ''))
        ver = at.get('Verification', '')
        r['verify'] = [m for m in VERIFY_METHODS if m in ver.split('—')[0]]
        st = at.get('Status', '')
        r['status'] = ('Withdrawn' if 'Withdrawn' in st.split('—')[0]
                       else 'TBR' if 'TBR' in st.split('—')[0]
                       else 'Agreed' if 'Agreed' in st.split('—')[0] else '?')
        r['tbr'] = ids_in(st, 'tbr')
        r['alloc'] = re.findall(r'`([a-z][a-z0-9_-]*)`', at.get('Allocated to', '')) + \
            (['web app'] if 'web app' in at.get('Allocated to', '') else [])
    return reqs


def parse_dds(text):
    out = {}
    parts = re.split(r'(?m)^(?=## [A-Z]+-DD-\d{3} · )', text)
    for p in parts:
        m = DD_HEAD.match(p.split('\n', 1)[0])
        if not m:
            continue
        out[m.group(1)] = {'id': m.group(1), 'title': m.group(3), 'dec': ids_in(p, 'dec'),
                           'sr': ids_in(p, 'sr'), 'spec': spec_refs(p),
                           'withdrawn': bool(re.search(r'\*\*Status:?\*\*:?\s*Withdrawn|Status \| \*?\*?Withdrawn', p))}
    return out


def parse_package(root, pkg=PKG_DIR):
    P = lambda f: read(root, os.path.join(pkg, f)) or ''
    idx = {'requirements': parse_requirements(P(REQ_FILE)), 'design_decisions': parse_dds(P(DD_FILE))}
    # interfaces
    ifs = {}
    for c in table_rows(P(IF_FILE), r'[A-Z]+-IF-\d+'):
        iid = ids_in(c[0], 'if')
        if not iid:
            continue
        row = ' | '.join(c)
        ifs[iid[0]] = {'id': iid[0], 'title': c[1] if len(c) > 1 else '', 'dec': ids_in(row, 'dec'),
                       'sr': ids_in(row, 'sr'), 'status': c[7] if len(c) > 7 else ''}
    idx['interfaces'] = ifs
    # traceability
    trace = {}
    for c in table_rows(P(TRACE_FILE), r'^DEC\d{3}$', continuation=True):
        dec = c[0]
        bucket = re.match(r'\s*(\d)', c[3]) if len(c) > 3 else None
        row = ' | '.join(c)
        trace.setdefault(dec, []).append({'part': c[2] if len(c) > 2 else '', 'bucket': int(bucket.group(1)) if bucket else None,
                                          'sr': ids_in(row, 'sr'), 'dd': ids_in(row, 'dd')})
    idx['traceability'] = trace
    # open items
    open_text = P(OPEN_FILE)
    tbrs, gaps = {}, {}
    for c in table_rows(open_text, r'TBR-\d+'):
        tid = ids_in(c[0], 'tbr')
        if tid and not tid[0] in tbrs:
            row = ' | '.join(c)
            tbrs[tid[0]] = {'id': tid[0], 'dec': ids_in(c[1] if len(c) > 1 else '', 'dec'),
                            'sr': ids_in(row, 'sr'), 'closed': bool(re.search(r'Closed in rev', row)),
                            'partial': 'partly pending' in row.lower()}
    for c in table_rows(open_text, r'(?<![A-Z-])G-\d+'):
        gid = ids_in(c[0], 'gap')
        if gid and not gid[0] in gaps:
            row = ' | '.join(c)
            gaps[gid[0]] = {'id': gid[0], 'topic': c[1] if len(c) > 1 else '', 'spec': spec_refs(row),
                            'closed': bool(re.search(r'Closed in rev', row))}
    idx['tbr'] = tbrs
    idx['gaps'] = gaps
    # diagrams: README index + files on disk
    readme = P(README)
    dias = {}
    for c in table_rows(readme, r'[A-Z]+-DIA-\d{2}[a-z]?'):
        did = ids_in(c[0], 'dia')
        if not did:
            continue
        fm = re.search(r'\((diagrams/[^)]+\.drawio)\)', ' | '.join(c))
        dias[did[0]] = {'id': did[0], 'title': c[1] if len(c) > 1 else '', 'file': fm.group(1) if fm else None,
                        'pending': 'pending redraw' in ' | '.join(c).lower()}
    ddir = os.path.join(root, pkg, 'diagrams')
    on_disk = sorted(f for f in os.listdir(ddir) if f.endswith('.drawio')) if os.path.isdir(ddir) else []
    for d in dias.values():
        if d['file'] and os.path.exists(os.path.join(root, pkg, d['file'])):
            x = read(root, os.path.join(pkg, d['file']))
            # attributes are HTML-escaped inside the XML; unescape the section sign and entities we need
            x = x.replace('&amp;', '&').replace('&#167;', '§').replace('&sect;', '§')
            d['dec'] = ids_in(x, 'dec')
            d['spec'] = sorted(set(m for m, _ in spec_refs(x)))
            d['if'] = ids_in(x, 'if')
            d['v'] = v_ids(x)
            cm = re.findall(r'\b([0-9a-f]{7,12})\b', x)
            d['source_commit'] = cm[0] if cm else None
            d['exists'] = True
        else:
            d['exists'] = False
    idx['diagrams'] = dias
    idx['diagram_files'] = on_disk
    # counts
    reqs = idx['requirements']
    active = [r for r in reqs.values() if r['status'] != 'Withdrawn']
    cats = {}
    for r in active:
        cats.setdefault(r['cat'], {'n': 0, 'tbr': 0})
        cats[r['cat']]['n'] += 1
        cats[r['cat']]['tbr'] += r['status'] == 'TBR'
    ver = {m: sum(1 for r in active if r['verify'] and r['verify'][0] == m) for m in VERIFY_METHODS}
    idx['counts'] = {
        'requirements': len(active), 'requirements_tbr': sum(r['status'] == 'TBR' for r in active),
        'withdrawn_requirements': len(reqs) - len(active), 'by_category': cats, 'verification': ver,
        'design_decisions': sum(not d['withdrawn'] for d in idx['design_decisions'].values()),
        'interfaces': len(ifs), 'tbr_open': sum(not t['closed'] for t in tbrs.values()),
        'tbr_total': len(tbrs), 'gaps_open': sum(not g['closed'] for g in gaps.values()),
        'gaps_total': len(gaps), 'diagrams': len(dias), 'decisions_traced': len(trace),
        'traced_parts': sum(len(v) for v in trace.values()),
    }
    return idx


# ---------------------------------------------------------------- impact
def ref_keys(ref, fp_sections):
    """Fingerprint keys a package reference points at, and whether the match is exact (a sub-heading)
    or broad (fallback to the whole numbered section)."""
    num, title = ref
    if title:
        t = norm_title(title)
        for k in fp_sections:
            if k.startswith(num + '/') and (k.split('/', 1)[1].startswith(t) or t.startswith(k.split('/', 1)[1].split(' (')[0])):
                return [k], True
    return ([num], False) if num in fp_sections else ([], False)


def diff_fp(old, new):
    d = {}
    od, nd = old['decisions'], new['decisions']
    d['decisions_added'] = sorted(set(nd) - set(od))
    d['decisions_removed'] = sorted(set(od) - set(nd))
    d['decisions_changed'] = sorted(k for k in set(od) & set(nd) if od[k]['hash'] != nd[k]['hash'])
    d['sme_changes'] = sorted((k, od[k]['sme'], nd[k]['sme']) for k in set(od) & set(nd) if od[k]['sme'] != nd[k]['sme'])
    os_, ns = old['spec_sections'], new['spec_sections']
    d['sections_added'] = sorted(set(ns) - set(os_))
    d['sections_removed'] = sorted(set(os_) - set(ns))
    d['sections_changed'] = sorted(k for k in set(os_) & set(ns) if os_[k] != ns[k])
    oi, ni = old['invariants'], new['invariants']
    vkey = lambda v: int(v[1:])
    d['invariants_added'] = sorted(set(ni) - set(oi), key=vkey)
    d['invariants_removed'] = sorted(set(oi) - set(ni), key=vkey)
    d['invariants_changed'] = sorted((k for k in set(oi) & set(ni) if oi[k] != ni[k]), key=vkey)
    for k in ('modules', 'statecharts', 'env_vars', 'error_codes', 'design_components', 'spec_modules'):
        a, b = set(old.get(k, [])), set(new.get(k, []))
        d[k + '_added'], d[k + '_removed'] = sorted(b - a), sorted(a - b)
    og, ng = old.get('gaps', {}), new.get('gaps', {})
    d['gaps_added'] = sorted(set(ng) - set(og))
    d['gaps_changed'] = sorted(k for k in set(og) & set(ng) if og[k] != ng[k])
    d['gaps_removed'] = sorted(set(og) - set(ng))
    odz, ndz = old.get('design_sections', {}), new.get('design_sections', {})
    d['design_sections_changed'] = sorted(k for k in set(odz) | set(ndz) if odz.get(k) != ndz.get(k))
    of, nf = old.get('files', {}), new.get('files', {})
    d['files_changed'] = sorted(k for k in set(of) | set(nf) if of.get(k) != nf.get(k))
    d['lock'] = (old.get('lock'), new.get('lock'))
    return d


def next_ids(idx, prefix):
    def nxt(nums):
        return max(nums) + 1 if nums else 1
    out = {}
    blocks = {}
    for r in idx['requirements'].values():
        n = int(r['id'].rsplit('-', 1)[1])
        b = blocks.setdefault((r['cat'], n // 100), {'nums': [], 'area': r.get('area')})
        b['nums'].append(n)
    per_cat = {}
    for (c, blk), v in blocks.items():
        per_cat.setdefault(c, []).append((blk, v))
    for c, lst in sorted(per_cat.items()):
        for blk, v in sorted(lst):
            label = f'{prefix}-SR-{c}' + (f' ({v["area"]})' if len(lst) > 1 and v['area'] else '')
            out[label] = f'{prefix}-SR-{c}-{max(v["nums"]) + 1:03d}'
    out[f'{prefix}-DD'] = f"{prefix}-DD-{nxt([int(k.rsplit('-', 1)[1]) for k in idx['design_decisions']]):03d}"
    out[f'{prefix}-IF'] = f"{prefix}-IF-{nxt([int(k.rsplit('-', 1)[1]) for k in idx['interfaces']]):02d}"
    out['TBR'] = f"TBR-{nxt([int(k.split('-')[1]) for k in idx['tbr']]):02d}"
    out['G'] = f"G-{nxt([int(k.split('-')[1]) for k in idx['gaps']]):02d}"
    out[f'{prefix}-DIA'] = f"{prefix}-DIA-{nxt([int(re.sub(r'[a-z]$', '', k.rsplit('-', 1)[1])) for k in idx['diagrams']]):02d}"
    return out


def detect_prefix(idx, manifest=None):
    if manifest and manifest.get('id_prefix'):
        return manifest['id_prefix']
    for k in idx['requirements']:
        return k.split('-')[0]
    return 'ZEN'


def impact(root, rev=None, as_json=False, pkg=PKG_DIR):
    mpath = os.path.join(root, pkg, 'manifest.json')
    if not os.path.exists(mpath):
        sys.exit('pkg.py impact: no manifest.json; adopt the package first (see SKILL.md, "Adopt").')
    man = json.load(open(mpath, encoding='utf-8'))
    old = man['fingerprint']
    new = fingerprint(root, rev)
    idx = parse_package(root, pkg)
    d = diff_fp(old, new)
    changed_secs = set(d['sections_changed']) | set(d['sections_removed'])
    touched_by_new = {}
    for k in d['decisions_added']:
        for ref in new['decisions'][k].get('refs', []):
            if ref in old['decisions']:
                touched_by_new.setdefault(ref, []).append(k)
    changed_decs = (set(d['decisions_changed']) | set(d['decisions_removed']) | {k for k, _, _ in d['sme_changes']}
                    | set(touched_by_new))
    changed_v = set(d['invariants_changed']) | set(d['invariants_removed'])
    def hit(refs):
        exact, broad = set(), set()
        for r in refs:
            keys, is_exact = ref_keys(r, old['spec_sections'])
            for k in keys:
                if k in changed_secs:
                    (exact if is_exact else broad).add(k)
        return sorted(exact), sorted(broad - exact)
    items, maybe = [], []

    def classify(x, title, extra_direct=()):
        direct = list(extra_direct)
        if set(x.get('dec', [])) & changed_decs:
            direct.append('decisions ' + ', '.join(sorted(set(x['dec']) & changed_decs)))
        if set(x.get('v', [])) & changed_v:
            direct.append('invariants ' + ', '.join(sorted(set(x['v']) & changed_v, key=lambda v: int(v[1:]))))
        exact, broad = hit(x.get('spec', []))
        if exact:
            direct.append('SPEC ' + ', '.join('§' + k for k in exact))
        if direct:
            items.append((x['id'], title, '; '.join(direct)))
        elif broad:
            maybe.append((x['id'], title, 'cites ' + ', '.join('§' + k for k in broad) + ' broadly'))
    for r in idx['requirements'].values():
        if r['status'] != 'Withdrawn':
            classify(r, r['title'])
    for coll in (idx['design_decisions'], idx['interfaces']):
        for x in coll.values():
            classify(x, x['title'])
    for t in idx['tbr'].values():
        why = [f'{k}: {a} → {b}' for k, a, b in d['sme_changes'] if k in t['dec']]
        why += [f'{k} is cited by new {", ".join(v)} (resolution, refinement or reversal?)' for k, v in sorted(touched_by_new.items()) if k in t['dec']]
        why += ['decision changed ' + k for k in sorted(set(t['dec']) & set(d['decisions_changed']))]
        if why and not t['closed']:
            items.append((t['id'], 'TBR entry', '; '.join(why)))
    for g in idx['gaps'].values():
        if g['closed']:
            continue
        exact, broad = hit(g['spec'])
        if exact:
            items.append((g['id'], g['topic'][:70], 'SPEC ' + ', '.join('§' + k for k in exact) + ' changed: re-check whether the gap is closed'))
        elif broad:
            maybe.append((g['id'], g['topic'][:70], 'cites ' + ', '.join('§' + k for k in broad) + ' broadly: re-check whether the gap is closed'))
    dia_hits, dia_maybe = [], []
    for dg in idx['diagrams'].values():
        decs_hit = sorted(set(dg.get('dec', [])) & changed_decs)
        v_hit = sorted(set(dg.get('v', [])) & changed_v, key=lambda v: int(v[1:]))
        if v_hit:
            decs_hit = decs_hit + ['invariants ' + ', '.join(v_hit)]
        secs = sorted(k for k in changed_secs if '/' not in k and any(k == s for s in dg.get('spec', [])))
        if decs_hit:
            dia_hits.append((dg['id'], dg['title'], ', '.join(decs_hit) + (('; SPEC ' + ', '.join('§' + k for k in secs)) if secs else '')))
        elif secs:
            dia_maybe.append((dg['id'], dg['title'], 'depicts ' + ', '.join('§' + k for k in secs) + ', which changed'))
    new_sme = [k for k, a, b in d['sme_changes'] if b and not a]
    new_sme += [k for k in d['decisions_added'] if new['decisions'][k]['sme']]
    resolved_sme = [k for k, a, b in d['sme_changes'] if a and not b]
    prefix = detect_prefix(idx, man)
    closure = sorted(set(resolved_sme) | {t['id'] for t in idx['tbr'].values() if not t['closed'] and set(t['dec']) & set(touched_by_new)})
    result = {'baseline': {'revision': man.get('revision'), 'commit': old.get('short'), 'lock': old.get('lock')},
              'current': {'commit': new.get('short'), 'from': new.get('from'), 'specs_dirty': new.get('specs_dirty'), 'lock': new.get('lock')},
              'changes': d, 'affected_items': items, 'possibly_affected_items': maybe,
              'affected_diagrams': dia_hits, 'possibly_affected_diagrams': dia_maybe,
              'to_classify': d['decisions_added'], 'new_tbr_needed': sorted(set(new_sme)),
              'tbr_closure_candidates': closure, 'decisions_cited_by_new': touched_by_new,
              'uncited_new_invariants': d['invariants_added'], 'next_ids': next_ids(idx, prefix)}
    if as_json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result
    nothing = not any(v for k, v in d.items() if k != 'lock') and d['lock'][0] == d['lock'][1]
    print(f"# Impact report\n\nBaseline: revision {man.get('revision')}, commit {old.get('short')}, lock {old.get('lock')}")
    print(f"Current:  commit {new.get('short')} ({new.get('from')}{', specs/ has uncommitted changes' if new.get('specs_dirty') else ''}), lock {new.get('lock')}\n")
    if nothing:
        print('No changes in the spec set since the baseline. The package is current.')
        return result
    labels = [('decisions_added', 'Decisions added (classify each)'), ('decisions_changed', 'Decisions changed'),
              ('decisions_removed', 'Decisions removed'), ('sections_changed', 'SPEC sections changed'),
              ('sections_added', 'SPEC sections added'), ('sections_removed', 'SPEC sections removed'),
              ('invariants_added', 'Invariants added (must be cited)'), ('invariants_changed', 'Invariants changed'),
              ('invariants_removed', 'Invariants removed (citations must go)'),
              ('modules_added', 'Modules added'), ('modules_removed', 'Modules removed'),
              ('statecharts_added', 'Statecharts added'), ('statecharts_removed', 'Statecharts removed'),
              ('env_vars_added', 'Config vars added'), ('env_vars_removed', 'Config vars removed'),
              ('error_codes_added', 'Error codes added'), ('error_codes_removed', 'Error codes removed'),
              ('design_sections_changed', 'DESIGN.md sections changed'), ('design_components_added', 'UI components added'),
              ('design_components_removed', 'UI components removed'), ('spec_modules_added', 'Spec modules added (specs/spec/)'),
              ('spec_modules_removed', 'Spec modules removed'), ('gaps_added', 'GAPS.md rows added (import with `pkg.py derive`)'),
              ('gaps_changed', 'GAPS.md rows changed (status or text)'), ('gaps_removed', 'GAPS.md rows removed'),
              ('files_changed', 'Other spec files changed')]
    print('## Source changes\n')
    for k, label in labels:
        if d[k]:
            vals = d[k]
            shown = ', '.join(vals[:40]) + (f' … (+{len(vals) - 40})' if len(vals) > 40 else '')
            print(f'- **{label}:** {shown}')
    if d['sme_changes']:
        print('- **PENDING-SME status changes:** ' + ', '.join(f'{k} ({a or "none"} → {b or "none"})' for k, a, b in d['sme_changes']))
    if touched_by_new:
        print('- **Earlier decisions cited by new ones:** ' + ', '.join(f'{k} ← {", ".join(v)}' for k, v in sorted(touched_by_new.items())))
    if d['lock'][0] != d['lock'][1]:
        print(f"- **Spec lock:** {d['lock'][0]} → {d['lock'][1]}")
    def show(title, rows):
        print(f'\n## {title}\n')
        for i, t, w in sorted(rows):
            print(f'- {i} · {t} — {w}')
        if not rows:
            print('- none')
    show('Package items directly affected (a cited decision, invariant or SPEC sub-section changed)', items)
    show('Package items possibly affected (they cite a changed section only broadly; skim)', maybe)
    show('Diagrams directly affected (they depict a changed decision or invariant)', dia_hits)
    show('Diagrams possibly affected (they depict a changed section)', dia_maybe)
    print('\n## Obligations\n')
    print(f"- Classify new decisions: {', '.join(result['to_classify']) or 'none'}")
    print(f"- New TBR entries needed (decisions now PENDING-SME): {', '.join(result['new_tbr_needed']) or 'none'}")
    print(f"- TBR entries to re-check for closure (their decisions were resolved or cited by new decisions): {', '.join(result['tbr_closure_candidates']) or 'none'}")
    print(f"- New invariants to cite: {', '.join(result['uncited_new_invariants']) or 'none'}")
    print('\n## Next free ids\n')
    for k, v in result['next_ids'].items():
        print(f'- {k}: {v}')
    return result


# ---------------------------------------------------------------- check
def check(root, strict=False, pkg=PKG_DIR):
    fp = fingerprint(root)
    idx = parse_package(root, pkg)
    errs, warns, notes = [], [], []
    decs = fp['decisions']
    vids = set(fp['invariants'])
    reqs = idx['requirements']
    active = {k: r for k, r in reqs.items() if r['status'] != 'Withdrawn'}
    known_ids = set(reqs) | set(idx['design_decisions']) | set(idx['interfaces'])
    # E1 every decision traced
    missing = sorted(set(decs) - set(idx['traceability']))
    if missing:
        errs.append(f'Decisions missing from {TRACE_FILE}: {", ".join(missing)}')
    extra = sorted(set(idx['traceability']) - set(decs))
    if extra:
        errs.append(f'{TRACE_FILE} lists decisions not in the log: {", ".join(extra)}')
    # E2 traceability references exist
    for dec, parts in idx['traceability'].items():
        for p in parts:
            bad = [x for x in p['sr'] + p['dd'] if x not in known_ids]
            if bad:
                errs.append(f'{TRACE_FILE} {dec}: unknown ids {", ".join(bad)}')
            if p['bucket'] not in (1, 2, 3, 4):
                errs.append(f'{TRACE_FILE} {dec}: missing or invalid bucket')
    # E3/E4 requirement attributes
    for k, r in reqs.items():
        at = r['attrs']
        for a in ('Source', 'SPEC', 'Invariants', 'Verification', 'Status', 'Allocated to'):
            if a not in at:
                errs.append(f'{k}: attribute "{a}" missing')
        if r['status'] == '?':
            errs.append(f'{k}: status must start with Agreed, TBR or Withdrawn')
        if r['status'] == 'Withdrawn':
            continue
        if not r['statement']:
            errs.append(f'{k}: no requirement statement (blockquote) found')
        if not r['dec']:
            errs.append(f'{k}: no source decision')
        bad = [x for x in r['dec'] if x not in decs]
        if bad:
            errs.append(f'{k}: unknown decisions {", ".join(bad)}')
        bad = [x for x in r['v'] if x not in vids]
        if bad:
            errs.append(f'{k}: invariants not in SPEC §8: {", ".join(bad)}')
        if not r['verify']:
            errs.append(f'{k}: verification method must be one of {", ".join(VERIFY_METHODS)}')
        if r['status'] == 'TBR':
            if not r['tbr']:
                errs.append(f'{k}: TBR status without a TBR-nn link')
            bad = [t for t in r['tbr'] if t not in idx['tbr']]
            if bad:
                errs.append(f'{k}: links unknown TBR entries {", ".join(bad)}')
        if r['statement'] and 'shall' not in r['statement']:
            warns.append(f'{k}: statement has no "shall"')
        if r['statement'] and r['statement'].count(' shall ') > 1:
            warns.append(f'{k}: statement has more than one "shall" (split it?)')
        terms = [t for t in DESIGN_TERMS if re.search(r'\b' + re.escape(t) + r'\b', r['statement'])]
        if terms:
            warns.append(f'{k}: possible design term in statement: {", ".join(terms)}')
        mods = set(fp['modules']) | {'web app'}
        units = {u.replace(' ', '-') for u in spec_units(spec_full_text(root))} | {'postgresql', 'reverse-proxy', 'db'}
        bad = [m for m in r['alloc'] if m not in mods and m not in units]
        if bad:
            warns.append(f'{k}: allocated to names not in SPEC §0.3: {", ".join(bad)}')
    # E5 invariant coverage
    cited = {v for r in active.values() for v in r['v']}
    unc = sorted(vids - cited, key=lambda v: int(v[1:]))
    if unc:
        errs.append(f'Invariants not cited by any requirement: {", ".join(unc)}')
    # E6 TBR coverage of PENDING-SME decisions
    tbr_decs = {d for t in idx['tbr'].values() for d in t['dec']}
    nocov = sorted(k for k, v in decs.items() if v['sme'] == 'full' and k not in tbr_decs)
    if nocov:
        errs.append(f'[PENDING-SME] decisions with no TBR entry (open or closed): {", ".join(nocov)}')
    for t in idx['tbr'].values():
        if not t['closed'] and not t.get('partial') and t['dec'] and all(decs.get(d, {}).get('sme') is None for d in t['dec']):
            warns.append(f'{t["id"]}: none of its decisions is PENDING-SME any more; close it?')
        bad = [x for x in t['sr'] if x not in reqs]
        if bad:
            errs.append(f'{t["id"]}: affects unknown requirements {", ".join(bad)}')
    # E7 duplicate ids (requirement headings)
    text = read(root, os.path.join(pkg, REQ_FILE)) or ''
    heads = re.findall(r'^#### ([A-Z]+-SR-[A-Z]+-\d{3}) ', text, re.M)
    dups = sorted({x for x in heads if heads.count(x) > 1})
    if dups:
        errs.append(f'Duplicate requirement ids: {", ".join(dups)}')
    # E8 registry: no id may disappear
    mpath = os.path.join(root, pkg, 'manifest.json')
    if os.path.exists(mpath):
        man = json.load(open(mpath, encoding='utf-8'))
        present = {'SR': set(reqs), 'DD': set(idx['design_decisions']), 'IF': set(idx['interfaces']),
                   'TBR': set(idx['tbr']), 'G': set(idx['gaps']), 'DIA': set(idx['diagrams'])}
        for kind, ids in man.get('ids', {}).items():
            gone = sorted(set(ids) - present.get(kind, set()))
            if gone:
                errs.append(f'{kind} ids deleted instead of withdrawn/closed: {", ".join(gone)}')
    else:
        warns.append('No manifest.json yet (adopt or stamp the package).')
    # E9 diagrams
    for d in idx['diagrams'].values():
        if not d['file']:
            errs.append(f'{d["id"]}: diagram index row has no .drawio link')
        elif not d['exists']:
            errs.append(f'{d["id"]}: {d["file"]} does not exist')
    indexed = {os.path.basename(d['file']) for d in idx['diagrams'].values() if d['file']}
    orphans = [f for f in idx['diagram_files'] if f not in indexed]
    if orphans:
        warns.append(f'Diagram files not in the README index: {", ".join(orphans)}')
    # W key numbers
    c = idx['counts']
    readme = read(root, os.path.join(pkg, README)) or ''
    m = re.search(r'\| System requirements \| (\d+)', readme)
    if m and int(m.group(1)) != c['requirements']:
        warns.append(f'README key numbers say {m.group(1)} requirements; package has {c["requirements"]}')
    m = re.search(r'\| TBR register entries \| (\d+)', readme)
    if m and int(m.group(1)) != c['tbr_open']:
        warns.append(f'README key numbers say {m.group(1)} TBR entries; package has {c["tbr_open"]} open')
    m = re.search(r'\| Gaps \| (\d+)', readme)
    if m and int(m.group(1)) != c['gaps_open']:
        warns.append(f'README key numbers say {m.group(1)} gaps; package has {c["gaps_open"]} open')
    m = re.search(r'\| Diagrams \| (\d+)', readme)
    if m and int(m.group(1)) != c['diagrams']:
        warns.append(f'README key numbers say {m.group(1)} diagrams; package has {c["diagrams"]}')
    m = re.search(r'^\|\s*\*\*Total\*\*\s*\|\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*', text, re.M)
    if m and (int(m.group(1)) != c['requirements'] or int(m.group(2)) != c['requirements_tbr']):
        warns.append(f'{REQ_FILE} Total row says {m.group(1)} ({m.group(2)} TBR); package has {c["requirements"]} ({c["requirements_tbr"]} TBR)')
    # W derived chapters current; Test-method requirements without evidence; review log well-formed
    try:
        stale = derived_changes(root, pkg)
        if stale:
            warns.append('Derived chapters/blocks differ from the spec set (run `pkg.py derive --write`): ' + ', '.join(stale))
    except Exception as e:  # derivation must never mask the other checks
        warns.append(f'derive failed: {e}')
    try:
        v = verification(root, pkg)
        gaps_t = [r['id'] for r in v['rows'] if r['method'] == 'Test' and r['status'] == 'unverified']
        if gaps_t:
            notes.append(f'Test-method requirements with no oracle case or UI spec mapped ({len(gaps_t)}): {", ".join(gaps_t[:12])}{" …" if len(gaps_t) > 12 else ""} — a verification gap for the pipeline (Stage 04), not a package defect')
        failing = [r['id'] for r in v['rows'] if r['status'] == 'failing']
        if failing:
            notes.append(f'Requirements with a failing case in the latest run ({len(failing)}): {", ".join(failing[:12])} — a build defect or spec question for the pipeline')
    except Exception as e:
        warns.append(f'verification failed: {e}')
    for rc in parse_review_log(root, pkg):
        if rc['status'] not in ('open', 'accepted', 'applied', 'rejected', 'package'):
            errs.append(f"{rc['id']}: status must be open, accepted, applied, rejected or package (found \"{rc['status']}\")")
        if rc['classification'] and rc['classification'] not in ('package defect', 'clarification', 'technical', 'policy'):
            errs.append(f"{rc['id']}: classification must be package defect, clarification, technical or policy")
        if rc['status'] in ('accepted', 'applied') and not re.search(r'SCR-\d{3}|DEC\d{3}|G[0-9A-Za-z]*-[0-9A-Za-z]+|rev \d+', rc['resolution']):
            errs.append(f"{rc['id']}: an {rc['status']} comment must cite its SCR, DEC, gap row or revision in Resolution")
        for tgt in rc['targets']:
            if re.match(r'^[A-Z]+-(SR|DD|IF|DIA)-', tgt) and tgt not in known_ids and tgt not in idx['diagrams']:
                errs.append(f"{rc['id']}: unknown target {tgt}")
    html_path = os.path.join(root, pkg, 'index.html')
    if os.path.exists(html_path) and os.path.exists(mpath):
        man = json.load(open(mpath, encoding='utf-8'))
        b_short = (man.get('baseline') or {}).get('short')
        html_txt = read(root, os.path.join(pkg, 'index.html')) or ''
        if b_short and b_short not in html_txt:
            warns.append(f'index.html does not mention baseline commit {b_short} (run pkg.py compile)')
    # report
    print(f"Package: {c['requirements']} requirements ({c['requirements_tbr']} TBR, {c['withdrawn_requirements']} withdrawn), "
          f"{c['design_decisions']} design decisions, {c['interfaces']} interfaces, {c['tbr_open']}/{c['tbr_total']} open TBR, "
          f"{c['gaps_open']}/{c['gaps_total']} open gaps, {c['diagrams']} diagrams, {c['decisions_traced']} decisions traced "
          f"({c['traced_parts']} parts); invariants cited {len(cited & vids)}/{len(vids)}")
    for e in errs:
        print('ERROR  ' + e)
    for w in warns:
        print('WARN   ' + w)
    for n in notes:
        print('NOTE   ' + n)
    print(f'{len(errs)} error(s), {len(warns)} warning(s), {len(notes)} note(s)')
    return 1 if errs or (strict and warns) else 0




# ---------------------------------------------------------------- spec-set sources (GAPS.md, SCRs, lock, transitions, cases, runs)
GAP_ROW = re.compile(r'^G[0-9A-Za-z]*-[0-9A-Za-z]+$')


def parse_gaps_md(text):
    """Rows of specs/GAPS.md (ID | Stage | Kind | Gap | Draft assumption | Status)."""
    out = []
    for c in table_rows(text, r'^G[0-9A-Za-z]*-[0-9A-Za-z]+$'):
        if len(c) < 6 or not GAP_ROW.match(c[0].replace('`', '').strip()):
            continue
        out.append({'id': c[0].replace('`', '').strip(), 'stage': c[1], 'kind': c[2].lower(), 'gap': c[3],
                    'assumption': c[4], 'status': c[5].lower().strip(), 'hash': h(' | '.join(c)),
                    'dec': ids_in(' | '.join(c), 'dec')})
    return out


SCR_FIELD = re.compile(r'^\| (Date|Trigger|Observation|Class|Root cause|Stage that should have caught it|Proposed frozen-set edits|New / changed cases|New invariant|Pipeline change|Status) \| (.*) \|\s*$')


def parse_scrs(root):
    out = []
    d = os.path.join(root, CHANGES_DIR)
    if not os.path.isdir(d):
        return out
    for fn in sorted(os.listdir(d)):
        m = re.match(r'^(SCR-\d{3})\.md$', fn)
        if not m:
            continue
        txt = read(root, os.path.join(CHANGES_DIR, fn)) or ''
        title = txt.splitlines()[0].lstrip('# ').strip() if txt else fn
        title = re.sub(r'^SCR-\d{3}:\s*', '', title)
        f = {}
        for line in txt.splitlines():
            mm = SCR_FIELD.match(line)
            if mm:
                f[mm.group(1)] = mm.group(2).strip()
        cls = re.match(r'\s*([A-E](?:\s*[+/]\s*[A-E′\']*)*)', f.get('Class', ''))
        status = f.get('Status', '')
        st = 'applied' if re.search(r'\bapplied\b', status, re.I) else 'rejected' if re.search(r'\brejected\b', status, re.I) else 'approved' if re.search(r'\bapproved\b', status, re.I) else 'proposed'
        cases = sorted(set(re.findall(r'\b[A-Z]{2,4}-\d{3}\b', f.get('New / changed cases', ''))))
        out.append({'id': m.group(1), 'title': title[:120], 'date': f.get('Date', ''), 'class': (cls.group(1).strip() if cls else f.get('Class', '')[:12]),
                    'status': st, 'status_text': status[:160], 'cases': cases, 'trigger': f.get('Trigger', '')[:160],
                    'dec': ids_in(txt, 'dec'), 'rc': sorted(set(re.findall(r'\bRC-\d+\b', txt)))})
    return out


def parse_backprop(root):
    txt = read(root, BACKPROP) or ''
    out = []
    for m in re.finditer(r'^## (SCR-\d{3}) — (\d{4}-\d{2}-\d{2})\n(.*?)(?=^## |\Z)', txt, re.M | re.S):
        rows = [split_cells(l) for l in m.group(3).splitlines() if l.startswith('|') and not re.match(r'^\|\s*:?-', l) and not l.startswith('| Bug ')]
        for r in rows:
            if len(r) >= 6:
                out.append({'scr': m.group(1), 'date': m.group(2), 'bug': r[0], 'class': r[1], 'cause': r[2], 'fix': r[3], 'invariant': r[4], 'lock': r[5]})
    return out


def parse_transitions(root):
    out = []
    for line in (read(root, TRANSITIONS) or '').splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except ValueError:
            pass
    return out


def parse_lock(root):
    txt = read(root, LOCK)
    if not txt:
        return None
    try:
        return json.loads(txt)
    except ValueError:
        return None


def parse_prototype_versions(root):
    """Versions tables of specs/logs/02-prototype.md, with the record heading each sits under."""
    txt = read(root, PROTOTYPE_RECORD) or ''
    out, record = [], ''
    for line in txt.splitlines():
        if line.startswith('# '):
            record = line[2:].strip()
        if line.startswith('|') and not re.match(r'^\|\s*:?-', line):
            c = split_cells(line)
            if c and re.match(r'^[0-9a-z]*v\d+', c[0].strip()) and len(c) >= 3:
                out.append({'record': record, 'version': c[0], 'date': c[1], 'changed': c[2], 'gaps': c[3] if len(c) > 3 else '', 'dec': c[4] if len(c) > 4 else ''})
    return out


def parse_cases(root):
    """Oracle cases with the spec refs, invariants and operation each one cites."""
    out = []
    d = os.path.join(root, CASES_DIR)
    if not os.path.isdir(d):
        return out
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.json'):
            continue
        try:
            doc = json.loads(read(root, os.path.join(CASES_DIR, fn)) or '{}')
        except ValueError:
            continue
        for c in doc.get('cases', []):
            df = ' ; '.join(str(x) for x in c.get('derivedFrom', []))
            op = re.match(r'^([a-z][A-Za-z0-9]+)\s*\|', c.get('title', ''))
            ops = {op.group(1)} if op else set()
            ops.update(re.findall(r'§\d+(?:\.\d+)*\s+([a-z][A-Za-z0-9]+)\b', df))
            out.append({'id': c.get('id'), 'suite': doc.get('suite', fn[:-5]), 'phase': c.get('phase'), 'title': c.get('title', ''),
                        'tags': c.get('tags', []), 'probe': bool(c.get('probe')), 'spec': spec_refs(df), 'v': v_ids(df),
                        'ops': sorted(ops), 'generated': 'generated' in (c.get('tags') or [])})
    return out


def parse_ui_specs(root):
    """Frozen UI specs: file → the refs its `// covers:` comments cite."""
    out = {}
    d = os.path.join(root, UI_SPECS_DIR)
    if not os.path.isdir(d):
        return out
    for fn in sorted(os.listdir(d)):
        if not re.search(r'\.(spec|test)\.[cm]?[jt]s$', fn):
            continue
        txt = read(root, os.path.join(UI_SPECS_DIR, fn)) or ''
        covers = ' ; '.join(m.group(1) for m in re.finditer(r'//\s*covers:\s*(.*)$', txt, re.M))
        out[fn] = {'file': fn, 'spec': spec_refs(covers), 'v': v_ids(covers), 'tests': len(re.findall(r'\btest\(', txt))}
    return out


def latest_run(root, lock):
    """Newest unfiltered oracle run on target default, with its binding to the current lock."""
    d = os.path.join(root, ORACLE_LOGS)
    if not os.path.isdir(d):
        return None
    best = None
    for fn in os.listdir(d):
        if not (fn.startswith('run-') and fn.endswith('.json')):
            continue
        try:
            r = json.loads(read(root, os.path.join(ORACLE_LOGS, fn)) or '{}')
        except ValueError:
            continue
        if r.get('target') != 'default' or r.get('filtered'):
            continue
        if best is None or str(r.get('finishedAt')) > str(best.get('finishedAt')):
            best = r
            best['_file'] = os.path.join(ORACLE_LOGS, fn)
    if best is None:
        return None
    on_lock = bool(lock) and best.get('lockHash') == lock.get('hash') and bool(best.get('lockValid'))
    best['_binding'] = 'current lock' if on_lock else ('lock ' + str(best.get('lockVersion')) + ' (no longer intact)' if best.get('lockHash') else 'no lock')
    best['_results'] = {x.get('id'): x.get('status') for x in best.get('results', [])}
    return best


def ui_run(root, lock):
    txt = read(root, UI_REPORT)
    if not txt:
        return None
    try:
        r = json.loads(txt)
    except ValueError:
        return None
    files = {}
    for s in r.get('suites', []):
        fn = os.path.basename(str(s.get('file', '')))
        bad = 0
        for sp in s.get('specs', []):
            for tst in sp.get('tests', []):
                if any(res.get('status') not in ('passed', 'expected') for res in tst.get('results', [])) or tst.get('status') == 'unexpected':
                    bad += 1
        files[fn] = 'fail' if bad else 'pass'
    st = r.get('stats', {})
    mtime = datetime.datetime.fromtimestamp(os.path.getmtime(os.path.join(root, UI_REPORT))).isoformat()
    on_lock = bool(lock) and mtime > str(lock.get('frozenAt', ''))
    return {'files': files, 'stats': st, 'started': r.get('startTime'), '_binding': 'after the current lock' if on_lock else 'before the current lock (stale)',
            'ok': not st.get('unexpected') and not st.get('flaky')}


# ---------------------------------------------------------------- evidence: requirement → cases → latest run
def _ref_match(req_refs, case_refs):
    """Exact: same section number and the sub-heading of one starts the other. Broad: same number only."""
    exact, broad = set(), set()
    for rn, rt in req_refs:
        rtn = norm_title(rt) if rt else ''
        for cn, ct in case_refs:
            if cn != rn:
                continue
            ctn = norm_title(ct) if ct else ''
            if rtn and ctn and (ctn.startswith(rtn) or rtn.startswith(ctn.split(' (')[0])):
                exact.add(rn)
            else:
                broad.add(rn)
    return exact, broad - exact


def verification(root, pkg=PKG_DIR):
    idx = parse_package(root, pkg)
    lock = parse_lock(root)
    cases = [c for c in parse_cases(root) if not c['probe']]
    ui = parse_ui_specs(root)
    run = latest_run(root, lock)
    uirun = ui_run(root, lock)
    results = run['_results'] if run else {}
    rows = []
    cited_cases = set()
    for rid, r in sorted(idx['requirements'].items()):
        if r['status'] == 'Withdrawn':
            continue
        rv = set(r['v'])
        hits, broad_hits = [], []
        for c in cases:
            why = []
            if rv & set(c['v']):
                why.append('V')
            ex, br = _ref_match(r['spec'], c['spec'])
            if ex:
                why.append('§')
            if why:
                hits.append((c['id'], '+'.join(why)))
            elif br:
                broad_hits.append(c['id'])
        ui_hits = []
        for fn, u in ui.items():
            ex, br = _ref_match(r['spec'], u['spec'])
            if (rv & set(u['v'])) or ex:
                ui_hits.append(fn)
        mapped = hits if hits else [(cid, '§?') for cid in broad_hits]
        quality = 'exact' if hits else ('broad' if broad_hits else 'none')
        for cid, _ in mapped:
            cited_cases.add(cid)
        statuses = [results.get(cid) for cid, _ in mapped]
        if not mapped and not ui_hits:
            status = 'unverified'
        else:
            http_ok = all(s == 'pass' for s in statuses if s is not None)
            http_missing = any(s is None for s in statuses)
            ui_ok = all(uirun['files'].get(fn) == 'pass' for fn in ui_hits) if (uirun and ui_hits) else (not ui_hits)
            if (mapped and (not run or run['_binding'] != 'current lock')) or (ui_hits and (not uirun or 'stale' in uirun['_binding'])):
                status = 'stale'
            elif not http_ok or not ui_ok:
                status = 'failing'
            elif http_missing:
                status = 'not run'
            else:
                status = 'verified'
        rows.append({'id': rid, 'title': r['title'], 'method': r['verify'][0] if r['verify'] else '?', 'cases': [cid for cid, _ in mapped],
                     'quality': quality, 'ui': ui_hits, 'status': status, 'failing': [cid for cid, _ in mapped if results.get(cid) not in (None, 'pass')]})
    uncited = sorted(c['id'] for c in cases if c['id'] not in cited_cases)
    summary = {}
    for r in rows:
        summary[r['status']] = summary.get(r['status'], 0) + 1
    by_method = {}
    for r in rows:
        bm = by_method.setdefault(r['method'], {'total': 0, 'with_cases': 0, 'verified': 0, 'failing': 0, 'stale': 0, 'unverified': 0, 'not run': 0})
        bm['total'] += 1
        bm['with_cases'] += bool(r['cases'] or r['ui'])
        bm[r['status']] = bm.get(r['status'], 0) + 1
    return {'rows': rows, 'summary': summary, 'by_method': by_method, 'run': run, 'ui_run': uirun, 'lock': lock,
            'cases_total': len(cases), 'cases_uncited': uncited}


def render_verification(v, prefix):
    run, uirun, lock = v['run'], v['ui_run'], v['lock']
    L = ['# Verification status', '',
         DERIVED_BANNER + 'requirement → the oracle cases and UI specs that cite its SPEC sections or invariants → the latest unfiltered oracle run on target `default`.', '']
    L.append('## Evidence used')
    L.append('')
    L.append('| Source | Value |')
    L.append('|---|---|')
    L.append(f"| Configuration baseline | {'lock v' + str(lock.get('lockVersion')) + ' `' + str(lock.get('hash'))[:12] + '` frozen ' + str(lock.get('frozenAt'))[:10] + ' by ' + str(lock.get('approvedBy')) if lock else 'none (nothing frozen yet)'} |")
    if run:
        L.append(f"| Oracle run | `{run['_file']}` — {run.get('passed')}/{run.get('total')} passed, {run.get('failed')} failed, {run.get('errored')} errored, finished {str(run.get('finishedAt'))[:19]}Z, binding: **{run['_binding']}** |")
    else:
        L.append('| Oracle run | none on target `default` |')
    if uirun:
        L.append(f"| UI specs run | `{UI_REPORT}` — {uirun['stats'].get('expected', 0)} passed, {uirun['stats'].get('unexpected', 0)} failed, {uirun['stats'].get('flaky', 0)} flaky, started {str(uirun.get('started'))[:19]}, binding: **{uirun['_binding']}** |")
    L.append(f"| Oracle cases | {v['cases_total']} non-probe cases in `{CASES_DIR}/`; {len(v['cases_uncited'])} cite no requirement's sections or invariants |")
    L.append('')
    L.append('Status meaning: **verified** = every mapped case passed on the current lock (and every mapped UI spec passed after it); **failing** = a mapped case or UI spec failed; **stale** = the latest run is not bound to the current lock, so it is not evidence; **not run** = a mapped case is missing from the latest run; **unverified** = no case or UI spec maps to the requirement (for Test-method requirements this is a verification gap; for Demonstration, Analysis and Inspection it is expected unless a case happens to cover it). Mapping quality: *exact* = a case cites the same sub-heading or invariant; *broad* = only the same numbered section.')
    L.append('')
    L.append('## Summary')
    L.append('')
    L.append('| Method | Requirements | With evidence | Verified | Failing | Stale | Not run | Unverified |')
    L.append('|---|---:|---:|---:|---:|---:|---:|---:|')
    tot = {'total': 0, 'with_cases': 0, 'verified': 0, 'failing': 0, 'stale': 0, 'not run': 0, 'unverified': 0}
    for m in VERIFY_METHODS:
        bm = v['by_method'].get(m)
        if not bm:
            continue
        for k in tot:
            tot[k] += bm.get(k, 0)
        L.append(f"| {m} | {bm['total']} | {bm['with_cases']} | {bm.get('verified', 0)} | {bm.get('failing', 0)} | {bm.get('stale', 0)} | {bm.get('not run', 0)} | {bm.get('unverified', 0)} |")
    L.append(f"| **Total** | **{tot['total']}** | **{tot['with_cases']}** | **{tot['verified']}** | **{tot['failing']}** | **{tot['stale']}** | **{tot['not run']}** | **{tot['unverified']}** |")
    L.append('')
    L.append('## Per requirement')
    L.append('')
    L.append('| Requirement | Method | Oracle cases (mapping) | UI specs | Status |')
    L.append('|---|---|---|---|---|')
    for r in v['rows']:
        cases = ', '.join(r['cases'][:12]) + (f' … (+{len(r["cases"]) - 12})' if len(r['cases']) > 12 else '')
        q = f" *({r['quality']})*" if r['cases'] else ''
        fail = (' — failing: ' + ', '.join(r['failing'])) if r['failing'] else ''
        L.append(f"| [{r['id']}](02-system-requirements.md#{r['id'].lower()}) · {r['title']} | {r['method']} | {cases or '—'}{q} | {', '.join(r['ui']) or '—'} | **{r['status']}**{fail} |")
    L.append('')
    L.append('## Cases citing no requirement')
    L.append('')
    L.append('Cases whose `derivedFrom` sections and invariants map to no requirement: either a requirement is missing from this package, or the case covers plumbing the Equivalence Profile pins (no requirement expected).')
    L.append('')
    L.append(', '.join(v['cases_uncited']) if v['cases_uncited'] else 'none')
    L.append('')
    return '\n'.join(L)


def render_vcrm_block(v, idx):
    """The VCRM summary table for 07-traceability.md, derived (replaces the hand-counted one)."""
    cats = {}
    reqs = idx['requirements']
    stat = {r['id']: r for r in v['rows']}
    for rid, r in reqs.items():
        if r['status'] == 'Withdrawn':
            continue
        c = cats.setdefault(r['cat'], {'n': 0, 'Test': 0, 'Demonstration': 0, 'Analysis': 0, 'Inspection': 0, 'Agreed': 0, 'TBR': 0, 'verified': 0, 'failing': 0, 'unverified': 0})
        c['n'] += 1
        if r['verify']:
            c[r['verify'][0]] += 1
        c[r['status']] = c.get(r['status'], 0) + 1
        s = stat.get(rid, {}).get('status')
        if s in ('verified', 'failing', 'unverified'):
            c[s] += 1
    names = {'FUN': 'Functional', 'PER': 'Performance', 'INT': 'Interface', 'DAT': 'Data & retention', 'SEC': 'Security & access', 'HFA': 'Human factors & accessibility', 'OPS': 'Operational & availability', 'CON': 'Constraints'}
    L = ['| Category | Code | Total | Test (Oracle / UI) | Demonstration | Analysis | Inspection | Agreed | TBR | Verified now | Failing | No evidence |',
         '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    T = {k: 0 for k in ('n', 'Test', 'Demonstration', 'Analysis', 'Inspection', 'Agreed', 'TBR', 'verified', 'failing', 'unverified')}
    for code in ('FUN', 'PER', 'INT', 'DAT', 'SEC', 'HFA', 'OPS', 'CON'):
        c = cats.get(code)
        if not c:
            continue
        for k in T:
            T[k] += c.get(k, 0)
        L.append(f"| {names.get(code, code)} | {code} | {c['n']} | {c['Test']} | {c['Demonstration']} | {c['Analysis']} | {c['Inspection']} | {c.get('Agreed', 0)} | {c.get('TBR', 0)} | {c['verified']} | {c['failing']} | {c['unverified']} |")
    L.append(f"| **Total** | | **{T['n']}** | **{T['Test']}** | **{T['Demonstration']}** | **{T['Analysis']}** | **{T['Inspection']}** | **{T['Agreed']}** | **{T['TBR']}** | **{T['verified']}** | **{T['failing']}** | **{T['unverified']}** |")
    L.append('')
    L.append(f"Verified / failing / no evidence come from [10-verification-status.md](10-verification-status.md) ({'run bound to the current lock' if v['run'] and v['run']['_binding'] == 'current lock' else 'latest run not bound to the current lock: counts are indicative, not evidence'}).")
    return '\n'.join(L)


# ---------------------------------------------------------------- change control chapter
def render_change_control(root):
    lock = parse_lock(root)
    trans = parse_transitions(root)
    scrs = parse_scrs(root)
    bp = parse_backprop(root)
    versions = parse_prototype_versions(root)
    L = ['# Change control and configuration baseline', '',
         DERIVED_BANNER + 'the lock (`specs/spec.lock.json`), the stage record (`specs/logs/transitions.jsonl`), the Spec Change Requests (`specs/changes/SCR-*.md`), the backprop log and the prototype record.', '']
    L.append('## Configuration baseline (the lock)')
    L.append('')
    if lock:
        L.append('| Version | Frozen | Approved by | Reason | Hash | Files |')
        L.append('|---|---|---|---|---|---:|')
        for hst in lock.get('history', []):
            L.append(f"| v{hst.get('lockVersion')} | {str(hst.get('frozenAt'))[:10]} | {hst.get('approvedBy')} | {hst.get('reason')} | `{str(hst.get('hash'))[:12]}` | |")
        L.append(f"| **v{lock.get('lockVersion')}** (current) | {str(lock.get('frozenAt'))[:10]} | {lock.get('approvedBy')} | {lock.get('reason')} | `{str(lock.get('hash'))[:12]}` | {len(lock.get('files', {}))} |")
        L.append('')
        L.append('A systems engineer reads the lock as the configuration baseline: every frozen file is hashed, and `sdd.cjs verify` reports any change outside change control. Between a Class 1 iteration\'s start and its re-freeze the lock is broken by design (the spec is being extended); builds are not graded until it is re-frozen.')
    else:
        L.append('No lock yet: nothing is under configuration control until the Stage 04 freeze.')
    L.append('')
    L.append('## Milestones (stage transitions)')
    L.append('')
    L.append('| Date | Stage completed | Approval | Lock at the time | Note |')
    L.append('|---|---|---|---|---|')
    for t in trans:
        L.append(f"| {str(t.get('ts'))[:10]} | `{t.get('completed')}`{(' → resume ' + str(t.get('resume'))) if t.get('resume') else ''} | {t.get('approvedBy') or '—'} | {('`' + str(t.get('lockHash'))[:12] + '`') if t.get('lockHash') else '—'} | {str(t.get('note', '')).replace('|', '\\|')[:140]} |")
    L.append('')
    L.append('## Prototype versions (what the product owner saw)')
    L.append('')
    if versions:
        L.append('| Record | Version | Date | What changed | Gaps closed | Decisions |')
        L.append('|---|---|---|---|---|---|')
        for vv in versions:
            L.append(f"| {vv['record'][:60]} | {vv['version']} | {vv['date']} | {vv['changed'].replace('|', '\\|')[:220]} | {vv['gaps']} | {vv['dec']} |")
    else:
        L.append('No prototype versions recorded.')
    L.append('')
    L.append('## Spec Change Requests (engineering change proposals and problem reports)')
    L.append('')
    L.append('Class A = implementation or oracle defect (no frozen-set meaning change), B = oracle or contract defect, C = spec gap, D = spec error (the user decides new policy), E = pipeline defect. Status comes from the SCR\'s own Status row.')
    L.append('')
    L.append('| SCR | Date | Title | Class | Status | Cases changed | Decisions | Review comments |')
    L.append('|---|---|---|---|---|---:|---|---|')
    for s in scrs:
        L.append(f"| {s['id']} | {s['date']} | {s['title'].replace('|', '\\|')} | {s['class'].replace('|', '\\|')} | {s['status']} | {len(s['cases'])} | {', '.join(s['dec'][:6])}{' …' if len(s['dec']) > 6 else ''} | {', '.join(s['rc']) or '—'} |")
    L.append('')
    L.append('## Backprop log (defects traced to their source)')
    L.append('')
    if bp:
        L.append('| SCR | Date | Defect | Class | Root cause | Source fix | Invariant |')
        L.append('|---|---|---|---|---|---|---|')
        for b in bp:
            L.append(f"| {b['scr']} | {b['date']} | {b['bug'][:140]} | {b['class']} | {b['cause'][:120]} | {b['fix'][:140]} | {b['invariant']} |")
    else:
        L.append('No backprop entries.')
    L.append('')
    return '\n'.join(L)


# ---------------------------------------------------------------- GAPS.md block for 08-open-items.md
GAPS_BEGIN, GAPS_END = '<!-- gaps-md:begin -->', '<!-- gaps-md:end -->'
VCRM_BEGIN, VCRM_END = '<!-- vcrm:begin -->', '<!-- vcrm:end -->'


def render_gaps_block(root):
    rows = parse_gaps_md(read(root, GAPS) or '')
    L = [GAPS_BEGIN, '', f'*Derived by `pkg.py derive` from `{GAPS}` (the pipeline\'s gap register; ids are the register\'s own and are never renumbered here).*', '']
    opn = [g for g in rows if g['status'] == 'open']
    dfr = [g for g in rows if g['status'] == 'deferred']
    closed = [g for g in rows if g['status'] in ('resolved', 'confirmed')]
    L.append(f'**Open:** {len(opn)} · **Deferred to a later slice:** {len(dfr)} · **Resolved or confirmed:** {len(closed)}')
    L.append('')
    L.append('| Gap | Stage | Kind | What is undecided | Provisional reading (the prototype builds this) | Status |')
    L.append('|---|---|---|---|---|---|')
    for g in opn + dfr + closed:
        L.append(f"| <a id=\"{g['id'].lower()}\"></a>{g['id']} | {g['stage']} | {g['kind']} | {g['gap'].replace('|', '\\|')} | {g['assumption'].replace('|', '\\|')} | {g['status']} |")
    L.append('')
    L.append(GAPS_END)
    return '\n'.join(L)


def replace_block(text, begin, end, body):
    if begin in text and end in text:
        pre = text[:text.index(begin)]
        post = text[text.index(end) + len(end):]
        return pre + body + post
    return None


# ---------------------------------------------------------------- UI design chapter
def parse_wireframes(root):
    out = {}
    d = os.path.join(root, WIREFRAMES_DIR)
    if not os.path.isdir(d):
        return out
    for fn in sorted(os.listdir(d)):
        if not fn.endswith('.html'):
            continue
        txt = read(root, os.path.join(WIREFRAMES_DIR, fn)) or ''
        frames = [re.sub(r'<[^>]+>', '', m).strip() for m in re.findall(r'<h2[^>]*>(.*?)</h2>', txt, re.S)]
        tids = sorted(set(re.findall(r'data-testid="([^"]+)"', txt)))
        out[fn] = {'file': fn, 'frames': frames, 'testids': tids}
    return out


def render_ui_design(root, pkg=PKG_DIR):
    idx = parse_package(root, pkg)
    design = read(root, DESIGN) or ''
    spec = read(root, SPEC) or ''
    wfs = parse_wireframes(root)
    L = ['# User interface design baseline', '',
         DERIVED_BANNER + 'DESIGN.md §Approved Wireframes, the frozen wireframes in `specs/wireframes/`, and SPEC §14 (component hierarchy, screen flow, interaction contract, copy table).', '']
    # SPEC §14 numbers
    sec14 = spec_section_text(spec, '14')
    comp = len(re.findall(r'^[│├└ ]*[├└]── ([A-Z][A-Za-z0-9]+)', sec14, re.M)) + (1 if re.search(r'^AppShell\s*$', sec14, re.M) else 0)
    flow = len(re.findall(r'^\d+\. \*\*', spec_section_text(spec, '14.2'), re.M))
    copy_rows = len([l for l in spec_section_text(spec, '14.4').splitlines() if l.startswith('| `')])
    tokens = len(re.findall(r'^\s{2,}[a-z][a-z0-9-]*:\s*"?[^"\n]+"?\s*$', design.split('---\n')[1] if design.count('---\n') >= 2 else '', re.M))
    L.append('## Baseline in numbers')
    L.append('')
    L.append('| Item | Count | Source |')
    L.append('|---|---:|---|')
    L.append(f'| Components in the hierarchy | {comp} | SPEC §14.1 |')
    L.append(f'| Screen-flow rules | {flow} | SPEC §14.2 |')
    L.append(f'| Copy-table entries (character-exact strings) | {copy_rows} | SPEC §14.4 |')
    L.append(f'| Design tokens (front matter) | {tokens} | DESIGN.md |')
    L.append(f"| Wireframe pages | {len(wfs)} | `{WIREFRAMES_DIR}/` |")
    L.append(f"| Frames (screen states) | {sum(len(w['frames']) for w in wfs.values())} | wireframes `<h2>` frame titles |")
    L.append(f"| Distinct test ids across wireframes | {len(set(t for w in wfs.values() for t in w['testids']))} | `data-testid` (profile UI-1, UI-4) |")
    L.append('')
    L.append('The wireframes are part of the frozen set: inside each frame\'s window the DOM order, roles, accessible names, test ids and texts are normative, and build B (a second, independent implementation) sees only them, never the prototype. Stage 06 (visual acceptance) and the frozen UI specs grade against them.')
    L.append('')
    L.append('## Screen catalog')
    L.append('')
    L.append('| Screen | Wireframe | Frames | Test ids | SPEC refs | Requirements realized |')
    L.append('|---|---|---:|---:|---|---|')
    aw = design[design.index('## Approved Wireframes'):] if '## Approved Wireframes' in design else ''
    screens = re.findall(r'^### (.+?): \[([^\]]+)\]\(wireframes/([^)]+)\)\s*\n\n(.*?)(?=\n\n|\Z)', aw, re.M | re.S)
    reqs14 = {}
    for rid, r in idx['requirements'].items():
        if r['status'] == 'Withdrawn':
            continue
        for num, _ in r['spec']:
            if num.startswith('14'):
                reqs14.setdefault(rid, r)
    for title, name, fn, para in screens:
        w = wfs.get(fn, {'frames': [], 'testids': []})
        refs = sorted(set('§' + n for n, _ in spec_refs(para)))
        L.append(f"| {title} | [{name}](../../{WIREFRAMES_DIR}/{fn}) | {len(w['frames'])} | {len(w['testids'])} | {', '.join(refs)[:120] or '—'} | see below |")
    L.append('')
    L.append('## Frames per screen')
    L.append('')
    for title, name, fn, para in screens:
        w = wfs.get(fn)
        if not w:
            continue
        L.append(f'### {title} (`{fn}`)')
        L.append('')
        L.append(para.strip().replace('\n', ' '))
        L.append('')
        for f in w['frames']:
            L.append(f'- {f}')
        L.append('')
        L.append('Test ids: ' + (', '.join(f'`{t}`' for t in w['testids']) or '—'))
        L.append('')
    L.append('## Requirements realized by the user interface')
    L.append('')
    L.append('Requirements whose SPEC references include §14 (the user-interface sections); Stage 06 visual acceptance and the frozen UI specs verify them.')
    L.append('')
    L.append('| Requirement | Method | SPEC §14 refs |')
    L.append('|---|---|---|')
    for rid, r in sorted(reqs14.items()):
        L.append(f"| [{rid}](02-system-requirements.md#{rid.lower()}) · {r['title']} | {r['verify'][0] if r['verify'] else '?'} | {'; '.join('§' + n + (' ' + t if t else '') for n, t in r['spec'] if n.startswith('14'))[:160]} |")
    L.append('')
    return '\n'.join(L)


def spec_section_text(text, num):
    """Body of a numbered section (## N. or ### N.N) up to the next heading of the same or higher level."""
    m = re.search(r'^(#{2,3}) ' + re.escape(num) + r'\.?\s[^\n]*\n', text, re.M)
    if not m:
        return ''
    level = len(m.group(1))
    rest = text[m.end():]
    n = re.search(r'^#{1,' + str(level) + r'} ', rest, re.M)
    return rest[:n.start()] if n else rest


# ---------------------------------------------------------------- review loop
RC_ROW = re.compile(r'^RC-\d+$')


def parse_review_log(root, pkg=PKG_DIR):
    txt = read(root, os.path.join(pkg, REVIEW_FILE)) or ''
    out = []
    for c in table_rows(txt, r'RC-\d+'):
        rid = re.search(r'RC-\d+', c[0])
        if not rid or len(c) < 8:
            continue
        out.append({'id': rid.group(0), 'date': c[1], 'reviewer': c[2], 'targets': re.findall(r'[A-Z]+-(?:SR|DD|IF|DIA)-[A-Z0-9-]+|TBR-\d+|G[0-9A-Za-z]*-[0-9A-Za-z]+|DEC\d{3}|V\d+|§\d+(?:\.\d+)*', c[3]),
                    'comment': c[4], 'classification': c[5].lower(), 'status': c[6].lower(), 'resolution': c[7]})
    return out


def review_resolve(root, rc_id=None, pkg=PKG_DIR):
    idx = parse_package(root, pkg)
    v = verification(root, pkg)
    vrows = {r['id']: r for r in v['rows']}
    rcs = [r for r in parse_review_log(root, pkg) if (rc_id is None and r['status'] == 'open') or r['id'] == rc_id]
    if not rcs:
        print('No matching review comments (open rows in ' + REVIEW_FILE + ').')
        return
    for rc in rcs:
        print(f"## {rc['id']} ({rc['status']}, {rc['classification'] or 'unclassified'}) — {rc['reviewer']}, {rc['date']}")
        print(f"> {rc['comment']}\n")
        for tgt in rc['targets']:
            print(f'- **{tgt}**')
            r = idx['requirements'].get(tgt)
            if r:
                print(f"  - requirement: {r['title']} · decisions {', '.join(r['dec']) or '—'} · SPEC {'; '.join('§' + n + ' ' + t for n, t in r['spec']) or '—'} · invariants {', '.join(r['v']) or '—'} · status {r['status']} {', '.join(r['tbr'])}")
                vr = vrows.get(tgt)
                if vr:
                    print(f"  - evidence: {vr['status']}; cases {', '.join(vr['cases'][:10]) or '—'}{' …' if len(vr['cases']) > 10 else ''}; UI specs {', '.join(vr['ui']) or '—'}")
                dias = [d['id'] for d in idx['diagrams'].values() if set(d.get('dec', [])) & set(r['dec'])]
                if dias:
                    print(f"  - diagrams depicting its decisions: {', '.join(dias)}")
            dd = idx['design_decisions'].get(tgt)
            if dd:
                print(f"  - design decision: {dd['title']} · decisions {', '.join(dd['dec'])} · requirements {', '.join(dd['sr'])}")
            itf = idx['interfaces'].get(tgt)
            if itf:
                print(f"  - interface: {itf['title']} · decisions {', '.join(itf['dec'])} · requirements {', '.join(itf['sr'])} · status {itf['status']}")
            tb = idx['tbr'].get(tgt)
            if tb:
                print(f"  - TBR: decisions {', '.join(tb['dec'])} · requirements {', '.join(tb['sr'])} · {'closed' if tb['closed'] else 'open'}")
            dg = idx['diagrams'].get(tgt)
            if dg:
                print(f"  - diagram: {dg['title']} · decisions {', '.join(dg.get('dec', []))} · SPEC {', '.join('§' + s for s in dg.get('spec', []))}")
            if re.match(r'^DEC\d{3}$', tgt):
                fp = fingerprint(root)
                dinfo = fp['decisions'].get(tgt)
                print(f"  - decision: {dinfo['title'] if dinfo else 'unknown'}; requirements citing it: {', '.join(k for k, r in idx['requirements'].items() if tgt in r['dec']) or '—'}")
        print()
        print('Classification guide: **package defect** (the package misread the spec → fix the package only) · **clarification** (wording; a DEC entry of kind clarification) · **technical** (a mechanics change inside the Equivalence Profile → SCR class B/C or a hardening fix) · **policy** (a business decision → the product owner; SCR class D after a freeze, a GAPS.md policy row + demo question before it).')
        print()


def next_scr_id(root):
    nums = [int(m.group(1)) for fn in os.listdir(os.path.join(root, CHANGES_DIR)) for m in [re.match(r'^SCR-(\d{3})', fn)] if m] if os.path.isdir(os.path.join(root, CHANGES_DIR)) else []
    return f'SCR-{(max(nums) + 1 if nums else 1):03d}'


def review_draft(root, rc_id, kind, pkg=PKG_DIR):
    rcs = [r for r in parse_review_log(root, pkg) if r['id'] == rc_id]
    if not rcs:
        sys.exit(f'{rc_id}: not in {REVIEW_FILE}')
    rc = rcs[0]
    idx = parse_package(root, pkg)
    lock = parse_lock(root)
    outdir = os.path.join(root, REVIEW_DRAFTS_DIR)
    os.makedirs(outdir, exist_ok=True)
    today = datetime.date.today().isoformat()
    secs, decs, vs = set(), set(), set()
    for tgt in rc['targets']:
        r = idx['requirements'].get(tgt) or idx['design_decisions'].get(tgt) or idx['interfaces'].get(tgt)
        if r:
            decs.update(r.get('dec', []))
            secs.update('§' + n + (' ' + t if t else '') for n, t in r.get('spec', []))
            vs.update(r.get('v', []))
        if re.match(r'^DEC\d{3}$', tgt):
            decs.add(tgt)
        if tgt.startswith('§'):
            secs.add(tgt)
        if re.match(r'^V\d+$', tgt):
            vs.add(tgt)
    if kind == 'scr':
        if not lock:
            print('WARN   no lock exists: before the first freeze the pipeline records a GAPS.md row and a DEC entry instead of an SCR (use --kind gap).')
        sid = next_scr_id(root)
        path = os.path.join(outdir, f'SCR-draft-{rc_id}.md')
        body = f"""# {sid}: <one-line title from {rc_id}>

| Field | Value |
|-------|-------|
| Date | {today} |
| Trigger | design-package review comment {rc_id} ({rc['reviewer']}, {rc['date']}): "{rc['comment']}" — targets {', '.join(rc['targets'])} |
| Observation | <request → observed vs expected, or the two readings two builders could take> |
| Class | <A′ oracle gap / B oracle or contract defect / C spec gap / D spec error (policy, the user decides) / E pipeline> |
| Root cause | <one sentence> |
| Stage that should have caught it | <e.g. 03 hardening round 1 (Fork Tester)> |
| Proposed frozen-set edits | SPEC {', '.join(sorted(secs)) or '<§ …>'}; decisions touched {', '.join(sorted(decs)) or '—'}; invariants {', '.join(sorted(vs, key=lambda x: int(x[1:]))) or '—'}; contracts <files> |
| New / changed cases | <ids + what each one distinguishes> |
| New invariant | <`- **Vn:** …` or none> |
| Pipeline change | none |
| Status | proposed (from {rc_id}; needs the product owner's approval before any frozen file changes) |

## Notes
- Drafted by `pkg.py review --draft {rc_id} --kind scr`. Move to `{CHANGES_DIR}/{sid}.md` when the user approves it; the package's {REVIEW_FILE} row then cites {sid}, and the next revision's changelog closes {rc_id}.
"""
    else:
        path = os.path.join(outdir, f'GAP-draft-{rc_id}.md')
        body = f"""# Draft from review comment {rc_id}

Drafted by `pkg.py review --draft {rc_id} --kind gap`. Nothing below is applied: the user adds the GAPS.md row and the DECISION_LOG entry (or asks the agent to) in the current pipeline stage.

## Proposed `specs/GAPS.md` row

| ID | Stage | Kind | Gap | Draft assumption | Status |
|---|---|---|---|---|---|
| G-<next> | <current stage> | policy \\| technical | {rc['comment'].replace('|', '\\|')} (review {rc_id}, {rc['reviewer']}) | <what the prototype does today; cite {', '.join(sorted(decs)) or 'the DEC that set it'}> | open |

## Proposed `specs/DECISION_LOG.md` entry (when the product owner decides)

| # | Decision | Options Considered | Choice | Rationale | Reflected in |
|---|----------|-------------------|--------|-----------|--------------|
| DEC<next> | <topic> (design-package review {rc_id}) | <A, B> | <choice> | <why; "reviewer: …"> | SPEC {', '.join(sorted(secs)) or '§ …'}; {', '.join(sorted(vs, key=lambda x: int(x[1:]))) or ''} |

## Spec locations the comment touches
- SPEC: {', '.join(sorted(secs)) or '—'}
- Decisions: {', '.join(sorted(decs)) or '—'}
- Invariants: {', '.join(sorted(vs, key=lambda x: int(x[1:]))) or '—'}
"""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(body)
    print(f'Wrote {os.path.relpath(path, root)} (draft only; specs/ untouched)')


# ---------------------------------------------------------------- derive (all generated chapters and blocks)
def derived_changes(root, pkg=PKG_DIR):
    """Names of derived files/blocks that differ from what derive would write now (no output, no writes)."""
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        return derive(root, False, pkg)


def derive(root, write=False, pkg=PKG_DIR):
    idx = parse_package(root, pkg)
    v = verification(root, pkg)
    outputs = {
        CHANGE_FILE: render_change_control(root),
        VERIFY_FILE: render_verification(v, detect_prefix(idx)),
        UI_FILE: render_ui_design(root, pkg),
    }
    blocks = {
        OPEN_FILE: (GAPS_BEGIN, GAPS_END, render_gaps_block(root)),
        TRACE_FILE: (VCRM_BEGIN, VCRM_END, VCRM_BEGIN + '\n' + render_vcrm_block(v, idx) + '\n' + VCRM_END),
    }
    changed = []
    for fn, body in outputs.items():
        cur = read(root, os.path.join(pkg, fn))
        if cur != body:
            changed.append(fn)
            if write:
                open(os.path.join(root, pkg, fn), 'w', encoding='utf-8').write(body)
    for fn, (b, e, body) in blocks.items():
        cur = read(root, os.path.join(pkg, fn)) or ''
        new = replace_block(cur, b, e, body)
        if new is None:
            changed.append(f'{fn} (no {b} … {e} markers: add them where the derived block belongs)')
            continue
        if new != cur:
            changed.append(fn)
            if write:
                open(os.path.join(root, pkg, fn), 'w', encoding='utf-8').write(new)
    s = v['summary']
    print(f"Verification: {s.get('verified', 0)} verified, {s.get('failing', 0)} failing, {s.get('stale', 0)} stale, {s.get('not run', 0)} not run, {s.get('unverified', 0)} unverified of {len(v['rows'])} requirements; "
          f"run binding: {v['run']['_binding'] if v['run'] else 'no run'}")
    if changed:
        print(('Wrote: ' if write else 'Would change (run with --write): ') + ', '.join(changed))
    else:
        print('Derived chapters and blocks are current.')
    return changed



# ---------------------------------------------------------------- compile
CHAPTERS = [
    ('chapter-0-executive-overview', 'Executive Overview & Package Status', 'README.md', False),
    ('chapter-1-system-overview', '1. System Overview & Concept of Operations', '01-system-overview.md', False),
    ('chapter-2-system-requirements', '2. System Requirements', '02-system-requirements.md', False),
    ('chapter-3-design-decisions', '3. Design Decisions', '03-design-decisions.md', False),
    ('chapter-4-architecture', '4. System Architecture & Component Allocations', '04-architecture.md', False),
    ('chapter-5-behavior', '5. System Behavior (Statecharts, Activity & Sequences)', '05-behavior.md', False),
    ('chapter-6-external-interfaces', '6. External Interfaces (Interface Control Table)', '06-external-interfaces.md', True),
    ('chapter-7-traceability', '7. Traceability Matrix', '07-traceability.md', True),
    ('chapter-8-open-items', '8. Open Items, TBR Register & Gaps', '08-open-items.md', True),
    ('chapter-9-change-control', '9. Change Control & Configuration Baseline', '09-change-control.md', True),
    ('chapter-10-verification-status', '10. Verification Status (Oracle Evidence)', '10-verification-status.md', True),
    ('chapter-11-ui-design', '11. User Interface Design Baseline', '11-ui-design.md', True),
    ('chapter-12-review-log', '12. Review Log', '12-review-log.md', True),
    ('chapter-13-changelog', '13. Revision History (Changelog)', 'CHANGELOG.md', False),
]

FILE_TO_CHAPTER = {fn: cid for cid, _, fn, _ in CHAPTERS}


def _html_esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def _slug(s):
    t = re.sub(r'<[^>]+>', '', s)
    t = re.sub(r'[^a-zA-Z0-9\s-]', '', t).strip().lower()
    return re.sub(r'[\s-]+', '-', t)


def _inline_md(s):
    anchors = []
    def save_anchor(m):
        anchors.append(m.group(0))
        return f'\x00ANC{len(anchors)-1}\x00'
    s = re.sub(r'<a\s+id="[^"]+"\s*>\s*</a>|<br\s*/?>', save_anchor, s)
    codes = []
    def save_code(m):
        codes.append(f'<code>{_html_esc(m.group(1))}</code>')
        return f'\x00COD{len(codes)-1}\x00'
    s = re.sub(r'`([^`]+)`', save_code, s)
    s = _html_esc(s)
    def repl_link(m):
        label, url = m.group(1), m.group(2)
        if url.startswith('diagrams/') and url.endswith('.drawio'):
            dm = re.search(r'([A-Z]+-DIA-\d{2}[a-z]?)', url, re.I)
            if dm:
                return f'<a href="#fig-{dm.group(1).lower()}">{label}</a>'
        if '#' in url:
            fn, frag = url.split('#', 1)
            return f'<a href="#{frag}">{label}</a>'
        if url in FILE_TO_CHAPTER:
            return f'<a href="#{FILE_TO_CHAPTER[url]}">{label}</a>'
        return f'<a href="{url}">{label}</a>'
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', repl_link, s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', s)
    for idx, c in enumerate(codes):
        s = s.replace(f'\x00COD{idx}\x00', c)
    for idx, a in enumerate(anchors):
        s = s.replace(f'\x00ANC{idx}\x00', a)
    return s


def _sync_svg_from_drawio(drawio_text, svg_text):
    m = re.search(r'id="title"[^>]*value="([^"]+)"', drawio_text)
    if not m:
        return svg_text
    val = m.group(1).replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#10;', '<br>')
    dm = re.search(r'(Date:.*)$', val, re.S)
    if dm:
        svg_text = re.sub(r'Date:\s*\d{4}-\d{2}-\d{2}\s*·\s*Source:.*?(?=</div>)', dm.group(1), svg_text, count=1)
    return svg_text


def _can_embed_diagram(fn, did):
    if fn == '04-architecture.md':
        return bool(re.match(r'^[A-Z]+-DIA-0[1-4]', did))
    if fn == '05-behavior.md':
        return not bool(re.match(r'^[A-Z]+-DIA-0[1-4]', did))
    return False


def _md_to_html(md_text, fn, root, pkg, dias, embedded_dias):
    lines = md_text.splitlines()
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.strip() == '---':
            out.append('<hr>')
            i += 1
            continue
        if re.match(r'^<a\s+id="[^"]+"\s*>\s*</a>\s*$', line.strip()):
            out.append(line.strip())
            i += 1
            continue
        if line.startswith('```'):
            i += 1
            buf = []
            while i < len(lines) and not lines[i].startswith('```'):
                buf.append(_html_esc(lines[i]))
                i += 1
            i += 1
            out.append('<pre><code>' + '\n'.join(buf) + '</code></pre>')
            continue
        hm = re.match(r'^(#{1,6})\s+(.+?)\s*$', line)
        if hm:
            lvl = len(hm.group(1))
            raw = hm.group(2)
            sid = _slug(raw)
            out.append(f'<h{lvl} id="{sid}">{_inline_md(raw)}</h{lvl}>')
            i += 1
            continue
        if line.startswith('>'):
            buf = []
            while i < len(lines) and lines[i].startswith('>'):
                buf.append(lines[i][1:].strip())
                i += 1
            out.append('<blockquote><p>' + _inline_md(' '.join(buf)) + '</p></blockquote>')
            continue
        if line.startswith('|'):
            tlines = []
            while i < len(lines) and lines[i].startswith('|'):
                tlines.append(lines[i])
                i += 1
            if len(tlines) >= 2:
                hdr = split_cells(tlines[0])
                out.append('<table><thead><tr>' + ''.join(f'<th>{_inline_md(c)}</th>' for c in hdr) + '</tr></thead><tbody>')
                for tl in tlines[2:]:
                    if re.match(r'^\|\s*:?-', tl):
                        continue
                    row = split_cells(tl)
                    out.append('<tr>' + ''.join(f'<td>{_inline_md(c)}</td>' for c in row) + '</tr>')
                out.append('</tbody></table>')
            continue
        lm = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', line)
        if lm:
            ordered = lm.group(2).endswith('.')
            tag = 'ol' if ordered else 'ul'
            out.append(f'<{tag}>')
            while i < len(lines):
                m2 = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', lines[i])
                if not m2 or (m2.group(2).endswith('.') != ordered):
                    break
                item_txt = m2.group(3)
                i += 1
                while i < len(lines) and lines[i].startswith('  ') and not re.match(r'^(\s*)([-*]|\d+\.)\s+', lines[i]):
                    item_txt += ' ' + lines[i].strip()
                    i += 1
                out.append(f'<li>{_inline_md(item_txt)}</li>')
            out.append(f'</{tag}>')
            continue
        pbuf = []
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#{1,6}\s|>|\||```|---|\s*[-*]\s|\s*\d+\.\s|<a\s)', lines[i]):
            pbuf.append(lines[i].strip())
            i += 1
        ptxt = ' '.join(pbuf)
        out.append(f'<p>{_inline_md(ptxt)}</p>')
        for dm in re.findall(r'\((diagrams/([A-Z]+-DIA-\d{2}[a-z]?)[^)]*\.drawio)\)', ptxt):
            dfile, did = dm[0], dm[1]
            if _can_embed_diagram(fn, did) and did not in embedded_dias and did in dias:
                embedded_dias.add(did)
                svg_rel = dfile[:-7] + '.svg'
                svg_abs = os.path.join(root, pkg, svg_rel)
                drawio_abs = os.path.join(root, pkg, dfile)
                if os.path.exists(svg_abs):
                    svg_txt = open(svg_abs, encoding='utf-8').read()
                    if os.path.exists(drawio_abs):
                        svg_txt = _sync_svg_from_drawio(open(drawio_abs, encoding='utf-8').read(), svg_txt)
                        open(svg_abs, 'w', encoding='utf-8').write(svg_txt)
                    dinfo = dias[did]
                    out.append(
                        f'<div class="landscape-section"><figure class="diagram-figure" id="fig-{did.lower()}">'
                        f'<div class="diagram-svg-container">{svg_txt}</div>'
                        f'<figcaption class="diagram-caption"><strong>Figure {did}:</strong> {_html_esc(dinfo.get("title", ""))}'
                        f'<span class="diagram-meta">({dfile})</span></figcaption></figure></div>'
                    )
    return '\n'.join(out)


def cover_settings(root, man, idx, pkg=PKG_DIR):
    """Cover page and deliverable names: manifest.json `cover` {org, product, title, description, footer} and `pdf`
    (kept across `stamp`), with defaults from the package README's first heading."""
    readme = read(root, os.path.join(pkg, README)) or ''
    h1 = re.search(r'^# (.+)$', readme, re.M)
    title = h1.group(1).strip() if h1 else 'Systems engineering design package'
    product = re.split(r'\s+(systems?[- ]engineering|design package|SE package)', title, maxsplit=1, flags=re.I)[0].strip() or title
    cov = dict(man.get('cover') or {})
    cov.setdefault('org', '')
    cov.setdefault('product', product.upper())
    cov.setdefault('title', title)
    cov.setdefault('description', f'Systems-engineering synthesis of {product}, derived from its Spec-Driven Development spec set.')
    cov.setdefault('footer', 'Derived view; the frozen spec set is authoritative')
    cov['pdf'] = man.get('pdf') or (_slug(product) + '-design-package.pdf')
    return cov


def compile_package(root, pdf=False, pkg=PKG_DIR):
    fp = fingerprint(root)
    idx = parse_package(root, pkg)
    mpath = os.path.join(root, pkg, 'manifest.json')
    man = json.load(open(mpath, encoding='utf-8')) if os.path.exists(mpath) else {}
    rev = man.get('revision', 1)
    b_short = (man.get('baseline') or {}).get('short') or fp.get('short') or 'HEAD'
    b_date = man.get('date') or datetime.date.today().isoformat()
    c = idx['counts']
    v_total = len(fp['invariants'])
    cited = {v for r in idx['requirements'].values() if r['status'] != 'Withdrawn' for v in r['v']}
    v_cited = len(cited & set(fp['invariants']))

    css = ''
    existing_html = read(root, os.path.join(pkg, 'index.html'))
    if existing_html:
        cm = re.search(r'<style>(.*?)</style>', existing_html, re.S)
        if cm:
            css = cm.group(1)
    if not css:
        css = 'body { font-family: sans-serif; font-size: 9pt; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #cbd5e1; padding: 4px; }'

    cover = cover_settings(root, man, idx, pkg)
    prefix = detect_prefix(idx, man)
    toc_items = []
    chapters_html = []
    embedded_dias = set()
    for cid, title, fn, is_landscape in CHAPTERS:
        md = read(root, os.path.join(pkg, fn))
        if not md:
            continue
        toc_items.append(f'      <li class="toc-item"><a href="#{cid}">{_html_esc(title)}</a><span class="toc-dots"></span><span class="toc-chapter-ref">{fn}</span></li>')
        cls = 'chapter landscape-chapter' if is_landscape else 'chapter'
        body_html = _md_to_html(md, fn, root, pkg, idx['diagrams'], embedded_dias)
        chapters_html.append(
            f'  <section class="{cls}" id="{cid}">\n'
            f'    <div class="chapter-header"><h1 class="chapter-title">{_html_esc(title)}</h1></div>\n'
            f'    <div class="chapter-body">{body_html}</div>\n'
            f'  </section>'
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{_html_esc(cover['title'])} — Revision {rev}</title>
  <style>{css}</style>
</head>
<body>
  <div class="cover-page">
    <div class="cover-header">
      <div class="org-title">{_html_esc(cover['org'])}</div>
      <div class="doc-type">Systems Engineering Baseline · Revision {rev}</div>
    </div>
    <div class="cover-body">
      <div class="project-name">{_html_esc(cover['product'])}</div>
      <div class="doc-main-title">{_html_esc(cover['title'])}</div>
      <div class="doc-desc">
        {_html_esc(cover['description'])}
        Presents operational context, system requirements, architecture allocations, behavioral statecharts, interface control, traceability, change control, verification status and the expert-review register derived from the formal SDD specifications.
      </div>
      <div class="metadata-box">
        <div class="meta-row"><span class="meta-label">Package Revision:</span><span class="meta-val">Revision {rev} ({b_date})</span></div>
        <div class="meta-row"><span class="meta-label">Authoritative Spec:</span><span class="meta-val">specs/SPEC.md (Commit: {b_short}{', lock v' + str(fp['lock']['version']) if fp.get('lock') and fp['lock'].get('version') else ''})</span></div>
        <div class="meta-row"><span class="meta-label">Decisions Traced:</span><span class="meta-val">{c['decisions_traced']} ({c['traced_parts']} parts classified)</span></div>
        <div class="meta-row"><span class="meta-label">Invariants Cited:</span><span class="meta-val">{v_cited} of {v_total} (§8 Invariants)</span></div>
        <div class="meta-row"><span class="meta-label">System Requirements:</span><span class="meta-val">{c['requirements']} ({c['requirements_tbr']} TBR pending SME review)</span></div>
        <div class="meta-row"><span class="meta-label">External Interfaces:</span><span class="meta-val">{c['interfaces']} ({prefix}-IF)</span></div>
        <div class="meta-row"><span class="meta-label">Architecture Diagrams:</span><span class="meta-val">{c['diagrams']} ({prefix}-DIA)</span></div>
        <div class="meta-row"><span class="meta-label">Open Items:</span><span class="meta-val">{c['tbr_open']}/{c['tbr_total']} Open TBR · {c['gaps_open']}/{c['gaps_total']} Open Gaps</span></div>
      </div>
    </div>
    <div class="cover-footer">
      <span>{_html_esc(cover['footer'])}</span>
      <span>Revision {rev} Baseline ({b_short})</span>
    </div>
  </div>
  <div class="toc-page">
    <div class="toc-title">Table of Contents</div>
    <ul class="toc-list">
{chr(10).join(toc_items)}
    </ul>
    <div style="margin-top: 35px; padding: 14px; background: #f8fafc; border-left: 3px solid #0284c7; border-radius: 4px; font-size: 8pt; line-height: 1.4;">
      <strong>Note on Authority:</strong> This package is a derived systems-engineering view prepared from <code>specs/SPEC.md</code>, <code>specs/DECISION_LOG.md</code>, and <code>specs/contracts/</code>. Where this package and SPEC.md differ, SPEC.md wins and the difference is a defect in this package.
    </div>
  </div>
{chr(10).join(chapters_html)}
</body>
</html>
"""
    html_out = os.path.join(root, pkg, 'index.html')
    with open(html_out, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Wrote {os.path.relpath(html_out, root)} ({len(html)} bytes, revision {rev}, baseline {b_short})')
    if pdf:
        pdf_out = os.path.join(root, pkg, cover['pdf'])
        chrome_bins = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            'google-chrome',
            'chromium',
        ]
        chrome = next((b for b in chrome_bins if os.path.exists(b) or subprocess.run(['which', b], capture_output=True).returncode == 0), None)
        if not chrome:
            print('WARN   Chrome not found; skipped PDF export.')
            return
        r = subprocess.run([
            chrome, '--headless', '--disable-gpu', '--no-pdf-header-footer',
            f'--print-to-pdf={pdf_out}', f'file://{html_out}'
        ], capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(pdf_out):
            print(f'Wrote {os.path.relpath(pdf_out, root)} ({os.path.getsize(pdf_out)} bytes)')
        else:
            print(f'WARN   PDF export failed: {r.stderr.strip()}')


# ---------------------------------------------------------------- stamp
def stamp(root, revision, rev=None, date=None, note=None, pkg=PKG_DIR):
    fp = fingerprint(root, rev)
    idx = parse_package(root, pkg)
    mpath = os.path.join(root, pkg, 'manifest.json')
    old = json.load(open(mpath, encoding='utf-8')) if os.path.exists(mpath) else {}
    ids = {'SR': sorted(idx['requirements']), 'DD': sorted(idx['design_decisions']), 'IF': sorted(idx['interfaces']),
           'TBR': sorted(idx['tbr'], key=lambda t: int(t.split('-')[1])), 'G': sorted(idx['gaps'], key=lambda t: int(t.split('-')[1])),
           'DIA': sorted(idx['diagrams'])}
    for k, v in old.get('ids', {}).items():   # registry only grows
        ids[k] = sorted(set(ids.get(k, [])) | set(v))
    history = old.get('history', [])
    history.append({'revision': revision, 'date': date or datetime.date.today().isoformat(),
                    'commit': fp['short'], 'lock': fp['lock'], 'note': note or ''})
    man = {'schema': 1, 'package': pkg, 'id_prefix': detect_prefix(idx, old), 'revision': revision,
           **({'cover': old['cover']} if old.get('cover') else {}), **({'pdf': old['pdf']} if old.get('pdf') else {}),
           'date': date or datetime.date.today().isoformat(), 'baseline': {'commit': fp['commit'], 'short': fp['short'], 'lock': fp['lock']},
           'counts': idx['counts'], 'ids': ids,
           'diagrams': {k: {kk: v.get(kk) for kk in ('title', 'file', 'dec', 'spec', 'v', 'if', 'source_commit', 'pending')}
                        for k, v in idx['diagrams'].items()},
           'history': history, 'fingerprint': fp}
    with open(mpath, 'w', encoding='utf-8') as f:
        json.dump(man, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(f'Wrote {os.path.relpath(mpath, root)}: revision {revision}, baseline {fp["short"]} '
          f'({fp["from"]}), {len(fp["decisions"])} decisions, {len(fp["invariants"])} invariants, '
          f'{len(fp["spec_sections"])} SPEC sections fingerprinted.')


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--repo', help='repo root (default: git toplevel of the current directory)')
    ap.add_argument('--package', default=PKG_DIR, help=f'package folder (default {PKG_DIR})')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('fingerprint'); p.add_argument('--rev'); p.add_argument('--out')
    p = sub.add_parser('index'); p.add_argument('--out')
    p = sub.add_parser('impact'); p.add_argument('--rev'); p.add_argument('--json', action='store_true')
    p = sub.add_parser('check'); p.add_argument('--strict', action='store_true')
    p = sub.add_parser('stamp'); p.add_argument('--revision', type=int, required=True); p.add_argument('--rev')
    p.add_argument('--date'); p.add_argument('--note')
    p = sub.add_parser('compile'); p.add_argument('--pdf', action='store_true')
    p = sub.add_parser('derive'); p.add_argument('--write', action='store_true')
    p = sub.add_parser('verify'); p.add_argument('--json', action='store_true')
    p = sub.add_parser('review'); p.add_argument('--resolve', nargs='?', const='*'); p.add_argument('--draft'); p.add_argument('--kind', choices=['scr', 'gap'], default='scr')
    a = ap.parse_args()
    root = repo_root(a.repo)
    if a.cmd == 'fingerprint':
        fp = fingerprint(root, a.rev)
        s = json.dumps(fp, indent=1, ensure_ascii=False)
        if a.out:
            open(a.out, 'w', encoding='utf-8').write(s + '\n')
            print(f'{a.out}: {len(fp["decisions"])} decisions, {len(fp["invariants"])} invariants, '
                  f'{len(fp["spec_sections"])} sections, {len(fp["modules"])} modules, commit {fp["short"]}')
        else:
            print(s)
    elif a.cmd == 'index':
        idx = parse_package(root, a.package)
        s = json.dumps(idx, indent=1, ensure_ascii=False, default=list)
        if a.out:
            open(a.out, 'w', encoding='utf-8').write(s + '\n')
        print(json.dumps(idx['counts'], indent=1) if a.out else s)
    elif a.cmd == 'impact':
        impact(root, a.rev, a.json, a.package)
    elif a.cmd == 'check':
        sys.exit(check(root, a.strict, a.package))
    elif a.cmd == 'stamp':
        stamp(root, a.revision, a.rev, a.date, a.note, a.package)
    elif a.cmd == 'compile':
        compile_package(root, a.pdf, a.package)
    elif a.cmd == 'derive':
        derive(root, a.write, a.package)
    elif a.cmd == 'verify':
        v = verification(root, a.package)
        if a.json:
            print(json.dumps({k: v[k] for k in ('rows', 'summary', 'by_method', 'cases_uncited')}, indent=1, ensure_ascii=False))
        else:
            print(render_verification(v, detect_prefix(parse_package(root, a.package))))
    elif a.cmd == 'review':
        if a.draft:
            review_draft(root, a.draft, a.kind, a.package)
        else:
            review_resolve(root, None if a.resolve in (None, '*') else a.resolve, a.package)


if __name__ == '__main__':
    main()
