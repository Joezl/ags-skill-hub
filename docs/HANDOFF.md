# Skill Hub Handoff

## 1. Current Status

As of 2026-03-30, Skill Hub is no longer a mock-data MVP. It is now a live ArcGIS-backed Next.js 16 app with:

- Server-rendered live skill discovery from ArcGIS Online
- ArcGIS web sign-in via OAuth authorization code flow
- Encrypted HttpOnly session cookies for the Hub itself
- Session refresh handling in `src/proxy.ts`
- A working sign-out flow
- Copyable `ARC_SKILL_INSTALL` blocks on skill cards
- A local installer CLI that can parse descriptors, run ArcGIS OAuth, cache tokens, download item packages, and extract zip content

This is the baseline that should be continued. Do not treat the repo as a static-export mock site anymore.

## 2. What Was Completed In This Phase

### 2.1 Live ArcGIS data

- The app fetches real ArcGIS items instead of local mock skills for the main directory flow.
- Search results come from ArcGIS REST search and are mapped in `src/lib/arcgis.ts`.
- The home page fetches on the server and remains dynamic.
- `GET /api/skills` is available as a session-aware dynamic API.

### 2.2 Install flow upgrade

- Skill cards no longer copy a plain shell command.
- They now copy a machine-readable block with the format:
  - `ARC_SKILL_INSTALL`
  - key/value metadata
  - `END_ARC_SKILL_INSTALL`
- The copied text also includes natural-language guidance for a client or agent runtime.

### 2.3 Local installer CLI

The installer in `scripts/skillhub-installer.mjs` supports:

- `login`
- `install`
- `parse`

It can:

- Reuse cached ArcGIS tokens
- Refresh with a refresh token when possible
- Open a localhost browser OAuth callback flow
- Download item data from ArcGIS
- Extract zip packages to `~/.skillhub/skills/<itemId>` by default
- Write `.skillhub-install.json`

### 2.4 Hub web OAuth

The Hub itself now supports ArcGIS sign-in.

Implemented pieces:

- `src/app/api/auth/arcgis/login/route.ts`
- `src/app/api/auth/arcgis/callback/route.ts`
- `src/app/api/auth/arcgis/logout/route.ts`
- `src/lib/arcgis-auth.ts`
- `src/proxy.ts`

Behavior:

- Anonymous users can still browse public results
- Signed-in users see results based on their ArcGIS access
- If the browser already has an ArcGIS session, the ArcGIS OAuth step usually reuses it and returns quickly
- The Hub does not directly read credentials from other ArcGIS apps without going through OAuth

### 2.5 UX and stability fixes

- Sign-out now works correctly because auth links use full-document navigation instead of App Router `Link`
- The previous Next workspace-root warning is fixed via `turbopack.root` in `next.config.ts`
- A hydration mismatch risk from relative date rendering was fixed by passing a stable server render timestamp into the card layer
- `.env.example` was added
- A non-watch test script `npm run test:run` was added
- README and development docs were updated to match the current implementation

## 3. Current Architecture

### 3.1 App runtime

- Framework: Next.js 16.2.1 App Router
- Base path: `/skill-hub`
- Dist dir: `dist`
- Turbopack root explicitly pinned in `next.config.ts`
- Main page and auth/data routes are dynamic server routes

### 3.2 Main page data flow

1. `src/app/page.tsx`
   - Reads auth availability
   - Reads current ArcGIS session and viewer
   - Calls `getArcGISSkills()` server-side
   - Passes a stable `renderTimestamp` into the client tree

2. `src/components/skill-hub-client.tsx`
   - Handles client-side search, filtering, sorting, and rendering
   - Renders auth-aware UI copy

3. `src/components/skill-card.tsx`
   - Renders card UI
   - Copies `installPrompt`
   - Uses a stable render timestamp for relative date labels

### 3.3 ArcGIS data layer

Core file: `src/lib/arcgis.ts`

Responsibilities:

- Build the ArcGIS item query
- Call ArcGIS search endpoints
- Normalize search results into the `Skill` type
- Build `installPrompt`
- Infer categories
- Clean text fields

### 3.4 ArcGIS auth layer

Core file: `src/lib/arcgis-auth.ts`

Responsibilities:

- Determine whether web auth is configured
- Begin OAuth login
- Complete OAuth callback
- Encrypt and decrypt Hub sessions
- Refresh expiring sessions in proxy
- Clear sessions on logout

Cookies used:

- `skillhub_arcgis_session`
- `skillhub_arcgis_oauth_state`
- `skillhub_arcgis_oauth_verifier`
- `skillhub_arcgis_return_to`

### 3.5 Proxy refresh layer

File: `src/proxy.ts`

Current matcher coverage:

- `/skill-hub`
- `/skill-hub/api/skills`

This is where near-expiry sessions get refreshed before request handling.

## 4. Key Files To Read First

The next contributor should start here:

