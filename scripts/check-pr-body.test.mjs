import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { bodyProblems, usedPrSkill, writesPrBody } from "./check-pr-body.mjs";

const SCRIPT = fileURLToPath(new URL("./check-pr-body.mjs", import.meta.url));

const GOOD = `## Summary

\`\`\`text
rename CONTEXT.md -> GLOSSARY.md
\`\`\`

## Evidence

- **Before:** no glossary entry for Forecast
  **After:** Forecast defined

## Merge Danger

**Door:** two-way

**Blast Radius:** docs
`;

describe("writesPrBody", () => {
  it("matches commands that write a PR body", () => {
    assert.ok(writesPrBody('gh pr create --title "x" --body "y"'));
    assert.ok(writesPrBody("cd repo && gh pr create --fill"));
    assert.ok(writesPrBody('gh pr edit 12 --body "y"'));
    assert.ok(writesPrBody("gh pr edit 12 -F body.md"));
  });

  it("ignores other gh commands", () => {
    assert.ok(!writesPrBody("gh pr view 12"));
    assert.ok(!writesPrBody("gh pr edit 12 --add-label docs"));
    assert.ok(!writesPrBody('gh issue create --body "y"'));
  });

  it("ignores gh pr in commit messages and other arguments", () => {
    assert.ok(!writesPrBody("git commit -q -F - <<'EOF'\nchore: x\n\n- blocks gh pr create and\n  gh pr edit --body until loaded\nEOF\ngit push"));
    assert.ok(!writesPrBody('git commit -m "hook blocks gh pr create"'));
    assert.ok(!writesPrBody("echo gh pr create"));
  });

  it("still matches gh pr create with a heredoc body", () => {
    assert.ok(writesPrBody(`gh pr create --title "x" --body "$(cat <<'EOF'\n## Summary\nEOF\n)"`));
    assert.ok(writesPrBody("git push && gh pr create --fill"));
  });
});

const line = (entry) => JSON.stringify(entry);

describe("usedPrSkill", () => {
  it("finds a Skill tool call", () => {
    const transcript = line({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "mattpocock-skills:pr" } }] },
    });
    assert.ok(usedPrSkill(transcript));
  });

  it("finds the slash command", () => {
    const transcript = line({
      type: "user",
      message: { content: "<command-name>/mattpocock-skills:pr</command-name>" },
    });
    assert.ok(usedPrSkill(transcript));
  });

  it("ignores the skill name in listings and other skills", () => {
    const transcript = [
      line({ type: "user", message: { content: "- mattpocock-skills:pr: Use when writing a PR body." } }),
      line({ type: "attachment", skills: ["mattpocock-skills:pr"] }),
      line({
        type: "assistant",
        message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "mattpocock-skills:prototype" } }] },
      }),
      line({ type: "user", message: { content: "<command-name>/mattpocock-skills:prototype</command-name>" } }),
    ].join("\n");
    assert.ok(!usedPrSkill(transcript));
  });
});

describe("bodyProblems", () => {
  it("accepts a body that follows the template", () => {
    assert.deepEqual(bodyProblems(GOOD), []);
  });

  it("rejects the unfilled template", () => {
    const template = readFileSync(new URL("../.github/pull_request_template.md", import.meta.url), "utf8");
    const problems = bodyProblems(template);
    assert.ok(problems.includes('"## Summary" is empty'));
    assert.ok(problems.includes('"## Evidence" is empty'));
    assert.ok(problems.includes('"**Door:**" must be one-way or two-way'));
    assert.ok(problems.includes('"**Blast Radius:**" is empty'));
  });

  it("rejects missing and out-of-order sections", () => {
    assert.ok(bodyProblems("## Summary\n\nx\n").includes('missing "## Evidence" section'));
    assert.ok(bodyProblems(null).includes('missing "## Summary" section'));
    const swapped = GOOD.replace("## Summary", "## TMP").replace("## Evidence", "## Summary").replace("## TMP", "## Evidence");
    assert.ok(bodyProblems(swapped).some((p) => p.includes("out of order")));
  });

  it("rejects a Door that isn't one-way or two-way", () => {
    assert.ok(bodyProblems(GOOD.replace("two-way", "maybe")).includes('"**Door:**" must be one-way or two-way'));
  });
});

describe("hook", () => {
  const run = (input) => {
    try {
      execFileSync("node", [SCRIPT, "--hook"], { input: JSON.stringify(input), stdio: "pipe" });
      return 0;
    } catch (error) {
      return error.status;
    }
  };
  const dir = mkdtempSync(path.join(tmpdir(), "pr-hook-"));
  const withSkill = path.join(dir, "with.jsonl");
  const without = path.join(dir, "without.jsonl");
  writeFileSync(
    withSkill,
    line({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "mattpocock-skills:pr" } }] } }),
  );
  writeFileSync(without, line({ type: "user", message: { content: "hi" } }));
  const create = { tool_name: "Bash", tool_input: { command: "gh pr create --fill" } };

  it("blocks gh pr create until the skill is loaded", () => {
    assert.equal(run({ ...create, transcript_path: without }), 2);
    assert.equal(run({ ...create, transcript_path: withSkill }), 0);
  });

  it("blocks when the transcript can't be read", () => {
    assert.equal(run({ ...create, transcript_path: path.join(dir, "missing.jsonl") }), 2);
    assert.equal(run(create), 2);
  });

  it("lets other commands through without reading the transcript", () => {
    assert.equal(run({ tool_name: "Bash", tool_input: { command: "git status" } }), 0);
  });
});
