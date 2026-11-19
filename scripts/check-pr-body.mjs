#!/usr/bin/env node
// PR bodies follow the mattpocock-skills:pr template: Summary, Evidence and
// Merge Danger (Door and Blast Radius).
//
//   PR_BODY=... node scripts/check-pr-body.mjs   check a PR body (CI)
//   node scripts/check-pr-body.mjs --hook        Claude Code PreToolUse hook (JSON on stdin)
//
// The hook blocks `gh pr create` and `gh pr edit --body` until the session
// has loaded the pr skill. CI checks the body itself, so it also covers PRs
// opened in the browser or from a shell.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PR_SKILL = "mattpocock-skills:pr";

const SECTIONS = ["Summary", "Evidence", "Merge Danger"];

// Commands that write a PR body, where gh runs as a command: at the start or
// after a separator, not inside a commit message or other argument.
const AT_COMMAND = String.raw`(?:^|[;&|(\n])\s*`;
const CREATE = new RegExp(`${AT_COMMAND}gh\\s+pr\\s+create\\b`);
const EDIT_BODY = new RegExp(`${AT_COMMAND}gh\\s+pr\\s+edit\\b[^\\n]*\\s(--body|--body-file|-b|-F)\\b`);

// Heredoc bodies are data, such as a commit message that mentions gh.
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g;

export function writesPrBody(command) {
  const code = command.replace(HEREDOC, "");
  return CREATE.test(code) || EDIT_BODY.test(code);
}

// The skill name also appears in skill listings injected into the
// transcript, so only an actual Skill tool call or the slash command counts.
const isPrSkill = (name) => name === PR_SKILL || name === "pr";
const SLASH_COMMAND = /<command-name>\/(?:mattpocock-skills:)?pr<\/command-name>/;

export function usedPrSkill(transcript) {
  for (const line of transcript.split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    const content = entry.message?.content;
    if (entry.type === "assistant" && Array.isArray(content)) {
      if (content.some((b) => b.type === "tool_use" && b.name === "Skill" && isPrSkill(b.input?.skill))) {
        return true;
      }
    }
    if (entry.type === "user") {
      const text = typeof content === "string"
        ? content
        : Array.isArray(content) ? content.map((b) => b.text ?? "").join("") : "";
      if (SLASH_COMMAND.test(text)) return true;
    }
  }
  return false;
}

const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, "");

// Problems with a PR body, or an empty list.
export function bodyProblems(body) {
  const text = stripComments(body ?? "").replace(/\r\n/g, "\n");
  const headings = [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => ({
    title: m[1],
    start: m.index,
    end: m.index + m[0].length,
  }));

  const problems = [];
  const sections = {};
  let previous = -1;
  for (const name of SECTIONS) {
    const index = headings.findIndex((h) => h.title.toLowerCase() === name.toLowerCase());
    if (index === -1) {
      problems.push(`missing "## ${name}" section`);
      continue;
    }
    if (index < previous) problems.push(`"## ${name}" is out of order (expected ${SECTIONS.join(", ")})`);
    previous = index;
    const next = headings[index + 1];
    sections[name] = text.slice(headings[index].end, next ? next.start : undefined).trim();
    // The template's bare labels don't count as content.
    const filled = sections[name].replace(/\*\*(Before|After):\*\*/gi, "").replace(/^\s*[-*]\s*$/gm, "").trim();
    if (!filled) problems.push(`"## ${name}" is empty`);
  }

  const danger = sections["Merge Danger"];
  if (danger) {
    const door = danger.match(/\*\*Door:\*\*\s*(.*)/i);
    if (!door) problems.push('Merge Danger has no "**Door:**" line');
    else if (!/^(one|two)[- ]way\b/i.test(door[1].trim())) {
      problems.push('"**Door:**" must be one-way or two-way');
    }
    const blast = danger.match(/\*\*Blast Radius:\*\*\s*(.*)/i);
    if (!blast) problems.push('Merge Danger has no "**Blast Radius:**" line');
    else if (!blast[1].trim()) problems.push('"**Blast Radius:**" is empty');
  }

  return problems;
}

function runHook() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const command = input.tool_input?.command ?? "";
  if (!writesPrBody(command)) return 0;
  if (!input.transcript_path) throw new Error("no transcript_path in the hook input");
  if (usedPrSkill(readFileSync(input.transcript_path, "utf8"))) return 0;
  console.error(
    `Blocked: write PR bodies with the ${PR_SKILL} skill. Load it with the Skill tool, ` +
      "write the body to its template (Summary, Evidence, Merge Danger), then run the command again.",
  );
  return 2;
}

function runCheck() {
  const problems = bodyProblems(process.env.PR_BODY);
  if (problems.length === 0) {
    console.log("PR body follows the template.");
    return 0;
  }
  console.error("The PR body doesn't follow .github/pull_request_template.md:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("Edit the PR description; this check re-runs on edit.");
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--hook")) {
    // Fail closed: an unreadable transcript or bad input blocks the command.
    let code;
    try {
      code = runHook();
    } catch (error) {
      console.error(`Blocked: the PR skill hook failed (${error.message}).`);
      code = 2;
    }
    process.exit(code);
  }
  process.exit(runCheck());
}
