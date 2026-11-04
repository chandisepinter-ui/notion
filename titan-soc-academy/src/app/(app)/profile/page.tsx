import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { PreferencesForm } from "@/components/shell/PreferencesForm";

export const metadata: Metadata = { title: "Profile & Preferences" };

const SHIFT: Record<string, string> = { DAYS: "Days", SWINGS: "Swings", NIGHTS: "Nights" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Account" title="Profile & Preferences" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel>
          <PanelHeader title="Profile" eyebrow={user.isDemo ? "Demonstration account" : "Account"} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 p-6 text-sm">
            <dt className="text-fg-subtle">Name</dt><dd className="text-fg">{user.displayName}</dd>
            <dt className="text-fg-subtle">Email</dt><dd className="break-all text-fg">{user.email}</dd>
            <dt className="text-fg-subtle">Title</dt><dd className="text-fg">{user.title ?? "—"}</dd>
            <dt className="text-fg-subtle">Shift</dt><dd className="text-fg">{user.shift ? SHIFT[user.shift] ?? user.shift : "—"}</dd>
            <dt className="text-fg-subtle">Roles</dt><dd className="flex flex-wrap gap-1.5">{user.roles.map((r) => <Badge key={r.key} tone="accent">{r.name}</Badge>)}</dd>
          </dl>
          <p className="border-t border-line px-6 py-3 text-xs text-fg-subtle">Profile details are managed by an administrator.</p>
        </Panel>
        <Panel>
          <PanelHeader title="Display preferences" eyebrow="Saved to your profile" />
          <div className="p-6">
            <PreferencesForm theme={user.prefs.theme} textSize={user.prefs.textSize} motion={user.prefs.motion} />
          </div>
        </Panel>
      </div>
    </>
  );
}
