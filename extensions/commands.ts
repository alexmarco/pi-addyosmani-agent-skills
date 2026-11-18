import { parseMarkdownResource } from "./upstream.ts";

export const UPSTREAM_COMMANDS = [
  "build",
  "code-simplify",
  "constraints",
  "plan",
  "review",
  "ship",
  "spec",
  "test",
  "webperf",
] as const;

export function commandDescription(
  markdown: string,
  commandName: string,
): string {
  const description = parseMarkdownResource(markdown).metadata.description;
  return description || `Run the upstream /${commandName} workflow`;
}

export function buildCommandPrompt(
  commandName: string,
  markdown: string,
  sourcePath: string,
  upstreamRoot: string,
  args: string,
): string {
  const { body } = parseMarkdownResource(markdown);
  const hasArgumentPlaceholder = body.includes("$ARGUMENTS");
  const sections = [body.replaceAll("$ARGUMENTS", args)];

  if (!hasArgumentPlaceholder && args.trim()) {
    sections.push(`User-provided arguments: ${args}`);
  }

  sections.push(
    [
      "Pi host adaptation: these upstream instructions are loaded from the source file below. Resolve Markdown link destinations relative to the source file; resolve explicit upstream repository paths from the package root. Paths referring to the current project remain relative to the project working directory.",
      `Source file: ${sourcePath}`,
      `Upstream package root: ${upstreamRoot}`,
    ].join("\n"),
  );

  if (body.includes("agent-skills:")) {
    sections.push(
      "Pi host adaptation: upstream skills are discovered by Pi under the names shown in its available-skills list, without the `agent-skills:` namespace. Use Pi's native progressive skill discovery; do not manually rediscover or inject skill contents.",
    );
  }

  if (commandName === "plan") {
    sections.push(
      "Pi host planning policy: use `tasks/todo.md` as the default task list. If the user or project instructions explicitly designate another task manager, put the task checklist there instead. Keep `tasks/plan.md` as the Markdown plan and index, and preserve the upstream protection against overwriting a different incomplete plan.",
    );
  }

  if (commandName === "ship") {
    sections.push(
      "Pi host adaptation: use the `subagent` tool from pi-subagents instead of Claude Code's `Agent` tool. Dispatch the three personas in one parallel `tasks` request, including changed file paths and relevant diff/context because personas have read-only file tools and no shell or Git tool. If that tool is unavailable, follow the upstream fallback. Do not grant personas additional tools or permissions.",
    );
  }

  return sections.join("\n\n");
}
