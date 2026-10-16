#!/usr/bin/env node
// Keeps ui/* branches to frontend presentation files listed in
// .github/ui-paths. Other branches pass untouched.
//
//   node scripts/check-ui-scope.mjs [--base <ref>] [--head <ref>]   check the branch diff (CI, manual)
//   node scripts/check-ui-scope.mjs --hook                          Claude Code PreToolUse hook (JSON on stdin)
//
// Diff mode reads the patterns from <base>, so a ui/* branch can't widen
// its own allowlist. On top of the path check, it rejects server actions
// and changed lines that touch auth, Prisma or S3 in allowed files.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const UI_BRANCH_PREFIX = "ui/";

// The guard's own files, denied on ui/* branches whatever ui-paths says.
const GUARD_PATHS = [".github/**", "scripts/**", ".claude/**", "CODEOWNERS"];

// A "use server" directive makes a file or function a server action.
const USE_SERVER = /^\s*["']use server["'];?\s*$/m;

// Lines that load data, check the session or redirect in server components.
// A line-level heuristic: it catches imports, calls and the auth gate, not
// every line of a multi-line query.
const SERVER_DATA = /@\/lib\/(prisma|auth|s3)\b|\bprisma\.|\bauth\(|\bsession\b|\bredirect\(/;

// Content checks apply to code; prose like CHANGELOG.md can mention auth.
const isCode = (file) => /\.[cm]?[jt]sx?$/.test(file);

const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

function parsePatterns(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

// path.matchesGlob skips segments that start with a dot, so "**" would miss
// public/.well-known and "!**/route.*" would miss .x/route.ts. Escaping the
// leading dot on both sides makes dot segments match like any other.
const undot = (p) =>
  p
    .split("/")
    .map((segment) => segment.replace(/^\./, "_DOT_"))
    .join("/");
const matches = (file, pattern) => path.matchesGlob(undot(file), undot(pattern));

// A path is allowed when it matches an allow pattern and no "!" pattern.
export function isAllowed(file, patterns) {
  if (GUARD_PATHS.some((pattern) => matches(file, pattern))) return false;
  let allowed = false;
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      if (matches(file, pattern.slice(1))) return false;
    } else if (matches(file, pattern)) {
      allowed = true;
    }
  }
  return allowed;
}

const serverDataLines = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => SERVER_DATA.test(line))
    .sort();

// Why an edit from `before` to `after` is out of scope, or null.
export function contentViolation(before, after) {
  if (USE_SERVER.test(after)) return 'adds or keeps a "use server" directive (server action)';
  const was = serverDataLines(before).join("\n");
  const now = serverDataLines(after).join("\n");
  if (was !== now) return "changes lines that touch auth, Prisma or S3";
  return null;
}

function editContents(toolName, input, absolute) {
  const current = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
  if (toolName === "Write") return [current, input.content ?? ""];
  if (toolName === "MultiEdit") {
    const edits = input.edits ?? [];
    return [edits.map((e) => e.old_string).join("\n"), edits.map((e) => e.new_string).join("\n")];
  }
  if (toolName === "Edit") return [input.old_string ?? "", input.new_string ?? ""];
  return ["", ""];
}

// The real path of a file that may not exist yet: resolve its nearest
// existing ancestor, so symlinks can't hide where an edit lands.
function realTarget(absolute) {
  let dir = absolute;
  const rest = [];
  while (!existsSync(dir)) {
    rest.unshift(path.basename(dir));
    dir = path.dirname(dir);
  }
  return path.join(realpathSync(dir), ...rest);
}

const inside = (file, dir) => {
  const relative = path.relative(dir, file);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
};

function runHook() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const toolInput = input.tool_input ?? {};
  const target = toolInput.file_path ?? toolInput.notebook_path;
  const cwd = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  if (!target) return 0;

  const root = realpathSync(git(cwd, "rev-parse", "--show-toplevel"));
  const branch = git(root, "branch", "--show-current");
  if (!branch.startsWith(UI_BRANCH_PREFIX)) return 0;

  const absolute = realTarget(path.resolve(cwd, target));
  if (!inside(absolute, root)) {
    // Scratch space and memory are fine; another checkout of this repo isn't.
    const worktrees = git(root, "worktree", "list", "--porcelain")
      .split("\n")
      .filter((line) => line.startsWith("worktree "))
      .map((line) => realpathSync(line.slice("worktree ".length)));
    if (!worktrees.some((dir) => inside(absolute, dir))) return 0;
    return block(`${absolute} is in another checkout of this repo`, branch);
  }

  const file = path.relative(root, absolute);
  const patterns = parsePatterns(readFileSync(path.join(root, ".github/ui-paths"), "utf8"));
  if (!isAllowed(file, patterns)) {
    return block(`${file} is outside the UI-only scope (.github/ui-paths)`, branch);
  }
  if (!isCode(file)) return 0;
  const [before, after] = editContents(input.tool_name, toolInput, absolute);
  const violation = contentViolation(before, after);
  if (violation) return block(`this edit to ${file} ${violation}`, branch);
  return 0;
}

function block(reason, branch) {
  console.error(
    `Blocked on ${branch}: ${reason}. ` +
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

  const option = (name, fallback) => {
    const index = args.indexOf(name);
    return index === -1 ? fallback : args[index + 1];
  };
  const base = option("--base", "origin/main");
  const head = option("--head", "HEAD");
  const range = `${base}...${head}`;

  const patterns = parsePatterns(git(root, "show", `${base}:.github/ui-paths`));
  // --no-renames lists a moved file under both its old and new path.
  const files = git(root, "diff", "--name-only", "--no-renames", range)
    .split("\n")
    .filter(Boolean);

  const problems = files
    .filter((file) => !isAllowed(file, patterns))
    .map((file) => `${file}: outside .github/ui-paths`);

  const inScope = files.filter((file) => isAllowed(file, patterns) && isCode(file));
  const present = new Set(
    inScope.length ? git(root, "ls-tree", "-r", "--name-only", head, "--", ...inScope).split("\n") : [],
  );
  for (const file of inScope) {
    if (present.has(file) && USE_SERVER.test(git(root, "show", `${head}:${file}`))) {
      problems.push(`${file}: contains a "use server" directive (server action)`);
    }
  }

  if (inScope.length) {
    let current = null;
    const diff = git(root, "diff", "--no-renames", "-U0", range, "--", ...inScope);
    for (const line of diff.split("\n")) {
      // A deleted file's "+++" header is /dev/null, so keep the "---" path.
      if (line.startsWith("--- ") || line.startsWith("+++ ")) {
        const name = line.slice(4);
        if (name !== "/dev/null") current = name.replace(/^[ab]\//, "");
      } else if (/^[+-]/.test(line) && SERVER_DATA.test(line)) {
        problems.push(`${current}: changes "${line.slice(1).trim()}"`);
      }
    }
  }

  if (problems.length === 0) {
    console.log(`${branch}: ${files.length} changed file(s), all within the UI-only scope.`);
    return 0;
  }
  console.error(`${branch} goes outside the UI-only scope:`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "Move these to a feat/ or fix/ branch, or widen .github/ui-paths in its own PR. " +
      "Auth, Prisma and S3 lines in pages and layouts change only on non-ui branches.",
  );
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes("--hook")) {
    // Fail closed: an error must block the edit, not let it through.
    let code;
    try {
      code = runHook();
    } catch (error) {
      console.error(`Blocked: the UI scope hook failed (${error.message}).`);
      code = 2;
    }
    process.exit(code);
  }
  process.exit(runDiff(args));
}
