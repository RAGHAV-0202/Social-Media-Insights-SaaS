import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  format, isSameMonth, isToday,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, CalendarDays, Heart, MessageCircle,
  Sparkles, Flame, TrendingUp,
} from "lucide-react";
import { Thumbnail, pickGradient } from "@/components/Thumbnail";
import { platformMeta, formatNumber } from "@/lib/social";
import { cn } from "@/lib/utils";

type Post = {
  id: string; profile_id: string; posted_at: string | null; thumbnail_url: string | null;
  caption: string | null; likes: number; comments: number; shares: number; views: number;
};
type Profile = { id: string; platform: string; handle: string };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ContentCalendar({
  posts,
  profiles,
  initialMonth,
  onOpenPost,
}: {
  posts: Post[];
  profiles: Profile[];
  initialMonth?: Date;
  onOpenPost?: (id: string) => void;
}) {
  const [cursor, setCursor] = useState<Date>(
    startOfMonth(initialMonth ?? (posts[0]?.posted_at ? new Date(posts[0].posted_at) : new Date())),
  );
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  // Group posts by yyyy-MM-dd
  const byDay = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of posts) {
      if (!p.posted_at) continue;
      const key = format(new Date(p.posted_at), "yyyy-MM-dd");
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    }
    m.forEach((arr) => arr.sort((a, b) => (b.views || 0) - (a.views || 0)));
    return m;
  }, [posts]);

  // Build day cells
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  // Month-scope stats for heat intensity + hero day
  const { monthPostCount, monthTotalEng, peakDayKey, peakDayEng, maxDayEng } = useMemo(() => {
    let count = 0, total = 0, peakKey: string | null = null, peakEng = 0, max = 0;
    for (const [key, arr] of byDay) {
      const d = new Date(key);
      if (d < monthStart || d > monthEnd) continue;
      count += arr.length;
      const eng = arr.reduce((s, p) => s + p.likes + p.comments + p.shares, 0);
      total += eng;
      if (eng > max) max = eng;
      if (eng > peakEng) { peakEng = eng; peakKey = key; }
    }
    return { monthPostCount: count, monthTotalEng: total, peakDayKey: peakKey, peakDayEng: peakEng, maxDayEng: max };
  }, [byDay, monthStart, monthEnd]);


  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-1">
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80 font-semibold flex items-center gap-2">
            <span className="size-1 rounded-full bg-primary" />
            Calendar
          </div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2 font-serif-display">
            <CalendarDays className="size-5 text-primary" />
            Content calendar
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Every post laid out by day. The colored rail shows engagement heat — brighter means hotter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCursor((c) => subMonths(c, 1))} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <div className="px-2 text-sm font-medium tabular-nums min-w-[110px] text-center">
              {format(cursor, "MMMM yyyy")}
            </div>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setCursor(startOfMonth(new Date()))}>
              Today
            </Button>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatPill icon={CalendarDays} label="Posts this month" value={String(monthPostCount)} tint="text-primary" />
        <StatPill icon={Heart} label="Total engagement" value={formatNumber(monthTotalEng)} tint="text-rose-500" />
        <StatPill
          icon={Flame}
          label="Peak day"
          value={peakDayKey ? format(new Date(peakDayKey), "MMM d") : "—"}
          sub={peakDayKey ? formatNumber(peakDayEng) + " eng" : undefined}
          tint="text-orange-500"
        />
        <StatPill
          icon={TrendingUp}
          label="Avg / active day"
          value={
            monthPostCount > 0 && byDay.size > 0
              ? formatNumber(Math.round(monthTotalEng / Math.max(1, Array.from(byDay.keys()).filter((k) => {
                  const d = new Date(k); return d >= monthStart && d <= monthEnd;
                }).length)))
              : "—"
          }
          tint="text-emerald-500"
        />
      </div>

      <Card
        className="p-3 sm:p-4 border-border/60 shadow-[var(--shadow-card)] overflow-hidden"
        style={{ background: "var(--gradient-card)" }}
      >
        {/* DOW header */}
        <div className="grid grid-cols-7 mb-2">
          {DOW.map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-[10px] uppercase tracking-wider text-center pb-2 font-semibold",
                i === 0 || i === 6 ? "text-primary/70" : "text-muted-foreground",
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = byDay.get(key) ?? [];
            const outOfMonth = !isSameMonth(day, cursor);
            const isCurrentDay = isToday(day);
            const totalEng = dayPosts.reduce((s, p) => s + p.likes + p.comments + p.shares, 0);
            const visible = dayPosts.slice(0, 3);
            const extra = dayPosts.length - visible.length;
            const isPeak = key === peakDayKey && dayPosts.length > 0;

            const topPost = dayPosts[0];
            const bgUrl = dayPosts.find((p) => p.thumbnail_url)?.thumbnail_url || null;
            const fallbackGradient = !bgUrl && topPost ? pickGradient(topPost.id) : null;
            const hasBg = (bgUrl || fallbackGradient) && !outOfMonth;
            

            // unique platforms posted that day
            const platforms = Array.from(
              new Set(dayPosts.map((p) => profileMap.get(p.profile_id)?.platform).filter(Boolean) as string[]),
            );

            return (
              <div
                key={key}
                className={cn(
                  "group relative isolate rounded-xl border p-1.5 min-h-[100px] sm:min-h-[120px] flex flex-col gap-1 overflow-hidden",
                  "transition-all duration-300 ease-out",
                  !outOfMonth && "hover:-translate-y-1 hover:scale-[1.03] hover:shadow-[var(--shadow-elegant)] hover:border-primary/50 hover:z-10",
                  outOfMonth
                    ? "bg-muted/10 border-border/30 opacity-50"
                    : dayPosts.length === 0
                      ? "bg-background/40 border-border/40 border-dashed"
                      : "bg-background/60 border-border/60",
                  isCurrentDay && "ring-2 ring-primary/70 border-primary/70",
                  isPeak && "ring-1 ring-orange-400/60",
                )}
              >

                {hasBg && (
                  <>
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-cover bg-center opacity-55 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 ease-out"
                      style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : { backgroundImage: fallbackGradient! }}
                    />
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/75 to-background/35 group-hover:from-background/80 group-hover:via-background/40 group-hover:to-background/10 transition-all duration-500" />
                  </>
                )}

                {/* Peak-day shimmer */}
                {isPeak && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-8 -right-8 size-20 rounded-full bg-orange-400/30 blur-2xl"
                  />
                )}

                {/* Today's pulse dot */}
                {isCurrentDay && (
                  <span aria-hidden className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                )}

                {/* Top row: date + engagement */}
                <div className="relative flex items-center justify-between pl-1">
                  <span
                    className={cn(
                      "text-[10px] sm:text-xs tabular-nums font-bold px-1.5 py-0.5 rounded-md",
                      isCurrentDay
                        ? "bg-primary text-primary-foreground"
                        : isPeak
                          ? "bg-orange-500/15 text-orange-600"
                          : outOfMonth
                            ? "text-muted-foreground"
                            : "text-foreground",
                      hasBg && !isCurrentDay && !isPeak && "bg-background/70 backdrop-blur-sm",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex items-center gap-1">
                    {isPeak && (
                      <Sparkles className="size-3 text-orange-500" aria-label="Top engagement day" />
                    )}
                    {totalEng > 0 && (
                      <span
                        className={cn(
                          "text-[9px] tabular-nums font-semibold px-1.5 py-0.5 rounded",
                          hasBg ? "bg-background/80 backdrop-blur-sm text-foreground" : "bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {formatNumber(totalEng)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Platform dots */}
                {platforms.length > 0 && (
                  <div className="relative flex items-center gap-0.5 pl-1">
                    {platforms.map((pl) => (
                      <span
                        key={pl}
                        title={platformMeta[pl]?.label ?? pl}
                        className="size-1.5 rounded-full"
                        style={{ background: `hsl(var(--${platformMeta[pl]?.color ?? "primary"}))` }}
                      />
                    ))}
                  </div>
                )}

                {/* Thumbnails */}
                <div className="relative mt-auto flex flex-wrap gap-1 pl-1">
                  {visible.map((p) => {
                    const prof = profileMap.get(p.profile_id);
                    const platColor = prof ? `var(--${platformMeta[prof.platform]?.color ?? "primary"})` : "var(--primary)";
                    return (
                      <button
                        key={p.id}
                        onClick={() => onOpenPost?.(p.id)}
                        title={`${prof ? "@" + prof.handle + " · " : ""}${formatNumber(p.likes)} ♥ · ${formatNumber(p.comments)} 💬`}
                        className="relative size-7 sm:size-9 rounded-md overflow-hidden ring-1 ring-border/60 hover:ring-2 hover:ring-primary hover:scale-110 transition-all"
                      >
                        <Thumbnail src={p.thumbnail_url} alt={p.caption ?? ""} fallbackSeed={p.id} />
                        <span
                          className="absolute inset-x-0 bottom-0 h-[3px] opacity-90"
                          style={{ background: `hsl(${platColor})` }}
                        />
                      </button>
                    );
                  })}
                  {extra > 0 && (
                    <button
                      onClick={() => onOpenPost?.(dayPosts[3].id)}
                      className="size-7 sm:size-9 rounded-md bg-background/80 backdrop-blur-sm ring-1 ring-border/60 hover:ring-primary text-[10px] sm:text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
                      title={`${extra} more post${extra === 1 ? "" : "s"}`}
                    >
                      +{extra}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3 text-like fill-like" /> + <MessageCircle className="size-3" /> + shares = engagement
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="size-3 text-orange-500" /> Peak day
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-primary" /> Today
          </span>
        </div>
      </Card>
    </section>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  sub?: string;
  tint?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("size-3.5", tint ?? "text-primary")} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold tabular-nums tracking-tight font-serif-display">
          {value}
        </span>
        {sub && <span className="text-[10px] text-muted-foreground font-medium">{sub}</span>}
      </div>
    </div>
  );
}
