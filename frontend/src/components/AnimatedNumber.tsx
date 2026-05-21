import { createContext, useContext, useEffect, useRef, useState } from "react";

/**
 * Broadcasts a "data refresh" tick to every AnimatedNumber descendant.
 * When the value changes, every animated counter restarts its rollup from 0.
 */
const DataRefreshContext = createContext<number>(0);

export function DataRefreshProvider({
  nonce,
  children,
}: { nonce: number; children: React.ReactNode }) {
  return (
    <DataRefreshContext.Provider value={nonce}>{children}</DataRefreshContext.Provider>
  );
}

/**
 * Smoothly counts up to any numeric value embedded in a string.
 * Parses leading sign, digits, commas, decimals and preserves any
 * trailing suffix (e.g. "K", "M", "%", " interactions").
 * Falls back to rendering the raw string when it isn't numeric.
 *
 * Restarts the rollup whenever the surrounding DataRefreshProvider's
 * nonce changes, or whenever an explicit `replayKey` prop changes.
 */
export function AnimatedNumber({
  value,
  duration = 1200,
  replayKey,
}: { value: string; duration?: number; replayKey?: string | number }) {
  const refreshNonce = useContext(DataRefreshContext);
  const effectiveReplay = replayKey ?? refreshNonce;

  const match = value.match(/^(-?[\d,]*\.?\d+)(.*)$/);
  const targetNum = match ? parseFloat(match[1].replace(/,/g, "")) : NaN;
  const suffix = match ? match[2] : "";
  const decimals = match && match[1].includes(".") ? (match[1].split(".")[1]?.length ?? 0) : 0;

  const [display, setDisplay] = useState<string>(Number.isFinite(targetNum) ? "0" + suffix : value);
  const prevRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastReplayRef = useRef<string | number | undefined>(effectiveReplay);

  useEffect(() => {
    if (!Number.isFinite(targetNum)) { setDisplay(value); return; }
    if (effectiveReplay !== lastReplayRef.current) {
      prevRef.current = 0;
      lastReplayRef.current = effectiveReplay;
    }
    const start = performance.now();
    const from = prevRef.current;
    const to = targetNum;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * eased;
      const formatted = decimals > 0
        ? cur.toFixed(decimals)
        : Math.round(cur).toLocaleString("en-US");
      setDisplay(formatted + suffix);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetNum, suffix, decimals, duration, value, effectiveReplay]);

  return <span>{display}</span>;
}
