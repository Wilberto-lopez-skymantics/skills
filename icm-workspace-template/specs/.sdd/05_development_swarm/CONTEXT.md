<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

# Stage 05: Test-Driven Development Swarm

Builder vs. Critic loop during code generation & implementation. Prevents vulnerabilities, unhandled exceptions, logic errors from being committed.

**! execute attack-and-refine loop iteratively until Red Team finds zero attacks. Stopping after single pass = severe failure.**

## Inputs
- Layer 4 (working): `specs/SPEC.md`
- Layer 4 (working): `specs/IMPLEMENTATION_PHASES.md`
- Layer 4 (working): `specs/DESIGN.md` (if UI project)
- Layer 4 (working): `specs/CODING_STANDARDS.md` (if exists)
- Layer 3 (reference): `../_config/role-standards.md`
- Layer 3 (reference): `../_config/iteration-log-format.md`

## Process

### Implementation Swarm (Blue Team)
Roles: Infrastructure, Backend, Security, Frontend, Writer.
∃ role standards → read `../_config/role-standards.md`.
∃ project standards → read `specs/CODING_STANDARDS.md`.
Analyze project stack → instantiate additional specialist roles as needed.

*∀ Builders SHOULD query Context7 MCP server before writing code → ensure syntax matches latest framework versions. ⊥ Context7 → use web search | training knowledge, but note "docs not verified against latest version" ∈ iteration log.*

### Validation Swarm (Red Team)
After Blue Team drafts code, adopt attack roles *before* saving:
Roles: Penetration Tester, Chaos Engineer, Resource Starver, Compliance Enforcer, DX Auditor, Architect (Spec Enforcer), Visual QA Tester, Design Token Auditor.
∃ role standards → read `../_config/role-standards.md`.
Analyze project stack → instantiate additional attack vectors as needed.

### Pipeline Rules (∀ roles)

#### Build Rules
- **TDD:** ! write tests before logic.
- **Docker:** ! generate `.dockerignore` when `Dockerfile` created | modified.

#### Design Token Mandate (UI + ∃ `specs/DESIGN.md`)
- Before generating frontend component, ! read `specs/DESIGN.md` & extract YAML tokens.
- ∀ color/font/spacing/border-radius values ! reference tokens. Hardcoded values that ∃ as DESIGN.md tokens = automatic FAIL.
- Framework-agnostic: CSS → scan stylesheets. Canvas/WebGL → scan rendering config.
- Component names ! match DESIGN.md `components:` section.

#### Verification Rules
- ⊥ PASS on `200 OK` | code inspection alone. ! run code + include output ∈ iteration log.
- **TypeScript:** ! execute `tsc --noEmit` & verify zero errors. Bundler build ⊥ sufficient.
- **Headless Mock Caveat:** Unit tests with mocks ⊥ sole evidence for integration | visual phases.

#### Spec Enforcement
- Architect ! cross-ref code vs `specs/SPEC.md` & `IMPLEMENTATION_PHASES.md`.
- ∀ components ∈ current phase ! ∃ in code. Missing = FAIL.
- **Orphan Check:** ∀ helper/utility created → verify imported & called ∈ main entry files. Module only imported ∈ unit tests = FAIL.

#### Visual Verification (∃ UI)
- ∃ UI → screenshot ∀ screens, verify ∀ components present/visible/interactive.
- ⊥ PASS based on code inspection alone — must see it rendered.
- (Formal visual QA handled in Stage 06, but basic visual sanity checks apply here).

### Anti-Simulation Enforcement

#### Mandatory Visible Iteration Logs
<format_enforcement>
⊥ claim "internally looped". ∀ iteration ! be printed to user in real-time using Development Swarm Iteration Log format ∈ `../_config/iteration-log-format.md`.

**⛔ GATE:** Missing | summarized iteration log → swarm run invalid.
</format_enforcement>

#### Minimum Iteration Count
- **≥ 2 documented iterations** per complex file/component. First draft never perfect.
- Red Team PASS on iteration 1 → override, ! attack harder.

#### Mandatory Empirical Evidence
Red Team ⊥ PASS based on visual inspection alone. ! use terminal tools → actually run code/tests/build & include terminal output ∈ Iteration Log.

