import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Panel({
  children,
  className,
  edge,
  as: Tag = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  edge?: boolean;
  as?: "section" | "div" | "article" | "aside";
  "aria-labelledby"?: string;
  "aria-label"?: string;
}) {
  return (
    <Tag className={cn("titan-panel", className)} data-edge={edge ? "true" : undefined} {...rest}>
      {children}
    </Tag>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  id,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  id?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-6 pt-5", className)}>
      <div>
        {eyebrow && <p className="titan-eyebrow mb-1.5">{eyebrow}</p>}
        <h2 id={id} className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-fg">
          {title}
        </h2>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
