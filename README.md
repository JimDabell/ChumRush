# ChumRush

Find a buddy for a run, trail run, or bike ride.

## Environments

Domains are deployment configuration, not source-code constants. Set these two
variables in the environment that runs the build:

- `APP_ENV` identifies `local`, `staging`, or `production` behavior.
- `APP_ORIGIN` is the canonical `https://www...` origin for that deployment.

The app derives the apex redirect and Strava callback from `APP_ORIGIN`. Set
`DYNAMODB_PROFILES_TABLE` independently in each deployment; there is no
source-code fallback for hosted data. Configure hosted values directly in the
platform's environment or secret manager, not in additional committed env
files.

Each hosted environment must have its own:

- Strava application and client secret;
- Mapbox public token with an exact URL restriction;
- stable `AUTH_SECRET`;
- DynamoDB table and credentials or workload identity.

This separation prevents test logins, sessions, map usage, and profile data
from crossing into production.

## Development

Use a Node.js version supported by `package.json`.

```sh
cp .env.example .env
npm install
npm run dev:services
npm run dev
```

Open <https://www.chumrush.localhost>. Portless may ask to trust its local
HTTPS certificate on first use. Restart the server after changing `.env`.

The dev launcher reads `APP_ORIGIN` from `.env`, then registers its canonical
hostname and derived apex alias on the same Portless-assigned port. The app
redirects the apex to `www` and removes both routes when the server stops.

### Local services

Docker Compose runs the same DynamoDB Local, database dashboard, and Mailpit
images as Hantu, with separate ports and persistent ChumRush volumes.

- Database dashboard: <https://db.chumrush.localhost>
- Mailpit inbox: <https://mail.chumrush.localhost>
- DynamoDB API: `http://127.0.0.1:8100`
- DynamoDB region and credentials: `us-east-1` and `local`
- SMTP: `127.0.0.1:1125`, without authentication or TLS

`npm run dev:services` starts all three services and registers the Portless
URLs. Use `npm run dev:db` or `npm run dev:mail` to start them individually.
Stop them with `docker compose stop`; database and mail data are preserved.

## Hosted deployments

Configure staging and production directly in the hosting platform. Both use a
production build. Set `APP_ENV` and `APP_ORIGIN` in the build environment;
Vite embeds the configured canonical origin for host validation and CSRF
protection. Inject the remaining public and private values through that same
deployment configuration.

Leave `DYNAMODB_ENDPOINT` empty to use the normal AWS DynamoDB endpoint. If the
deployment supports an AWS credential chain or workload identity, leave both
DynamoDB credential variables empty. Otherwise, provide both
`DYNAMODB_ACCESS_KEY_ID` and `DYNAMODB_SECRET_ACCESS_KEY`.

Set `DYNAMODB_REGION` and `DYNAMODB_PROFILES_TABLE` explicitly. ChumRush only
creates a missing table when connected to a loopback DynamoDB Local endpoint.
Hosted tables must be provisioned separately with a numeric `stravaId`
partition key.

Route both the apex and `www` domains to each deployment and provision HTTPS
before enabling Strava sign-in. Configure the hosting edge to redirect the
apex to `www`; the application also returns a permanent redirect as a fallback.

### Mapbox

Create a different public `pk.*` token for every environment and restrict it
to that deployment's `APP_ORIGIN`. Set the token as
`PUBLIC_MAPBOX_ACCESS_TOKEN`. Never use a secret `sk.*` token in the web app.
Mapbox's default public token cannot have URL restrictions, so create dedicated
tokens instead.

The initial city uses hosting-proxy location hints when available and falls
back to Singapore. On Cloudflare, enable visitor-location request headers.

### Strava

Create one application per environment at
<https://www.strava.com/settings/api>. Set each application's
**Authorization Callback Domain** to its canonical `www` hostname, without a
scheme or path. Configure `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` only in
that environment.

The callback URL is derived from `APP_ORIGIN`; it is not separately
configurable. This prevents the callback domain from drifting away from the
canonical application domain.

Generate each environment's stable, unique `AUTH_SECRET` with:

```sh
openssl rand -hex 32
```

Changing this value signs out existing users. Never share it between staging
and production.

## Commands

- `npm run check` — run Svelte, TypeScript, lint, and formatting checks
- `npm run format` — format the project
- `npm run build` — create a production build
- `npm run preview` — preview the production build
