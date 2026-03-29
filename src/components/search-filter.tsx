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
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  resultCount: number;
}

export function SearchFilter({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  resultCount,
}: SearchFilterProps) {
  return (
    <div className="space-y-4">
      {/* Search and Sort Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(210,8%,45%)]" />
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="w-full sm:w-44">
          <Select 
            value={sortBy} 
            onChange={(e) => onSortChange(e.target.value as SortOption)}
          >
            <SelectItem value="downloads">Most Viewed</SelectItem>
            <SelectItem value="stars">Most Rated</SelectItem>
            <SelectItem value="updatedAt">Recently Updated</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </Select>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={cn(
              "px-3 py-1.5 rounded text-sm font-medium transition-all duration-150 border",
              selectedCategory === category
                ? "bg-[hsl(210,100%,38%)] text-white border-[hsl(210,100%,38%)]"
                : "bg-white text-[hsl(210,8%,35%)] border-[hsl(210,16%,85%)] hover:border-[hsl(210,16%,70%)] hover:bg-[hsl(210,14%,98%)]"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Results Count */}
      <div className="text-sm text-[hsl(210,8%,45%)]">
        Showing <span className="font-medium text-[hsl(0,0%,14%)]">{resultCount}</span> skills
        {selectedCategory !== 'All' && (
          <span>
            {' '}in <span className="font-medium text-[hsl(0,0%,14%)]">{selectedCategory}</span>
          </span>
        )}
        {searchQuery && (
          <span>
            {' '}matching "<span className="font-medium text-[hsl(0,0%,14%)]">{searchQuery}</span>"
          </span>
        )}
      </div>
    </div>
  );
}
