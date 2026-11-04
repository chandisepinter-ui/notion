import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { loadLesson } from "@/lib/academy/service";
import { buildLessonView } from "@/lib/academy/view";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";
import { CoursePlayer } from "@/components/course/CoursePlayer";
import { courseViewFor, loadCourse } from "@/lib/course/service";
import { getLessonModule } from "@/content/curriculum";
import { getCourseModule } from "@/content/titan-catalog";

export async function generateMetadata({ params }: { params: Promise<{ moduleKey: string }> }): Promise<Metadata> {
  const { moduleKey } = await params;
  return { title: getCourseModule(moduleKey)?.title ?? getLessonModule(moduleKey)?.title ?? "Module" };
}

export default async function ModulePage({ params }: { params: Promise<{ moduleKey: string }> }) {
  const { moduleKey } = await params;
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);

  if (getCourseModule(moduleKey)) {
    const loaded = await loadCourse(user.id, moduleKey, user.permissions.has(PERMISSIONS.ACADEMY_PREVIEW_ALL));
    if (!loaded) notFound();
    if (loaded.locked) {
      return (
        <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-surface-3 text-fg-subtle"><Lock aria-hidden className="size-6" /></div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">This module is locked</h1>
          <p className="mt-2 text-fg-muted">Modules open in order. Complete the earlier modules first — your dashboard always shows the next one.</p>
          <Link href="/dashboard" className="mt-6 inline-flex h-11 items-center rounded-xl bg-accent px-5 font-medium text-accent-fg">Go to my next step</Link>
        </div>
      );
    }
    return <CoursePlayer initial={await courseViewFor(loaded.content, loaded.state)} />;
  }

  const loaded = await loadLesson(user.id, moduleKey);
  if (!loaded) notFound();
  return <LessonPlayer initial={buildLessonView(loaded.content, loaded.state)} />;
}
