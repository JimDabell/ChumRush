# Server-only code

This directory contains the Strava OAuth flow, encrypted session cookies,
DynamoDB profile storage, and request-derived location handling. SvelteKit
prevents client-side imports from this directory.

Deployment selection lives in `src/lib/environment.ts` and
`src/lib/deployment.ts`. Private credentials are declared in `src/env.ts` and
must only be imported through `$app/env/private` from server code.
