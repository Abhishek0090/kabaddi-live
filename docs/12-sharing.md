# 12 Sharing the code

`npm run share` packs the whole project into self-extracting scripts, so it can be set up or updated on another machine without git. Code: [scripts/share.mjs](../scripts/share.mjs) (generator) and [scripts/share-runtime.mjs](../scripts/share-runtime.mjs) (the code inside each Node script).

## Output

Written to `kabaddi-share/`, which git ignores:

| File | Use |
| --- | --- |
| `kabaddi-setup.mjs` | New machine with Node: `node kabaddi-setup.mjs` in an empty folder |
| `kabaddi-setup.sh` | New machine without Node (macOS, Linux, Git Bash) |
| `kabaddi-setup.ps1` | New machine without Node (Windows PowerShell) |
| `kabaddi-update.mjs` | Update an existing copy: `--dry-run`, `--keep`, `--no-install`, `--force` |
| `parts/kabaddi-part-N-of-M.mjs` | The same files split into pieces of about 150 KB, for pasting |
| `HOW-TO-SETUP.md` | Step-by-step instructions with sizes |

## What is included

Every project file except:

- `node_modules`, `.next`, `.git`, `.vercel` and `kabaddi-share` itself
- anything matched by `.gitignore`
- every `.env` file except `.env.example`, and `*.pem` files, whatever `.gitignore` says

Each file is checked with SHA-256 after it is written. A script cut off during copy or paste stops with "This script is damaged".

## What the update script does

1. Checks it is inside a folder whose `package.json` name is `kabaddi` (unless `--force`).
2. Writes new and changed files.
3. Deletes files in the project's own folders (`src/`, `tests/`, `docs/`, ...) that this version no longer has, unless `--keep`. Top-level files you added, and `.env` files, are never touched.
4. Runs `npm install` when `package.json` or `package-lock.json` changed, unless `--no-install`.

## When to run it

Run `npm run share` again after every change you want to hand over. The scripts are a snapshot of the moment they were generated.

## Changing the generator

- The Node scripts are `share-runtime.mjs` with the data inserted at the `// @@DATA@@` marker. Edit the runtime as normal code; it is linted with the rest of the project.
- The `.sh` and `.ps1` scripts carry a `.tar.gz` built by a small tar writer in `share.mjs`, and use the system `tar` to extract it.
- Part size is `PART_LIMIT` in `share.mjs`.
