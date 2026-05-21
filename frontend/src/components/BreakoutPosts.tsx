import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Heart, MessageCircle, Share2, Eye, ExternalLink, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { PLATFORMS, platformMeta, formatNumber } from "@/lib/social";
import { Thumbnail } from "@/components/Thumbnail";
import { cn } from "@/lib/utils";

type Post = {
  id: string; profile_id: string; posted_at: string | null; url: string | null; thumbnail_url: string | null;
  caption: string | null; likes: number; comments: number; shares: number; views: number;
};
type Profile = { id: string; platform: string; handle: string };

export function BreakoutPosts({
  posts,
  profiles,
  onOpenPost,
}: {
  posts: Post[];
  profiles: Profile[];
  onOpenPost?: (id: string) => void;
}) {
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const breakouts = useMemo(() => {
    if (posts.length < 4) return []; // Need a meaningful sample for σ
    const scored = posts.map((p) => ({ p, eng: p.likes + p.comments + p.shares }));
    const n = scored.length;
    const mean = scored.reduce((s, x) => s + x.eng, 0) / n;
    const variance = scored.reduce((s, x) => s + (x.eng - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    if (std === 0) return [];
    const threshold = mean + 2 * std;
    return scored
      .filter((x) => x.eng > threshold && x.eng > 0)
      .map((x) => ({
        ...x.p,
        eng: x.eng,
        zScore: (x.eng - mean) / std,
        vsMean: mean > 0 ? x.eng / mean : 0,
      }))
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 6);
  }, [posts]);

  if (breakouts.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-1">
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold flex items-center gap-2">
            <span className="size-1 rounded-full bg-accent" />
            Anomalies
          </div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2 font-serif-display">
            <Flame className="size-5 text-accent" />
            Breakout posts
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Posts performing more than <strong className="text-foreground">2σ</strong> above your average — outliers worth studying or boosting.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {breakouts.length} outlier{breakouts.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {breakouts.map((b) => {
          const prof = profileMap.get(b.profile_id);
          const platform = prof ? platformMeta[prof.platform] : undefined;
          const PlatformIcon = platform?.icon;
          const platColor = prof ? `var(--${platform?.color ?? "primary"})` : "var(--primary)";
          return (
            <Card
              key={b.id}
              role={onOpenPost ? "button" : undefined}
              tabIndex={onOpenPost ? 0 : undefined}
              onClick={() => onOpenPost?.(b.id)}
              onKeyDown={(e) => {
                if (onOpenPost && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onOpenPost(b.id);
                }
              }}
              className={cn(
                "group relative isolate overflow-hidden rounded-xl border-border/60 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:-translate-y-1 transition-all duration-300",
                onOpenPost && "cursor-pointer",
              )}
              style={{ background: "var(--gradient-card)" }}
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                <div
                  className="absolute inset-x-0 top-0 h-1 opacity-90"
                  style={{ background: `linear-gradient(90deg, hsl(${platColor}), hsl(var(--accent)))` }}
                />
                <div
                  className="absolute -top-12 -right-12 size-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"
                  style={{ background: `hsl(${platColor})` }}
                />
              </div>

              <div className="flex gap-3 p-3 sm:p-4 relative">
                <div className="relative size-20 sm:size-24 shrink-0 rounded-lg overflow-hidden ring-1 ring-border/50">
                  <Thumbnail src={b.thumbnail_url} alt={b.caption ?? "Breakout post"} />
                  <div
                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-sm flex items-center gap-1"
                    style={{ background: "hsl(var(--accent))" }}
                  >
                    <TrendingUp className="size-2.5" />
                    {b.vsMean >= 10 ? `${b.vsMean.toFixed(0)}×` : `${b.vsMean.toFixed(1)}×`}
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    {PlatformIcon && platform && (
                      <div
                        className="size-5 rounded flex items-center justify-center text-white shrink-0"
                        style={{ background: `hsl(${platColor})` }}
                      >
                        <PlatformIcon className="size-3" />
                      </div>
                    )}
                    <span className="text-xs font-medium truncate">
                      {prof ? `@${prof.handle}` : "—"}
                    </span>
                    {b.posted_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        · {format(new Date(b.posted_at), "MMM d")}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {b.caption?.trim() || "No caption"}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3 text-like fill-like" />
                      {formatNumber(b.likes)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="size-3" />
                      {formatNumber(b.comments)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Share2 className="size-3" />
                      {formatNumber(b.shares)}
                    </span>
                    {b.views > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3" />
                        {formatNumber(b.views)}
                      </span>
                    )}
                    {b.url && (
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                        aria-label="Open original post"
                      >
                        Open <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
