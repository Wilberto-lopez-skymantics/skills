---
name: ideation
description: Use when you have messy ideas, scattered thoughts, or dictated stream-of-consciousness that need to be turned into actionable implementation specs and contracts
---

# Ideation

## Overview
Transform raw, unstructured brain dumps (dictated freestyle) into structured implementation artifacts: contracts and implementation specs. Includes an execution workflow for implementing specs in fresh sessions with per-component feedback loops.

## When to Use
- Messy dictation, scattered thoughts, or half-formed ideas.
- Planning a feature or spec-ing something out.
- Turning rough business ideas into actionable engineering specs.

## The Workflow

1. **Intake** - Accept messy, unstructured input without judgment.
2. **Anti-sycophancy challenge** - Take a position on the brain dump, challenge vague demand signals, flag undefined terms and hypothetical users. (e.g. replace "That could work" with direct positions).
3. **Codebase exploration** - Understand existing code patterns, architecture, and conventions.
4. **Confidence scoring** - Assess understanding across 5 dimensions (0-100), scoring conservatively when pushback reveals gaps.
5. **Clarifying questions** - If confidence <95%, ask targeted questions one at a time.
6. **Contract** - When ≥95% confident, write `contract.md` (with revision lineage tracking via `Supersedes` field).
7. **Phasing & specs** - Determine phases, generate specs with feedback loops and failure mode catalogs.
8. **Feedback quality check** - Self-review specs for feedback loop coverage before presenting.
9. **Execution handoff** - Analyze orchestration strategy, write execution plan to contract, present summary.

## Confidence Scoring Rubric
Score the brain dump across 5 dimensions (20 points each):
- **Problem Clarity:** Do I understand what problem we're solving?
- **Goal Definition:** Are the goals specific and measurable?
- **Success Criteria:** Can I write tests for "done"?
- **Scope Boundaries:** Do I know what's in and out of scope?
- **Consistency:** Are there contradictions to resolve?

**Thresholds:**
- < 70: Major gaps - ask 5+ clarifying questions
- 70-84: Moderate gaps - ask 3-5 questions
- 85-94: Minor gaps - ask 1-2 questions
- ≥ 95: Ready to generate contract

## Artifact Output Structure
Write all artifacts to `./docs/ideation/{project-name}/`:
- `contract.md`: Problem, goals, success criteria, scope, execution plan (with Supersedes lineage)
- `prd-phase-1.md`: Phase 1 requirements (only if PRDs chosen)
- `spec-phase-1.md`: Phase 1 implementation spec (with Failure Modes and Feedback Loops)
- `spec-template-{pattern}.md`: Shared template for repeatable phases

## Spec Features
1. **Failure Modes**: Each non-trivial component in the spec needs a catalog of how it can fail (Component, Failure Mode, Trigger, Impact, Mitigation).
2. **Feedback Loops**: Each iterative component requires a Playground, Experiment, and Check command.
   - *Data/logic layers* -> Test file
   - *UI components* -> Dev server or Storybook
   - *API endpoints* -> curl/httpie script
   - *CLI tools* -> The tool itself
   - *Config/types* -> Skip (typecheck handles it)

## Execution (Execute-Spec Workflow)
When it's time to execute a generated spec:
1. **Scout** - Explore codebase, produce context map (GO/HOLD gate).
2. **Build** - For each component: consult context map → set up feedback loop → build incrementally → check → iterate.
3. **Review** - Run validation commands (typecheck, lint, tests, build), compare diff against spec, fix critical findings up to 3 times before commit.
