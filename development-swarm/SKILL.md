---
name: development-swarm
description: "Execute a rigorous, iterative Builder vs. Critic attack loop to produce hardened, test-verified implementation code from a spec and implementation phases checklist."
---

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

# Test-Driven Development Swarm

## Overview
Builder vs. Critic loop during code generation & implementation. Prevents vulnerabilities, unhandled exceptions, logic errors from being committed.

**! execute attack-and-refine loop iteratively until Red Team finds zero attacks. Stopping after single pass = severe failure.**

## Implementation Swarm (Blue Team)
Roles: Infrastructure, Backend, Security, Frontend, Writer.
∃ role standards → read [role-standards.md](file://{{SKILLS_DIR}}/shared/role-standards.md).
∃ project standards → read `specs/CODING_STANDARDS.md`.
Analyze project stack → instantiate additional specialist roles as needed.

*∀ Builders SHOULD query Context7 MCP server before writing code → ensure syntax matches latest framework versions. ⊥ Context7 → use web search | training knowledge, but note "docs not verified against latest version" ∈ iteration log.*

## Validation Swarm (Red Team)
After Blue Team drafts code, adopt attack roles *before* saving:
Roles: Penetration Tester, Chaos Engineer, Resource Starver, Compliance Enforcer, DX Auditor, Architect (Spec Enforcer), Visual QA Tester, Design Token Auditor.
∃ role standards → read [role-standards.md](file://{{SKILLS_DIR}}/shared/role-standards.md).
Analyze project stack → instantiate additional attack vectors as needed.

## Pipeline Rules (∀ roles)

### Build Rules
- **TDD:** ! write tests before logic. ! invoke `test-driven-development` skill.
- **K8s:** ∃ cluster manifests → invoke `kubernetes-deployment` skill.
- **Docker:** ! generate `.dockerignore` when `Dockerfile` created | modified.
- **Frontend (Non-SDD):** ! invoke `frontend-ui-design` skill for React/Next.js projects.

### Design Token Mandate (UI + ∃ `specs/DESIGN.md`)
- Before generating frontend component, ! read `specs/DESIGN.md` & extract YAML tokens.
- ∀ color/font/spacing/border-radius values ! reference tokens. Hardcoded values that ∃ as DESIGN.md tokens = automatic FAIL.
- Framework-agnostic: CSS → scan stylesheets. Canvas/WebGL → scan rendering config.
- Component names ! match DESIGN.md `components:` section.

### Verification Rules
- ⊥ PASS on `200 OK` | code inspection alone. ! run code + include output ∈ iteration log.
- **TypeScript:** ! execute `tsc --noEmit` & verify zero errors. Bundler build (Vite) ⊥ sufficient.
- **Empirical evidence:** ! invoke `verification-before-completion` skill before deploy.
- **Headless Mock Caveat:** Unit tests with mocks ⊥ sole evidence for integration | visual phases.

### Spec Enforcement
- Architect ! cross-ref code vs `specs/SPEC.md` & `IMPLEMENTATION_PHASES.md`.
- ∀ components ∈ current phase ! ∃ in code. Missing = FAIL.
- **Orphan Check:** ∀ helper/utility created → verify imported & called ∈ main entry files. Module only imported ∈ unit tests = FAIL.

### Visual Verification (∃ UI)
- ! invoke `visual-acceptance-testing` skill → screenshot ∀ screens, verify ∀ components present/visible/interactive.
- ⊥ PASS based on code inspection alone — must see it rendered.

## Dynamic Swarm Scaling
Base roles = foundation. Before loop, analyze file/framework → auto-instantiate temporary expert roles as needed. *(Example: WebGL canvas → 'Graphics Shader Optimizer'. Kubernetes Helm → 'Cluster Network Architect').*

## Anti-Simulation Enforcement

### Mandatory Visible Iteration Logs
<format_enforcement>
⊥ claim "internally looped" | "simulated Red Team." ∀ iteration ! be printed to user in real-time using Development Swarm Iteration Log format ∈ [iteration-log-format.md](file://{{SKILLS_DIR}}/shared/iteration-log-format.md).

**⛔ GATE:** Missing | summarized iteration log → swarm run invalid.
</format_enforcement>

### Minimum Iteration Count
- **≥ 2 documented iterations** per complex file/component. First draft never perfect.
- Red Team PASS on iteration 1 → override, ! attack harder (edge cases, performance, missing docs).
- **User-Adjustable:** Default = 2, adjustable at SDD Execution Gate. User sets 1 → document choice, respect it.

### Mandatory Empirical Evidence
Red Team ⊥ PASS based on visual inspection alone. ! use `verification-before-completion` skill → actually run code/tests/build & include terminal output ∈ Iteration Log.

## Test-Driven Implementation Loop
Execute this exact sequence ∀ file/component:

**⛔ GATE:** **One File at a Time:** ⊥ build entire Phase (multiple files) ∈ single loop. ! select one file → complete Draft → Attack → Refine loop until PASS → write to disk → select next file.

0. **Pre-Flight Dependency Check:** ∃ Context7 MCP → Blue Team ! invoke `mcp_context7_resolve-library-id` then `mcp_context7_query-docs`. <anti_hallucination>⊥ simulate Context7 output | claim "reviewed docs" without executing tool call.</anti_hallucination> ⊥ Context7 → use web search | built-in knowledge for framework APIs. Log: "Context7 unavailable — docs sourced from [web search | training data]."
1. **Draft (Blue Team):** Appropriate Builder generates code.
2. **Attack (Red Team):** Critics analyze drafted code → flaws, missing edge cases, security holes. *∃ Context7 → Critic SHOULD use it to verify attack vectors valid for specific framework version. Architect ! verify EVERY component ∈ current `IMPLEMENTATION_PHASES.md` phase ∃ & aligns with `specs/SPEC.md`.*
3. **Refine (Blue Team):** Builder fixes based on Red Team findings. **GUARDRAIL:** Fixing bugs ∈ existing files → ! use `replace_file_content` | `multi_replace_file_content` for surgical edits. ⊥ rewrite entire file via `write_to_file` to fix few lines.
4. **Deploy:** ! recursively repeat Steps 1-3 until Critics → "PASS" with ZERO findings. <anti_hallucination>⊥ run all loops internally ∈ single hidden thought block (with only the final result shown). Instead, execute all loop iterations sequentially in a single model response (turn) without stopping to wait for user input (unless explicit feedback is required). ! persist state to artifact & output each iteration log sequentially.</anti_hallucination> **Hard Limit:** Max 5 attack/resolve iterations per component. Still failing → halt & ask user for architectural guidance. After PASS → write hardened code. **! invoke `verification-before-completion` before concluding deploy.**
4.5. **VAT Gate (UI projects):**
   After code deployed & verified to compile → ! invoke `visual-acceptance-testing` skill ∀ projects with UI:
   - Walk ∀ screens ∈ spec's Component Hierarchy via `browser_subagent`
   - Screenshot each, verify ∀ components present/visible/non-empty
   - Test ∀ interactions ∈ Input & Interaction Contract
   - Scan for debug artifacts (mock buttons, dev flags, placeholder text)
   
   **⛔ GATE:** VAT FAIL → Blue Team ! fix visual defects & re-run VAT. ⊥ advance past this gate with visual failures.
5. **Document & Dockerize:**
   - **`backend-service` | `fullstack-app`:** Infrastructure Engineer ! ensure `docker-compose.yml` starts entire app with single command. DX Auditor ! invoke `verification-before-completion` → `docker-compose up -d`, check logs for crashes/errors, tear down cleanly.
   - **`client-side-app` | `game`:** Docker Compose NOT required. Technical Writer ! document dev server command ∈ README. DX Auditor verifies dev server starts & serves app.
   - Technical Writer ! generate/update `README.md` with run instructions & env var table.
6. **Post-Implementation Reconciliation (CRITICAL):**
   After ALL phases complete & verified, Architect ! execute full reconciliation:
   
   **⛔ GATE:** ! create tracking artifact `dev-swarm-reconciliation.md`. Evaluate cross-refs sequentially, write findings ∀ bullet, check box only when proven. Rubber-stamping = process violation.

   **What to check:** Re-read `specs/SPEC.md`, cross-ref vs ∀ created/modified files:
   - ∀ API endpoint field names ∈ spec match actual schema/route handlers
   - ∀ port mappings ∈ spec match actual `docker-compose.yml`
   - ∀ components ∈ Frontend Hierarchy ∃ as actual files
   - ∀ env vars ∈ spec actually referenced ∈ code
   - ∀ error handling scenarios ∈ spec actually implemented
   
   **DESIGN.md Audit (∃ `specs/DESIGN.md`):**
   - **Token Usage:** ∀ frontend component → scan for hardcoded visual values that should be DESIGN.md tokens. CSS frameworks → verify mapped class usage. Vanilla CSS → verify custom properties. Canvas/WebGL → verify rendering config.
   - **Component Coverage:** ∀ component ∈ DESIGN.md `components:` has implementation file using its tokens.
   - **State Coverage:** ∀ component with interaction states (hover, focus, disabled) ∈ DESIGN.md → verify state styles ∃ ∈ code.
   - **Cross-Artifact Naming:** Component names consistent: DESIGN.md kebab-case → SPEC.md PascalCase → implementation filenames. Flag any orphan.
   
   <anti_hallucination>Architect ! use file-reading tools to inspect actual source. ⊥ claim "code matches spec" from memory. Fresh reads only.</anti_hallucination>
   
   **Output format:** Use Reconciliation Report format ∈ [iteration-log-format.md](file://{{SKILLS_DIR}}/shared/iteration-log-format.md).
   
   **Drift found:**
   - **Minor** (field renamed, port changed): Architect ! update `specs/SPEC.md` to match implementation.
   - **Major** (missing feature, architectural deviation): Swarm ! HALT. Architect flags drift & invokes `adversarial-swarm-analysis` to re-harden spec.
   
   **⛔ GATE:** ⊥ issue final Report (Step 7) until reconciliation = ZERO ❌ drift entries.

7. **Report:** Summary using Swarm Completion Report format ∈ [iteration-log-format.md](file://{{SKILLS_DIR}}/shared/iteration-log-format.md).

## Usage Triggers
User asks "use development swarm" | "build with red team" | "code using swarm loop" → adopt this workflow.

**Mandatory Input:** ! ingest on invocation:
1. `specs/SPEC.md`: Source of truth — API contracts, data models, layout rules, edge cases.
2. `specs/IMPLEMENTATION_PHASES.md`: Sequential checklist. Execute strictly in order, check off tasks (`[x]`) as verified.
3. `specs/DESIGN.md` (if ∃): Visual design token schema. Frontend Engineer ! read before writing components. Design Token Auditor ! validate ∀ generated frontend code against it.
