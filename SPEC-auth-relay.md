# Dev Spec: Agent OAuth Token Relay

**Status:** Approved for implementation  
**Priority:** High — blocks usable org-skill installs from AI agent clients  
**Author:** Joe / Architecture review  
**Date:** 2026-04-12

---

## Background

The Skill Hub lets users copy an `ARC_SKILL_INSTALL` block and paste it into an AI agent client (Claude Code, Codex, etc.) to install an ArcGIS skill. Many skills are org-shared, requiring an ArcGIS OAuth token to download.

The current installer (`scripts/skillhub-installer.mjs`) handles auth by spinning up a localhost server on port 8976 and waiting for ArcGIS to redirect back with an auth code. This works when running the CLI directly, but **breaks when an AI agent executes it**: the agent's localhost is inside a sandbox and the user's browser cannot reach it.

---

## Goal

Allow agent clients to complete ArcGIS OAuth on behalf of the user with minimal user interaction:

1. Agent shows the user **one link** to open in their browser
2. User logs in normally via ArcGIS
3. Agent **automatically** receives the token and continues the install

The user should not need to copy/paste any tokens or credentials.

---

## Solution Overview: Token Relay

The Skill Hub server acts as an OAuth broker. The agent requests a short-lived relay session from the Skill Hub, directs the user to it, the Skill Hub completes the OAuth dance with ArcGIS, stores the resulting token keyed to the session, and the agent polls until the token is ready.

```
Agent → POST /api/auth/relay/sessions         → gets session_id + auth_url
User opens auth_url in browser
Browser → Skill Hub → ArcGIS OAuth (normal PKCE flow)
ArcGIS → Skill Hub relay callback → token stored in memory
Agent polls GET /api/auth/relay/sessions/:id/token
Agent receives token → downloads zip → installs skill
```

---

## What Needs to Be Built

### 1. In-Memory Relay Store — `src/lib/relay-store.ts` (new file)

A module-level Map that holds relay sessions. No external dependency needed; this is an internal server and session counts will be very low.

**Interface:**

```ts
interface RelaySession {
  sessionId: string;
  portalUrl: string;
  state: string;          // CSRF — compared on relay callback
  codeVerifier: string;   // PKCE
  createdAt: number;
  expiresAt: number;      // 10-minute TTL from creation
  status: 'pending' | 'complete' | 'error';
  accessToken?: string;   // populated on success
  tokenExpiresAt?: number;
  errorMessage?: string;  // populated on failure
}
```

**Exports needed:**

```ts
export function createRelaySession(portalUrl: string): RelaySession
export function getRelaySession(sessionId: string): RelaySession | null
export function completeRelaySession(sessionId: string, accessToken: string, tokenExpiresAt: number): void
export function failRelaySession(sessionId: string, errorMessage: string): void
export function consumeRelayToken(sessionId: string): { accessToken: string; tokenExpiresAt: number; portalUrl: string } | null
export function purgeExpiredRelaySessions(): void
```

**Implementation notes:**
- `createRelaySession`: generates a random 32-byte hex `sessionId`, random 16-byte hex `state`, random 64-byte base64url `codeVerifier` (same pattern as `arcgis-auth.ts` line 121–122). Sets `expiresAt = Date.now() + 10 * 60 * 1000`.
- `consumeRelayToken`: returns the token data **and immediately deletes the entry** from the Map (single-use). Returns `null` if session not found, not complete, or expired.
- Call `purgeExpiredRelaySessions()` at the top of `createRelaySession` to prevent unbounded memory growth. Simple — just iterate the Map and delete entries where `expiresAt < Date.now()`.
- Do **not** log or expose the `accessToken` value anywhere.

---

### 2. New API Route — Create Relay Session

**File:** `src/app/api/auth/relay/sessions/route.ts`

```
POST /skill-hub/api/auth/relay/sessions
```

**Request:** No body needed.

**Response `200`:**
```json
{
  "sessionId": "abc123...",
  "authUrl": "https://your-skillhub-host/skill-hub/auth/relay?session=abc123..."
}
```

**Response `503`:** If `ARCGIS_OAUTH_CLIENT_ID` or `SKILL_HUB_SESSION_SECRET` are not configured.

