import { Fragment, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, ExternalLink, Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { platformMeta, formatNumber, formatPercent } from "@/lib/social";
import { PostDetailsDialog } from "@/components/PostDetailsDialog";
import { EmptyState } from "@/components/EmptyState";

type Post = {
  id: string; profile_id: string; posted_at: string | null; url: string | null;
  thumbnail_url?: string | null; caption: string | null; media_type?: string | null;
  likes: number; comments: number; shares: number; views: number;
};
type Profile = { id: string; platform: string; handle: string; profile_url: string };

type SortKey = "posted_at" | "views" | "likes" | "comments" | "shares" | "er";
type SortDir = "asc" | "desc";

const calculateEngagementRate = (p: Post, followers: number) => {
  const eng = p.likes + p.comments + p.shares;
  if (p.views > 0) return eng / p.views;
  if (followers > 0) return eng / followers;
  return null;
};

export function ContentFeed({
  posts, profiles, followersByProfile, sort,
}: {
  posts: Post[];
  profiles: Profile[];
  followersByProfile?: Map<string, number>;
  sort?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (!sort) return;
    const [k, d] = sort.split(":") as [SortKey, SortDir];
    if (k) setSortKey(k);
    if (d === "asc" || d === "desc") setSortDir(d);
  }, [sort]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [minLikes, setMinLikes] = useState<string>("");
  const [minComments, setMinComments] = useState<string>("");
  const [minViews, setMinViews] = useState<string>("");
  const [minShares, setMinShares] = useState<string>("");
  const [minErPct, setMinErPct] = useState<string>("");
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  // Group profiles by platform for the dropdown
  const platforms = useMemo(() => {
    const m = new Map<string, Profile[]>();
    for (const p of profiles) {
      if (!m.has(p.platform)) m.set(p.platform, []);
      m.get(p.platform)!.push(p);
    }
    return Array.from(m.entries()); // [platform, profiles[]]
  }, [profiles]);
  const selected = openId ? posts.find((p) => p.id === openId) ?? null : null;
  const selectedProfile = selected ? profileMap.get(selected.profile_id) ?? null : null;

  // Tokenize query: hashtags (#word), keywords; all must match (AND), case-insensitive
  const tokens = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );
  const numOrNull = (s: string) => {
    const n = Number(s);
    return s.trim() !== "" && Number.isFinite(n) ? n : null;
  };
  const minLikesN = numOrNull(minLikes);
  const minCommentsN = numOrNull(minComments);
  const minViewsN = numOrNull(minViews);
  const minSharesN = numOrNull(minShares);
  const minErN = numOrNull(minErPct);
  const fromMs = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime() : null;
  const toMs = dateTo ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999).getTime() : null;

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      // Account filter
      if (accountFilter !== "all") {
        const prof = profileMap.get(p.profile_id);
        if (!prof) return false;
        if (accountFilter.startsWith("platform:") && prof.platform !== accountFilter.slice(9)) return false;
        if (accountFilter.startsWith("profile:") && prof.id !== accountFilter.slice(8)) return false;
      }
      // Date range
      if (fromMs != null || toMs != null) {
        if (!p.posted_at) return false;
        const t = new Date(p.posted_at).getTime();
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
      }
      // Engagement thresholds
      if (minLikesN != null && (p.likes ?? 0) < minLikesN) return false;
      if (minCommentsN != null && (p.comments ?? 0) < minCommentsN) return false;
      if (minViewsN != null && (p.views ?? 0) < minViewsN) return false;
      if (minSharesN != null && (p.shares ?? 0) < minSharesN) return false;
      if (minErN != null) {
        const er = calculateEngagementRate(p, followersByProfile?.get(p.profile_id) ?? 0);
        if (er == null || er * 100 < minErN) return false;
      }
      // Text query
      if (tokens.length > 0) {
        const hay = (p.caption ?? "").toLowerCase();
        const prof = profileMap.get(p.profile_id);
        const handle = prof?.handle?.toLowerCase() ?? "";
        if (!tokens.every((t) => hay.includes(t) || handle.includes(t))) return false;
      }
      return true;
    });
  }, [posts, tokens, profileMap, accountFilter, fromMs, toMs, minLikesN, minCommentsN, minViewsN, minSharesN, minErN, followersByProfile]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "posted_at") {
        av = a.posted_at ? new Date(a.posted_at).getTime() : 0;
        bv = b.posted_at ? new Date(b.posted_at).getTime() : 0;
      } else if (sortKey === "er") {
        av = calculateEngagementRate(a, followersByProfile?.get(a.profile_id) ?? 0) ?? -1;
        bv = calculateEngagementRate(b, followersByProfile?.get(b.profile_id) ?? 0) ?? -1;
      } else {
        av = a[sortKey] ?? 0; bv = b[sortKey] ?? 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sortKey, sortDir, followersByProfile]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, sorted.length);
  const paged = useMemo(() => sorted.slice(pageStart, pageEnd), [sorted, pageStart, pageEnd]);

  // Reset to page 1 when filters/sort/page-size change the result set
  useEffect(() => { setPage(1); }, [query, accountFilter, sortKey, sortDir, pageSize, posts.length, fromMs, toMs, minLikesN, minCommentsN, minViewsN, minSharesN, minErN]);

  const activeAdvancedCount =
    (dateFrom || dateTo ? 1 : 0) +
    (minLikesN != null ? 1 : 0) +
    (minCommentsN != null ? 1 : 0) +
    (minViewsN != null ? 1 : 0) +
    (minSharesN != null ? 1 : 0) +
    (minErN != null ? 1 : 0);

  const clearAdvanced = () => {
    setDateFrom(undefined); setDateTo(undefined);
    setMinLikes(""); setMinComments(""); setMinViews(""); setMinShares(""); setMinErPct("");
  };

  const toggle = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "posted_at" ? "desc" : "desc"); }
  };

  const exportCsv = () => {
    const headers = ["Platform", "Handle", "Profile URL", "Posted At", "Caption", "Post URL", "Views", "Likes", "Comments", "Shares", "Engagement", "Engagement Rate"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = sorted.map((p) => {
      const prof = profileMap.get(p.profile_id);
      const er = calculateEngagementRate(p, followersByProfile?.get(p.profile_id) ?? 0);
      return [
        prof?.platform ?? "",
        prof?.handle ?? "",
        prof?.profile_url ?? "",
        p.posted_at ?? "",
        (p.caption ?? "").replace(/\s+/g, " ").trim(),
        p.url ?? "",
        p.views, p.likes, p.comments, p.shares,
        p.likes + p.comments + p.shares,
        er != null ? (er * 100).toFixed(2) + "%" : "",
      ].map(escape).join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `posts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight font-serif-display">
            All posts
          </h2>
          <p className="text-sm text-muted-foreground">
            Sortable list with direct links to each social profile and post
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            <span className="font-semibold text-foreground">{sorted.length}</span>
            {(tokens.length > 0 || accountFilter !== "all" || activeAdvancedCount > 0) ? ` of ${posts.length}` : ""} posts
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={sorted.length === 0}
            aria-label={`Export ${sorted.length} posts as CSV`}
            className="h-9"
          >
            <Download aria-hidden="true" className="size-4 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filter toolbar */}
      <Card className="p-3 sm:p-4 shadow-[var(--shadow-card)] border-border/60">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search — grows to fill */}
          <div className="relative flex-1 min-w-0" role="search">
            <label htmlFor="posts-search" className="sr-only">Search posts</label>
            <Search aria-hidden="true" className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              id="posts-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search caption, #hashtag, @handle…"
              aria-label="Search posts by caption, hashtag, or handle"
              className="h-9 w-full pl-9 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </div>

          {/* Right-aligned controls */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 shrink-0">
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[180px]" aria-label="Filter by social account">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">All accounts</SelectItem>
                {platforms.map(([platform, profs]) => {
                  const meta = platformMeta[platform];
                  return (
                    <Fragment key={platform}>
                      <SelectItem value={`platform:${platform}`}>
                        {meta?.label ?? platform} — all
                      </SelectItem>
                      {profs.map((pr) => (
                        <SelectItem key={pr.id} value={`profile:${pr.id}`}>
                          <span className="pl-3">{meta?.label ?? platform} · @{pr.handle}</span>
                        </SelectItem>
                      ))}
                    </Fragment>
                  );
                })}
              </SelectContent>
            </Select>

            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                const [k, d] = v.split(":") as [SortKey, SortDir];
                setSortKey(k);
                setSortDir(d);
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-[180px]" aria-label="Sort posts">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="posted_at:desc">Newest first</SelectItem>
                <SelectItem value="posted_at:asc">Oldest first</SelectItem>
                <SelectItem value="likes:desc">Likes: highest to lowest</SelectItem>
                <SelectItem value="likes:asc">Likes: lowest to highest</SelectItem>
                <SelectItem value="views:desc">Views: highest to lowest</SelectItem>
                <SelectItem value="views:asc">Views: lowest to highest</SelectItem>
                <SelectItem value="comments:desc">Comments: highest to lowest</SelectItem>
                <SelectItem value="comments:asc">Comments: lowest to highest</SelectItem>
                <SelectItem value="shares:desc">Shares: highest to lowest</SelectItem>
                <SelectItem value="shares:asc">Shares: lowest to highest</SelectItem>
                <SelectItem value="er:desc">Engagement rate: highest to lowest</SelectItem>
                <SelectItem value="er:asc">Engagement rate: lowest to highest</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 gap-1.5 w-full sm:w-auto justify-start sm:justify-center", (dateFrom || dateTo) && "border-primary/60 text-primary")}
                  aria-label="Filter by date range"
                >
                  <CalendarIcon className="size-4 shrink-0" />
                  {dateFrom || dateTo ? (
                    <span className="tabular-nums truncate">
                      {dateFrom ? format(dateFrom, "MMM d") : "…"} – {dateTo ? format(dateTo, "MMM d") : "…"}
                    </span>
                  ) : (
                    <span>Date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-3 space-y-2">
                <div className="flex gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom}
                      className={cn("p-2 pointer-events-auto")} />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo}
                      disabled={dateFrom ? { before: dateFrom } : undefined}
                      className={cn("p-2 pointer-events-auto")} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                    Clear dates
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Advanced thresholds */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 gap-1.5 w-full sm:w-auto justify-start sm:justify-center", activeAdvancedCount > 0 && "border-primary/60 text-primary")}
                  aria-label="Advanced filters"
                >
                  <SlidersHorizontal className="size-4 shrink-0" />
                  <span>Filters</span>
                  {activeAdvancedCount > 0 && (
                    <Badge className="ml-1 h-4 px-1.5 text-[10px]" variant="secondary">{activeAdvancedCount}</Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Minimum thresholds</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="min-likes" className="text-xs">Min likes</Label>
                    <Input id="min-likes" type="number" min={0} inputMode="numeric" placeholder="0"
                      value={minLikes} onChange={(e) => setMinLikes(e.target.value)} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="min-comments" className="text-xs">Min comments</Label>
                    <Input id="min-comments" type="number" min={0} inputMode="numeric" placeholder="0"
                      value={minComments} onChange={(e) => setMinComments(e.target.value)} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="min-views" className="text-xs">Min views</Label>
                    <Input id="min-views" type="number" min={0} inputMode="numeric" placeholder="0"
                      value={minViews} onChange={(e) => setMinViews(e.target.value)} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="min-shares" className="text-xs">Min shares</Label>
                    <Input id="min-shares" type="number" min={0} inputMode="numeric" placeholder="0"
                      value={minShares} onChange={(e) => setMinShares(e.target.value)} className="h-8" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="min-er" className="text-xs">Min engagement rate (%)</Label>
                    <Input id="min-er" type="number" min={0} step="0.1" inputMode="decimal" placeholder="e.g. 1.5"
                      value={minErPct} onChange={(e) => setMinErPct(e.target.value)} className="h-8" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearAdvanced} disabled={activeAdvancedCount === 0}>
                    Clear all
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Quick platform filter pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border/60" role="toolbar" aria-label="Quick filter by platform">
          <Button
            size="sm"
            variant={accountFilter === "all" ? "default" : "outline"}
            onClick={() => setAccountFilter("all")}
            aria-pressed={accountFilter === "all"}
            className="h-7 text-xs"
          >
            All
          </Button>
          {platforms.map(([platform]) => {
            const meta = platformMeta[platform];
            const Icon = meta?.icon;
            const active = accountFilter === `platform:${platform}`
              || (accountFilter.startsWith("profile:")
                && profileMap.get(accountFilter.slice(8))?.platform === platform);
            return (
              <Button
                key={platform}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setAccountFilter(`platform:${platform}`)}
                aria-pressed={active}
                aria-label={`Filter posts by ${meta?.label ?? platform}`}
                className={cn("h-7 text-xs gap-1.5")}
              >
                {Icon && <Icon aria-hidden="true" className="size-3" />}
                {meta?.label ?? platform}
              </Button>
            );
          })}
          {(accountFilter !== "all" || activeAdvancedCount > 0 || tokens.length > 0) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAccountFilter("all");
                setQuery("");
                clearAdvanced();
              }}
              aria-label="Clear all filters"
              className="h-7 text-xs text-muted-foreground ml-auto"
            >
              <X aria-hidden="true" className="size-3 mr-1" /> Clear all
            </Button>
          )}
        </div>
      </Card>

      <Card className="shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="All posts">
            <caption className="sr-only">
              Sortable list of {sorted.length} posts. Activate column headers to sort. Use Enter on a row to open details.
            </caption>
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th scope="col" className="text-left py-2.5 px-3 font-medium">Platform</th>
                <th scope="col" className="text-left py-2.5 px-3 font-medium">Profile</th>
                <th scope="col" className="text-left py-2.5 px-3 font-medium">Post</th>
                <Th label="Date" k="posted_at" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
                <Th label="Views" k="views" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
                <Th label="Likes" k="likes" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
                <Th label="Comments" k="comments" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
                <Th label="Shares" k="shares" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
                <Th label="Eng. rate" k="er" sortKey={sortKey} sortDir={sortDir} onClick={toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      asCard={false}
                      variant={tokens.length > 0 || accountFilter !== "all" || activeAdvancedCount > 0 ? "no-results" : "no-data"}
                      title={tokens.length > 0 || accountFilter !== "all" || activeAdvancedCount > 0 ? "No posts match your filters" : "No posts in selected range"}
                      description={
                        tokens.length > 0 || accountFilter !== "all" || activeAdvancedCount > 0
                          ? "Try clearing the search, date range, thresholds, or selecting a different account."
                          : "Try expanding the date range or refresh to pull the latest posts."
                      }
                      primaryAction={
                        tokens.length > 0 || accountFilter !== "all" || activeAdvancedCount > 0
                          ? { label: "Clear filters", onClick: () => { setQuery(""); setAccountFilter("all"); clearAdvanced(); }, variant: "outline" }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              )}
              {paged.map((p) => {
                const prof = profileMap.get(p.profile_id);
                const meta = prof ? platformMeta[prof.platform] : null;
                const Icon = meta?.icon;
                const er = calculateEngagementRate(p, followersByProfile?.get(p.profile_id) ?? 0);
                const erBasis = p.views > 0 ? "views" : (followersByProfile?.get(p.profile_id) ?? 0) > 0 ? "followers" : null;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setOpenId(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenId(p.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open details for post by @${prof?.handle ?? "unknown"}${p.posted_at ? " from " + format(new Date(p.posted_at), "MMM d, yyyy") : ""}`}
                    className="border-t border-border hover:bg-muted/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        {Icon && (
                          <span className="inline-flex size-6 items-center justify-center rounded text-white"
                            style={{ background: `hsl(var(--${meta!.color}))` }}>
                            <Icon className="size-3" />
                          </span>
                        )}
                        <span className="hidden sm:inline">{meta?.label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      {prof ? (
                        <a href={prof.profile_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-foreground hover:underline">
                          @{prof.handle}<ExternalLink className="size-3 text-muted-foreground" />
                        </a>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 px-3 max-w-[320px]">
                      <span className="line-clamp-1">{p.caption || "—"}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                      {p.posted_at ? format(new Date(p.posted_at), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(p.views)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(p.likes)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(p.comments)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(p.shares)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap" title={erBasis ? `Based on ${erBasis}` : "No views or followers data"}>
                      {er != null ? formatPercent(er) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-border bg-muted/20"
          role="navigation"
          aria-label="Posts table pagination"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <label htmlFor="rows-per-page" className="whitespace-nowrap">Rows per page</label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger
                id="rows-per-page"
                className="h-8 w-[80px]"
                aria-label="Rows per page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span aria-live="polite" className="ml-2 tabular-nums">
              {sorted.length === 0
                ? "0 results"
                : `${pageStart + 1}–${pageEnd} of ${sorted.length}`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage(1)}
              disabled={currentPage <= 1}
              aria-label="First page"
            >
              <ChevronsLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums px-2" aria-current="page">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage(totalPages)}
              disabled={currentPage >= totalPages}
              aria-label="Last page"
            >
              <ChevronsRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      <PostDetailsDialog
        post={selected}
        profile={selectedProfile}
        open={!!selected}
        onOpenChange={(o) => !o && setOpenId(null)}
      />
    </section>
  );
}

function Th({ label, k, sortKey, sortDir, onClick, align = "left" }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir;
  onClick: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === k;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  const ariaSort: "ascending" | "descending" | "none" =
    !active ? "none" : sortDir === "asc" ? "ascending" : "descending";
  const nextDir = !active ? "descending" : sortDir === "asc" ? "descending" : "ascending";
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`py-2.5 px-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onClick(k)}
        aria-label={`Sort by ${label}, currently ${ariaSort === "none" ? "unsorted" : ariaSort}. Activate to sort ${nextDir}.`}
        className={`h-7 -my-1 px-1.5 text-xs uppercase tracking-wider ${active ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}<Icon aria-hidden="true" className="size-3 ml-1" />
      </Button>
    </th>
  );
}
