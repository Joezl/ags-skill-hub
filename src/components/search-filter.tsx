'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Category, CATEGORIES, SortOption } from '@/types/skill';
import { cn } from '@/lib/utils';

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: Category;
  onCategoryChange: (value: Category) => void;
  onResetFilters: () => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  resultCount: number;
}

export function SearchFilter({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onResetFilters,
  sortBy,
  onSortChange,
  resultCount,
}: SearchFilterProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(210,10%,42%)]">
            Browse directory
          </div>
          <div className="mt-1 text-sm text-[hsl(210,8%,42%)]">Filter by category or refine with search.</div>
        </div>
        <div className="text-sm text-[hsl(210,8%,45%)]">
          Showing <span className="font-semibold text-[hsl(0,0%,14%)]">{resultCount}</span> skills
          {selectedCategory !== 'All' && (
            <span>
              {' '}in <span className="font-semibold text-[hsl(0,0%,14%)]">{selectedCategory}</span>
            </span>
          )}
          {searchQuery && (
            <span>
              {' '}matching <span className="font-semibold text-[hsl(0,0%,14%)]">&quot;{searchQuery}&quot;</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(210,8%,45%)]" />
          <Input
            placeholder="Search skills, workflows, or authors"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 rounded-md border-[hsl(210,16%,82%)] bg-white pl-9 text-[15px] shadow-sm"
          />
        </div>

        <div className="w-full lg:w-auto">
          <Select 
            value={sortBy} 
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="h-11 rounded-md border-[hsl(210,16%,82%)] bg-white px-3 text-sm shadow-sm"
          >
            <SelectItem value="updatedAt">Recently Updated</SelectItem>
            <SelectItem value="downloads">Most Viewed</SelectItem>
            <SelectItem value="stars">Most Rated</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(210,10%,42%)]">Filter by category</div>
        {selectedCategory !== 'All' || searchQuery ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-sm font-medium text-[hsl(210,100%,38%)] hover:text-[hsl(210,100%,33%)] cursor-pointer"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <button
            type="button"
            key={category}
            onClick={() => onCategoryChange(category)}
            className={cn(
              "px-3.5 py-2 rounded-md text-sm font-medium transition-all duration-150 border cursor-pointer",
              selectedCategory === category
                ? "bg-[hsl(210,100%,38%)] text-white border-[hsl(210,100%,38%)] shadow-sm"
                : "bg-[hsl(210,18%,98.8%)] text-[hsl(210,8%,35%)] border-[hsl(210,16%,82%)] hover:border-[hsl(210,16%,68%)] hover:bg-white"
            )}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
