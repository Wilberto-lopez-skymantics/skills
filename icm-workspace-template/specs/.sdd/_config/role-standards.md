# Role Standards

<!-- DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

Default behavioral standards per role. Loaded on-demand by development swarm.
Override per-project with `specs/CODING_STANDARDS.md`.

## Blue Team (Builders)

### Infrastructure
- ! use multi-stage Docker builds (builder → runner)
- ⊥ root user in production containers
- ! generate optimized `.dockerignore` when `Dockerfile` created | modified
- ! include health check endpoint in services with external dependencies
- ∃ cluster manifests → follow K8s best practices (resource limits, liveness probes)

### Backend
- ∀ DB queries → parameterized, ⊥ string interpolation
- ! handle ∀ error paths explicitly — ⊥ empty catch blocks
- ! log structured output (JSON preferred), ⊥ `console.log` in production paths
- ! write tests before logic (TDD: red → green → refactor)

### Security
- ! verify dependencies against known vulnerability databases (NVD, GitHub Advisory)
- ! apply OWASP Top 10 for web-facing APIs
- ∀ auth tokens → verify expiry check ∃, rotation policy defined
- ⊥ hardcoded secrets — ! use env vars | secret managers
- ! sanitize ∀ user input before processing

### Frontend
- ! follow component isolation — one component per file
- ! handle ∀ interaction states (loading, error, empty, success)
- ! include aria labels ∀ interactive elements (a11y baseline)
- ∃ `specs/DESIGN.md` → ∀ visual values ! reference tokens, ⊥ hardcoded

### Writer
- ! include run instructions, env var table, architecture overview in README
- ∀ public functions → docstring with params, return type, and example
- ! document non-obvious architectural decisions inline

## Red Team (Validators)

### Penetration Tester
- Attack: exposed ports, hardcoded secrets, XSS, SQL injection, SSRF, CSRF
- Verify: auth middleware applied to ∀ protected routes

### Chaos Engineer
- Attack: missing `try/except`, unhandled promise rejections, race conditions, cold-boot deadlocks
- Verify: graceful degradation under partial failure

### Resource Starver
- Attack: memory leaks, missing pagination, un-indexed queries, unbounded arrays/loops
- Verify: ∀ list endpoints → pagination | cursor | limit enforced

### Compliance Enforcer
- Verify: security policies (`mlockall`, PII scrubbing, append-only logging) actually function
- Attack: policies declared but never tested | exercised

### DX Auditor
- Follow README blindly → test onboarding from zero
- Attack: poor docstrings, outdated comments, missing setup steps, wrong env var names
- Verify: `git clone && follow README → running app` works end-to-end

### Architect (Spec Enforcer)
- Cross-ref code vs spec for completeness — ∀ spec items ! ∃ in code
- ⊥ accept features beyond current phase scope (scope creep)

### Visual QA Tester
- ∃ UI → verify ∀ components present, visible, interactive in browser
- ⊥ PASS based on code inspection alone

### Design Token Auditor
- Scan ∀ frontend code for hardcoded visual values that should be DESIGN.md tokens
- Framework-agnostic: CSS → stylesheets. Canvas/WebGL → rendering config
- Violations = errors, ⊥ warnings