**Implementation:**
1. Check `getArcGISAuthAvailability()` from `arcgis-auth.ts` — return 503 if not configured.
2. Determine `portalUrl` from `ARCGIS_PORTAL_URL` env var (fall back to `https://www.arcgis.com`).
3. Call `createRelaySession(portalUrl)`.
4. Build `authUrl` as an absolute URL to `/skill-hub/auth/relay?session={sessionId}` using the incoming `request` host.
5. Return `{ sessionId, authUrl }` as JSON.
6. No auth required on this endpoint — anyone can request a relay session (they're harmless without the user completing the login).

---

### 3. New API Route — Poll for Token

**File:** `src/app/api/auth/relay/sessions/[id]/token/route.ts`

```
GET /skill-hub/api/auth/relay/sessions/:id/token
```

**Responses:**

| Status | Meaning | Body |
|--------|---------|------|
| `202` | User hasn't logged in yet | `{ "status": "pending" }` |
| `200` | Token ready (first and only time) | `{ "accessToken": "...", "tokenExpiresAt": 1234567890, "portalUrl": "https://..." }` |
| `410` | Session expired or already consumed | `{ "error": "session_expired" }` |
| `404` | Session ID not found | `{ "error": "not_found" }` |

**Implementation:**
1. Read session via `getRelaySession(params.id)`.
2. If not found → 404.
3. If `status === 'error'` or `expiresAt < Date.now()` → 410 with appropriate error.
4. If `status === 'pending'` → 202.
5. If `status === 'complete'` → call `consumeRelayToken(params.id)` and return 200 with the token data. The session is deleted by `consumeRelayToken` — subsequent polls will get 404.

**No auth required.** The `sessionId` is a 32-byte random hex string — unguessable by brute force.

---

### 4. New API Route — Relay OAuth Callback

**File:** `src/app/api/auth/arcgis/relay-callback/route.ts`

```
GET /skill-hub/api/auth/arcgis/relay-callback?code=...&state=...&session_id=...
```

This is a **separate** callback URL from the existing `/api/auth/arcgis/callback`. ArcGIS will redirect here (instead of the regular callback) when a relay-initiated OAuth flow completes.

**Implementation:**
1. Read `code`, `state`, and `session_id` from query params.
2. Look up the relay session via `getRelaySession(session_id)`.
3. If not found or expired → render a simple HTML error page ("Login session expired. Please return to the agent and try again.").
4. If `state` does not match `session.state` → 400 error page (CSRF mismatch).
5. Exchange the code for a token using the ArcGIS token endpoint (same PKCE exchange as in `completeArcGISOAuth` in `arcgis-auth.ts` lines ~230–270, but without writing a session cookie). Use `session.codeVerifier` for the exchange.
6. On success: call `completeRelaySession(session_id, accessToken, tokenExpiresAt)`.
7. Redirect to `/skill-hub/auth/relay/done?session={session_id}` (the success page).
8. On token exchange failure: call `failRelaySession(session_id, errorMessage)`, redirect to error page.

**Note on redirect URI:** The redirect URI registered in ArcGIS for the relay callback must be `{SKILL_HUB_PUBLIC_URL}/skill-hub/api/auth/arcgis/relay-callback`. Add a new env var `ARCGIS_RELAY_REDIRECT_URI` for this (or derive it from `SKILL_HUB_PUBLIC_URL` if that env var exists). Alternatively, pass `session_id` in the OAuth `state` parameter and parse it on return — see Security Notes below.

---

### 5. New Page — Relay Auth Landing

**File:** `src/app/auth/relay/page.tsx`

```
GET /skill-hub/auth/relay?session={sessionId}
```

This is the URL the user opens in their browser when the agent tells them to log in.

**What it does:**
1. Read `session` query param. If missing → show error.
2. Look up the relay session (call a small server action or inline in the page component). If not found or expired → show error: "This login link has expired. Please return to the agent and try again."
3. If session is `complete` already → show "Already logged in. You can close this tab."
4. If session is `pending` → initiate ArcGIS OAuth. This means redirecting to ArcGIS `/oauth2/authorize` with:
   - `client_id` from env
   - `redirect_uri` = the relay callback URL (`/skill-hub/api/auth/arcgis/relay-callback`)
   - `state` = `{session.state}:{session.sessionId}` (encoding the session ID in state so the callback knows which relay session to complete — avoids needing an extra query param on the redirect URI)
   - `code_challenge` derived from `session.codeVerifier`
   - `code_challenge_method` = `S256`

**Also create:** `src/app/auth/relay/done/page.tsx`
- Simple page shown after successful login.
- Content: "You're logged in! Return to your agent — the installation will continue automatically." 
- No dynamic data needed.

---

### 6. Update `arcgis-auth.ts` — Extract Reusable Token Exchange

The token exchange logic (code → access token via PKCE) is currently embedded inside `completeArcGISOAuth`. The relay callback needs the same logic.

**Refactor:** Extract a new exported async function:

```ts
export async function exchangeAuthCode(options: {
  code: string;
  codeVerifier: string;
  portalUrl: string;
  redirectUri: string;
}): Promise<{ accessToken: string; expiresAt: number; refreshToken: string | null; username: string }>
```

Internally `completeArcGISOAuth` should call this function instead of doing the exchange inline. The relay callback route also calls this.

This is a pure refactor — no behavior change for the existing web auth flow.

---

### 7. Update `scripts/skillhub-installer.mjs` — Relay Auth Mode

The installer currently always uses `performOAuthLogin` (localhost callback). Add a new branch: when `install_mode === 'agent_client_oauth'` and `accessLevel !== 'public'`, use the relay flow instead.

**New function: `performRelayOAuthLogin(descriptor, args)`**

```
1. POST {skillHubUrl}/api/auth/relay/sessions
   → get { sessionId, authUrl }

2. Print to console:
   "This skill requires ArcGIS authentication.
    Open the link below in your browser to log in, then return here:
    
      {authUrl}
    
    Waiting for login..."

3. Poll GET {skillHubUrl}/api/auth/relay/sessions/{sessionId}/token
   every 3 seconds, up to the session TTL (10 minutes).
   - 202 → keep polling
   - 200 → extract { accessToken, tokenExpiresAt, portalUrl }, return token object
   - 410 → throw Error("Login session expired. Run the install again.")
   - Any network error → retry up to 3 times, then throw

4. Print: "Login successful. Downloading skill..."
5. Return { accessToken, expiresAt: tokenExpiresAt }
   (no refresh token available via relay — that's acceptable)
```

**Where to get `skillHubUrl`:**  
Add a new CLI flag `--skill-hub-url` and env var `SKILL_HUB_URL`. The `ARC_SKILL_INSTALL` block should also include this value (see section 8). Throw a clear error if not provided.

**Decision logic in `getAuthorizedTokens`:**

```js
// If running in relay mode (agent client context), skip the localhost server
if (descriptor.installMode === 'agent_client_oauth' && descriptor.accessLevel !== 'public') {
  const fresh = await performRelayOAuthLogin(descriptor, args);
  writeTokenCache(cachePath, fresh);
  return fresh;
}
// Fall through to existing performOAuthLogin (localhost callback) for direct CLI use
```

The existing localhost callback path (`performOAuthLogin`) should remain for users running the installer directly from their terminal.

---

### 8. Update `buildInstallPrompt` in `src/lib/arcgis.ts`

The natural language instructions at the bottom of the `ARC_SKILL_INSTALL` block (lines 56–60) tell the agent how to handle auth. Update them to describe the relay flow. Also add `skill_hub_url` to the block so the installer script knows where to call.

**Updated `buildInstallPrompt`:**

```ts
return [
  'ARC_SKILL_INSTALL',
  `portal_url=${portalUrl}`,
  `item_id=${skill.id}`,
  `item_url=${skill.installUrl}`,
  `item_title=${escapeInstallValue(skill.name)}`,
  `item_type=${escapeInstallValue(itemType)}`,
  `type_keywords=${escapeInstallValue(typeKeywords)}`,
  `access_level=${accessLevel}`,
  `skill_hub_url=${skillHubPublicUrl}`,   // NEW — needed for relay polling
  'auth=oauth',
  'install_mode=agent_client_oauth',
  'END_ARC_SKILL_INSTALL',
  '',
  'To install this ArcGIS skill:',
  '1. If access_level is "public", skip auth — download the item directly.',
  '2. If access_level is "org", "shared", or "private":',
  '   a. POST to {skill_hub_url}/api/auth/relay/sessions to create a login session.',
  '      Response: { sessionId, authUrl }',
  '   b. Tell the user: "Open this link to log in: {authUrl}"',
  '   c. Poll GET {skill_hub_url}/api/auth/relay/sessions/{sessionId}/token every 3 seconds.',
  '      202 = still waiting. 200 = token ready (use it and stop polling). 410 = expired.',
  '3. Download: GET {portal_url}/sharing/rest/content/items/{item_id}/data?token={accessToken}',
  '4. Extract the zip and place the skill files in the appropriate location for this agent client.',
  '5. Confirm to the user that the skill has been installed.',
  'Do not ask the user to paste tokens or passwords into chat.',
].join('\n');
```

**Where does `skillHubPublicUrl` come from?** Read from `SKILL_HUB_PUBLIC_URL` env var (e.g., `https://gis-internal.yourorg.com`). If not set, fall back to an empty string and let agents handle it (they can infer from context or prompt the user once).

Add `SKILL_HUB_PUBLIC_URL` to `.env.example` with a comment.

---

### 9. Update `install-descriptor.mjs` — Parse `skill_hub_url`

In `tryParseInstallBlock`, add:

```js
skillHubUrl: record.skill_hub_url || '',
```

And add it to `buildNormalizedDescriptor` and the returned object shape. Pass it through to `performRelayOAuthLogin` so the installer knows where to POST.

---

## New Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SKILL_HUB_PUBLIC_URL` | Recommended | The public base URL of the Skill Hub, e.g. `https://gis.yourorg.com`. Used to build relay `authUrl` and embedded in install prompts. |
| `ARCGIS_RELAY_REDIRECT_URI` | Optional | Full relay callback URL if it differs from `{SKILL_HUB_PUBLIC_URL}/skill-hub/api/auth/arcgis/relay-callback`. Most deployments won't need this. |

---

## Security Notes

- **Session IDs are single-use.** `consumeRelayToken` deletes the entry on first retrieval. A second poll returns 404.
- **10-minute TTL.** Relay sessions expire whether or not the user logs in. `purgeExpiredRelaySessions` cleans up on each `createRelaySession` call.
- **CSRF protection.** The `state` parameter in the OAuth flow encodes both the random state value and the `sessionId` (`{state}:{sessionId}`). The relay callback verifies the random state portion before completing the session.
- **Tokens never leave the server logs.** Ensure `accessToken` is never included in any `console.log`, Next.js error boundary output, or Sentry payload. Add a note in code comments.
- **No persistence.** Relay sessions live only in the server process memory. A server restart clears all pending sessions — the user would need to retry. This is acceptable for an internal deployment.
- **HTTPS only.** The relay callback and poll endpoints must only be served over HTTPS in production. No additional enforcement needed beyond the existing deployment setup.

---

## File Change Summary

| File | Change |
|------|--------|
| `src/lib/relay-store.ts` | **New** — in-memory relay session store |
| `src/app/api/auth/relay/sessions/route.ts` | **New** — POST create session |
| `src/app/api/auth/relay/sessions/[id]/token/route.ts` | **New** — GET poll for token |
| `src/app/api/auth/arcgis/relay-callback/route.ts` | **New** — ArcGIS OAuth relay callback |
| `src/app/auth/relay/page.tsx` | **New** — relay landing page (initiates OAuth) |
| `src/app/auth/relay/done/page.tsx` | **New** — "you're logged in" confirmation page |
| `src/lib/arcgis-auth.ts` | **Modify** — extract `exchangeAuthCode` as reusable export |
| `src/lib/arcgis.ts` | **Modify** — update `buildInstallPrompt` with relay instructions + `skill_hub_url` field |
| `scripts/skillhub-installer.mjs` | **Modify** — add `performRelayOAuthLogin`, branch on `install_mode` |
| `scripts/lib/install-descriptor.mjs` | **Modify** — parse and pass through `skill_hub_url` |
| `.env.example` | **Modify** — add `SKILL_HUB_PUBLIC_URL` and `ARCGIS_RELAY_REDIRECT_URI` |

---

## What NOT to Change

- The existing web OAuth session flow (`/api/auth/arcgis/login` → `/api/auth/arcgis/callback`) is untouched. This spec adds a parallel relay path, not a replacement.
- The existing localhost callback in `performOAuthLogin` stays. It remains the fallback for users running the installer directly (not via an agent).
- The `ARC_SKILL_INSTALL` block format is backward compatible — `skill_hub_url` is an additive field. Old installers that don't recognize it will ignore it.

---

## Acceptance Criteria

- [ ] User can paste an `ARC_SKILL_INSTALL` block (for an org-shared skill) into Claude Code; the agent presents a single clickable URL and waits.
- [ ] After the user logs in via that URL, the agent automatically receives a token and completes the install without further user input.
- [ ] If the user does not log in within 10 minutes, the agent receives a clear error and prompts to retry.
- [ ] The relay token is consumed exactly once — a second poll for the same session returns 404.
- [ ] Public skills (`access_level=public`) install with no auth prompt at all.
- [ ] The existing web sign-in flow on the Skill Hub UI is unaffected.
- [ ] `npm run type-check` and `npm run test:run` pass with no new failures.
