'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Database, ShieldAlert, Sparkles, TriangleAlert } from 'lucide-react';
import type { ArcGISViewer } from '@/lib/arcgis-auth';
import { Header } from '@/components/header';
import { SearchFilter } from '@/components/search-filter';
import { SkillCard } from '@/components/skill-card';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Category, Skill, SortOption } from '@/types/skill';

interface SkillHubClientProps {
  authConfigured: boolean;
  errorMessage?: string;
  renderTimestamp: number;
  skills: Skill[];
  viewer?: ArcGISViewer | null;
}

export function SkillHubClient({ authConfigured, errorMessage, renderTimestamp, skills, viewer }: SkillHubClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [sortBy, setSortBy] = useState<SortOption>('updatedAt');

  const filteredSkills = useMemo(() => {
    let result = [...skills];

    if (selectedCategory !== 'All') {
      result = result.filter((skill) => skill.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query) ||
          skill.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    result.sort((left, right) => {
      switch (sortBy) {
        case 'downloads':
          return right.downloads - left.downloads;
        case 'stars':
          return right.stars - left.stars;
        case 'updatedAt':
          return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
        case 'name':
          return left.name.localeCompare(right.name);
        default:
          return 0;
      }
    });

    return result;
  }, [searchQuery, selectedCategory, skills, sortBy]);

  const totalDownloads = skills.reduce((accumulator, skill) => accumulator + skill.downloads, 0);
  const activeCategoryCount = new Set(skills.map((skill) => skill.category)).size;
  const accessibleSkills = skills.filter((skill) => skill.access === 'public' || skill.access === 'org').length;

  return (
    <div className="min-h-screen bg-transparent">
      <Header authConfigured={authConfigured} viewer={viewer} />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-[hsl(210,24%,80%)] bg-[linear-gradient(180deg,hsl(210_78%_90%),hsl(206_72%_88%)_58%,hsl(210_44%_93%))]">
          <div className="absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-px bg-white/65" />
            <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-[hsl(210,100%,38%)]/14 blur-3xl" />
            <div className="absolute right-0 top-8 h-72 w-72 rounded-full bg-[hsl(199,100%,43%)]/12 blur-3xl" />
          </div>

          <div className="container relative max-w-7xl mx-auto px-4 py-5 md:py-6">
            <div className="w-full rounded-[1.25rem] border border-[hsl(210,34%,74%)] bg-[linear-gradient(180deg,hsl(0_0%_100%/0.4),hsl(210_40%_95%/0.58))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur-md md:px-6 md:py-6 xl:px-8 xl:py-7">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.72fr)] xl:items-end xl:gap-8">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(210,10%,42%)]">
                    ArcGIS platform
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Live from ArcGIS Online
                    </Badge>
                  </div>

                  <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-[hsl(0,0%,14%)] md:text-5xl xl:max-w-5xl xl:text-[3.6rem] xl:leading-[1.02]">
                    Bring ArcGIS skills into agentic location intelligence workflows.
                  </h1>

                  <p className="mt-3 max-w-3xl text-base leading-7 text-[hsl(210,8%,36%)] md:text-lg md:leading-8 xl:max-w-4xl">
                    Discover live skill items from ArcGIS Online and review how they support automation, content, and platform workflows.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a href="#skills" className={cn(buttonVariants({ variant: 'default', size: 'default' }), 'h-10')}>
                      Browse directory
                      <ArrowRight className="h-4 w-4" />
                    </a>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(210,16%,88%)] bg-white/85 px-3 py-1.5 text-sm text-[hsl(210,8%,42%)] backdrop-blur-sm">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-[hsl(24,95%,53%)]" />
                      <span>
                        {viewer
                          ? `${accessibleSkills} visible for ${viewer.username}. Results reflect your ArcGIS access.`
                          : authConfigured
                            ? `${accessibleSkills} visible now. Sign in with ArcGIS to view organization and shared items.`
                            : `${accessibleSkills} visible now. ArcGIS sign-in is not configured in this environment yet.`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:w-full xl:max-w-[18.5rem] xl:justify-self-end xl:grid-cols-1">
                  <div className="rounded-lg border border-[hsl(210,28%,78%)] bg-white/72 p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[hsl(210,10%,42%)]">Skills</div>
                    <div className="mt-2 text-2xl font-semibold text-[hsl(0,0%,14%)]">{skills.length}</div>
                  </div>
                  <div className="rounded-lg border border-[hsl(210,28%,78%)] bg-white/72 p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[hsl(210,10%,42%)]">Categories</div>
                    <div className="mt-2 text-2xl font-semibold text-[hsl(0,0%,14%)]">{activeCategoryCount}</div>
                  </div>
                  <div className="rounded-lg border border-[hsl(210,28%,78%)] bg-white/72 p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-[hsl(210,10%,42%)]">Views</div>
                    <div className="mt-2 text-2xl font-semibold text-[hsl(0,0%,14%)]">{(totalDownloads / 1000).toFixed(1)}k</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="skills" className="relative z-10 -mt-2 container max-w-7xl mx-auto px-4 py-2 md:-mt-3 md:py-3">
          <div className="rounded-[1.25rem] border border-[hsl(210,18%,84%)] bg-[linear-gradient(180deg,hsl(210_24%_96.8%),hsl(210_22%_94.4%))] p-3 shadow-[0_18px_48px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] md:p-4">
            <div className="rounded-[1rem] border border-[hsl(210,16%,87%)] bg-[linear-gradient(180deg,hsl(0_0%_100%),hsl(210_18%_98.2%))] p-4 shadow-[0_2px_6px_rgba(15,23,42,0.04)] md:p-6">
            {errorMessage ? (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Live ArcGIS items could not be loaded.</div>
                  <div className="mt-1">{errorMessage}</div>
                </div>
              </div>
            ) : null}

            <div className={errorMessage ? 'mt-3' : ''}>
              <SearchFilter
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onResetFilters={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                sortBy={sortBy}
                onSortChange={setSortBy}
                resultCount={filteredSkills.length}
              />
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[hsl(210,16%,92%)] pt-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(210,10%,42%)]">
                  Available skills
                </div>
                <div className="mt-1 text-sm text-[hsl(210,8%,42%)]">
                  Review live items sourced from ArcGIS Online.
                </div>
              </div>
            </div>

            {filteredSkills.length > 0 ? (
              <div className="mt-3 rounded-[1rem] border border-[hsl(210,18%,88%)] bg-[linear-gradient(180deg,hsl(210_22%_97.5%),hsl(210_22%_95.6%))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] md:p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredSkills.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} renderTimestamp={renderTimestamp} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(210,20%,96%)]">
                  <Database className="h-6 w-6 text-[hsl(210,8%,45%)]" />
                </div>
                <h3 className="mb-1 text-base font-semibold text-[hsl(0,0%,14%)]">
                  {errorMessage ? 'No live skills available' : 'No skills matched this view'}
                </h3>
                <p className="max-w-md text-sm text-[hsl(210,8%,45%)]">
                  {errorMessage
                    ? 'Check the ArcGIS token and query configuration, then refresh when the live directory is available.'
                    : 'Try broadening the search query or switching to another category to inspect more ArcGIS skill items.'}
                </p>
              </div>
            )}
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-[hsl(210,16%,90%)] bg-white/80">
        <div className="container max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-[hsl(0,0%,14%)]">Skill Hub</div>
              <div className="mt-1 text-sm text-[hsl(210,8%,45%)]">
                ArcGIS ecosystem directory for skills discovery and distribution.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[hsl(210,8%,45%)]">
              <Link href="/api/skills" className="hover:text-[hsl(210,100%,38%)] transition-colors">
                Developer API
              </Link>
              <a href="#skills" className="hover:text-[hsl(210,100%,38%)] transition-colors">
                Browse skills
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}