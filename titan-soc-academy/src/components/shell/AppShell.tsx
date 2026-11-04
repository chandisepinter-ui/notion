import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut, ShieldAlert, Users } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { isDemoAuth } from "@/lib/auth/config";
import { TitanWordmark } from "@/components/ui/TitanMark";
import { NAV, type NavSection } from "./nav";
import { NavLinks } from "./NavLinks";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";

function sectionsFor(user: SessionUser): NavSection[] {
  return NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.permission || user.permissions.has(i.permission)) })).filter(
    (s) => s.items.length > 0,
  );
}

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const sections = sectionsFor(user);
  const demo = isDemoAuth();
  const initials = user.displayName.split(" ").map((p) => p[0]).join("").slice(0, 2);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      <a href="#main" className="sr-only-focusable fixed left-4 top-4 z-[60] rounded-lg bg-accent px-4 py-2 text-accent-fg">
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto border-r border-line bg-bg-elevated/80 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/" className="px-2" aria-label="Titan SOC Academy home">
          <TitanWordmark />
        </Link>
        <NavLinks sections={sections} />
        <div className="mt-auto px-2 text-[0.6875rem] leading-relaxed text-fg-subtle">Phase 1 foundation build</div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {demo && (
          <div role="note" className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-1.5 text-center text-xs text-fg">
            <ShieldAlert aria-hidden className="size-3.5 text-warning" />
            <span>
              <strong className="font-semibold">Demonstration mode.</strong> Not secure. Fictional accounts and data only.
            </span>
          </div>
        )}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-bg/75 px-4 backdrop-blur-xl sm:px-6">
          <MobileNav sections={sections} />
          <div className="lg:hidden">
            <Link href="/" aria-label="Titan SOC Academy home"><TitanWordmark /></Link>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block"><ThemeToggle initial={user.prefs.theme} compact /></div>
            {demo && (
              <Link href="/login" className="hidden h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg md:flex">
                <Users aria-hidden className="size-4" /> Switch demo account
              </Link>
            )}
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/70 py-1 pl-1 pr-3">
              <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-strong">{initials}</span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-medium text-fg">{user.displayName}</span>
                <span className="block text-[0.6875rem] text-fg-subtle">{user.primaryRole.name}</span>
              </span>
            </div>
            <form action={signOut}>
              <button type="submit" className="grid size-9 place-items-center rounded-xl text-fg-subtle hover:bg-surface-2 hover:text-fg" title="Sign out">
                <LogOut aria-hidden className="size-[18px]" />
                <span className="sr-only">Sign out</span>
              </button>
            </form>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-8 outline-none sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
