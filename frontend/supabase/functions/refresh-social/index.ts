// Refresh social media metrics from Apify for all configured profiles.
// Public endpoint (no JWT) — safe because it only writes from the server using the service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_TOKEN = Deno.env.get("APIFY_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// Apify actor IDs (public actors, free or low-cost). Format: user~actor.
const ACTORS: Record<string, string> = {
  facebook:  "apify~facebook-pages-scraper",
  instagram: "apify~instagram-profile-scraper",
  tiktok:    "clockworks~tiktok-scraper",
  youtube:   "streamers~youtube-channel-scraper",
  twitter:   "apidojo~twitter-user-scraper",
  
};

async function runActor(actor: string, input: unknown, timeoutMs = 120_000): Promise<any[]> {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=${Math.floor(timeoutMs/1000)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${actor} ${res.status}: ${text.slice(0, 500)}`);
  }
  return await res.json();
}

function safeDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    // Unix seconds vs ms
    const d = new Date(v < 1e12 ? v * 1000 : v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "string") {
    // Relative dates like "7 days ago", "2 weeks ago", "1 month ago", "yesterday"
    const rel = v.trim().toLowerCase();
    const relMatch = rel.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
    if (relMatch) {
      const n = Number(relMatch[1]);
      const unit = relMatch[2];
      const mult: Record<string, number> = {
        second: 1e3, minute: 60e3, hour: 3600e3, day: 86400e3,
        week: 7 * 86400e3, month: 30 * 86400e3, year: 365 * 86400e3,
      };
      return new Date(Date.now() - n * mult[unit]).toISOString();
    }
    if (rel === "yesterday") return new Date(Date.now() - 86400e3).toISOString();
    if (rel === "today" || rel === "just now") return new Date().toISOString();
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function num(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.replace(/,/g, "").match(/[\d.]+/);
    return m ? Number(m[0]) : 0;
  }
  return 0;
}

type Profile = {
  id: string; platform: string; handle: string; profile_url: string; external_id: string | null;
};

type Normalized = {
  followers: number; following?: number; total_posts?: number; total_views?: number; avatar_url?: string;
  posts: Array<{
    external_id: string; posted_at?: string | null; url?: string; thumbnail_url?: string;
    caption?: string; media_type?: string; likes: number; comments: number; shares: number; views: number;
    raw: any;
  }>;
  raw: any;
};

async function fetchPlatform(p: Profile): Promise<Normalized> {
  switch (p.platform) {
    case "facebook": {
      const items = await runActor(ACTORS.facebook, {
        startUrls: [{ url: p.profile_url }],
        resultsLimit: 25,
      });
      const page = items[0] ?? {};
      const posts = (page.posts ?? []).slice(0, 25).map((post: any) => ({
        external_id: String(post.postId ?? post.id ?? post.url),
        posted_at: safeDate(post.time ?? post.timestamp),
        url: post.url,
        thumbnail_url: post.thumbnail ?? post.imageUrl ?? null,
        caption: post.text ?? post.message ?? "",
        media_type: post.type ?? null,
        likes: num(post.likes ?? post.likesCount ?? post.reactionsCount),
        comments: num(post.comments ?? post.commentsCount),
        shares: num(post.shares ?? post.sharesCount),
        views: num(post.views ?? post.videoViewCount ?? 0),
        raw: post,
      }));
      return {
        followers: num(page.likes ?? page.followers ?? page.followersCount),
        following: num(page.following),
        total_posts: posts.length,
        avatar_url: page.profilePictureUrl ?? page.image ?? undefined,
        posts,
        raw: page,
      };
    }
    case "instagram": {
      const items = await runActor(ACTORS.instagram, {
        usernames: [p.handle],
        resultsLimit: 25,
      });
      const profile = items[0] ?? {};
      const latest = profile.latestPosts ?? profile.posts ?? [];
      const posts = latest.slice(0, 25).map((post: any) => ({
        external_id: String(post.shortCode ?? post.id ?? post.url),
        posted_at: safeDate(post.timestamp),
        url: post.url,
        thumbnail_url: post.displayUrl ?? post.thumbnailUrl ?? null,
        caption: post.caption ?? "",
        media_type: post.type ?? null,
        likes: num(post.likesCount),
        comments: num(post.commentsCount),
        shares: 0,
        views: num(post.videoViewCount ?? post.videoPlayCount ?? 0),
        raw: post,
      }));
      return {
        followers: num(profile.followersCount),
        following: num(profile.followsCount),
        total_posts: num(profile.postsCount),
        avatar_url: profile.profilePicUrl ?? undefined,
        posts,
        raw: profile,
      };
    }
    case "tiktok": {
      const items = await runActor(ACTORS.tiktok, {
        profiles: [p.handle],
        resultsPerPage: 25,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      });
      // clockworks tiktok scraper returns one item per video; profile info on each item.
      const author = items[0]?.authorMeta ?? {};
      const posts = items.slice(0, 25).map((v: any) => ({
        external_id: String(v.id),
        posted_at: safeDate(v.createTimeISO ?? (v.createTime ? new Date(v.createTime * 1000).toISOString() : null)),
        url: v.webVideoUrl,
        thumbnail_url: v.videoMeta?.coverUrl ?? null,
        caption: v.text ?? "",
        media_type: "video",
        likes: num(v.diggCount),
        comments: num(v.commentCount),
        shares: num(v.shareCount),
        views: num(v.playCount),
        raw: v,
      }));
      return {
        followers: num(author.fans),
        following: num(author.following),
        total_posts: num(author.video),
        total_views: num(author.heart),
        avatar_url: author.avatar ?? undefined,
        posts,
        raw: author,
      };
    }
    case "youtube": {
      const items = await runActor(ACTORS.youtube, {
        startUrls: [{ url: `https://www.youtube.com/@${p.handle}/videos` }],
        maxResults: 25,
        maxResultsShorts: 0,
        maxResultStreams: 0,
      });
      const channelInfo = items.find((i: any) => i.numberOfSubscribers != null) ?? items[0] ?? {};
      const videos = items.filter((i: any) => i.id || i.videoId);
      const posts = videos.slice(0, 25).map((v: any) => ({
        external_id: String(v.id ?? v.videoId ?? v.url),
        posted_at: safeDate(v.date ?? v.uploadDate),
        url: v.url,
        thumbnail_url: v.thumbnailUrl ?? null,
        caption: v.title ?? "",
        media_type: "video",
        likes: num(v.likes),
        comments: num(v.commentsCount),
        shares: 0,
        views: num(v.viewCount),
        raw: v,
      }));
      return {
        followers: num(channelInfo.numberOfSubscribers ?? channelInfo.subscriberCount),
        total_posts: num(channelInfo.videosCount),
        total_views: num(channelInfo.channelTotalViews),
        avatar_url: channelInfo.channelAvatarUrl ?? undefined,
        posts,
        raw: channelInfo,
      };
    }
    case "twitter": {
      const items = await runActor(ACTORS.twitter, {
        startUrls: [p.profile_url],
        maxItems: 25,
      });
      const userItem = items[0] ?? {};
      const posts = items.filter((t: any) => t.id || t.tweetId).slice(0, 25).map((t: any) => ({
        external_id: String(t.id ?? t.tweetId),
        posted_at: safeDate(t.createdAt),
        url: t.url ?? t.twitterUrl,
        thumbnail_url: t.media?.[0]?.media_url_https ?? null,
        caption: t.text ?? t.fullText ?? "",
        media_type: t.media?.[0]?.type ?? "text",
        likes: num(t.likeCount ?? t.favoriteCount),
        comments: num(t.replyCount),
        shares: num(t.retweetCount),
        views: num(t.viewCount),
        raw: t,
      }));
      const author = userItem.author ?? userItem;
      return {
        followers: num(author.followers ?? author.followersCount),
        following: num(author.following ?? author.followingCount),
        total_posts: num(author.statusesCount ?? author.tweetsCount),
        avatar_url: author.profilePicture ?? author.profileImageUrl ?? undefined,
        posts,
        raw: author,
      };
    }
  }
  throw new Error(`Unknown platform ${p.platform}`);
}

