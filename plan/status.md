# Status

Where the rewrite stands, updated at the end of each working session. The phases themselves
are in [migration.md](migration.md), the reasons in [journal.md](journal.md).

Last updated: 2026-09-24.

## Done

- **Phases 1 and 2**, and the phase 0 audits. Guard rails, CI on three systems, gitleaks,
  `check-style`, metrics, config, Supabase client, session store, platform contract.
- **Phase 3, main process**, except the three items under Next: url safety, byte ranges, friendly
  errors, api base, OAuth loopback, DoH, logger, source recipe, video extraction, provider
  fetch (gzip, deflate and brotli since 2026-09-23), local proxy, demo recipe, downloads,
  cast with its fake receiver.
- **Phase 4, slices 1 to 3.** Sign in and session, home, search and genres, anime page with
  seasons, languages and the source picker.
- **Phase 4, slice 4.** HLS and mp4 playback through ArtPlayer and hls.js, several
  sources tried at once, resume, next episode, the quality menu (kept from one episode to
  the next), a language menu that keeps the position, Anime4K over WebGPU with its own fixed
  quality, `npm run electron:dev` for hot reload.
- **Watch page, in the shape of the shipped app.** The player takes the whole window and stays
  up from one episode to the next, so fullscreen holds. Back button, centred title, next
  episode with its preview, and the episode panel with seasons and progress.
- **Watch page, finished for now** (2026-09-24). Skip the opening and ending from the api's
  `skip` route, with a notice when a scene follows the credits and a ten second card before
  the next episode. Seek indicator, double click fullscreen without pausing, F key, wheel
  volume, audio boost up to 300 %. The skip settings of the previous app are fixed at its
  defaults until the settings page exists.
- **Anime page, polished** (2026-09-24). Seasons grouped by kind (seasons, Kai, films, OAV,
  the rest), sorted by their number, and an anime opens on its first season. Flags next to
  each language. Films, OAV and side seasons show their own name and place instead of the
  series' episodes the api fills them with.
- **Sources, end to end with the api.** A picked source is a host key (`s1`), not an
  anime-sama column, and falls back to automatic when an episode lacks it. Only hosts the
  recipe knows are fetched. Every host checked against real episodes on 2026-09-23.

## Next

The writing switch (D15) happened on 2026-09-23: all new code is written here. What is left
leads to the production switch, whose criteria are in [publication.md](publication.md).

1. **Slice 5, downloads**, on top of the download manager already ported to the main process.
2. **Phase 3 leftovers:** deep link, auto update, Discord RPC.
3. Slices 6 and 7: profile and lists, settings and legal pages. The settings page takes the
   skip settings (auto chaining, skip button, auto skip) and the audio boost.
4. Contributor setup: the schema published (phase 5), demo catalog data (D12).
5. Build and release from this repository; `ARCHITECTURE`, `CONTRIBUTING`, `SECURITY`.
6. Small: the player's own labels ("Play Speed") are still in English, and WebGPU stays off
   on Linux drivers Chromium blocklists, which the previous app forced on. Cast and content
   warnings in the player.
7. **In `nartya-api-v2`**, not done here: it fills films, OAV and side seasons with the main
   series' episodes, which the client now hides; and a native title reduced to a digit
   ("第2期" to "2") matched "Ranma 1/2", fixed locally but not committed.

## Development setup

The app, the api (`nartya-api-v2`) and a local Supabase run together, and development never
touches production data:

- `nartya-api-v2`: `npm run dev`, port 3010.
- Local Supabase, built from the production schema in a private repository until phase 5
  publishes it: `supabase start`, test account `test@nartya.local` / `nartya-local`.
- Here: `.env` points at both, production values kept commented; `npm run electron:dev`.

## Open, for a dedicated session

Security work is kept out of feature sessions on purpose.

- Twenty `SECURITY DEFINER` functions in production are owned by `supabase_admin`, a
  superuser, instead of `postgres`. Not exploitable as things stand; to fix with a
  migration tested locally first.
- Audit query 4 in [supabase.md](supabase.md) allows two functions, where production grants
  `anon` 79. The allow list needs review before the query goes into CI.
- The six "readable by all" policies on catalog tables are neutralised by revoked grants.
  Phase 5 drops them, as planned.
