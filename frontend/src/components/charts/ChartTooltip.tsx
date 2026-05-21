import { format, isValid, parse } from "date-fns";
import { formatNumber, formatPercent, platformMeta } from "@/lib/social";

type Formatter = "number" | "percent";

type Props = {
  active?: boolean;
  payload?: any[];
  label?: any;
  /** Override how values are formatted. Defaults to "number". */
  valueFormat?: Formatter;
  /** Suffix appended to formatted values, e.g. "%" or " ch". */
  unit?: string;
  /** Override label text (otherwise uses payload label, parsing dates when possible). */
  titleOverride?: string;
  /** Optional sub-label shown under the title (e.g. platform handle). */
  subtitle?: string;
  /** Hide the date/title row. */
  hideTitle?: boolean;
  /** Sort entries by value descending. */
  sortDesc?: boolean;
};

const formatValue = (v: number | string | undefined, kind: Formatter, unit?: string) => {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  const s = kind === "percent" ? formatPercent(n) : formatNumber(n);
  return unit ? `${s}${unit}` : s;
};

const tryParseDate = (label: unknown): Date | null => {
  if (label instanceof Date) return label;
  if (typeof label !== "string") return null;
  // Common formats used in this app: "MMM d", "MMM d, yyyy", ISO
  const candidates = ["MMM d, yyyy", "MMM d", "yyyy-MM-dd"];
  for (const fmt of candidates) {
    const d = parse(label, fmt, new Date());
    if (isValid(d)) return d;
  }
  const iso = new Date(label);
  return isValid(iso) ? iso : null;
};

const prettyName = (name: string | undefined) => {
  if (!name) return "";
  const meta = platformMeta[name];
  if (meta) return meta.label;
  // Capitalize first letter, replace _ with space
  return name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

const swatchColor = (name: string | undefined, fallback?: string) => {
  if (name && platformMeta[name]) return `hsl(var(--${platformMeta[name].color}))`;
  return fallback ?? "hsl(var(--muted-foreground))";
};

export function ChartTooltip({
  active, payload, label, valueFormat = "number", unit, titleOverride, subtitle, hideTitle, sortDesc,
}: Props) {
  if (!active || !payload || payload.length === 0) return null;

  let title = titleOverride;
  if (!title) {
    const d = tryParseDate(label);
    title = d ? format(d, "EEE, MMM d, yyyy") : (label != null ? String(label) : "");
  }

  const items = sortDesc
    ? [...payload].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
    : payload;

  return (
    <div className="rounded-xl border border-border/70 bg-popover/95 backdrop-blur-md shadow-xl px-3.5 py-2.5 text-xs min-w-[180px] animate-in fade-in zoom-in-95 duration-150">
      {!hideTitle && (title || subtitle) && (
        <div className="mb-2 pb-2 border-b border-border/50">
          {title && <div className="font-semibold text-foreground tracking-tight">{title}</div>}
          {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
      )}
      <ul className="space-y-1.5">
        {items.map((entry, i) => {
          const name = entry.name as string | undefined;
          const color = swatchColor(name, entry.color as string | undefined);
          return (
            <li key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2.5 rounded-full ring-2 ring-background shadow-sm" style={{ background: color }} />
                {prettyName(name)}
              </span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatValue(entry.value as number | undefined, valueFormat, unit)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
