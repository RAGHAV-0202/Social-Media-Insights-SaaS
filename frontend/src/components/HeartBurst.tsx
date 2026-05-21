import { Heart } from "lucide-react";
import { useMemo } from "react";

/**
 * Bursts a few hearts that fly upward + outward.
 * Mount with a unique `playKey` to re-trigger the animation.
 */
export function HeartBurst({ playKey, count = 9 }: { playKey: string | number; count?: number }) {
  const hearts = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const spread = 220;
      const tx = (Math.random() - 0.5) * spread;
      const ty = -140 - Math.random() * 120;
      const r = (Math.random() - 0.5) * 60;
      const size = 18 + Math.random() * 22;
      const delay = Math.random() * 0.25;
      return { tx, ty, r, size, delay, id: i };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, count]);

  return (
    <div
      key={playKey}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible z-50"
    >
      {hearts.map((h) => (
        <Heart
          key={h.id}
          className="absolute left-1/2 top-1/2 text-like fill-like animate-heart-burst drop-shadow-[0_4px_10px_hsl(var(--like)/0.45)]"
          style={
            {
              width: h.size,
              height: h.size,
              opacity: 0,
              animationDelay: `${h.delay}s`,
              ["--tx" as any]: `${h.tx}px`,
              ["--ty" as any]: `${h.ty}px`,
              ["--r" as any]: `${h.r}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
