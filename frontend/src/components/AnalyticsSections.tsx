import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, getHours, getDay, differenceInCalendarDays } from "date-fns";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { Heart, MessageCircle, Share2, Eye, Hash, Clock, Calendar as CalIcon, Activity, Image as ImgIcon, Film } from "lucide-react";
import { PLATFORMS, platformMeta, formatNumber, formatPercent } from "@/lib/social";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { EmptyState } from "@/components/EmptyState";

type Post = {
  id: string; profile_id: string; posted_at: string | null; url: string | null; thumbnail_url: string | null;
  caption: string | null; likes: number; comments: number; shares: number; views: number;
  media_type?: string | null;
};
type Profile = { id: string; platform: string; handle: string };
type Snapshot = { profile_id: string; captured_at: string; followers: number | null };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AnalyticsSections({
  posts, profiles, snapshots, from, to, slice,
}: { posts: Post[]; profiles: Profile[]; snapshots: Snapshot[]; from: Date; to: Date; slice?: "hashtags-leaderboard" | "rest" }) {
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Posting frequency heatmap (day-of-week × hour)
  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    for (const p of posts) {
      if (!p.posted_at) continue;
      const d = new Date(p.posted_at);
      const dow = getDay(d), h = getHours(d);
      grid[dow][h]++;
      if (grid[dow][h] > max) max = grid[dow][h];
    }
    return { grid, max };
  }, [posts]);

  // Best hours to post — avg engagement per post by hour
  const hourlyEng = useMemo(() => {
    const sums = Array(24).fill(0).map(() => ({ eng: 0, count: 0 }));
    for (const p of posts) {
      if (!p.posted_at) continue;
      const h = getHours(new Date(p.posted_at));
      sums[h].eng += p.likes + p.comments + p.shares;
      sums[h].count++;
    }
    return sums.map((s, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      avg: s.count ? Math.round(s.eng / s.count) : 0,
      count: s.count,
    }));
  }, [posts]);

  // Engagement composition
  const engComposition = useMemo(() => {
    const totals = posts.reduce(
      (a, p) => ({ likes: a.likes + p.likes, comments: a.comments + p.comments, shares: a.shares + p.shares }),
      { likes: 0, comments: 0, shares: 0 }
    );
    return [
      { name: "Likes",    value: totals.likes,    color: "hsl(var(--primary))" },
      { name: "Comments", value: totals.comments, color: "hsl(var(--accent))" },
      { name: "Shares",   value: totals.shares,   color: "hsl(var(--primary-glow))" },
    ].filter((d) => d.value > 0);
  }, [posts]);

  // Media type breakdown
  const mediaTypes = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) {
      const k = (p.media_type || "post").toLowerCase();
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [posts]);

  // Top hashtags
  const topHashtags = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) {
      const tags = (p.caption || "").match(/#[\p{L}\p{N}_]+/gu) ?? [];
      for (const t of tags) {
        const k = t.toLowerCase();
        m.set(k, (m.get(k) || 0) + 1);
      }
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [posts]);

  // Follower growth deltas per platform
  const followerDeltas = useMemo(() => {
    const byPlat = new Map<string, { first: number; last: number; firstAt: number; lastAt: number }>();
    for (const s of snapshots) {
      const prof = profileMap.get(s.profile_id);
      if (!prof || s.followers == null) continue;
      const t = new Date(s.captured_at).getTime();
      if (t < from.getTime() || t > to.getTime()) continue;
      const cur = byPlat.get(prof.platform);
      if (!cur) { byPlat.set(prof.platform, { first: s.followers, last: s.followers, firstAt: t, lastAt: t }); continue; }
      if (t < cur.firstAt) { cur.first = s.followers; cur.firstAt = t; }
      if (t > cur.lastAt)  { cur.last  = s.followers; cur.lastAt  = t; }
    }
    return PLATFORMS.map((pl) => {
      const v = byPlat.get(pl.id);
      const delta = v ? v.last - v.first : 0;
      const pct = v && v.first > 0 ? delta / v.first : 0;
      return { platform: pl.label, color: pl.color, current: v?.last ?? 0, delta, pct };
    }).filter((d) => d.current > 0);
  }, [snapshots, profileMap, from, to]);

  // Caption length vs engagement (scatter)
  const lengthVsEng = useMemo(() => {
    return posts
      .filter((p) => p.caption)
      .map((p) => ({
        x: (p.caption || "").length,
        y: p.likes + p.comments + p.shares,
        z: p.views || 1,
      }))
      .filter((d) => d.x > 0 && d.x < 2200);
  }, [posts]);

  // Cumulative engagement over time (aggregated per day)
  const cumulative = useMemo(() => {
    const sorted = [...posts].filter((p) => p.posted_at).sort((a, b) =>
      new Date(a.posted_at!).getTime() - new Date(b.posted_at!).getTime());
    const buckets = new Map<string, { day: string; ts: number; total: number }>();
    let total = 0;
    for (const p of sorted) {
      total += p.likes + p.comments + p.shares;
      const d = new Date(p.posted_at!);
      const key = format(d, "yyyy-MM-dd");
      buckets.set(key, { day: format(d, "MMM d"), ts: d.getTime(), total });
    }
    return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts).map(({ ts, ...rest }) => rest);
  }, [posts]);

  // Performance leaderboard
  const leaderboard = useMemo(() => {
    return [...posts]
      .map((p) => ({
        ...p,
        eng: p.likes + p.comments + p.shares,
        platform: profileMap.get(p.profile_id)?.platform ?? "—",
      }))
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10);
  }, [posts, profileMap]);

  // Posting cadence
  const cadence = useMemo(() => {
    const days = Math.max(1, differenceInCalendarDays(to, from) || 1);
    return {
      perDay: posts.length / days,
      totalPosts: posts.length,
      activeDays: new Set(posts.filter((p) => p.posted_at).map((p) => format(new Date(p.posted_at!), "yyyy-MM-dd"))).size,
      days,
    };
  }, [posts, from, to]);

  return (
    <>
      {slice !== "hashtags-leaderboard" && (<div className="space-y-6 md:space-y-8">
      {/* Follower growth deltas */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold font-serif-display">Audience growth</h2>
            <p className="text-sm text-muted-foreground">Net follower change in selected range, per platform</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {followerDeltas.map((d) => (
            <Card key={d.platform} className="p-5 shadow-[var(--shadow-card)]">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{d.platform}</div>
              <div className="text-2xl font-semibold mt-2 font-serif-display">{formatNumber(d.current)}</div>
              <div className={cn(
                "text-xs mt-2 font-medium",
                d.delta > 0 ? "text-emerald-600" : d.delta < 0 ? "text-rose-600" : "text-muted-foreground",
              )}>
                {d.delta > 0 ? "+" : ""}{formatNumber(d.delta)} ({(d.pct * 100).toFixed(2)}%)
              </div>
            </Card>
          ))}
          {followerDeltas.length === 0 && (
            <Card className="p-4 col-span-full text-sm text-muted-foreground text-center">
              Need at least two snapshots in the range to compute growth.
            </Card>
          )}
        </div>
      </section>

      {/* Posting cadence + engagement composition + media type */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-3">
            <Activity className="size-3.5" /> Posting cadence
          </div>
          <div className="grid grid-cols-3 gap-3">
            <CadenceStat label="Posts" value={String(cadence.totalPosts)} />
            <CadenceStat label="Per day" value={cadence.perDay.toFixed(1)} />
            <CadenceStat label="Active days" value={`${cadence.activeDays}/${cadence.days}`} />
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Posting on {((cadence.activeDays / cadence.days) * 100).toFixed(0)}% of days in range.
          </div>
        </Card>

        <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold mb-1">Engagement composition</h3>
          <p className="text-xs text-muted-foreground mb-4">Likes vs comments vs shares</p>
          <div className="h-48">
            {engComposition.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={engComposition} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75} paddingAngle={2}>
                    {engComposition.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip sortDesc hideTitle />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold mb-1">Content format mix</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribution of media types</p>
          <div className="h-48">
            {mediaTypes.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mediaTypes} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={70} />
                  <Tooltip content={<ChartTooltip hideTitle />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>

      {/* Best time to post */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 sm:p-5 lg:col-span-2 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="size-4 text-primary" />
            <h3 className="font-semibold">Best time to post</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Average engagement per post, by hour of day</p>
          <div className="h-60 sm:h-72">
            {posts.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyEng}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={2} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatNumber(v as number)} />
                  <Tooltip content={(p: any) => {
                    if (!p.active || !p.payload?.length) return null;
                    const d = p.payload[0]?.payload;
                    return (
                      <ChartTooltip
                        active
                        payload={[{ name: "Avg engagement", value: d?.avg, color: "hsl(var(--accent))" }]}
                        titleOverride={`${p.label}:00`}
                        subtitle={`${d?.count ?? 0} posts`}
                      />
                    );
                  }} />
                  <Bar dataKey="avg" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 mb-1">
            <CalIcon className="size-4 text-primary" />
            <h3 className="font-semibold">Posting heatmap</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Day of week × hour</p>
          <Heatmap grid={heatmap.grid} max={heatmap.max} />
        </Card>
      </section>

      {/* Cumulative engagement + Caption length scatter */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold mb-1">Cumulative engagement</h3>
          <p className="text-xs text-muted-foreground mb-4">Running total over the period</p>
          <div className="h-64">
            {cumulative.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulative}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatNumber(v as number)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line dataKey="total" type="monotone" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold mb-1">Caption length vs engagement</h3>
          <p className="text-xs text-muted-foreground mb-4">Does writing more drive more interaction?</p>
          <div className="h-64">
            {lengthVsEng.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" dataKey="x" name="Length" stroke="hsl(var(--muted-foreground))" fontSize={11} unit=" ch" />
                  <YAxis type="number" dataKey="y" name="Engagement" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatNumber(v as number)} />
                  <ZAxis type="number" dataKey="z" range={[20, 200]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={(p: any) => {
                    if (!p.active || !p.payload?.length) return null;
                    const d = p.payload[0]?.payload;
                    return (
                      <ChartTooltip
                        active
                        hideTitle
                        payload={[
                          { name: "Caption length", value: `${d?.x} chars`, color: "hsl(var(--muted-foreground))" },
                          { name: "Engagement", value: d?.y, color: "hsl(var(--accent))" },
                        ]}
                      />
                    );
                  }} />
                  <Scatter data={lengthVsEng} fill="hsl(var(--accent))" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>
      </div>)}

      {slice !== "rest" && (
      <section className="space-y-4">
        {/* Full-width performance leaderboard */}
        <Card className="relative overflow-hidden p-5 sm:p-7 shadow-[var(--shadow-card)] border-border/60" style={{ background: "var(--gradient-card)" }}>
          <div
            className="absolute -top-24 -right-24 size-72 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: "hsl(var(--primary))" }}
          />
          <div
            className="absolute -bottom-24 -left-24 size-72 rounded-full blur-3xl opacity-15 pointer-events-none"
            style={{ background: "hsl(var(--accent))" }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-primary font-medium mb-1">Highlights</div>
              <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">Performance leaderboard</h3>
              <p className="text-xs text-muted-foreground mt-1">The 10 highest-engagement posts in the selected range, ranked by interactions.</p>
            </div>
            <Badge variant="secondary" className="gap-1.5"><Activity className="size-3" />Top {leaderboard.length}</Badge>
          </div>

          {leaderboard.length === 0 ? <Empty /> : (() => {
            const maxEng = Math.max(...leaderboard.map((p) => p.eng), 1);
            return (
              <ul className="relative space-y-2">
                {leaderboard.map((p, i) => {
                  const meta = platformMeta[p.platform];
                  const Icon = meta?.icon;
                  const pct = (p.eng / maxEng) * 100;
                  const isTop = i < 3;
                  const rankColors = ["from-amber-400 to-yellow-600", "from-slate-300 to-slate-500", "from-orange-400 to-amber-700"];
                  return (
                    <li key={p.id}>
                      <a
                        href={p.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative grid grid-cols-[auto_auto_1fr_auto] sm:grid-cols-[auto_64px_auto_1fr_auto] items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-2xl bg-card/50 hover:bg-card border border-border/40 hover:border-border hover:shadow-[var(--shadow-elegant)] transition-all duration-300"
                      >
                        {/* Rank */}
                        <div
                          className={`size-9 sm:size-10 rounded-xl flex items-center justify-center text-sm font-bold tracking-tight shrink-0 ${
                            isTop
                              ? `bg-gradient-to-br ${rankColors[i]} text-white shadow-md`
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {i + 1}
                        </div>

                        {/* Thumbnail (hidden on mobile) */}
                        <div className="hidden sm:block size-16 rounded-xl overflow-hidden bg-muted shrink-0 ring-1 ring-border/60">
                          {p.thumbnail_url ? (
                            <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                          ) : (
                            Icon && <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><Icon className="size-6" /></div>
                          )}
                        </div>

                        {/* Platform pill */}
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0"
                          style={{
                            background: meta ? `hsl(var(--${meta.color}) / 0.12)` : undefined,
                            color: meta ? `hsl(var(--${meta.color}))` : undefined,
                          }}
                        >
                          {Icon && <Icon className="size-3" />}
                          {meta?.label ?? p.platform}
                        </span>

                        {/* Caption + bar */}
                        <div className="min-w-0">
                          <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">{p.caption || "—"}</p>
                          <div className="mt-1.5 h-1 w-full bg-muted/60 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: meta
                                  ? `linear-gradient(90deg, hsl(var(--${meta.color})), hsl(var(--${meta.color}) / 0.5))`
                                  : "hsl(var(--primary))",
                              }}
                            />
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="flex items-center gap-3 sm:gap-4 text-xs tabular-nums shrink-0">
                          <span className="hidden sm:flex items-center gap-1 text-muted-foreground"><Heart className="size-3" />{formatNumber(p.likes)}</span>
                          <span className="hidden md:flex items-center gap-1 text-muted-foreground"><MessageCircle className="size-3" />{formatNumber(p.comments)}</span>
                          <span className="hidden md:flex items-center gap-1 text-muted-foreground"><Share2 className="size-3" />{formatNumber(p.shares)}</span>
                          <span className="flex items-center gap-1 font-semibold text-foreground"><Eye className="size-3.5" />{formatNumber(p.views)}</span>
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </Card>

        {/* Infinite hashtag marquee */}
        <Card className="relative overflow-hidden p-5 sm:p-6 shadow-[var(--shadow-card)] border-border/60">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Hash className="size-4 text-primary" />
              <h3 className="font-semibold tracking-tight">Top hashtags</h3>
            </div>
            <p className="text-xs text-muted-foreground">Most used in captions · {topHashtags.length} tags</p>
          </div>

          {topHashtags.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">No hashtags found</div>
          ) : (
            <div className="relative group">
              {/* edge fades */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 z-10 bg-gradient-to-r from-card to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 z-10 bg-gradient-to-l from-card to-transparent" />

              <div className="flex overflow-hidden">
                <div className="flex shrink-0 gap-3 animate-marquee group-hover:[animation-play-state:paused] pr-3">
                  {topHashtags.map(([tag, count]) => (
                    <HashtagChip key={`a-${tag}`} tag={tag} count={count} />
                  ))}
                </div>
                <div aria-hidden="true" className="flex shrink-0 gap-3 animate-marquee group-hover:[animation-play-state:paused] pr-3">
                  {topHashtags.map(([tag, count]) => (
                    <HashtagChip key={`b-${tag}`} tag={tag} count={count} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>
      )}
    </>
  );
}

const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 };

function Empty() {
  return (
    <div className="h-full flex items-center justify-center">
      <EmptyState variant="no-data" compact asCard={false} title="No data in range" description="Adjust filters or pick a wider date range." />
    </div>
  );
}

function HashtagChip({ tag, count }: { tag: string; count: number }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 border border-border/60 hover:border-primary/40 hover:from-primary/20 hover:to-accent/15 transition-all duration-300 shrink-0">
      <span className="text-sm font-semibold tracking-tight">{tag}</span>
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/15 text-primary tabular-nums">{count}</span>
    </div>
  );
}

function CadenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold text-lg mt-0.5 font-serif-display">{value}</div>
    </div>
  );
}

function Heatmap({ grid, max }: { grid: number[][]; max: number }) {
  return (
    <div className="space-y-1">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: "auto repeat(24, minmax(0,1fr))" }}>
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="text-[8px] text-muted-foreground text-center">{h % 3 === 0 ? h : ""}</div>
        ))}
        {grid.map((row, dow) => (
          <Row key={dow} dow={dow} row={row} max={max} />
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground text-center pt-1">Hours (UTC)</div>
    </div>
  );
}

function Row({ dow, row, max }: { dow: number; row: number[]; max: number }) {
  return (
    <>
      <div className="text-[10px] text-muted-foreground pr-1 self-center">{DOW[dow]}</div>
      {row.map((v, h) => {
        const intensity = max > 0 ? v / max : 0;
        return (
          <div key={h}
            className="aspect-square rounded-sm"
            title={`${DOW[dow]} ${h}:00 — ${v} post${v === 1 ? "" : "s"}`}
            style={{ background: v === 0 ? "hsl(var(--muted))" : `hsl(var(--primary) / ${0.15 + intensity * 0.85})` }}
          />
        );
      })}
    </>
  );
}

// minimal local cn to avoid extra import
function cn(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }
