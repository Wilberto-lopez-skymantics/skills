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
5. **The UX/UI Lead:** Defines the state management requirements and component hierarchy. **Design Escalation Rule:** The UX/UI Lead is FORBIDDEN from assuming visual design decisions that the user has not explicitly provided. This includes: color palettes, dark/light mode, typography choices, spacing systems, animation styles, border radii, and layout patterns (e.g., glassmorphism, card grids, sidebar widths). If the user has not provided a brand guide, style reference, or explicit visual direction, the UX/UI Lead MUST escalate with a `brainstorming` question before writing any styling into the spec. The only exception is when the project already contains a `BRAND_GUIDELINES.md` or equivalent in the `specs/` directory — in that case, the existing guide is the source of truth.
6. **The Technical Writer:** Synthesizes the creators' input into a highly structured, unambiguous Specification Document (or PRD).

## The Critic Council (Red Team)
The Red Team does not attack code syntax; they relentlessly attack the **Spec Contract**:
1. **The Edge-Case Hunter:** "What happens if this API request times out? The spec doesn't explicitly define the fallback behavior. Reject."
2. **The Chaos Engineer:** "The spec assumes the message queue is perfectly ordered. What happens during a split-brain scenario? Define the resolution in the contract. Reject."
3. **The Resource Starver:** "The database schema defined here has unbounded growth potential. The spec is missing pagination constraints. Reject."
4. **The DX Auditor:** "This API contract is ambiguous. A developer reading this spec wouldn't know if the ID is a string or a UUID. Clarify the contract. Reject."
5. **The Reconciler:** Cross-references the spec against the **actual codebase and running infrastructure**. <anti_hallucination>The Reconciler is FORBIDDEN from assuming the spec is correct. They MUST use file-reading tools to inspect existing source files (schemas, docker-compose, route handlers, component files) and flag ANY discrepancy between the spec and reality.</anti_hallucination> Examples: "The spec says port 3000 but `docker-compose.yml` maps to 3001. Reject." / "The spec defines field `message` but `schemas.py` uses `content`. Reject." / "The spec lists `<AgentHeader>` component but no such file exists in `frontend/components/`. Reject."

## Dynamic Swarm Scaling (Context-Aware Personas)
The base personas listed above are just the foundation. Analyze the user's specific tech stack and automatically instantiate highly specialized, temporary personas as needed to attack the specification.

## Anti-Simulation Enforcement

### Mandatory Completeness Checklist
Before ANY Red Team pass is allowed to begin, the Blue Team draft MUST contain ALL of the following sections. If any section is missing or contains only a placeholder, the draft is automatically rejected.

| # | Required Section | Responsible Persona | What MUST Be Defined |
|---|---|---|---|
| 1 | **System Architecture** | Core Architect | All services, how they communicate, protocol choices |
| 2 | **API Contracts** | Core Architect | Every HTTP endpoint: method, path, request/response schema, error codes |
| 3 | **Data Models & Persistence** | Data Specialist | Database choice, schema, relationships, retention/cleanup strategy |
| 4 | **Authentication & Authorization** | Security Auditor | Auth mechanism, RBAC model, or explicit "none required" with justification |
| 5 | **LLM/AI Configuration** | AI/MLOps Engineer | Provider, model, token limits, API key strategy, cost guardrails |
| 6 | **Frontend Component Hierarchy** | UX/UI Lead | Named components, state management approach, layout specifications |
| 7 | **Infrastructure & DevOps** | Core Architect | Docker services, networking, environment variables table, port mappings |
| 8 | **Error Handling & Resilience** | Edge-Case Hunter | Timeout values, retry strategies, fallback behaviors for every integration point |
| 9 | **Cross-Section Consistency** | Reconciler | Field names, types, port mappings, and env vars MUST be identical across all sections |
| 10 | **Visual Design & Styling** | UX/UI Lead | Color palette, typography, spacing, dark/light mode, animation style — MUST reference user-provided direction or existing brand guide. If neither exists, this section MUST contain explicit `[USER INPUT REQUIRED]` placeholders that trigger escalation. |

**HARD GATE:** If the Blue Team draft is missing even ONE of these sections, the Critic Council MUST immediately reject the entire draft and send it back. Do NOT proceed to the adversarial pass with an incomplete draft.

### Cross-Section Consistency Gate
Before any iteration can receive a PASS verdict, The Reconciler MUST execute this verification:
1. **Field Name Consistency:** Every field name referenced in API Contracts (Section 2) MUST exactly match the Data Models (Section 3). Example: if the API says `message`, the schema must say `message`, not `content`.
2. **Port Mapping Consistency:** Every port in the Docker Compose (Section 7) MUST match the System Architecture diagram (Section 1) and the Environment Variables table.
3. **Component Existence Consistency:** Every component listed in the Frontend Hierarchy (Section 6) MUST either already exist in the codebase OR be explicitly marked as `[NEW]` to indicate it needs to be created.
4. **Schema Boundary Consistency:** The spec MUST explicitly define which data model fields are returned to the frontend (public) versus kept backend-only (private). API response schemas and internal config schemas MUST NOT be conflated.

