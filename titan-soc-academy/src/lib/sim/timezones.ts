/**
 * Site time zones. IMMIX shows both the operator's time and the site's local
 * time; they differ only when the site is in another time zone.
 * The SOC's own zone comes from SOC_TIME_ZONE (default America/Chicago — the
 * reference screenshots show Central operator time beside Eastern site time).
 */
const STATE_TZ: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago", CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York", DE: "America/New_York", DC: "America/New_York", FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
  ID: "America/Boise", IL: "America/Chicago", IN: "America/Indiana/Indianapolis", IA: "America/Chicago", KS: "America/Chicago", KY: "America/New_York",
  LA: "America/Chicago", ME: "America/New_York", MD: "America/New_York", MA: "America/New_York", MI: "America/Detroit", MN: "America/Chicago",
  MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago", NV: "America/Los_Angeles", NH: "America/New_York",
  NJ: "America/New_York", NM: "America/Denver", NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
  OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York", SC: "America/New_York", SD: "America/Chicago",
  TN: "America/Chicago", TX: "America/Chicago", UT: "America/Denver", VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
  WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver",
};

/** Time zone from a US address ("..., Kansas City, MO 64108"), or null if it cannot be told. */
export function timeZoneForAddress(address: string): string | null {
  const m = address.match(/,\s*([A-Z]{2})\b(?:\s+\d{5})?\s*(?:\(|$)/) ?? address.match(/\b([A-Z]{2})\s+\d{5}\b/);
  return m ? STATE_TZ[m[1]] ?? null : null;
}

/** Minutes the zone is ahead of UTC at a given instant. */
function offsetMinutes(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Converts an operator wall-clock time to the site's wall-clock time. */
export function toSiteTime(operatorWall: Date, socTz: string, siteTz: string | null): Date {
  if (!siteTz || siteTz === socTz) return operatorWall;
  const diff = offsetMinutes(siteTz, operatorWall) - offsetMinutes(socTz, operatorWall);
  return new Date(operatorWall.getTime() + diff * 60000);
}
