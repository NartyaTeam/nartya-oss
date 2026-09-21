# Decisions

Scope settled on 2026-09-20. Two safer-looking strategies were ruled out along the way:
cleaning the private codebase in place (it moves at 245 commits a quarter, so a restructuring
effort would be in permanent conflict with it) and extracting standalone modules (a good idea,
kept for later, but the modules most interesting to others are the ones most tied to the
product).

Chosen: **rewrite from scratch in a new repository, public from the first commit, published as
it goes**, with the long term aim of making it the main repository for the app.

## D1 - Language

Identifiers, comments, README, docs and commit messages in English. User interface in French,
**inline, with no i18n library**: a structure "ready for i18n" would be code written for later,
which [../CLAUDE.md](../CLAUDE.md) forbids. User-facing strings live in a strings module per
feature.

## D2 - Stack

Electron, not Tauri. Vite + React 18 + React Router + Zustand + Tailwind. Tauri would only save
installer size, and the video player is safer on Chromium everywhere.

## D3 - Language: strict TypeScript

`strict: true`, plus `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. No `any` without a
one-line justification.

- `tsc` runs in `npm run lint` and in CI.
- Supabase types are generated, never hand written.
- The platform contract is a type shared between `preload` and the front end.
- This is the main cost multiplier of the migration, which is what makes D11 necessary.

## D4 - Scope: the whole desktop client plus Supabase

The complete Electron app and the Supabase migrations. Out of scope: Android, the Discord hub,
the admin tools, the website, and the catalog API, which stays in its own private repository.

## D5 - Providers: nothing to strip from the code

Checked in the source on 2026-09-20: **the table of video hosts is no longer in the client.**
It is served at runtime by the private API over an authenticated call, held in memory only and
never written to disk. What remains client side is generic machinery - request handling, player
family patterns such as packed JWPlayer, `og:video` and `player.src` - plus opaque keys. Real
host names exist only in the API repository.

So:

- **The whole client can be published as is**, local proxy and download manager included. No
  module to keep private, no interface to invent, nothing to strip.
- What stays private is **data** (the recipe) and a **separate repository** (the API).
- The end state architecture is already in place: public app, private API.

To do before publishing that part: rate limiting and logging on the recipe endpoint, and a
check that bans are effective. Publishing the client documents the path; the protection rests
on authentication and traceability rather than obscurity, and that property survives
publication, but it should actually be enforced.

## D6 - History: new repository, public from commit 1

None of the previous 294 commits are carried over. A pattern search over the whole history
found no secrets, but it does contain co-authorship trailers and references to internal
infrastructure. Nothing worth keeping. The old repository stays private, tagged `pre-oss`.

## D7 - License: MIT

`LICENSE` from the first commit. `package.json` consistent: license, English description, no
contact address (see D13).

## D8 - AI attribution: stated openly

The earlier rule was to keep the AI invisible. The opposite is now true: the repository states
that it is **a codebase migrated by AI**. That is the concept of the project - a real app
rewritten cleanly by AI, in public, with the method on display.

- It inverts the fate of this folder: `CLAUDE.md` and `plan/` are **part of the repository**
  instead of being deleted before publication. They are the most interesting part to read.
- It makes the style rules **more** important, not less: the statement only disarms the
  criticism if the code is genuinely clean. If the repository reads as generated, the label
  amplifies the attack instead of absorbing it.
- Say it once, properly: README and a short method page. No `Co-Authored-By` at the bottom of
  300 commits, no "Generated with" in pull requests. Same message, without the noise.
- Make it measurable: `npm run metrics` prints the comment ratio and the largest file against
  the numbers of the codebase being replaced.
- **Claim nothing about the private repository.** It is not published, and its history already
  contains co-authorship trailers. This is about the public version.

## D9 - Backend for contributors

A schema rebuilt from the current database, a minimal data set, `supabase start` locally and
an `.env.example`. The 133 original migrations are not published.

**The RLS audit happens before phase 2**, not at the end: publishing client queries publishes
the schema, the table names and the attack surface. And if the audit concludes that a write
belongs on the server, that changes the shape of the data layer, which has to be known before
writing it. Done on 2026-09-21, procedure in [supabase.md](supabase.md).

## D10 - Port or rewrite: two regimes

"Rewrite everything from behaviour" is right for the front end and wrong for the low level.
Byte ranges, HLS detection, download resumption, the local proxy, provider fetching and cast
encode months of empirical fixes against browsers and video hosts that lie. Rewriting them
means reintroducing bugs nobody will be able to reproduce. D5 removes the last obstacle: all of
it can be published, so all of it can be ported as is.

- **port** - take the code, move it to TypeScript, drop the comments, split it. Behaviour
  unchanged, the module's tests stay green.
- **rewrite** - the whole front end: written from behaviour, never from the text.

The existing tests are ported in phase 1, before the modules they cover.

## D11 - Feature order, not feature cuts

The first public version does not aim for parity. What is not in the early slices is not
deleted, it is **after the switch** (D15): watch party, credits and referrals, achievements,
announcements, reports, community. Android stays out of scope (D4).

Order: auth, catalog, anime page, player, downloads, profile and lists, settings. The rest is
rebuilt in public, after the switch.

## D12 - What a contributor can run: a demo recipe

The repository has to start on its own. Since the recipe is data (D5), a JSON fixture pointing
at a local file or a freely usable test stream is enough, plus demo catalog data.
`supabase start`, `npm run dev`, a video plays. The API base stays configurable.

## D13 - Identity

GitHub organisation **Nartya Team**, run by the **RandomZeleff** account. **No contact
address**: support goes through the existing Discord. Therefore:

- no `author.email` in `package.json`;
- `SECURITY.md` cannot point at a public channel for vulnerability reports. Enable GitHub's
  **private vulnerability reporting**, and mention Discord as a fallback.

## D14 - Continuous publication

Public from commit 1, published as it goes: the base first, then the modules, with no "finish
everything before publishing" gate. Direct consequence: **what is pushed is public forever**,
indexed, cloned, forked and cached. The checklist in [publication.md](publication.md) is not an
end-of-project control but a per-commit discipline, automated from phase 1 (gitleaks in CI and
in a pre-commit hook, `check-style.ts` blocking). The README says the repository is mid
migration and does not run yet.

## D15 - Long term: this becomes the main repository

The bet: eventually the production app is built from this repository, and the private side
shrinks to the API and the recipe. D5 makes that reachable, since there is no code fork to
maintain.

Two milestones, not one:

1. **Writing switch** - once the public version runs end to end (auth, catalog, anime page,
   player), all new code is written here.
2. **Production switch** - once parity is reached, the shipped app is built from this
   repository and the private one stops.

**Decided on 2026-09-21: production is frozen to make parity reachable.** One last large
update to the private app, then urgent fixes only. The target stops moving, so the switch
happens at **real parity** rather than on a feature gap: no regression for users, no parallel
shipping, no second version to justify.

Anything included in that last large update is a feature that will have to be written twice.
What can wait is better built here directly.
