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

export function buildInstallPrompt(skill: Pick<Skill, 'access' | 'installUrl' | 'name' | 'portalUrl' | 'type' | 'typeKeywords'> & { id: string }): string {
  const typeKeywords = skill.typeKeywords?.join(', ') || 'Agent Skill';

  return [
    'Install this ArcGIS agent skill from ArcGIS Online.',
    '',
    `Skill title: ${skill.name}`,
    `Portal URL: ${skill.portalUrl || DEFAULT_PORTAL_URL}`,
    `Item ID: ${skill.id}`,
    `Item URL: ${skill.installUrl}`,
    `Expected item type: ${skill.type || 'Code Sample'}`,
    `Expected type keywords: ${typeKeywords}`,
    `Access level: ${skill.access || 'org'}`,
    '',
    'Instructions:',
    '1. Resolve this ArcGIS Online item and inspect its metadata and packaged item data.',
    '2. If the item is not publicly accessible, ask the user to authenticate with ArcGIS Online.',
    '3. Prefer an existing ArcGIS session or OAuth browser login flow.',
    '4. If interactive login is unavailable, ask for a temporary access token instead of a raw password when possible.',
    '5. Download the package and determine the correct installation steps from the packaged skill contents.',
    '6. If the package cannot be accessed or parsed, explain the blocker and ask for the next safest step.',
  ].join('\n');
}

export function inferSkillCategory(item: Pick<ArcGISSearchItem, 'description' | 'snippet' | 'tags' | 'title'>): Category {
  const haystack = [item.title, item.description, item.snippet, item.tags?.join(' ') || '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

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

export async function getArcGISSkills(): Promise<Skill[]> {
  const maxItems = getMaxItems();
  const items = await searchArcGISItems(maxItems);

  return items
    .map((item) => mapArcGISItemToSkill(item))
    .sort((left, right) => right.downloads - left.downloads);
}

async function searchArcGISItems(maxItems: number): Promise<ArcGISSearchItem[]> {
  const token = getAccessToken();
  const query = getItemQuery();
  const portalUrl = getPortalUrl();
  const results: ArcGISSearchItem[] = [];
  let nextStart = 1;

  while (nextStart !== -1 && results.length < maxItems) {
    const pageSize = Math.min(100, maxItems - results.length);
    const search = await fetchArcGISJson<ArcGISSearchResponse>(`${portalUrl}/sharing/rest/search`, {
      f: 'pjson',
      num: String(pageSize),
      q: query,
      sortField: 'modified',
      sortOrder: 'desc',
      start: String(nextStart),
      token,
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

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function getAccessToken(): string {
  const token = process.env.ARCGIS_ACCESS_TOKEN?.trim();

  if (!token) {
    throw new Error('Missing ARCGIS_ACCESS_TOKEN in the local environment.');
  }

  return token;
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