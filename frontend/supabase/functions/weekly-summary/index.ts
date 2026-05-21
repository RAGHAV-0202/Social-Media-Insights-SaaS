import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { stats } = await req.json();
    if (!stats || typeof stats !== "object") {
      return new Response(JSON.stringify({ error: "Missing stats payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a social media analyst for Explore St. Kitts & Nevis (a destination marketing brand).
Write a concise weekly performance brief (max 120 words) based on the metrics provided.
Voice: confident, data-grounded, useful. Avoid filler and platitudes.
Structure as 3-4 short bullet points using markdown "-" syntax. Each bullet starts with a bold lead-in.
End with one concrete recommendation bullet starting with "**Try next:**".
Do not include a heading or preamble. Output only the bullet list.`;

    const userPrompt = `Date range: ${stats.from} → ${stats.to} (${stats.days} days, vs previous ${stats.days} days)

Overall:
- Reach (views): ${stats.totalViews} (${stats.viewsDeltaPct ?? "n/a"} vs prev)
- Engagement: ${stats.totalEngagement} (${stats.engDeltaPct ?? "n/a"} vs prev)
- Posts published: ${stats.totalPosts} (${stats.postsDeltaPct ?? "n/a"} vs prev)
- Followers (end of range): ${stats.totalFollowers} (${stats.followersDeltaPct ?? "n/a"})

Per platform (posts | engagement | reach):
${stats.perPlatform.map((p: any) => `- ${p.label}: ${p.posts} posts | ${p.eng} eng | ${p.views} reach`).join("\n")}

Top post: "${stats.topPostCaption ?? "—"}" on ${stats.topPostPlatform ?? "—"} (${stats.topPostEng ?? 0} interactions)
Best content type by avg engagement: ${stats.bestType ?? "n/a"}
Best posting slot: ${stats.bestSlot ?? "n/a"}
Top hashtag: ${stats.topHashtag ?? "n/a"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Top up in Workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("Gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const summary = data?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-summary error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
