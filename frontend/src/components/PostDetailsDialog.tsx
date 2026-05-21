import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Heart, MessageCircle, Share2, Eye, Calendar, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { format } from "date-fns";
import { platformMeta, formatNumber, formatPercent } from "@/lib/social";
import { Thumbnail } from "@/components/Thumbnail";
import { HeartBurst } from "@/components/HeartBurst";

export type DetailPost = {
  id: string; profile_id: string; posted_at: string | null; url: string | null;
  thumbnail_url?: string | null; caption: string | null; media_type?: string | null;
  likes: number; comments: number; shares: number; views: number;
};
export type DetailProfile = { id: string; platform: string; handle: string; profile_url: string };

export function PostDetailsDialog({
  post, profile, open, onOpenChange,
}: {
  post: DetailPost | null;
  profile: DetailProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!post) return null;
  const meta = profile ? platformMeta[profile.platform] : null;
  const Icon = meta?.icon;
  const engagement = post.likes + post.comments + post.shares;
  const er = post.views > 0 ? engagement / post.views : null;

  const [burstKey, setBurstKey] = useState(0);
  useEffect(() => {
    if (open) setBurstKey((k) => k + 1);
  }, [open, post?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <HeartBurst playKey={burstKey} />
        <div className="grid md:grid-cols-[280px_1fr]">
          {/* Media / left */}
          <div className="bg-muted relative aspect-square md:aspect-auto md:min-h-full">
            <Thumbnail src={post.thumbnail_url} fallbackIcon={Icon} iconClassName="size-16 opacity-50" />
            {meta && Icon && (
              <div className="absolute top-3 left-3 size-9 rounded-md flex items-center justify-center text-white shadow-md"
                style={{ background: `hsl(var(--${meta.color}))` }}>
                <Icon className="size-4" />
              </div>
            )}
          </div>

          {/* Details / right */}
          <div className="p-6 space-y-5">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                {meta && <Badge variant="secondary">{meta.label}</Badge>}
                {post.media_type && <Badge variant="outline" className="capitalize">{post.media_type}</Badge>}
                {post.posted_at && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3" /> {format(new Date(post.posted_at), "PPP 'at' p")}
                  </span>
                )}
              </div>
              <DialogTitle className="text-lg leading-snug">
                {profile ? (
                  <a href={profile.profile_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:underline">
                    @{profile.handle}<ExternalLink className="size-3.5 text-muted-foreground" />
                  </a>
                ) : "Post details"}
              </DialogTitle>
              <DialogDescription className="sr-only">Full post metrics and caption</DialogDescription>
            </DialogHeader>

            {/* Caption */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Caption</div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-1">
                {post.caption?.trim() || <span className="text-muted-foreground italic">No caption</span>}
              </p>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric icon={Eye} label="Views" value={formatNumber(post.views)} />
              <Metric icon={Heart} label="Likes" value={formatNumber(post.likes)} iconClassName="text-like fill-like" />
              <Metric icon={MessageCircle} label="Comments" value={formatNumber(post.comments)} />
              <Metric icon={Share2} label="Shares" value={formatNumber(post.shares)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Metric icon={TrendingUp} label="Engagement" value={formatNumber(engagement)} />
              <Metric icon={TrendingUp} label="Eng. rate" value={er != null ? formatPercent(er) : "—"} />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">

              {post.url && (
                <Button variant="outline" asChild>
                  <a href={post.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4 mr-2" /> Open original
                  </a>
                </Button>
              )}
              {profile && (
                <Button variant="ghost" asChild>
                  <a href={profile.profile_url} target="_blank" rel="noreferrer">
                    View profile
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ icon: Icon, label, value, iconClassName }: { icon: any; label: string; value: string; iconClassName?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`size-3 ${iconClassName ?? ""}`} /> {label}
      </div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
