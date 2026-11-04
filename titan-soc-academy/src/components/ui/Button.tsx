import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-[-0.005em] transition-[background,box-shadow,color,border-color,transform] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-10px_var(--accent)] hover:bg-accent-strong",
  secondary: "border border-line-strong bg-surface-2 text-fg hover:bg-surface-3 hover:border-accent-line",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
  xl: "h-14 px-8 text-[1.0625rem]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
