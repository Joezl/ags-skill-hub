import { describe, expect, it } from 'vitest';
import { buildInstallPrompt, inferSkillCategory, mapArcGISItemToSkill, type ArcGISSearchItem } from './arcgis';

describe('arcgis skill mapping', () => {
  const baseItem: ArcGISSearchItem = {
    access: 'org',
    avgRating: 4.5,
    created: 1774605578000,
    description: '<p>Track AI-assisted commits and create reports.</p>',
    id: 'cc90bd067ddd4f24954f51bf67f7460b',
    modified: 1774605578000,
    name: 'AI_Usage_Monitor.zip',
    numRatings: 3,
    numViews: 42,
    owner: 'zhen9033',
    snippet: 'Track and analyze AI tool usage in Git repositories.',
    tags: ['Agent Skill', 'AI', 'GitHub'],
    title: 'AI Usage Monitor',
    type: 'Code Sample',
    typeKeywords: ['Agent Skill', 'Code', 'Sample', 'Skill'],
  };

  it('maps ArcGIS search items into hub skills', () => {
    const skill = mapArcGISItemToSkill(baseItem, 'https://www.arcgis.com');

    expect(skill.id).toBe(baseItem.id);
    expect(skill.name).toBe('AI Usage Monitor');
    expect(skill.description).toBe('Track AI-assisted commits and create reports.');
    expect(skill.installUrl).toBe('https://www.arcgis.com/home/item.html?id=cc90bd067ddd4f24954f51bf67f7460b');
    expect(skill.downloads).toBe(42);
    expect(skill.stars).toBe(3);
    expect(skill.access).toBe('org');
    expect(skill.typeKeywords).toContain('Agent Skill');
    expect(skill.installPrompt).toContain('ARC_SKILL_INSTALL');
    expect(skill.installPrompt).toContain('item_id=cc90bd067ddd4f24954f51bf67f7460b');
    expect(skill.installPrompt).toContain('auth=oauth');
    expect(skill.installPrompt).toContain('skill_hub_url=');
  });

  it('prefers snippet when the description looks like structured markdown', () => {
    const skill = mapArcGISItemToSkill(
      {
        ...baseItem,
        description: '---\nname: screenshot-to-figma-page\n# Screenshot To Figma Page',
        snippet: 'Recreate a screenshot as an editable Figma design page.',
      },
      'https://www.arcgis.com'
    );

    expect(skill.description).toBe('Recreate a screenshot as an editable Figma design page.');
  });

  it('generates an install prompt with ArcGIS context', () => {
    const prompt = buildInstallPrompt({
      access: 'org',
      id: baseItem.id,
      installUrl: 'https://www.arcgis.com/home/item.html?id=cc90bd067ddd4f24954f51bf67f7460b',
      name: 'AI Usage Monitor',
      portalUrl: 'https://www.arcgis.com',
      type: 'Code Sample',
      typeKeywords: ['Agent Skill', 'Code', 'Sample', 'Skill'],
    });

    expect(prompt).toContain('portal_url=https://www.arcgis.com');
    expect(prompt).toContain('access_level=org');
    expect(prompt).toContain('auth=oauth');
    expect(prompt).toContain('POST to {skill_hub_url}/api/auth/relay/sessions');
    expect(prompt).toContain('Poll GET {skill_hub_url}/api/auth/relay/sessions/{sessionId}/token every 3 seconds');
  });

  it('infers a category from item content', () => {
    expect(
      inferSkillCategory({
        description: 'Generate concise Teams meeting notes with action items.',
        snippet: null,
        tags: ['Teams', 'Meeting Notes'],
        title: 'Teams Meeting Notes',
      })
    ).toBe('Productivity');
  });
});