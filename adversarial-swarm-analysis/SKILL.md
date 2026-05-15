---
name: adversarial-swarm-analysis
description: Execute a multi-agent adversarial review (Creator vs Critic) of architectural blueprints or codebases to harden designs.
---

# Adversarial Swarm Analysis Skill

## Overview
This skill enables the AI to perform a highly rigorous, multi-agent adversarial review of architectural blueprints, codebases, or system designs. It emulates a "Creator" team proposing solutions and a "Critic" (Red Team) attacking those solutions in an iterative loop until no actionable flaws remain.

**CRITICAL MANDATE:** The swarm is NOT a single-pass review. You MUST execute the attack-and-refine loop iteratively until the Red Team can find absolutely nothing else to attack. Stopping after a single pass is a severe failure of this skill.

## The Creator Swarm (Blue Team)
When acting as the Creators, adopt these personas to analyze the target and propose robust implementations:
1. **The Core Architect:** Focuses on decoupling, system boundaries, fault tolerance, and communication protocols.
2. **The Security Auditor:** Focuses on Zero-Trust boundaries, RBAC contracts, mTLS, encryption, and data scrubbing.
3. **The AI/MLOps Engineer:** Focuses on LLM orchestrator runtimes, VRAM budgeting, embedding models, and prompt limits.
4. **The Data Specialist:** Evaluates database schemas, transaction consistency, and complex state machines.
5. **The DevOps Expert:** Reviews containerization, network isolation, host security, and deployment infrastructure.
6. **The UX/UI Lead:** Reviews frontend design, state management, and real-time streaming interfaces.
7. **The Technical Writer:** Documents architectural decisions, creating clear, structured blueprints and ADRs (Architecture Decision Records).

## The Critic Council (Red Team)
For every proposed improvement or existing design element, adopt these personas to relentlessly attack the premise:
1. **The Penetration Tester:** Looks for privilege escalation, SSRF, injection flaws, and data leaks.
2. **The Chaos Engineer:** Looks for race conditions, single points of failure, split-brain scenarios, and unhandled network drops.
3. **The Resource Starver:** Attacks memory budgets, looks for OOM crash vectors, queue limits, and CPU bottlenecks.
4. **The Compliance Enforcer:** Audits logging schemas, looks for PII leaks, encryption-at-rest violations, and regulatory failures.
5. **The DX Auditor (Developer Experience):** Attacks the documentation. Looks for ambiguous instructions, missing prerequisites, or confusing diagrams.

## Dynamic Swarm Scaling (Context-Aware Personas)
The base personas listed above are just the foundation. **The Swarm is dynamic.** 
When invoking the swarm, analyze the user's specific tech stack and project goals, and automatically instantiate highly specialized, temporary personas as needed. 
*(Example: If the project involves blockchain, automatically spawn a 'Smart Contract Auditor' on the Red Team. If it involves mobile development, spawn an 'iOS UI/UX Specialist' on the Blue Team).*

## The Iterative Workflow
When invoked to perform an Adversarial Swarm Analysis, execute this exact loop:

0. **Pre-Flight Context Map:** The Core Architect maps the dependency graph and identifies all frameworks/versions in the target. The Red Team must constrain their attacks to this exact tech stack.
1. **Generation Pass:** The Creator Swarm reviews the target (e.g., a markdown blueprint or codebase) and proposes technical implementations or fixes.
2. **Adversarial Pass:** The Critic Council viciously attacks the proposed fixes, identifying edge-case failures. *Rule: Before proposing a framework-specific vulnerability, the Critic must use the Context7 MCP server to verify if the vulnerability or race condition is mathematically possible in the target framework's current version.*
3. **Resolution:** The Creators modify their proposals based on the Critic attacks.
4. **Loop (CRITICAL MANDATE):** You MUST recursively repeat Steps 1-3 internally in a strict loop until the Critics issue a final "PASS" verdict with ZERO new findings. Do NOT stop after a single pass. **Hard Limit:** Execute a maximum of 5 attack/resolve iterations per component. If the Red Team still finds CRITICAL issues after 5 loops, halt and escalate to the user.
5. **Commit:** Apply the battle-tested, finalized implementations directly to the target files.
6. **Report:** Output a "Swarm Log" detailing the exact attacks the Red Team executed and how the Blue Team resolved them. The log MUST be a strict Markdown table with the following columns: `| Component | Attacking Persona | Vulnerability Found | Severity | Blue Team Resolution |`.

## Usage Triggers
If the user asks for a "Red Team review", "Adversarial Swarm Analysis", "Critic Council", or asks to "harden" a design, immediately adopt this workflow. 

*Tip: For large targets (e.g., multiple documents), utilize a `task.md` artifact to track progress and process them sequentially to maintain deep analytical focus.*
