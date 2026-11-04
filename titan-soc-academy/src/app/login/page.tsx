import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { db, schema } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { isDemoAuth } from "@/lib/auth/config";
import { demoSignIn } from "@/lib/auth/actions";
import { TitanWordmark } from "@/components/ui/TitanMark";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Sign in" };

const ROLE_COPY: Record<string, string> = {
  OPERATOR: "Take training. See your next step, progress and history.",
  SUPERVISOR: "Review assigned trainees, their answers and competencies.",
  SENIOR_SUPERVISOR: "Oversee every trainee across all shifts.",
  ADMINISTRATOR: "Manage accounts, roles and curriculum.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const current = await getSessionUser();
  const { error } = await searchParams;
  const demo = isDemoAuth();

  const accounts = demo
    ? await db
        .select({ id: schema.users.id, name: schema.users.displayName, title: schema.users.title, shift: schema.users.shift, roleKey: schema.roles.key, roleName: schema.roles.name, rank: schema.roles.rank })
        .from(schema.users)
        .innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
        .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
        .where(eq(schema.users.isDemo, true))
        .orderBy(asc(schema.roles.rank), asc(schema.users.displayName))
    : [];
  // One card per person (highest role).
  const byUser = new Map<string, (typeof accounts)[number]>();
  for (const a of accounts) if (!byUser.has(a.id) || byUser.get(a.id)!.rank < a.rank) byUser.set(a.id, a);
  const cards = [...byUser.values()].sort((a, b) => a.rank - b.rank);

  if (!demo && current) redirect("/");

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-10 sm:px-8">
      <TitanWordmark />
      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="animate-rise">
          <p className="titan-eyebrow mb-3">Security Operations Training</p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-5xl">
            Learn the job by doing the job.
          </h1>
          <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed text-fg-muted">
            Guided instruction, realistic simulations and demonstrated competency — one clear next step at a time.
          </p>
          {demo && (
            <div role="note" className="mt-8 flex gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm text-fg">
              <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
              <div>
                <p className="font-semibold">Demonstration mode — not secure</p>
                <p className="mt-1 text-fg-muted">
                  Anyone can choose any account below. All accounts and data are fictional. Use only for local testing.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="animate-rise" style={{ animationDelay: "80ms" }}>
          {demo ? (
            <section aria-labelledby="choose-account">
              <h2 id="choose-account" className="mb-1 text-lg font-semibold text-fg">
                Choose a demonstration account
              </h2>
              <p className="mb-5 text-sm text-fg-muted">Each account shows a different part of the platform.</p>
              {error && (
                <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                  That account could not be found. Run <code className="font-mono">npm run setup</code> and try again.
                </p>
              )}
              {cards.length === 0 && (
                <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-fg">
                  No demonstration accounts exist yet. Run <code className="font-mono">npm run setup</code>.
                </p>
              )}
              <ul className="grid gap-3">
                {cards.map((a) => (
                  <li key={a.id}>
                    <form action={demoSignIn}>
                      <input type="hidden" name="userId" value={a.id} />
                      <button
                        type="submit"
                        className="titan-panel group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:border-accent-line"
                      >
                        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-3 font-semibold text-fg">
                          {a.name.split(" ").map((p) => p[0]).join("")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-fg">{a.name}</span>
                            <Badge tone={a.roleKey === "OPERATOR" ? "neutral" : "accent"}>{a.roleName}</Badge>
                            {current?.id === a.id && <Badge tone="success">Signed in</Badge>}
                          </span>
                          <span className="mt-1 block text-sm text-fg-muted">{ROLE_COPY[a.roleKey] ?? a.title}</span>
                        </span>
                        <ArrowRight aria-hidden className="size-5 shrink-0 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-accent" />
                        <span className="sr-only">Sign in as {a.name}</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="titan-panel p-6" aria-labelledby="prod-signin">
              <ShieldCheck aria-hidden className="size-6 text-accent" />
              <h2 id="prod-signin" className="mt-3 text-lg font-semibold text-fg">Company sign-in is not configured</h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                Demonstration sign-in is disabled on this server. Microsoft Entra ID (company account) sign-in is planned for a later phase and must be configured by an authorized administrator before deployment.
              </p>
            </section>
          )}
        </div>
      </div>
      <p className="mt-auto pt-12 text-xs text-fg-subtle">
        Titan SOC Academy · Phase 1 foundation · Training content in this build is fictional and not Titan policy.
      </p>
    </main>
  );
}
