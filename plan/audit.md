# The previous codebase, measured

Taken on 2026-09-20 by searching the files, not by reading them end to end.

## Size

| Area                              | Files | Lines  |
| --------------------------------- | ----- | ------ |
| Front end                         | 255   | 44 844 |
| Electron                          | 21    | 5 278  |
| Catalog API (separate repository) | 42    | 11 235 |
| Supabase migrations               | 133   | n/a    |
| Tests                             | 17    | n/a    |

Seven runtime dependencies, 41 development ones. 294 commits.

## What is visible at a glance

**Comments.** 6 372 comment lines out of 50 122, roughly one line in eight, and 857 JSDoc
blocks. Lines up to 211 characters, paragraphs recounting history, 29 files with emoji. This is
what makes code read as generated, and the rules in [../CLAUDE.md](../CLAUDE.md) target it
directly.

**Files that are too large.** Fourteen files over 700 lines, the largest at 1411 (download
manager), then settings page 1383, watch page 1339, seasons section 1119, video player 978.

**Three overlapping utility folders**, so there is no obvious place to put a new helper.

**Three ways of handling platform differences.**

**Front end and main process coupled**: two main process files only re-export front end files.

**No quality tooling.** No ESLint, no Prettier, no TypeScript. The 17 tests sit in a folder at
the root.

**Editorial content inside the code**: changelog and achievement data as JavaScript, 1 360
lines of text that belong in data files.

**Internal documentation mixed in**: ten Markdown files at the root, 2 057 lines, several of
them out of date.

**Leftovers**: a stray HTML file at the root, unimported components, 584 MB of local build
output.

**Hardcoded hosts**: the production domain appears 28 times across the front end and the main
process.

## What is in good shape

- No secret found in the tracked files, and none in the 294 commits either (searched for JWT,
  PEM, AWS and GitHub token patterns).
- `contextIsolation` on, `nodeIntegration` off, IPC going through a wrapper. The boundary
  between the front end and Electron is already concentrated in a 160 line preload.
- The host table is no longer in the client: it is served at runtime by the API (see D5).
- Tests exist on the delicate parts: proxy byte ranges, download resumption, HLS detection,
  session guards, audio tracks.
- The database is sound: every table has row level security on, and all 148 security definer
  functions pin their search path. Details in `audit-securite.md`, which stays out of this
  repository.
