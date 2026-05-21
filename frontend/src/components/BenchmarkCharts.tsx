import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { differenceInCalendarDays, format } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatNumber, formatPercent, PLATFORMS } from "@/lib/social";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "@/components/charts/ChartTooltip";

type Profile = { id: string; platform: string };
type Snapshot = { profile_id: string; captured_at: string; followers: number | null };
type Post = { profile_id: string; posted_at: string | null; likes: number; comments: number; shares: number; views: number };

type Props = {
  posts: Post[];          // already filtered by profile
  allPosts: Post[];       // unfiltered by date — needed for previous period
  profiles: Profile[];
  snapshots: Snapshot[];
  from: Date;
  to: Date;
};

export function BenchmarkCharts({ posts, allPosts, profiles, snapshots, from, to }: Props) {
  const profileIds = useMemo(() => new Set(profiles.map((p) => p.id)), [profiles]);
  const rangeMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - rangeMs);
  const prevTo = new Date(from.getTime());
  const days = Math.max(1, differenceInCalendarDays(to, from) + 1);

  // Build per-day-index series (0..days-1) for current and previous periods
  const engagementSeries = useMemo(() => {
    const arr = Array.from({ length: days }, (_, i) => ({
      label: `Day ${i + 1}`,
      current: 0,
      previous: 0,
    }));
    for (const p of allPosts) {
      if (!p.posted_at || !profileIds.has(p.profile_id)) continue;
      const t = new Date(p.posted_at).getTime();
      const eng = p.likes + p.comments + p.shares;
      if (t >= from.getTime() && t <= to.getTime()) {
        const idx = Math.min(days - 1, Math.floor((t - from.getTime()) / (1000 * 60 * 60 * 24)));
        arr[idx].current += eng;
      } else if (t >= prevFrom.getTime() && t < prevTo.getTime()) {
        const idx = Math.min(days - 1, Math.floor((t - prevFrom.getTime()) / (1000 * 60 * 60 * 24)));
        arr[idx].previous += eng;
      }
    }
    return arr;
  }, [allPosts, profileIds, from, to, days]);

  const totals = useMemo(() => {
    const cur = engagementSeries.reduce((s, d) => s + d.current, 0);
    const prev = engagementSeries.reduce((s, d) => s + d.previous, 0);
    return { cur, prev, delta: prev > 0 ? (cur - prev) / prev : null };
  }, [engagementSeries]);

  // Follower growth per platform: delta over current period vs previous period.
  // valueAt picks the snapshot at-or-before `target`; if none exists (data
  // history starts inside the requested window), it falls back to the
  // earliest snapshot we DO have so previous-period comparison stays useful.
  const followerGrowth = useMemo(() => {
    return PLATFORMS.map((pl) => {
      const ids = new Set(profiles.filter((p) => p.platform === pl.id).map((p) => p.id));
      if (ids.size === 0) return null;
      const snaps = snapshots
        .filter((s) => ids.has(s.profile_id))
        .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime());
      if (snaps.length === 0) return null;

      const valueAt = (target: Date): number | null => {
        let chosen: Snapshot | null = null;
        for (const s of snaps) {
          if (new Date(s.captured_at).getTime() <= target.getTime()) chosen = s;
          else break;
        }
        // Fallback: target predates our earliest snapshot — use the first one
        // so we don't lose the entire comparison.
        if (!chosen) chosen = snaps[0];
        return chosen?.followers ?? null;
      };

      const curStart = valueAt(from);
      const curEnd = valueAt(to);
      const prevStart = valueAt(prevFrom);
      const prevEnd = valueAt(prevTo);

      const curGrowth = curStart != null && curEnd != null ? curEnd - curStart : 0;
      const prevGrowth = prevStart != null && prevEnd != null ? prevEnd - prevStart : 0;
      return { name: pl.label, color: `hsl(var(--${pl.color}))`, current: curGrowth, previous: prevGrowth };
    }).filter((x): x is NonNullable<typeof x> => !!x && (x.current !== 0 || x.previous !== 0));
  }, [profiles, snapshots, from, to, prevFrom, prevTo]);

  const totalCurGrowth = followerGrowth.reduce((s, d) => s + d.current, 0);
  const totalPrevGrowth = followerGrowth.reduce((s, d) => s + d.previous, 0);
  // Delta semantics:
  //   - both zero → no movement to compare, return null
  //   - prev zero but cur non-zero → "new" growth, return null and let badge show "New"
  //   - otherwise % change vs |prev|
  const growthDelta =
    totalPrevGrowth !== 0
      ? (totalCurGrowth - totalPrevGrowth) / Math.abs(totalPrevGrowth)
      : null;
  const growthIsNew = totalPrevGrowth === 0 && totalCurGrowth !== 0;

  const periodLabel = `${format(from, "MMM d")} – ${format(to, "MMM d")}`;
  const prevLabel = `${format(prevFrom, "MMM d")} – ${format(prevTo, "MMM d")}`;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xl font-semibold">Period benchmarks</h3>
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{periodLabel}</span> vs previous{" "}
            <span className="text-foreground font-medium">{prevLabel}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Engagement comparison */}
        <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="font-semibold">Engagement vs previous period</h4>
              <p className="text-xs text-muted-foreground">Likes + comments + shares per day</p>
            </div>
            <DeltaBadge value={totals.delta} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="This period" value={formatNumber(totals.cur)} accent="primary" />
            <Stat label="Previous" value={formatNumber(totals.prev)} accent="muted" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={engagementSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatNumber(v as number)} />
                <Tooltip content={<ChartTooltip sortDesc />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" name="This period" dataKey="current" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                <Line type="monotone" name="Previous" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Follower growth comparison */}
        <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="font-semibold">Follower growth vs previous</h4>
              <p className="text-xs text-muted-foreground">Net new followers per platform</p>
            </div>
            <DeltaBadge value={growthDelta} isNew={growthIsNew} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat label="This period" value={`${totalCurGrowth >= 0 ? "+" : ""}${formatNumber(totalCurGrowth)}`} accent="primary" />
            <Stat label="Previous" value={`${totalPrevGrowth >= 0 ? "+" : ""}${formatNumber(totalPrevGrowth)}`} accent="muted" />
          </div>
          <div className="h-64">
            {followerGrowth.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Not enough snapshot history to compare
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={followerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatNumber(v as number)} />
                  <Tooltip content={<ChartTooltip sortDesc />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar name="This period" dataKey="current" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar name="Previous" dataKey="previous" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function DeltaBadge({ value, isNew }: { value: number | null; isNew?: boolean }) {
  if (value == null) {
    if (isNew) {
      return (
        <Badge variant="secondary" className="gap-1 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="size-3" /> New growth
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">No prior data</Badge>;
  }
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 text-xs",
        positive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      )}
    >
      <Icon className="size-3" /> {positive ? "+" : ""}{formatPercent(value)}
    </Badge>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: "primary" | "muted" }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold", accent === "primary" ? "text-foreground" : "text-muted-foreground")}>{value}</div>
    </div>
  );
}
