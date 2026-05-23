import dotenv from 'dotenv';
import { ProfileModel, ProfileSnapshotModel, PostModel, RefreshRunModel, WorkspaceModel } from '../models/index.js';

dotenv.config();

const ACTORS: Record<string, string | string[]> = {
  facebook:  "apify/facebook-posts-scraper",   // Standard posts scraper
  instagram: "apify/instagram-profile-scraper",
  tiktok:    "clockworks/tiktok-scraper",
  youtube:   "streamers/youtube-channel-scraper",
  twitter: [
    "parseforge/x-com-scraper",       // Primary — cheapest at ~$0.10-0.15/1k
    "apidojo/tweet-scraper",          // Fallback
  ],
  linkedin: [
    "apimaestro/linkedin-profile-posts",
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
    case 'linkedin':
      cleanUrl = `https://www.linkedin.com/in/${cleanInput}`;
      break;
    default:
      cleanUrl = cleanInput;
  }

  return {
    handle: cleanInput,
    profile_url: cleanUrl
  };

  }

async function runActor(actor: string | string[], input: any, token: string, timeoutMs = 120_000): Promise<any[]> {
  // If actor is an array, try each slug until one succeeds
  const actorCandidates = Array.isArray(actor) ? actor : [actor];
  let lastErr: any = null;
  for (const a of actorCandidates) {
    try {
      const safeActor = a.replace('/', '~');
      const url = `https://api.apify.com/v2/acts/${safeActor}/run-sync-get-dataset-items?token=${token}&timeout=${Math.floor(timeoutMs/1000)}`;
      
      // Dynamically clean inputs for specific actors to prevent parameter conflicts
      let prunedInput: any = {};
      if (a === "parseforge/x-com-scraper") {
        const username = input.usernames?.[0] ?? (input.profileUrls?.[0] ? input.profileUrls[0].split('/').pop() : "");
        prunedInput = {
          usernames: username ? [username] : [],
          maxItems: input.maxItems ?? input.resultsLimit ?? 25,
        };
      } else if (a === "apidojo/tweet-scraper") {
        prunedInput = {
          startUrls: input.startUrls ?? (input.profileUrls ? input.profileUrls.map((u: string) => ({ url: u })) : []),
          tweetsDesired: input.tweetsDesired ?? input.resultsLimit ?? 25,
        };
      } else if (a === "apify/facebook-posts-scraper") {
        prunedInput = {
          startUrls: input.startUrls ?? (input.urls ? input.urls.map((u: string) => ({ url: u })) : []),
          resultsLimit: input.resultsLimit ?? 25,
        };
      } else if (a === "apify/facebook-pages-scraper") {
        prunedInput = {
          startUrls: input.startUrls ?? (input.urls ? input.urls.map((u: string) => ({ url: u })) : []),
        };
      } else {
        prunedInput = input;
      }

      console.log(`[runActor] Attempting actor ${a} with input:\n`, JSON.stringify(prunedInput, null, 2));
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prunedInput),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Apify ${a} ${res.status}: ${text.slice(0, 500)}`);
      }
      const data = await res.json() as any[];
      console.log(`[runActor] Actor ${a} finished. Items returned: ${data?.length || 0}`);
      
      const isDemo = data && data.length > 0 && data.every((i: any) => i.demo);
      if (!data || data.length === 0 || isDemo) {
        throw new Error(`Actor returned empty or demo dataset (${data?.length || 0} items)`);
      }
      
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
      // 1. Run posts scraper to get post history
      const items = await runActor(ACTORS.facebook, {
        startUrls: [{ url: p.profile_url }],
        urls: [p.profile_url],
        resultsLimit: limit,
      }, token, 180_000);
      
      const rawPosts = Array.isArray(items) ? items.filter((i: any) => i.text || i.message || i.story || i.postText || i.postId) : [];

      // 2. Fetch page-level metadata using pages-scraper to enrich profile details (followers count)
      let pageEnrich: any = null;
      try {
        const pageItems = await runActor("apify/facebook-pages-scraper", {
          startUrls: [{ url: p.profile_url }],
          urls: [p.profile_url],
        }, token, 60_000);
        pageEnrich = Array.isArray(pageItems) ? pageItems.find((i: any) => (i.likes != null || i.followers != null || i.categories != null) && !i.postId && !i.text && !i.story) ?? pageItems[0] : pageItems;
        if (pageEnrich) {
          console.log('[facebook] page enrich returned keys:', Object.keys(pageEnrich).slice(0, 20));
        }
      } catch (e) {
        console.warn('[facebook] page enrichment failed:', (e as Error).message || e);
      }

      // Try to extract page-level metadata from pageEnrich first, then fallback to posts or fallback estimate
      const pageItem = pageEnrich ?? {};
      const pageFollowers = num(pageItem.followers ?? pageItem.followersCount ?? pageItem.likes ?? pageItem.likeCount ?? pageItem.fan_count);

      // Extract page info from posts or page metadata
      const pageNameFromPosts = rawPosts[0]?.pageName ?? rawPosts[0]?.user ?? pageItem.title ?? pageItem.name ?? pageItem.pageName ?? p.handle;
      
      // Calculate aggregate engagement from posts (use as proxy for followers-based metrics)
      const totalLikes = rawPosts.reduce((sum: number, post: any) => sum + num(post.likes ?? post.reactionLikeCount ?? 0), 0);
      const totalComments = rawPosts.reduce((sum: number, post: any) => sum + num(post.comments ?? 0), 0);
      const totalShares = rawPosts.reduce((sum: number, post: any) => sum + num(post.shares ?? 0), 0);
      const avgEngagementPerPost = rawPosts.length > 0 ? (totalLikes + totalComments + totalShares) / rawPosts.length : 0;
      
      const posts = rawPosts.slice(0, limit).map((post: any) => ({
        external_id: String(post.postId ?? post.id ?? post.url ?? Math.random().toString()),
        posted_at: safeDate(post.time ?? post.timestamp ?? post.date ?? post.created_time),
        url: post.url ?? post.postUrl ?? post.link ?? null,
        thumbnail_url: post.media?.[0]?.src ?? post.media?.[0]?.url ?? post.picture ?? null,
        caption: post.text ?? post.message ?? post.story ?? post.postText ?? "",
        media_type: post.isVideo ? "video" : (post.media ? "image" : "text"),
        likes: num(post.likes ?? post.reactionLikeCount ?? 0),
        comments: num(post.comments ?? 0),
        shares: num(post.shares ?? 0),
        views: num(post.views ?? post.videoViewCount ?? post.viewsCount ?? 0),
        raw: post,
      }));
      
      // Use page-level followers if available, otherwise estimate from engagement
      const followers = pageFollowers > 0
        ? pageFollowers
        : (rawPosts.length > 0 ? Math.ceil(avgEngagementPerPost * 5) : 0);

      return {
        followers,
        following: num(pageItem.followings ?? pageItem.followingCount ?? pageItem.following ?? 0),
        total_posts: posts.length,
        avatar_url: pageItem.profilePictureUrl ?? pageItem.profilePicture ?? pageItem.profilePic ?? pageItem.avatar ?? undefined,
        display_name: pageItem.title ?? pageItem.name ?? pageNameFromPosts,
        posts,
        raw: { pageName: pageNameFromPosts, totalEngagement: totalLikes + totalComments + totalShares, pageFollowers, pageEnrich },
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
        profileUrls: [p.profile_url],
        resultsLimit: limit,
        usernames: [p.handle],
        maxItems: limit,
        // legacy/alternative fields
        handles: [p.handle],
        twitterHandles: [p.handle],
        startUrls: [{ url: p.profile_url }],
        urls: [p.profile_url],
        searchTerms: [`from:${p.handle}`],
        tweetsDesired: limit,
        maxTweets: limit,
        addUserInfo: true,
        includeUserInfo: true,
      }, token);
      // Debug: log item structure
      try {
        if (items && items.length > 0) {
          console.log(`[twitter] returned ${items.length} items; sample keys:`, Object.keys(items[0]).slice(0, 25));
        }
      } catch (e) {
        // ignore
      }
      // Filter out demo/empty items returned by broken actors
      const validItems = items.filter((t: any) => !t.demo && Object.keys(t).length > 2);
      if (validItems.length === 0) {
        console.warn('[twitter] All items appear to be demo/empty data');
        return { followers: 0, posts: [], raw: items[0] ?? {} };
      }
      // Find user profile info from items
      const userItem = validItems.find((t: any) =>
        t.user?.followers_count != null || t.author?.followersCount != null ||
        t.author?.followers != null || t.followersCount != null || t.followers_count != null || t.followers != null
      ) ?? validItems[0] ?? {};
      const user = userItem.user ?? userItem.author ?? userItem;
      // Extract tweets — all valid items with text content
      const tweetItems = validItems.filter((t: any) =>
        t.full_text || t.text || t.fullText || t.tweetText || t.tweet || t.postText
      );
      const posts = tweetItems.slice(0, limit).map((t: any) => {
        const tweetId = t.id_str ?? t.id ?? t.tweetId ?? t.tweet_id ?? t.postId;
        return {
          external_id: String(tweetId ?? Math.random().toString()),
          posted_at: safeDate(t.created_at ?? t.createdAt ?? t.timestamp ?? t.date),
          url: t.postUrl ?? t.url ?? t.twitterUrl ?? t.tweet_url ?? (tweetId ? `https://twitter.com/${p.handle}/status/${tweetId}` : null),
          thumbnail_url: t.media?.[0]?.mediaUrlHttps ?? t.media?.[0]?.media_url_https ?? t.media?.[0]?.url ?? t.entities?.media?.[0]?.media_url_https ?? null,
          caption: t.postText ?? t.full_text ?? t.text ?? t.fullText ?? t.tweetText ?? t.tweet ?? "",
          media_type: t.media?.[0]?.type ?? (t.entities?.media ? "photo" : "text"),
          likes: num(t.favorite_count ?? t.favouriteCount ?? t.likeCount ?? t.like_count ?? t.favoriteCount ?? t.likes),
          comments: num(t.reply_count ?? t.replyCount ?? t.replies),
          shares: num(t.repostCount ?? t.retweet_count ?? t.retweetCount ?? t.retweets),
          views: num(t.views?.count ?? t.viewCount ?? t.views ?? t.impressions),
          raw: t,
        };
      });
      return {
        followers: num(user.followers_count ?? user.followersCount ?? user.followers ?? user.public_metrics?.followers_count),
        following: num(user.friends_count ?? user.followingCount ?? user.following ?? user.public_metrics?.following_count),
        total_posts: num(user.statuses_count ?? user.statusesCount ?? user.tweetsCount ?? user.tweet_count ?? tweetItems.length),
        avatar_url: user.profile_image_url_https ?? user.profileImageUrl ?? user.profilePicture ?? user.avatar ?? undefined,
        display_name: user.name ?? user.displayName ?? undefined,
        posts,
        raw: user,
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

      // 1. Check if we need to run the profile scraper
      const latestSnap = await ProfileSnapshotModel.findOne({ 
        profile_id: p.id,
        followers: { $gt: 0 }
      }).sort({ captured_at: -1 }).lean();

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const needsProfileRefresh = !latestSnap || new Date(latestSnap.captured_at) < oneWeekAgo;
      
      let profileFollowers = num(
        company.followerCount ?? company.followersCount ?? company.followers ??
        author.followers ?? author.followerCount ?? author.followersCount ?? author.stats?.followers ?? author.stats?.followersCount ??
        first.followerCount ?? first.followers
      );

      if (needsProfileRefresh && profileFollowers === 0) {
        try {
          console.log(`[linkedin] Profile refresh needed for ${p.handle}. Running profile scraper...`);
          const profileActors = [
            'vulnv/linkedin-profile-scraper',
            'dev_fusion/Linkedin-Profile-Scraper',
            'apify/linkedin-profile-scraper'
          ];
          const profItems = await runActor(profileActors, {
            urls: [p.profile_url],
            linkedinUrl: p.profile_url,
            linkedinPublicUrl: p.profile_url,
            publicIdentifier: p.handle,
          }, token, 60_000);
          const profileEnrich = Array.isArray(profItems) ? profItems[0] : profItems;
          if (profileEnrich) {
            const count = num(profileEnrich.followers ?? profileEnrich.connections ?? profileEnrich.connectionsCount ?? profileEnrich.followersCount);
            if (count > 0) {
              profileFollowers = count;
              console.log(`[linkedin] Profile scraper successfully returned followers: ${profileFollowers}`);
            }
          }
        } catch (e) {
          console.warn('[linkedin] Profile enrichment failed, using cached followers:', (e as Error).message || e);
        }
      }

      // If we didn't scrape or the scrape failed, reuse the cached followers
      const followers = profileFollowers > 0 
        ? profileFollowers 
        : (latestSnap?.followers ?? 0);

      const display_name = company.name ?? company.title ?? author.name ?? first.name ?? p.handle;
      const avatar_url = company.logo ?? company.logoUrl ?? company.avatarUrl ?? author.avatar ?? null;

      const posts = rawPosts.slice(0, limit).map((t: any) => {
        // Handle LinkedIn's urn field which can be an object {activity_urn, share_urn, ugcPost_urn}
        let extId: string;
        if (typeof t.urn === 'object' && t.urn !== null) {
          extId = t.urn.activity_urn ?? t.urn.share_urn ?? t.full_urn ?? Math.random().toString();
        } else {
          extId = String(t.id ?? t.urn ?? t.postUrl ?? t.urnId ?? Math.random().toString());
        }
        // Handle LinkedIn's posted_at which can be an object {date, relative, timestamp}
        const rawPostedAt = t.posted_at ?? t.postedAt;
        let postedAtVal: any = rawPostedAt;
        if (rawPostedAt && typeof rawPostedAt === 'object' && !(rawPostedAt instanceof Date)) {
          postedAtVal = rawPostedAt.timestamp ?? rawPostedAt.date ?? rawPostedAt.relative;
        }
        return {
          external_id: extId,
          posted_at: safeDate(postedAtVal ?? t.createdAt ?? t.publishedAt ?? t.postedAtISO),
          url: t.postUrl ?? t.url ?? t.permalink ?? null,
          thumbnail_url: t.image ?? t.thumbnail ?? (
            (t.media && typeof t.media === 'object' && !Array.isArray(t.media) && (t.media.url || (Array.isArray(t.media.images) && t.media.images[0]?.url))) ??
            (Array.isArray(t.media) && (t.media[0]?.url || t.media[0]?.image))
          ) ?? null,
          caption: t.text ?? t.commentary ?? t.description ?? t.body ?? "",
          media_type: t.media?.type ?? t.post_type ?? (t.image ? "image" : (t.video ? "video" : "text")),
          likes: num(
            t.stats?.total_reactions ?? t.stats?.like ?? t.stats?.likes ?? t.stats?.numLikes ?? t.stats?.likeCount ?? t.numLikes ?? t.likes ?? t.reactions ?? t.reactionCount
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
        };
      });

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

  // Calculate total views for snapshot (fallback to database sum if scraper doesn't provide it)
  let totalViews = data.total_views;
  if (totalViews === undefined || totalViews === null) {
    const result = await PostModel.aggregate([
      { $match: { profile_id: p.id } },
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);
    totalViews = result[0]?.totalViews ?? 0;
  }

  // Insert snapshot
  await ProfileSnapshotModel.create({
    profile_id: p.id,
    workspace_id: p.workspace_id,
    followers: data.followers,
    following: data.following ?? null,
    total_posts: data.total_posts ?? null,
    total_views: totalViews ?? null,
    raw: data.raw,
    captured_at: new Date(),
  });

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
        (p.platform === 'youtube' && handle.includes('@') && handle.indexOf('@') > 0) ||
        !profileUrl.startsWith('http');
        
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
        // Check if there are any existing snapshots for this profile to detect first-time sync
        const snapshotCount = await ProfileSnapshotModel.countDocuments({ profile_id: p.id });
        const isFirstSync = snapshotCount === 0;
        
        // If first sync, fetch up to 100 posts (or the custom workspace limit if higher) to build history
        const profileLimit = isFirstSync 
          ? Math.max(limit, 100)
          : limit;

        if (isFirstSync) {
          console.log(`[runScraperSync] First-time sync detected for profile ${p.id} (${p.platform}). Boosting limit to ${profileLimit} posts.`);
        }

        const r = await refreshOne(p, activeToken, profileLimit);
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
