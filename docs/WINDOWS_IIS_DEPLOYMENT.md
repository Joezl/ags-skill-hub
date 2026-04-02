# Skill Hub Windows IIS Deployment Summary

## Purpose

This document records the working deployment setup for serving Skill Hub from an internal Windows server over HTTPS with IIS reverse proxy and ArcGIS Online OAuth working end to end.

This was verified against:

- Server host: `earth-server.esri.com`
- Public app URL: `https://earth-server.esri.com/skill-hub`
- Internal Node port: `43117`
- App folder: `C:\webapps\ags-skill-hub`
- IIS site folder: `C:\inetpub\ags-skill-hub`
- Windows service name: `ags-skill-hub`

## Final Working Architecture

1. IIS terminates HTTPS on `https://earth-server.esri.com`.
2. IIS reverse proxies requests to Next.js running on `http://127.0.0.1:43117`.
3. Next.js runs as a Windows service through NSSM.
4. ArcGIS OAuth callback points to the IIS HTTPS URL, not the internal Node port.

## Minimal Files Needed On Server

For a build-from-source deployment, the smallest practical set copied to the server was:

- `src/`
- `public/`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `next-env.d.ts`
- `postcss.config.mjs`
- `.env.local`

Not required for runtime deployment:

- `discussion_summary.md`
- `docs/`
- tests
- `.git`
- `node_modules`
- old build output folders

## Server Paths

- App root: `C:\webapps\ags-skill-hub`
- IIS site root: `C:\inetpub\ags-skill-hub`

## Environment Variables

The production `.env.local` file on the server should live at:

- `C:\webapps\ags-skill-hub\.env.local`

Important values:

```env
ARCGIS_PORTAL_URL=https://www.arcgis.com
ARCGIS_ORG_ID=<your-org-id>
ARCGIS_MAX_ITEMS=100
ARCGIS_OAUTH_CLIENT_ID=<your-client-id>
ARCGIS_OAUTH_CLIENT_SECRET=<your-client-secret-if-used>
SKILL_HUB_SESSION_SECRET=<your-session-secret>
ARCGIS_OAUTH_REDIRECT_URI=https://earth-server.esri.com/skill-hub/api/auth/arcgis/callback
```

Important notes:

- `ARCGIS_ACCESS_TOKEN` is not required for normal web app deployment and should not be kept in server env unless there is a very specific reason.
- `ARCGIS_OAUTH_REDIRECT_URI` should be explicitly set for server deployment.
- The redirect URI must exactly match the ArcGIS Online OAuth app registration.

## ArcGIS Online App Settings

Working values:

- Application URL: `https://earth-server.esri.com/skill-hub`
- Redirect URI: `https://earth-server.esri.com/skill-hub/api/auth/arcgis/callback`

Entries that caused confusion or should be removed for this web app deployment:

- `http://localhost:...`
- `https://127.0.0.1:8976/oauth/callback`
- `urn:ietf:wg:oauth:2.0:oob`

These loopback and out-of-band values are appropriate for local CLI/desktop OAuth flows, not this server-hosted web application.

## Windows Service Setup

The app was run via NSSM as service `ags-skill-hub`.

Final working `AppParameters`:

```text
node_modules\next\dist\bin\next start --port 43117 --hostname 0.0.0.0
```

Why `--hostname 0.0.0.0` mattered:

- `--hostname earth-server.esri.com` caused the local IIS proxy target `127.0.0.1:43117` to fail.
- `0.0.0.0` allows local proxy access while the app still emits the correct public redirect host when the rest of the proxy and env settings are correct.

Useful NSSM commands:

```powershell
nssm get ags-skill-hub AppDirectory
nssm get ags-skill-hub AppParameters
nssm get ags-skill-hub AppEnvironmentExtra
nssm restart ags-skill-hub
```

## IIS Requirements

Required Windows/IIS components:

- IIS Web Server
- URL Rewrite
- Application Request Routing (ARR)

