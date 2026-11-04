/**
 * Guided walkthrough tests — FICTIONAL fixture rows in the Power Apps manifest shape.
 */
import { describe, expect, it } from "vitest";
import { parseWalkthroughs, type WalkthroughRow } from "@/lib/course/walkthrough-model";
import { initialCourseState, LessonError, recordWalkthrough } from "@/lib/course/engine";
import { buildCourseView, walkthroughStepId } from "@/lib/course/view";
import type { CourseModule } from "@/lib/course/types";

const row = (app: string, n: number, extra: Partial<WalkthroughRow> = {}): WalkthroughRow => ({
  AppID: app, ScreenID: `${app}-0${n}`, File: `Sim - X-0${n}.jpg`, Notes: `Do step ${n}.||Wrong place ${n}.`, Title: `Step ${n} done.`,
  XPct: 10, YPct: 20, WidthPct: 5, HeightPct: 4, ActionKey: "NEXT", TargetScreenID: `${app}-0${n + 1}`, ...extra,
});
const chain = (app: string) => [row(app, 1), row(app, 2), row(app, 3, { ActionKey: "FINISH", TargetScreenID: "" })];
const all = () => true;

describe("parseWalkthroughs", () => {
  it("groups screens by module and splits instruction from hint", () => {
    const m = parseWalkthroughs([...chain("TST01.A"), ...chain("TST01.B"), ...chain("TST02.A")], all);
    expect(m.get("TST01")?.map((w) => w.id)).toEqual(["TST01.A", "TST01.B"]);
    expect(m.get("TST01")?.map((w) => w.title)).toEqual(["Walkthrough 1", "Walkthrough 2"]);
    const s = m.get("TST02")![0].screens[0];
    expect(s).toMatchObject({ instruction: "Do step 1.", hint: "Wrong place 1.", confirmation: "Step 1 done.", next: "TST02.A-02", finish: false });
    expect(m.get("TST02")![0].screens[2]).toMatchObject({ finish: true, next: null });
  });
  it("drops walkthroughs with missing frames, broken links, or no finish", () => {
    expect(parseWalkthroughs(chain("TST01.A"), (f) => f !== "Sim - X-02.jpg").size).toBe(0);
    expect(parseWalkthroughs([row("TST01.A", 1, { TargetScreenID: "nowhere" }), row("TST01.A", 2, { ActionKey: "FINISH" })], all).size).toBe(0);
    expect(parseWalkthroughs([row("TST01.A", 1, { TargetScreenID: "TST01.A-01" })], all).size).toBe(0);
  });
  it("summarizes from the first specific instruction", () => {
    const rows = chain("TST03.A");
    rows[0].Notes = "Look at the alarm (clip and live view). Then open the Notes tab.||x";
    rows[1].Notes = "Read the site notes. Deer crossing the lot. Click Close Event.||x";
    expect(parseWalkthroughs(rows, all).get("TST03")![0].summary).toBe("Deer crossing the lot.");
    expect(parseWalkthroughs(chain("TST04.A"), all).get("TST04")![0].summary).toBe("Do step 1.");
  });
  it("rejects unsafe file names", () => {
    expect(parseWalkthroughs([row("TST01.A", 1, { File: "../secret.jpg", ActionKey: "FINISH" })], all).size).toBe(0);
  });
});

const mod: CourseModule = {
  format: "course", key: "TST01", version: "t", dayNumber: 2, sortOrder: 1, dayTitle: "Test", title: "Fixture",
  competencyTarget: "x", domain: "test", contentStatus: "SOURCE_GROUNDED_PENDING_APPROVAL",
  steps: [
    { id: "w1", stage: "demonstrate", kind: "media", title: "Watch", body: "", files: [] },
    { id: "w2", stage: "guide", kind: "media", title: "Watch again", body: "", files: [] },
    { id: "p", stage: "introduce", kind: "prime", title: "End", body: "" },
  ],
};

describe("recordWalkthrough", () => {
  const ids = new Set(["TST01.A"]);
  it("records completion only on the current media step, keeping the best miss count", () => {
    const s0 = { ...initialCourseState(), stepIndex: 1 };
    const s1 = recordWalkthrough(mod, s0, "w2", "TST01.A", 3, ids, 1000);
    expect(s1.walkthroughs?.["TST01.A"]).toEqual({ done: true, misses: 3, completedAt: 1000 });
    expect(recordWalkthrough(mod, s1, "w2", "TST01.A", 1, ids, 2000).walkthroughs?.["TST01.A"].misses).toBe(1);
    expect(recordWalkthrough(mod, s1, "w2", "TST01.A", 5, ids, 2000).walkthroughs?.["TST01.A"].misses).toBe(3);
    expect(s0.walkthroughs).toBeUndefined();
  });
  it("refuses other steps and unknown walkthroughs", () => {
    expect(() => recordWalkthrough(mod, initialCourseState(), "w2", "TST01.A", 0, ids, 1)).toThrow(LessonError);
    expect(() => recordWalkthrough(mod, { ...initialCourseState(), stepIndex: 1 }, "w2", "OTHER", 0, ids, 1)).toThrow(LessonError);
  });
  it("is offered on the last media step only", () => {
    expect(walkthroughStepId(mod)).toBe("w2");
    const wts = [...parseWalkthroughs(chain("TST01.A"), all).get("TST01")!];
    const ctx = { sources: [], approvedMedia: new Set<string>(), walkthroughs: wts };
    const first = buildCourseView(mod, initialCourseState(), ctx).step;
    const last = buildCourseView(mod, { ...initialCourseState(), stepIndex: 1 }, ctx).step;
    expect(first.kind === "media" && first.walkthroughs.length).toBe(0);
    expect(last.kind === "media" && last.walkthroughs[0].screens[0].src).toBe("/api/media/walkthrough/Sim%20-%20X-01.jpg");
  });
});
