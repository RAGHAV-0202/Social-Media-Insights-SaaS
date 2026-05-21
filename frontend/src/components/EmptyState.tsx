import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Inbox, Plug, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "no-data" | "no-results" | "no-connections" | "error";

const presets: Record<Variant, { icon: ComponentType<{ className?: string }>; defaultTitle: string; tone: string }> = {
  "no-data": { icon: Inbox, defaultTitle: "No data yet", tone: "text-muted-foreground" },
  "no-results": { icon: Search, defaultTitle: "No results", tone: "text-muted-foreground" },
  "no-connections": { icon: Plug, defaultTitle: "No social profiles connected", tone: "text-primary" },
  "error": { icon: AlertTriangle, defaultTitle: "Something went wrong", tone: "text-destructive" },
};

type Action = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  loading?: boolean;
  icon?: ComponentType<{ className?: string }>;
};

export type EmptyStateProps = {
  variant?: Variant;
  title?: string;
  description?: ReactNode;
  primaryAction?: Action;
  secondaryAction?: Action;
  /** Use a compact inline layout (e.g. inside a chart card). */
  compact?: boolean;
  /** Wrap in a Card. Defaults to true. */
  asCard?: boolean;
  className?: string;
};

export function EmptyState({
  variant = "no-data",
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
  asCard = true,
  className,
}: EmptyStateProps) {
  const preset = presets[variant];
  const Icon = preset.icon;

  const content = (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-6 px-4" : "gap-3 py-12 px-6",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-full flex items-center justify-center",
          compact ? "size-10" : "size-12",
          variant === "error" ? "bg-destructive/10" : "bg-muted",
        )}
      >
        <Icon className={cn(compact ? "size-5" : "size-6", preset.tone)} />
      </div>
      <div className="space-y-1 max-w-md">
        <h3 className={cn("font-semibold", compact ? "text-sm" : "text-base")}>
          {title ?? preset.defaultTitle}
        </h3>
        {description && (
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            {description}
          </p>
        )}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap gap-2 justify-center pt-1">
          {primaryAction && <ActionButton {...primaryAction} />}
          {secondaryAction && <ActionButton variant="outline" {...secondaryAction} />}
        </div>
      )}
    </div>
  );

  if (!asCard) return content;
  return <Card className="shadow-[var(--shadow-card)]">{content}</Card>;
}

function ActionButton({ label, onClick, href, variant = "default", loading, icon: Icon }: Action) {
  if (href) {
    return (
      <Button asChild variant={variant} size="sm">
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {Icon && <Icon className="size-4 mr-1.5" />}
          {label}
        </a>
      </Button>
    );
  }
  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={loading}>
      {Icon && <Icon className={cn("size-4 mr-1.5", loading && "animate-spin")} />}
      {label}
    </Button>
  );
}
