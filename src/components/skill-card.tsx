'use client';

import { useState } from 'react';
import { Skill } from '@/types/skill';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Star, Copy, Check, ExternalLink } from 'lucide-react';

interface SkillCardProps {
  skill: Skill;
}

export function SkillCard({ skill }: SkillCardProps) {
  const [copied, setCopied] = useState(false);

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

  return (
    <Card className="group flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-[15px] font-semibold truncate group-hover:text-[hsl(210,100%,38%)] transition-colors">
              {skill.name}
            </CardTitle>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[hsl(210,20%,96%)] text-[hsl(210,8%,35%)] text-[10px] font-semibold">
                {skill.author.charAt(0).toUpperCase()}
              </span>
              <span className="text-xs text-[hsl(210,8%,45%)] truncate">{skill.author}</span>
              {skill.access ? (
                <span className="text-[11px] uppercase tracking-wide text-[hsl(210,8%,45%)]">{skill.access}</span>
              ) : null}
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[11px]">
            {skill.category}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 py-0">
        <CardDescription className="text-[13px] line-clamp-3">
          {skill.description}
        </CardDescription>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {skill.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-1.5 py-0.5 rounded bg-[hsl(210,20%,96%)] text-[hsl(210,8%,45%)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </CardContent>

      <CardFooter className="mt-auto">
        <div className="flex items-center justify-between w-full mb-3">
          <div className="flex items-center gap-3 text-xs text-[hsl(210,8%,45%)]">
            <span className="flex items-center gap-1" title="Views">
              <Eye className="w-3.5 h-3.5" />
              <span className="font-medium">{formatNumber(skill.downloads)}</span>
            </span>
            <span className="flex items-center gap-1" title="Ratings">
              <Star className="w-3.5 h-3.5" />
              <span className="font-medium">{formatNumber(skill.stars)}</span>
            </span>
          </div>
          <span className="text-[11px] text-[hsl(210,8%,45%)]">{formatDate(skill.updatedAt)}</span>
        </div>

        <div className="flex gap-2 w-full">
          <Button
            variant={copied ? "secondary" : "default"}
            size="sm"
            className="flex-1 gap-1.5"
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
          <a href={skill.installUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="icon" className="h-7 w-7">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </CardFooter>
    </Card>
  );
}
