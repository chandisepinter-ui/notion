import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getTitanCatalog } from "@/content/titan-catalog";
import { BUILTIN_IMMIX_CONFIG, BUILTIN_SCENARIOS } from "@/content/sim/builtin-scenarios";
import { playability } from "./engine";
import type { ImmixConfig, SimScenario } from "./types";

/** Every scenario available on this computer: built-in fictional practice + imported Titan scenarios. */
export function listScenarios(): { scenario: SimScenario; config: ImmixConfig; playable: boolean; missing: string[] }[] {
  const cat = getTitanCatalog();
  const titanCfg: ImmixConfig = { ...(cat?.immix ?? { outcomes: [], defaultTalkdown: null }), ...liveOutcomeMap() };
  const titan = (cat?.scenarios ?? []).map((s) => ({ scenario: s, config: withAccepted(titanCfg, s) }));
  const builtin = BUILTIN_SCENARIOS.map((s) => ({ scenario: s, config: BUILTIN_IMMIX_CONFIG }));
  return [...builtin, ...titan].map((x) => ({ ...x, ...playability(x.scenario) }));
}

/** Live IMMIX Close Event lists (local, from the reference screenshots), if installed. */
function liveOutcomeMap(): Partial<ImmixConfig> {
  const f = path.join(process.cwd(), "content-import", "reference", "immix", "outcomes.json");
  if (process.env.TITAN_CONTENT === "off" || !existsSync(f)) return {};
  const d = JSON.parse(readFileSync(f, "utf8")) as { outcomes: string[]; subOutcomes: Record<string, string[]>; aliases?: Record<string, string[]> };
  return { outcomes: d.outcomes, subOutcomes: d.subOutcomes, aliases: d.aliases ?? {}, routingGroups: ["Titan Routing Group"] };
}

/** Guarantees every outcome the scenario accepts is selectable (does not reveal which one). */
function withAccepted(cfg: ImmixConfig, s: SimScenario): ImmixConfig {
  // With the live two-level lists, accepted labels are reached through level 2 or aliases.
  if (cfg.subOutcomes) return cfg;
  const extra = s.alerts.flatMap((a) => a.truth?.acceptedOutcomes ?? []);
  return { ...cfg, outcomes: [...new Set([...cfg.outcomes, ...extra])].sort((a, b) => a.localeCompare(b)) };
}

export function getScenario(id: string) {
  return listScenarios().find((x) => x.scenario.id === id);
}
