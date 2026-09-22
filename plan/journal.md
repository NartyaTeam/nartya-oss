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