### Test-Driven Implementation Loop
Execute this exact sequence ∀ file/component:

**⛔ GATE:** **One File at a Time:** ⊥ build entire Phase (multiple files) ∈ single loop. ! select one file → complete Draft → Attack → Refine loop until PASS → write to disk → select next file.

0. **Pre-Flight Dependency Check:** ∃ Context7 MCP → Blue Team ! invoke its resolving tools. ⊥ Context7 → use web search | built-in knowledge for framework APIs. Log: "Context7 unavailable — docs sourced from [web search | training data]."
1. **Draft (Blue Team):** Appropriate Builder generates code.
2. **Attack (Red Team):** Critics analyze drafted code → flaws, missing edge cases, security holes. 
3. **Refine (Blue Team):** Builder fixes based on Red Team findings. 
4. **Deploy:** ! recursively repeat Steps 1-3 until Critics → "PASS" with ZERO findings. **Hard Limit:** Max 5 iterations per component. Still failing → halt & ask user. After PASS → write hardened code. **! verify code executes before concluding deploy.**
4.5. **VAT Gate (UI projects):**
   After code deployed & verified to compile → ∃ UI → walk ∀ screens, screenshot each, verify ∀ components present/visible/interactive. Scan for debug artifacts.

   **⛔ GATE:** VAT FAIL → Blue Team ! fix visual defects & re-run. ⊥ advance past this gate with visual failures.
5. **Document & Dockerize:**
   - Infrastructure Engineer ! ensure app starts with single command (e.g. `docker-compose up -d`). DX Auditor verifies it works cleanly.
   - Technical Writer ! generate/update `README.md` with run instructions & env var table.

### Post-Implementation Reconciliation (CRITICAL)
After ALL phases complete & verified, Architect ! execute full reconciliation:

**⛔ GATE:** ! create tracking artifact `specs/dev-swarm-reconciliation.md`. Evaluate cross-refs sequentially, write findings ∀ bullet, check box only when proven. Rubber-stamping = process violation.

**What to check:** Re-read `specs/SPEC.md`, cross-ref vs ∀ created/modified files:
- ∀ API endpoint field names ∈ spec match actual schema/route handlers
- ∀ components ∈ Frontend Hierarchy ∃ as actual files
- ∀ env vars ∈ spec actually referenced ∈ code

**DESIGN.md Audit (∃ `specs/DESIGN.md`):**
- **Token Usage:** ∀ frontend component → scan for hardcoded visual values that should be DESIGN.md tokens.
- **Component Coverage:** ∀ component ∈ DESIGN.md `components:` has implementation file using its tokens.
- **Cross-Artifact Naming:** Component names consistent: DESIGN.md kebab-case → SPEC.md PascalCase → implementation filenames. Flag any orphan.

**Output format:** Use Reconciliation Report format ∈ `../_config/iteration-log-format.md`.

**Drift found:**
- **Minor:** Architect ! update `specs/SPEC.md` to match implementation.
- **Major:** Swarm ! HALT. Architect flags drift & prompts user to return to Stage 02.

**⛔ GATE:** ⊥ proceed until reconciliation = ZERO ❌ drift entries.

6. **Handoff:** If UI project, prompt user to proceed to `06_visual_acceptance_testing`. If backend-only, prompt to proceed to `07_verification_before_completion`.

## Verify

Cross-stage consistency checks (execute after all phases complete):
- **Spec fidelity:** Every API endpoint field name in `specs/SPEC.md` matches actual schema/route handlers in code.
- **Component coverage:** Every component in the Frontend Hierarchy exists as an actual file.
- **Env var traceability:** Every environment variable in the spec is actually referenced in code.
- **Design token compliance (UI):** Every frontend component uses `specs/DESIGN.md` tokens — no hardcoded visual values that exist as tokens.
- **Naming consistency:** Component names are consistent across DESIGN.md (kebab-case) → SPEC.md (PascalCase) → implementation filenames. Flag orphans.
- **Reconciliation report:** Must reach ZERO drift entries before declaring complete.

## Outputs
- Codebase files
- `specs/dev-swarm-reconciliation.md`
- `README.md`
