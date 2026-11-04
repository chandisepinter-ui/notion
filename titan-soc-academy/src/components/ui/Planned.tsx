import { Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { cn } from "@/lib/cn";

/**
 * The single, consistent way to show a feature that is not built yet.
 * Never render a fake button: use this instead.
 */
export function PlannedBadge({ phase }: { phase?: number }) {
  return (
    <Badge tone="planned">
      <Clock3 aria-hidden className="size-3" />
      {phase ? `Planned · Phase ${phase}` : "Not yet available"}
    </Badge>
  );
}

export function PlannedFeature({
  title,
  phase,
  children,
  className,
}: {
  title: string;
  phase?: number;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-line-strong bg-surface-2/50 p-5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-fg">{title}</p>
        <PlannedBadge phase={phase} />
      </div>
      {children && <div className="mt-2 text-sm leading-relaxed text-fg-muted">{children}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-xl bg-surface-3 text-fg-subtle">{icon}</div>}
      <p className="font-medium text-fg">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-fg-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
