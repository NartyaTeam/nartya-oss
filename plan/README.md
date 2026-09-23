# Plan

How this repository is being built, and why. Written as the work goes, not after the fact.

| File                             | Contents                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| [status.md](status.md)           | Where the work stands, what comes next, what is left open                              |
| [decisions.md](decisions.md)     | D1 to D15: language, stack, scope, licence, AI attribution, long term goal             |
| [audit.md](audit.md)             | The previous codebase, measured                                                        |
| [migration.md](migration.md)     | Phases, from commit 1 to the switch                                                    |
| [inventory.md](inventory.md)     | Every module, with its regime: port, rewrite, or after the switch                      |
| [publication.md](publication.md) | What has to be true at every commit, and the switch criteria                           |
| [supabase.md](supabase.md)       | How the database gets published: extraction, splitting, filtering, audit queries in CI |

In short: a rewrite from scratch, public from the first commit, published as it goes, with the
aim of eventually becoming the main repository for the app.
