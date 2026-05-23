import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowUp, SlidersHorizontal, ChevronDown, Menu, LayoutDashboard, 
  Radio, FolderHeart, CalendarDays, TableProperties, Sparkles, RefreshCw, 
  TrendingUp, TrendingDown, Users, Eye, Heart, ExternalLink, MessageCircle, 
  Share2, Play, X, BarChart3, ArrowRight, Download, FileText, Settings, LogOut, Loader2, CalendarIcon, Info,
  CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, subDays, addHours, startOfDay, endOfDay, differenceInCalendarDays } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { cn, smoothScrollTo } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORMS, platformMeta, formatNumber, formatPercent, type PlatformId } from "@/lib/social";
import { Thumbnail } from "@/components/Thumbnail";
import { PostDetailsDialog } from "@/components/PostDetailsDialog";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { EmptyState } from "@/components/EmptyState";
import { ChartSkeleton, PlatformCardSkeleton, PostsTableSkeleton, TopPostsSkeleton, KpiBentoSkeleton } from "@/components/DashboardSkeletons";
import { Reveal } from "@/components/Reveal";
import { AnimatedNumber, DataRefreshProvider } from "@/components/AnimatedNumber";
import { 
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { GeminiInsightsPanel, type WeeklySummaryStats } from "@/components/GeminiInsightsPanel";

// Lazy-loaded heavy below-the-fold sections
const AnalyticsSections = lazy(() =>
  import("@/components/AnalyticsSections").then((m) => ({ default: m.AnalyticsSections })),
);
const ContentFeed = lazy(() =>
  import("@/components/ContentFeed").then((m) => ({ default: m.ContentFeed })),
);
const ContentCalendar = lazy(() =>
  import("@/components/ContentCalendar").then((m) => ({ default: m.ContentCalendar })),
);
const PlatformDnaRadar = lazy(() =>
  import("@/components/PlatformDnaRadar").then((m) => ({ default: m.PlatformDnaRadar })),
);
const BenchmarkCharts = lazy(() =>
  import("@/components/BenchmarkCharts").then((m) => ({ default: m.BenchmarkCharts })),
);
const ContentTypeBreakdown = lazy(() =>
  import("@/components/ContentTypeBreakdown").then((m) => ({ default: m.ContentTypeBreakdown })),
);
const TimingHotspots = lazy(() =>
  import("@/components/TimingHotspots").then((m) => ({ default: m.TimingHotspots })),
);
const BreakoutPosts = lazy(() =>
  import("@/components/BreakoutPosts").then((m) => ({ default: m.BreakoutPosts })),
);

type Profile = { id: string; platform: string; handle: string; display_name: string | null; profile_url: string; avatar_url: string | null };
type Snapshot = { profile_id: string; captured_at: string; followers: number | null; total_views: number | null };
type Post = {
  id: string; profile_id: string; posted_at: string | null; url: string | null; thumbnail_url: string | null;
  caption: string | null; likes: number; comments: number; shares: number; views: number; engagement_rate: number | null;
  media_type: string | null;
};
type Run = { id: string; started_at: string; finished_at: string | null; status: string; profiles_updated: number; posts_upserted: number };

const PRESETS = [
  { id: "today",     label: "Today",       shortLabel: "Today" },
  { id: "yesterday", label: "Yesterday",   shortLabel: "Yest." },
  { id: "3",         label: "Last 3 days", shortLabel: "3d" },
  { id: "7",         label: "7 days",      shortLabel: "7d" },
  { id: "30",        label: "30 days",     shortLabel: "30d" },
  { id: "90",        label: "90 days",     shortLabel: "90d" },
] as const;

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, description: "Key stats & AI briefs" },
  { id: "channels", label: "Channels", icon: Radio, description: "Platform DNA details" },
  { id: "content", label: "Content Hub", icon: FolderHeart, description: "Top posts & breakdowns" },
  { id: "schedule", label: "Schedule", icon: CalendarDays, description: "Calendar & heatmaps" },
  { id: "feed", label: "Raw Feed", icon: TableProperties, description: "Sortable index table" },
] as const;

type GlobalSort =
  | "posted_at:desc" | "posted_at:asc"
  | "views:desc" | "likes:desc" | "comments:desc" | "shares:desc" | "er:desc";

