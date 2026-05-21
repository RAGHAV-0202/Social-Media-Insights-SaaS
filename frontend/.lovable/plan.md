# Social Media Management Dashboard

A public dashboard aggregating metrics from Facebook, Instagram, TikTok, YouTube, X (Twitter) and Pinterest profiles for **Explore St. Kitts and Nevis**, powered by **Apify** scrapers and refreshed every 6 hours.

## Profiles tracked
- Facebook — `61588102441483`
- Instagram — `explore.stkittsandnevis`
- TikTok — `@explorestkittsandnevis`
- YouTube — `@ExploreSt.KittsandNevis`
- X — `Explore_skn`
- Pinterest — `explorestkittsandnevis`

## What management will see

**Top bar**
- Date range picker (presets: 7d / 30d / 90d / custom) + platform filter
- "Last refreshed at … · Next refresh in …" indicator

**Overview row (KPI cards)**
- Total followers (all platforms) + Δ vs previous period
- Total engagement (likes + comments + shares)
- Total reach / views
- Average engagement rate

**Per-platform cards** (one per network)
- Followers + growth sparkline
- Posts in range, likes, comments, views
- Engagement rate
- Click → platform detail view

**Charts**
- Followers growth over time (multi-line, one per platform)
- Engagement over time (stacked bar: likes / comments / shares)
- Platform share of voice (donut: % of total engagement)
- Reach vs engagement scatter

**Top content table**
- Best performing posts across platforms in the range
- Thumbnail, platform icon, caption snippet, date, likes/comments/views, engagement rate, link to original

## How the data flows

```text
Apify actors  ──►  Edge Function (scheduled every 6h)
                            │
                            ▼
                     Postgres tables
                            │
                            ▼
                   React dashboard (public)
```

1. A scheduled Edge Function runs every 6 hours, calls one Apify actor per platform via your `APIFY_API_KEY`, waits for results, normalises them, and upserts into Postgres.
2. A `refresh_runs` table records each run (status, started/finished, rows ingested) so the UI can show "last refreshed".
3. The dashboard reads only from Postgres — fast, and works even if Apify is down.
4. A "Refresh now" button (rate-limited) triggers the same function on demand.

## Technical details

**Backend (Lovable Cloud)**
- Tables:
  - `profiles` (platform, handle, profile_url, display_name)
  - `profile_snapshots` (profile_id, captured_at, followers, following, total_posts, …) — time-series for growth charts
  - `posts` (profile_id, external_id, posted_at, url, thumbnail, caption, type, likes, comments, shares, views, engagement_rate)
  - `refresh_runs` (started_at, finished_at, status, error, counts)
- RLS: public `SELECT` on all four tables; writes only from edge functions (service role). No auth required for viewers.
- Edge functions:
  - `refresh-social` — orchestrates Apify calls per platform, normalises payloads, upserts. Triggered by cron (every 6h) and by the manual button.
  - Cron via `pg_cron` calling the function URL.
- Apify actors used (one per platform, all callable with the same API key via `https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items`):
  - `apify/facebook-pages-scraper`
  - `apify/instagram-profile-scraper` + `apify/instagram-post-scraper`
  - `clockworks/tiktok-profile-scraper`
  - `streamers/youtube-channel-scraper`
  - `apidojo/twitter-user-scraper`
  - `epctex/pinterest-scraper`
  - (Exact actor IDs confirmed at build time; all use the same `APIFY_API_KEY`.)
- Engagement rate = (likes + comments + shares) / followers at snapshot time, per post; aggregated as weighted average for cards.

**Frontend**
- Single route `/` rendering the dashboard (public).
- shadcn cards, Recharts for charts, shadcn date-range picker, TanStack Query for data.
- Bold editorial design with a Caribbean-inspired palette (deep teal + sand + coral accents) — committed via design tokens in `index.css` / `tailwind.config.ts`. No generic purple-on-white.

## Setup needed from you
1. Approve enabling **Lovable Cloud** (database + scheduled functions).
2. Provide your **Apify API token** when prompted (stored as `APIFY_API_KEY` secret).
3. First refresh runs immediately after setup so the dashboard isn't empty; subsequent refreshes happen on the 6-hour cron.

## Out of scope (can add later)
- Login / role-based access (you chose public link)
- Posting / scheduling content
- Sentiment analysis on comments
- Export to PDF/CSV
