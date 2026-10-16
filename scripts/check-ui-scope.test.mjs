import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { contentViolation, isAllowed } from "./check-ui-scope.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "check-ui-scope.mjs");
const patterns = readFileSync(path.join(here, "../.github/ui-paths"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

describe("isAllowed with .github/ui-paths", () => {
  const cases = [
    ["apps/web/src/app/(app)/dashboard/page.tsx", true],
    ["apps/web/src/components/ui/button.tsx", true],
    ["apps/web/public/icons/icon-192.png", true],
    ["apps/web/public/.well-known/assetlinks.json", true],
    ["apps/web/src/app/(app)/x/route.ts", false],
    ["apps/web/src/app/(app)/x/route.tsx", false],
    ["apps/web/src/app/(auth)/login/actions.ts", false],
    ["apps/web/src/app/(app)/.hidden/route.ts", false],
    ["apps/web/public/sw.js", false],
    ["apps/web/public/sw2.js", false],
    ["apps/web/public/vendor/workbox.mjs", false],
    ["apps/web/src/components/shared/sw-register.tsx", false],
    ["apps/web/src/lib/auth.ts", false],
    ["apps/web/src/proxy.ts", false],
    [".github/ui-paths", false],
    [".github/workflows/ci.yml", false],
    ["scripts/check-ui-scope.mjs", false],
    [".claude/settings.json", false],
  ];
  for (const [file, expected] of cases) {
    test(`${file} → ${expected ? "allowed" : "denied"}`, () => {
      assert.equal(isAllowed(file, patterns), expected);
    });
  }

  test("guard files stay denied even if ui-paths allows them", () => {
    assert.equal(isAllowed(".github/ui-paths", [".github/**"]), false);
    assert.equal(isAllowed("scripts/check-ui-scope.mjs", ["**"]), false);
  });
});

describe("contentViolation", () => {
  test("allows class and markup changes", () => {
    assert.equal(contentViolation('<div className="p-4">', '<div className="p-6">'), null);
  });

  test('rejects a "use server" directive', () => {
    assert.match(contentViolation("", '"use server";\nexport async function save() {}'), /use server/);
  });

  test("rejects removing the auth gate", () => {
    const page = 'const session = await auth();\nif (!session?.user) redirect("/login");\n<Page />';
    assert.match(contentViolation(page, "<Page />"), /auth, Prisma or S3/);
  });

  test("rejects adding a Prisma call", () => {
    assert.match(contentViolation("", "await prisma.salesEntry.deleteMany()"), /auth, Prisma or S3/);
  });

  test("allows moving unchanged server lines", () => {
    const a = 'import { auth } from "@/lib/auth";\nconst x = 1;';
    const b = 'const x = 1;\nimport { auth } from "@/lib/auth";';
    assert.equal(contentViolation(a, b), null);
  });
});

describe("diff and hook modes in a scratch repository", () => {
  let repo;
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  const write = (file, text) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), text);
  };
  const diff = (env = {}) =>
    spawnSync("node", [script, "--base", "main"], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, GITHUB_HEAD_REF: "", ...env },
    });
  const hook = (input) =>
    spawnSync("node", [script, "--hook"], {
      cwd: repo,
      encoding: "utf8",
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    });
  const page = 'import { auth } from "@/lib/auth";\nconst session = await auth();\nexport default () => <div className="p-4" />;\n';

  before(() => {
    repo = mkdtempSync(path.join(tmpdir(), "ui-scope-"));
    git("init", "-q", "-b", "main");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "test");
    write(".github/ui-paths", patterns.join("\n"));
    write("apps/web/src/app/(app)/dashboard/page.tsx", page);
    write("apps/web/src/lib/auth.ts", "export const auth = () => null;\n");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    git("switch", "-q", "-c", "ui/test");
  });
  after(() => rmSync(repo, { recursive: true, force: true }));

  const reset = () => {
    git("reset", "-q", "--hard", "main");
  };

  test("passes a presentation-only change", () => {
    reset();
    write("apps/web/src/app/(app)/dashboard/page.tsx", page.replace("p-4", "p-6"));
    git("commit", "-qam", "style");
    const result = diff();
    assert.equal(result.status, 0, result.stderr);
  });

  test("fails a change to the auth gate", () => {
    reset();
    write("apps/web/src/app/(app)/dashboard/page.tsx", page.replace("const session = await auth();\n", ""));
    git("commit", "-qam", "drop auth");
    const result = diff();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dashboard\/page\.tsx: changes "const session = await auth\(\);"/);
  });

  test("fails a new server action", () => {
    reset();
    write("apps/web/src/app/(app)/dashboard/save.ts", '"use server";\nexport async function save() {}\n');
    git("add", "-A");
    git("commit", "-qm", "action");
    const result = diff();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /save\.ts: contains a "use server" directive/);
  });

  test("judges the branch with the base branch's ui-paths", () => {
    reset();
    write(".github/ui-paths", "**\n");
    write("apps/web/src/lib/auth.ts", "export const auth = () => ({});\n");
    git("commit", "-qam", "widen");
    const result = diff();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\.github\/ui-paths: outside/);
    assert.match(result.stderr, /apps\/web\/src\/lib\/auth\.ts: outside/);
  });

  test("doesn't apply content checks to prose", () => {
    reset();
    write("CHANGELOG.md", "- The session now calls auth() before prisma.user.findUnique\n");
    git("add", "-A");
    git("commit", "-qm", "notes");
    const result = diff();
    assert.equal(result.status, 0, result.stderr);
  });

  test("skips branches that aren't ui/*", () => {
    reset();
    write("apps/web/src/lib/auth.ts", "export const auth = () => ({});\n");
    git("commit", "-qam", "backend");
    const result = diff({ GITHUB_HEAD_REF: "feat/x" });
    assert.equal(result.status, 0);
  });

  test("hook blocks an out-of-scope file", () => {
    reset();
    const result = hook({ tool_name: "Write", tool_input: { file_path: path.join(repo, "apps/web/src/lib/x.ts"), content: "" } });
    assert.equal(result.status, 2);
  });

  test("hook blocks an edit that removes the auth call", () => {
    reset();
    const result = hook({
      tool_name: "Edit",
      tool_input: {
        file_path: path.join(repo, "apps/web/src/app/(app)/dashboard/page.tsx"),
        old_string: "const session = await auth();\n",
        new_string: "",
      },
    });
    assert.equal(result.status, 2);
  });

  test("hook allows a class change", () => {
    reset();
    const result = hook({
      tool_name: "Edit",
      tool_input: { file_path: path.join(repo, "apps/web/src/app/(app)/dashboard/page.tsx"), old_string: "p-4", new_string: "p-6" },
    });
    assert.equal(result.status, 0, result.stderr);
  });

  test("hook resolves symlinks into the repo", () => {
    reset();
    const outside = mkdtempSync(path.join(tmpdir(), "ui-scope-link-"));
    symlinkSync(path.join(repo, "apps/web/src/lib"), path.join(outside, "lib"));
    const result = hook({ tool_name: "Write", tool_input: { file_path: path.join(outside, "lib/x.ts"), content: "" } });
    rmSync(outside, { recursive: true, force: true });
    assert.equal(result.status, 2);
  });

  test("hook allows files outside every checkout", () => {
    reset();
    const result = hook({ tool_name: "Write", tool_input: { file_path: path.join(tmpdir(), "scratch-note.md"), content: "" } });
    assert.equal(result.status, 0, result.stderr);
  });

  test("hook fails closed on bad input", () => {
    const result = spawnSync("node", [script, "--hook"], { cwd: repo, encoding: "utf8", input: "not json" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /hook failed/);
  });
});
