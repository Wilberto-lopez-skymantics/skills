---
name: adversarial-swarm-analysis
description: Execute a multi-agent adversarial review (Creator vs Critic) to output a hardened Spec-Driven Design document. Forbids implementation code generation.
---

# Adversarial Swarm Analysis (Spec-Driven Design)

## Overview
This skill forces the AI into a strict **Spec-Driven Design (SDD)** workflow. It performs a highly rigorous, multi-agent adversarial review of requirements to output a bulletproof, contract-level **Technical Specification Document**.

**STRICT PROHIBITION:** You are strictly forbidden from writing implementation code while this skill is active. Your only output must be the architectural design and the technical specification contract.

**CRITICAL MANDATE:** The swarm is NOT a single-pass review. You MUST execute the attack-and-refine loop iteratively until the Red Team can find absolutely nothing else to attack in the spec.

## The Creator Swarm (Blue Team)
When acting as the Creators, adopt these personas to draft the Specification Document:
1. **The Core Architect:** Defines system boundaries, communication protocols, and API contracts (headers, payloads, error codes).
2. **The Security Auditor:** Defines Zero-Trust boundaries, RBAC requirements, and encryption standards in the spec.
3. **The AI/MLOps Engineer:** Budgets VRAM, defines embedding strategies, and prompts limits.
4. **The Data Specialist:** Designs the database schema relationships and transaction consistency rules.
5. **The UX/UI Lead:** Defines the state management requirements and component hierarchy.
6. **The Technical Writer:** Synthesizes the creators' input into a highly structured, unambiguous Specification Document (or PRD).

## The Critic Council (Red Team)
The Red Team does not attack code syntax; they relentlessly attack the **Spec Contract**:
1. **The Edge-Case Hunter:** "What happens if this API request times out? The spec doesn't explicitly define the fallback behavior. Reject."
2. **The Chaos Engineer:** "The spec assumes the message queue is perfectly ordered. What happens during a split-brain scenario? Define the resolution in the contract. Reject."
3. **The Resource Starver:** "The database schema defined here has unbounded growth potential. The spec is missing pagination constraints. Reject."
4. **The DX Auditor:** "This API contract is ambiguous. A developer reading this spec wouldn't know if the ID is a string or a UUID. Clarify the contract. Reject."

## Dynamic Swarm Scaling (Context-Aware Personas)
The base personas listed above are just the foundation. Analyze the user's specific tech stack and automatically instantiate highly specialized, temporary personas as needed to attack the specification.

## The Iterative Workflow
When invoked to perform an Adversarial Swarm Analysis, execute this exact loop:

0. **Pre-Flight Context Map:** Identify all frameworks/versions in the target architecture.
1. **Generation Pass:** The Creator Swarm outputs a complete draft of the Specification Document (Architecture, API Contracts, Data Models, Edge Cases).
2. **Adversarial Pass:** The Critic Council viciously attacks the draft spec, identifying ambiguities, missing edge-case handling, and architectural flaws. 
3. **Resolution:** The Creators modify the Specification Document based on the Critic attacks.
4. **Loop (CRITICAL MANDATE):** You MUST recursively repeat Steps 1-3 internally in a strict loop until the Critics issue a final "PASS" verdict with ZERO new findings. Do NOT stop after a single pass. 
5. **Commit:** Output the finalized, battle-tested Specification Document. **Do NOT write implementation code.** 
6. **Handoff:** Present the finalized Specification Document to the user for review. Explicitly ask for their confirmation and approval. If the user approves, THEN automatically invoke the `development-swarm` skill to read the hardened spec and begin the actual coding phase.
7. **Report:** Output a "Swarm Log" detailing the exact attacks the Red Team executed against the spec and how the Blue Team resolved them. Format: `| Spec Section | Attacking Persona | Ambiguity/Flaw Found | Blue Team Resolution |`.

## Usage Triggers
If the user asks for a "Red Team review", "Adversarial Swarm Analysis", "Spec-Driven Design", or asks to "harden" an architecture, immediately adopt this workflow.