type MetricKey = "likes" | "comments" | "shares" | "views" | "followers";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { token, workspace, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [dataNonce, setDataNonce] = useState(0);

  const reportRef = useRef<HTMLDivElement | null>(null);
  const [preset, setPresetId] = useState<string>("30");
  const [from, setFrom] = useState<Date>(startOfDay(subDays(new Date(), 30)));
  const [to, setTo] = useState<Date>(endOfDay(new Date()));
  const [platformFilter, setPlatformFilter] = useState<PlatformId | "all">("all");
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [globalSort, setGlobalSort] = useState<GlobalSort>("posted_at:desc");
  const [showAllTopPosts, setShowAllTopPosts] = useState(false);

  const ALL_METRICS: { key: MetricKey; label: string; icon: any; iconClassName?: string }[] = [
    { key: "likes", label: "Likes", icon: Heart, iconClassName: "text-like fill-like" },
    { key: "comments", label: "Comments", icon: MessageCircle },
    { key: "shares", label: "Shares", icon: Share2 },
    { key: "views", label: "Views", icon: Eye },
    { key: "followers", label: "Followers", icon: Users },
  ];
  const [metrics, setMetrics] = useState<Record<MetricKey, boolean>>({
    likes: true, comments: true, shares: true, views: true, followers: true,
  });

  const toggleMetric = (k: MetricKey) => setMetrics((m) => ({ ...m, [k]: !m[k] }));
  const engagementMetricsOn = metrics.likes || metrics.comments || metrics.shares;
  const engOf = (p: { likes: number; comments: number; shares: number }) =>
    (metrics.likes ? p.likes : 0) + (metrics.comments ? p.comments : 0) + (metrics.shares ? p.shares : 0);

  // ---- Data loading ----
  const dashboardQuery = useQuery({
    queryKey: ["dashboard-data", workspace?.id],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/dashboard-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-workspace-id': workspace?.id || ''
        }
      });
      if (!res.ok) {
        throw new Error('Failed to load dashboard data.');
      }
      return await res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const lastRun = query.state.data?.lastRun;
      if (lastRun && lastRun.status === 'running') {
        return 3000;
      }
      return false;
    },
  });

  const profiles = dashboardQuery.data?.profiles ?? [];
  const snapshots = dashboardQuery.data?.snapshots ?? [];
  const posts = dashboardQuery.data?.posts ?? [];
  const lastRun = dashboardQuery.data?.lastRun ?? null;
  const loading = dashboardQuery.isPending;
  const loadError = dashboardQuery.error
    ? ((dashboardQuery.error as any)?.message ?? "Failed to load dashboard data.")
    : null;
  const loadAll = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  };

  const [refreshingNow, setRefreshingNow] = useState(false);
  const [cancellingSync, setCancellingSync] = useState(false);
  
  const handleCancelSync = async () => {
    setCancellingSync(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/refresh-social/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-workspace-id': workspace?.id || ''
        }
      });
      if (res.ok) {
        toast({
          title: "Sync Cancelled",
          description: "The active sync run was cancelled.",
        });
        loadAll();
      } else {
        throw new Error('Failed to cancel sync.');
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (e as Error).message || "Failed to cancel sync",
      });
    } finally {
      setCancellingSync(false);
    }
  };

  const handleRefresh = async (profileId?: string) => {
    setRefreshingNow(true);
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    try {
      const res = await fetch(`${baseUrl}/api/refresh-social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-workspace-id': workspace?.id || '',
          'x-trigger': 'manual'
        },
        body: JSON.stringify({ profileId })
      });
      if (!res.ok) throw new Error('Refresh failed');
      toast({ 
        title: 'Sync started', 
        description: profileId 
          ? 'Fetching the latest data for the selected account in the background.' 
          : 'Fetching the latest data from all platforms in the background.' 
      });
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRefreshingNow(false);
    }
  };

  // Bump animation nonce when fresh data arrives
  useEffect(() => {
    if (dashboardQuery.dataUpdatedAt) setDataNonce((n) => n + 1);
  }, [dashboardQuery.dataUpdatedAt]);

  // Auto-refresh when run completes
  useEffect(() => {
    if (lastRun?.status !== 'running') return;

    const interval = setInterval(async () => {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const res = await fetch(`${baseUrl}/api/dashboard-data`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-workspace-id': workspace?.id || ''
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.lastRun?.status !== 'running') {
            queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
            toast({
              title: "Dashboard updated",
              description: "New data has just been synced from all platforms.",
            });
          }
        }
      } catch (err) {
        console.error('Error polling run status:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [lastRun?.status, queryClient, toast]);

  const applyPreset = (id: string) => {
    setPresetId(id);
    const now = new Date();
    if (id === "today") { setFrom(startOfDay(now)); setTo(endOfDay(now)); return; }
    if (id === "yesterday") { const y = subDays(now, 1); setFrom(startOfDay(y)); setTo(endOfDay(y)); return; }
    if (id === "custom") return;
    const d = Number(id);
    if (!Number.isNaN(d) && d > 0) { setFrom(startOfDay(subDays(now, d))); setTo(endOfDay(now)); }
  };

  const filteredProfiles = useMemo(
    () => platformFilter === "all" ? profiles : profiles.filter((p: any) => p.platform === platformFilter),
    [profiles, platformFilter],
  );
  const profileIds = useMemo(() => new Set(filteredProfiles.map((p) => p.id)), [filteredProfiles]);

  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= from.getTime() && t <= to.getTime();
  };

  const postsInRange = useMemo(
    () => posts.filter((p: any) => profileIds.has(p.profile_id) && inRange(p.posted_at)),
    [posts, profileIds, from, to],
  );

  const activeProfiles = useMemo(() => {
    const withPosts = new Set(postsInRange.map((p) => p.profile_id));
    return filteredProfiles.filter((p: any) => withPosts.has(p.id));
  }, [filteredProfiles, postsInRange]);

  const activePlatformIds = useMemo(
    () => new Set(activeProfiles.map((p) => p.platform)),
    [activeProfiles],
  );

  const latestByProfile = useMemo(() => {
    const m = new Map<string, Snapshot>();
    for (const s of snapshots) {
      const cur = m.get(s.profile_id);
      if (!cur || new Date(s.captured_at) > new Date(cur.captured_at)) m.set(s.profile_id, s);
    }
    return m;
  }, [snapshots]);

  const snapshotAt = (profileId: string, date: Date): Snapshot | undefined => {
    let best: Snapshot | undefined;
    for (const s of snapshots) {
      if (s.profile_id !== profileId) continue;
      const t = new Date(s.captured_at).getTime();
      if (t <= date.getTime() && (!best || t > new Date(best.captured_at).getTime())) best = s;
    }
    return best;
  };

  const rangeMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - rangeMs);
  const prevTo = new Date(from.getTime());

  const followersAtTo = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of filteredProfiles) {
      const snap = snapshotAt(p.id, to) ?? latestByProfile.get(p.id);
      m.set(p.id, snap?.followers ?? 0);
    }
    return m;
  }, [filteredProfiles, snapshots, to, latestByProfile]);

  const followersAtFrom = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of filteredProfiles) {
      const snap = snapshotAt(p.id, from);
      m.set(p.id, snap?.followers ?? 0);
    }
    return m;
  }, [filteredProfiles, snapshots, from]);

  const viewsAtTo = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of filteredProfiles) {
      const snap = snapshotAt(p.id, to) ?? latestByProfile.get(p.id);
      m.set(p.id, snap?.total_views ?? 0);
    }
    return m;
  }, [filteredProfiles, snapshots, to, latestByProfile]);

  const viewsAtFrom = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of filteredProfiles) {
      const snap = snapshotAt(p.id, from);
      m.set(p.id, snap?.total_views ?? 0);
    }
    return m;
  }, [filteredProfiles, snapshots, from]);

  const viewsAtPrevFrom = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of filteredProfiles) {
      const snap = snapshotAt(p.id, prevFrom);
      m.set(p.id, snap?.total_views ?? 0);
    }
    return m;
  }, [filteredProfiles, snapshots, prevFrom]);

  const postsInPrev = useMemo(
    () => posts.filter((p: any) => {
      if (!profileIds.has(p.profile_id) || !p.posted_at) return false;
      const t = new Date(p.posted_at).getTime();
      return t >= prevFrom.getTime() && t < prevTo.getTime();
    }),
    [posts, profileIds, from, to],
  );
  const prevEngagement = postsInPrev.reduce((s, p) => s + engOf(p), 0);
  const prevViews = postsInPrev.reduce((s, p) => s + p.views, 0);
  const pctDelta = (now: number, prev: number) => (prev === 0 || postsInPrev.length === 0) ? null : (now - prev) / prev;

  const totalFollowers = filteredProfiles.reduce((sum, p) => sum + (followersAtTo.get(p.id) ?? 0), 0);
  const totalFollowersStart = filteredProfiles.reduce((sum, p) => sum + (followersAtFrom.get(p.id) ?? 0), 0);
  const followersDelta = totalFollowersStart > 0 ? (totalFollowers - totalFollowersStart) / totalFollowersStart : null;
  const totalEngagement = postsInRange.reduce((s, p) => s + engOf(p), 0);

  // Calculate total views based on overall snapshots delta if available, otherwise fallback to posts-in-range sum
  const totalViewsEnd = filteredProfiles.reduce((sum, p) => sum + (viewsAtTo.get(p.id) ?? 0), 0);
  const totalViewsStart = filteredProfiles.reduce((sum, p) => sum + (viewsAtFrom.get(p.id) ?? 0), 0);
  const totalViewsPrevStart = filteredProfiles.reduce((sum, p) => sum + (viewsAtPrevFrom.get(p.id) ?? 0), 0);

  const totalViews = totalViewsStart > 0 
    ? Math.max(0, totalViewsEnd - totalViewsStart)
    : postsInRange.reduce((s, p) => s + (p.views || 0), 0);

  const prevViewsMetric = totalViewsPrevStart > 0
    ? Math.max(0, totalViewsStart - totalViewsPrevStart)
    : prevViews;

  const viewsDelta = prevViewsMetric > 0 ? (totalViews - prevViewsMetric) / prevViewsMetric : null;

  const rawEngagementInRange = postsInRange.reduce((s, p) => s + p.likes + p.comments + p.shares, 0);
  const rawEngagementInPrev = postsInPrev.reduce((s, p) => s + p.likes + p.comments + p.shares, 0);
  const followersGained = Math.max(0, totalFollowers - totalFollowersStart);
  const totalInteractions = rawEngagementInRange + followersGained;
  const prevInteractions = rawEngagementInPrev;

  // Platform-level follower deltas (for Audience growth small cards)
  const followerDeltas = useMemo(() => {
    const byPlat = new Map();
    for (const p of filteredProfiles) {
      const plat = p.platform;
      const cur = byPlat.get(plat) || { first: 0, last: 0 };
      cur.first += (followersAtFrom.get(p.id) ?? 0);
      cur.last += (followersAtTo.get(p.id) ?? 0);
      byPlat.set(plat, cur);
    }
    return PLATFORMS.map((pl) => {
      const v = byPlat.get(pl.id) || { first: 0, last: 0 };
      const delta = v.last - v.first;
      const pct = v.first > 0 ? delta / v.first : 0;
      return { platformId: pl.id, platform: pl.label, color: pl.color, icon: pl.icon, current: v.last, delta, pct };
    }).filter((d) => d.current > 0);
  }, [filteredProfiles, followersAtFrom, followersAtTo]);

  const erValues = postsInRange
    .map((p) => {
      const eng = engOf(p);
      if (metrics.views && p.views > 0) return eng / p.views;
      if (!metrics.followers) return null;
      const prof = filteredProfiles.find((x) => x.id === p.profile_id);
      const f = prof ? latestByProfile.get(prof.id)?.followers ?? 0 : 0;
      return f > 0 ? eng / f : null;
    })
    .filter((v): v is number => v != null);
  const avgEngagementRate = erValues.length ? erValues.reduce((a, b) => a + b, 0) / erValues.length : 0;

  const growthData = useMemo(() => {
    const buckets = new Map<string, { day: string; ts: number } & Record<string, number | string>>();
    for (const s of snapshots) {
      if (!profileIds.has(s.profile_id) || !inRange(s.captured_at)) continue;
      const profile = profiles.find((p: any) => p.id === s.profile_id);
      if (!profile) continue;
      const d = new Date(s.captured_at);
      const day = format(d, "MMM d");
      if (!buckets.has(day)) buckets.set(day, { day, ts: d.getTime() });
      (buckets.get(day) as any)[profile.platform] = s.followers ?? 0;
    }
    return Array.from(buckets.values())
      .sort((a, b) => a.ts - b.ts)
      .map(({ ts, ...rest }) => rest);
  }, [snapshots, profileIds, profiles, from, to]);

  const engagementData = useMemo(() => {
    const buckets = new Map<string, { day: string; ts: number; likes: number; comments: number; shares: number }>();
    for (const p of postsInRange) {
      if (!p.posted_at) continue;
      const d = new Date(p.posted_at);
      const key = format(d, "yyyy-MM-dd");
      if (!buckets.has(key)) buckets.set(key, { day: format(d, "MMM d"), ts: startOfDay(d).getTime(), likes: 0, comments: 0, shares: 0 });
      const b = buckets.get(key)!;
      b.likes += p.likes; b.comments += p.comments; b.shares += p.shares;
    }
    return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts).map(({ ts, ...rest }) => rest);
  }, [postsInRange]);

  const shareData = useMemo(() => {
    return PLATFORMS.map((pl) => {
      const ids = new Set(profiles.filter((p: any) => p.platform === pl.id).map((p) => p.id));
      const eng = postsInRange.filter((p) => ids.has(p.profile_id))
        .reduce((s, p) => s + engOf(p), 0);
      return { name: pl.label, value: eng, color: `hsl(var(--${pl.color}))` };
    }).filter((d) => d.value > 0);
  }, [postsInRange, profiles, metrics.likes, metrics.comments, metrics.shares]);

  const topPosts = useMemo(() => {
    return [...postsInRange]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 12);
  }, [postsInRange]);
  const visibleTopPosts = showAllTopPosts ? topPosts : topPosts.slice(0, 4);

  const summaryStats = useMemo<WeeklySummaryStats>(() => {
    const days = Math.max(1, differenceInCalendarDays(to, from) + 1);
    const pct = (n: number | null) => (n == null ? null : `${(n * 100).toFixed(1)}%`);

    const perPlatform = PLATFORMS.map((pl) => {
      const ids = new Set(filteredProfiles.filter((p) => p.platform === pl.id).map((p) => p.id));
      const pp = postsInRange.filter((p) => ids.has(p.profile_id));
      return {
        label: pl.label,
        posts: pp.length,
        eng: pp.reduce((s, p) => s + p.likes + p.comments + p.shares, 0),
        views: pp.reduce((s, p) => s + p.views, 0),
      };
    }).filter((p) => p.posts > 0);

    const ranked = [...postsInRange].sort(
      (a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares),
    );
    const top = ranked[0];
    const topProf = top ? filteredProfiles.find((p) => p.id === top.profile_id) : undefined;

    const typeMap = new Map<string, { eng: number; n: number }>();
    for (const p of postsInRange) {
      const key = (p.media_type ?? "Other").toLowerCase();
      const cur = typeMap.get(key) ?? { eng: 0, n: 0 };
      cur.eng += p.likes + p.comments + p.shares;
      cur.n += 1;
      typeMap.set(key, cur);
    }
    let bestType: string | null = null;
    let bestTypeAvg = -1;
    typeMap.forEach((v, k) => {
      const avg = v.n ? v.eng / v.n : 0;
      if (avg > bestTypeAvg) { bestTypeAvg = avg; bestType = k; }
    });

    const slot = new Map<string, { eng: number; n: number; day: number; hour: number }>();
    for (const p of postsInRange) {
      if (!p.posted_at) continue;
      const d = new Date(p.posted_at);
      const day = d.getDay();
      const hour = d.getHours();
      const k = `${day}-${hour}`;
      const cur = slot.get(k) ?? { eng: 0, n: 0, day, hour };
      cur.eng += p.likes + p.comments + p.shares;
      cur.n += 1;
      slot.set(k, cur);
    }
    const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let bestSlot: string | null = null;
    let bestSlotAvg = -1;
    slot.forEach((v) => {
      const avg = v.n ? v.eng / v.n : 0;
      if (avg > bestSlotAvg) {
        bestSlotAvg = avg;
        const h = v.hour % 12 === 0 ? 12 : v.hour % 12;
        bestSlot = `${DOW[v.day]} ${h} ${v.hour < 12 ? "AM" : "PM"}`;
      }
    });

    const tags = new Map<string, number>();
    for (const p of postsInRange) {
      const matches = (p.caption ?? "").match(/#[\p{L}0-9_]+/gu) ?? [];
      for (const t of matches) tags.set(t.toLowerCase(), (tags.get(t.toLowerCase()) ?? 0) + 1);
    }
    let topHashtag: string | null = null;
    let topHashtagN = 0;
    tags.forEach((n, t) => { if (n > topHashtagN) { topHashtagN = n; topHashtag = t; } });

    return {
      from: format(from, "MMM d, yyyy"),
      to: format(to, "MMM d, yyyy"),
      days,
      totalViews,
      totalEngagement,
      totalPosts: postsInRange.length,
      totalFollowers,
      viewsDeltaPct: pct(viewsDelta),
      engDeltaPct: pct(pctDelta(totalEngagement, prevEngagement)),
      postsDeltaPct: pct(pctDelta(postsInRange.length, postsInPrev.length)),
      followersDeltaPct: pct(followersDelta),
      perPlatform,
      topPostCaption: top?.caption?.slice(0, 140) ?? null,
      topPostPlatform: topProf ? platformMeta[topProf.platform]?.label ?? topProf.platform : null,
      topPostEng: top ? top.likes + top.comments + top.shares : 0,
      bestType,
      bestSlot,
      topHashtag,
    };
  }, [postsInRange, postsInPrev, filteredProfiles, from, to, totalViews, totalEngagement, totalFollowers, prevViews, prevEngagement, followersDelta, viewsDelta]);

  const viewsSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of postsInRange) {
      if (!p.posted_at) continue;
      const k = format(new Date(p.posted_at), "yyyy-MM-dd");
      byDay.set(k, (byDay.get(k) ?? 0) + (p.views || 0));
    }
    return Array.from(byDay.values()).sort((a, b) => a - b);
  }, [postsInRange]);

  const interactionsSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of postsInRange) {
      if (!p.posted_at) continue;
      const k = format(new Date(p.posted_at), "yyyy-MM-dd");
      byDay.set(k, (byDay.get(k) ?? 0) + p.likes + p.comments + p.shares);
    }
    return Array.from(byDay.values()).sort((a, b) => a - b);
  }, [postsInRange]);

  const downloadPdf = async () => {
    const node = document.getElementById("pdf-report") as HTMLElement | null;
    if (!node) return;
    setDownloadingPdf(true);
    toast({ title: "Generating PDF…", description: "Composing your dashboard report. This can take a few seconds." });
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const PAGE_W = pdf.internal.pageSize.getWidth();
      const PAGE_H = pdf.internal.pageSize.getHeight();
      const MARGIN_X = 32;
      const MARGIN_TOP = 56;
      const MARGIN_BOTTOM = 40;
      const CONTENT_W = PAGE_W - MARGIN_X * 2;
      const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
      const SECTION_GAP = 14;
      const bg = "#F5F0E8";

      const totalPosts = postsInRange.length;
      
      const viewsAtToMap = new Map<string, number>();
      const viewsAtFromMap = new Map<string, number>();
      for (const p of filteredProfiles) {
        const snapTo = snapshotAt(p.id, to) ?? latestByProfile.get(p.id);
        const snapFrom = snapshotAt(p.id, from);
        viewsAtToMap.set(p.id, snapTo?.total_views ?? 0);
        viewsAtFromMap.set(p.id, snapFrom?.total_views ?? 0);
      }
      const totalViewsEndPdf = filteredProfiles.reduce((sum, p) => sum + (viewsAtToMap.get(p.id) ?? 0), 0);
      const totalViewsStartPdf = filteredProfiles.reduce((sum, p) => sum + (viewsAtFromMap.get(p.id) ?? 0), 0);
      const totalViews = totalViewsStartPdf > 0 
        ? Math.max(0, totalViewsEndPdf - totalViewsStartPdf)
        : postsInRange.reduce((s, p) => s + (p.views || 0), 0);

      const totalEngagement = postsInRange.reduce(
        (s, p) => s + (p.likes || 0) + (p.comments || 0) + (p.shares || 0),
        0,
      );
      const totalFollowers = profiles.reduce(
        (s, p: any) => s + (latestByProfile.get(p.id)?.followers ?? 0),
        0,
      );
      const platformLabels = PLATFORMS
        .filter((pl) => filteredProfiles.some((p) => p.platform === pl.id))
        .map((pl) => pl.label)
        .join(" · ");

      const drawCover = () => {
        pdf.setFillColor(28, 26, 23);
        pdf.rect(0, 0, PAGE_W, 150, "F");
        pdf.setTextColor(245, 240, 232);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(workspace?.name?.toUpperCase() || "WORKSPACE", MARGIN_X, 54);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(26);
        pdf.text("Social Performance Report", MARGIN_X, 94);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.text(
          `${format(from, "MMM d, yyyy")}  –  ${format(to, "MMM d, yyyy")}`,
          MARGIN_X,
          120,
        );

        pdf.setTextColor(115, 115, 115);
        pdf.setFontSize(9);
        pdf.text(
          `Generated ${format(new Date(), "MMM d, yyyy 'at' HH:mm")}` +
            (platformLabels ? `  ·  ${platformLabels}` : ""),
          MARGIN_X,
          172,
        );

        const kpis: { label: string; value: string }[] = [
          { label: "Followers", value: formatNumber(totalFollowers) },
          { label: "Posts", value: formatNumber(totalPosts) },
          { label: "Views", value: formatNumber(totalViews) },
          { label: "Engagement", value: formatNumber(totalEngagement) },
        ];
        const cardW = (CONTENT_W - 18) / 2;
        const cardH = 84;
        const startY = 210;
        kpis.forEach((k, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = MARGIN_X + col * (cardW + 18);
          const y = startY + row * (cardH + 16);
          pdf.setDrawColor(204, 120, 92);
          pdf.setFillColor(245, 240, 232);
          pdf.roundedRect(x, y, cardW, cardH, 10, 10, "FD");
          pdf.setTextColor(150, 100, 80);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text(k.label.toUpperCase(), x + 18, y + 28);
          pdf.setTextColor(28, 26, 23);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(24);
          pdf.text(k.value, x + 18, y + 62);
        });

        pdf.setTextColor(80, 80, 80);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        const tagY = startY + 2 * (cardH + 16) + 32;
        pdf.text(
          "A snapshot of how the destination is performing across every connected social platform.",
          MARGIN_X,
          tagY,
          { maxWidth: CONTENT_W },
        );
      };

      let sectionEls: HTMLElement[] = Array.from(
        node.querySelectorAll<HTMLElement>("[data-pdf-section]"),
      );
      if (sectionEls.length === 0) {
        sectionEls = Array.from(node.querySelectorAll<HTMLElement>(":scope > section"));
      }
      sectionEls = sectionEls.filter(
        (el) => el.offsetParent !== null && el.getAttribute("data-html2canvas-ignore") !== "true",
      );

      drawCover();
      let currentY = MARGIN_TOP;
      let pageIsBlank = false;

      const addSectionImage = (imgData: string, drawH: number) => {
        const remaining = PAGE_H - MARGIN_BOTTOM - currentY;
        if (drawH > remaining) {
          pdf.addPage();
          currentY = MARGIN_TOP;
          pageIsBlank = true;
        }
        pdf.addImage(imgData, "JPEG", MARGIN_X, currentY, CONTENT_W, drawH);
        currentY += drawH + SECTION_GAP;
        pageIsBlank = false;
      };

      const captureToCanvas = async (el: HTMLElement) => {
        return html2canvas(el, {
          backgroundColor: bg,
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 1200,
        });
      };

      for (const section of sectionEls) {
        const canvas = await captureToCanvas(section);
        const naturalH = (canvas.height * CONTENT_W) / canvas.width;

        if (naturalH <= CONTENT_H) {
          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          if (!pageIsBlank && currentY === MARGIN_TOP) {
            pdf.addPage();
            pageIsBlank = true;
          }
          addSectionImage(imgData, naturalH);
        } else {
          if (!pageIsBlank) {
            pdf.addPage();
            currentY = MARGIN_TOP;
            pageIsBlank = true;
          }
          const pagePxHeight = Math.floor((CONTENT_H * canvas.width) / CONTENT_W);
          let yPx = 0;
          const tmp = document.createElement("canvas");
          const ctx = tmp.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D not supported");
          while (yPx < canvas.height) {
            const sliceH = Math.min(pagePxHeight, canvas.height - yPx);
            tmp.width = canvas.width;
            tmp.height = sliceH;
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, tmp.width, tmp.height);
            ctx.drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
            const sliceData = tmp.toDataURL("image/jpeg", 0.92);
            const drawH = (sliceH * CONTENT_W) / canvas.width;
            if (currentY !== MARGIN_TOP) {
              pdf.addPage();
              currentY = MARGIN_TOP;
            }
            pdf.addImage(sliceData, "JPEG", MARGIN_X, currentY, CONTENT_W, drawH);
            currentY += drawH + SECTION_GAP;
            pageIsBlank = false;
            yPx += sliceH;
          }
        }
      }

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        if (i > 1) {
          pdf.setDrawColor(204, 120, 92);
          pdf.setLineWidth(0.5);
          pdf.line(MARGIN_X, 38, PAGE_W - MARGIN_X, 38);
          pdf.setTextColor(115, 115, 115);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text(`${workspace?.name || 'Workspace'} — Social Performance`, MARGIN_X, 26);
          pdf.text(
            `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`,
            PAGE_W - MARGIN_X,
            26,
            { align: "right" },
          );
        }
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(9);
        pdf.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN_X, PAGE_H - 18, { align: "right" });
        pdf.text(
          `Generated ${format(new Date(), "MMM d, yyyy HH:mm")}`,
          MARGIN_X,
          PAGE_H - 18,
        );
      }

      const rangeStr = `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
      pdf.save(`${workspace?.name || 'Workspace'} Social Performance – ${rangeStr}.pdf`);

      toast({ title: "PDF ready", description: "Your dashboard report has been downloaded." });
    } catch (e: any) {
      toast({ title: "PDF failed", description: e?.message ?? "Unexpected error", variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const activePresetLabel =
    PRESETS.find((p) => p.id === preset)?.label ?? "Custom range";
  const mobileRangeSummary = `${format(from, "MMM d")} – ${format(to, "MMM d")}`;

  return (
    <DataRefreshProvider nonce={dataNonce}>
      <div className={`${theme} min-h-screen bg-background bg-paper-grain text-foreground flex flex-col md:flex-row`}>
        
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-card border-r border-border/60 z-30 shadow-sm">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
            
            {/* Brand Logo & Name */}
            <div className="flex items-center px-6 gap-2 mb-6">
              <span className="inline-flex size-9 items-center justify-center rounded-xl text-primary-foreground shadow-md bg-primary">
                <Sparkles className="size-4" />
              </span>
              <div>
                <span className="font-serif-display text-xl font-bold tracking-tight text-foreground">Insights</span>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">SaaS Dashboard</p>
              </div>
            </div>

            {/* Tenant details */}
            <div className="px-6 mb-6">
              <div className="p-3 bg-muted/40 border border-border/60 rounded-xl">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Active Workspace</p>
                <p className="text-sm font-semibold text-foreground truncate mt-0.5">{workspace?.name || 'Workspace'}</p>
              </div>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-4 space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                      active 
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/10" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0 transition-transform group-hover:scale-105", active ? "" : "text-muted-foreground group-hover:text-foreground")} />
                    <div className="text-left">
                      <p className="leading-none font-semibold">{tab.label}</p>
                      <p className={cn("text-[9px] mt-0.5 leading-none", active ? "text-primary-foreground/70" : "text-muted-foreground/60")}>
                        {tab.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Settings & Signout footer inside Sidebar */}
            <div className="px-4 mt-auto pt-4 border-t border-border/60 space-y-1">
              <Link to="/settings" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Settings className="size-4 text-muted-foreground" />
                <span>Settings</span>
              </Link>
              <button 
                onClick={() => { logout(); navigate('/login'); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
              >
                <LogOut className="size-4" />
                <span>Sign Out</span>
              </button>
            </div>

          </div>
        </aside>

        {/* Sidebar Space Padding */}
        <div className="hidden md:block w-64 shrink-0" />

        {/* Main Application Container */}
        <div className="flex-grow flex flex-col min-w-0">
          
          {/* Mobile Navigation Header */}
          <header className="md:hidden border-b border-border/60 bg-card p-4 flex items-center justify-between sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-lg text-primary-foreground bg-primary">
                <Sparkles className="size-3.5" />
              </span>
              <span className="font-serif-display font-bold text-lg text-foreground">Insights</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Link to="/settings">
                <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-muted text-muted-foreground">
                  <Settings className="size-4" />
                </Button>
              </Link>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { logout(); navigate('/login'); }}
                className="size-8 rounded-lg hover:bg-destructive/5 text-destructive"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </header>

          {/* Sticky Tab switcher for mobile */}
          <div className="md:hidden sticky top-[57px] z-30 w-full bg-card border-b border-border/40 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex px-4 py-2 gap-1.5">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Sticky Filters Controls Header */}
          <div className="sticky top-[93px] md:top-0 z-20 w-full bg-background/85 backdrop-blur-xl border-b border-border/40 py-3 px-4 sm:px-6 md:px-8">
            <div className="max-w-7xl mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              
              {/* Preset selector and Custom Picker */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-muted/40 border border-border/60 p-0.5 rounded-xl flex">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p.id)}
                      className={cn(
                        "text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all",
                        preset === p.id 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p.shortLabel}
                    </button>
                  ))}
                  <button
                    onClick={() => setPresetId("custom")}
                    className={cn(
                      "text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all",
                      preset === "custom" 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Custom
                  </button>
                </div>
                <DateRangePopover from={from} to={to} onApply={(f, t) => { setFrom(startOfDay(f)); setTo(endOfDay(t)); setPresetId("custom"); }} />
              </div>

              {/* Action operations: platform filters, manual triggers, download */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Platform select */}
                <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PlatformId | "all")}>
                  <SelectTrigger className="h-9 w-[120px] rounded-xl border-border/60 text-xs font-semibold bg-card text-foreground" aria-label="Platform">
                    <SlidersHorizontal className="size-3.5 text-muted-foreground mr-1.5" />
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    {PLATFORMS.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>{pl.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Ingestion & Export triggers */}
                <div className="flex items-center bg-muted/40 border border-border/60 p-0.5 rounded-xl">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[11px] font-bold rounded-lg hover:bg-muted text-foreground flex items-center gap-1.5 px-2.5"
                        disabled={refreshingNow || lastRun?.status === 'running'}
                      >
                        <RefreshCw className={cn("size-3", (refreshingNow || lastRun?.status === 'running') && "animate-spin")} />
                        <span>Sync</span>
                        <ChevronDown className="size-3 text-muted-foreground/80" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 bg-card border border-border/60 text-foreground">
                      <DropdownMenuItem 
                        onClick={() => handleRefresh()}
                        className="text-xs font-semibold cursor-pointer"
                      >
                        Sync All Platforms
                      </DropdownMenuItem>
                      {profiles.length > 0 && <DropdownMenuSeparator className="bg-border/60" />}
                      {profiles.map((p: any) => (
                        <DropdownMenuItem 
                          key={p.id}
                          onClick={() => handleRefresh(p.id)}
                          className="text-xs font-medium cursor-pointer capitalize flex items-center justify-between"
                        >
                          <span>Sync {p.platform}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">({p.handle})</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Clean vertical separator line */}
                  <div className="w-px h-4 bg-border/60 mx-1" />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadPdf}
                    disabled={downloadingPdf || loading}
                    className="h-8 text-[11px] font-bold rounded-lg hover:bg-muted text-foreground"
                  >
                    <Download className={cn("size-3 mr-1.5", downloadingPdf && "animate-pulse")} />
                    {downloadingPdf ? "PDF..." : "Export"}
                  </Button>
                </div>

              </div>

            </div>
          </div>

          {/* Main workspace scroll view */}
          <main className="flex-grow p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8 animate-fade-in-up">
            
            {/* Sync Progress Widget */}
            {lastRun?.status === 'running' && (
              <SyncProgressWidget 
                lastRun={lastRun} 
                profiles={profiles} 
                onCancel={handleCancelSync} 
                cancelling={cancellingSync} 
              />
            )}
            
            {/* Top-level empty / error states */}
            {loadError && (
              <EmptyState
                variant="error"
                title="Couldn't load dashboard data"
                description={loadError}
                primaryAction={{ label: "Try again", onClick: loadAll, icon: RefreshCw }}
              />
            )}
            {!loading && !loadError && profiles.length === 0 && (
              <EmptyState
                variant="no-connections"
                title="No social profiles connected"
                description="Connect Instagram, TikTok, YouTube, Facebook or Twitter profiles to start tracking performance."
                primaryAction={{ label: "Connect Profiles", onClick: () => navigate("/settings"), icon: ExternalLink }}
              />
            )}
            {!loading && !loadError && profiles.length > 0 && posts.length === 0 && (
              <EmptyState
                variant="no-data"
                title="No posts collected yet"
                description="Profiles are connected but we haven't pulled any posts yet. Data refreshes automatically every 12 hours."
              />
            )}

            {/* Premium Skeleton loader state */}
            {loading && (
              <div className="space-y-8 animate-pulse">
                {/* KPI Bento Grid Skeleton */}
                <KpiBentoSkeleton />
                
                {/* Charts & Platforms Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <ChartSkeleton height="h-80" />
                  </div>
                  <div className="space-y-4">
                    <PlatformCardSkeleton />
                    <PlatformCardSkeleton />
                  </div>
                </div>

                {/* Content Feed Table Skeleton */}
                <PostsTableSkeleton rows={5} />
              </div>
            )}

            {/* Tab layout panels */}
            {!loading && !loadError && profiles.length > 0 && posts.length > 0 && (
              <>
                {/* Tab 1: OVERVIEW */}
                {activeTab === "overview" && (
                  <div className="space-y-8">
                    
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold font-serif-display text-foreground">Workspace Overview</h2>
                        <p className="text-xs text-muted-foreground">Aggregated key metrics and brand summaries.</p>
                      </div>
                      <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-xs py-1 px-3">
                        Sync: {lastRun?.finished_at ? formatDistanceToNow(new Date(lastRun.finished_at), { addSuffix: true }) : 'never'}
                      </Badge>
                    </div>

                    {/* KPI Bento Grid — headline numbers first */}
                    <Reveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                      {metrics.views && (
                        <KpiFeatured
                          label="Total Views"
                          value={formatNumber(totalViews)}
                          sub={`${format(from, "MMM d")} – ${format(to, "MMM d")}`}
                          delta={viewsDelta}
                          series={viewsSeries}
                        />
                      )}
                      <KpiFeatured
                        label="Total Interactions"
                        value={formatNumber(totalInteractions)}
                        sub={`Likes, comments, shares and new followers`}
                        delta={pctDelta(totalInteractions, prevInteractions)}
                        series={interactionsSeries}
                      />
                      <div className="col-span-1 sm:col-span-2 lg:col-span-2 row-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {metrics.followers && (
                          <KpiCard icon={Users} label="Total Followers" value={formatNumber(totalFollowers)} accent="primary" delta={followersDelta} />
                        )}
                        {engagementMetricsOn && (
                          <KpiCard icon={Heart} label="Engagement" value={formatNumber(totalEngagement)} accent="accent" delta={pctDelta(totalEngagement, prevEngagement)} />
                        )}
                        {engagementMetricsOn && (
                          <KpiCard icon={TrendingUp} label="Avg Eng. Rate" value={formatPercent(avgEngagementRate)} accent="accent" />
                        )}
                        <KpiCard icon={FileText} label="Number of Posts" value={formatNumber(postsInRange.length)} accent="primary" delta={pctDelta(postsInRange.length, postsInPrev.length)} />
                      </div>
                    </Reveal>

                    {/* Audience growth (platform follower deltas) */}
                    <section className="space-y-3">
                      <div className="flex items-end justify-between">
                        <div>
                          <h2 className="text-2xl font-semibold font-serif-display">Audience growth</h2>
                          <p className="text-sm text-muted-foreground">Current follower counts per platform, with net change in selected range</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                        {followerDeltas.map((d) => (
                          <Card key={d.platformId} className="group relative isolate overflow-hidden p-5 shadow-[var(--shadow-card)] flex flex-col justify-between hover:shadow-[var(--shadow-elegant)] hover:-translate-y-1 transition-all duration-300">
                            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                              <div className="absolute inset-x-0 top-0 h-1 opacity-90" style={{ background: `linear-gradient(90deg, hsl(var(--${d.color})), hsl(var(--${d.color}) / 0.5))` }} />
                              <div className="absolute -top-12 -right-12 size-24 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: `hsl(var(--${d.color}))` }} />
                            </div>
                            
                            <div className="relative">
                              <div className="flex items-center gap-2.5 mb-3">
                                <div className="size-8 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ background: `linear-gradient(135deg, hsl(var(--${d.color})), hsl(var(--${d.color}) / 0.75))` }}>
                                  <d.icon className="size-3.5" />
                                </div>
                                <span className="text-xs font-semibold leading-tight">{d.platform}</span>
                              </div>
                              
                              <div className="text-2xl font-semibold mt-2 font-serif-display">{formatNumber(d.current)}</div>
                              <div className="text-[10px] text-muted-foreground/80 mt-0.5">Current Followers</div>
                            </div>
                            
                            <div className="mt-4 relative">
                              <div className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">Net Change</div>
                              <div className={cn(
                                "text-xs font-semibold mt-0.5",
                                d.delta > 0 ? "text-emerald-600" : d.delta < 0 ? "text-rose-600" : "text-muted-foreground",
                              )}>
                                {d.delta > 0 ? "+" : ""}{formatNumber(d.delta)} ({(d.pct * 100).toFixed(2)}%)
                              </div>
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

                    {/* AI Weekly Brief — supplementary, at the bottom */}
                    <Reveal>
                      <GeminiInsightsPanel stats={summaryStats} />
                    </Reveal>

                  </div>
                )}

                {/* Tab 2: CHANNELS */}
                {activeTab === "channels" && (
                  <div className="space-y-8">
                    
                    {/* Header */}
                    <div>
                      <h2 className="text-2xl font-bold font-serif-display text-foreground">Channel Intelligence</h2>
                      <p className="text-xs text-muted-foreground">Cross-platform presence, follower dynamics, and relative DNA shapes.</p>
                    </div>

                    {/* Platform DNA Radar */}
                    <Reveal>
                      <Suspense fallback={<ChartSkeleton />}>
                        <PlatformDnaRadar posts={postsInRange} profiles={activeProfiles} snapshots={snapshots} from={from} to={to} />
                      </Suspense>
                    </Reveal>

                    {/* Channel Snapshots List */}
                    <Reveal className="space-y-4">
                      <SectionHeader eyebrow="Platforms" title="Channel snapshot" description="At-a-glance metrics for every connected account." />
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {PLATFORMS.map((pl) => {
                          const profile = filteredProfiles.find((p: any) => p.platform === pl.id);
                          if (!profile) return null;
                          const snap = latestByProfile.get(profile.id);
                          const platformPosts = postsInRange.filter((p) => p.profile_id === profile.id);

                          const eng = platformPosts.reduce((s, p) => s + engOf(p), 0);
                          const views = platformPosts.reduce((s, p) => s + p.views, 0);
                          const rate = views > 0
                            ? eng / views
                            : ((snap?.followers ?? 0) > 0 && platformPosts.length
                                ? eng / (snap!.followers! * platformPosts.length) : 0);
                          const Icon = pl.icon;
                          const rangeLabel = `${format(from, "MMM d")} – ${format(to, "MMM d")}`;

                          return (
                            <Card key={pl.id} className="group relative isolate overflow-hidden rounded-xl p-4 sm:p-5 border-border/60 bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:-translate-y-1 transition-all duration-300">
                              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                                <div className="absolute inset-x-0 top-0 h-1 opacity-90" style={{ background: `linear-gradient(90deg, hsl(var(--${pl.color})), hsl(var(--${pl.color}) / 0.5))` }} />
                                <div className="absolute -top-12 -right-12 size-36 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: `hsl(var(--${pl.color}))` }} />
                              </div>
                              <div className="flex items-center justify-between mb-4 relative">
                                <div className="flex items-center gap-3">
                                  <div className="size-10 rounded-xl flex items-center justify-center text-white shadow-md" style={{ background: `linear-gradient(135deg, hsl(var(--${pl.color})), hsl(var(--${pl.color}) / 0.75))` }}>
                                    <Icon className="size-4" />
                                  </div>
                                  <div>
                                    <div className="font-semibold leading-tight">{pl.label}</div>
                                    <a href={profile.profile_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                                      @{profile.handle} <ExternalLink className="size-3 opacity-70" />
                                    </a>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center relative">
                                {metrics.followers && (() => {
                                  const fTo = followersAtTo.get(profile.id) ?? snap?.followers ?? null;
                                  const fFrom = followersAtFrom.get(profile.id) ?? 0;
                                  const diff = fTo != null && fFrom > 0 ? fTo - fFrom : null;
                                  return (
                                    <Stat
                                      label="Followers"
                                      value={formatNumber(fTo)}
                                      sub={diff != null ? `${diff >= 0 ? "+" : ""}${formatNumber(diff)} in range` : `as of ${format(to, "MMM d")}`}
                                    />
                                  );
                                })()}
                                <Stat label="Posts" value={String(platformPosts.length)} sub={rangeLabel} />
                                {engagementMetricsOn && <Stat label="Engage" value={formatNumber(eng)} sub={rangeLabel} />}
                                {metrics.views && (
                                  pl.id === "linkedin" ? (
                                    <UITooltip>
                                      <TooltipTrigger asChild>
                                        <div className="cursor-help hover:opacity-80 transition-opacity">
                                          <Stat label="Views" value={formatNumber(views)} sub="Private metric" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        LinkedIn post views (impressions) are private metrics and cannot be fetched via public scrapers.
                                      </TooltipContent>
                                    </UITooltip>
                                  ) : (
                                    <Stat label="Views" value={formatNumber(views)} sub={rangeLabel} />
                                  )
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </Reveal>

                    {/* Detailed Per-Platform Breakdowns */}
                    <Reveal>
                      <PlatformBreakdown profiles={activeProfiles} posts={postsInRange} />
                    </Reveal>

                  </div>
                )}

                {/* Tab 3: CONTENT HUB */}
                {activeTab === "content" && (
                  <div className="space-y-8">
                    
                    {/* Header */}
                    <div>
                      <h2 className="text-2xl font-bold font-serif-display text-foreground">Content Hub</h2>
                      <p className="text-xs text-muted-foreground">Viral breakouts, highlights, composition analysis, and hashtags.</p>
                    </div>

                    {/* Breakout Outliers */}
                    <Reveal>
                      <Suspense fallback={<TopPostsSkeleton count={4} />}>
                        <BreakoutPosts posts={postsInRange} profiles={filteredProfiles} onOpenPost={setOpenPostId} />
                      </Suspense>
                    </Reveal>

                    {/* Most Viewed on Each Platform */}
                    {!loading && (() => {
                      const bestByPlatform = PLATFORMS.map((pl) => {
                        const profile = filteredProfiles.find((p: any) => p.platform === pl.id);
                        if (!profile) return null;
                        const best = postsInRange
                          .filter((p) => p.profile_id === profile.id)
                          .reduce<Post | null>((top, p) => (!top || p.views > top.views ? p : top), null);
                        return { platform: pl, profile, post: best };
                      }).filter((b): b is { platform: typeof PLATFORMS[number]; profile: Profile; post: Post | null } => b !== null && b.post !== null)
                        .sort((a, b) => (b.post?.views || 0) - (a.post?.views || 0));

                      if (bestByPlatform.length === 0) return null;

                      return (
                        <Reveal as="section">
                          <SectionHeader
                            eyebrow="Per platform"
                            title="Most viewed on each platform"
                            description="The single highest-viewed post from each connected channel in the selected range."
                          />
                          <div className={cn(
                            "mt-4 grid gap-5 grid-cols-1 sm:grid-cols-2",
                            bestByPlatform.length >= 3 && "lg:grid-cols-3",
                            bestByPlatform.length >= 4 && "xl:grid-cols-4",
                          )}>
                            {bestByPlatform.map(({ platform: pl, profile, post }) => {
                              const Icon = pl.icon;
                              return (
                                <button
                                  key={pl.id}
                                  type="button"
                                  onClick={() => setOpenPostId(post.id)}
                                  className="group relative bg-card rounded-3xl overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:-translate-y-1 transition-all duration-500 border border-border/60 flex flex-col text-left focus-ring"
                                >
                                  <div className="relative aspect-[4/5] overflow-hidden bg-muted w-full">
                                    <Thumbnail
                                      src={post.thumbnail_url}
                                      fallbackIcon={Icon}
                                      iconClassName="size-12 opacity-40"
                                      imgClassName="transition-transform duration-700 ease-out group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white">
                                      <Icon className="size-3.5" />
                                      <span className="text-[10px] font-medium tracking-tight max-w-[7rem] truncate">@{profile.handle}</span>
                                    </div>
                                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white">
                                      <span className="p-1 rounded-sm flex items-center justify-center" style={{ background: `hsl(var(--${pl.color}))` }}>
                                        <Play className="size-3 fill-white" />
                                      </span>
                                      <span className="text-xs font-bold">{formatNumber(post.views)}</span>
                                      <span className="text-[10px] opacity-70">views</span>
                                    </div>
                                  </div>

                                  <div className="p-4 flex flex-col flex-1">
                                    <p className="text-sm leading-snug line-clamp-2 mb-4 font-medium text-foreground/90 min-h-[2.5rem]">{post.caption || "—"}</p>
                                    <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between text-muted-foreground">
                                      <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1 text-xs"><Heart className="size-3.5 text-like fill-like" />{formatNumber(post.likes)}</span>
                                        <span className="flex items-center gap-1 text-xs"><MessageCircle className="size-3.5" />{formatNumber(post.comments)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </Reveal>
                      );
                    })()}

                    {/* Top Performing Highlights */}
                    <Reveal as="section">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <SectionHeader
                          eyebrow="Highlights"
                          title="Top performing content"
                          description="The highest-engagement posts across every connected platform."
                        />
                        {topPosts.length > 4 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => setShowAllTopPosts((value) => !value)}
                          >
                            {showAllTopPosts ? "View less" : "View more"}
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                        {visibleTopPosts.map((post) => {
                          const profile = profiles.find((p: any) => p.id === post.profile_id);
                          const meta = profile ? platformMeta[profile.platform] : null;
                          const Icon = meta?.icon;
                          return (
                            <button key={post.id} onClick={() => setOpenPostId(post.id)} className="group block text-left focus-ring rounded-2xl">
                              <Card className="overflow-hidden h-full border-border/60 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:-translate-y-1 transition-all duration-300 bg-card">
                                <div className="aspect-square bg-muted relative overflow-hidden">
                                  <Thumbnail src={post.thumbnail_url} fallbackIcon={Icon} imgClassName="group-hover:scale-105 transition-transform duration-500" />
                                </div>
                                <div className="p-3 space-y-2">
                                  <p className="text-sm line-clamp-2 min-h-[2.5rem] leading-snug">{post.caption || "—"}</p>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><Heart className="size-3 text-like fill-like" /> {formatNumber(post.likes)}</span>
                                    <span className="flex items-center gap-1"><MessageCircle className="size-3" /> {formatNumber(post.comments)}</span>
                                    {post.views > 0 && <span className="ml-auto flex items-center gap-0.5"><Play className="size-3" /> {formatNumber(post.views)}</span>}
                                  </div>
                                </div>
                              </Card>
                            </button>
                          );
                        })}
                      </div>
                    </Reveal>

                    {/* Media type and Hashtag lists — single-column stacked layout */}
                    <div className="space-y-8">
                      <Reveal>
                        <Suspense fallback={<ChartSkeleton />}>
                          <ContentTypeBreakdown posts={postsInRange} />
                        </Suspense>
                      </Reveal>

                      <Reveal>
                        <Suspense fallback={<ChartSkeleton />}>
                          <AnalyticsSections posts={postsInRange} profiles={filteredProfiles} snapshots={snapshots} from={from} to={to} />
                        </Suspense>
                      </Reveal>
                    </div>

                  </div>
                )}

                {/* Tab 4: SCHEDULE & CALENDAR */}
                {activeTab === "schedule" && (
                  <div className="space-y-8">
                    
                    {/* Header */}
                    <div>
                      <h2 className="text-2xl font-bold font-serif-display text-foreground">Schedule &amp; Timing</h2>
                      <p className="text-xs text-muted-foreground">Ideal publication slots, weekday distributions, and calendar logs.</p>
                    </div>

                    {/* Heatmap timing distributions */}
                    <Reveal>
                      <Suspense fallback={<ChartSkeleton height="h-80" />}>
                        <TimingHotspots posts={postsInRange} profiles={activeProfiles} />
                      </Suspense>
                    </Reveal>

                    {/* Month grid Calendar visualizer */}
                    <Reveal>
                      <Suspense fallback={<ChartSkeleton height="h-96" title={false} />}>
                        <ContentCalendar
                          posts={posts.filter((p: any) => profileIds.has(p.profile_id))}
                          profiles={filteredProfiles}
                          initialMonth={to}
                          onOpenPost={setOpenPostId}
                        />
                      </Suspense>
                    </Reveal>

                  </div>
                )}

                {/* Tab 5: RAW FEED TABLE */}
                {activeTab === "feed" && (
                  <div className="space-y-8">
                    
                    {/* Header */}
                    <div>
                      <h2 className="text-2xl font-bold font-serif-display text-foreground">Social Ingestion Feed</h2>
                      <p className="text-xs text-muted-foreground">A raw database index of all ingested social media posts with filters and sort indices.</p>
                    </div>

                    {/* Table grid */}
                    <Reveal>
                      <Suspense fallback={<PostsTableSkeleton />}>
                        <ContentFeed
                          posts={postsInRange}
                          profiles={filteredProfiles}
                          followersByProfile={new Map(filteredProfiles.map((p: any) => [p.id, latestByProfile.get(p.id)?.followers ?? 0]))}
                          sort={globalSort}
                        />
                      </Suspense>
                    </Reveal>

                  </div>
                )}
              </>
            )}

          </main>

          {/* Core Footer */}
          <footer className="mt-auto border-t border-border/60 bg-muted/20 py-4 px-6 text-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} {workspace?.name || 'Workspace'}. Sync status OK. Refreshed automatically every 12 hours.</p>
          </footer>

        </div>

      </div>

      {/* OFF-SCREEN RENDER CONTROLLER (FLAWLESS PDF EXPORT) */}
      <div 
        id="pdf-report" 
        style={{ position: 'absolute', left: '-9999px', top: '0', width: '1200px', pointerEvents: 'none' }}
        className={`${theme} bg-[#F5F0E8] p-12 space-y-12 text-[#1C1A17]`}
      >
        <header className="border-b border-[#CC785C]/30 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold font-serif-display text-[#1C1A17]">{workspace?.name || 'Workspace'}</h1>
            <p className="text-xs text-muted-foreground mt-1">Social Performance Audit Report</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-muted-foreground">{format(from, "MMM d, yyyy")} – {format(to, "MMM d, yyyy")}</p>
          </div>
        </header>

        <section data-pdf-section className="space-y-6">
          <h2 className="text-xl font-bold font-serif-display border-b pb-2">Overview Statistics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-xl border border-[#CC785C]/20 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-[#CC785C]">Total Views</span>
              <p className="text-2xl font-bold mt-1">{formatNumber(totalViews)}</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#CC785C]/20 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-[#CC785C]">Total Interactions</span>
              <p className="text-2xl font-bold mt-1">{formatNumber(totalInteractions)}</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#CC785C]/20 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-[#CC785C]">Total Followers</span>
              <p className="text-2xl font-bold mt-1">{formatNumber(totalFollowers)}</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-[#CC785C]/20 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-[#CC785C]">Engagement Rate</span>
              <p className="text-2xl font-bold mt-1">{formatPercent(avgEngagementRate)}</p>
            </div>
          </div>
        </section>

        <section data-pdf-section className="space-y-6">
          <h2 className="text-xl font-bold font-serif-display border-b pb-2">Platform Distributions</h2>
          <Suspense fallback={null}>
            <PlatformDnaRadar posts={postsInRange} profiles={activeProfiles} snapshots={snapshots} from={from} to={to} />
          </Suspense>
        </section>
      </div>

      {/* Post details Dialog overlay */}
      <PostDetailsDialog
        post={openPostId ? posts.find((p: any) => p.id === openPostId) ?? null : null}
        profile={(() => {
          const p = openPostId ? posts.find((x: any) => x.id === openPostId) : null;
          return p ? profiles.find((pr: any) => pr.id === p.profile_id) ?? null : null;
        })()}
        open={!!openPostId}
        onOpenChange={(o) => !o && setOpenPostId(null)}
      />

    </DataRefreshProvider>
  );
}

function DateRangePopover({ from, to, onApply }: { from: Date; to: Date; onApply: (from: Date, to: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date>(from);
  const [draftTo, setDraftTo] = useState<Date>(to);

  useEffect(() => { if (open) { setDraftFrom(from); setDraftTo(to); } }, [open, from, to]);

  const valid = draftFrom.getTime() <= draftTo.getTime();
  const dirty = draftFrom.getTime() !== from.getTime() || draftTo.getTime() !== to.getTime();

  const apply = () => {
    if (!valid) return;
    onApply(draftFrom, draftTo);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Selected date range: ${format(from, "MMMM d, yyyy")} to ${format(to, "MMMM d, yyyy")}. Click to change.`}
          className="bg-card text-foreground border-border/60"
        >
          <CalendarIcon aria-hidden="true" className="size-4 mr-2" />
          {format(from, "MMM d")} – {format(to, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="w-[min(94vw,760px)] max-h-[88vh] overflow-auto p-0 rounded-xl shadow-[var(--shadow-elegant)] border-border/70 bg-card">
        <div className="px-4 pt-4 pb-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <CalendarIcon className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">Select date range</div>
                <div className="text-[11px] text-muted-foreground">
                  {format(draftFrom, "MMM d, yyyy")} – {format(draftTo, "MMM d, yyyy")}
                </div>
              </div>
            </div>
            <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
              {Math.max(1, differenceInCalendarDays(draftTo, draftFrom) + 1)} days
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-36 sm:border-r border-b sm:border-b-0 border-border/60 p-2 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible bg-muted/10">
            {[
              { label: "Today", days: 0 },
              { label: "Last 7 days", days: 6 },
              { label: "Last 14 days", days: 13 },
              { label: "Last 30 days", days: 29 },
              { label: "Last 90 days", days: 89 },
            ].map((p) => {
              const now = new Date();
              const f = startOfDay(subDays(now, p.days));
              const t = endOfDay(now);
              const active = startOfDay(draftFrom).getTime() === f.getTime() && endOfDay(draftTo).getTime() === t.getTime();
              return (
                <button
                  key={p.label}
                  onClick={() => { setDraftFrom(f); setDraftTo(t); }}
                  className={cn(
                    "text-xs px-2.5 py-1.5 rounded-md text-left whitespace-nowrap transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-3 space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="date-from" className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">From</label>
                <input
                  id="date-from"
                  type="date"
                  value={format(draftFrom, "yyyy-MM-dd")}
                  max={format(draftTo, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const d = e.target.valueAsDate ?? new Date(e.target.value);
                    if (d && !isNaN(d.getTime())) setDraftFrom(startOfDay(d));
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="date-to" className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">To</label>
                <input
                  id="date-to"
                  type="date"
                  value={format(draftTo, "yyyy-MM-dd")}
                  min={format(draftFrom, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const d = e.target.valueAsDate ?? new Date(e.target.value);
                    if (d && !isNaN(d.getTime())) setDraftTo(endOfDay(d));
                  }}
                  className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <Calendar
              mode="range"
              selected={{ from: draftFrom, to: draftTo }}
              onSelect={(r) => {
                if (r?.from && r?.to) { setDraftFrom(startOfDay(r.from)); setDraftTo(endOfDay(r.to)); }
                else if (r?.from) { setDraftFrom(startOfDay(r.from)); setDraftTo(endOfDay(r.from)); }
              }}
              className={cn("p-0 pointer-events-auto")}
              numberOfMonths={typeof window !== "undefined" && window.innerWidth < 640 ? 1 : 2}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border/60 bg-muted/20">
          <div className="text-[11px] text-muted-foreground">
            {valid ? "Ready to apply" : <span className="text-rose-600">Invalid range</span>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={apply} disabled={!valid || !dirty}>Update</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function KpiFeatured({ label, value, sub, delta, series }: {
  label: string; value: string; sub?: string; delta?: number | null; series: number[];
}) {
  const up = delta != null && delta > 0;
  const max = Math.max(1, ...series);
  const bars = series.length ? series.slice(-24) : Array.from({ length: 12 }, () => 0);
  return (
    <Card
      className="group sm:col-span-2 md:col-span-2 lg:col-span-2 row-span-2 relative isolate overflow-hidden rounded-2xl p-5 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 shadow-[var(--shadow-card)] bg-card"
      style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--card)) 70%, hsl(var(--accent-glow) / 0.05) 100%)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute -right-16 -bottom-16 size-56 rounded-full blur-3xl bg-primary/10 group-hover:bg-primary/15 transition-colors" />
      </div>
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-start justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary font-serif-display">
            {label}
          </p>
          {up && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
              <TrendingUp className="size-3" />
              +{(delta! * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="mt-3 text-4xl sm:text-5xl font-bold tracking-tighter text-foreground break-words font-serif-display">
          <AnimatedValue value={value} />
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-2">{sub}</div>}
        <div className="mt-auto pt-6">
          <div className="h-20 w-full rounded-xl border border-border/60 bg-muted/30 relative overflow-hidden">
            <div className="absolute bottom-0 inset-x-0 h-3/4 flex items-end gap-1 px-3 pb-1.5">
              {bars.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/40 group-hover:bg-primary/60 transition-colors"
                  style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent, delta }: {
  icon: any; label: string; value: string; sub?: string; accent: "primary" | "accent"; delta?: number | null;
}) {
  const accentVar = accent === "primary" ? "primary" : "accent";
  const accentGlow = accent === "primary" ? "primary-glow" : "accent-glow";
  
  const hasDelta = delta != null && !isNaN(delta) && isFinite(delta) && delta !== 0;
  const deltaVal = hasDelta ? delta * 100 : 0;
  const deltaStr = hasDelta
    ? (deltaVal > 0 ? "+" : "") + deltaVal.toFixed(1).replace(/\.0$/, "") + "%"
    : "";

  return (
    <Card className="group p-4 relative isolate overflow-hidden rounded-2xl border-border/60 bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5 transition-all duration-300">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-x-0 top-0 h-1 opacity-90" style={{ background: `linear-gradient(90deg, hsl(var(--${accentVar})), hsl(var(--${accentGlow})))` }} />
        <div className="absolute -top-10 -right-10 size-32 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: `hsl(var(--${accentVar}))` }} />
      </div>
      <div className="flex items-center justify-between gap-1.5 mb-3 relative">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] uppercase tracking-[0.08em] font-bold min-w-0">
          <span className="size-5.5 rounded-md flex items-center justify-center text-primary-foreground shadow-sm shrink-0" style={{ background: `hsl(var(--${accentVar}))` }}>
            <Icon className="size-3" />
          </span>
          <span className="truncate">{label}</span>
        </div>
        {hasDelta && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
            deltaVal > 0 
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
          )}>
            {deltaVal > 0 ? <TrendingUp className="size-3 shrink-0" /> : <TrendingDown className="size-3 shrink-0" />}
            {deltaStr}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight relative break-words font-serif-display">
        <AnimatedValue value={value} />
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1 relative truncate">{sub}</div>}
    </Card>
  );
}

function AnimatedValue({ value, duration = 1200 }: { value: string; duration?: number }) {
  return <AnimatedNumber value={value} duration={duration} />;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">{label}</div>
      <div className="font-semibold text-sm mt-0.5"><AnimatedValue value={value} /></div>
      {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function SyncProgressWidget({ 
  lastRun, 
  profiles, 
  onCancel, 
  cancelling 
}: { 
  lastRun: any; 
  profiles: any[]; 
  onCancel: () => void; 
  cancelling: boolean; 
}) {
  const progressMap = lastRun.progress || {};
  const entries = Object.entries(progressMap);
  const total = entries.length;
  
  if (total === 0) return null;
  
  const completed = entries.filter(([_, val]: [string, any]) => val.status === 'success' || val.status === 'failed').length;
  const percent = Math.round((completed / total) * 100);

  return (
    <Card className="bg-card/70 backdrop-blur-md border border-border/60 p-5 rounded-2xl shadow-[var(--shadow-card)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <RefreshCw className="size-4 animate-spin text-primary" />
            Syncing social channels...
          </h3>
          <p className="text-xs text-muted-foreground">
            Updating metrics and downloading latest posts ({completed}/{total} completed)
          </p>
        </div>
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={onCancel}
          disabled={cancelling}
          className="h-8 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-1.5 self-start sm:self-center"
        >
          {cancelling ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
          Cancel Sync
        </Button>
      </div>

      <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/20">
        <div 
          className="bg-primary h-full transition-all duration-500 rounded-full" 
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {PLATFORMS.map((pl) => {
          const isConfigured = profiles.some(p => p.platform === pl.id);
          if (!isConfigured) return null;

          const state = progressMap[pl.id] || { status: 'pending' };
          const Icon = pl.icon;

          return (
            <div key={pl.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded text-white"
                  style={{ background: `hsl(var(--${pl.color}))` }}>
                  <Icon className="size-3" />
                </span>
                <span className="text-xs font-semibold">{pl.label}</span>
              </div>
              {state.status === 'pending' && <span className="size-2 rounded-full bg-muted-foreground/40" title="Pending" />}
              {state.status === 'running' && <Loader2 className="size-3 text-primary animate-spin" />}
              {state.status === 'success' && <CheckCircle2 className="size-3.5 text-emerald-500" />}
              {state.status === 'failed' && <XCircle className="size-3.5 text-rose-500" title={state.error} />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SectionHeader({ eyebrow, title, description, action }: {
  eyebrow?: string; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
      <div className="space-y-1">
        {eyebrow && (
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            {eyebrow}
          </div>
        )}
        <h2 className="text-xl font-bold tracking-tight font-serif-display">
          {title}
        </h2>
        {description && <p className="text-xs text-muted-foreground max-w-xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type BreakdownProfile = { id: string; platform: string; handle: string; profile_url: string };
type BreakdownPost = {
  id: string; profile_id: string; posted_at: string | null; url: string | null; thumbnail_url: string | null;
  caption: string | null; likes: number; comments: number; shares: number; views: number;
};

function PlatformBreakdown({ profiles, posts }: { profiles: BreakdownProfile[]; posts: BreakdownPost[] }) {
  const sections = PLATFORMS
    .map((pl) => {
      const profile = profiles.find((p) => p.platform === pl.id);
      if (!profile) return null;
      const platformPosts = posts.filter((p) => p.profile_id === profile.id);
      if (platformPosts.length === 0) return null;
      return { pl, profile, platformPosts };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (sections.length === 0) return null;

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold font-serif-display text-foreground">
        Per-platform detailed breakdown
      </h2>
      <div className="space-y-4">
        {sections.map(({ pl, profile, platformPosts }) => (
          <PlatformCard key={pl.id} pl={pl} profile={profile} posts={platformPosts} />
        ))}
      </div>
    </section>
  );
}

function PlatformCard({
  pl, profile, posts,
}: {
  pl: (typeof PLATFORMS)[number];
  profile: BreakdownProfile;
  posts: BreakdownPost[];
}) {
  const Icon = pl.icon;
  const color = `hsl(var(--${pl.color}))`;

  const series = (() => {
    const buckets = new Map<string, { day: string; ts: number; likes: number; comments: number; shares: number; views: number }>();
    for (const p of posts) {
      if (!p.posted_at) continue;
      const d = new Date(p.posted_at);
      const key = format(d, "MMM d");
      if (!buckets.has(key)) buckets.set(key, { day: key, ts: d.getTime(), likes: 0, comments: 0, shares: 0, views: 0 });
      const b = buckets.get(key)!;
      b.likes += p.likes; b.comments += p.comments; b.shares += p.shares; b.views += p.views;
    }
    return Array.from(buckets.values()).sort((a, b) => a.ts - b.ts);
  })();

  const top = [...posts]
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);

  const totals = posts.reduce(
    (acc, p) => ({
      likes: acc.likes + p.likes, comments: acc.comments + p.comments,
      shares: acc.shares + p.shares, views: acc.views + p.views,
    }),
    { likes: 0, comments: 0, shares: 0, views: 0 },
  );

  return (
    <Card className="p-4 sm:p-5 shadow-[var(--shadow-card)] border-border/60 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ background: color }}>
            <Icon className="size-5" />
          </div>
          <div>
            <div className="font-semibold text-lg font-serif-display">{pl.label}</div>
            <a href={profile.profile_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
              @{profile.handle} <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground items-center">
          <span><Heart className="size-3 inline mr-1 text-like fill-like" />{formatNumber(totals.likes)}</span>
          <span><MessageCircle className="size-3 inline mr-1" />{formatNumber(totals.comments)}</span>
          <span><Share2 className="size-3 inline mr-1" />{formatNumber(totals.shares)}</span>
          {totals.views > 0 && <span><Play className="size-3 inline mr-1" />{formatNumber(totals.views)}</span>}
          <Badge variant="outline">{posts.length} posts</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Engagement over time</div>
          <div className="h-56">
            {series.length === 0 ? (
              <div className="h-full border border-dashed border-border rounded-lg flex items-center justify-center">
                <EmptyState variant="no-data" compact asCard={false} title="No posts in range" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: -15 }}>
                  <defs>
                    <linearGradient id={`g-${pl.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => formatNumber(v as number)} />
                  <Tooltip content={<ChartTooltip sortDesc />} />
                  <Area type="monotone" dataKey="likes" stroke={color} fill={`url(#g-${pl.id})`} strokeWidth={2} />
                  <Area type="monotone" dataKey="comments" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="shares" stroke="hsl(var(--accent))" fill="hsl(var(--accent) / 0.1)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Top posts</div>
          {top.length === 0 ? (
            <div className="h-40 border border-dashed border-border rounded-lg flex items-center justify-center">
              <EmptyState variant="no-data" compact asCard={false} title="No posts yet" />
            </div>
          ) : (
            <div className="space-y-2">
              {top.slice(0, 3).map((post) => (
                <a
                  key={post.id}
                  href={post.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex gap-3 p-2 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors"
                >
                  <div className="size-12 shrink-0 bg-muted relative rounded-md overflow-hidden border border-border/60">
                    <Thumbnail src={post.thumbnail_url} fallbackIcon={Icon} iconClassName="size-5 opacity-40" />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                    <p className="text-xs truncate font-medium text-foreground">{post.caption || "No caption"}</p>
                    <div className="flex gap-2.5 text-[10px] text-muted-foreground">
                      <span><Heart className="size-2.5 inline mr-0.5 text-like fill-like" />{formatNumber(post.likes)}</span>
                      <span><Play className="size-2.5 inline mr-0.5" />{formatNumber(post.views)}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
