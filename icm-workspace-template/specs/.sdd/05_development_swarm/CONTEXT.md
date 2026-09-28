<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

# Stage 05: Test-Fulfillment Development Swarm

Builder vs. Critic loop during code generation & implementation. Guarantees observational equivalence by enforcing strict adherence to pre-existing machine contracts and test fixtures.

**! execute attack-and-refine loop iteratively until Red Team finds zero attacks. Stopping after single pass = severe failure.**

## Inputs
- Layer 4 (working): `specs/SPEC.md`
- Layer 4 (working): `specs/contracts/*` (`openapi.yaml`, `schema.sql`, `statecharts.json`, `errors.json`)
- Layer 4 (working): `specs/fixtures/*` (Immutable Test Oracle)
- Layer 4 (working): `specs/IMPLEMENTATION_PHASES.md`
- Layer 4 (working): `specs/DESIGN.md` (if UI project)
- Layer 4 (working): `specs/wireframes/*.html` (? exists)
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

### Pipeline Rules (∀ roles)

#### Build Rules & Strict Test-Consumer Mandate
- **Strict Test-Driven Fulfillment:** Builder mandate = write implementation code to make pre-existing test oracle in `specs/fixtures/` and contracts in `specs/contracts/` pass 100%.
- **⛔ IMMUTABLE GATE (Anti-Tampering):** Builder is **strictly forbidden from modifying, editing, or deleting any file in `specs/` or `specs/fixtures/`**.
  - Relaxing an assertion, commenting out a test case, or altering an expected fixture payload = AUTOMATIC PROCESS FAILURE.
  - If a test fails: the CODE is defective, NOT the test.
- **Deterministic Scaffolding:** Code ! strictly adhere to pinned dependencies and directory layout (`src/...`) defined in `specs/SPEC.md`. Introducing unapproved third-party dependencies or altering folder structures = FAIL.
- **Docker:** ! generate `.dockerignore` when `Dockerfile` created | modified.
- **Failure Routing (Backprop):** Unresolvable spec defect discovered during build → ! transition `00_backprop` to update spec invariants & test back-to-source. ⊥ patch code around spec defects.

#### Design Token Mandate (UI + ∃ `specs/DESIGN.md`)
- Before generating frontend component, ! read `specs/DESIGN.md` & extract YAML tokens.
- ∀ color/font/spacing/border-radius values ! reference tokens. Hardcoded values that ∃ as DESIGN.md tokens = automatic FAIL.
- Component names ! match DESIGN.md `components:` section.

#### Verification Rules
- ⊥ PASS on `200 OK` | code inspection alone. ! run test runner against `specs/fixtures/` + include terminal output ∈ iteration log.
- **TypeScript:** ! execute `tsc --noEmit` & verify zero errors. Bundler build ⊥ sufficient.
- **Headless Mock Caveat:** Unit tests with mocks ⊥ sole evidence for integration | contract phases. Must execute against real DB/runtime per phase verification command.

#### Spec & Contract Enforcement
- Architect ! cross-ref code vs `specs/SPEC.md`, `specs/contracts/`, and `specs/IMPLEMENTATION_PHASES.md`.
- ∀ API endpoints match `specs/contracts/openapi.yaml` schemas, headers, status codes.
- ∀ database queries match `specs/contracts/schema.sql` columns, indices, OCC `version` handling.
- **Orphan Check:** ∀ helper/utility created → verify imported & called ∈ main entry files. Module only imported ∈ unit tests = FAIL.

#### Visual Verification (∃ UI)
- ∃ UI → screenshot ∀ screens, verify ∀ components present/visible/interactive.
- ⊥ PASS based on code inspection alone — must see it rendered.

### Anti-Simulation Enforcement

#### Mandatory Visible Iteration Logs
<format_enforcement>
⊥ claim "internally looped" (meaning all loop iterations executed inside a single hidden thought block with only the final output shown). Instead, execute all loop iterations sequentially in a single model response (turn) without stopping to wait for user input (unless a business decision or user guidance is explicitly required). You must print each iteration log in full using the Development Swarm Iteration Log format ∈ `../_config/iteration-log-format.md`.

