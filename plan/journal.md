# Decision log

One line per decision taken while rewriting. Longer reasoning goes in
[decisions.md](decisions.md).

- 2026-09-22 - Own logger in `electron/log.mts` rather than `electron-log`. The previous
  codebase had ~55 `console` calls, 22 spellings of the scope prefix and **no file sink at
  all**: `local-proxy-server.js` truncated urls "because the logs are attached to bug
  reports", while a packaged app wrote them to a stdout nobody reads. What is needed is a
  level, a scope, a timestamp and a file - not the renderer transport and remote logging a
  library brings. The single instance lock means there is only ever one writer, which is the
  part a library would otherwise be worth. Redaction lives in the logger, and `check-style`
  enforces one scope per file named after it.
- 2026-09-22 - The api gets its own decoupled repository (`~/code/nartya-api-v2`) and moves
  in step with this one. `NartyaTeam/nartya-api` deploys to production on every push, which
  is why the api side of the security audit had stalled. Two repositories to keep now, and
  fixes that the client cannot make alone - the version floor, the recipe endpoint - become
  reachable. Not public yet.
- 2026-09-22 - Porting does not mean mirroring. The empirical fixes are what must survive;
  a defect around them is still a defect and gets fixed, noted in the commit. Two came out
  of rereading the proxy: a drain that could never settle once the player left, and a
  failure path that left a response open forever.
- 2026-09-22 - Cold reread before every push becomes a step, not a habit. Three modules in
  a row it found what a green suite did not, including a test that had frozen a bug. Each
  suspicion is reproduced by a test before being fixed.
- 2026-09-22 - `castv2-client` is accepted although it was last published in June 2022, but
  behind one file: `electron/cast-session.mts` is the only place that imports it, and the rest
  of the app calls connect, load, pause, volume and stop on our own functions. Google's cast
  protocol does not move, there is no maintained alternative, and reimplementing CASTV2
  (protobuf over TLS) is not worth it for a secondary feature. The version is pinned, and its
  `protobufjs` is forced to 7.x through `overrides`, which removes the eleven advisories the
  6.x line carries; the library still encodes and decodes on 7.6.6, verified against the fake
  receiver. `dns-packet` and `multicast-dns` are current and need no such care.
- 2026-09-23 - Preferred audio track selection is not ported. `findPreferredAudioIndex` came
  from the films app: no anime page passed it a track and the api never produced one, since
  VF and VOSTFR are separate sources rather than tracks of one manifest. No audio menu
  either until a source needs it. The quality menu came over without its Anime4K lock,
  which returns with Anime4K, nor its 720p software decoding cap, which depended on a
  `disableHardwareAcceleration` this app does not call.
- 2026-09-23 - A picked source is the host key (`s1`), no longer the api's slot (`eps2`).
  The slot is a column of one season's page and names different hosts across languages and
  seasons, while the key is kept stable across the catalog by the api for this purpose.
  A picked source the episode lacks now hands over to the automatic order: with the
  choice following the viewer across episodes, playing nothing would happen too often.
- 2026-09-23 - No subtitle support: the sources burn them into the video, and the shipped
  app never had any. What slice 4 needed instead is a language switch in the player. It
  keeps the position, since progress is saved per language and the new one would start at
  zero, and it keeps the picked source, a host key being the same across languages. The
  host picker stays on the anime page, out of the player.
- 2026-09-23 - `anime4k-webgpu` is accepted although its only version dates from June 2024,
  on the same terms as `castv2-client`: pinned, and imported by one file,
  `src/features/player/anime4k.ts`, which loads it on first use since it weighs 3.4 MB. It
  carries bloc97's networks as compute shaders; rewriting them is not worth it. The first
  activation warning no longer diagnoses the GPU: that took an IPC call and a list of GPU
  models to keep up to date, for an estimate. It states a recommended minimum instead.
- 2026-09-23 - Writing switch (D15). The app signs in, browses, opens an anime and plays it,
  checked end to end against the api and a local Supabase. From now on new code is written
  here only; the private app, frozen since 2026-09-21, takes urgent fixes and nothing else.
- 2026-09-24 - Films, OAV and side seasons ("Autres") never show episode metadata: the api
  fills them with the main series' episodes by position, and the client cannot tell a real
  match. Their own anime-sama name, or "Film 3", "Épisode 1", is shown instead, at the cost
  of the rare side season whose metadata was right.
- 2026-09-24 - Skip settings wait for the settings page. Until then the player behaves as the
  previous app did by default: skip button shown, next episode chained, no automatic skip.
- 2026-09-25 - No auto update in the app for now. The previous one had none: the hub installed
  and updated it, and the hub is out of scope (D4). How this repository's builds reach users
  is decided with the release pipeline, which decides the mechanism.
- 2026-09-25 - Discord Rich Presence speaks Discord's local protocol itself, over node:net:
  a pipe, a handshake and json frames. `discord-rpc` was last published in 2021 and pulls a
  dependency straight from GitHub; `@xhayper/discord-rpc` brings a REST client for one call.
  The previous app's elapsed time never showed: it passed `timestamps`, which that library
  ignored for `startTimestamp`. Presence is on until the settings page offers to turn it off.
- 2026-09-25 - A development build does not register the nartya:// scheme, which would take
  links away from the installed app. Deep links only open anime pages until the profile and
  watch party slices bring their own routes.
- 2026-09-26 - Favorites are reordered with `@dnd-kit`, as in the previous app. Native drag and
  drop was tried first: it drags a translucent snapshot of the card and the others only move
  on drop, which felt like dragging an image off a web page. `@dnd-kit` moves the card itself
  and makes room live, and brings auto scroll and keyboard reordering. Its classic line was
  last published in December 2024 and needs only `tslib` and its own accessibility module.