async function refreshOne(p: Profile, runId: string) {
  const data = await fetchPlatform(p);

  // Update profile metadata
  await supabase.from("profiles").update({
    avatar_url: data.avatar_url ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", p.id);

  // Insert snapshot
  await supabase.from("profile_snapshots").insert({
    profile_id: p.id,
    followers: data.followers,
    following: data.following ?? null,
    total_posts: data.total_posts ?? null,
    total_views: data.total_views ?? null,
    raw: data.raw,
  });

  // Upsert posts
  let upserted = 0;
  if (data.posts.length) {
    const rows = data.posts.map((post) => {
      const eng = post.likes + post.comments + post.shares;
      const rate = data.followers > 0 ? eng / data.followers : 0;
      return {
        profile_id: p.id,
        external_id: post.external_id,
        posted_at: post.posted_at,
        url: post.url,
        thumbnail_url: post.thumbnail_url,
        caption: post.caption?.slice(0, 2000) ?? "",
        media_type: post.media_type,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        views: post.views,
        engagement_rate: rate,
        raw: post.raw,
        fetched_at: new Date().toISOString(),
      };
    });
    const { error } = await supabase.from("posts").upsert(rows, { onConflict: "profile_id,external_id" });
    if (error) throw error;
    upserted = rows.length;
  }

  return { posts_upserted: upserted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Create run record
  const { data: run, error: runErr } = await supabase
    .from("refresh_runs")
    .insert({ triggered_by: req.headers.get("x-trigger") ?? "manual" })
    .select()
    .single();
  if (runErr || !run) {
    return new Response(JSON.stringify({ error: runErr?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
  if (pErr || !profiles) {
    return new Response(JSON.stringify({ error: pErr?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const errors: Record<string, string> = {};
  let updated = 0;
  let postsTotal = 0;

  // Run sequentially to avoid Apify concurrency issues
  for (const p of profiles as Profile[]) {
    try {
      const r = await refreshOne(p, run.id);
      postsTotal += r.posts_upserted;
      updated += 1;
    } catch (e) {
      console.error(`[${p.platform}] failed:`, e);
      errors[p.platform] = (e as Error).message;
    }
  }

  await supabase.from("refresh_runs").update({
    finished_at: new Date().toISOString(),
    status: Object.keys(errors).length === profiles.length ? "failed" : (Object.keys(errors).length ? "partial" : "success"),
    profiles_updated: updated,
    posts_upserted: postsTotal,
    errors: Object.keys(errors).length ? errors : null,
  }).eq("id", run.id);

  return new Response(JSON.stringify({
    run_id: run.id, profiles_updated: updated, posts_upserted: postsTotal, errors,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
