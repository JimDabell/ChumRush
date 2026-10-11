# Remote functions

Place future `*.remote.ts` modules here (or colocate them with their routes).
Import `query`, `form`, `command`, and `prerender` from `$app/server`.

Keep remote modules outside `src/lib/server` so components can import them.
Validate inputs and enforce authentication and authorization inside each future
remote operation.
Server-only helpers belong in `#lib/server/*`.

Remote functions and async components are enabled in `vite.config.ts`.
No endpoints or application behavior are implemented yet.
