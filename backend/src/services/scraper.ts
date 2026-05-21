import dotenv from 'dotenv';
import { ProfileModel, ProfileSnapshotModel, PostModel, RefreshRunModel, WorkspaceModel } from '../models/index.js';

dotenv.config();

const ACTORS: Record<string, string | string[]> = {
  facebook:  [
    "apify/facebook-posts-scraper",  // Returns posts, not just pages
    "apidojo/facebook-scraper",      // Alternative: combined page + posts
    "apify/facebook-pages-scraper",  // Fallback: pages-only (will return 0 posts)
  ],
  instagram: "apify/instagram-profile-scraper",
  tiktok:    "clockworks/tiktok-scraper",
  youtube:   "streamers/youtube-channel-scraper",
  twitter:   "apidojo/twitter-user-scraper",
  linkedin: [
    "apimaestro/linkedin-profile-posts",
    "vulnv/linkedin-profile-scraper",
    "dev_fusion/Linkedin-Profile-Scraper",
  ],
};

export function cleanHandleAndUrl(rawInput: string, platform: string) {
  let cleanInput = rawInput.trim();
  
  if (cleanInput.includes('//') || cleanInput.includes('.com/')) {
    try {
      let urlString = cleanInput;
      if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
        urlString = 'https://' + urlString;
      }
      const url = new URL(urlString);
      let pathname = url.pathname;
      
      if (pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      
      const segments = pathname.split('/').filter(Boolean);
      
      if (platform === 'youtube' && segments.length > 1) {
        if (segments[0] === 'user' || segments[0] === 'c' || segments[0] === 'channel') {
          cleanInput = segments[1];
        } else {
          cleanInput = segments[segments.length - 1];
        }
      } else if (segments.length > 0) {
        cleanInput = segments[segments.length - 1];
      }
    } catch (e) {
      const parts = cleanInput.split('/').filter(Boolean);
      if (parts.length > 0) {
        cleanInput = parts[parts.length - 1];
      }
    }
  }
  
  cleanInput = cleanInput.replace(/^@/, '');
  cleanInput = cleanInput.split('?')[0];
  let cleanUrl = '';
  switch (platform) {
    case 'instagram':
      cleanUrl = `https://instagram.com/${cleanInput}`;
      break;
    case 'tiktok':
      cleanUrl = `https://tiktok.com/@${cleanInput}`;
      break;
    case 'twitter':
      cleanUrl = `https://twitter.com/${cleanInput}`;
      break;
    case 'youtube':
      cleanUrl = `https://youtube.com/@${cleanInput}`;
      break;
    case 'facebook':
      cleanUrl = `https://facebook.com/${cleanInput}`;
      break;
    default:
      cleanUrl = cleanInput;
  }

  return {
    handle: cleanInput,
    profile_url: cleanUrl
  };

  }

async function runActor(actor: string | string[], input: unknown, token: string, timeoutMs = 120_000): Promise<any[]> {
  // If actor is an array, try each slug until one succeeds
  const actorCandidates = Array.isArray(actor) ? actor : [actor];
  let lastErr: any = null;
  for (const a of actorCandidates) {
    try {
      const safeActor = a.replace('/', '~');
      const url = `https://api.apify.com/v2/acts/${safeActor}/run-sync-get-dataset-items?token=${token}&timeout=${Math.floor(timeoutMs/1000)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Apify ${a} ${res.status}: ${text.slice(0, 500)}`);
      }
      const data = await res.json() as any[];
      // Return immediately on success
      return data;
    } catch (err) {
      // keep trying other candidates
      lastErr = err;
      console.warn(`[runActor] Actor ${a} failed:`, (err as Error).message || err);
      continue;
    }
  }
  // All candidates failed
  throw lastErr || new Error('All Apify actor candidates failed');
}

function safeDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "number") {
    const d = new Date(v < 1e12 ? v * 1000 : v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const rel = v.trim().toLowerCase();
    const relMatch = rel.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
    if (relMatch) {
      const n = Number(relMatch[1]);
      const unit = relMatch[2];
      const mult: Record<string, number> = {
        second: 1e3, minute: 60e3, hour: 3600e3, day: 86400e3,
        week: 7 * 86400e3, month: 30 * 86400e3, year: 365 * 86400e3,
      };
      return new Date(Date.now() - n * mult[unit]);
    }
    if (rel === "yesterday") return new Date(Date.now() - 86400e3);
    if (rel === "today" || rel === "just now") return new Date();
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d;
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
  id: string;
  workspace_id: any;
  platform: string;
  handle: string;
  profile_url: string;
  external_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Normalized = {
  followers: number;
  following?: number;
  total_posts?: number;
  total_views?: number;
  avatar_url?: string;
  display_name?: string;
  posts: Array<{
    external_id: string;
    posted_at?: Date | null;
    url?: string;
    thumbnail_url?: string;
    caption?: string;
    media_type?: string;
    likes: number;
    comments: number;
    shares: number;
    views: number;
    raw: any;
  }>;
  raw: any;
};

async function fetchPlatform(p: Profile, token: string, limit = 25): Promise<Normalized> {
  switch (p.platform) {
    case "facebook": {
      const items = await runActor(ACTORS.facebook, {
        startUrls: [{ url: p.profile_url }],
        urls: [p.profile_url],
        resultsLimit: limit,
      }, token);
      // Debug: log structure to help diagnose field names
      try {
        if (items && items.length > 0) {
          console.log(`[facebook] returned ${items.length} items; pageName: ${items[0].pageName}, sample engagement:`, { 
            likes: items[0].likes, 
            comments: items[0].comments, 
            shares: items[0].shares,
          });
        }
      } catch (e) {
        // ignore
      }
      // Handle both post items and page metadata
      // Facebook posts-scraper returns post items directly (each has pageName, user, postId, text, etc.)
      // It does NOT return page profile data (followers, avatar), so we extract from posts
      const rawPosts = Array.isArray(items) ? items.filter((i: any) => i.text || i.message || i.story) : [];
      
      // Extract page info from posts (all posts should have the same pageName)
      const pageNameFromPosts = rawPosts[0]?.pageName ?? rawPosts[0]?.user ?? p.handle;
      
      // Calculate aggregate engagement from posts (use as proxy for followers-based metrics)
      const totalLikes = rawPosts.reduce((sum: number, post: any) => sum + num(post.likes ?? post.reactionLikeCount ?? 0), 0);
      const totalComments = rawPosts.reduce((sum: number, post: any) => sum + num(post.comments ?? 0), 0);
      const totalShares = rawPosts.reduce((sum: number, post: any) => sum + num(post.shares ?? 0), 0);
      const avgEngagementPerPost = rawPosts.length > 0 ? (totalLikes + totalComments + totalShares) / rawPosts.length : 0;
      
      const posts = rawPosts.slice(0, limit).map((post: any) => ({
        external_id: String(post.postId ?? post.id ?? post.url ?? Math.random().toString()),
        posted_at: safeDate(post.time ?? post.timestamp ?? post.date ?? post.created_time),
        url: post.url ?? post.postUrl ?? post.link ?? null,
        thumbnail_url: post.media?.[0]?.src ?? post.media?.[0]?.url ?? post.picture ?? post.media ?? null,
        caption: post.text ?? post.message ?? post.story ?? "",
        media_type: post.isVideo ? "video" : (post.media ? "image" : "text"),
        likes: num(post.likes ?? post.reactionLikeCount ?? 0),
        comments: num(post.comments ?? 0),
        shares: num(post.shares ?? 0),
        views: num(post.views ?? post.videoViewCount ?? post.viewsCount ?? 0),
        raw: post,
      }));
      
      return {
        // Facebook posts-scraper doesn't return follower data
        // Estimate followers as: avg_engagement_per_post * 5 (rough multiplier for reach)
        followers: Math.ceil(avgEngagementPerPost * 5) || 1, // At least 1 to avoid division by zero
        following: 0,
        total_posts: posts.length,
        avatar_url: null, // Not available from posts-scraper
        display_name: pageNameFromPosts,
        posts,
        raw: { pageName: pageNameFromPosts, totalEngagement: totalLikes + totalComments + totalShares },
      };
    }
    case "instagram": {
      const items = await runActor(ACTORS.instagram, {
        usernames: [p.handle],
        startUrls: [{ url: p.profile_url }],
        resultsLimit: limit,
      }, token);
      const profile = items[0] ?? {};
      const latest = profile.latestPosts ?? profile.posts ?? [];
      const posts = latest.slice(0, limit).map((post: any) => ({
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
        display_name: profile.fullName ?? undefined,
        posts,
        raw: profile,
      };
    }
    case "tiktok": {
      const items = await runActor(ACTORS.tiktok, {
        profiles: [p.handle],
        startUrls: [{ url: p.profile_url }],
        resultsPerPage: limit,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }, token);
      const author = items[0]?.authorMeta ?? {};
      const posts = items.slice(0, limit).map((v: any) => ({
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
        display_name: author.nickname ?? author.uniqueId ?? undefined,
        posts,
        raw: author,
      };
    }
    case "youtube": {
      const items = await runActor(ACTORS.youtube, {
        startUrls: [{ url: `https://www.youtube.com/@${p.handle}/videos` }],
        urls: [`https://www.youtube.com/@${p.handle}/videos`],
        maxResults: limit,
        maxResultsShorts: 0,
        maxResultStreams: 0,
      }, token);
      const channelInfo = items.find((i: any) => i.numberOfSubscribers != null || i.subscriberCount != null) ?? items[0] ?? {};
      const videos = items.filter((i: any) => i.url || i.id || i.videoId);
      const posts = videos.slice(0, limit).map((v: any) => {
        let videoId = v.id || v.videoId;
        if (!videoId && v.url) {
          const match = v.url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([^#\&\?]+)/);
          videoId = match ? match[1] : v.url;
        }
        return {
          external_id: String(videoId || Math.random().toString()),
          posted_at: safeDate(v.date ?? v.uploadDate),
          url: v.url,
          thumbnail_url: v.thumbnailUrl ?? (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null),
          caption: v.title ?? "",
          media_type: "video",
          likes: num(v.likes),
          comments: num(v.commentsCount ?? v.comments),
          shares: 0,
          views: num(v.viewCount ?? v.views),
          raw: v,
        };
      });
      return {
        followers: num(channelInfo.numberOfSubscribers ?? channelInfo.subscriberCount),
        total_posts: num(channelInfo.videosCount ?? videos.length),
        total_views: num(channelInfo.channelTotalViews ?? channelInfo.viewCount),
        avatar_url: channelInfo.channelAvatarUrl ?? channelInfo.avatarUrl ?? channelInfo.avatar ?? undefined,
        display_name: channelInfo.channelName ?? undefined,
        posts,
        raw: channelInfo,
      };
    }
    case "twitter": {
      const items = await runActor(ACTORS.twitter, {
        twitterHandles: [p.handle],
        startUrls: [p.profile_url],
        urls: [p.profile_url],
        maxItems: limit,
      }, token);
      // Debug: log item structure
      try {
        if (items && items.length > 0) {
          console.log(`[twitter] returned ${items.length} items; sample keys:`, Object.keys(items[0]).slice(0,25));
        }
      } catch (e) {
        // ignore
      }
      const userItem = items[0] ?? {};
      // Filter out tweets: has text/fullText, does NOT have screenName (that's the user profile)
      const tweetItems = items.filter((t: any) => (t.tweetId || t.id || t.text || t.fullText) && !t.screenName && !t.screen_name);
      const posts = tweetItems.slice(0, limit).map((t: any) => ({
        external_id: String(t.id ?? t.tweetId ?? Math.random().toString()),
        posted_at: safeDate(t.createdAt ?? t.created_at ?? t.timestamp),
        url: t.url ?? t.twitterUrl ?? (t.id ? `https://twitter.com/${p.handle}/status/${t.id}` : null),
        thumbnail_url: t.media?.[0]?.media_url_https ?? t.media?.[0]?.url ?? null,
        caption: t.text ?? t.fullText ?? t.tweet ?? "",
        media_type: t.media?.[0]?.type ?? "text",
        likes: num(t.likeCount ?? t.favoriteCount ?? t.favorite_count),
        comments: num(t.replyCount ?? t.reply_count ?? t.in_reply_to_count),
        shares: num(t.retweetCount ?? t.retweet_count ?? 0),
        views: num(t.viewCount ?? t.views),
        raw: t,
      }));
      const author = userItem.author ?? userItem;
      return {
        followers: num(author.followers ?? author.followersCount ?? author.followers_count),
        following: num(author.following ?? author.followingCount ?? author.friends_count ?? author.friendsCount),
        total_posts: num(author.statusesCount ?? author.tweetsCount ?? author.statuses_count ?? tweetItems.length),
        avatar_url: author.profilePicture ?? author.profileImageUrl ?? author.profile_image_url_https ?? author.profile_image_url ?? undefined,
        display_name: author.name ?? author.displayName ?? undefined,
        posts,
        raw: author,
      };
    }
    case "linkedin": {
      const items = await runActor(ACTORS.linkedin, {
        urls: [p.profile_url],
        startUrls: [{ url: p.profile_url }],
        limit: limit,
      }, token);
      // Debug: log returned item shape to help map fields
      try {
        if (Array.isArray(items)) {
          console.log(`[linkedin] returned ${items.length} items; sample keys:`, Object.keys(items[0] || {}).slice(0,20));
        }
      } catch (e) {
        // ignore logging errors
      }

      // If actor returned posts as top-level items, use them directly
      const rawPosts = Array.isArray(items) ? items : [];

      // Try to extract profile/company-level metadata from first item or from nested author
      const first = rawPosts[0] || {};
      const author = first.author || {};
      const company = first.company || {};

      // Attempt to enrich profile-level metadata (followers/connections) by running
      // the Linkedin-Profile-Scraper actor which returns profile details including followers.
      let profileEnrich: any = null;
      try {
        const profileActors = [
          'vulnv/linkedin-profile-scraper',
          'dev_fusion/Linkedin-Profile-Scraper',
          'apimaestro/linkedin-profile-scraper',
          'apimaestro/linkedin-profile-posts',
          'apify/linkedin-profile-scraper'
        ];
        const profItems = await runActor(profileActors, {
          linkedinUrl: p.profile_url,
          linkedinPublicUrl: p.profile_url,
          publicIdentifier: p.handle,
        }, token, 30_000);
        profileEnrich = Array.isArray(profItems) ? profItems[0] : profItems;
        if (profileEnrich) {
          console.log('[linkedin] profile enrich returned keys:', Object.keys(profileEnrich).slice(0,20));
          // If the enrichment actor returned posts/activity, merge them into rawPosts
          try {
            const profilePosts = profileEnrich.posts ?? profileEnrich.activity ?? profileEnrich.posts_list ?? [];
            if (Array.isArray(profilePosts) && profilePosts.length) {
              // ensure rawPosts is mutable
              // (we'll reassign below if needed)
              // merge while avoiding duplicates by id/url
              const existing = new Set((rawPosts || []).map((r: any) => String(r.id ?? r.urn ?? r.postUrl ?? r.url ?? r.link ?? '')));
              for (const pp of profilePosts) {
                const pk = String(pp.id ?? pp.urn ?? pp.postUrl ?? pp.url ?? pp.link ?? Math.random().toString());
                if (!existing.has(pk)) {
                  (rawPosts as any[]).push(pp);
                  existing.add(pk);
                }
              }
            }
          } catch (e) {
            // ignore merge errors
            console.warn('[linkedin] failed merging profile posts:', (e as Error).message || e);
          }
        }
      } catch (e) {
        // runActor will try candidates; surface useful approval URLs if present
        const msg = (e as Error).message || String(e);
        const approvalMatch = msg.match(/"approvalUrl"\s*:\s*"([^"]+)"/);
        if (approvalMatch) {
          console.warn('[linkedin] profile enrichment requires approval:', approvalMatch[1]);
        } else {
          console.warn('[linkedin] profile enrichment actor(s) failed:', msg);
        }
      }

      const enrichedFollowers = num(profileEnrich?.followers ?? profileEnrich?.connections ?? profileEnrich?.connectionsCount ?? profileEnrich?.followersCount);

      const followers = enrichedFollowers > 0 ? enrichedFollowers : num(
        // company-level
        company.followerCount ?? company.followersCount ?? company.followers ??
        // author-level common keys
        author.followers ?? author.followerCount ?? author.followersCount ?? author.stats?.followers ?? author.stats?.followersCount ??
        // fallback to first item
        first.followerCount ?? first.followers
      );

      const display_name = company.name ?? company.title ?? author.name ?? first.name ?? p.handle;
      const avatar_url = company.logo ?? company.logoUrl ?? company.avatarUrl ?? author.avatar ?? null;

      const posts = rawPosts.slice(0, limit).map((t: any) => ({
        external_id: String(t.id ?? t.urn ?? t.postUrl ?? t.urnId ?? Math.random().toString()),
        posted_at: safeDate(t.posted_at ?? t.postedAt ?? t.createdAt ?? t.publishedAt ?? t.postedAtISO),
        url: t.postUrl ?? t.url ?? t.permalink ?? null,
        thumbnail_url: t.image ?? t.thumbnail ?? (
          // actor may return media as object or array
          (t.media && (t.media.url || (Array.isArray(t.media.images) && t.media.images[0]?.url))) ??
          (Array.isArray(t.media) && (t.media[0]?.url || t.media[0]?.image))
        ) ?? null,
        caption: t.text ?? t.commentary ?? t.description ?? t.body ?? "",
        media_type: t.post_type ?? (t.image ? "image" : (t.video ? "video" : "text")),
        likes: num(
          t.stats?.like ?? t.stats?.likes ?? t.stats?.numLikes ?? t.stats?.likeCount ?? t.stats?.total_reactions ?? t.numLikes ?? t.likes ?? t.reactions ?? t.reactionCount
        ),
        comments: num(
          t.stats?.comments ?? t.stats?.numComments ?? t.stats?.commentCount ?? t.numComments ?? t.comments ?? 0
        ),
        shares: num(
          t.stats?.reposts ?? t.stats?.shares ?? t.stats?.numShares ?? t.stats?.shareCount ?? t.numShares ?? t.shares ?? 0
        ),
        views: num(
          t.stats?.views ?? t.stats?.viewCount ?? t.views ?? 0
        ),
        raw: t,
      }));

      return {
        followers,
        following: undefined,
        total_posts: num(rawPosts.length),
        total_views: undefined,
        avatar_url,
        display_name,
        posts,
        raw: rawPosts,
      };
    }
  }
  throw new Error(`Unknown platform ${p.platform}`);
}

async function refreshOne(p: Profile, token: string, limit = 25) {
  const data = await fetchPlatform(p, token, limit);

  // Update profile metadata
  await ProfileModel.updateOne(
    { id: p.id },
    { $set: { 
        avatar_url: data.avatar_url ?? null, 
        display_name: data.display_name ?? null, 
        updated_at: new Date() 
      } 
    }
  );

  // Insert snapshot
  await ProfileSnapshotModel.create({
    profile_id: p.id,
    workspace_id: p.workspace_id,
    followers: data.followers,
    following: data.following ?? null,
    total_posts: data.total_posts ?? null,
    total_views: data.total_views ?? null,
    raw: data.raw,
    captured_at: new Date(),
  });

  // Upsert posts
  let upserted = 0;
  if (data.posts.length) {
    for (const post of data.posts) {
      const eng = post.likes + post.comments + post.shares;
      const rate = data.followers > 0 ? eng / data.followers : 0;
      
      await PostModel.findOneAndUpdate(
        { profile_id: p.id, external_id: post.external_id },
        {
          $set: {
            workspace_id: p.workspace_id,
            posted_at: post.posted_at,
            url: post.url ?? null,
            thumbnail_url: post.thumbnail_url ?? null,
            caption: post.caption?.slice(0, 2000) ?? "",
            media_type: post.media_type ?? null,
            likes: post.likes,
            comments: post.comments,
            shares: post.shares,
            views: post.views,
            engagement_rate: rate,
            raw: post.raw,
            fetched_at: new Date(),
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }
    upserted = data.posts.length;
  }

  console.log(`[refreshOne] profile ${p.id} (${p.platform}) upserted ${upserted} posts`);

  return { posts_upserted: upserted };
}

export async function runScraperSync(triggeredBy = 'manual', workspaceId: string, targetProfileId?: string): Promise<any> {
  let runId: string | null = null;
  
  try {
    // 1. Create run record
    const run = await RefreshRunModel.create({
      workspace_id: workspaceId,
      triggered_by: triggeredBy,
      status: 'running',
      started_at: new Date(),
    });
    runId = run.id;

    // 2. Fetch profiles & Workspace API Key
    const rawProfiles = await ProfileModel.find({ workspace_id: workspaceId });
    const profiles: Profile[] = [];
    
    for (const p of rawProfiles) {
      let handle = p.handle;
      let profileUrl = p.profile_url;
      
      const isMalformed = 
        profileUrl.includes('/http') || 
        handle.startsWith('http') || 
        handle.includes('/') ||
        (p.platform === 'youtube' && handle.includes('@') && handle.indexOf('@') > 0);
        
      if (isMalformed) {
        const cleaned = cleanHandleAndUrl(handle || profileUrl, p.platform);
        handle = cleaned.handle;
        profileUrl = cleaned.profile_url;
        await ProfileModel.updateOne(
          { _id: p._id },
          { $set: { handle: cleaned.handle, profile_url: cleaned.profile_url, updated_at: new Date() } }
        );
      }
      
      profiles.push({
        id: p.id,
        workspace_id: p.workspace_id,
        platform: p.platform,
        handle,
        profile_url: profileUrl,
        external_id: p.external_id || null,
        display_name: p.display_name || null,
        avatar_url: p.avatar_url || null
      });
    }

    let filteredProfiles = profiles;
    if (targetProfileId) {
      filteredProfiles = filteredProfiles.filter(p => p.id === targetProfileId);
    }
    const workspace = await WorkspaceModel.findById(workspaceId).lean();
    
    // Resolve Token: Priority 1: User's custom key, Priority 2: System global key
    const activeToken = workspace?.apify_api_key || process.env.APIFY_API_KEY || '';

    // Determine the data limit: only unlock custom limits if they brought their own key
    const limit = (workspace?.apify_api_key && workspace?.apify_data_limit) ? workspace.apify_data_limit : 25;

    const errors: Record<string, string> = {};
    let updated = 0;
    let postsTotal = 0;

    // Run sequentially to avoid Apify concurrency issues
    for (const p of filteredProfiles) {
      try {
        const r = await refreshOne(p, activeToken, limit);
        postsTotal += r.posts_upserted;
        updated += 1;
      } catch (e) {
        console.error(`[${p.platform}] failed:`, e);
        errors[p.platform] = (e as Error).message;
      }
    }

    // 3. Update run record
    const status = Object.keys(errors).length === filteredProfiles.length 
      ? "failed" 
      : Object.keys(errors).length > 0 
        ? "partial" 
        : "success";

    await RefreshRunModel.updateOne(
      { id: runId },
      {
        $set: {
          finished_at: new Date(),
          status,
          profiles_updated: updated,
          posts_upserted: postsTotal,
          errors: Object.keys(errors).length ? errors : null,
        }
      }
    );

    return {
      run_id: runId,
      status,
      profiles_updated: updated,
      posts_upserted: postsTotal,
      errors
    };
  } catch (error) {
    console.error('Error running scraper sync:', error);
    if (runId) {
      await RefreshRunModel.updateOne(
        { id: runId },
        {
          $set: {
            finished_at: new Date(),
            status: 'failed',
            errors: { global: (error as Error).message },
          }
        }
      ).catch(e => console.error('Failed to log failed run status:', e));
    }
    throw error;
  }
}
