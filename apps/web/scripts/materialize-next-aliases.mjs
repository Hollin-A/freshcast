// Replaces the symlinks Turbopack creates in `.next/node_modules` with real
// copies of the packages they point to.
//
// Turbopack externalizes packages such as @prisma/client, pg and
// @aws-sdk/client-s3 through hashed aliases (e.g. `@prisma/client-<hash>`)
// that are relative symlinks into the hoisted root node_modules. In the
// monorepo the links are sized for the apps/web folder depth, but Amplify
// Hosting deploys the app root flattened to /var/task, so the links point
// outside the deployment and every route that imports these packages fails
// to load. Real copies resolve regardless of where the app is placed.
//
// Runs after `next build` (see package.json). Revisit on Next.js upgrades.
import { cpSync, existsSync, lstatSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";

const appDir = path.resolve(import.meta.dirname, "..");
const relativeAppDir = path.relative(path.resolve(appDir, "../.."), appDir);

const aliasDirs = [
  path.join(appDir, ".next/node_modules"),
  path.join(appDir, ".next/standalone", relativeAppDir, ".next/node_modules"),
];

function* symlinksIn(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) yield full;
    // Scoped aliases live one level down, e.g. @prisma/client-<hash>.
    else if (entry.isDirectory() && entry.name.startsWith("@")) yield* symlinksIn(full);
  }
}

let replaced = 0;
for (const dir of aliasDirs) {
  if (!existsSync(dir)) continue;
  for (const link of symlinksIn(dir)) {
    const target = realpathSync(link);
    rmSync(link);
    cpSync(target, link, { recursive: true, dereference: true });
    if (lstatSync(link).isSymbolicLink()) throw new Error(`Still a symlink: ${link}`);
    replaced++;
  }
}

console.log(`materialize-next-aliases: replaced ${replaced} alias symlink(s) with real copies`);
