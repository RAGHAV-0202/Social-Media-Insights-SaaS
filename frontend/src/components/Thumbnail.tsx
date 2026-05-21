import { useState } from "react";
import { ImageIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { proxyImage } from "@/lib/social";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  fallbackIcon?: LucideIcon;
  iconClassName?: string;
  fallbackBg?: string;
  /** Stable seed used to derive a unique colorful placeholder when no image is available. */
  fallbackSeed?: string;
};

// Vibrant gradient palette — picked to look great over thumbnails.
const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)",
  "linear-gradient(135deg, #5f27cd 0%, #48dbfb 100%)",
  "linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)",
  "linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)",
  "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
  "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)",
  "linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pickGradient(seed?: string | null): string {
  if (!seed) return PLACEHOLDER_GRADIENTS[0];
  return PLACEHOLDER_GRADIENTS[hashString(seed) % PLACEHOLDER_GRADIENTS.length];
}

/**
 * Thumbnail with graceful fallback.
 * Tries the wsrv.nl proxy first, falls back to the raw URL (with no-referrer),
 * then renders a colorful gradient placeholder so we never show an empty box.
 */
export function Thumbnail({
  src,
  alt = "",
  className,
  imgClassName,
  fallbackIcon: Icon = ImageIcon,
  iconClassName = "size-8 text-white/85 drop-shadow",
  fallbackBg,
  fallbackSeed,
}: Props) {
  const [stage, setStage] = useState<"proxy" | "proxy-alt" | "direct" | "fail">(
    src ? "proxy" : "fail",
  );
  const [loaded, setLoaded] = useState(false);

  if (!src || stage === "fail") {
    const gradient = pickGradient(fallbackSeed ?? src ?? alt);
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center relative overflow-hidden",
          fallbackBg,
          className,
        )}
        style={fallbackBg ? undefined : { backgroundImage: gradient }}
        aria-label={alt || "No image available"}
      >
        {/* subtle sheen for depth */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 55%)",
          }}
        />
        <Icon className={cn("relative", iconClassName)} />
      </div>
    );
  }

  const url =
    stage === "proxy"
      ? proxyImage(src)
      : stage === "proxy-alt"
        ? `https://images.weserv.nl/?url=${encodeURIComponent(src.replace(/^https?:\/\//, ""))}&w=600&output=webp`
        : src;

  // For the raw direct fallback, drop crossOrigin so CDNs that reject CORS
  // preflight (Instagram/TikTok signed URLs) can still render via <img>.
  const useCors = stage !== "direct";

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      {/* Animated skeleton shimmer — shown until the image fires onLoad */}
      {!loaded && (
        <div
          aria-hidden
          className="absolute inset-0 bg-muted/60"
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
        </div>
      )}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        {...(useCors ? { crossOrigin: "anonymous" as const } : {})}
        className={cn(
          "w-full h-full object-cover object-top transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName,
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          setStage((s) =>
            s === "proxy" ? "proxy-alt" : s === "proxy-alt" ? "direct" : "fail",
          );
        }}
      />
    </div>
  );
}

