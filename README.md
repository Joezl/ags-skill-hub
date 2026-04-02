# ArcGIS Skill Hub

Skill Hub is a Next.js 16 application for discovering ArcGIS agent skills from ArcGIS Online and copying install instructions that a client or agent runtime can execute locally.

The app currently supports:

- Live skill discovery from ArcGIS Online search
- Viewer-aware results when the user signs in with ArcGIS
- Web OAuth session management with encrypted HttpOnly cookies
- Copyable `ARC_SKILL_INSTALL` blocks for client and agent runtimes
- A local installer CLI for parsing descriptors, logging into ArcGIS, and downloading skill packages

## Requirements

- Node.js 20+
- An ArcGIS Online or ArcGIS Enterprise OAuth app
- A local `.env.local` file with ArcGIS settings, typically copied from `.env.example`

## Local Development

Install dependencies and start the app:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/skill-hub`.

Useful commands:

```bash
npm run dev
npm run build
npm run type-check
npm run test:run
```

## Environment Variables

Start from `.env.example` and copy the values into `.env.local` for your machine.

Required for live skill search:

```bash
ARCGIS_PORTAL_URL=https://www.arcgis.com
ARCGIS_ORG_ID=<your-org-id>
ARCGIS_MAX_ITEMS=100
```

Optional override if you want to provide a full custom ArcGIS search query:

```bash
ARCGIS_AGENT_SKILL_QUERY=orgid:<your-org-id> AND type:"Code Sample" AND typekeywords:"Agent Skill"
```

Required for web sign-in:

```bash
ARCGIS_OAUTH_CLIENT_ID=<your-oauth-client-id>
SKILL_HUB_SESSION_SECRET=<random-long-secret>
```

Optional for confidential OAuth clients:

```bash
ARCGIS_OAUTH_CLIENT_SECRET=<your-oauth-client-secret>
ARCGIS_OAUTH_REDIRECT_URI=http://localhost:3000/skill-hub/api/auth/arcgis/callback
```

Notes:

- `SKILL_HUB_SESSION_SECRET` is used to encrypt the Skill Hub session cookie.
- If `ARCGIS_OAUTH_REDIRECT_URI` is not set, the app builds the callback URL from the current request origin plus `/skill-hub/api/auth/arcgis/callback`.
- The OAuth app must allow `http://localhost:3000/skill-hub/api/auth/arcgis/callback` as a redirect URI for local development.

## Web Sign-In Behavior

- Anonymous users can browse public results.
- Signed-in users can see items available through their ArcGIS access.
- Skill Hub does not directly read another ArcGIS app's browser cookies.
- If the browser already has an ArcGIS session, the ArcGIS OAuth step can usually reuse it and return quickly.

## Installer CLI

The repo includes a local installer at `scripts/skillhub-installer.mjs`.

Commands:

```bash
npm run login:arcgis
npm run install:skill -- --item <arcgis-item-id> --portal https://www.arcgis.com
pbpaste | node scripts/skillhub-installer.mjs install --stdin
node scripts/skillhub-installer.mjs parse --stdin
```

Installer environment variables:

```bash
ARCGIS_OAUTH_CLIENT_ID=<your-oauth-client-id>
ARCGIS_OAUTH_CLIENT_SECRET=<optional-client-secret>
ARCGIS_OAUTH_CALLBACK_PORT=8976
ARCGIS_INSTALL_ROOT=~/.skillhub/skills
```

The installer will:

- Reuse a cached ArcGIS token when available
- Refresh the token when a refresh token exists
- Open a browser OAuth flow when login is required
- Download the ArcGIS item package and extract zip archives
- Write an install manifest to `.skillhub-install.json`

## Architecture Notes

- App base path is `/skill-hub`
- Skill data is fetched from ArcGIS REST search endpoints at request time
- Web auth sessions are stored in encrypted HttpOnly cookies
- Session refresh is handled in `src/proxy.ts`
- Turbopack root is pinned in `next.config.ts` to avoid workspace-root warnings in multi-lockfile environments

## Deployment Notes

- Windows IIS deployment summary: `docs/WINDOWS_IIS_DEPLOYMENT.md`

## Project Structure

```text
src/
	app/                    Next.js App Router pages and route handlers
	components/             UI and page-level client components
	lib/                    ArcGIS data and auth helpers
	data/                   Static test fixtures
	types/                  Shared TypeScript types
scripts/
	skillhub-installer.mjs  Local installer CLI
docs/                     Product, architecture, and workflow docs
```
