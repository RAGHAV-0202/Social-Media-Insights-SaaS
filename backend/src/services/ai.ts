import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

export async function generateWeeklySummary(stats: any, brandName: string = "your brand"): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured in backend .env");
  }

  const systemPrompt = `You are a social media analyst for ${brandName}.
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

  const models = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free"
  ];

  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[AI Summary] Attempting generation with model: ${model}`);
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "Social Media Insights",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          throw new Error("Rate limited");
        }
        if (resp.status === 402) {
          throw new Error("AI credits exhausted");
        }
        const t = await resp.text();
        throw new Error(`API error: ${resp.status} - ${t}`);
      }

      const data = await resp.json() as any;
      const summary = data?.choices?.[0]?.message?.content ?? "";
      
      if (summary) {
        console.log(`[AI Summary] Successfully generated with ${model}`);
        return summary; // Return immediately on success
      }
    } catch (err: any) {
      console.warn(`[AI Summary] Model ${model} failed:`, err.message);
      lastError = err;
      // Continue to the next model in the fallback array
    }
  }

  console.error("[AI Summary] All fallback models failed.");
  throw lastError || new Error("Failed to generate summary with all available models.");
}
