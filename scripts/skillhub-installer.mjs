#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { buildDescriptorFromArgs, parseInstallDescriptor, normalizePortalUrl } from './lib/install-descriptor.mjs';

const DEFAULT_PORTAL_URL = 'https://www.arcgis.com';
const DEFAULT_CALLBACK_PORT = 8976;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const command = args._[0] || 'install';

  if (command === 'help' || args.help) {
    printHelp();
    return;
  }

  if (command === 'parse') {
    const descriptor = await resolveDescriptor(args);
    console.log(JSON.stringify(descriptor, null, 2));
    return;
  }

  if (command === 'login') {
    const descriptor = {
      accessLevel: 'org',
      auth: 'oauth',
      installMode: 'agent_client_oauth',
      itemId: 'login-only',
      itemTitle: '',
      itemType: 'Code Sample',
      itemUrl: '',
      portalUrl: normalizePortalUrl(args.portal || process.env.ARCGIS_PORTAL_URL || DEFAULT_PORTAL_URL),
      typeKeywords: ['Agent Skill'],
    };
    const tokens = await getAuthorizedTokens(descriptor, args);
    console.log(JSON.stringify({
      expiresAt: tokens.expiresAt,
      portalUrl: descriptor.portalUrl,
      username: tokens.username || null,
    }, null, 2));
    return;
  }

  if (command !== 'install') {
    throw new Error(`Unknown command: ${command}`);
  }

  const descriptor = await resolveDescriptor(args);
  const tokens = await getAuthorizedTokens(descriptor, args);
  const metadata = await fetchItemMetadata(descriptor, tokens.accessToken);
  const installRoot = resolveInstallRoot(args, descriptor);

  if (existsSync(installRoot)) {
    if (!args.force) {
      throw new Error(`Install target already exists: ${installRoot}. Re-run with --force to replace it.`);
    }

    rmSync(installRoot, { recursive: true, force: true });
  }

  mkdirSync(installRoot, { recursive: true });

  const downloadPath = await downloadItemData(descriptor, tokens.accessToken, metadata, installRoot);
  const extracted = await extractOrCopyPackage(downloadPath, installRoot);

  const manifest = {
    accessLevel: descriptor.accessLevel,
    archivePath: downloadPath,
    extracted,
    installedAt: new Date().toISOString(),
    itemId: descriptor.itemId,
    itemTitle: metadata.title || descriptor.itemTitle,
    itemType: metadata.type || descriptor.itemType,
    itemUrl: descriptor.itemUrl || `${descriptor.portalUrl}/home/item.html?id=${descriptor.itemId}`,
    owner: metadata.owner || null,
    portalUrl: descriptor.portalUrl,
    targetPath: installRoot,
    typeKeywords: metadata.typeKeywords || descriptor.typeKeywords,
  };

  writeFileSync(join(installRoot, '.skillhub-install.json'), JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify(manifest, null, 2));
}

function parseCliArgs(argv) {
  const result = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }

    const key = camelCase(token.slice(2));
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }

  return result;
}

async function resolveDescriptor(args) {
  if (args.item) {
    return buildDescriptorFromArgs(args);
  }

  if (args.descriptorFile) {
    return parseInstallDescriptor(readFileSync(resolve(args.descriptorFile), 'utf8'));
  }

  if (args.stdin || !process.stdin.isTTY) {
    const text = await readStdin();
    return parseInstallDescriptor(text);
  }

  throw new Error('Provide --item <itemId>, --descriptor-file <path>, or pipe an ARC_SKILL_INSTALL block into stdin.');
}

async function getAuthorizedTokens(descriptor, args) {
  const cachePath = getTokenCachePath(descriptor.portalUrl);
  const cached = readTokenCache(cachePath);

  if (cached && isAccessTokenValid(cached)) {
    return cached;
  }

  if (cached?.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(descriptor.portalUrl, cached.refreshToken, args);
      writeTokenCache(cachePath, refreshed);
      return refreshed;
    } catch (error) {
      console.warn(`Refresh token failed: ${error.message}`);
    }
  }

  const fresh = await performOAuthLogin(descriptor.portalUrl, args);
  writeTokenCache(cachePath, fresh);
  return fresh;
}

