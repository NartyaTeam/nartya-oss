# Nartya

Desktop app for watching anime, built with Electron, React and Supabase.

**Status: migration in progress. This repository does not run as an app yet.** The first
working slice is the skeleton and the tooling; features land one at a time.

## What this repository is

Nartya has existed as a private codebase for about a year: around 45 000 lines, shipped to
real users, and grown feature by feature. This repository is a rewrite of that codebase, done
from scratch, in public, and **migrated by AI** under the rules in [CLAUDE.md](CLAUDE.md).

That is the point of the project, not a disclaimer. Generated code has a reputation for being
verbose, over-commented and shapeless. The rules here exist to test the opposite claim: that a
real application can be rewritten this way and end up smaller, quieter and easier to read than
what it replaces. The rules are enforced by `scripts/check-style.ts` and by CI, not by good
intentions, and `npm run metrics` prints the numbers against the codebase being replaced.

The plan, the decisions and the method are part of the repository, in [plan/](plan/).

## Getting started

```bash
npm install
npm run dev
```

`npm run electron` builds the main process and opens the desktop shell on the built front end
in `dist/`, so run `npm run build:web` first. `npm run electron:dev` opens it on the Vite dev
server instead, with hot reload. Copy `.env.example`
to `.env` first; both Supabase values are public by design. Playback needs `VITE_API_BASE`:
the main process resolves streams itself and reads that same `.env` when the build carries no
address, or `NARTYA_API_BASE` when it is set.

## Checks

```bash
npm run lint    # tsc, eslint, prettier, check-style
npm test
npm run build
npm run metrics
```

`npm run lint` fails on emoji, on comment blocks longer than two lines, on hardcoded URLs and
on any `any`. CI runs the same checks on Linux, macOS and Windows, plus a gitleaks scan of the
full history.

## Layout

| Path        | Contents                                                           |
| ----------- | ------------------------------------------------------------------ |
| `src/`      | Front end (React, Vite, Tailwind)                                  |
| `electron/` | Main process and preload                                           |
| `shared/`   | Types shared by both sides, starting with the platform contract    |
| `scripts/`  | Repository tooling, written in TypeScript and run directly by Node |
| `plan/`     | Audit of the previous codebase, decisions, migration plan          |

## Sources

The app talks to a catalog API over a documented contract. The API itself, and the table of
video hosts it serves at runtime, are not part of this repository. A demo source recipe ships
here so the app runs without it.

## License

MIT. See [LICENSE](LICENSE).
