import path from "node:path";
import { parseMarkdownResource, readUpstreamResource } from "./upstream.ts";

const RUNTIME_AGENT_REGISTER_EVENT = "pi-subagents:runtime-agent-register:v1";
const READ_ONLY_TOOLS = ["read", "grep", "find", "ls"] as const;

export const UPSTREAM_PERSONAS = [
  "code-reviewer",
  "security-auditor",
  "test-engineer",
  "web-performance-auditor",
] as const;

export interface RuntimeAgentDefinition {
  description: string;
  systemPrompt: string;
  tools: readonly string[];
  allowNestedSubagents: false;
  inheritProjectContext: true;
  inheritSkills: false;
}

interface RuntimeAgentRegistration {
  dispose(): void;
}

interface RuntimeAgentRegistrationResult {
  ok: boolean;
  registration?: RuntimeAgentRegistration;
  error?: unknown;
}

interface RuntimeAgentRegistrationRequest {
  version: 1;
  name: string;
  definition: RuntimeAgentDefinition;
  result?: RuntimeAgentRegistrationResult;
}

export interface RuntimeAgentEventBus {
  emit(channel: string, data: unknown): void;
}

export interface RuntimeAgentRegistrant {
  events: RuntimeAgentEventBus;
}

export interface PersonaRegistrationResult {
  registrations: RuntimeAgentRegistration[];
  failures: string[];
}

export async function registerUpstreamPersonas(
  pi: RuntimeAgentRegistrant,
  upstreamRoot: string,
): Promise<PersonaRegistrationResult> {
  const registrations: RuntimeAgentRegistration[] = [];
  const failures: string[] = [];

  for (const name of UPSTREAM_PERSONAS) {
    try {
      const relativePath = `agents/${name}.md`;
      const markdown = await readUpstreamResource(upstreamRoot, relativePath);
      const resource = parseMarkdownResource(markdown);
      if (resource.metadata.name !== name || !resource.metadata.description) {
        throw new Error(
          `Upstream persona metadata does not match the expected '${name}' persona.`,
        );
      }

      const hostContext = [
        "Pi host context: this persona's source file is below. Resolve Markdown link destinations relative to the source file, and explicit upstream repository paths relative to the upstream package root. Resolve project paths from the project working directory.",
        `Source file: ${path.join(upstreamRoot, relativePath)}`,
        `Upstream package root: ${upstreamRoot}`,
      ].join("\n");
      const systemPrompt = [
        resource.body,
        hostContext,
        ...(name === "web-performance-auditor"
          ? [
              "Pi capability boundary: this persona has read-only file tools only, with no shell or direct MCP tools. Use supplied performance artifacts or measurements from the calling agent; without measured data, follow Quick mode and label metrics not measured. Do not invent measurements or run local capture commands.",
            ]
          : []),
      ].join("\n\n");

      const request: RuntimeAgentRegistrationRequest = {
        version: 1,
        name,
        definition: {
          description: resource.metadata.description,
          systemPrompt,
          tools: READ_ONLY_TOOLS,
          allowNestedSubagents: false,
          inheritProjectContext: true,
          inheritSkills: false,
        },
      };

      pi.events.emit(RUNTIME_AGENT_REGISTER_EVENT, request);
      const result = request.result;
      if (!result) {
        throw new Error(
          "pi-subagents is not installed, is not ready, or does not support runtime agent registration. Install it with `pi install npm:pi-subagents@0.89.0`.",
        );
      }
      if (
        result.ok !== true ||
        typeof result.registration?.dispose !== "function"
      ) {
        throw result.error instanceof Error
          ? result.error
          : new Error(`pi-subagents could not register persona '${name}'.`);
      }

      registrations.push(result.registration);
    } catch (error) {
      failures.push(
        `${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { registrations, failures };
}
