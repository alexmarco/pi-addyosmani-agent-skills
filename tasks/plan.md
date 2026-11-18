# Pi integration for Addy Osmani Agent Skills

## Goal

Integrate Pi with the upstream `addyosmani/agent-skills` repository while keeping upstream content separate and unmodified. Pi remains responsible for native progressive skill discovery. This project contains only the adapter and its tests.

## Decisions

- Install upstream directly through Pi; do not vendor, fork, translate, or copy its content into this repository.
- Discover the installed upstream checkout dynamically through Pi resource metadata. Do not rely on a fixed Pi cache path.
- Register all nine upstream command workflows in Pi and preserve their original instructions and reference resolution, applying only necessary host-semantic adaptations.
- Register the four original personas automatically through the runtime agent-registration API of `pi-subagents`. Require that executor to be installed separately; report clearly when it is unavailable.
- Preserve upstream persona instructions and declared capabilities. Do not grant additional tools or permissions by default.
- Do not port upstream hooks.
- For planning, keep `tasks/plan.md`; default task tracking to `tasks/todo.md`. Use a project- or user-designated task manager instead of `tasks/todo.md`, without imposing a tracker integration.
- Keep the integration minimal and removable while upstream issue #802 is open. Do not contact upstream without authorization.
- Initial version: `0.1.0`. Do not publish to npm or create a release without authorization.

## Implementation plan

1. Bootstrap the empty repository with GitFlow branches, Node.js tooling, package metadata, and contributor guidance.
2. Define the supported upstream installation and dynamic resource-resolution contract.
3. Implement the Pi extension: discover upstream, register original commands, and register personas with `pi-subagents`.
4. Add focused tests for upstream discovery, command registration and references, task-target behavior, persona instruction/tool preservation, and actionable missing-resource diagnostics.
5. Verify on Windows and Git Bash, run the repository checks, and inspect the package artifact without publishing.

## Acceptance criteria

- Pi natively discovers upstream skills without copies in this repository.
- All nine commands are registered from the installed upstream files; referenced material resolves from the upstream checkout.
- Planning uses `tasks/todo.md` by default and defers to an explicitly designated project task manager while retaining `tasks/plan.md`.
- All four personas are registered with a functioning subagent executor, retain their upstream instructions, and do not receive broader tools or permissions by default.
- Missing upstream, an incompatible upstream layout, or a missing subagent executor produces a clear diagnostic.
- Tests and checks pass on Windows/Git Bash; no publishing, release, upstream PR, or upstream comment is performed.
