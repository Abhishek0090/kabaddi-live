#!/usr/bin/env node
// `npm run share`: writes <name>-share/ with self-extracting scripts that carry
// the whole project, so it can be set up or updated on another machine:
//   <name>-setup.mjs / .sh / .ps1   fresh copy into an empty folder
//   <name>-update.mjs               sync an existing copy (--dry-run, --keep, --no-install)
//   parts/<name>-part-N-of-M.mjs    the same files in smaller pieces, for pasting
//   HOW-TO-SETUP.md
// Skips node_modules, .next, .git, git-ignored files and every .env file except
// .env.example. Built-in modules only.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const SLUG = pkg.name;
const NAME = "Kabaddi Live Score";
const SHARE_DIR = `${SLUG}-share`;
const OUT = join(ROOT, SHARE_DIR);
const ALWAYS_SKIP = new Set(["node_modules", ".next", ".git", ".vercel", SHARE_DIR]);
const PART_LIMIT = 150 * 1024; // raw bytes per part
const GENERATED = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const kb = (n) => `${Math.round(n / 1024)} KB`;

// --- .gitignore (the common subset: globs, anchors, dir-only, negation) ---

function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function loadIgnoreRules() {
  let text = "";
  try {
    text = readFileSync(join(ROOT, ".gitignore"), "utf8");
  } catch {
    return [];
  }
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((line) => {
      const negate = line.startsWith("!");
      let pat = negate ? line.slice(1) : line;
      const dirOnly = pat.endsWith("/");
      if (dirOnly) pat = pat.slice(0, -1);
      const anchored = pat.includes("/");
      if (pat.startsWith("/")) pat = pat.slice(1);
      return { negate, dirOnly, anchored, regex: globToRegex(pat) };
    });
}

const rules = loadIgnoreRules();

function ignored(rel, isDir) {
  let result = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    const subject = rule.anchored ? rel : basename(rel);
    if (rule.regex.test(subject)) result = !rule.negate;
  }
  return result;
}

/** Never ship secrets, whatever .gitignore says. */
function secret(rel) {
  const name = basename(rel);
  return (name.startsWith(".env") && name !== ".env.example") || name.endsWith(".pem");
}

function collect() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = relative(ROOT, full).split(sep).join("/");
      if (ALWAYS_SKIP.has(entry.name)) continue;
      if (entry.isDirectory()) {
        if (!ignored(rel, true)) walk(full);
      } else if (entry.isFile() && !ignored(rel, false) && !secret(rel)) {
        files.push({ rel, data: readFileSync(full), mode: 0o644 });
      }
    }
  };
  walk(ROOT);
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

// --- payloads ---

function payload(list) {
  const json = JSON.stringify(list.map((f) => [f.rel, f.data.toString("base64"), f.mode]));
  return gzipSync(Buffer.from(json), { level: 9 }).toString("base64");
}

