import { realpath, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const UPSTREAM_PACKAGE_SOURCE = "git:github.com/addyosmani/agent-skills";

export interface UpstreamCommandMetadata {
  sourceInfo: {
    source: string;
    baseDir?: string;
  };
}

export interface ParsedMarkdownResource {
  metadata: Record<string, string>;
  body: string;
}

export function discoverUpstreamRoot(
  commands: readonly UpstreamCommandMetadata[],
): string {
  const upstreamEntries = commands.filter(
    (command) => command.sourceInfo.source === UPSTREAM_PACKAGE_SOURCE,
  );
  if (upstreamEntries.length === 0) {
    throw new Error(
      "The upstream package addyosmani/agent-skills is not installed in Pi. Install it with `pi install git:github.com/addyosmani/agent-skills`.",
    );
  }

  const roots = upstreamEntries.map((command) => command.sourceInfo.baseDir);
  if (roots.some((root) => !root)) {
    throw new Error(
      "Pi did not provide the upstream package base directory; reload Pi after installing the package.",
    );
  }

  const uniqueRoots = new Set(roots.map((root) => path.resolve(root!)));
  if (uniqueRoots.size !== 1) {
    throw new Error(
      "Multiple upstream agent-skills package roots are visible to Pi; keep one installation enabled.",
    );
  }

  return [...uniqueRoots][0]!;
}

export function parseMarkdownResource(
  markdown: string,
): ParsedMarkdownResource {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(
    markdown,
  );
  if (!match) {
    throw new Error("Upstream Markdown resource is missing YAML frontmatter.");
  }

  const metadata: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const field = /^([a-z][a-z0-9_-]*):\s*(.*)$/.exec(line);
    if (!field) continue;

    let value = field[2]!.trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (
      value.length >= 2 &&
      value.startsWith("'") &&
      value.endsWith("'")
    ) {
      value = value.slice(1, -1).replaceAll("''", "'");
    }
    metadata[field[1]!] = value;
  }

  return { metadata, body: markdown.slice(match[0].length) };
}

export async function readUpstreamResource(
  root: string,
  relativePath: string,
): Promise<string> {
  const actualRoot = await realpath(root);
  const unresolvedPath = path.resolve(actualRoot, relativePath);
  if (!isWithin(actualRoot, unresolvedPath)) {
    throw new Error(
      `Resource path is outside the upstream package: ${relativePath}`,
    );
  }

  const actualPath = await realpath(unresolvedPath);
  if (!isWithin(actualRoot, actualPath)) {
    throw new Error(
      `Resource path is outside the upstream package: ${relativePath}`,
    );
  }
  if (!(await stat(actualPath)).isFile()) {
    throw new Error(`Upstream resource is not a file: ${relativePath}`);
  }

  return readFile(actualPath, "utf8");
}

function isWithin(root: string, target: string): boolean {
  const relativePath = path.relative(root, target);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath))
  );
}
