import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getLenis } from "@/hooks/use-lenis";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Smoothly scroll the window to a target Y position with custom easing.
 * Gives a slower, more elegant motion than the browser's default `behavior: "smooth"`.
 */
export function smoothScrollTo(targetY = 0, duration = 900) {
  if (typeof window === "undefined") return;

  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (prefersReducedMotion) {
    window.scrollTo(0, targetY);
    return;
  }

  const lenis = getLenis();
  if (lenis) {
    lenis.scrollTo(targetY, { duration: duration / 1000 });
    return;
  }

  const startY = window.scrollY || window.pageYOffset;
  const distance = targetY - startY;
  if (Math.abs(distance) < 2) return;

  const startTime = performance.now();
  // easeInOutCubic
  const ease = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  let rafId = 0;
  const step = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    window.scrollTo(0, startY + distance * ease(t));
    if (t < 1) rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);

  // Cancel on user interaction so we don't fight them
  const cancel = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("wheel", cancel);
    window.removeEventListener("touchstart", cancel);
    window.removeEventListener("keydown", cancel);
  };
  window.addEventListener("wheel", cancel, { passive: true, once: true });
  window.addEventListener("touchstart", cancel, { passive: true, once: true });
  window.addEventListener("keydown", cancel, { once: true });
}
