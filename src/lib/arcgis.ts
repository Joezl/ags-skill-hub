import type { AccessLevel, Category, Skill } from '@/types/skill';

interface ArcGISSearchResponse {
  nextStart: number;
  results: ArcGISSearchItem[];
  total: number;
}

export interface ArcGISSearchItem {
  access?: string;
  avgRating?: number;
  created?: number;
  description?: string | null;
  id: string;
  modified?: number;
  name?: string | null;
  numRatings?: number;
  numViews?: number;
  owner: string;
  snippet?: string | null;
  tags?: string[];
  thumbnail?: string | null;
  title?: string | null;
  type?: string;
  typeKeywords?: string[];
}

const DEFAULT_PORTAL_URL = 'https://www.arcgis.com';
const DEFAULT_ITEM_QUERY = 'type:"Code Sample" AND typekeywords:"Agent Skill"';
const DEFAULT_MAX_ITEMS = 100;

interface ArcGISSkillQueryOptions {
  accessToken?: string | null;
  portalUrl?: string;
}

export function buildInstallPrompt(skill: Pick<Skill, 'access' | 'installUrl' | 'name' | 'portalUrl' | 'type' | 'typeKeywords'> & { id: string }): string {
  const portalUrl = skill.portalUrl || DEFAULT_PORTAL_URL;
  const itemType = skill.type || 'Code Sample';
  const typeKeywords = skill.typeKeywords?.join(', ') || 'Agent Skill';
  const accessLevel = skill.access || 'org';

  return [
    'ARC_SKILL_INSTALL',
    `portal_url=${portalUrl}`,
    `item_id=${skill.id}`,
    `item_url=${skill.installUrl}`,
    `item_title=${escapeInstallValue(skill.name)}`,
    `item_type=${escapeInstallValue(itemType)}`,
    `type_keywords=${escapeInstallValue(typeKeywords)}`,
    `access_level=${accessLevel}`,
    'auth=oauth',
    'install_mode=agent_client_oauth',
    'END_ARC_SKILL_INSTALL',
    '',
    'Install this ArcGIS skill using the client or agent runtime.',
    'If ArcGIS Online authentication is required, open a browser OAuth login flow for the user.',
    'After login succeeds, exchange the authorization result for a valid token, download the item package, inspect its contents, and install the skill locally.',
    'Do not ask the user to paste a raw password into chat. Prefer the existing ArcGIS browser session, OAuth login, or a cached token handled by the client runtime.',
  ].join('\n');
}

export function inferSkillCategory(item: Pick<ArcGISSearchItem, 'description' | 'snippet' | 'tags' | 'title'>): Category {
  const haystack = [item.title, item.description, item.snippet, item.tags?.join(' ') || '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (containsAny(haystack, ['devops', 'deployment', 'infrastructure', 'ci/cd', 'pipeline', 'operations'])) {
    return 'DevOps';
  }

  if (containsAny(haystack, ['meeting', 'notes', 'productivity', 'schedule', 'task'])) {
    return 'Productivity';
  }

  if (containsAny(haystack, ['community', 'feedback', 'reply', 'teams', 'communication', 'message'])) {
    return 'Communication';
  }

  if (containsAny(haystack, ['accessibility', 'smoke test', 'testing', 'test', 'wcag', 'ada', 'automation'])) {
    return 'Testing';
  }

  if (containsAny(haystack, ['documentation', 'metadata', 'explain', 'concept', 'summary', 'story'])) {
    return 'Documentation';
  }

  if (containsAny(haystack, ['git', 'github', 'package', 'upload', 'install', 'update', 'developer'])) {
    return 'Development';
  }

  if (containsAny(haystack, ['ai', 'llm', 'copilot', 'claude', 'codex', 'agent'])) {
    return 'AI';
  }

  return 'Utilities';
}

export function mapArcGISItemToSkill(item: ArcGISSearchItem, portalUrl = getPortalUrl()): Skill {
  const name = cleanText(item.title) || cleanText(item.name) || 'Untitled skill';
  const snippet = cleanText(item.snippet);
  const description = pickDescription(item.description, item.snippet);
  const installUrl = `${portalUrl}/home/item.html?id=${item.id}`;
  const access = normalizeAccess(item.access);

  const skill: Skill = {
    id: item.id,
    name,
    description,
    category: inferSkillCategory(item),
    author: item.owner,
    installUrl,
    installPrompt: '',
    downloads: item.numViews ?? 0,
    stars: item.numRatings ?? 0,
    updatedAt: new Date(item.modified ?? item.created ?? Date.now()).toISOString(),
    tags: normalizeTags(item.tags),
    access,
    averageRating: item.avgRating ?? 0,
    portalUrl,
    snippet,
    type: item.type || 'Code Sample',
    typeKeywords: item.typeKeywords || ['Agent Skill'],
    thumbnailUrl: buildThumbnailUrl(item, portalUrl, access),
  };

  skill.installPrompt = buildInstallPrompt(skill);

  return skill;
}

