import Link from 'next/link';
import { BadgeCheck, Database, LayoutGrid, LogIn, LogOut, Sparkles } from 'lucide-react';
import type { ArcGISViewer } from '@/lib/arcgis-auth';
import { APP_BASE_PATH } from '@/lib/app-config';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeaderProps {
  authConfigured?: boolean;
  viewer?: ArcGISViewer | null;
}

export function Header({ authConfigured = true, viewer }: HeaderProps) {
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
          {viewer ? (
            <>
              <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(210,18%,82%)] bg-[linear-gradient(180deg,hsl(210_38%_98%),hsl(210_30%_95%))] px-3 py-1.5 text-[12px] text-[hsl(210,10%,28%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <BadgeCheck className="h-3.5 w-3.5 text-[hsl(210,100%,38%)]" />
                <span className="font-semibold">{viewer.fullName}</span>
                <span className="text-[hsl(210,10%,42%)]">@{viewer.username}</span>
              </div>
              <a
                href={`${APP_BASE_PATH}/api/auth/arcgis/logout`}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'border-[hsl(210,16%,82%)] text-[hsl(210,10%,28%)]'
                )}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </a>
            </>
          ) : authConfigured ? (
            <a
              href={`${APP_BASE_PATH}/api/auth/arcgis/login?returnTo=${encodeURIComponent(APP_BASE_PATH)}`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'border-[hsl(210,30%,74%)] bg-[linear-gradient(180deg,hsl(0_0%_100%),hsl(210_42%_97%))] px-3 text-[hsl(210,100%,38%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04)] hover:border-[hsl(210,30%,70%)] hover:bg-[linear-gradient(180deg,hsl(0_0%_100%),hsl(210_42%_97%))] hover:text-[hsl(210,100%,38%)]'
              )}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in with ArcGIS
            </a>
          ) : (
            <span
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'cursor-not-allowed border-[hsl(210,16%,84%)] text-[hsl(210,10%,48%)] opacity-70'
              )}
              aria-disabled="true"
              title="Set ARCGIS_OAUTH_CLIENT_ID and SKILL_HUB_SESSION_SECRET to enable ArcGIS sign-in."
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in unavailable
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
