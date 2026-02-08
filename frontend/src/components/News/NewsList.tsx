import { NewsArticle } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewsListProps {
  articles: NewsArticle[];
  isLoading?: boolean;
}

/* ── sentiment helpers ──────────────────────────────────── */

function sentimentConfig(label?: string) {
  switch (label?.toLowerCase()) {
    case 'positive':
      return {
        icon: <TrendingUp className="h-3 w-3" />,
        text: 'Bullish',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        color: 'text-emerald-400',
        dot: 'bg-emerald-500',
        accentBorder: 'border-l-emerald-500',
      };
    case 'negative':
      return {
        icon: <TrendingDown className="h-3 w-3" />,
        text: 'Bearish',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        color: 'text-red-400',
        dot: 'bg-red-500',
        accentBorder: 'border-l-red-500',
      };
    default:
      return {
        icon: <Minus className="h-3 w-3" />,
        text: 'Neutral',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        color: 'text-slate-400',
        dot: 'bg-slate-500',
        accentBorder: 'border-l-slate-400/60',
      };
  }
}

/* ── date formatter ─────────────────────────────────────── */

function formatDate(dateStr: string): string {
  try {
    if (dateStr.length >= 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

/* ── skeleton loader ────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl border border-border/30 bg-card/40 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-2 w-2 rounded-full bg-muted/60 mt-2 shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 bg-muted/50 rounded-md w-4/5" />
          <div className="h-3 bg-muted/40 rounded-md w-3/5" />
          <div className="flex gap-2 pt-1">
            <div className="h-3 bg-muted/30 rounded-md w-12" />
            <div className="h-3 bg-muted/30 rounded-md w-16" />
          </div>
          <div className="h-3 bg-muted/30 rounded-md w-full" />
          <div className="h-3 bg-muted/30 rounded-md w-2/3" />
        </div>
      </div>
    </div>
  );
}

/* ── main component ─────────────────────────────────────── */

export function NewsList({ articles, isLoading }: NewsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (articles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {articles.map((article, idx) => {
        const sentiment = sentimentConfig(article.sentiment_label);

        return (
          <article
            key={`${article.url || article.title}-${idx}`}
            className={cn(
              'group relative p-4 rounded-xl border border-border/30 bg-card/50',
              'hover:bg-card/80 hover:border-border/50 hover:shadow-lg hover:shadow-black/5',
              'transition-all duration-200 ease-out',
              'border-l-[3px]',
              sentiment.accentBorder
            )}
          >
            <div className="flex items-start gap-3">
              {/* Sentiment dot */}
              <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', sentiment.dot, 'opacity-80')} />

              <div className="flex-1 min-w-0 space-y-2">
                {/* Title */}
                <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary/90 transition-colors duration-200">
                  {article.url ? (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1.5"
                    >
                      <span className="line-clamp-2">{article.title}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0 mt-0.5" />
                    </a>
                  ) : (
                    <span className="line-clamp-2">{article.title}</span>
                  )}
                </h3>

                {/* Meta row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-medium text-muted-foreground/80">
                    {article.source}
                  </span>
                  <span className="text-muted-foreground/30">&middot;</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDate(article.published_date)}
                  </span>
                  {article.sentiment_label && (
                    <>
                      <span className="text-muted-foreground/30">&middot;</span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md',
                          sentiment.bg,
                          sentiment.color
                        )}
                      >
                        {sentiment.icon}
                        {sentiment.text}
                      </span>
                    </>
                  )}
                </div>

                {/* Summary */}
                {article.summary && (
                  <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
                    {article.summary}
                  </p>
                )}

                {/* Symbol badges */}
                {article.symbols && article.symbols.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {article.symbols.slice(0, 6).map((symbol) => (
                      <Badge
                        key={symbol}
                        variant="outline"
                        className="text-[10px] font-semibold px-2 py-0.5 bg-primary/5 border-primary/15 text-primary/80 hover:bg-primary/10 transition-colors"
                      >
                        ${symbol}
                      </Badge>
                    ))}
                    {article.symbols.length > 6 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{article.symbols.length - 6} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
