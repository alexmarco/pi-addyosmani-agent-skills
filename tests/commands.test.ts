import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommandPrompt,
  commandDescription,
} from "../extensions/commands.ts";

const commandMarkdown = `---\ndescription: A test command\ndisable-model-invocation: true\n---\n\nRun workflow with $ARGUMENTS.`;

test("uses upstream command descriptions and replaces documented arguments", () => {
  assert.equal(commandDescription(commandMarkdown, "build"), "A test command");

  const prompt = buildCommandPrompt(
    "build",
    commandMarkdown,
    "/upstream/.claude/commands/build.md",
    "/upstream",
    "auto",
  );
  assert.match(prompt, /Run workflow with auto\./);
  assert.doesNotMatch(prompt, /\$ARGUMENTS/);
  assert.match(prompt, /\/upstream\/\.claude\/commands/);
});

test("adds task-target and native-skill adaptations without changing upstream text", () => {
  const markdown = `---\ndescription: Make a plan\n---\n\nInvoke agent-skills:planning-and-task-breakdown. Save the plan and task list.`;
  const prompt = buildCommandPrompt(
    "plan",
    markdown,
    "/upstream/.claude/commands/plan.md",
    "/upstream",
    "",
  );

  assert.ok(
    prompt.includes(
      "Invoke agent-skills:planning-and-task-breakdown. Save the plan and task list.",
    ),
  );
  assert.match(prompt, /`tasks\/todo\.md` as the default task list/);
  assert.match(prompt, /explicitly designate another task manager/);
  assert.match(prompt, /Pi's native progressive skill discovery/);
});

test("maps the shipping fan-out to the Pi subagent parallel interface", () => {
  const markdown = `---\ndescription: Ship safely\n---\n\nSpawn three specialists using Agent.`;
  const prompt = buildCommandPrompt(
    "ship",
    markdown,
    "/upstream/.claude/commands/ship.md",
    "/upstream",
    "",
  );

  assert.ok(prompt.includes("Spawn three specialists using Agent."));
  assert.match(prompt, /`subagent` tool from pi-subagents/);
  assert.match(prompt, /one parallel `tasks` request/);
  assert.match(prompt, /changed file paths and relevant diff\/context/);
});

test("preserves command arguments when upstream has no placeholder", () => {
  const prompt = buildCommandPrompt(
    "review",
    commandMarkdown.replace("$ARGUMENTS", ""),
    "/upstream/review.md",
    "/upstream",
    "src/index.ts",
  );
  assert.match(prompt, /User-provided arguments: src\/index\.ts/);
});
