# Standing rules and switch criteria

The repository is public from the first commit (D14). There is no final gate: the first part of
this file has to be true **at every commit**, the second decides when writing, then production,
moves off the private repository (D15).

## True at every commit - automated in phase 1

- [ ] gitleaks in the pre-commit hook and in CI
- [ ] `check-style.ts` blocking: emoji, comment blocks longer than two lines, hardcoded URLs
- [ ] `npm run lint && npm test && npm run build` green in CI on Linux, macOS and Windows
- [ ] No key, host, port, personal path or machine name: everything through configuration
- [ ] `.env.example` up to date, `.env` absent
- [ ] No internal process (release, servers, hub, admin) mentioned anywhere
- [ ] Nothing describing the source recipe beyond its public contract

Reminder: what is pushed is public forever. A pushed secret is a secret to rotate, not to
delete.

## Before publishing specific parts

- [ ] **Data layer (phase 2)**: RLS audit applied, no table without RLS, no unjustified
      permissive policy
- [ ] **Proxy and extraction (phase 3.4)**: rate limiting, logging and bans effective on the
      recipe endpoint; legacy source URL path retired
- [ ] **Schema (phase 5)**: limited to the tables in use, audit conclusions applied
- [ ] Anti-abuse measures inventoried: each one either holds in the open or has moved to the
      server
- [ ] No protection relies on a secret embedded in the client

## Rights and legal

- [ ] MIT `LICENSE`, consistent `package.json` (license, description, no email - D13)
- [ ] Usage rights checked for bundled images and fonts
- [ ] Dependency licenses compatible
- [ ] Third party names and logos mentioned without implying a partnership
- [ ] Nothing claimed about the private repository (D8)

## Switch criteria (D15)

- [x] The public app runs end to end: auth, catalog, anime page, player (writing switch,
      2026-09-23)
- [ ] An outside contributor can run it from the README alone: `supabase start`,
      `npm run dev`, a demo video plays
- [ ] No file over 300 lines without a reason; metrics published in the README
- [ ] The tests ported from the previous codebase are green
- [ ] `ARCHITECTURE`, `CONTRIBUTING`, `SECURITY` and the method page in place
- [ ] Build and release working from this repository
- [ ] Parity reached with the last privately shipped version (D15)
- [ ] Private vulnerability reporting enabled, `SECURITY.md` pointing at it (D13)
