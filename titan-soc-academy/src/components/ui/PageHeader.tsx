import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="titan-eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-fg sm:text-[2rem]">{title}</h1>
        {description && <p className="mt-2 text-[0.9375rem] leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
