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
