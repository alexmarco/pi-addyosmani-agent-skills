import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
) as {
  private: boolean;
  version: string;
};

test("package uses the agreed private 0.1.0 bootstrap version", () => {
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.version, "0.1.0");
});
