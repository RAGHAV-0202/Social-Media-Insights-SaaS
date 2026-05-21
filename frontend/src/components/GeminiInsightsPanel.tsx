import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "../context/AuthContext";

export type WeeklySummaryStats = {
  from: string;
  to: string;
  days: number;
  totalViews: number;
  totalEngagement: number;
  totalPosts: number;
  totalFollowers: number;
  viewsDeltaPct: string | null;
  engDeltaPct: string | null;
  postsDeltaPct: string | null;
  followersDeltaPct: string | null;
  perPlatform: { label: string; posts: number; eng: number; views: number }[];
  topPostCaption: string | null;
  topPostPlatform: string | null;
  topPostEng: number;
  bestType: string | null;
  bestSlot: string | null;
  topHashtag: string | null;
};

function renderMarkdown(md: string) {
  // Minimal renderer: bullets and **bold**
  const lines = md.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <ul className="space-y-2">
      {lines.map((raw, i) => {
        const line = raw.replace(/^[-*]\s*/, "");
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <li key={i} className="flex gap-2 text-sm leading-relaxed">
            <span className="text-primary mt-2 size-1.5 rounded-full bg-primary shrink-0" />
            <span>
              {parts.map((p, j) =>
                p.startsWith("**") && p.endsWith("**") ? (
                  <strong key={j} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
                ) : (
                  <span key={j}>{p}</span>
                ),
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function GeminiInsightsPanel({ stats }: { stats: WeeklySummaryStats }) {
  const { toast } = useToast();
  const { token, workspace } = useAuth();
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/weekly-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stats, brandName: workspace?.name }),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      
      const data = await res.json();
      setSummary(data?.summary ?? "");
    } catch (e: any) {
      const msg = e?.message ?? "Failed to generate summary";
      setError(msg);
      toast({ title: "AI summary failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className="relative overflow-hidden p-5 sm:p-6 border-border/60 shadow-[var(--shadow-elegant)]"
      style={{ background: "var(--gradient-card)" }}
    >
      <div
        className="absolute -top-16 -right-16 size-48 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--accent-glow) / 0.7), transparent 70%)" }}
      />
      <div className="absolute inset-x-0 top-0 h-1 opacity-90"
        style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))" }}
      />
      <div className="flex flex-wrap items-start justify-between gap-3 relative">
        <div className="flex items-center gap-3">
          <div
            className="size-10 rounded-xl flex items-center justify-center text-white shadow-md ring-1 ring-white/20"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}
          >
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80 font-semibold">AI insight</div>
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight font-serif-display">
              Performance brief
            </h3>
            <p className="text-xs text-muted-foreground">Auto-generated from the selected date range &amp; filters.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Beta</Badge>
          <Button
            size="sm"
            variant={summary ? "outline" : "default"}
            onClick={generate}
            disabled={loading}
          >
            {loading ? (
              <><RefreshCw className="size-3.5 mr-1.5 animate-spin" /> Generating…</>
            ) : summary ? (
              <><RefreshCw className="size-3.5 mr-1.5" /> Regenerate</>
            ) : (
              <><Sparkles className="size-3.5 mr-1.5" /> Generate brief</>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-5 relative min-h-[60px]">
        {error && !summary && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {!error && !summary && !loading && (
          <p className="text-sm text-muted-foreground">
            Click <strong className="text-foreground">Generate brief</strong> to get a concise AI summary of this period’s
            performance, with one concrete recommendation for the week ahead.
          </p>
        )}
        {loading && !summary && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3 rounded bg-muted animate-pulse" style={{ width: `${90 - i * 10}%` }} />
            ))}
          </div>
        )}
        {summary && renderMarkdown(summary)}
      </div>
    </Card>
  );
}
