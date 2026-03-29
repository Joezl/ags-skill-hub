'use client';

import Link from 'next/link';
import { Database, LayoutGrid, LogIn, Sparkles } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[hsl(210,16%,88%)] bg-white/96 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-[0.7rem] border border-[hsl(210,30%,32%)] bg-[linear-gradient(180deg,hsl(210_100%_38%),hsl(202_100%_34%))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_12px_rgba(15,23,42,0.14)]">
            <div className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/80" />
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[15px] text-[hsl(0,0%,14%)] leading-none">ArcGIS Skill Hub</div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[hsl(210,10%,42%)] mt-1">
              Empowering agentic workflows across the ArcGIS platform
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-2 text-sm">
          <a
            href="#skills"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'text-[hsl(210,10%,35%)]'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Browse
          </a>
          <Link
            href="/api/skills"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'border-[hsl(210,16%,82%)] text-[hsl(210,10%,28%)]'
            )}
          >
            <Database className="w-3.5 h-3.5" />
            API
          </Link>
          <button
            type="button"
            aria-disabled="true"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'border-[hsl(210,30%,74%)] bg-[linear-gradient(180deg,hsl(0_0%_100%),hsl(210_42%_97%))] px-3 text-[hsl(210,100%,38%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04)] hover:border-[hsl(210,30%,70%)] hover:bg-[linear-gradient(180deg,hsl(0_0%_100%),hsl(210_42%_97%))] hover:text-[hsl(210,100%,38%)]'
            )}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign in
          </button>
        </nav>
      </div>
    </header>
  );
}
