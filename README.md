# Pi adapter for Addy Osmani Agent Skills

A small Pi integration for the original [Addy Osmani Agent Skills](https://github.com/addyosmani/agent-skills) repository. Upstream remains the source of truth; this repository contains no copy of its skills, commands, personas, or hooks.

## Install

Install upstream and the subagent executor directly through Pi, then install this adapter:

```bash
pi install git:github.com/addyosmani/agent-skills
pi install npm:pi-subagents@0.89.0
pi install git:github.com/alexmarco/pi-addyosmani-agent-skills
```

The adapter uses Pi's native skill discovery and automatically locates the upstream package from Pi resource metadata; no cache path configuration is needed. It registers the nine upstream commands and connects the four upstream personas to `pi-subagents`. The personas receive read-only file tools and cannot launch nested agents. The web-performance persona has no shell or direct MCP access; pass measurement artifacts to it. The executor is a separate Pi extension; version 0.89.0 or newer is required for persona delegation.

## Upstream compatibility

The adapter reads resources from the upstream installation discovered at runtime. It does not assume a fixed Pi cache path or modify upstream files. If upstream is missing or its required layout changes, the adapter reports the problem instead of silently using stale or copied content.

Upstream planning instructions use `tasks/todo.md` by default. If the user or project instructions designate another task manager, planning should use that target and keep `tasks/plan.md` as the plan and index.

Upstream hooks are not included; implementation scope and acceptance criteria are tracked in this repository's project plan.

## Development

Requires Node.js 22.19 or newer.

```bash
npm install
npm run check
```

The repository follows GitFlow: feature and bug-fix branches start from `develop` and target `develop`; `main` is reserved for released content. No npm publication or GitHub release is configured or authorized.
