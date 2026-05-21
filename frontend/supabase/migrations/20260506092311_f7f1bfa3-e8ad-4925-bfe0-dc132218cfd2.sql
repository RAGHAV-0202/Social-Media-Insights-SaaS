
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT NOT NULL,
  external_id TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, handle)
);

CREATE TABLE public.profile_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  followers BIGINT,
  following BIGINT,
  total_posts BIGINT,
  total_likes BIGINT,
  total_views BIGINT,
  raw JSONB
);
CREATE INDEX idx_snapshots_profile_time ON public.profile_snapshots(profile_id, captured_at DESC);

CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  media_type TEXT,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  views BIGINT DEFAULT 0,
  engagement_rate NUMERIC,
  raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, external_id)
);
CREATE INDEX idx_posts_profile_time ON public.posts(profile_id, posted_at DESC);
CREATE INDEX idx_posts_posted_at ON public.posts(posted_at DESC);

CREATE TABLE public.refresh_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  triggered_by TEXT DEFAULT 'cron',
  profiles_updated INT DEFAULT 0,
  posts_upserted INT DEFAULT 0,
  errors JSONB
);
CREATE INDEX idx_runs_started ON public.refresh_runs(started_at DESC);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public read snapshots" ON public.profile_snapshots FOR SELECT USING (true);
CREATE POLICY "Public read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Public read runs" ON public.refresh_runs FOR SELECT USING (true);

-- Seed the 6 profiles
INSERT INTO public.profiles (platform, handle, display_name, profile_url, external_id) VALUES
  ('facebook',  'explore.stkittsandnevis',     'Explore St. Kitts and Nevis', 'https://www.facebook.com/profile.php?id=61588102441483', '61588102441483'),
  ('instagram', 'explore.stkittsandnevis',     'Explore St. Kitts and Nevis', 'https://www.instagram.com/explore.stkittsandnevis/', 'explore.stkittsandnevis'),
  ('tiktok',    'explorestkittsandnevis',      'Explore St. Kitts and Nevis', 'https://www.tiktok.com/@explorestkittsandnevis', 'explorestkittsandnevis'),
  ('youtube',   'ExploreSt.KittsandNevis',     'Explore St. Kitts and Nevis', 'https://www.youtube.com/@ExploreSt.KittsandNevis/', 'ExploreSt.KittsandNevis'),
  ('twitter',   'Explore_skn',                  'Explore St. Kitts and Nevis', 'https://x.com/Explore_skn', 'Explore_skn'),
  ('pinterest', 'explorestkittsandnevis',       'Explore St. Kitts and Nevis', 'https://in.pinterest.com/explorestkittsandnevis/', 'explorestkittsandnevis');
