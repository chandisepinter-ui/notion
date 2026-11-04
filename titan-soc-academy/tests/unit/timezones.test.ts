import { describe, expect, it } from "vitest";
import { timeZoneForAddress, toSiteTime } from "@/lib/sim/timezones";

describe("site time zones", () => {
  it("reads the state from an address", () => {
    expect(timeZoneForAddress("100 Training Way, Kansas City, MO 64108")).toBe("America/Chicago");
    expect(timeZoneForAddress("100 Oak Terrace Dr, Anytown, NC")).toBe("America/New_York");
    expect(timeZoneForAddress("1200 Pier Road, Port Calder (fictional)")).toBeNull();
  });
  it("matches the reference screenshot: Central operator 4:29 PM = Eastern site 5:29 PM", () => {
    const op = new Date(2026, 9, 3, 16, 29, 44);
    const site = toSiteTime(op, "America/Chicago", "America/New_York");
    expect(site.getHours()).toBe(17);
    expect(toSiteTime(op, "America/Chicago", "America/Chicago").getHours()).toBe(16);
  });
});