**⛔ GATE:** Missing | summarized iteration log → swarm run invalid.
</format_enforcement>

#### Minimum Iteration Count
- **≥ 2 documented iterations** per complex file/component. First draft never perfect.
- Red Team PASS on iteration 1 → override, ! attack harder.

#### Mandatory Empirical Evidence
Red Team ⊥ PASS based on visual inspection alone. ! use terminal tools → actually run code/tests/build & include terminal output ∈ Iteration Log.

> [!NOTE]
> **Iterative Execution:** Only execute the new unchecked phases (`- [ ]`) in `specs/IMPLEMENTATION_PHASES.md`. Skip phases marked completed (`- [x]`).

### Test-Driven Implementation Loop
Execute this exact sequence ∀ file/component:

**⛔ GATE: One File at a Time:** ⊥ build entire Phase (multiple files) ∈ single loop. ! select one file → complete Draft → Attack → Refine loop until PASS → write to disk → select next file.
- **Continuous Session Execution**: User explicitly requests "run continuously" | "finish development" → agent ! proceed through ∀ files & phases sequentially. ⊥ pause | return to user after single file/phase written. Loop next files/phases via tool calls.

0. **Pre-Flight Dependency Check:** ∃ Context7 MCP → Blue Team ! invoke its resolving tools. ⊥ Context7 → use web search | training knowledge. Log documentation source.
1. **Draft (Blue Team):** Appropriate Builder generates code fulfilling phase task.
2. **Attack (Red Team):** Critics analyze drafted code against contracts, edge cases, security, systems standards.
3. **Refine (Blue Team):** Builder fixes based on Red Team findings.
4. **Deploy & Verify:** ! recursively repeat Steps 1-3 until Critics → "PASS" with ZERO findings. **Hard Limit:** Max 5 iterations per component. Still failing → halt & ask user. After PASS → write code. **! execute phase verification command against `specs/fixtures/` and confirm terminal output.**
4.5. **VAT Gate (UI projects):** Verify visual screens via screenshot tool. VAT FAIL → fix defects before advancing.
5. **Document & Dockerize:** Ensure single-command start (`docker-compose up -d`). DX Auditor verifies. Technical Writer updates `README.md`.

### Post-Implementation Reconciliation (CRITICAL)
After ALL phases complete & verified, Architect ! execute full reconciliation:

**⛔ GATE:** ! create tracking artifact `specs/dev-swarm-reconciliation.md`. Evaluate cross-refs sequentially, write findings ∀ bullet, check box only when proven. Rubber-stamping = process violation.

**What to check:** Re-read `specs/SPEC.md` and `specs/contracts/*`, cross-ref vs created/modified files:
- ∀ API endpoint field names, query params, headers match `specs/contracts/openapi.yaml`.
- ∀ DB migrations match `specs/contracts/schema.sql`.
- ∀ components in Frontend Hierarchy exist as actual files.
- ∀ env vars in spec actually referenced in code.
- 100% of test cases in `specs/fixtures/` execute and pass.

**Drift found:**
- **Minor:** Architect ! update `specs/SPEC.md` to match implementation (if within contract limits).
- **Major / Contract Violation:** Swarm ! HALT. Architect flags drift & prompts user to return to Stage 02.

**⛔ GATE:** ⊥ proceed until reconciliation = ZERO ❌ drift entries.

6. **Update state:** Update `specs/.sdd/_config/sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`) with `lastCompletedStep: 5` & `stepName: "05_development_swarm"`.
7. **Handoff:** If UI project, prompt user to proceed to `06_visual_acceptance_testing`. If backend-only, prompt to proceed to `07_verification_before_completion`.

## Outputs
- Codebase files
- `specs/dev-swarm-reconciliation.md`
- `README.md`
- `specs/.sdd/_config/sdd-state.json`