function isAccessTokenValid(tokens) {
  return Boolean(tokens.accessToken && tokens.expiresAt && Date.now() + TOKEN_EXPIRY_BUFFER_MS < tokens.expiresAt);
}

function readTokenCache(cachePath) {
  if (!existsSync(cachePath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(cachePath, 'utf8'));
  return {
    accessToken: raw.accessToken,
    expiresAt: raw.expiresAt,
    refreshToken: raw.refreshToken,
    username: raw.username,
  };
}

function writeTokenCache(cachePath, tokens) {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

async function refreshAccessToken(portalUrl, refreshToken, args) {
  const form = new URLSearchParams({
    client_id: getClientId(args),
    f: 'json',
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const secret = getClientSecret(args);
  if (secret) {
    form.set('client_secret', secret);
  }

  const response = await fetch(`${portalUrl}/sharing/rest/oauth2/token`, {
    body: form,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  const json = await response.json();

  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `Token refresh failed with status ${response.status}.`);
  }

  return normalizeTokenResponse(json, refreshToken);
}

async function performOAuthLogin(portalUrl, args) {
  const port = Number(args.callbackPort || process.env.ARCGIS_OAUTH_CALLBACK_PORT || DEFAULT_CALLBACK_PORT);
  const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
  const state = randomBytes(16).toString('hex');
  const codeVerifier = randomBytes(64).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  const callbackPromise = waitForOAuthCallback(port, state);
  const authorizeUrl = new URL(`${portalUrl}/sharing/rest/oauth2/authorize`);

  authorizeUrl.searchParams.set('client_id', getClientId(args));
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('expiration', String(args.expiration || 20160));

  console.log(`Opening browser for ArcGIS OAuth login at ${portalUrl}...`);
  await openBrowser(authorizeUrl.toString());

  const callback = await callbackPromise;

  const form = new URLSearchParams({
    client_id: getClientId(args),
    code: callback.code,
    code_verifier: codeVerifier,
    f: 'json',
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const secret = getClientSecret(args);
  if (secret) {
    form.set('client_secret', secret);
  }

  const response = await fetch(`${portalUrl}/sharing/rest/oauth2/token`, {
    body: form,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  const json = await response.json();

  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `OAuth token exchange failed with status ${response.status}.`);
  }

  return normalizeTokenResponse(json);
}

function waitForOAuthCallback(port, expectedState) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);

      if (url.pathname !== '/oauth/callback') {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }

      if (url.searchParams.get('state') !== expectedState) {
        response.statusCode = 400;
        response.end('Invalid OAuth state.');
        server.close();
        rejectPromise(new Error('OAuth state mismatch.'));
        return;
      }

      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        response.statusCode = 400;
        response.end('ArcGIS login failed. You can close this tab.');
        server.close();
        rejectPromise(new Error(errorDescription || error));
        return;
      }

      const code = url.searchParams.get('code');

      if (!code) {
        response.statusCode = 400;
        response.end('Missing authorization code.');
        server.close();
        rejectPromise(new Error('Missing authorization code in OAuth callback.'));
        return;
      }

      response.statusCode = 200;
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end('<html><body><h1>ArcGIS login complete</h1><p>You can close this tab and return to the installer.</p></body></html>');
      server.close();
      resolvePromise({ code });
    });

    server.on('error', (error) => rejectPromise(error));
    server.listen(port, '127.0.0.1');
  });
}

function normalizeTokenResponse(json, existingRefreshToken) {
  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in || 1800) * 1000,
    refreshToken: json.refresh_token || existingRefreshToken || null,
    username: json.username || null,
  };
}