Useful install command for IIS on the server:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole -All
```

HTTPS certificate used:

- Temporary self-signed certificate for `earth-server.esri.com` was sufficient for testing

Example command used:

```powershell
New-SelfSignedCertificate -DnsName "earth-server.esri.com" -CertStoreLocation "cert:\LocalMachine\My"
```

## IIS Reverse Proxy Configuration

The IIS site was created for:

- Host: `earth-server.esri.com`
- Port: `443`
- Protocol: `https`

ARR proxy was enabled.

Working `web.config` shape:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <allowedServerVariables>
        <add name="HTTP_X_FORWARDED_PROTO" />
        <add name="HTTP_X_FORWARDED_HOST" />
        <add name="HTTP_X_FORWARDED_PORT" />
      </allowedServerVariables>
      <rules>
        <rule name="ReverseProxyInboundRule1" stopProcessing="true">
          <match url="(.*)" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
            <set name="HTTP_X_FORWARDED_HOST" value="{HTTP_HOST}" />
            <set name="HTTP_X_FORWARDED_PORT" value="443" />
          </serverVariables>
          <action type="Rewrite" url="http://127.0.0.1:43117/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

Important ARR settings that mattered:

- Reverse rewrite host in response headers had to be disabled.
- Preserve host header had to be enabled at ARR level.

Useful commands:

```powershell
& $env:windir\System32\inetsrv\appcmd.exe set config -section:system.webServer/proxy /preserveHostHeader:"True" /commit:apphost
& $env:windir\System32\inetsrv\appcmd.exe set config -section:system.webServer/proxy /reverseRewriteHostInResponseHeaders:"False" /commit:apphost
```

Allowed server variables were also needed for the rewrite rule:

```powershell
& $env:windir\System32\inetsrv\appcmd.exe set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='HTTP_X_FORWARDED_PROTO']" /commit:apphost
& $env:windir\System32\inetsrv\appcmd.exe set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='HTTP_X_FORWARDED_HOST']" /commit:apphost
& $env:windir\System32\inetsrv\appcmd.exe set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='HTTP_X_FORWARDED_PORT']" /commit:apphost
```

## Application Code Changes Required During Deployment

Two application-side changes were needed to make the deployment reliable behind IIS:

### 1. Trust proxy host headers in Next config

`next.config.ts` was updated so the production build trusts proxied host headers.

### 2. ArcGIS auth redirect handling was hardened

`src/lib/arcgis-auth.ts` was updated so auth redirects use the configured public origin derived from `ARCGIS_OAUTH_REDIRECT_URI` rather than depending only on inferred request origin.

These changes were necessary because the app initially emitted `localhost` callback and logout redirects behind IIS.

## Main Problems Encountered

### Problem 1: App worked over HTTP but ArcGIS sign-in failed

Observed behavior:

- ArcGIS login started
- callback ended with state mismatch

Root cause:

- production cookies were marked `Secure`
- app was accessed over plain HTTP
- browser did not send the transient OAuth cookies back

Fix:

- move app behind HTTPS on IIS

### Problem 2: ArcGIS redirected to `localhost`

Observed behavior:

- login or logout redirected to `http://localhost:43117/skill-hub`

Root causes encountered during debugging:

- old `ARCGIS_OAUTH_REDIRECT_URI` in service env
- stale ArcGIS app redirect settings
- IIS proxy response rewriting
- Next.js generating redirects from proxy-facing host info
- service host binding choice interacting badly with local proxy target

Fixes that mattered:

- correct `ARCGIS_OAUTH_REDIRECT_URI`
- correct ArcGIS Online application URL and callback URL
- disable ARR reverse host rewrite
- preserve host header
- set forwarded host/proto/port variables in IIS
- run Next with `--hostname 0.0.0.0`
- rebuild after auth code changes

### Problem 3: OAuth authorize URL used `earth-server.esri.com/sharing/...` instead of `www.arcgis.com/sharing/...`

Observed behavior:

- clicking sign-in opened the app host under `/sharing/rest/oauth2/authorize`

Root cause:

- IIS/ARR response rewriting confused the outgoing redirect host

Fix:

- disable reverse rewrite host in response headers
- ensure `ARCGIS_PORTAL_URL=https://www.arcgis.com`

### Problem 4: UI lost styling after moving behind IIS

Observed behavior:

- page loaded with broken or missing styles

This happened during the proxy reconfiguration period and was tied to reverse proxy/static asset handling while the deployment was in flux.

Final state after IIS and app fixes:

- UI rendered correctly again

### Problem 5: 502 from IIS after changing Node hostname

Observed behavior:

- IIS returned 502 after changing Next hostname

Root cause:

- app was no longer listening in a way reachable by `127.0.0.1:43117`

Fix:

- run Next with `--hostname 0.0.0.0`

## Useful Verification Commands

Check what service env is actually using:

```powershell
nssm get ags-skill-hub AppEnvironmentExtra
```

Check what AppParameters are actually configured:

```powershell
nssm get ags-skill-hub AppParameters
```

Check whether the app is really listening:

```powershell
Get-NetTCPConnection -LocalPort 43117 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId = $_" | Select-Object ProcessId, Name, CommandLine }
```

Check logout redirect behavior directly from Node:

```powershell
curl.exe -k -I http://127.0.0.1:43117/skill-hub/api/auth/arcgis/logout
```

Expected final result:

- `Location: https://earth-server.esri.com/skill-hub`

Check proxy path externally:

```powershell
curl.exe -k -I https://earth-server.esri.com/skill-hub/api/auth/arcgis/logout
```

## Final Working Behavior

Verified at the end of deployment:

- `https://earth-server.esri.com/skill-hub` loads successfully
- UI styling renders correctly
- ArcGIS sign-in works
- ArcGIS sign-out works
- internal users can reach the site from another machine

## Lessons Learned

1. For this app, ArcGIS OAuth should be treated as HTTPS-only in production because of secure cookies.
2. Proxy host/header behavior matters as much as app env values for OAuth flows.
3. Do not rely on inferred callback URLs in proxied production setups. Set `ARCGIS_OAUTH_REDIRECT_URI` explicitly.
4. Use a separate OAuth app configuration for local CLI/desktop flows versus server-hosted web app flows.
5. When debugging redirect issues, `curl -I` against login/logout endpoints is faster than repeated browser testing.
6. NSSM settings can override or outlive file-based config assumptions. Always inspect service parameters and service env directly.
7. After config/code changes affecting Next runtime behavior, rebuild from the server app folder and confirm the generated build output reflects the change.

## Recommended Follow-Up

1. Rotate any tokens or secrets that were exposed during deployment troubleshooting.
2. Replace the self-signed certificate with a trusted internal or enterprise certificate if this will remain in active use.
3. Keep this document updated if the hostname, port, IIS config, or OAuth app settings change.