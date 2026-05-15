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
5. **The DX Auditor:** Follows the README blindly to test onboarding. Attacks poor docstrings, outdated comments, and missing setup steps. **Skill Mandate:** MUST explicitly invoke the `verification-before-completion` skill to actively execute builds/tests instead of just visually inspecting the code.

## Dynamic Swarm Scaling (Context-Aware Personas)
The base personas listed above are just the foundation. **The Swarm is dynamic.** 
Before beginning the Test-Driven loop, analyze the specific file or framework being edited. If highly specialized knowledge is required, automatically instantiate a temporary expert persona.
*(Example: If editing a WebGL canvas, spawn a 'Graphics Shader Optimizer'. If writing a Kubernetes Helm chart, spawn a 'Cluster Network Architect').*

## Anti-Simulation Enforcement

### Mandatory Visible Iteration Logs
You are FORBIDDEN from claiming you "internally looped" or "simulated the Red Team." Every attack and resolution iteration MUST be printed to the user in real-time in the following format:

```
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

### Minimum Iteration Count
- **Minimum 2 documented iterations** per complex file or component. The first draft is never perfect.
- If the Red Team issues a PASS on iteration 1, the PASS is overridden and the Red Team MUST attack harder (look for edge cases, performance, missing docs).

### Mandatory Empirical Evidence
The Red Team is forbidden from issuing a PASS based on visual inspection alone. They MUST use the `verification-before-completion` skill to actually run the code, tests, or build command, and they MUST include the terminal output in the Iteration Log to mathematically prove the code works.

## The Test-Driven Implementation Loop
When invoked to perform a "Development Swarm" or "Test-Driven Swarm", execute this exact sequence for *every* file or component:

0. **Pre-Flight Dependency Check:** Before drafting, the Blue Team uses the Context7 MCP server to review the current documentation for the specific frameworks/libraries being used to avoid deprecated syntax.
1. **Draft (Blue Team):** The appropriate Builder persona generates the code for the requested component internally.
2. **Attack (Red Team):** The Critic personas analyze the drafted code and point out flaws, missing edge cases, or security holes. *Rule: The Critic must use Context7 to verify if the attack vector is valid for the framework's specific version.*
3. **Refine (Blue Team):** The Builder fixes the code based on the Red Team's findings. 
4. **Deploy (CRITICAL MANDATE):** You MUST recursively repeat Steps 1-3 internally in a strict loop until the Critics issue a final "PASS" verdict with ZERO new findings. Do NOT stop after a single pass. **Hard Limit:** Execute a maximum of 5 attack/resolve iterations per component. If the code still fails Red Team validation, halt and ask the user for architectural guidance. Once a "PASS" is issued, write the hardened code to the repository. **MANDATORY:** Before concluding the deploy phase, you MUST invoke the `verification-before-completion` skill to empirically prove the changes compile and pass tests.
5. **Document & Dockerize (CRITICAL MANDATE):** 
   - The Infrastructure Engineer MUST ensure a `docker-compose.yml` file is generated that can start the entire application and all dependencies with a single command.
   - The Technical Writer MUST generate or update the `README.md` to include explicit instructions on how to run the app locally using the Docker Compose setup. The README MUST also contain a comprehensive table detailing every environment variable and configuration value available.
   - The DX Auditor MUST actively invoke the `verification-before-completion` skill to prove the Dockerization actually works. They must run `docker-compose up -d`, check the container logs to ensure there are no startup crashes or runtime errors, and then cleanly tear the environment down before reporting success.
6. **Report:** Provide a brief summary to the user. The log MUST be a strict Markdown table with the following columns: `| File | Attacking Persona | Vulnerability Prevented | Severity | Blue Team Fix |`.

## Usage Triggers
If the user asks to "use the development swarm", "build this with the red team", or "code this using the swarm loop", immediately adopt this workflow.

*Tip: For large, multi-file features, utilize a `task.md` artifact to break the work into phases and track the swarm's progress sequentially.*
