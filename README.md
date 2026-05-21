# Skymantics Agentic Skills

A curated collection of AI agent "Skills" that enforce a **Spec-Driven Development (SDD)** workflow. Code is a byproduct of the spec — never the other way around.

## The SDD Pipeline

These skills form a sequential, gated pipeline. Each skill produces artifacts that the next skill consumes. Skipping a step or writing code before the spec is updated is a violation.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SDD PIPELINE                                │
│                                                                    │
│  1. brainstorming                                                  │
│     ├─ Explore context, ask questions, propose approaches          │
│     ├─ Confidence Self-Assessment (≥85 to proceed)                 │
│     ├─ Design Triage (UI: reviewed vs delegated categories)        │
│     ├─ Decision Log                                                │
│     ├─ DESIGN.md (UI: 10 token categories + State Matrix)          │
│     ├─ Spec Merge (update specs/ARCHITECTURE.md)                   │
│     └─ Quantitative Completeness Gate (10 checks)                  │
│                          │                                         │
│  2. adversarial-swarm-analysis                                     │
│     ├─ Creator Swarm (Blue Team) drafts spec                       │
│     ├─ Critic Council (Red Team) attacks spec                      │
│     ├─ Minimum 3 iterations, Mandatory Completeness Checklist      │
│     └─ Output: hardened specs/ARCHITECTURE.md                      │
│                          │                                         │
│  3. writing-implementation-phases                                  │
│     ├─ Decompose spec into dependency-ordered phases               │
│     ├─ Phase Integrity Check (coverage, ordering, sizing)          │
│     └─ Output: specs/IMPLEMENTATION_PHASES.md                      │
│                          │                                         │
│  4. development-swarm                                              │
│     ├─ Builder (Blue Team) generates code per phase                │
│     ├─ Critic (Red Team) attacks code (8 personas)                 │
│     ├─ Design Token Auditor enforces DESIGN.md tokens              │
│     ├─ Visual Acceptance Testing (browser screenshots)             │
│     ├─ Post-Implementation Reconciliation (ARCHITECTURE + DESIGN)  │
│     └─ Output: hardened, verified code                             │
│                          │                                         │
│  5. verification-before-completion                                 │
│     └─ Empirical proof: builds pass, tests pass, browser verified  │
└─────────────────────────────────────────────────────────────────────┘
```

## The Three Canonical Documents

All specs live in the project's `specs/` directory. This folder is the **single source of truth**.

| Document | Purpose | Produced By | Consumed By |
|----------|---------|-------------|-------------|
| `specs/ARCHITECTURE.md` | **What** to build — API contracts, component hierarchy, data flow, error handling | `adversarial-swarm-analysis` | `development-swarm`, `writing-implementation-phases` |
| `specs/DESIGN.md` | **How it looks** — visual tokens (colors, typography, spacing, interaction states), UI State Matrix | `brainstorming` | `development-swarm` (Frontend Engineer + Design Token Auditor), `visual-acceptance-testing` |
| `specs/IMPLEMENTATION_PHASES.md` | **In what order** — sequenced, testable phases with verification steps | `writing-implementation-phases` | `development-swarm` (execution order) |

## Skills Reference

### Core Pipeline Skills

| Skill | Purpose |
|-------|---------|
| [`brainstorming`](./brainstorming/) | Explore ideas → design → DESIGN.md + Decision Log. Includes Visual Companion for live HTML mockups, Confidence Self-Assessment, Design Triage, UI State Matrix, Spec Merge, and 10-check Quantitative Completeness Gate. |
| [`adversarial-swarm-analysis`](./adversarial-swarm-analysis/) | Harden `ARCHITECTURE.md` via Creator vs Critic loop. 6 Blue Team + 6 Red Team personas. Minimum 3 iterations. Project-type adapters (backend, fullstack, client-side, game). |
| [`writing-implementation-phases`](./writing-implementation-phases/) | Decompose hardened spec into dependency-ordered, testable phases. Phase Integrity Check validates coverage, ordering, sizing, and DESIGN.md cross-references. |
| [`development-swarm`](./development-swarm/) | Build code via Builder vs Critic loop. 5 Blue Team + 8 Red Team personas (including Design Token Auditor). Context7 pre-flight. VAT gate. Post-Implementation Reconciliation against ARCHITECTURE.md + DESIGN.md. |
| [`spec-driven-development`](./spec-driven-development/) | The governor — enforces "spec first, code second" across all SDD projects. Defines the lifecycle, drift handling, and bug escape hardening loop. |

### Supporting Skills

| Skill | Purpose |
|-------|---------|
| [`frontend-ui-design`](./frontend-ui-design/) | Tailwind CSS standards, responsive design, accessibility (a11y), DESIGN.md Authority Rule. |
| [`visual-acceptance-testing`](./visual-acceptance-testing/) | Browser-based verification: Screen Walk, Interaction Audit, Design Token Verification (computed styles vs DESIGN.md), Debug Artifact Scan. |
| [`verification-before-completion`](./verification-before-completion/) | Empirical proof gate — run builds/tests/commands before claiming anything works. |
| [`test-driven-development`](./test-driven-development/) | Red-green-refactor loop for backend logic. |
| [`kubernetes-deployment`](./kubernetes-deployment/) | Safe infrastructure investigation and OKD/K8s manifest generation. |

## How Skills Work

Skills use a standardized format centered around a `SKILL.md` file. When an AI agent is instructed to use a skill, it reads the `SKILL.md` and strictly adopts the rules, prompt directives, and procedures defined within.

```text
/my-custom-skill/
  ├── SKILL.md          # Core instructions and YAML frontmatter (Required)
  ├── examples/         # Optional reference implementations
  ├── scripts/          # Optional helper scripts the agent can execute
  └── resources/        # Optional templates, assets, or additional docs
