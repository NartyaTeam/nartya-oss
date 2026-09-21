# Migration plan

Module by module rewrite in a new repository, **public from the first commit** (D14). The
previous codebase is the specification. No dates: a phase ends when its criteria are met. The
last phase is no longer "publish" - publishing is continuous - but **switch** (D15).

## Method for each module

1. Read the old code and write three lines on what it does.
2. Apply the regime from [inventory.md](inventory.md): **port** (proven low-level code) or
   **rewrite** (front end), see D10.
3. Port: take the code, move it to TypeScript, drop the comments, split it, without changing
   behaviour. Rewrite: write from behaviour, never from the text.
4. Port or write the tests for the pure logic.
5. Lint, tests, build, the app starts.
6. Human review, then commit, which is public within the second.

A module is done when it can be explained without reopening the old file.

## Phase 0 - Before the first commit

- **D13**: organisation, repository name, contact policy. Blocking, since commit 1 is public.
- ~~RLS audit~~ and ~~anti-abuse inventory~~: **done** on 2026-09-21. The schema is sound,
  nothing blocking. Three follow-ups remain:
  - drop the six permissive policies in the rewritten schema (phase 5);
  - ~~retire the legacy source URL path~~: **done in production on 2026-09-21**, decided on
    the logs (668 samples over 15 days, zero legacy request). Still to remove from the api
    code, which now happens in `nartya-api-oss`;
  - enforce the version floor on the api side: **not a setting**. `/version-policy` only
    publishes a floor the client chooses to obey, and no middleware enforces anything. This
    moves to `nartya-api-oss` phase B;
  - cross-check with the Supabase Security Advisor and `supabase db lint` before phase 5.
- **Recipe endpoint**: rate limiting and logging before the proxy is published (D5). Also
  `nartya-api-oss` phase B.
- **D16**: the api moves in step with the client, in its own decoupled repository. See
  `../nartya-api-oss/plan/`.
- Tag the previous repository `pre-oss`.

## Phase 1 - Commit 1: skeleton, tooling, guard rails

Everything that stops a mistake from being pushed has to exist before any code is pushed.

- Public repository, MIT `LICENSE`, `.gitignore`, `.editorconfig`, `.env.example`.
- A README that states what the project is: a codebase migrated by AI, mid migration, not
  working yet.
- Vite + React + Tailwind + Electron in strict TypeScript. Feature-first structure, a single
  helpers folder, three `tsconfig` files (front end, main process, scripts) sharing the
  platform contract types.
- ESLint with `typescript-eslint` (`no-console`, `no-warning-comments`, `no-explicit-any`,
  `max-lines` at 300 as a warning) and Prettier.
- `scripts/check-style.ts`, blocking: emoji, comment blocks longer than two lines, hardcoded
  URLs.
- **gitleaks in CI and in a pre-commit hook** (D14).
- `scripts/metrics.ts`: comment ratio and largest file, against the previous codebase (D8).
- Port the existing tests: proxy ranges, download recovery, HLS detection, audio tracks,
  quality levels, session guards, providers, cast.
- CI: lint, tests, build on three operating systems.

Criterion: `npm run lint && npm test && npm run build` passes, gitleaks and `check-style` are
green, and the README says where the project stands.

## Phase 2 - Foundations

Config and environment, Supabase client, a single data layer in the shape the RLS audit calls
for, base stores (auth, preferences), and the **platform contract**: the functions the front
end expects from Electron. The front end knows nothing else about Electron.

## Phase 3 - Electron main process

Simplest to riskiest. All of it can be ported as is, per D5.

1. Window, single instance, deep link, auto update, preload. _(rewrite)_
2. URL validation, byte ranges, friendly errors, API base. _(port, tested)_
3. OAuth callback, Discord RPC, DoH resolver. _(port)_
4. Source recipe, video extraction, provider fetch, local proxy, demo recipe (D12).
   _(port, except the demo fixture which is new)_
5. Download manager, split into several files. _(port then split)_
6. Cast. _(port)_

## Phase 4 - Front end, vertical slices

Each slice ships data layer, store, hooks, components and page. All of it is a rewrite (D10).

1. Authentication and session.
2. Home and catalog.
3. Anime page.
4. Player and watch page (HLS, ArtPlayer, subtitles, audio tracks, resume, Anime4K).

**End of slice 4 is the writing switch (D15).** The app runs end to end; from then on all new
code is written here.

5. Downloads.
6. Profile, lists, favourites.
7. Settings, legal pages.
8. The rest, rebuilt in public: community, comments, watch party, achievements, announcements,
   reports, credits.

## Phase 5 - Supabase

Procedure in [supabase.md](supabase.md). In short: schema extracted from production rather than
hand written, split per phase and published alongside the code that uses it, filtered before
each push, demo data, types generated locally, and above all the **four audit queries running
in CI**, which turn the one-off audit into a permanent guarantee.

## Phase 6 - Documentation and project files

README with screenshots, `ARCHITECTURE` (where the explanatory file headers of the old code
land), `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, the method page (D8), issue and pull
request templates, release pipeline.

## Phase 7 - Switch

Criteria in [publication.md](publication.md). The repository has been public since day one;
what is decided here is moving the writing, then production, off the private repository.

## Alongside

- A short decision log in `plan/journal.md`, one line per decision.
- A feature that turns out to be useless during the rewrite is dropped, and that is recorded.
