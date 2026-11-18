import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  SlashCommandInfo,
} from "@earendil-works/pi-coding-agent";
import extension from "../extensions/index.ts";
import { UPSTREAM_COMMANDS } from "../extensions/commands.ts";
import { UPSTREAM_PERSONAS } from "../extensions/agents.ts";

const upstreamSource = "git:github.com/addyosmani/agent-skills";

async function createUpstreamFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-upstream-extension-"));
  await mkdir(path.join(root, ".claude", "commands"), { recursive: true });
  await mkdir(path.join(root, "agents"), { recursive: true });

  await Promise.all([
    ...UPSTREAM_COMMANDS.map((name) =>
      writeFile(
        path.join(root, ".claude", "commands", `${name}.md`),
        `---\ndescription: ${name} workflow\n---\n\nOriginal /${name} instructions $ARGUMENTS.`,
      ),
    ),
    ...UPSTREAM_PERSONAS.map((name) =>
      writeFile(
        path.join(root, "agents", `${name}.md`),
        `---\nname: ${name}\ndescription: ${name} persona\n---\n\nOriginal ${name} instructions.`,
      ),
    ),
  ]);
  return root;
}

function createPiMock(
  root: string | undefined,
  existingCommands: SlashCommandInfo[] = [],
) {
  const handlers = new Map<string, (event: never, ctx: never) => unknown>();
  const registeredCommands = new Map<
    string,
    {
      description?: string;
      handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
    }
  >();
  const messages: string[] = [];
  const notifications: string[] = [];
  const registrations: string[] = [];
  let disposedPersonas = 0;
  const upstreamCommands: SlashCommandInfo[] = root
    ? [
        {
          name: "skill:planning-and-task-breakdown",
          source: "skill",
          sourceInfo: {
            source: upstreamSource,
            scope: "user",
            origin: "package",
            path: path.join(
              root,
              "skills",
              "planning-and-task-breakdown",
              "SKILL.md",
            ),
            baseDir: root,
          },
        },
      ]
    : [];

  const pi = {
    getCommands: () => [...existingCommands, ...upstreamCommands],
    registerCommand: (
      name: string,
      options: {
        description?: string;
        handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
      },
    ) => {
      registeredCommands.set(name, options);
    },
    sendUserMessage: (message: string) => messages.push(message),
    on: (event: string, handler: (event: never, ctx: never) => unknown) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    },
    events: {
      emit: (channel: string, rawRequest: unknown) => {
        assert.equal(channel, "pi-subagents:runtime-agent-register:v1");
        const request = rawRequest as { name: string; result?: unknown };
        registrations.push(request.name);
        request.result = {
          ok: true,
          registration: { dispose: () => disposedPersonas++ },
        };
      },
    },
  } as unknown as ExtensionAPI;

  const ctx = {
    hasUI: true,
    ui: { notify: (message: string) => notifications.push(message) },
  } as unknown as ExtensionContext;

  return {
    pi,
    ctx,
    handlers,
    registeredCommands,
    messages,
    notifications,
    registrations,
    get disposedPersonas() {
      return disposedPersonas;
    },
  };
}

test("registers all upstream commands and personas from Pi package metadata", async () => {
  const root = await createUpstreamFixture();
  const mock = createPiMock(root);

  try {
    extension(mock.pi);
    await mock.handlers.get("session_start")?.({} as never, mock.ctx as never);

    assert.deepEqual([...mock.registeredCommands.keys()], UPSTREAM_COMMANDS);
    assert.deepEqual(mock.registrations, UPSTREAM_PERSONAS);
    assert.equal(
      mock.registeredCommands.get("build")?.description,
      "build workflow",
    );

    await mock.registeredCommands
      .get("build")
      ?.handler("auto", mock.ctx as never);
    assert.equal(mock.messages.length, 1);
    assert.match(mock.messages[0]!, /Original \/build instructions auto\./);
    assert.match(
      mock.messages[0]!,
      new RegExp(root.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );

    await mock.handlers.get("session_shutdown")?.(
      {} as never,
      mock.ctx as never,
    );
    assert.equal(mock.disposedPersonas, 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("leaves conflicting commands untouched and reports missing upstream installation", async () => {
  const conflictingCommand = {
    name: "review",
    source: "extension",
    sourceInfo: {
      source: "other-extension",
      scope: "user",
      origin: "package",
      path: "other.ts",
    },
  } as SlashCommandInfo;
  const mock = createPiMock(undefined, [conflictingCommand]);

  extension(mock.pi);
  await mock.handlers.get("session_start")?.({} as never, mock.ctx as never);

  assert.equal(mock.registeredCommands.has("review"), false);
  assert.equal(mock.registeredCommands.size, UPSTREAM_COMMANDS.length - 1);
  assert.ok(
    mock.notifications.some((message) =>
      message.includes("pi install git:github.com/addyosmani/agent-skills"),
    ),
  );
  assert.ok(
    mock.notifications.some((message) =>
      message.includes("/review was not registered"),
    ),
  );

  await mock.registeredCommands.get("build")?.handler("", mock.ctx as never);
  assert.ok(
    mock.notifications.some((message) =>
      message.includes("is not installed in Pi"),
    ),
  );
});
