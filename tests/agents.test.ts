import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  registerUpstreamPersonas,
  UPSTREAM_PERSONAS,
} from "../extensions/agents.ts";

async function createUpstreamPersonaFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-personas-"));
  await mkdir(path.join(root, "agents"));

  await Promise.all(
    UPSTREAM_PERSONAS.map((name) =>
      writeFile(
        path.join(root, "agents", `${name}.md`),
        `---\nname: ${name}\ndescription: ${name} persona\n---\n\nOriginal persona instructions for ${name}.`,
      ),
    ),
  );
  return root;
}

test("registers upstream personas with original prompts and read-only capabilities", async () => {
  const root = await createUpstreamPersonaFixture();
  const requests: Array<Record<string, unknown>> = [];
  const disposals: string[] = [];
  const pi = {
    events: {
      emit(channel: string, data: unknown) {
        assert.equal(channel, "pi-subagents:runtime-agent-register:v1");
        const request = data as Record<string, unknown>;
        requests.push(request);
        request.result = {
          ok: true,
          registration: { dispose: () => disposals.push(String(request.name)) },
        };
      },
    },
  };

  try {
    const result = await registerUpstreamPersonas(pi, root);

    assert.deepEqual(result.failures, []);
    assert.equal(result.registrations.length, 4);
    assert.deepEqual(
      requests.map((request) => request.name),
      UPSTREAM_PERSONAS,
    );
    for (const request of requests) {
      const definition = request.definition as Record<string, unknown>;
      assert.match(
        String(definition.systemPrompt),
        /Original persona instructions/,
      );
      assert.equal(
        String(definition.systemPrompt),
        String(definition.systemPrompt).trim(),
      );
      assert.match(
        String(definition.systemPrompt),
        /Resolve Markdown link destinations relative to the source file/,
      );
      assert.deepEqual(definition.tools, ["read", "grep", "find", "ls"]);
      assert.equal(definition.allowNestedSubagents, false);
      assert.equal(definition.inheritProjectContext, true);
      assert.equal(definition.inheritSkills, false);
      assert.equal("permissions" in definition, false);
    }

    const webPerformanceAgent = requests.find(
      (request) => request.name === "web-performance-auditor",
    )?.definition as Record<string, unknown>;
    assert.match(
      String(webPerformanceAgent.systemPrompt),
      /no shell or direct MCP tools/,
    );
    assert.match(
      String(webPerformanceAgent.systemPrompt),
      /label metrics not measured/,
    );

    for (const registration of result.registrations) registration.dispose();
    assert.deepEqual(disposals, UPSTREAM_PERSONAS);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports a clear missing pi-subagents integration", async () => {
  const root = await createUpstreamPersonaFixture();

  try {
    const result = await registerUpstreamPersonas(
      { events: { emit() {} } },
      root,
    );

    assert.equal(result.registrations.length, 0);
    assert.equal(result.failures.length, 4);
    assert.ok(
      result.failures.every((failure) =>
        failure.includes("pi install npm:pi-subagents@0.89.0"),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
