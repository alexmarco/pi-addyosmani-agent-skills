# Pi adapter for Addy Osmani Agent Skills

A small Pi integration for the original [Addy Osmani Agent Skills](https://github.com/addyosmani/agent-skills) repository. Upstream remains the source of truth; this repository contains no copy of its skills, commands, personas, or hooks.

## Install

Install upstream and the subagent executor directly through Pi, then install this adapter:

```bash
pi install git:github.com/addyosmani/agent-skills
pi install npm:pi-subagents
pi install git:github.com/alexmarco/pi-addyosmani-agent-skills
```

The adapter uses Pi's native skill discovery. It registers the nine upstream commands and connects the four upstream personas to `pi-subagents`. The executor is a separate Pi extension and must be installed for persona delegation.

## Upstream compatibility

The adapter reads resources from the upstream installation discovered at runtime. It does not assume a fixed Pi cache path or modify upstream files. If upstream is missing or its required layout changes, the adapter reports the problem instead of silently using stale or copied content.

Upstream planning instructions use `tasks/todo.md` by default. If the user or project instructions designate another task manager, planning should use that target and keep `tasks/plan.md` as the plan and index.

Upstream hooks are not included. See [the plan](tasks/plan.md) for scope and acceptance criteria.

## Development

Requires Node.js 22.19 or newer.

```bash
npm install
npm run check
```

The repository follows GitFlow: feature and bug-fix branches start from `develop` and target `develop`; `main` is reserved for released content. No npm publication or GitHub release is configured or authorized.
