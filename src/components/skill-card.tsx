'use client';

import { useState } from 'react';
import { Skill } from '@/types/skill';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Eye,
  Star,
  Copy,
  Check,
  ArrowUpRight,
  Bot,
  Code2,
  FileText,
  Boxes,
  Hammer,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkillCardProps {
  skill: Skill;
}

const categoryIconMap = {
  Development: Code2,
  Productivity: Sparkles,
  AI: Bot,
  DevOps: Hammer,
  Testing: Boxes,
  Documentation: FileText,
  Utilities: Boxes,
  Communication: MessageSquare,
} as const;

export function SkillCard({ skill }: SkillCardProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const CategoryIcon = categoryIconMap[skill.category] ?? Sparkles;

  const accessVariant =
    skill.access === 'public'
      ? 'success'
      : skill.access === 'org'
        ? 'secondary'
        : skill.access === 'private'
          ? 'destructive'
          : 'default';

  const accessLabel =
    skill.access === 'org'
      ? 'Organization'
      : skill.access === 'shared'
        ? 'Shared'
        : skill.access
          ? skill.access.charAt(0).toUpperCase() + skill.access.slice(1)
          : 'Access unknown';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(skill.installPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const shouldAllowExpansion = skill.description.length > 160;

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden rounded-[0.9rem] border border-[hsl(210,16%,74%)] bg-[linear-gradient(180deg,hsl(210_30%_99%),hsl(0_0%_100%))] shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_40px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-[hsl(210,16%,58%)] hover:shadow-[0_4px_10px_rgba(15,23,42,0.08),0_22px_46px_rgba(15,23,42,0.12)]">
      <div className="h-1.5 w-full bg-[linear-gradient(90deg,hsl(210_100%_38%),hsl(199_100%_43%))]" />

      <CardHeader className="gap-2 border-b border-[hsl(210,16%,86%)] bg-[linear-gradient(180deg,hsl(210_32%_98%),hsl(210_22%_95.8%))] px-4 py-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(210,18%,84%)] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(210,10%,38%)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <CategoryIcon className="h-3 w-3 text-[hsl(210,100%,38%)]" />
              {skill.category}
            </div>
            <CardTitle className="mt-1 text-[16px] font-semibold leading-snug text-[hsl(0,0%,14%)] transition-colors group-hover:text-[hsl(210,100%,38%)]">
              {skill.name}
            </CardTitle>
          </div>
          <Badge variant={accessVariant} className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold">
            {accessLabel}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-[hsl(210,8%,45%)]">
          <span className="inline-flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[hsl(210,20%,96%)] text-[10px] font-semibold text-[hsl(210,8%,35%)]">
                {skill.author.charAt(0).toUpperCase()}
          </span>
          <span className="truncate font-medium text-[hsl(210,10%,32%)]">{skill.author}</span>
          <span className="text-[hsl(210,16%,72%)]">•</span>
          <span>{formatDate(skill.updatedAt)}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 bg-[linear-gradient(180deg,hsl(210_24%_98.7%),hsl(210_24%_97.8%))] p-3">
        <div className="rounded-[0.75rem] border border-[hsl(210,16%,84%)] bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_18px_rgba(15,23,42,0.04)]">
          <CardDescription className={cn(
            'text-[13px] leading-5.5 text-[hsl(210,8%,32%)]',
            !isExpanded && 'line-clamp-3'
          )}>
            {skill.description}
          </CardDescription>

          {shouldAllowExpansion ? (
            <button
              type="button"
              onClick={() => setIsExpanded((value) => !value)}
              className="mt-1 cursor-pointer text-[13px] font-medium text-[hsl(210,100%,38%)] hover:text-[hsl(210,100%,33%)]"
            >
              {isExpanded ? 'Show less' : 'Read more'}
            </button>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[hsl(210,18%,92%)] pt-2">
            {skill.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[hsl(210,30%,70%)] bg-[linear-gradient(180deg,hsl(210_58%_92%),hsl(210_52%_86%))] px-2.5 py-1 text-[10px] font-semibold text-[hsl(210,18%,24%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_4px_rgba(15,23,42,0.08)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-2 rounded-[0.7rem] border border-[hsl(210,18%,82%)] bg-[linear-gradient(180deg,hsl(210_20%_96.5%),hsl(210_20%_94.2%))] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
          <div className="flex items-center justify-between gap-3 text-[11px] text-[hsl(210,10%,42%)]">
            <div className="flex min-w-0 items-center gap-1.5">
              <Eye className="h-3 w-3 text-[hsl(210,100%,38%)]" />
              <span className="uppercase tracking-[0.12em]">Views</span>
              <span className="font-semibold text-[hsl(0,0%,14%)]">{formatNumber(skill.downloads)}</span>
            </div>
            <div className="h-4 w-px bg-[hsl(210,16%,82%)]" />
            <div className="flex min-w-0 items-center gap-1.5">
              <Star className="h-3 w-3 text-[hsl(24,95%,53%)]" />
              <span className="uppercase tracking-[0.12em]">Ratings</span>
              <span className="font-semibold text-[hsl(0,0%,14%)]">{formatNumber(skill.stars)}</span>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex-col items-stretch gap-1.5 border-t border-[hsl(210,16%,84%)] bg-[linear-gradient(180deg,hsl(210_16%_96.8%),hsl(210_18%_94.8%))] p-3">
        <div className="flex w-full flex-col gap-1.5 sm:flex-row">
          <a
            href={skill.installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8.5 flex-1 border-[hsl(210,16%,74%)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]')}
          >
            Open Item
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <Button
            variant={copied ? "secondary" : "default"}
            size="sm"
            className="h-8.5 flex-1 gap-1.5"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Install
              </>
            )}
          </Button>
        </div>

        {copied ? (
          <div className="rounded-md border border-[hsl(145,60%,85%)] bg-[hsl(145,60%,97%)] px-3 py-2 text-sm text-[hsl(145,55%,24%)]" role="status" aria-live="polite">
            <div className="font-semibold">Install guidance copied</div>
            <div className="mt-0.5 text-[12px] leading-4.5 text-[hsl(145,45%,30%)]">
              Includes the item link, access context, and setup prompt for an editor or agent.
            </div>
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}
