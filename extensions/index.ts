import path from "node:path";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  buildCommandPrompt,
  commandDescription,
  UPSTREAM_COMMANDS,
} from "./commands.ts";
import { registerUpstreamPersonas } from "./agents.ts";
import { discoverUpstreamRoot, readUpstreamResource } from "./upstream.ts";

const COMMAND_DIRECTORY = ".claude/commands";

export default function addyOsmaniAgentSkills(pi: ExtensionAPI): void {
  let registeredCommands = false;
  let personaDisposers: Array<() => void> = [];

  const disposePersonas = () => {
    for (const dispose of personaDisposers) dispose();
    personaDisposers = [];
  };

  pi.on("session_start", async (_event, ctx) => {
    disposePersonas();

    const commands = pi.getCommands();
    let upstreamRoot: string | undefined;
    try {
      upstreamRoot = discoverUpstreamRoot(commands);
    } catch (error) {
      report(
        ctx,
        error instanceof Error ? error.message : String(error),
        "warning",
      );
    }

    if (!registeredCommands) {
      await registerCommands(pi, commands, upstreamRoot, ctx);
      registeredCommands = true;
    }

    if (!upstreamRoot) return;

    const result = await registerUpstreamPersonas(pi, upstreamRoot);
    personaDisposers = result.registrations.map(
      (registration) => () => registration.dispose(),
    );
    if (result.failures.length > 0) {
      report(
        ctx,
        `Could not register upstream personas:\n${result.failures.join("\n")}`,
        "warning",
      );
    }
  });

  pi.on("session_shutdown", () => {
    disposePersonas();
  });
}

async function registerCommands(
  pi: ExtensionAPI,
  commands: ReturnType<ExtensionAPI["getCommands"]>,
  discoveredRoot: string | undefined,
  ctx: ExtensionContext,
): Promise<void> {
  for (const name of UPSTREAM_COMMANDS) {
    const conflictingCommand = commands.find(
      (command) => command.name === name && command.source !== "skill",
    );
    if (conflictingCommand) {
      report(
        ctx,
        `/${name} was not registered because another Pi command already uses that name.`,
        "warning",
      );
      continue;
    }

    let description = `Run the upstream /${name} workflow`;
    if (discoveredRoot) {
      try {
        const markdown = await readUpstreamResource(
          discoveredRoot,
          `${COMMAND_DIRECTORY}/${name}.md`,
        );
        description = commandDescription(markdown, name);
      } catch {
        // Keep the command available so invocation can report the missing upstream resource.
      }
    }

    pi.registerCommand(name, {
      description,
      handler: async (args, ctx) => {
        await runUpstreamCommand(pi, name, args, ctx);
      },
    });
  }
}

async function runUpstreamCommand(
  pi: ExtensionAPI,
  name: (typeof UPSTREAM_COMMANDS)[number],
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  try {
    const upstreamRoot = discoverUpstreamRoot(pi.getCommands());
    const relativePath = `${COMMAND_DIRECTORY}/${name}.md`;
    const markdown = await readUpstreamResource(upstreamRoot, relativePath);
    const sourcePath = path.join(upstreamRoot, relativePath);
    pi.sendUserMessage(
      buildCommandPrompt(name, markdown, sourcePath, upstreamRoot, args),
    );
  } catch (error) {
    report(
      ctx,
      error instanceof Error ? error.message : String(error),
      "error",
    );
  }
}

function report(
  ctx: ExtensionContext | ExtensionCommandContext,
  message: string,
  level: "warning" | "error",
): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
    return;
  }
  throw new Error(message);
}
