// Runtime for the scripts that `npm run share` generates. Not run directly:
// scripts/share.mjs copies this file into each generated script and puts the
// META and PAYLOAD constants at the @@DATA@@ marker. Built-in modules only.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// @@DATA@@

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const say = (msg = "") => process.stdout.write(`${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`\n${msg}\n`);
  process.exit(1);
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const target = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
const dryRun = flag("--dry-run");
const self = fileURLToPath(import.meta.url);

if (sha256(Buffer.from(PAYLOAD, "base64")) !== META.payloadSha) {
  fail("This script is damaged (the copy was cut off or changed). Copy the file again in full.");
}
const files = JSON.parse(gunzipSync(Buffer.from(PAYLOAD, "base64")).toString("utf8"));

function safePath(rel) {
  const clean = normalize(rel);
  if (isAbsolute(clean) || clean.split(sep).includes("..")) fail(`Refusing unsafe path in payload: ${rel}`);
  return join(target, clean);
}

function writeFiles(list) {
  for (const [rel, b64, mode] of list) {
    const dest = safePath(rel);
    const data = Buffer.from(b64, "base64");
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
    if (mode & 0o111) {
      try {
        chmodSync(dest, 0o755);
      } catch {
        // Windows has no exec bit.
      }
    }
    if (sha256(readFileSync(dest)) !== sha256(data)) fail(`Check failed after writing ${rel}. Disk full?`);
  }
}

/** Files under the project's own folders that this version no longer has. */
function staleFiles() {
  const keep = new Set(files.map(([rel]) => rel));
  const roots = new Set(files.map(([rel]) => rel.split("/")[0]).filter((top) => files.some(([r]) => r.startsWith(`${top}/`))));
  const skip = new Set(["node_modules", ".next", ".git", ".vercel", META.shareDir]);
  const stale = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = relative(target, full).split(sep).join("/");
      if (skip.has(entry.name) || entry.name.startsWith(".env")) continue;
      if (entry.isDirectory()) walk(full);
      else if (!keep.has(rel) && full !== self) stale.push(rel);
    }
  };
  for (const root of roots) if (existsSync(join(target, root))) walk(join(target, root));
  return stale;
}

function removeEmptyDirs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !["node_modules", ".git", ".next"].includes(entry.name)) removeEmptyDirs(join(dir, entry.name));
  }
  if (dir !== target && readdirSync(dir).length === 0) rmdirSync(dir);
}

if (META.mode === "setup") {
  const existing = existsSync(target)
    ? readdirSync(target).filter((n) => join(target, n) !== self && n !== ".DS_Store" && !n.startsWith(`${META.slug}-`))
    : [];
  if (existing.length && !flag("--force")) {
    fail(`The folder ${target} is not empty. Run this in an empty folder, pass a folder path, or add --force.`);
  }
  say(`${META.name}: writing ${files.length} files to ${target}`);
  if (dryRun) {
    for (const [rel] of files) say(`  + ${rel}`);
    say("\nDry run: nothing was written.");
    process.exit(0);
  }
  writeFiles(files);
  say(`Done. All ${files.length} files written and checked.\n`);
  say("Next:");
  if (resolve(".") !== target) say(`  cd "${target}"`);
  say("  npm ci");
  say("  copy .env.example to .env.local and fill it in (see README.md)");
  say("  npm run dev");
} else if (META.mode === "part") {
  say(`${META.name} part ${META.part} of ${META.parts}: writing ${files.length} files to ${target}`);
  if (dryRun) {
    for (const [rel] of files) say(`  + ${rel}`);
    say("\nDry run: nothing was written.");
    process.exit(0);
  }
  writeFiles(files);
  say(`Done. Run all ${META.parts} parts, in any order, then: npm ci`);
} else {
  // update
  const pkgPath = join(target, "package.json");
  if (!flag("--force")) {
    if (!existsSync(pkgPath)) fail(`No package.json in ${target}. Run this inside the project folder, or add --force.`);
    const name = JSON.parse(readFileSync(pkgPath, "utf8")).name;
    if (name !== META.slug) fail(`${target} looks like "${name}", not ${META.slug}. Add --force if you're sure.`);
  }

  const changed = [];
  const added = [];
  for (const file of files) {
    const dest = safePath(file[0]);
    if (!existsSync(dest)) added.push(file);
    else if (sha256(readFileSync(dest)) !== sha256(Buffer.from(file[1], "base64"))) changed.push(file);
  }
  const stale = flag("--keep") ? [] : staleFiles();
  const depsChanged = [...added, ...changed].some(([rel]) => rel === "package.json" || rel === "package-lock.json");

  say(`${META.name} update (${META.generated}) for ${target}`);
  for (const [rel] of added) say(`  + ${rel}`);
  for (const [rel] of changed) say(`  ~ ${rel}`);
  for (const rel of stale) say(`  - ${rel}`);
  if (!added.length && !changed.length && !stale.length) {
    say("Already up to date.");
    process.exit(0);
  }
  say(`\n${added.length} new, ${changed.length} changed, ${stale.length} to delete.`);
  if (dryRun) {
    say("Dry run: nothing was changed. Run again without --dry-run to apply.");
    process.exit(0);
  }

  writeFiles([...added, ...changed]);
  for (const rel of stale) rmSync(safePath(rel));
  if (stale.length) removeEmptyDirs(target);
  say("Files updated and checked.");

  if (depsChanged && !flag("--no-install")) {
    say("\nPackages changed: running npm install ...");
    const result = spawnSync("npm", ["install"], { cwd: target, stdio: "inherit", shell: process.platform === "win32" });
    if (result.status !== 0) fail("npm install failed. Fix the error above, then run npm install again.");
  }
  say(`\nDone. Restart npm run dev. You can delete ${basename(self)} now.`);
}
