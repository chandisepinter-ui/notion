import "server-only";
import { getTitanCatalog } from "@/content/titan-catalog";
import { BUILTIN_IMMIX_CONFIG, BUILTIN_SCENARIOS } from "@/content/sim/builtin-scenarios";
import { playability } from "./engine";
import type { ImmixConfig, SimScenario } from "./types";

/** Every scenario available on this computer: built-in fictional practice + imported Titan scenarios. */
export function listScenarios(): { scenario: SimScenario; config: ImmixConfig; playable: boolean; missing: string[] }[] {
  const cat = getTitanCatalog();
  const titanCfg: ImmixConfig = cat?.immix ?? { outcomes: [], defaultTalkdown: null };
  const titan = (cat?.scenarios ?? []).map((s) => ({ scenario: s, config: withAccepted(titanCfg, s) }));
  const builtin = BUILTIN_SCENARIOS.map((s) => ({ scenario: s, config: BUILTIN_IMMIX_CONFIG }));
  return [...builtin, ...titan].map((x) => ({ ...x, ...playability(x.scenario) }));
}

/** Guarantees every outcome the scenario accepts is selectable (does not reveal which one). */
function withAccepted(cfg: ImmixConfig, s: SimScenario): ImmixConfig {
  const extra = s.alerts.flatMap((a) => a.truth?.acceptedOutcomes ?? []);
  return { ...cfg, outcomes: [...new Set([...cfg.outcomes, ...extra])].sort((a, b) => a.localeCompare(b)) };
}

export function getScenario(id: string) {
  return listScenarios().find((x) => x.scenario.id === id);
}
