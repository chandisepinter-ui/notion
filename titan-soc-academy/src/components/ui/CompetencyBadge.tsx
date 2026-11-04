import { COMPETENCY_LEVELS, type CompetencyLevel } from "@/lib/academy/types";
import { Badge, type Tone } from "./Badge";

const toneFor: Record<CompetencyLevel, Tone> = {
  NOT_STARTED: "neutral",
  LEARNING: "neutral",
  ASSISTED: "accent",
  PRACTICING: "accent",
  MASTERY_DEMONSTRATED: "success",
  REMEDIATION: "danger",
};

export function CompetencyBadge({ level }: { level: string }) {
  const l = (level in COMPETENCY_LEVELS ? level : "NOT_STARTED") as CompetencyLevel;
  return (
    <Badge tone={toneFor[l]} dot>
      {COMPETENCY_LEVELS[l].label}
    </Badge>
  );
}

/** Five-segment meter for the competency ladder. */
export function CompetencyMeter({ level }: { level: string }) {
  const l = (level in COMPETENCY_LEVELS ? level : "NOT_STARTED") as CompetencyLevel;
  const order = COMPETENCY_LEVELS[l].order;
  return (
    <div className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={
            l === "REMEDIATION"
              ? "h-1.5 w-6 rounded-full bg-danger/70"
              : i <= order
                ? order === 4
                  ? "h-1.5 w-6 rounded-full bg-success"
                  : "h-1.5 w-6 rounded-full bg-accent"
                : "h-1.5 w-6 rounded-full bg-surface-3"
          }
        />
      ))}
    </div>
  );
}
