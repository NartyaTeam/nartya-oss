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
- No `console.log`: a dedicated logger in the Electron main process, nothing in the front end.
- Named constants for values that are not obvious or used twice. No URL, key or host in the
  code: everything goes through configuration.
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
  low-level code: take it, move it to TypeScript, clean it, split it, without changing
  behaviour, tests green) or **rewrite** (all of the front end: write from behaviour, never
  from the text). Do not rewrite what is marked port: that code encodes empirical fixes which
  are invisible on reading.
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
comment blocks longer than two lines and hardcoded URLs.
