#!/usr/bin/env node
// Keeps ui/* branches to frontend presentation files listed in
// .github/ui-paths. Other branches pass untouched.
//
//   node scripts/check-ui-scope.mjs [--base <ref>]   check the branch diff (CI, manual)
//   node scripts/check-ui-scope.mjs --hook           Claude Code PreToolUse hook (JSON on stdin)

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const UI_BRANCH_PREFIX = "ui/";

const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

function loadPatterns(root) {
  return readFileSync(path.join(root, ".github/ui-paths"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

// A path is allowed when it matches an allow pattern and no "!" pattern.
function isAllowed(file, patterns) {
  let allowed = false;
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      if (path.matchesGlob(file, pattern.slice(1))) return false;
    } else if (path.matchesGlob(file, pattern)) {
      allowed = true;
    }
  }
  return allowed;
}

function runHook() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  const cwd = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  if (!target) return 0;

  const root = git(cwd, "rev-parse", "--show-toplevel");
  const branch = git(root, "branch", "--show-current");
  if (!branch.startsWith(UI_BRANCH_PREFIX)) return 0;

  const file = path.relative(root, path.resolve(cwd, target));
  // Files outside the repo (scratch space, memory) aren't in scope.
  if (file.startsWith("..") || path.isAbsolute(file)) return 0;
  if (isAllowed(file, loadPatterns(root))) return 0;

  console.error(
    `Blocked: ${file} is outside the UI-only scope of ${branch} (.github/ui-paths). ` +
      "If this change needs it, it isn't UI-only work: move it to a feat/ or fix/ branch.",
  );
  return 2;
}

function runDiff(args) {
  const root = git(process.cwd(), "rev-parse", "--show-toplevel");
  const branch =
    process.env.GITHUB_HEAD_REF || git(root, "branch", "--show-current");
  if (!branch.startsWith(UI_BRANCH_PREFIX)) {
    console.log(`${branch || "detached HEAD"} is not a ${UI_BRANCH_PREFIX} branch; skipping.`);
    return 0;
  }

  const baseIndex = args.indexOf("--base");
  const base = baseIndex === -1 ? "origin/main" : args[baseIndex + 1];
  // --no-renames lists a moved file under both its old and new path.
  const files = git(root, "diff", "--name-only", "--no-renames", `${base}...HEAD`)
    .split("\n")
    .filter(Boolean);
  const patterns = loadPatterns(root);
  const outside = files.filter((file) => !isAllowed(file, patterns));

  if (outside.length === 0) {
    console.log(`${branch}: ${files.length} changed file(s), all within .github/ui-paths.`);
    return 0;
  }
  console.error(`${branch} changes files outside .github/ui-paths:`);
  for (const file of outside) console.error(`  ${file}`);
  console.error("Move these to a feat/ or fix/ branch, or widen .github/ui-paths in its own PR.");
  return 1;
}

const args = process.argv.slice(2);
process.exit(args.includes("--hook") ? runHook() : runDiff(args));
