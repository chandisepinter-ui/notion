import { Badge } from "@/components/ui/Badge";

const MAP: Record<string, { label: string; tone: "accent" | "warning" | "danger" | "success" | "neutral" }> = {
  SOURCE_GROUNDED_PENDING_APPROVAL: { label: "Source-grounded · pending approval", tone: "accent" },
  PARTIAL_SOURCE: { label: "Partial source", tone: "warning" },
  NEEDS_SOURCE: { label: "Needs source", tone: "danger" },
  APPROVED: { label: "Approved", tone: "success" },
};

/** Shows how well a module's content is backed by approved Titan sources. */
export function ContentStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const m = MAP[status] ?? { label: status.replace(/_/g, " ").toLowerCase(), tone: "neutral" as const };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
