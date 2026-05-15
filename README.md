# Skymantics Agentic Skills

This repository contains a curated collection of favorite "Skills" that dictate the behavior, workflows, and operating parameters of autonomous AI agents within the Skymantics ecosystem.

## How Skills Work

Skills use a standardized format centered around a `SKILL.md` file. When an AI agent is instructed to use a skill, it will navigate to the skill's directory, parse the `SKILL.md` file, and strictly adopt the rules, prompt directives, and standard operating procedures defined within.

### Directory Structure
A typical skill looks like this:
```text
/my-custom-skill/
  ├── SKILL.md          # Core instructions and YAML frontmatter (Required)
  ├── examples/         # Optional directory for reference implementations
  └── scripts/          # Optional helper scripts the agent can execute
```

## Prerequisites: Context7 MCP Server

Several of the core skills in this repository (such as `development-swarm` and `systematic-debugging`) enforce a strict rule requiring the AI agent to query the latest framework documentation before writing code or assuming a bug is caused by custom logic.

To fulfill this mandate, your agent environment **must** have the `context7` MCP server installed and configured. 

If the Context7 MCP server is missing, the agent will fail to execute the required Pre-Flight Dependency Checks and the skill workflows will be blocked. Ensure this MCP is active in your agent's configuration file before invoking the execution swarms.

## Enforcing Skills via User Rules

While skills define *how* an agent should behave, you must explicitly instruct the agent *when* to use them. The most robust way to enforce skill usage across your entire workflow is by adding **Global Custom Instructions** (or `user_rules` depending on your agent framework).

By defining strict conditional triggers in your global settings, you guarantee the agent will automatically adopt a skill without you needing to manually prompt it every time.

### Example: Enforcing the Development Swarm

To automatically enforce a rigorous code generation loop, you would add a rule like this to your global agent instructions:

```xml
<!-- development-swarm enforcement -->
You MUST use the Development Swarm skill (instructions located at /absolute/path/to/skills/development-swarm/SKILL.md) EVERY TIME there is a code generation or implementation task. You must execute the iterative Builder vs Critic loop defined in the skill before saving any code to the repository.
<!-- development-swarm enforcement -->
```

By explicitly linking the rule to the absolute path of the `SKILL.md` file, the agent is forced to read the skill instructions and execute them as part of its mandatory policy.

### Example: Enforcing Behavioral Rules (Anti-Sycophancy)

Rules don't always have to point to a `SKILL.md` file; they can also be used to enforce strict behavioral protocols that override the agent's default helpful/agreeable nature. For example:

```xml
<!-- anti-sycophancy -->
Do not be blindly agreeable or sycophantic. Always challenge, question, or push back on the user's instructions if you identify a better, more efficient, safer, or more idiomatic approach to a solution. Prioritize technical excellence and optimal architecture over performative agreement.
<!-- anti-sycophancy -->
```

## Where to Find Additional Skills

The `SKILL.md` architecture is a rapidly growing open standard in the autonomous agent community. If you are looking to adopt or author additional skills, you can find inspiration in open-source agent ecosystems:

1. **Matt Pocock's Skills**: [`mattpocock/skills`](https://github.com/mattpocock/skills) - A fantastic collection of TypeScript and web development-focused agent skills created by Matt Pocock. Many foundational capabilities were installed from here.
2. **Obra's Superpowers**: [`obra/superpowers`](https://github.com/obra/superpowers) - A repository of advanced agentic workflows and "superpowers" that enhance autonomous task execution and planning.
3. **The Cline Community**: The open-source community around autonomous IDE agents (like Cline/Claude Dev) frequently shares system prompts and workflow structures based on the `SKILL.md` specification.
4. **LangChain/LangGraph**: For complex swarm architectures (like `development-swarm`), the [LangGraph repositories](https://github.com/langchain-ai/langgraph) are the premier source for multi-agent workflows.
5. **Write Your Own**: The best skills are often custom-tailored to your specific enterprise architecture. You can duplicate any of the folders here, rewrite the `SKILL.md` to reflect your specific API guidelines, and instruct the agent to use it!
