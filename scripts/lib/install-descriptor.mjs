const START_MARKER = 'ARC_SKILL_INSTALL';
const END_MARKER = 'END_ARC_SKILL_INSTALL';

export function parseInstallDescriptor(text) {
  if (!text || !text.trim()) {
    throw new Error('Install descriptor is empty.');
  }

  const blockDescriptor = tryParseInstallBlock(text);

  if (blockDescriptor) {
    return blockDescriptor;
  }

  const legacyDescriptor = tryParseLegacyPrompt(text);

  if (legacyDescriptor) {
    return legacyDescriptor;
  }

  const urlDescriptor = tryParseArcGISItemUrl(text);

  if (urlDescriptor) {
    return urlDescriptor;
  }

  throw new Error('Could not find a valid install descriptor. Expected an ARC_SKILL_INSTALL block, a legacy ArcGIS install prompt, or an ArcGIS item URL.');
}

function tryParseInstallBlock(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const startIndex = lines.findIndex((line) => line.trim() === START_MARKER);
  const endIndex = lines.findIndex((line, index) => index > startIndex && line.trim() === END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  const record = {};

  for (const rawLine of lines.slice(startIndex + 1, endIndex)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key) {
      record[key] = value;
    }
  }

  if (!record.item_id) {
    throw new Error('Install descriptor is missing item_id.');
  }

  return buildNormalizedDescriptor({
    accessLevel: record.access_level || 'org',
    auth: record.auth || 'oauth',
    installMode: record.install_mode || 'agent_client_oauth',
    itemId: record.item_id,
    itemTitle: record.item_title || '',
    itemType: record.item_type || 'Code Sample',
    itemUrl: record.item_url || '',
    portalUrl: normalizePortalUrl(record.portal_url || 'https://www.arcgis.com'),
    typeKeywords: splitList(record.type_keywords),
  });
}

export function buildDescriptorFromArgs(args) {
  if (!args.item) {
    throw new Error('Missing --item argument.');
  }

  return buildNormalizedDescriptor({
    accessLevel: args.accessLevel || 'org',
    auth: 'oauth',
    installMode: 'agent_client_oauth',
    itemId: args.item,
    itemTitle: args.itemTitle || '',
    itemType: args.itemType || 'Code Sample',
    itemUrl: args.itemUrl || `${normalizePortalUrl(args.portal || 'https://www.arcgis.com')}/home/item.html?id=${args.item}`,
    portalUrl: normalizePortalUrl(args.portal || 'https://www.arcgis.com'),
    typeKeywords: splitList(args.typeKeywords || 'Agent Skill'),
  });
}

export function maybeExtractDescriptor(text) {
  return parseInstallDescriptor(text);
}

export function normalizePortalUrl(value) {
  return value.replace(/\/$/, '');
}

function splitList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildNormalizedDescriptor(input) {
  return {
    accessLevel: input.accessLevel || 'org',
    auth: input.auth || 'oauth',
    installMode: input.installMode || 'agent_client_oauth',
    itemId: input.itemId,
    itemTitle: input.itemTitle || '',
    itemType: input.itemType || 'Code Sample',
    itemUrl: input.itemUrl || '',
    portalUrl: normalizePortalUrl(input.portalUrl || 'https://www.arcgis.com'),
    typeKeywords: input.typeKeywords?.length ? input.typeKeywords : ['Agent Skill'],
  };
}

function tryParseLegacyPrompt(text) {
  const itemId = extractValue(text, /^Item ID:\s*(.+)$/im);
  const itemUrl = extractValue(text, /^Item URL:\s*(.+)$/im) || extractValue(text, /^Download URL:\s*(.+)$/im);

  if (!itemId && !itemUrl) {
    return null;
  }

  const resolvedUrl = itemUrl || '';
  const portalUrl = extractValue(text, /^Portal URL:\s*(.+)$/im)
    || extractPortalUrlFromItemUrl(resolvedUrl)
    || 'https://www.arcgis.com';

  return buildNormalizedDescriptor({
    accessLevel: normalizeLegacyAccess(extractValue(text, /^Access level:\s*(.+)$/im) || extractValue(text, /^Access Level:\s*(.+)$/im)),
    auth: 'oauth',
    installMode: 'agent_client_oauth',
    itemId: itemId || extractItemIdFromUrl(resolvedUrl),
    itemTitle: extractValue(text, /^Skill title:\s*(.+)$/im) || extractValue(text, /^Title:\s*(.+)$/im) || '',
    itemType: extractValue(text, /^Expected item type:\s*(.+)$/im) || extractValue(text, /^Type:\s*(.+)$/im) || 'Code Sample',
    itemUrl: normalizeLegacyItemUrl(resolvedUrl),
    portalUrl,
    typeKeywords: splitList(extractValue(text, /^Expected type keywords:\s*(.+)$/im) || 'Agent Skill'),
  });
}

function tryParseArcGISItemUrl(text) {
  const match = text.match(/https:\/\/[^\s]+\/home\/item\.html\?id=([a-z0-9]+)/i)
    || text.match(/https:\/\/[^\s]+\/sharing\/rest\/content\/items\/([a-z0-9]+)/i)
    || text.match(/https:\/\/[^\s]+\/sharing\/rest\/content\/items\/([a-z0-9]+)\/data/i);

  if (!match) {
    return null;
  }

  const fullMatch = match[0];
  const itemId = match[1];
  const portalUrl = extractPortalUrlFromItemUrl(fullMatch) || 'https://www.arcgis.com';

  return buildNormalizedDescriptor({
    accessLevel: 'org',
    auth: 'oauth',
    installMode: 'agent_client_oauth',
    itemId,
    itemTitle: '',
    itemType: 'Code Sample',
    itemUrl: `${portalUrl}/home/item.html?id=${itemId}`,
    portalUrl,
    typeKeywords: ['Agent Skill'],
  });
}

function extractValue(text, regex) {
  const match = text.match(regex);
  return match?.[1]?.trim() || '';
}

function extractPortalUrlFromItemUrl(value) {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

function extractItemIdFromUrl(value) {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    return url.searchParams.get('id') || value.match(/\/items\/([a-z0-9]+)/i)?.[1] || '';
  } catch {
    return value.match(/id=([a-z0-9]+)/i)?.[1] || value.match(/\/items\/([a-z0-9]+)/i)?.[1] || '';
  }
}

function normalizeLegacyAccess(value) {
  const normalized = value.toLowerCase();

  if (normalized.includes('org') || normalized.includes('organization')) {
    return 'org';
  }

  if (normalized.includes('public')) {
    return 'public';
  }

  if (normalized.includes('private')) {
    return 'private';
  }

  if (normalized.includes('shared')) {
    return 'shared';
  }

  return 'org';
}

function normalizeLegacyItemUrl(value) {
  if (!value) {
    return '';
  }

  if (/\/home\/item\.html\?id=/i.test(value)) {
    return value;
  }

  const itemId = extractItemIdFromUrl(value);
  const portalUrl = extractPortalUrlFromItemUrl(value);

  if (!itemId || !portalUrl) {
    return value;
  }

  return `${portalUrl}/home/item.html?id=${itemId}`;
}
