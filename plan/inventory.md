# Module inventory

Regime per module (D10, D11): **port** (code taken over, moved to TypeScript, cleaned, tests
green), **rewrite** (new version written from behaviour) or **after switch** (not deleted,
rebuilt in public once the switch is done, see D15). Sizes in lines of the previous codebase.

## Front end - everything is a rewrite

| Area                                                            | Lines      | Regime           | Note                                                                                       |
| --------------------------------------------------------------- | ---------- | ---------------- | ------------------------------------------------------------------------------------------ |
| Pages, excluding watch party                                    | ~10 500    | rewrite          | Settings 1383, Watch 1339, Anime 825, ScanReader 830: split while rewriting                |
| Anime page components                                           | 3 084      | rewrite          | One section file at 1119                                                                   |
| Player components and HLS config                                | ~2 500     | rewrite          | The core of the product. Extraction and detection live in the main process, and are ported |
| Anime4K                                                         | 721        | rewrite          | Kept in the first version (D11). Standalone, no backend                                    |
| Profile components                                              | 3 180      | rewrite          | Grouped per screen. Credits and cosmetics drop out                                         |
| Comments, community                                             | 1 442      | rewrite          |                                                                                            |
| Legal pages                                                     | 84         | rewrite          |                                                                                            |
| Data layer                                                      | 3 199      | rewrite          | A single data layer, shaped by the RLS audit                                               |
| Stores                                                          | 2 115      | rewrite          | Auth store at 801, to be split                                                             |
| Hooks, lib, utils, shared                                       | ~6 540     | rewrite          | One helpers folder, the rest moves into features                                           |
| Platform layer                                                  | 753        | rewrite          | Becomes the platform contract, desktop only                                                |
| Watch party                                                     | 2 546      | after switch     | D11, D15                                                                                   |
| Credits, referrals, shop, ambient themes                        | ~2 000 net | after switch     | D11, D15                                                                                   |
| Announcements, achievements, reports                            | 1 323      | after switch     | D11, D15                                                                                   |
| Mobile                                                          | 941        | out of scope     | D4                                                                                         |
| Changelog and achievement data files                            | 1 360      | move out of code | Changelog becomes Markdown, the rest returns after the switch                              |
| Unimported files (credits page, art preview, achievement badge) | n/a        | drop             | Verified: one mention, in a comment                                                        |

## Electron - the low level is ported

| Module                                                                                                  | Lines    | Regime          | Note                                                                        |
| ------------------------------------------------------------------------------------------------------- | -------- | --------------- | --------------------------------------------------------------------------- |
| `main`                                                                                                  | 824      | rewrite         | Window, IPC, deep link, updates. Hub launch drops out                       |
| `preload`                                                                                               | 160      | rewrite         | Becomes the typed platform contract                                         |
| Byte ranges, URL validation, friendly errors, HLS playlist, stream handles, LAN address, firewall check | ~470     | port            | Small, tested, empirical                                                    |
| Local proxy                                                                                             | 828      | port then split | Publishable (D5). Proxy range test ported first                             |
| Provider fetch, video extraction, source recipe                                                         | 600      | port            | Publishable as is: no host named, opaque keys, table served by the API (D5) |
| Demo recipe                                                                                             | new      | write           | D12: JSON fixture pointing at a local file or a free stream                 |
| Download manager                                                                                        | 1411     | port then split | Recovery test ported first                                                  |
| Cast manager                                                                                            | 548      | port            | Tested against a fake receiver                                              |
| OAuth callback server                                                                                   | 214      | port            |                                                                             |
| Discord RPC, DoH resolver                                                                               | 195, 144 | port            |                                                                             |
| Shared session                                                                                          | 226      | drop            | Tied to the hub, out of scope (D4)                                          |

## Everything else

| Area                                              | Regime                 | Note                                                                          |
| ------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| Catalog API (11 235 lines)                        | out of repository (D5) | Separate private repository. It serves the recipe; its contract is documented |
| Android                                           | out of repository (D4) |                                                                               |
| Supabase migrations (133, 46 tables, 46 policies) | rewrite                | Extracted from production, split per phase, see [supabase.md](supabase.md)    |
| Tests                                             | port                   | Except those covering features outside the first version                      |
| CI workflows                                      | rewrite                | Simple public CI, release pipeline kept separate                              |
| Internal publishing process and deploy scripts    | drop                   |                                                                               |
| Root documentation (10 files)                     | rewrite                | Keep README, CONTRIBUTING, ARCHITECTURE, SECURITY                             |
| Public assets                                     | check                  | Usage rights, see [publication.md](publication.md)                            |
| Local build output (584 MB)                       | do not carry over      |                                                                               |
