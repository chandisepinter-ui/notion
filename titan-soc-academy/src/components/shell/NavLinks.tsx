"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, Gamepad2, Gavel, Gauge, History, Home, KeyRound, Layers, LayoutGrid, RefreshCw, Route, ScrollText, Settings, Shield, UserCog, Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavSection } from "./nav";

const ICONS: Record<string, LucideIcon> = {
  home: Home, route: Route, gauge: Gauge, history: History, refresh: RefreshCw, grid: LayoutGrid, gamepad: Gamepad2,
  book: BookOpen, users: Users, shield: Shield, "user-cog": UserCog, key: KeyRound, layers: Layers, scroll: ScrollText, settings: Settings, gavel: Gavel,
};

export function NavLinks({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="titan-eyebrow mb-2 px-3">{section.label}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Home;
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[0.9375rem] transition-colors",
                      active ? "bg-accent-soft font-medium text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
                    <Icon aria-hidden className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