```

## Prerequisites: Context7 MCP Server

Several core skills (`development-swarm`, `adversarial-swarm-analysis`) enforce a strict rule requiring the AI agent to query the latest framework documentation via [Context7](https://context7.com) before writing code.

Your agent environment **must** have the `context7` MCP server installed and configured. Without it, the Pre-Flight Dependency Checks will block execution.

## Enforcing Skills via User Rules

The `spec-driven-development` skill is the **top-level governor** — it orchestrates when to invoke `adversarial-swarm-analysis`, `writing-implementation-phases`, `development-swarm`, and `visual-acceptance-testing` in the correct sequence. You only need to enforce the governor, not each sub-skill individually.

Add these **Global Custom Instructions** to your agent:

```xml
<!-- spec-driven-development enforcement -->
You MUST use the Spec-Driven Development skill (instructions located at
/path/to/skills/spec-driven-development/SKILL.md) EVERY TIME there is a
request for a new feature, update, or bugfix in a project that contains
a specs/ folder. Never write code before updating the spec.
<!-- spec-driven-development enforcement -->

<!-- verification-before-completion enforcement -->
You MUST use the Verification Before Completion skill (instructions located at
/path/to/skills/verification-before-completion/SKILL.md) EVERY TIME you are
about to claim that a task is complete, a bug is fixed, or tests are passing.
Evidence before assertions, always.
<!-- verification-before-completion enforcement -->

<!-- anti-sycophancy -->
Do not be blindly agreeable or sycophantic. Always challenge, question,
or push back on the user's instructions if you identify a better, more
efficient, safer, or more idiomatic approach.
<!-- anti-sycophancy -->
```

> **Why not enforce `development-swarm` or `adversarial-swarm-analysis` directly?** Because those are *sub-skills* invoked by `spec-driven-development` at the right moment. Enforcing them separately could trigger code generation or spec hardening *outside* the SDD lifecycle, bypassing the spec-first gate.

## Additional Resources

1. **[Matt Pocock's Skills](https://github.com/mattpocock/skills)** — TypeScript and web development-focused agent skills.
2. **[Obra's Superpowers](https://github.com/obra/superpowers)** — Advanced agentic workflows and planning skills.
3. **[LangGraph](https://github.com/langchain-ai/langgraph)** — Multi-agent workflow frameworks for complex swarm architectures.
4. **Write Your Own** — Duplicate any folder, rewrite the `SKILL.md` to your needs, and point your agent rules at it.
