import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { compareVersions, getUpdateStatePath, parseNpmViewVersion, promptForPendingUpdate } from "../updateCheck";

test("compareVersions orders semantic versions", () => {
  assert.equal(compareVersions("0.1.4", "0.1.3"), 1);
  assert.equal(compareVersions("0.2.0", "0.10.0"), -1);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.0", "1.0.0-beta.1"), 0);
});

test("parseNpmViewVersion parses npm view JSON and plain output", () => {
  assert.equal(parseNpmViewVersion('"0.1.4"\n'), "0.1.4");
  assert.equal(parseNpmViewVersion("0.1.5\n"), "0.1.5");
  assert.equal(parseNpmViewVersion("\n"), null);
});

test("promptForPendingUpdate clears pending updates for a different package name", { timeout: 1000 }, async () => {
  const previousHome = process.env.HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "doku-update-home-"));
  process.env.HOME = home;

  try {
    const statePath = getUpdateStatePath();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(
      statePath,
      JSON.stringify(
        {
          pending: {
            currentVersion: "0.1.0",
            latestVersion: "1.0.2",
            packageName: "deepseek-cli",
            checkedAt: "2026-05-24T00:00:00.000Z",
          },
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    const result = await promptForPendingUpdate({ name: "doku-deepseek-cli", version: "0.1.0" });

    assert.deepEqual(result, { installed: false });
    assert.equal(JSON.parse(fs.readFileSync(statePath, "utf8")).pending, null);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    fs.rmSync(home, { recursive: true, force: true });
  }
});