function chunk(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const runtime = readFileSync(join(ROOT, "scripts", "share-runtime.mjs"), "utf8");
const runtimeBody = runtime.slice(runtime.indexOf("import "));

function nodeScript(mode, list, extra = {}) {
  const data = payload(list);
  const meta = {
    name: NAME,
    slug: SLUG,
    mode,
    generated: GENERATED,
    files: list.length,
    payloadSha: sha256(Buffer.from(data, "base64")),
    shareDir: SHARE_DIR,
    ...extra,
  };
  const usage = {
    setup: "node <this file> [target-folder] [--dry-run] [--force]",
    update: "node <this file> [project-folder] [--dry-run] [--keep] [--no-install] [--force]",
    part: "node <this file> [project-folder] [--dry-run]",
  }[mode];
  const header = [
    "#!/usr/bin/env node",
    `// ${SLUG} ${mode}${extra.part ? ` part ${extra.part} of ${extra.parts}` : ""} (${list.length} files). Generated ${GENERATED} by npm run share.`,
    `// Run:   ${usage}`,
    "// Needs Node.js 18 or newer. Uses only built-in modules. Every file is checked with SHA-256 after writing.",
  ].join("\n");
  const constants = `const META = ${JSON.stringify(meta)};\nconst PAYLOAD = [\n${chunk(data, 1000)
    .map((c) => `"${c}"`)
    .join(",\n")}\n].join("");`;
  return `${header}\n${runtimeBody.replace("// @@DATA@@", constants)}`;
}

// --- tar.gz for the shell and PowerShell scripts (no Node needed there) ---

function tarGz(list) {
  const octal = (n, width) => n.toString(8).padStart(width, "0");
  const blocks = [];
  const mtime = Math.floor(Date.now() / 1000);
  for (const f of list) {
    let name = f.rel;
    let prefix = "";
    if (Buffer.byteLength(name) > 100) {
      const cut = name.lastIndexOf("/", 155);
      prefix = name.slice(0, cut);
      name = name.slice(cut + 1);
    }
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, "utf8");
    header.write(`${octal(f.mode, 7)}\0`, 100);
    header.write("0000000\0", 108);
    header.write("0000000\0", 116);
    header.write(`${octal(f.data.length, 11)}\0`, 124);
    header.write(`${octal(mtime, 11)}\0`, 136);
    header.write("        ", 148);
    header.write("0", 156);
    header.write("ustar\0", 257);
    header.write("00", 263);
    header.write(prefix, 345, 155, "utf8");
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(`${octal(sum, 6)}\0 `, 148);
    blocks.push(header, f.data, Buffer.alloc((512 - (f.data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks), { level: 9 });
}

function shScript(list) {
  const data = chunk(tarGz(list).toString("base64"), 76).join("\n");
  const sums = list.map((f) => `${sha256(f.data)}  ${f.rel}`).join("\n");
  return `#!/usr/bin/env sh
# ${SLUG} setup (${list.length} files). Generated ${GENERATED} by npm run share.
# For machines without Node.js (macOS, Linux, Git Bash on Windows).
# Run:   sh ${SLUG}-setup.sh [target-folder] [--force]
# Needs: base64, tar, and sha256sum or shasum.
set -eu
TARGET="."
FORCE=0
for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;;
    *) TARGET="$a" ;;
  esac
done
SELF="$(basename "$0")"
if [ -d "$TARGET" ] && [ "$FORCE" = 0 ]; then
  OTHER="$(ls -A "$TARGET" | grep -v -e "^$SELF\\$" -e '^${SLUG}-' -e '^\\.DS_Store$' || true)"
  if [ -n "$OTHER" ]; then
    echo "The folder $TARGET is not empty. Run this in an empty folder, pass a folder path, or add --force." >&2
    exit 1
  fi
fi
mkdir -p "$TARGET"
TMP="$(mktemp)"
trap 'rm -f "$TMP" "$TMP.b64"' EXIT
sed -n '/^__PAYLOAD_BELOW__$/,$p' "$0" | tail -n +2 > "$TMP.b64"
if ! base64 -d < "$TMP.b64" > "$TMP" 2>/dev/null; then
  base64 -D -i "$TMP.b64" -o "$TMP"
fi
tar -xzf "$TMP" -C "$TARGET"
cd "$TARGET"
if command -v sha256sum >/dev/null 2>&1; then SUM="sha256sum"; else SUM="shasum -a 256"; fi
if ! $SUM -c --quiet <<'SUMS'
${sums}
SUMS
then
  echo "This script is damaged (a file failed its check). Copy it again in full." >&2
  exit 1
fi
echo "Done. ${list.length} files written and checked."
echo "Next: install Node.js 20.9+, then: npm ci && npm run dev"
exit 0
__PAYLOAD_BELOW__
${data}
`;
}

function ps1Script(list) {
  const data = chunk(tarGz(list).toString("base64"), 76).join("\n");
  const sums = list.map((f) => `  @('${f.rel.replace(/'/g, "''")}', '${sha256(f.data)}')`).join(",\n");
  return `# ${SLUG} setup (${list.length} files). Generated ${GENERATED} by npm run share.
# For Windows without Node.js. Uses the tar.exe built into Windows 10 and later.
# Run:   powershell -ExecutionPolicy Bypass -File .\\${SLUG}-setup.ps1 [-Target folder] [-Force]
param([string]$Target = ".", [switch]$Force)
$ErrorActionPreference = "Stop"
$self = Split-Path -Leaf $PSCommandPath
if ((Test-Path $Target) -and -not $Force) {
  $other = Get-ChildItem -Force -LiteralPath $Target | Where-Object { $_.Name -ne $self -and $_.Name -notlike "${SLUG}-*" -and $_.Name -ne ".DS_Store" }
  if ($other) { Write-Host "The folder $Target is not empty. Run this in an empty folder, pass -Target, or add -Force." -ForegroundColor Red; exit 1 }
}
New-Item -ItemType Directory -Force -Path $Target | Out-Null
$payload = @'
${data}
'@
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("${SLUG}-" + [guid]::NewGuid().ToString() + ".tar.gz")
[IO.File]::WriteAllBytes($tmp, [Convert]::FromBase64String(($payload -replace '\\s', '')))
try {
  tar -xzf $tmp -C $Target
  if ($LASTEXITCODE -ne 0) { throw "tar failed with exit code $LASTEXITCODE" }
} finally {
  Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
}
$sums = @(
${sums}
)
foreach ($s in $sums) {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $Target $s[0])).Hash.ToLower()
  if ($hash -ne $s[1]) { Write-Host "This script is damaged: $($s[0]) failed its check. Copy it again in full." -ForegroundColor Red; exit 1 }
}
Write-Host "Done. ${list.length} files written and checked."
Write-Host "Next: install Node.js 20.9+, then: npm ci; npm run dev"
`;
}

function splitParts(list) {
  const parts = [];
  let current = [];
  let size = 0;
  for (const f of list) {
    if (current.length && size + f.data.length > PART_LIMIT) {
      parts.push(current);
      current = [];
      size = 0;
    }
    current.push(f);
    size += f.data.length;
  }
  if (current.length) parts.push(current);
  return parts;
}

function howTo(sizes, parts) {
  const partRows = parts
    .map((p, i) => `| \`parts/${SLUG}-part-${i + 1}-of-${parts.length}.mjs\` | ${kb(p.size)} | ${p.files} files |`)
    .join("\n");
  return `# ${NAME}: set up or update on another machine

These scripts contain the whole project (${sizes.files} files, compressed). Generated ${GENERATED} with \`npm run share\`.
Each one checks every file with SHA-256 after writing it.

Not included: \`node_modules\`, \`.next\`, \`.git\`, anything in \`.gitignore\`, and every \`.env\` file except
\`.env.example\`. Your Supabase keys never leave your machine.

## New machine (${kb(sizes.setup)})

1. Create an empty folder (e.g. \`${SLUG}\`) and copy \`${SLUG}-setup.mjs\` into it.
2. In a terminal in that folder:

\`\`\`bash
node ${SLUG}-setup.mjs
npm ci
npm run dev
\`\`\`

3. Copy \`.env.example\` to \`.env.local\` and fill in your Supabase URL and publishable key (see README.md).

Needs Node.js 20.9 or newer to run the app (\`node -v\`).

No Node yet? Use \`${SLUG}-setup.sh\` (${kb(sizes.sh)}, macOS / Linux / Git Bash: \`sh ${SLUG}-setup.sh\`) or
\`${SLUG}-setup.ps1\` (${kb(sizes.ps1)}, Windows: \`powershell -ExecutionPolicy Bypass -File .\\${SLUG}-setup.ps1\`) to get
the files, then install Node to run the app.

## Update an existing copy (${kb(sizes.update)})

Use \`${SLUG}-update.mjs\`. It works on any earlier copy of this project, however you got it: an earlier script,
git, or a zip. If the copy is a git repo, commit first so you can review the diff.

1. Copy \`${SLUG}-update.mjs\` into the project folder (the one with \`package.json\`).
2. Preview, then apply:

\`\`\`bash
node ${SLUG}-update.mjs --dry-run
node ${SLUG}-update.mjs
npm run dev
\`\`\`

It overwrites project files with this version (local edits to those files are replaced). It deletes files in the
project's own folders (\`src/\`, \`tests/\`, \`supabase/\`, ...) that this version no longer has; add \`--keep\` to keep
them. It runs \`npm install\` when packages changed (\`--no-install\` to skip). \`.env\` files and anything outside
the project's folders are left alone.

On Vercel: after updating, commit and push as usual.

## ${parts.length} smaller parts (easier to paste)

| Part | Size | Contains |
| --- | --- | --- |
${partRows}

For each part: paste it into a new file with exactly the same name in the project folder, then run it, e.g.
\`node ${SLUG}-part-1-of-${parts.length}.mjs\`. Parts can run in any order, but run all ${parts.length}. Then continue with \`npm ci\` above.

## Troubleshooting

- \`This script is damaged\`: the paste was cut off. Copy that file again in full.
- \`The folder ... is not empty\`: you are in another folder. \`cd\` into an empty one, or pass a path:
  \`node ${SLUG}-setup.mjs "path/to/folder"\`.
- \`npm ci\` fails: delete \`node_modules\` and try again, or use \`npm install\`.

Delete the setup files from the project folder afterwards. This \`${SHARE_DIR}\` folder is ignored by git.
`;
}

// --- main ---

const files = collect();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "parts"), { recursive: true });

const write = (name, text) => {
  writeFileSync(join(OUT, name), text);
  return statSync(join(OUT, name)).size;
};

const sizes = {
  files: files.length,
  setup: write(`${SLUG}-setup.mjs`, nodeScript("setup", files)),
  update: write(`${SLUG}-update.mjs`, nodeScript("update", files)),
  sh: write(`${SLUG}-setup.sh`, shScript(files)),
  ps1: write(`${SLUG}-setup.ps1`, ps1Script(files)),
};

const groups = splitParts(files);
const parts = groups.map((group, i) => ({
  files: group.length,
  size: write(
    `parts/${SLUG}-part-${i + 1}-of-${groups.length}.mjs`,
    nodeScript("part", group, { part: i + 1, parts: groups.length }),
  ),
}));

write("HOW-TO-SETUP.md", howTo(sizes, parts));

console.log(`${SHARE_DIR}/ written: ${files.length} files`);
console.log(`  ${SLUG}-setup.mjs   ${kb(sizes.setup)}`);
console.log(`  ${SLUG}-update.mjs  ${kb(sizes.update)}`);
console.log(`  ${SLUG}-setup.sh    ${kb(sizes.sh)}`);
console.log(`  ${SLUG}-setup.ps1   ${kb(sizes.ps1)}`);
console.log(`  parts/            ${parts.length} parts`);
console.log(`  HOW-TO-SETUP.md`);
