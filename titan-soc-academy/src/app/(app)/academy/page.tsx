import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAcademyDays, getModulesWithProgress } from "@/lib/academy/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { AcademyRoadmap } from "@/components/academy/AcademyRoadmap";

export const metadata: Metadata = { title: "Initial Academy" };

export default async function AcademyPage() {
  const user = await requirePermission(PERMISSIONS.ACADEMY_ACCESS);
  const [days, mods] = await Promise.all([getAcademyDays(), getModulesWithProgress(user.id)]);
  return (
    <>
      <PageHeader
        eyebrow="Seven-day program"
        title="Initial Academy"
        description="Days 1–6 teach each system through guided instruction, demonstrations, practice and realistic simulation. Day 7 is a supervised validation shift. Finishing a lesson is not the same as mastery — every module ends with verification."
      />
      <AcademyRoadmap days={days} modules={mods} />
    </>
  );
}
