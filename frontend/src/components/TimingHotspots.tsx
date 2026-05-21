import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock } from "lucide-react";
import { PLATFORMS, platformMeta, formatNumber } from "@/lib/social";

type Post = {
  id: string; profile_id: string; posted_at: string | null;
  likes: number; comments: number; shares: number; views: number;
};
type Profile = { id: string; platform: string; handle: string };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatHour = (h: number) => {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
};

export function TimingHotspots({ posts, profiles }: { posts: Post[]; profiles: Profile[] }) {
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // 7x24 grid: avg engagement per cell + post count
  const { grid, max, totalCells } = useMemo(() => {
    const g: { eng: number; count: number }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ eng: 0, count: 0 })),
    );
    for (const p of posts) {
      if (!p.posted_at) continue;
      const d = new Date(p.posted_at);
      const day = d.getDay();
      const hr = d.getHours();
      g[day][hr].eng += p.likes + p.comments + p.shares;
      g[day][hr].count += 1;
    }
    let mx = 0;
    let cells = 0;
    for (const row of g) {
      for (const c of row) {
        const avg = c.count ? c.eng / c.count : 0;
        if (avg > mx) mx = avg;
        if (c.count > 0) cells += 1;
      }
    }
    return { grid: g, max: mx, totalCells: cells };
  }, [posts]);

  // Best time per platform
  const bestByPlatform = useMemo(() => {
    return PLATFORMS.map((pl) => {
      const ids = new Set(profiles.filter((p) => p.platform === pl.id).map((p) => p.id));
      const bucket = new Map<string, { day: number; hour: number; eng: number; count: number }>();
      for (const p of posts) {
        if (!p.posted_at || !ids.has(p.profile_id)) continue;
        const d = new Date(p.posted_at);
        const day = d.getDay();
        const hour = d.getHours();
        const key = `${day}-${hour}`;
        const cur = bucket.get(key) ?? { day, hour, eng: 0, count: 0 };
        cur.eng += p.likes + p.comments + p.shares;
        cur.count += 1;
        bucket.set(key, cur);
      }
      let best: { day: number; hour: number; avg: number; count: number } | null = null;
      bucket.forEach((v) => {
        const avg = v.count ? v.eng / v.count : 0;
        if (!best || avg > best.avg) best = { day: v.day, hour: v.hour, avg, count: v.count };
      });
      return { platform: pl, best };
    }).filter((x) => x.best !== null) as {
      platform: typeof PLATFORMS[number];
      best: { day: number; hour: number; avg: number; count: number };
    }[];
  }, [posts, profiles]);

  const hourLabels = [0, 4, 8, 12, 16, 20];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-1">
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80 font-semibold flex items-center gap-2">
            <span className="size-1 rounded-full bg-primary" />
            Timing
          </div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight font-serif-display">
            When your audience engages
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Avg engagement per post by day &amp; hour. Darker cells = stronger response.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{totalCells} active slots</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Heatmap */}
        <Card
          className="p-4 sm:p-5 lg:col-span-2 border-border/60 shadow-[var(--shadow-card)] overflow-x-auto"
          style={{ background: "var(--gradient-card)" }}
        >
          <div className="flex items-start justify-between mb-3 gap-3">
            <h3 className="font-semibold tracking-tight">Engagement heatmap</h3>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">7 × 24</Badge>
          </div>

          <div className="min-w-[560px]">
            {/* Hour header */}
            <div className="grid" style={{ gridTemplateColumns: "32px repeat(24, minmax(0, 1fr))" }}>
              <div />
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="text-[9px] text-muted-foreground text-center">
                  {hourLabels.includes(h) ? formatHour(h) : ""}
                </div>
              ))}
            </div>
            {/* Rows */}
            <TooltipProvider delayDuration={80}>
              {grid.map((row, d) => (
                <div key={d} className="grid mt-1" style={{ gridTemplateColumns: "32px repeat(24, minmax(0, 1fr))" }}>
                  <div className="text-[10px] text-muted-foreground self-center">{DOW[d]}</div>
                  {row.map((c, h) => {
                    const avg = c.count ? c.eng / c.count : 0;
                    const intensity = max > 0 ? avg / max : 0;
                    const empty = c.count === 0;
                    return (
                      <Tooltip key={h}>
                        <TooltipTrigger asChild>
                          <div
                            className="aspect-square m-[1px] rounded-[3px] transition-transform hover:scale-110 cursor-pointer"
                            style={{
                              background: empty
                                ? "hsl(var(--muted) / 0.4)"
                                : `hsl(var(--primary) / ${0.12 + intensity * 0.78})`,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-semibold">{DOW[d]} · {formatHour(h)}</div>
                          {empty ? (
                            <div className="text-muted-foreground">No posts</div>
                          ) : (
                            <>
                              <div>{c.count} post{c.count === 1 ? "" : "s"}</div>
                              <div>Total eng: <span className="font-medium tabular-nums">{formatNumber(c.eng)}</span></div>
                              <div>Avg / post: <span className="font-medium tabular-nums">{formatNumber(Math.round(avg))}</span></div>
                            </>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </TooltipProvider>
            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-[2px]">
                {[0.15, 0.3, 0.5, 0.7, 0.9].map((o) => (
                  <div key={o} className="size-3 rounded-[2px]" style={{ background: `hsl(var(--primary) / ${o})` }} />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        </Card>

        {/* Best time per platform */}
        <Card
          className="p-4 sm:p-5 border-border/60 shadow-[var(--shadow-card)]"
          style={{ background: "var(--gradient-card)" }}
        >
          <div className="flex items-start justify-between mb-3 gap-3">
            <div>
              <h3 className="font-semibold tracking-tight">Best time to post</h3>
              <p className="text-xs text-muted-foreground">Top-performing slot per platform</p>
            </div>
            <Clock className="size-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {bestByPlatform.length === 0 && (
              <p className="text-xs text-muted-foreground">Not enough data yet.</p>
            )}
            {bestByPlatform.map(({ platform, best }) => {
              const Icon = platform.icon;
              return (
                <div
                  key={platform.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="size-7 rounded-md flex items-center justify-center text-white shrink-0"
                      style={{ background: `linear-gradient(135deg, hsl(var(--${platform.color})), hsl(var(--${platform.color}) / 0.7))` }}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{platform.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {best.count} post{best.count === 1 ? "" : "s"} in slot
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{DOW[best.day]} {formatHour(best.hour)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      ~{formatNumber(Math.round(best.avg))} avg eng.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </section>
  );
}
