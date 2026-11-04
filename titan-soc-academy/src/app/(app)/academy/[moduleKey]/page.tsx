import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadLesson } from "@/lib/academy/service";
import { buildLessonView } from "@/lib/academy/view";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { getLessonModule } from "@/content/curriculum";

export async function generateMetadata({ params }: { params: Promise<{ moduleKey: string }> }): Promise<Metadata> {
  const { moduleKey } = await params;
  return { title: getLessonModule(moduleKey)?.title ?? "Module" };
}

export default async function ModulePage({ params }: { params: Promise<{ moduleKey: string }> }) {
  const { moduleKey } = await params;
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const loaded = await loadLesson(user.id, moduleKey);
  if (!loaded) notFound();
  const view = buildLessonView(loaded.content, loaded.state);
  return <LessonPlayer initial={view} />;
}