### Mandatory Visible Iteration Logs
You are FORBIDDEN from claiming you "internally looped." Every iteration must be **printed to the user** in the following format:

```
## 🔄 Iteration N

### Blue Team Draft Changes
[What was added or modified in this pass]

### Red Team Findings
| Finding # | Attacking Persona | Section Attacked | Flaw/Ambiguity | Severity |
|-----------|-------------------|------------------|----------------|----------|
| ...       | ...               | ...              | ...            | ...      |

### Resolution Actions
| Finding # | Resolution | Escalation Required? |
|-----------|------------|----------------------|
| ...       | ...        | Yes/No               |

### Verdict: PASS / FAIL (N findings remaining)
```

**HARD GATE:** If any iteration log is missing or summarized as "resolved internally," the entire swarm run is invalid.

### Minimum Iteration Count
- **Minimum 3 documented iterations** before a PASS verdict is allowed.
- The first iteration is ALWAYS a FAIL (the initial draft always has gaps).
- If the Red Team issues a PASS on iteration 1 or 2, the PASS is overridden and the Red Team MUST attack harder. A premature PASS indicates lazy analysis, not a perfect spec.

## The Iterative Workflow
When invoked to perform an Adversarial Swarm Analysis, execute this exact loop:

0. **Pre-Flight Context Map:** Identify all frameworks/versions in the target architecture.
0b. **Pre-Flight Codebase Grounding (CRITICAL for Incremental Updates):** If this swarm is modifying an EXISTING spec (i.e., a `specs/` folder or `ARCHITECTURE_SPEC.md` already exists), The Reconciler MUST read the following files BEFORE the Blue Team drafts anything:
   - The existing `ARCHITECTURE_SPEC.md` (to understand what's already defined)
   - The actual `docker-compose.yml` (to verify real port mappings)
   - The actual API schema files (e.g., `schemas.py`, route handlers) to verify real field names
   - The actual frontend component directory listing to verify which components exist
   <anti_hallucination>The Reconciler MUST use file-reading tools to inspect these files. They are FORBIDDEN from assuming the spec is correct or from relying on memory of past conversations. Fresh reads every time.</anti_hallucination>
1. **Generation Pass:** The Creator Swarm outputs a complete draft of the Specification Document. **The draft MUST pass the Completeness Checklist above before proceeding.** If it fails, loop back and fill the gaps before any Red Team pass begins.
2. **Adversarial Pass:** The Critic Council viciously attacks the draft spec, identifying ambiguities, missing edge-case handling, and architectural flaws. **Each finding must be printed in the Iteration Log format above.**
3. **Resolution:** The Creators attempt to modify the Specification Document to resolve the Critic attacks. **ESCALATION RULE:** If resolving an attack requires making a business assumption, guessing user intent, or defining a UX/architecture flow that was not previously discussed, the Creators are FORBIDDEN from guessing. They must PAUSE the swarm, invoke the `brainstorming` skill to ask the user a clarifying question (or present a visual tradeoff mockup), and only resume the swarm once the user provides explicit direction.
   
   **Explicit Escalation Triggers (non-exhaustive):**
   - Color palette or theme (dark/light mode) not provided by user
   - Typography or font family choices not specified
   - Layout pattern decisions (sidebar width, card vs list, split pane ratios)
   - Animation/transition style preferences
   - Any UX flow that affects how the user interacts with a feature (e.g., modal vs inline, wizard vs single page)
   
   The UX/UI Lead MUST NOT fill these gaps with "sensible defaults." What seems sensible to the AI may contradict the user's vision. Ask first.
4. **Loop (CRITICAL MANDATE):** You MUST recursively repeat Steps 1-3 in a strict loop until the Critics issue a final "PASS" verdict with ZERO new findings. Do NOT stop after a single pass. **Minimum 3 documented iterations required.**
5. **Commit & Save (CRITICAL MANDATE):** Output the finalized, battle-tested Specification Document. You MUST save this document, along with any related artifacts (visual mockups, color palettes, data models), into a dedicated `specs/` directory within the target project repository (e.g., `specs/ARCHITECTURE_SPEC.md`). This ensures the specification and all its supporting assets are cleanly grouped and tracked in version control for traceability. **Do NOT write implementation code.**
6. **Handoff:** Present the finalized Specification Document to the user for review. Explicitly ask for their confirmation and approval. If the user approves, THEN automatically invoke the `development-swarm` skill to read the hardened spec and begin the actual coding phase.
7. **Report:** Output a "Swarm Log" detailing the exact attacks the Red Team executed against the spec and how the Blue Team resolved them. Format: `| Spec Section | Attacking Persona | Ambiguity/Flaw Found | Blue Team Resolution |`.

## Usage Triggers
If the user asks for a "Red Team review", "Adversarial Swarm Analysis", "Spec-Driven Design", or asks to "harden" an architecture, immediately adopt this workflow.