async function fetchItemMetadata(descriptor, accessToken) {
  const url = new URL(`${descriptor.portalUrl}/sharing/rest/content/items/${descriptor.itemId}`);
  url.searchParams.set('f', 'pjson');
  url.searchParams.set('token', accessToken);

  const response = await fetch(url, { cache: 'no-store' });
  const json = await response.json();

  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `Failed to fetch item metadata with status ${response.status}.`);
  }

  return json;
}

async function downloadItemData(descriptor, accessToken, metadata, installRoot) {
  const name = metadata.name || `${descriptor.itemId}.zip`;
  const extension = extname(name) || '.zip';
  const archiveName = name.endsWith(extension) ? name : `${name}${extension}`;
  const downloadPath = join(installRoot, archiveName);
  const url = new URL(`${descriptor.portalUrl}/sharing/rest/content/items/${descriptor.itemId}/data`);
  url.searchParams.set('token', accessToken);

  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download item data with status ${response.status}.`);
  }

  await pipeline(response.body, createWriteStream(downloadPath));
  return downloadPath;
}

async function extractOrCopyPackage(downloadPath, installRoot) {
  const extension = extname(downloadPath).toLowerCase();
  const extractionDir = join(installRoot, 'package');

  mkdirSync(extractionDir, { recursive: true });

  if (extension === '.zip') {
    await extractZip(downloadPath, extractionDir);
    return true;
  }

  return false;
}

async function extractZip(archivePath, targetDir) {
  if (process.platform === 'darwin') {
    await spawnCommand('ditto', ['-x', '-k', archivePath, targetDir]);
    return;
  }

  if (process.platform === 'win32') {
    await spawnCommand('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${targetDir}' -Force`]);
    return;
  }

  await spawnCommand('unzip', ['-o', archivePath, '-d', targetDir]);
}

function spawnCommand(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} exited with code ${code}.`));
    });
  });
}

async function openBrowser(url) {
  if (process.platform === 'darwin') {
    await spawnCommand('open', [url]);
    return;
  }

  if (process.platform === 'win32') {
    await spawnCommand('cmd', ['/c', 'start', '', url]);
    return;
  }

  await spawnCommand('xdg-open', [url]);
}

function resolveInstallRoot(args, descriptor) {
  const baseDir = args.target || process.env.ARCGIS_INSTALL_ROOT || join(homedir(), '.skillhub', 'skills');
  return resolve(baseDir, descriptor.itemId);
}

function getTokenCachePath(portalUrl) {
  const host = new URL(portalUrl).host.replace(/[^a-z0-9.-]/gi, '_');
  return join(homedir(), '.skillhub', 'auth', `${host}.json`);
}

function getClientId(args) {
  const clientId = args.clientId || process.env.ARCGIS_OAUTH_CLIENT_ID;

  if (!clientId) {
    throw new Error('Missing ArcGIS OAuth client id. Set ARCGIS_OAUTH_CLIENT_ID or pass --client-id.');
  }

  return clientId;
}

function getClientSecret(args) {
  return args.clientSecret || process.env.ARCGIS_OAUTH_CLIENT_SECRET || '';
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function printHelp() {
  console.log(`skillhub-installer\n\nCommands:\n  install [--item <id> | --descriptor-file <path> | --stdin]\n  login [--portal <url>]\n  parse [--descriptor-file <path> | --stdin]\n\nOptions:\n  --portal <url>            ArcGIS portal URL (default: https://www.arcgis.com)\n  --client-id <id>          ArcGIS OAuth client id\n  --client-secret <secret>  Optional ArcGIS OAuth client secret\n  --callback-port <port>    Localhost callback port (default: 8976)\n  --target <dir>            Install root (default: ~/.skillhub/skills)\n  --force                   Replace an existing install target\n\nExamples:\n  pbpaste | node scripts/skillhub-installer.mjs install --stdin\n  node scripts/skillhub-installer.mjs install --item ba702393c4db4bdbacc8b3f2eb9c0449 --portal https://www.arcgis.com\n  node scripts/skillhub-installer.mjs login --portal https://www.arcgis.com`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
