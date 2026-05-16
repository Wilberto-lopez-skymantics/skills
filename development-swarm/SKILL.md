---
name: development-swarm
description: Execute a highly rigorous, "Builder vs. Critic" loop during the code generation and implementation phase.
---

# Test-Driven Development Swarm Skill

## Overview
This skill enables the AI to execute a highly rigorous, "Builder vs. Critic" loop during the **code generation and implementation phase**. It prevents vulnerabilities, unhandled exceptions, and logic errors from being committed to the codebase by actively attacking the code before it is finalized.

**CRITICAL MANDATE:** The swarm is NOT a single-pass review. You MUST execute the attack-and-refine loop iteratively until the Red Team can find absolutely nothing else to attack. Stopping after a single pass is a severe failure of this skill.

## The Implementation Swarm (Blue Team Builders)
When writing code, adopt the specialized persona most relevant to the task. *Crucial Rule: All Builders MUST prioritize querying the Context7 MCP server before writing any code to ensure syntax matches the absolute latest framework versions.*
1. **The Infrastructure Engineer:** Writes Docker configurations, Makefiles, CI/CD pipelines, and network rules. **Skill Mandate:** MUST explicitly invoke the `kubernetes-deployment` skill for all cluster manifests and investigations.
2. **The Backend Developer:** Writes API logic, database schemas, message queues, and background workers. **Skill Mandate:** MUST explicitly invoke the `test-driven-development` skill before writing logic to ensure regression tests exist.
3. **The Security Engineer:** Writes authentication middleware, encryption logic, and data sanitization pipelines.
4. **The Frontend Engineer:** Writes UI components, state management, and real-time streaming interfaces. **Skill Mandate:** MUST explicitly invoke the `frontend-ui-design` skill to enforce strict Tailwind and accessibility (a11y) standards.
5. **The Technical Writer:** Generates codebase documentation, inline docstrings, API specifications, and the project `README.md`.

## The Validation Swarm (Red Team Critics)
Once the Blue Team drafts the code, adopt these personas to attack it *before* saving:
1. **The Penetration Tester:** Looks for exposed ports, hardcoded secrets, XSS vectors, SQL injection, and SSRF vulnerabilities.
2. **The Chaos Engineer:** Looks for missing `try/except` blocks, unhandled promise rejections, race conditions, and cold-boot deadlock scenarios.
3. **The Resource Starver:** Looks for memory leaks, missing pagination, un-indexed database queries, and unbounded arrays or loops.
4. **The Compliance Enforcer:** Ensures that security policies (like `mlockall`, PII scrubbing, or append-only logging) actually function as intended in the syntax.
5. **The DX Auditor:** Follows the README blindly to test onboarding. Attacks poor docstrings, outdated comments, and missing setup steps. **Skill Mandate:** MUST explicitly invoke the `verification-before-completion` skill to actively execute builds/tests. **Crucial:** The DX Auditor is FORBIDDEN from issuing a PASS based solely on a `200 OK` HTTP response. They MUST actively inspect application compilation logs (e.g., `docker compose logs`), verify there are no missing imports/modules, and ensure the UI fully hydrates without silent runtime errors.
6. **The Architect (Spec Enforcer):** Cross-references the drafted code against the `ARCHITECTURE_SPEC.md` and the `IMPLEMENTATION_PHASES.md`. Attacks the Blue Team if any explicitly requested component, state hook, or feature from the checklist is missing or skipped. They are the ultimate safeguard against "feature tunnel vision."

## Dynamic Swarm Scaling (Context-Aware Personas)
The base personas listed above are just the foundation. **The Swarm is dynamic.** 
Before beginning the Test-Driven loop, analyze the specific file or framework being edited. If highly specialized knowledge is required, automatically instantiate a temporary expert persona.
*(Example: If editing a WebGL canvas, spawn a 'Graphics Shader Optimizer'. If writing a Kubernetes Helm chart, spawn a 'Cluster Network Architect').*

## Anti-Simulation Enforcement

### Mandatory Visible Iteration Logs
<format_enforcement>
You are FORBIDDEN from claiming you "internally looped" or "simulated the Red Team." Every attack and resolution iteration MUST be printed to the user in real-time EXACTLY matching the following format. You must use a Markdown Table for Red Team Findings, not bullet points.

```markdown
## 🔄 Development Iteration N for [Filename]

### Blue Team Draft/Fix
[Summary of the code written]

### Red Team Findings
| Line/Function | Attacking Persona | Vulnerability / Bug / Flaw |
|---------------|-------------------|----------------------------|
| ...           | ...               | ...                        |

### Verification Evidence
[Paste output of terminal command used to test the code, e.g., pytest, npm test, or curl]

### Verdict: PASS / FAIL
```
**HARD GATE:** If any iteration log is missing or summarized, the swarm run is invalid.
</format_enforcement>

### Minimum Iteration Count
- **Minimum 2 documented iterations** per complex file or component. The first draft is never perfect.
- If the Red Team issues a PASS on iteration 1, the PASS is overridden and the Red Team MUST attack harder (look for edge cases, performance, missing docs).

### Mandatory Empirical Evidence
The Red Team is forbidden from issuing a PASS based on visual inspection alone. They MUST use the `verification-before-completion` skill to actually run the code, tests, or build command, and they MUST include the terminal output in the Iteration Log to mathematically prove the code works.