export async function getArcGISSkills(options: ArcGISSkillQueryOptions = {}): Promise<Skill[]> {
  const maxItems = getMaxItems();
  const portalUrl = normalizePortalUrl(options.portalUrl || getPortalUrl());
  const items = await searchArcGISItems(maxItems, {
    accessToken: options.accessToken || undefined,
    portalUrl,
  });

  return items
    .map((item) => mapArcGISItemToSkill(item, portalUrl))
    .sort((left, right) => right.downloads - left.downloads);
}

async function searchArcGISItems(maxItems: number, options: { accessToken?: string; portalUrl: string }): Promise<ArcGISSearchItem[]> {
  const query = getItemQuery();
  const results: ArcGISSearchItem[] = [];
  let nextStart = 1;

  while (nextStart !== -1 && results.length < maxItems) {
    const pageSize = Math.min(100, maxItems - results.length);
    const search = await fetchArcGISJson<ArcGISSearchResponse>(`${options.portalUrl}/sharing/rest/search`, {
      f: 'pjson',
      num: String(pageSize),
      q: query,
      sortField: 'modified',
      sortOrder: 'desc',
      start: String(nextStart),
      ...(options.accessToken ? { token: options.accessToken } : {}),
    });

    results.push(...search.results);
    nextStart = search.nextStart;
  }

  return results;
}

async function fetchArcGISJson<T>(url: string, params: Record<string, string>): Promise<T> {
  const searchParams = new URLSearchParams(params);
  const response = await fetch(`${url}?${searchParams.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`ArcGIS request failed with status ${response.status}.`);
  }

  const json = (await response.json()) as T & {
    error?: {
      message?: string;
    };
  };

  if (json.error?.message) {
    throw new Error(`ArcGIS request failed: ${json.error.message}`);
  }

  return json;
}

function buildThumbnailUrl(item: ArcGISSearchItem, portalUrl: string, access: AccessLevel): string | undefined {
  if (!item.thumbnail || access !== 'public') {
    return undefined;
  }

  return `${portalUrl}/sharing/rest/content/items/${item.id}/info/${item.thumbnail}`;
}

function cleanText(value?: string | null): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeInstallValue(value: string): string {
  return value.replace(/\r?\n+/g, ' ').trim();
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function getItemQuery(): string {
  const explicitQuery = process.env.ARCGIS_AGENT_SKILL_QUERY?.trim();

  if (explicitQuery) {
    return explicitQuery;
  }

  const orgId = process.env.ARCGIS_ORG_ID?.trim();

  if (!orgId) {
    throw new Error('Missing ARCGIS_ORG_ID or ARCGIS_AGENT_SKILL_QUERY in the local environment.');
  }

  return `orgid:${orgId} AND ${DEFAULT_ITEM_QUERY}`;
}

function getMaxItems(): number {
  const value = Number(process.env.ARCGIS_MAX_ITEMS || DEFAULT_MAX_ITEMS);

  if (Number.isNaN(value) || value < 1) {
    return DEFAULT_MAX_ITEMS;
  }

  return Math.min(1000, Math.floor(value));
}

function getPortalUrl(): string {
  return (process.env.ARCGIS_PORTAL_URL || DEFAULT_PORTAL_URL).replace(/\/$/, '');
}

function normalizePortalUrl(value: string): string {
  return value.replace(/\/$/, '');
}

function normalizeAccess(value?: string): AccessLevel {
  switch (value) {
    case 'private':
    case 'shared':
    case 'org':
    case 'public':
      return value;
    default:
      return 'org';
  }
}

function normalizeTags(tags?: string[]): string[] {
  const uniqueTags = new Set(
    (tags || [])
      .map((tag) => cleanText(tag))
      .filter(Boolean)
  );

  return uniqueTags.size > 0 ? Array.from(uniqueTags) : ['Agent Skill'];
}

function pickDescription(description?: string | null, snippet?: string | null): string {
  const cleanedDescription = cleanText(description);
  const cleanedSnippet = cleanText(snippet);

  if (looksStructuredDescription(description) && cleanedSnippet) {
    return cleanedSnippet;
  }

  if (cleanedDescription) {
    return cleanedDescription;
  }

  if (cleanedSnippet) {
    return cleanedSnippet;
  }

  return 'No description available.';
}

function looksStructuredDescription(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  return trimmed.startsWith('---') || trimmed.includes('\n# ') || trimmed.includes('\n## ');
}