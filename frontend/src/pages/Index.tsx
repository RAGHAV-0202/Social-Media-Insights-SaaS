import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Layers,
  CalendarClock,
  Wand2,
  Instagram,
  Linkedin,
  Twitter,
  Quote,
} from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { Button } from "@/components/ui/button";

export default function Index() {
  return (
    <div className="theme-saas-ivory min-h-screen bg-background bg-paper-grain">
      <Navbar />

      <main>
        {/* ───────────── Hero ───────────── */}
        <section className="px-6 pt-20 pb-14 sm:pt-28">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Live Brand Analytics Engine
              </div>
              <h1 className="mt-6 font-serif-display text-5xl leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-[5.5rem]">
                A quieter way to{" "}
                <em className="italic text-primary">track</em> social performance.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Insights is the editorial analytics engine for modern teams.
                Track views, engagements, and content calendars — planned,
                scraped, and visualized in a single beautiful dashboard.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button size="lg" asChild>
                  <Link to="/register">
                    Start tracking <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" asChild>
                  <Link to="/login">
                    Sign in to account <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
                <div className="flex -space-x-2">
                  {["#CC785C", "#3a3a3a", "#c9a84c", "#7d9b76"].map((c) => (
                    <span
                      key={c}
                      className="h-7 w-7 rounded-full border-2 border-background"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <span>Trusted by 2,400+ writers, editors, and founders.</span>
              </div>
            </div>

            {/* Hero card */}
            <div className="lg:col-span-5">
              <ComposerCard />
            </div>
          </div>
        </section>

        {/* ───────────── Logos ───────────── */}
        <section className="border-y border-border/60 px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 sm:flex-row sm:justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Supporting top accounts
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
              {["Instagram", "TikTok", "YouTube", "Facebook", "X"].map((n) => (
                <span
                  key={n}
                  className="font-serif-display text-xl italic text-muted-foreground/80"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ───────────── Bento ───────────── */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 flex items-end justify-between gap-8">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-primary">
                  The engine
                </p>
                <h2 className="font-serif-display text-4xl tracking-tight sm:text-5xl">
                  Every step of the pipeline,{" "}
                  <em className="italic">in one place.</em>
                </h2>
              </div>
              <p className="hidden max-w-xs text-sm text-muted-foreground md:block">
                Collect, review, and analyze from a single, considered surface —
                no manual scraping, no CSV copy-pasting.
              </p>
            </div>

            <div className="grid auto-rows-[160px] grid-cols-1 gap-4 md:grid-cols-6">
              {/* Large — AI generation */}
              <BentoTile className="md:col-span-4 md:row-span-2">
                <div className="flex h-full flex-col justify-between">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <div>
                    <h3 className="font-serif-display text-3xl tracking-tight">
                      Weekly AI-generated analysis.
                    </h3>
                    <p className="mt-3 max-w-md text-sm text-muted-foreground">
                      Trained on your post statistics, your historical performance,
                      and platform trends. Captions and summaries — drafted
                      in seconds, highlighting real insights.
                    </p>
                    <MiniDraftPreview />
                  </div>
                </div>
              </BentoTile>

              {/* Multi-platform */}
              <BentoTile className="md:col-span-2">
                <Layers className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-serif-display text-xl">
                  Multi-platform native
                </h3>
                <div className="mt-3 flex gap-2">
                  {[Instagram, Twitter].map((Icon, i) => (
                    <span
                      key={i}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/60"
                    >
                      <Icon className="h-3.5 w-3.5 text-foreground/70" />
                    </span>
                  ))}
                </div>
              </BentoTile>

              {/* Calendar */}
              <BentoTile className="md:col-span-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-serif-display text-xl">
                  Smart scheduling
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Know exactly when your audience is online and interacting.
                </p>
              </BentoTile>

              {/* Testimonial */}
              <BentoTile className="md:col-span-3 md:row-span-2 bg-primary/[0.06]">
                <Quote className="h-6 w-6 text-primary" />
                <blockquote className="mt-4 font-serif-display text-2xl leading-snug text-foreground">
                  "It feels like an analyst sitting next to me — not a chatbot. The
                  difference shows in every metric we track."
                </blockquote>
                <div className="mt-6 flex items-center gap-3">
                  <span
                    className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/40"
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-medium">Maya Okafor</p>
                    <p className="text-xs text-muted-foreground">
                      Head of Content, Nebula
                    </p>
                  </div>
                </div>
              </BentoTile>

              {/* Stat 1 */}
              <BentoTile className="md:col-span-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Growth rate
                </p>
                <p className="mt-2 font-serif-display text-5xl tracking-tight">
                  +24%<span className="text-primary">/mo</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Average per brand after adopting Insights.
                </p>
              </BentoTile>
            </div>
          </div>
        </section>

        {/* ───────────── Closing CTA ───────────── */}
        <section className="px-6 pb-28">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border bg-card px-10 py-20 text-center shadow-lg">
            <p className="text-xs uppercase tracking-[0.2em] text-primary">
              Ready when you are
            </p>
            <h2 className="mx-auto mt-4 max-w-2xl font-serif-display text-4xl tracking-tight sm:text-5xl">
              Track less. <em className="italic">Grow more.</em>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Start free. No credit card. Cancel any time.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/register">
                  Create your workspace <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function BentoTile({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/30 ${className}`}
    >
      {children}
    </div>
  );
}

function ComposerCard() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-primary/5 to-transparent blur-2xl animate-pulse"
      />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_-30px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span className="h-2 w-2 rounded-full bg-primary/80 animate-ping" />
            Insights · Active Workspace
          </div>
          <span className="font-serif-display text-xs italic text-muted-foreground">
            brand dashboard
          </span>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex gap-1.5">
            {[
              { Icon: Instagram, label: "Instagram", active: true },
              { Icon: Twitter, label: "Twitter" },
            ].map(({ Icon, label, active }) => (
              <span
                key={label}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${
                  active
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Weekly AI Summary
            </p>
            <p className="mt-2 font-serif-display text-base leading-snug text-foreground">
              Engagement is up 12.4% over last week. Videos/Reels are driving 80% of new profile visits. Best day to post remains Thursday at 4 PM.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["#analytics", "#growth", "#metrics"].map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-[11px] text-muted-foreground">Updated 10m ago · 2 profiles</p>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Refresh Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniDraftPreview() {
  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-2">
      {[
        { tag: "KPI Insights", body: "Reels outperform static posts by 3x on average." },
        { tag: "Action Plan", body: "1/ Schedule 2 reels for this weekend focusing on products..." },
      ].map((d) => (
        <div
          key={d.tag}
          className="rounded-lg border border-border bg-background/60 p-3"
        >
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
            {d.tag}
          </p>
          <p className="mt-1.5 font-serif-display text-sm leading-snug text-foreground">
            {d.body}
          </p>
        </div>
      ))}
    </div>
  );
}
