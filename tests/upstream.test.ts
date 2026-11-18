import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { mock } from "node:test";
import {
  discoverUpstreamRoot,
  parseMarkdownResource,
  readUpstreamResource,
} from "../extensions/upstream.ts";

const upstreamSource = "git:github.com/addyosmani/agent-skills";

function command(source: string, baseDir?: string) {
  return {
    sourceInfo: {
      source,
      ...(baseDir ? { baseDir } : {}),
    },
  };
}

test("discovers the upstream package through Pi resource metadata", () => {
  const root = path.resolve("upstream-package");
  const result = discoverUpstreamRoot([
    command(
      "git:github.com/someone/other-package",
      path.resolve("other-package"),
    ),
    command(upstreamSource, root),
  ]);

  assert.equal(result, root);
});

test("rejects missing, incomplete, and ambiguous upstream metadata", () => {
  assert.throws(
    () => discoverUpstreamRoot([]),
    /Install.*addyosmani\/agent-skills/i,
  );
  assert.throws(
    () => discoverUpstreamRoot([command(upstreamSource)]),
    /base directory/i,
  );
  assert.throws(
    () =>
      discoverUpstreamRoot([
        command(upstreamSource, path.resolve("first")),
        command(upstreamSource, path.resolve("second")),
      ]),
    /multiple.*upstream/i,
  );
});

test("parses command and persona frontmatter without changing the body", () => {
  const markdown = `---\nname: reviewer\ndescription: Review code: carefully\n---\n\nKeep the original body.`;
  const resource = parseMarkdownResource(markdown);

  assert.equal(resource.metadata.name, "reviewer");
  assert.equal(resource.metadata.description, "Review code: carefully");
  assert.equal(resource.body, "\nKeep the original body.");
});

for (const replacement of ["directory junction", "different file"] as const) {
  test(`rejects a ${replacement} replacement after path resolution`, async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-resource-race-"));
    const root = path.join(tempDir, "upstream");
    const directory = path.join(root, "commands");
    const externalDirectory = path.join(tempDir, "external");
    const resource = path.join(directory, "review.md");
    const originalRealpath = fs.realpath;
    let swapped = false;

    try {
      await mkdir(directory, { recursive: true });
      await mkdir(externalDirectory);
      await writeFile(resource, "Trusted prompt");
      await writeFile(
        path.join(externalDirectory, "review.md"),
        "Outside content",
      );
      const realpathMock = mock.method(
        fs,
        "realpath",
        async (filename: string) => {
          const resolved = await originalRealpath(filename);
          if (filename === resource && !swapped) {
            swapped = true;
            if (replacement === "directory junction") {
              await fs.rename(directory, `${directory}-original`);
              await symlink(
                externalDirectory,
                directory,
                process.platform === "win32" ? "junction" : "dir",
              );
            } else {
              await fs.rename(resource, `${resource}-original`);
              await fs.copyFile(
                path.join(externalDirectory, "review.md"),
                resource,
              );
            }
          }
          return resolved;
        },
      );
      try {
        await assert.rejects(
          readUpstreamResource(root, "commands/review.md"),
          /changed|outside.*upstream package/i,
        );
        assert.equal(swapped, true);
      } finally {
        realpathMock.mock.restore();
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
}

test("reads the validated handle even if its path is replaced before reading", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-resource-handle-"));
  const resource = path.join(root, "review.md");
  const originalRealpath = fs.realpath;
  let resolutions = 0;
  try {
    await writeFile(resource, "Trusted prompt");
    const realpathMock = mock.method(
      fs,
      "realpath",
      async (filename: string) => {
        const resolved = await originalRealpath(filename);
        if (filename === resource && ++resolutions === 2) {
          await fs.rename(resource, `${resource}-original`);
          await writeFile(resource, "Replacement content");
        }
        return resolved;
      },
    );
    try {
      assert.equal(
        await readUpstreamResource(root, "review.md"),
        "Trusted prompt",
      );
      assert.equal(resolutions, 2);
    } finally {
      realpathMock.mock.restore();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reads only files contained in the dynamically discovered upstream root", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-agent-skills-"));
  const root = path.join(tempDir, "upstream");
  const externalFile = path.join(tempDir, "outside.md");

  try {
    await mkdir(path.join(root, ".claude", "commands"), { recursive: true });
    await writeFile(
      path.join(root, ".claude", "commands", "review.md"),
      "---\ndescription: Review\n---\n\nBody",
    );
    await writeFile(externalFile, "Outside");

    assert.equal(
      await readUpstreamResource(root, ".claude/commands/review.md"),
      "---\ndescription: Review\n---\n\nBody",
    );
    await assert.rejects(
      readUpstreamResource(root, "../outside.md"),
      /outside.*upstream package/i,
    );

    if (process.platform !== "win32") {
      await symlink(
        externalFile,
        path.join(root, ".claude", "commands", "external.md"),
      );
      await assert.rejects(
        readUpstreamResource(root, ".claude/commands/external.md"),
        /outside.*upstream package/i,
      );
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
