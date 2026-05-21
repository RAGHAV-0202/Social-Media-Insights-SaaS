import { Facebook, Instagram, Music2, Youtube, Twitter, Linkedin } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const PLATFORMS = [
  { id: "facebook",  label: "Facebook",  color: "facebook",  icon: Facebook },
  { id: "instagram", label: "Instagram", color: "instagram", icon: Instagram },
  { id: "tiktok",    label: "TikTok",    color: "tiktok",    icon: Music2 },
  { id: "youtube",   label: "YouTube",   color: "youtube",   icon: Youtube },
  { id: "twitter",   label: "X",         color: "twitter",   icon: Twitter },
  { id: "linkedin",  label: "LinkedIn",  color: "linkedin",  icon: Linkedin },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]["id"];

export const platformMeta: Record<string, { label: string; color: string; icon: LucideIcon }> =
  Object.fromEntries(PLATFORMS.map((p) => [p.id, { label: p.label, color: p.color, icon: p.icon }]));

export const formatNumber = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
};

export const formatPercent = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : (n * 100).toFixed(digits) + "%";

// Proxy thumbnail URLs through wsrv.nl to bypass hotlink protection
// (Instagram/TikTok CDNs block direct embedding via Referer header & signed URL expiry).
export const proxyImage = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=600&output=webp&we`;
};
