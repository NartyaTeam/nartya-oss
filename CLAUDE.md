# Nartya - code rules

Rewrite of a private codebase in the open. The previous repository is **read only**: it is
there to explain behaviour, never to copy files from. Plan and decisions: [plan/](plan/).

Stack: TypeScript strict, Vite + React 18 + React Router + Zustand + Tailwind + Electron,
data and auth on Supabase.

## Principle

The code should read like the work of a careful developer: plain, direct, barely commented.
Someone opening a file should not feel they are reading generated text. When the code is
clear, nothing is added around it.

## Comments

- None by default. Function and variable names say what the code does.
- Write a comment only for a **why** that cannot be guessed: a browser or library bug being
  worked around, a protocol or provider constraint, a subtle invariant.
- One line. Two at most. Never a paragraph. Under 100 characters.
- Not allowed:
  - file headers summarising the module;
  - JSDoc blocks repeating the signature;
  - section banners;
  - history ("extracted from...", "used to be...", old names, version numbers): that belongs
    in the commit message;
  - step-by-step narration ("1. fetch the...");
  - commented-out code;
  - `TODO` without an issue number;
  - emoji and decorative symbols, in code and in logs alike.
- Types already say what parameters are: no `@param` or `@returns`. Comment an exported
  function only when its behaviour is not obvious.

```ts
// Bad
/**
 * Pure decisions about the session (expiry, guest, ban).
 *
 * Extracted from useAuthStore so it stays testable without Supabase...
 */

// Good: nothing, or only what cannot be guessed
// Safari reports a duration of 0 until the metadata has loaded.
```

## TypeScript

- `strict: true`. No `any`, no `as` to silence the compiler, no `!` without a reason. An
  unavoidable escape hatch carries a one-line comment saying why.
- No annotation where inference is enough. Annotate parameters, exported return types and
  data entering the app.
- `unknown` plus a validation step for external data: API responses, IPC, local storage.
  Supabase types are generated, never hand written.
- `type` by default, `interface` only when extending. No `enum`: use string literal unions.
- No clever generics. A type that takes ten lines usually means the function does too much.

## Code

- Simple first. No abstraction before the third repetition. No function created to be called
  once unless it makes the code easier to read.
- No option or parameter "for later". No defensive code against impossible cases. Validate at
  the boundaries (input, network, IPC), not inside.
- `try/catch` only when there is something to do with the error. Never a silent `catch {}`.
- Short, concrete names. No catch-all `Manager`, `Helper` or `Util`, no `data` or `result`
  when a precise name exists.
- Early returns rather than nesting more than three levels deep.
- One component per file. Aim under 300 lines; beyond that the file probably does two things.
  A page assembles, it does not hold business logic.
- No `console.log`. The main process logs through `electron/log.mts`: one `createLogger`
  per file, scope named after the file, message then fields (`log.warn("load failed", { err })`).
  Nothing in the front end. Logs end up in bug reports, so the logger redacts credentials and
  cuts urls down to host and first segment - never work around that at the call site.
- Named constants for values that are not obvious or used twice. No URL, key or host in the
  code: everything goes through configuration. The one place a third party endpoint may be
  written down is an `endpoints` module, so that there is a single file to audit.
- A new dependency has to be justified. Prefer the platform when it is enough.
- React: function components, local state or Zustand, effects kept to a minimum, `useMemo` and
  `useCallback` only when a measurement calls for it.
- Tailwind classes inline. No custom CSS beyond tokens.

## Text

- Language: English for identifiers, comments, docs and commit messages. Text shown to the
  user is French for now, inline, with no i18n library.
- Commit messages: conventional commits, short, imperative, no marketing. The body explains
  the why, and only when it is not obvious.
- This repository states once, in the README and in the method page, that the migration is
  done by AI. It does not repeat it at the bottom of every commit: no `Co-Authored-By` line,
  no "Generated with" mention in pull requests. This replaces the default attribution.
- The label excuses nothing. It is only worth something if the code is clean, which makes the
  comment rules above the core of the project rather than a detail of hygiene.
- Docs: factual and short. No empty vocabulary ("robust", "elegant", "seamless"), no emoji
  bullets.
- User-facing text: icons go through a component, never an emoji in a string.

## How to work

- One module at a time, in the order of [plan/migration.md](plan/migration.md).
- Before touching a module: three lines on what it does and what will change. Wait for
  confirmation if the behaviour changes.
- Every module has a verdict in [plan/inventory.md](plan/inventory.md): **port** (proven
  low-level code: take it, move it to TypeScript, clean it, split it, tests green) or
  **rewrite** (all of the front end: write from behaviour, never from the text). Do not
  rewrite what is marked port: that code encodes empirical fixes which are invisible on
  reading.
- Porting keeps the empirical fixes, not the defects around them. Where the previous code
  is plainly wrong - a promise that can never settle, an error nobody answers - fix it and
  say so in the commit. Starting again is what makes a better foundation possible; matching
  the old behaviour is not a goal in itself.
- Do not carry over comments from the previous code, not even when porting. Keep only the
  workarounds that are still true, reworded to one line.
- Pure logic gets tests. Lint, tests and build pass before a module is called done.
- Nothing outside the requested scope: no drive-by refactor, no extra feature.
- In doubt about a product choice: ask rather than invent.
- Small, readable diffs: a human reviews and understands each module before the next one.
- Only commit or push when asked.

## Before handing back

```bash
npm run lint && npm test && npm run build
```

`npm run lint` runs `tsc`, ESLint, Prettier and `scripts/check-style.ts`, which rejects emoji,
comment blocks longer than two lines, hardcoded URLs and logger scopes that do not match
their file name.

## Before pushing

A green suite says the code does what the tests say, not that the tests say the right
thing. So before every push, reread the diff cold and hunt for defects:

- read what changed as if reviewing someone else, looking for what breaks rather than
  confirming it works: a promise that can never settle, a write that recreates what was
  deleted, a value computed and then dropped, an error nobody answers;
- **reproduce every suspicion with a test before fixing it.** A suspicion that cannot be
  reproduced was wrong, and the test is what stops the defect coming back;
- distrust a test that agrees too easily. One that asserts the current behaviour of code
  written minutes earlier freezes the bug instead of catching it. A fake that does not
  honour an abort signal, a cancellation that is never delivered: the defect is in the
  test, and it hides one in the code;
- run the thing for real, not only its tests, when there is something to run.

This is not ceremony. It has caught, on consecutive modules: five defects in the proxy,
two in the downloads, and a test that pinned a logger bug in place.