- `next.config.ts`
- `src/lib/app-config.ts`
- `src/lib/arcgis.ts`
- `src/lib/arcgis-auth.ts`
- `src/proxy.ts`
- `src/app/page.tsx`
- `src/app/api/skills/route.ts`
- `src/app/api/auth/arcgis/login/route.ts`
- `src/app/api/auth/arcgis/callback/route.ts`
- `src/app/api/auth/arcgis/logout/route.ts`
- `src/components/header.tsx`
- `src/components/skill-hub-client.tsx`
- `src/components/skill-card.tsx`
- `scripts/skillhub-installer.mjs`
- `README.md`
- `.env.example`

## 5. Environment And Local Setup

The repo now assumes `.env.local` for local runtime values.

Template:

- `.env.example`

Relevant variables:

### 5.1 Live skill discovery

- `ARCGIS_PORTAL_URL`
- `ARCGIS_ORG_ID`
- `ARCGIS_MAX_ITEMS`
- `ARCGIS_AGENT_SKILL_QUERY` optional override

### 5.2 Hub web OAuth

- `ARCGIS_OAUTH_CLIENT_ID`
- `ARCGIS_OAUTH_CLIENT_SECRET` optional
- `SKILL_HUB_SESSION_SECRET`
- `ARCGIS_OAUTH_REDIRECT_URI` optional explicit override

### 5.3 Installer CLI

- `ARCGIS_OAUTH_CALLBACK_PORT`
- `ARCGIS_INSTALL_ROOT`

Important local callback for the Hub:

- `http://localhost:3000/skill-hub/api/auth/arcgis/callback`

This URI must be registered in the ArcGIS OAuth app for local development.

## 6. Verified Baseline

These were verified during the latest phase:

- `npm run build` passes
- `npm run test:run -- src/lib/arcgis-auth.test.ts src/components/__tests__/skill-card.test.tsx` passes
- Web sign-in works end-to-end with a configured ArcGIS OAuth app
- Signed-in viewer state renders in the header
- Sign-out works end-to-end
- Build no longer emits the old inferred workspace-root warning

## 7. Known Constraints And Tradeoffs

### 7.1 Field naming is still transitional

These are still compatibility names from the older mock model:

- `downloads` currently displays ArcGIS `numViews`
- `stars` currently displays ArcGIS `numRatings`

The UI copy was updated to `Views` and `Ratings`, but the data model names are still old.

### 7.2 ArcGIS SSO behavior

The current product behavior is intentional:

- The Hub does not auto-detect another ArcGIS app's login state without starting OAuth
- If the browser already has an ArcGIS session, the OAuth step can usually reuse it
- The current UX of anonymous browsing plus explicit sign-in is accepted and should be preserved unless product direction changes

### 7.3 Refresh flow is implemented but not fully battle-tested

The refresh-token path exists in both the Hub auth layer and the installer CLI, but a real end-to-end expiry/refresh scenario has not been fully exercised yet.

### 7.4 Some older project summary docs are stale

These files contain earlier MVP-era assumptions and should not be treated as source of truth:

- `PROJECT_TRACKING.md`
- `docs/TEAM_SUMMARY.md`

Use this handoff, the current code, and the updated README instead.

## 8. Recommended Next Work

### Priority 1: Validate session refresh end-to-end

Best next engineering task:

- Simulate or force near-expiry Hub sessions
- Confirm `src/proxy.ts` refreshes them correctly
- Add targeted tests around refresh success and refresh failure behavior

### Priority 2: Add more auth route coverage

The auth helpers have some tests, but the route-handler behavior is not deeply covered yet.

Good follow-up areas:

- login redirect behavior
- callback failure states
- logout redirect and cookie clearing
- proxy refresh integration behavior

### Priority 3: Refine install UX

The current install block works, but product polish is still open.

Questions that remain:

- whether `Copy Install` is the final button label
- whether there should be separate actions for `Open Item`, `Copy URL`, and `Copy Install`
- how org/shared/private access should be shown more explicitly in the card UI

### Priority 4: Clean up domain naming

Once auth and install UX are stable, do a cleanup pass:

- `downloads` -> `views`
- `stars` -> `ratings`
- clearly separate ArcGIS source fields from Hub-derived fields

## 9. Suggested Handoff Workflow For The Next Contributor

1. Read `README.md` and `.env.example`
2. Read `src/lib/arcgis.ts`, `src/lib/arcgis-auth.ts`, and `src/proxy.ts`
3. Confirm `.env.local` is populated locally
4. Run:
   - `npm run build`
   - `npm run test:run`
5. Pick one bounded workstream before changing code:
   - auth refresh validation
   - auth test coverage
   - install UX refinement
   - field renaming cleanup

Do not mix all of these in one pass unless there is a strong reason.

## 10. Summary

The project is now in a usable integration phase, not a mock prototype phase.

What is already true:

- live ArcGIS data is wired in
- Hub OAuth is wired in
- sign-in and sign-out work
- installer OAuth exists
- the repo has current docs and env templates
- the build is clean

The next contributor should build on this baseline rather than re-deriving the architecture.