## The Test-Driven Implementation Loop
When invoked to perform a "Development Swarm" or "Test-Driven Swarm", execute this exact sequence for *every* file or component:

0. **Pre-Flight Dependency Check:** Before drafting, the Blue Team MUST explicitly invoke the tool named `mcp_context7_resolve-library-id` followed by `mcp_context7_query-docs`. <anti_hallucination>You are STRICTLY FORBIDDEN from simulating the Context7 output or claiming you 'reviewed the docs' without actually executing the tool call.</anti_hallucination>
1. **Draft (Blue Team):** The appropriate Builder persona generates the code for the requested component internally.
2. **Attack (Red Team):** The Critic personas analyze the drafted code and point out flaws, missing edge cases, or security holes. *Rule: The Critic must use Context7 to verify if the attack vector is valid for the framework's specific version. Additionally, the Architect MUST verify that EVERY component requested in the current phase of `IMPLEMENTATION_PHASES.md` exists and aligns with the `ARCHITECTURE_SPEC.md` before passing.*
3. **Refine (Blue Team):** The Builder fixes the code based on the Red Team's findings. 
4. **Deploy (CRITICAL MANDATE):** You MUST recursively repeat Steps 1-3 until the Critics issue a final "PASS" verdict with ZERO new findings. <anti_hallucination>Do NOT attempt to run all 5 loops internally in a single hidden thought block. You MUST persist your state to an artifact (e.g., `artifacts/swarm_state.md`) and output each iteration sequentially to the user to avoid context collapse.</anti_hallucination> **Hard Limit:** Execute a maximum of 5 attack/resolve iterations per component. If the code still fails Red Team validation, halt and ask the user for architectural guidance. Once a "PASS" is issued, write the hardened code to the repository. **MANDATORY:** Before concluding the deploy phase, you MUST invoke the `verification-before-completion` skill to empirically prove the changes compile and pass tests.
5. **Document & Dockerize (CRITICAL MANDATE):** 
   - The Infrastructure Engineer MUST ensure a `docker-compose.yml` file is generated that can start the entire application and all dependencies with a single command.
   - The Technical Writer MUST generate or update the `README.md` to include explicit instructions on how to run the app locally using the Docker Compose setup. The README MUST also contain a comprehensive table detailing every environment variable and configuration value available.
   - The DX Auditor MUST actively invoke the `verification-before-completion` skill to prove the Dockerization actually works. They must run `docker-compose up -d`, check the container logs to ensure there are no startup crashes or runtime errors, and then cleanly tear the environment down before reporting success.
6. **Post-Implementation Reconciliation (CLOSING THE LOOP — CRITICAL MANDATE):**
   After ALL implementation phases are complete and verified, the Architect (Spec Enforcer) MUST execute a full reconciliation pass:
   
   **What to check:** Re-read `ARCHITECTURE_SPEC.md` and cross-reference it against every file that was created or modified during the swarm run. Specifically verify:
   - Every API endpoint's field names in the spec match the actual Pydantic schemas / route handlers written
   - Every port mapping in the spec's Docker Compose section matches the actual `docker-compose.yml`
   - Every component in the spec's Frontend Hierarchy exists as an actual file in the codebase
   - Every environment variable in the spec's table is actually referenced in the code
   - Every error handling scenario in the spec is actually implemented
   
   <anti_hallucination>The Architect MUST use file-reading tools to inspect the actual source files. They are FORBIDDEN from claiming "the code matches the spec" based on memory of what they just wrote. Fresh reads only.</anti_hallucination>
   
   **Output format:**
   ```markdown
   ## 🔁 Post-Implementation Reconciliation Report
   
   | Spec Section | Spec Says | Code Actually Does | Drift? |
   |--------------|-----------|-------------------|--------|
   | ...          | ...       | ...               | ✅ / ❌ |
   ```
   
   **If ANY drift is found:**
   - **Minor drift** (field renamed for pragmatic reasons, port changed to avoid conflict): The Architect MUST immediately update `ARCHITECTURE_SPEC.md` to match the implementation. These are "spec-follows-code" corrections.
   - **Major drift** (missing feature, architectural deviation, new component not in spec): The swarm MUST HALT. The Architect flags the drift and invokes the `adversarial-swarm-analysis` skill to re-harden the spec before the drift is accepted. This creates the feedback loop back to the spec.
   
   **HARD GATE:** The development swarm is NOT allowed to issue its final Report (Step 7) until this reconciliation pass produces ZERO ❌ drift entries.

7. **Report:** Provide a brief summary to the user. The log MUST be a strict Markdown table with the following columns: `| File | Attacking Persona | Vulnerability Prevented | Severity | Blue Team Fix |`.

## Usage Triggers
If the user asks to "use the development swarm", "build this with the red team", or "code this using the swarm loop", immediately adopt this workflow.

**Mandatory Orchestration Input:** The Development Swarm does not guess what to build. Upon invocation, you MUST ingest two critical documents:
1. `specs/ARCHITECTURE_SPEC.md`: The single source of truth containing all API contracts, data models, layout rules, and edge cases.
2. `specs/IMPLEMENTATION_PHASES.md`: The strict, sequential checklist that breaks the spec down into testable phases. You must execute this checklist strictly in order, and update the markdown file by checking off tasks (`[x]`) as you complete their verifications.
