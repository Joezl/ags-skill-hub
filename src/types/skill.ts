export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  authorAvatar?: string;
  installUrl: string;
  installPrompt: string;
  downloads: number;
  stars: number;
  updatedAt: string;
  tags: string[];
  access?: AccessLevel;
  averageRating?: number;
  portalUrl?: string;
  snippet?: string;
  thumbnailUrl?: string;
  type?: string;
  typeKeywords?: string[];
}

export type AccessLevel = 'private' | 'shared' | 'org' | 'public';

export type SortOption = 'downloads' | 'updatedAt' | 'name' | 'stars';

export const CATEGORIES = [
  'All',
  'Development',
  'Productivity',
  'AI',
  'DevOps',
  'Testing',
  'Documentation',
  'Utilities',
  'Communication',
] as const;

export type Category = (typeof CATEGORIES)[number];
