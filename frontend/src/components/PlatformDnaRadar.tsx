import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { format, getDay } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { Trophy, Flame, Sparkles, TrendingUp, ExternalLink, Info } from "lucide-react";
import { PLATFORMS, platformMeta, formatNumber, formatPercent } from "@/lib/social";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { EmptyState } from "@/components/EmptyState";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Post = {
  id: string; profile_id: string; posted_at: string | null; url: string | null;
  caption: string | null; likes: number; comments: number; shares: number; views: number;
  media_type?: string | null;
};
type Profile = { id: string; platform: string; handle: string; profile_url: string };
type Snapshot = { profile_id: string; captured_at: string; followers: number | null };

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function PlatformDnaRadar({
  posts, profiles, snapshots, from, to,
}: { posts: Post[]; profiles: Profile[]; snapshots: Snapshot[]; from: Date; to: Date }) {
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Latest follower per platform
  const latestFollowers = useMemo(() => {
    const m = new Map<string, { followers: number; firstFollowers: number; firstAt: number; lastAt: number }>();
    for (const s of snapshots) {
      const prof = profileMap.get(s.profile_id);
      if (!prof || s.followers == null) continue;
      const t = new Date(s.captured_at).getTime();
      const cur = m.get(prof.platform);
      if (!cur) { m.set(prof.platform, { followers: s.followers, firstFollowers: s.followers, firstAt: t, lastAt: t }); continue; }
      if (t < cur.firstAt) { cur.firstFollowers = s.followers; cur.firstAt = t; }
      if (t > cur.lastAt)  { cur.followers      = s.followers; cur.lastAt  = t; }
    }
    return m;
  }, [snapshots, profileMap]);

  // Per-platform comparison rows
  const rows = useMemo(() => {
    return PLATFORMS.map((pl) => {
      const platProfiles = profiles.filter((p) => p.platform === pl.id);
      if (platProfiles.length === 0) return null;
      const ids = new Set(platProfiles.map((p) => p.id));
      const platPosts = posts.filter((p) => ids.has(p.profile_id));
      const followers = latestFollowers.get(pl.id);
      const eng = platPosts.reduce((s, p) => s + p.likes + p.comments + p.shares, 0);
      const views = platPosts.reduce((s, p) => s + p.views, 0);
      const er = followers && followers.followers > 0 && platPosts.length
        ? eng / (followers.followers * platPosts.length) : 0;
      const top = [...platPosts].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
      return {
        pl, profile: platProfiles[0], posts: platPosts.length,
        followers: followers?.followers ?? 0,
        delta: followers ? followers.followers - followers.firstFollowers : 0,
        eng, views, er, top,
        avgEng: platPosts.length ? eng / platPosts.length : 0,
        avgViews: platPosts.length ? views / platPosts.length : 0,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null && (x.posts > 0 || x.followers > 0));
  }, [posts, profiles, latestFollowers]);

  // Insight: best day of week
  const bestDay = useMemo(() => {
    const sums = Array(7).fill(0).map(() => ({ eng: 0, count: 0 }));
    for (const p of posts) {
      if (!p.posted_at) continue;
      const d = getDay(new Date(p.posted_at));
      sums[d].eng += p.likes + p.comments + p.shares;
      sums[d].count++;
    }
    let bestIdx = -1, bestAvg = -1;
    sums.forEach((s, i) => {
      const avg = s.count ? s.eng / s.count : 0;
      if (avg > bestAvg) { bestAvg = avg; bestIdx = i; }
    });
    return bestIdx >= 0 && sums[bestIdx].count > 0
      ? { day: DOW[bestIdx], avg: bestAvg, count: sums[bestIdx].count } : null;
  }, [posts]);

  // Insight: top post
  const topPost = useMemo(() => {
    const t = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0))[0];
    if (!t) return null;
    const prof = profileMap.get(t.profile_id);
    return { post: t, prof, eng: t.likes + t.comments + t.shares };
  }, [posts, profileMap]);

  // Insight: most active platform
  const mostActive = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      const prof = profileMap.get(p.profile_id);
      if (prof) counts.set(prof.platform, (counts.get(prof.platform) ?? 0) + 1);
    }
    let best: { platform: string; count: number } | null = null;
    counts.forEach((count, platform) => {
      if (!best || count > best.count) best = { platform, count };
    });
    return best;
  }, [posts, profileMap]);

  // Engagement-rate-over-time per platform (avg ER per day, per platform)
  const erTrend = useMemo(() => {
    const buckets = new Map<string, { day: string; ts: number } & Record<string, number | string>>();
    const dayPlatPosts = new Map<string, { eng: number; count: number }>();
    for (const p of posts) {
      if (!p.posted_at) continue;
      const prof = profileMap.get(p.profile_id);
      if (!prof) continue;
      const d = new Date(p.posted_at);
      const dayKey = format(d, "yyyy-MM-dd");
      const dayLabel = format(d, "MMM d");
      const key = `${dayKey}__${prof.platform}`;
      const f = latestFollowers.get(prof.platform)?.followers ?? 0;
      const cur = dayPlatPosts.get(key) ?? { eng: 0, count: 0 };
      cur.eng += p.likes + p.comments + p.shares;
      cur.count++;
      dayPlatPosts.set(key, cur);
      if (!buckets.has(dayKey)) buckets.set(dayKey, { day: dayLabel, ts: new Date(dayKey).getTime() });
      const er = f > 0 && cur.count ? cur.eng / (f * cur.count) : 0;
      (buckets.get(dayKey) as any)[prof.platform] = +(er * 100).toFixed(3);
    }
    return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts).map(({ ts, ...rest }) => rest);
  }, [posts, profileMap, latestFollowers]);

  return (
    <>
      {/* Insight cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6 md:pb-10">
        <InsightCard
          icon={Trophy}
          title="Top post"
          primary={topPost ? formatNumber(topPost.eng) + " interactions" : "—"}
          secondary={topPost?.post.caption?.slice(0, 80) || (topPost ? "No caption" : "No posts in range")}
          link={topPost?.post.url ?? undefined}
          chip={topPost?.prof ? platformMeta[topPost.prof.platform]?.label : undefined}
          accent="primary"
        />
        <InsightCard
          icon={Flame}
          title="Best day to post"
          primary={bestDay ? bestDay.day : "—"}
          secondary={bestDay ? `${formatNumber(Math.round(bestDay.avg))} avg interactions · ${bestDay.count} posts` : "Not enough data"}
          accent="accent"
        />
        <InsightCard
          icon={Sparkles}
          title="Most active platform"
          primary={mostActive ? platformMeta[mostActive.platform]?.label ?? mostActive.platform : "—"}
          secondary={mostActive ? `${mostActive.count} posts in selected range` : "No posts in range"}
          chip={mostActive?.platform ? platformMeta[mostActive.platform]?.label : undefined}
          accent="primary-glow"
        />
      </section>


      {/* Per-platform comparison table */}
      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold font-serif-display">Platform comparison</h2>
          <p className="text-sm text-muted-foreground">Side-by-side view of every connected profile</p>
        </div>
        <Card className="shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2.5 px-3 font-medium">Platform</th>
                  <th className="text-right py-2.5 px-3 font-medium">Followers</th>
                  <th className="text-right py-2.5 px-3 font-medium">Δ Followers</th>
                  <th className="text-right py-2.5 px-3 font-medium">Posts</th>
                  <th className="text-right py-2.5 px-3 font-medium">Engagement</th>
                  <th className="text-right py-2.5 px-3 font-medium">Avg / post</th>
                  <th className="text-right py-2.5 px-3 font-medium">Views</th>
                  <th className="text-right py-2.5 px-3 font-medium">Avg views</th>
                  <th className="text-right py-2.5 px-3 font-medium">Eng. rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="p-0">
                    <EmptyState asCard={false} variant="no-data" title="No platform data in range" description="Pick a wider date range or refresh." />
                  </td></tr>
                )}
                {rows.map((r) => {
                  const Icon = r.pl.icon;
                  return (
                    <tr key={r.pl.id} className="border-t border-border hover:bg-muted/30">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex size-6 items-center justify-center rounded text-white"
                            style={{ background: `hsl(var(--${r.pl.color}))` }}>
                            <Icon className="size-3" />
                          </span>
                          <a href={r.profile.profile_url} target="_blank" rel="noreferrer"
                            className="hover:underline inline-flex items-center gap-1">
                            {r.pl.label}<ExternalLink className="size-3 text-muted-foreground" />
                          </a>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {r.pl.id === "linkedin" ? (
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help hover:text-foreground inline-flex items-center gap-1 justify-end w-full">
                                <AnimatedNumber value={formatNumber(r.followers)} />
                                <Info className="size-3 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              LinkedIn followers refresh weekly to keep API sync costs low.
                            </TooltipContent>
                          </UITooltip>
                        ) : (
                          <AnimatedNumber value={formatNumber(r.followers)} />
                        )}
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                        r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-rose-600" : "text-muted-foreground"
                      }`}>{r.delta > 0 ? "+" : ""}<AnimatedNumber value={formatNumber(r.delta)} /></td>
                      <td className="py-2.5 px-3 text-right tabular-nums"><AnimatedNumber value={String(r.posts)} /></td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {r.pl.id === "youtube" ? (
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help hover:text-foreground inline-flex items-center gap-1 justify-end w-full">
                                <AnimatedNumber value={formatNumber(r.eng)} />
                                <Info className="size-3 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Likes & comments are omitted on YouTube to save API credits. Performance is tracked via views.
                            </TooltipContent>
                          </UITooltip>
                        ) : (
                          <AnimatedNumber value={formatNumber(r.eng)} />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {r.pl.id === "youtube" ? (
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help hover:text-foreground inline-flex items-center gap-1 justify-end w-full">
                                <AnimatedNumber value={formatNumber(Math.round(r.avgEng))} />
                                <Info className="size-3 text-muted-foreground/60" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Likes & comments are omitted on YouTube to save API credits. Performance is tracked via views.
                            </TooltipContent>
                          </UITooltip>
                        ) : (
                          <AnimatedNumber value={formatNumber(Math.round(r.avgEng))} />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums"><AnimatedNumber value={formatNumber(r.views)} /></td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground"><AnimatedNumber value={formatNumber(Math.round(r.avgViews))} /></td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                        {r.pl.id === "youtube" ? (
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help hover:text-foreground inline-flex items-center gap-1 justify-end w-full">
                                <AnimatedNumber value={formatPercent(r.er)} />
                                <Info className="size-3 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Likes & comments are omitted on YouTube to save API credits. Performance is tracked via views.
                            </TooltipContent>
                          </UITooltip>
                        ) : (
                          <AnimatedNumber value={formatPercent(r.er)} />
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Dynamic radar visualization */}
        <PlatformRadar rows={rows} />
      </section>

      {/* Engagement rate trend */}
      <section>
        <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="size-4 text-primary" />
            <h3 className="font-semibold">Engagement-rate trend</h3>
          </div>
          <p className="text-xs text-muted-foreground">Daily engagement rate (%) per platform</p>
          <ErTrendChart erTrend={erTrend} />
        </Card>
      </section>
    </>
  );
}

function ErTrendChart({ erTrend }: { erTrend: any[] }) {
  const [scale, setScale] = useState<"linear" | "log">(() => {
    // Auto-pick log when one platform dwarfs others (10× the median peak).
    const peaks: number[] = [];
    for (const pl of PLATFORMS) {
      let max = 0;
      for (const row of erTrend) {
        const v = Number(row[pl.id]);
        if (Number.isFinite(v) && v > max) max = v;
      }
      if (max > 0) peaks.push(max);
    }
    if (peaks.length < 2) return "linear";
    const sorted = [...peaks].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const top = sorted[sorted.length - 1];
    return median > 0 && top / median > 10 ? "log" : "linear";
  });

  // For log scale, zero values must be replaced with null so recharts skips them.
  const data = useMemo(() => {
    if (scale !== "log") return erTrend;
    return erTrend.map((row) => {
      const next: any = { ...row };
      for (const pl of PLATFORMS) {
        const v = Number(next[pl.id]);
        if (!Number.isFinite(v) || v <= 0) next[pl.id] = null;
      }
      return next;
    });
  }, [erTrend, scale]);

  return (
    <>
      <div className="flex justify-end mb-2">
        <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setScale("linear")}
            className={
              "px-2.5 py-1 rounded transition-colors " +
              (scale === "linear" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            Linear
          </button>
          <button
            type="button"
            onClick={() => setScale("log")}
            className={
              "px-2.5 py-1 rounded transition-colors " +
              (scale === "log" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            Log
          </button>
        </div>
      </div>
      <div className="h-60 sm:h-72">
        {erTrend.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState asCard={false} compact variant="no-data" title="No engagement-rate data" description="Try a wider date range." />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v) => `${Number(v) < 10 ? Number(v).toFixed(1) : Math.round(Number(v))}%`}
                {...(scale === "log"
                  ? { scale: "log" as const, domain: [0.01, "auto"] as [number, string], allowDataOverflow: true }
                  : {})}
              />
              <Tooltip content={<ChartTooltip valueFormat="percent" sortDesc />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {PLATFORMS.map((pl) => (
                <Line key={pl.id} type="monotone" dataKey={pl.id} name={pl.label}
                  stroke={`hsl(var(--${pl.color}))`} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

function InsightCard({ icon: Icon, title, primary, secondary, link, chip, accent = "primary" }: {
  icon: any; title: string; primary: string; secondary?: string; link?: string; chip?: string;
  accent?: "primary" | "accent" | "primary-glow";
}) {
  const Body = (
    <Card
      className="group relative overflow-hidden p-5 sm:p-6 border-border/60 hover:border-transparent shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:-translate-y-1 transition-all duration-300 h-full"
      style={{ background: "var(--gradient-card)" }}
    >
      {/* Top accent strip */}
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-90"
        style={{ background: `linear-gradient(90deg, hsl(var(--${accent})), hsl(var(--accent-glow)))` }}
      />
      {/* Glow orb */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full blur-3xl opacity-25 group-hover:opacity-45 transition-opacity"
        style={{ background: `hsl(var(--${accent}))` }}
      />
      {/* Header row */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex size-9 items-center justify-center rounded-xl text-primary-foreground shadow-md ring-1 ring-white/10"
            style={{ background: `linear-gradient(135deg, hsl(var(--${accent})), hsl(var(--accent-glow)))` }}
          >
            <Icon className="size-4" />
          </span>
          <span className="text-[11px] uppercase tracking-[0.16em] font-medium text-muted-foreground">{title}</span>
        </div>
        {chip && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/60 bg-background/60 text-muted-foreground">
            {chip}
          </span>
        )}
      </div>
      {/* Primary value */}
      <div
        className="relative text-2xl sm:text-3xl font-semibold tracking-tight break-words font-serif-display"
      >
        <AnimatedNumber value={primary} />
      </div>
      {secondary && (
        <div className="relative text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{secondary}</div>
      )}
    </Card>
  );
  return link ? <a href={link} target="_blank" rel="noreferrer" className="block h-full">{Body}</a> : Body;
}


type ComparisonRow = {
  pl: (typeof PLATFORMS)[number];
  followers: number;
  posts: number;
  eng: number;
  views: number;
  er: number;
};

function PlatformRadar({ rows }: { rows: ComparisonRow[] }) {
  const { data, platforms } = useMemo(() => {
    if (rows.length === 0) return { data: [], platforms: [] as ComparisonRow["pl"][] };
    const max = {
      Followers: Math.max(...rows.map((r) => r.followers), 1),
      Posts: Math.max(...rows.map((r) => r.posts), 1),
      Engagement: Math.max(...rows.map((r) => r.eng), 1),
      Views: Math.max(...rows.map((r) => r.views), 1),
      "Eng. Rate": Math.max(...rows.map((r) => r.er), 0.0001),
    } as const;
    const metricKeys = Object.keys(max) as (keyof typeof max)[];
    const valueOf = (r: ComparisonRow, m: keyof typeof max) => {
      switch (m) {
        case "Followers": return r.followers;
        case "Posts": return r.posts;
        case "Engagement": return r.eng;
        case "Views": return r.views;
        case "Eng. Rate": return r.er;
      }
    };
    const data = metricKeys.map((metric) => {
      const row: Record<string, number | string> = { metric };
      for (const r of rows) {
        row[r.pl.id] = Math.round((valueOf(r, metric) / max[metric]) * 100);
      }
      return row;
    });
    return { data, platforms: rows.map((r) => r.pl) };
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <Card
      className="relative overflow-hidden p-5 sm:p-6 shadow-[var(--shadow-card)] border-border/60"
      style={{ background: "var(--gradient-card)" }}
    >
      <div
        className="absolute -top-24 -right-24 size-64 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: "hsl(var(--primary))" }}
      />
      <div className="relative flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-primary font-medium mb-1">Live shape</div>
          <h3 className="text-lg sm:text-xl font-semibold tracking-tight">Platform DNA</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Each axis is normalized to the leading platform (100). Refreshes automatically with new data every 12 hours.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {platforms.map((pl) => (
            <span
              key={pl.id}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full"
              style={{
                background: `hsl(var(--${pl.color}) / 0.12)`,
                color: `hsl(var(--${pl.color}))`,
              }}
            >
              <span className="size-1.5 rounded-full" style={{ background: `hsl(var(--${pl.color}))` }} />
              {pl.label}
            </span>
          ))}
        </div>
      </div>

      <div className="h-72 sm:h-96 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="78%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickFormatter={(v) => `${v}`}
              stroke="hsl(var(--border))"
            />
            {platforms.map((pl) => (
              <Radar
                key={pl.id}
                name={pl.label}
                dataKey={pl.id}
                stroke={`hsl(var(--${pl.color}))`}
                fill={`hsl(var(--${pl.color}))`}
                fillOpacity={0.22}
                strokeWidth={2}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              />
            ))}
            <Tooltip
              content={<ChartTooltip valueFormat="number" sortDesc />}
              formatter={(v: number) => `${v} / 100`}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
