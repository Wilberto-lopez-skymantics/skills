# Spec-Driven Development Skills

> **Code is a byproduct of the spec — never the other way around.**

A curated set of AI agent skills that enforce a rigorous **Spec-Driven Development (SDD)** pipeline. Every skill ensures specifications are written, hardened, and phase-planned *before* implementation code is generated. If your project has a `specs/` folder, these skills govern the entire lifecycle — from ideation through adversarial review to verified, production-ready code.

**🎯 Spec First** · **🔴 Adversarial Hardening** · **🔵 Builder–Critic Swarms** · **✅ Empirical Verification**

## Quick Start

1. Clone this repo somewhere on disk:
   ```bash
   git clone https://github.com/Wilberto-lopez-skymantics/skills.git ~/my-sdd-skills
   ```

2. Point your agent at the skills (see [Enforcing Skills](#enforcing-skills-via-user-rules) below).

3. **(Recommended)** Resolve reference paths for full fidelity:
   ```bash
   # macOS
   find ~/my-sdd-skills -name "*.md" -exec sed -i '' "s|{{SKILLS_DIR}}|$(cd ~/my-sdd-skills && pwd)|g" {} +

   # Linux
   find ~/my-sdd-skills -name "*.md" -exec sed -i "s|{{SKILLS_DIR}}|$(cd ~/my-sdd-skills && pwd)|g" {} +
   ```

   > **Skip this step?** Skills still work — critical references (completeness checklists, design templates, spec review checks) have inline fallbacks that activate automatically. The agent will log when using a fallback. Run this step to enable full reference loading with detailed checklists, examples, and project-type adapters.

## Two Ways to Use SDD

This repository provides two delivery mechanisms for the same SDD pipeline. They implement identical stages and must stay synchronized.

### Option A: Skill-Based (Global Agent Rules)

For agents that support global skill instructions (Gemini Code Assist, Claude Code with global rules). The `spec-driven-development` orchestrator skill invokes sub-skills by name. See [Enforcing Skills](#enforcing-skills-via-user-rules) below.

**Best for:** Teams with a single agent platform and centralized configuration.

### Option B: ICM Workspace Template (Portable)

For agents that don't support global skills, or for projects that need to be shared across teams/environments. The pipeline is encoded as a folder structure with `CONTEXT.md` files that any agent can read.

**Best for:** Cross-team sharing, multi-agent environments, portable projects.

1. Copy `icm-workspace-template/` contents (`.cursorrules`, `CLAUDE.md`, `specs/.sdd/`) to the root of your new project.
2. If your agent supports auto-loading rules (Cursor with `.cursorrules`, Claude Code with `CLAUDE.md`), it will automatically find the routing instructions in `specs/.sdd/WORKSPACE_ROUTING.md`.
3. Ask your agent to start the project — it will begin at `specs/.sdd/01_brainstorming/CONTEXT.md`.
4. All spec outputs live in `specs/` at the project root. Pipeline machinery lives in `specs/.sdd/`.

### Keeping Them in Sync

The skills are the source of truth. The ICM template is a portable view of the same pipeline. Run the sync validator to detect drift:

```bash
./scripts/validate-icm-sync.sh
```


## The SDD Pipeline

These skills form a sequential, gated pipeline. Each skill produces artifacts that the next consumes. Skipping a step or writing code before the spec is updated is a violation.

```
┌───────────────────────────────────────────────────────────────┐
│                        SDD PIPELINE                           │
│                                                               │
│  1. brainstorming                                             │
│     ├─ Explore context, ask questions, propose approaches     │
│     ├─ Confidence Self-Assessment (≥85 to proceed)            │
│     ├─ Theme & Vibe (UI: iterate colors/aesthetic)            │
│     ├─ Decision Log (specs/DECISION_LOG.md)                   │
│     ├─ DESIGN.md (UI: 10 token categories + State Matrix)     │
│     └─ Spec Merge (update specs/SPEC.md)                      │
│                          │                                    │
│             ──── Execution Gate ────                           │
│                          │                                    │
│  2. adversarial-swarm-analysis                                │
│     ├─ Creator Swarm (Blue Team) drafts spec                  │
│     ├─ Critic Council (Red Team) attacks spec                 │
│     ├─ Minimum 3 iterations, Completeness Checklist           │
│     ├─ Project-type adapters (backend/fullstack/client/game)  │
│     └─ Output: hardened specs/SPEC.md                         │
│                          │                                    │
│             ──── Execution Gate ────                           │
│                          │                                    │
│  3. interactive-wireframing (UI projects only)                │
│     ├─ Screen-by-screen WYSIWYG HTML wireframes               │
│     ├─ Iterative user feedback loop                           │
│     └─ Output: specs/wireframes/*.html                        │
│                          │                                    │
│             ──── Execution Gate ────                           │
│                          │                                    │
│  4. writing-implementation-phases                             │
│     ├─ Decompose spec into dependency-ordered phases          │
│     ├─ Phase Integrity Check (coverage, ordering, sizing)     │
│     └─ Output: specs/IMPLEMENTATION_PHASES.md                 │
│                          │                                    │
│             ──── Execution Gate ────                           │
│                          │                                    │
│  5. development-swarm                                         │
│     ├─ Builder (Blue Team) generates code per phase           │
│     ├─ Critic (Red Team) attacks code (8 personas)            │
│     ├─ Design Token Auditor enforces DESIGN.md tokens         │
│     ├─ Visual Acceptance Testing (browser screenshots)        │
│     ├─ Post-Implementation Reconciliation (SPEC + DESIGN)     │
│     └─ Output: hardened, verified code                        │
│                          │                                    │
│  6. verification-before-completion                            │
│     └─ Empirical proof: builds pass, tests pass, browser ok   │
└───────────────────────────────────────────────────────────────┘
```

**Execution Gates:** Before each major step, the agent presents the user with a gate showing what's about to happen, its token budget (🟢/🟡/🔴), whether it's skippable, and adjustable parameters. The user decides to proceed, skip, or adjust.

## Spec Artifacts

All specs live in the project's `specs/` directory — the single source of truth.

| Document | Purpose | Produced By | Consumed By |
|----------|---------|-------------|-------------|
| `specs/SPEC.md` | **What** to build — contracts, hierarchy, data flow, invariants | brainstorming → adversarial | dev swarm, impl phases |
| `specs/DESIGN.md` | **How it looks** — visual tokens, interaction states, UI State Matrix | brainstorming | wireframing, dev swarm |
| `specs/DECISION_LOG.md` | **Why** we build this way — options considered, rationale | brainstorming | context for humans & swarms |
| `specs/IMPLEMENTATION_PHASES.md` | **In what order** — sequenced, testable phases | writing-impl-phases | dev swarm (execution order) |
| `specs/wireframes/` | **Visual source of truth** — approved WYSIWYG HTML screens | interactive-wireframing | dev swarm (pixel-perfect reference) |

## Skills Reference

### Core Pipeline

| Skill | Purpose |
|-------|---------|
| [`spec-driven-development`](./spec-driven-development/) | The governor — enforces "spec first, code second." Orchestrates the lifecycle, execution gates, checkpoints, drift handling, and bug escape hardening. |
| [`brainstorming`](./brainstorming/) | Ideas → design → specs. Confidence assessment, theme brainstorming, decision log, DESIGN.md, spec merge. Includes Visual Companion for live browser mockups. |
| [`adversarial-swarm-analysis`](./adversarial-swarm-analysis/) | Harden specs via Creator vs Critic loop. 6 Blue + 6 Red Team personas. Minimum 3 iterations. Completeness checklists with project-type adapters. |
| [`interactive-wireframing`](./interactive-wireframing/) | Screen-by-screen WYSIWYG HTML wireframes from DESIGN.md tokens and SPEC.md hierarchy. Iterative user approval. |
| [`writing-implementation-phases`](./writing-implementation-phases/) | Spec → dependency-ordered, testable phase checklist. Phase integrity validation. |
| [`development-swarm`](./development-swarm/) | Code via Builder vs Critic loop. 5 Blue + 8 Red Team personas. Context7 pre-flight. Design Token Auditor. VAT gate. Post-implementation reconciliation. |

### Supporting Skills

| Skill | Purpose |
|-------|---------|
| [`visual-acceptance-testing`](./visual-acceptance-testing/) | Browser-based verification: screen walk, interaction audit, design token verification (computed styles vs DESIGN.md), debug artifact scan. |
| [`verification-before-completion`](./verification-before-completion/) | Empirical proof gate — run builds/tests/commands before claiming anything works. |
| [`frontend-ui-design`](./frontend-ui-design/) | CSS standards, responsive design, a11y. Used by dev swarm for non-SDD React/Next.js projects. |
| [`test-driven-development`](./test-driven-development/) | Red-green-refactor loop for backend logic. |
| [`kubernetes-deployment`](./kubernetes-deployment/) | Safe infrastructure investigation and K8s manifest generation. |
| [`ubiquitous-language`](./ubiquitous-language/) | DDD-style domain glossary — extracts canonical terms, flags ambiguities, enforces consistent terminology across specs and swarms. |

### Shared Resources

The `shared/` directory contains templates and format definitions referenced by multiple skills. This is the **source of truth** for shared resources.

> **`shared/` vs `_config/`:** The ICM workspace template copies these files into `icm-workspace-template/specs/.sdd/_config/` for portability — ICM workspaces must be self-contained folders. When updating shared resources, edit `shared/` first, then sync to `_config/`. Run `./scripts/validate-icm-sync.sh` to detect drift.

| File | Used By |
|------|---------|
| `shared/role-standards.md` | Dev swarm, adversarial swarm (default role behavioral standards) |
| `shared/spec-self-review.md` | SDD orchestrator (14-step completeness gate) |
| `shared/design-template.md` | Brainstorming, wireframing (DESIGN.md template + token checklist) |
| `shared/decision-log-template.md` | Brainstorming (DECISION_LOG.md template) |
| `shared/iteration-log-format.md` | Adversarial swarm, dev swarm (iteration log + reconciliation formats) |
| `shared/vat-report-format.md` | VAT (screen walk, interaction, design token, debug scan reports) |
| `shared/visual-companion.md` | Brainstorming, wireframing (browser companion guide) |

## Directory Structure

```
skills/
├── shared/                           # Source of truth for shared templates
│   ├── spec-self-review.md
│   ├── design-template.md
│   ├── decision-log-template.md
│   ├── iteration-log-format.md
│   ├── vat-report-format.md
│   └── visual-companion.md
├── scripts/                          # Tooling
│   └── validate-icm-sync.sh          # Skills ↔ ICM drift detector
├── icm-workspace-template/           # Portable ICM template (Option B)
│   ├── README.md                     # Setup guide + ICM theory
│   ├── CLAUDE.md                     # Agent pointer → specs/.sdd/
│   ├── .cursorrules                  # Agent pointer → specs/.sdd/
│   └── specs/.sdd/                   # Pipeline machinery
│       ├── WORKSPACE_ROUTING.md      # Layer 0+1: identity + routing
│       ├── _config/                  # Layer 3: portable copy of shared/
│       ├── 00_backprop/CONTEXT.md    # Bug → source fix loop
│       ├── 01_brainstorming/         # Ideas → specs
│       ├── 02_adversarial_swarm_analysis/
│       ├── 03_interactive_wireframing/
│       ├── 04_writing_implementation_phases/
│       ├── 05_development_swarm/
│       ├── 06_visual_acceptance_testing/
│       └── 07_verification_before_completion/
├── spec-driven-development/          # The governor / orchestrator (Option A)
│   └── SKILL.md
├── brainstorming/                    # Ideas → specs
│   ├── SKILL.md
│   ├── spec-document-reviewer-prompt.md
│   ├── references/
│   │   ├── confidence-assessment.md
│   │   ├── theme-brainstorming.md
│   │   └── ui-state-matrix.md
│   └── scripts/                      # Visual Companion server
├── adversarial-swarm-analysis/       # Spec hardening
│   ├── SKILL.md
│   └── references/
│       └── completeness-checklist.md
├── interactive-wireframing/          # WYSIWYG wireframes
│   └── SKILL.md
├── writing-implementation-phases/    # Spec → phase checklist
│   └── SKILL.md
├── development-swarm/                # Code generation + validation
│   └── SKILL.md
├── visual-acceptance-testing/        # Browser-based visual QA
│   └── SKILL.md
├── verification-before-completion/   # Empirical proof gate
│   └── SKILL.md
├── ubiquitous-language/              # Domain glossary
│   └── SKILL.md
├── frontend-ui-design/               # CSS/a11y standards
│   └── SKILL.md
├── test-driven-development/          # TDD loop
│   ├── SKILL.md
│   └── testing-anti-patterns.md
└── kubernetes-deployment/            # K8s manifests
    └── SKILL.md
```

## Token Efficiency

All skill files use **caveman encoding** — a compression technique that drops articles, filler, and hedging while preserving all technical content. This reduces token consumption by ~42% compared to prose-heavy instructions.

Each file includes a decoder key:
```
<!-- DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes
     ∀ = for all | ∃ = exists | & = and | | = or -->
```

Additionally, large reference sections are extracted into `references/` subdirectories and loaded on-demand, keeping per-invocation context lean.

## Recommended: Context7 MCP Server

Several skills (`development-swarm`, `adversarial-swarm-analysis`) benefit from querying latest framework docs via [Context7](https://context7.com) before writing code.

If available, the `context7` MCP server provides verified, up-to-date framework documentation during pre-flight checks. Without it, agents will fall back to web search or training knowledge — the pipeline still works, but generated code may not reflect the latest API changes.

## Enforcing Skills via User Rules

The `spec-driven-development` skill is the **top-level governor** — it orchestrates all sub-skills in the correct sequence. You only need to enforce the governor, not each sub-skill individually.

Add these to your agent's global custom instructions (update paths after cloning):

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

> **Why not enforce sub-skills directly?** They are invoked by `spec-driven-development` at the right moment. Enforcing them separately could trigger code generation or spec hardening outside the SDD lifecycle.

## Platform Setup

### Gemini Code Assist / Antigravity
Copy skills to `~/.gemini/config/skills/` or symlink:
```bash
ln -s /path/to/skills/* ~/.gemini/config/skills/
```

### Claude Code
Copy skills to `~/.claude/skills/` or the project's `.claude/skills/` directory.

### Cursor
Add skill paths to your `.cursorrules` or workspace settings.

### Other Agents
Any agent that can read files from disk and follows markdown instructions can use these skills. Point your agent's configuration at the `SKILL.md` files.

