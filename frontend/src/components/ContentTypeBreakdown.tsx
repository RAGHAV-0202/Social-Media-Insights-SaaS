import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Film, Image as ImageIcon, Layers, FileText, Music2, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/social";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { EmptyState } from "@/components/EmptyState";

type Post = {
  id: string; profile_id: string; posted_at: string | null;
  likes: number; comments: number; shares: number; views: number;
  media_type?: string | null;
};

type TypeKey = "video" | "image" | "reel" | "carousel" | "text" | "other";

const TYPE_META: Record<TypeKey, { label: string; icon: LucideIcon; color: string }> = {
  reel:     { label: "Reels",     icon: Film,      color: "var(--instagram)" },
  video:    { label: "Videos",    icon: Video,     color: "var(--youtube)" },
  image:    { label: "Images",    icon: ImageIcon, color: "var(--primary)" },
  carousel: { label: "Carousels", icon: Layers,    color: "var(--accent)" },
  text:     { label: "Text",      icon: FileText,  color: "var(--twitter)" },
  other:    { label: "Other",     icon: Music2,    color: "var(--muted-foreground)" },
};

const normalize = (raw?: string | null): TypeKey => {
  const t = (raw ?? "").toLowerCase();
  if (!t) return "other";
  if (t.includes("reel") || t.includes("short")) return "reel";
  if (t.includes("video") || t.includes("clip")) return "video";
  if (t.includes("carousel") || t.includes("album") || t.includes("sidecar")) return "carousel";
  if (t.includes("image") || t.includes("photo") || t.includes("picture")) return "image";
  if (t.includes("text") || t.includes("status") || t.includes("tweet")) return "text";
  return "other";
};

export function ContentTypeBreakdown({ posts }: { posts: Post[] }) {
  const rows = useMemo(() => {
    const map = new Map<TypeKey, { count: number; eng: number; views: number }>();
    for (const p of posts) {
      const k = normalize(p.media_type);
      const cur = map.get(k) ?? { count: 0, eng: 0, views: 0 };
      cur.count += 1;
      cur.eng += p.likes + p.comments + p.shares;
      cur.views += p.views;
      map.set(k, cur);
    }
    const arr = Array.from(map.entries()).map(([key, v]) => ({
      key,
      label: TYPE_META[key].label,
      icon: TYPE_META[key].icon,
      color: TYPE_META[key].color,
      count: v.count,
      eng: v.eng,
      views: v.views,
      avgEng: v.count ? Math.round(v.eng / v.count) : 0,
      avgViews: v.count ? Math.round(v.views / v.count) : 0,
    }));
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [posts]);

  const totalPosts = rows.reduce((s, r) => s + r.count, 0);

  if (rows.length === 0) {
    return (
      <Card className="p-6 border-border/60 shadow-[var(--shadow-card)]" style={{ background: "var(--gradient-card)" }}>
        <EmptyState variant="no-data" compact asCard={false} title="No content yet" description="No posts in the selected range." />
      </Card>
    );
  }

  const topByAvg = [...rows].sort((a, b) => b.avgEng - a.avgEng)[0];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-1">
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80 font-semibold flex items-center gap-2">
            <span className="size-1 rounded-full bg-primary" />
            Content mix
          </div>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight font-serif-display">
            Content type breakdown
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            Volume vs. average engagement by format. {topByAvg && (
              <>
                <strong className="text-foreground">{topByAvg.label}</strong> drive the highest avg engagement
                ({formatNumber(topByAvg.avgEng)} per post).
              </>
            )}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{totalPosts} posts</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Type cards */}
        <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
          {rows.map((r) => {
            const Icon = r.icon;
            const pct = totalPosts ? (r.count / totalPosts) * 100 : 0;
            return (
              <Card
                key={r.key}
                className="p-4 border-border/60 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-shadow"
                style={{ background: "var(--gradient-card)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-8 rounded-lg flex items-center justify-center text-white ring-1 ring-white/15"
                      style={{ background: `linear-gradient(135deg, hsl(${r.color}), hsl(${r.color} / 0.7))` }}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="font-semibold text-sm">{r.label}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{formatNumber(r.count)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Posts</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold tabular-nums">{formatNumber(r.avgEng)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg eng.</div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: `hsl(${r.color})` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Chart */}
        <Card
          className="p-4 sm:p-5 lg:col-span-2 border-border/60 shadow-[var(--shadow-card)]"
          style={{ background: "var(--gradient-card)" }}
        >
          <div className="flex items-start justify-between mb-1 gap-3">
            <div>
              <h3 className="font-semibold tracking-tight">Average engagement per post</h3>
              <p className="text-xs text-muted-foreground">Which formats earn the most interactions on average</p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Avg</Badge>
          </div>
          <div className="h-64 sm:h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 6, right: 8, left: -8, bottom: 0 }} barCategoryGap="28%" barSize={42} maxBarSize={64}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatNumber(v as number)} width={48} />
                <Tooltip content={<ChartTooltip sortDesc />} cursor={{ fill: "hsl(var(--primary) / 0.05)" }} />
                <Bar dataKey="avgEng" name="Avg engagement" radius={[6, 6, 0, 0]}>
                  {rows.map((r, i) => (
                    <Cell key={i} fill={`hsl(${r.color})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </section>
  );
}
