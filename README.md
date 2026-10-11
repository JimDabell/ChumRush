# ChumRush

Find a buddy for a run, trail run, or bike ride.

## Development

Use a Node.js version supported by `package.json`.

```sh
npm install
cp .env.example .env
npm run dev:services
npm run dev
```

Open <https://www.chumrush.localhost>. Portless may ask to trust its local
HTTPS certificate on first use. Restart the server after changing `.env`.

### Local services

Docker Compose runs the same DynamoDB Local, database dashboard, and Mailpit
images as Hantu, with separate ports and persistent ChumRush volumes.

- Database dashboard: <https://db.chumrush.localhost>
- Mailpit inbox: <https://mail.chumrush.localhost>
- DynamoDB API: `http://127.0.0.1:8100` (region `us-east-1`, credentials `local`)
- SMTP: `127.0.0.1:1125`, without authentication or TLS.

`npm run dev:services` starts all three services and registers the Portless
URLs. Use `npm run dev:db` or `npm run dev:mail` to start them individually.
Stop them with `docker compose stop`; database and mail data are preserved.

### Mapbox

Create a public token at <https://console.mapbox.com/account/access-tokens/>
and set `PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env`. Use a `pk.*` token, never a
secret `sk.*` token.

For URL restrictions, create a new token and allow
`https://www.chumrush.localhost` and your production URL. Mapbox's default
public token cannot have URL restrictions.

The initial city uses hosting-proxy location hints when available and falls
back to Singapore. On Cloudflare, enable visitor-location request headers.

### Strava

Create an application at <https://www.strava.com/settings/api>. Set its
**Authorization Callback Domain** to `www.chumrush.localhost`, without a
scheme or path.

Fill in these private values in `.env`:

- `STRAVA_CLIENT_ID` — your application's client ID.
- `STRAVA_CLIENT_SECRET` — its OAuth client secret.
- `AUTH_SECRET` — a stable random secret for encrypted sign-in sessions.

Set `STRAVA_REDIRECT_URI` to:

```text
https://www.chumrush.localhost/auth/strava/callback
```

Generate an `AUTH_SECRET` with:

```sh
openssl rand -hex 32
```

Use HTTPS for sign-in. For production, update the callback domain and URI
and use a separate `AUTH_SECRET`. Keep that secret stable across restarts.

## Commands

- `npm run check` — Svelte, TypeScript, lint, and formatting checks.
- `npm run format` — format the project.
- `npm run build` — production build.
- `npm run preview` — preview the production build.
