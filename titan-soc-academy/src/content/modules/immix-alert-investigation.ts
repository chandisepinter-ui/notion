/**
 * DEMONSTRATION MODULE — Day 2 (IMMIX)
 * "Alert Investigation: Evidence Before Action"
 *
 * EVERYTHING IN THIS FILE IS FICTIONAL TRAINING DATA.
 * Sites, vendors, people, phone numbers (555-01xx), schedules and response
 * plans were written for this exercise. They are NOT Titan policy and NOT a
 * real client's instructions. The skill being taught — observe the evidence,
 * then consult the site's own instructions before choosing a response — is
 * generic. Specific response actions must be replaced with Titan-approved
 * procedures before this module is used for real certification.
 */
import type { DecisionItem, LessonModule, ResponseRule, Scenario, SiteProfile } from "@/lib/academy/types";

const C = {
  OBS: "IMX-EVIDENCE",
  SI: "IMX-SITE-INSTRUCTIONS",
  RSP: "IMX-RESPONSE-SELECTION",
};

/* ------------------------------------------------------------------ */
/* Fictional response-plan template (shared rule numbering)            */
/* ------------------------------------------------------------------ */

function plan(propertyWord: string, closedWord: string): ResponseRule[] {
  return [
    {
      id: "R1",
      title: "R1 — Non-human cause",
      appliesWhen: "The alert was caused by an animal, weather, debris, lighting change or vegetation.",
      actions: ["Close the alert as a false alarm.", "Record what caused it (for example: \"deer inside fence line\")."],
    },
    {
      id: "R2",
      title: "R2 — Scheduled activity",
      appliesWhen:
        "A person or vehicle matches an Access Schedule entry — on a listed day AND inside the listed time window.",
      actions: ["Log the event as authorized activity.", "Record which schedule entry it matched."],
    },
    {
      id: "R3",
      title: "R3 — Unauthorized presence",
      appliesWhen: `A person or vehicle is on the ${propertyWord} while the site is ${closedWord}, with NO matching schedule entry.`,
      actions: [
        "Escalate immediately.",
        "Use audio talk-down if the camera supports it.",
        "Notify police dispatch.",
        "Call keyholders in the listed order.",
      ],
    },
    {
      id: "R4",
      title: "R4 — Activity outside the property",
      appliesWhen: `People or vehicles are visible beyond the fence line and do not enter the ${propertyWord}.`,
      actions: ["Monitor and log the activity.", `Escalate under R3 only if they enter the ${propertyWord}.`],
    },
  ];
}

const sites: SiteProfile[] = [
  {
    id: "hcs",
    siteCode: "HCS-0417",
    name: "Harborline Cold Storage",
    address: "1200 Pier Road, Port Calder (fictional)",
    siteType: "Refrigerated warehouse",
    hours: ["Open Monday–Friday, 06:00–20:00.", "Closed all day Saturday and Sunday.", "Outside open hours the property is closed."],
    cameras: [
      { id: "C1", name: "C1 · Gate B Entrance", scene: "gate", viewNote: "Looks at Gate B from inside the yard. Anyone on this side of the gate is on the property." },
      { id: "C2", name: "C2 · Loading Dock", scene: "dock", viewNote: "Faces dock doors 1–3. The entire view is inside the property." },
      {
        id: "C3",
        name: "C3 · Rear Fence Line",
        scene: "fence",
        viewNote: "The PROPERTY is the gravel area in the foreground, below the fence. The sidewalk beyond the fence is public.",
      },
    ],
    schedule: [
      {
        id: "S1",
        who: "Brightway Janitorial (fictional vendor)",
        days: "Tuesday and Thursday",
        window: "20:30 – 23:00",
        details: "Crew of 1–3. Enters through Gate B. Wears high-visibility vests.",
      },
    ],
    responsePlan: plan("property", "closed"),
    contacts: [
      { order: 1, name: "Dana Whitfield", role: "Facilities Manager (fictional)", phone: "555-0142" },
      { order: 2, name: "Luis Ortega", role: "Operations Lead (fictional)", phone: "555-0187" },
      { order: 3, name: "Port Calder Police — Dispatch", role: "Police (fictional)", phone: "555-0100" },
    ],
    notes: ["High-visibility vests are commonly worn by many trades. A vest alone does not confirm authorization."],
  },
  {
    id: "cra",
    siteCode: "CRA-2208",
    name: "Cedar Ridge Auto Sales",
    address: "88 Cedar Ridge Parkway, Millbrook (fictional)",
    siteType: "Vehicle dealership lot",
    hours: ["Open every day, 08:00–21:00.", "Closed every night from 21:00 until 08:00."],
    cameras: [
      { id: "L1", name: "L1 · Front Lot Rows A–C", scene: "lot", viewNote: "The entire view is inside the dealership lot." },
      {
        id: "L2",
        name: "L2 · Perimeter Fence (Parkway)",
        scene: "fence",
        viewNote: "The LOT is the paved area in the foreground, below the fence. The sidewalk beyond the fence is public.",
      },
    ],
    schedule: [
      {
        id: "S1",
        who: "Ridgeline Towing (fictional vendor)",
        days: "Monday through Saturday",
        window: "05:30 – 06:30",
        details: "Delivers inventory vehicles on a flatbed truck marked RIDGELINE. No Sunday deliveries.",
      },
    ],
    responsePlan: plan("lot", "closed"),
    contacts: [
      { order: 1, name: "Priya Natarajan", role: "General Manager (fictional)", phone: "555-0163" },
      { order: 2, name: "Owen Castillo", role: "Lot Supervisor (fictional)", phone: "555-0119" },
      { order: 3, name: "Millbrook Police — Dispatch", role: "Police (fictional)", phone: "555-0100" },
    ],
    notes: ["The lot has no audio talk-down speakers."],
  },
];

/* ------------------------------------------------------------------ */
/* Fictional camera events                                             */
/* ------------------------------------------------------------------ */

const scenarios: Scenario[] = [
  // Demonstration: first frame looks harmless; the full clip shows entry.
  {
    id: "demo-fence-entry",
    siteId: "hcs",
    cameraId: "C3",
    eventType: "Person detected",
    day: "Wednesday",
    alertTime: "02:14:07",
    frames: [
      { time: "02:14:07", objects: [{ type: "person", x: 150, y: 176, scale: 0.55, facing: "right", track: true }], caption: "One person walking on the public sidewalk beyond the fence." },
      { time: "02:14:12", objects: [{ type: "person", x: 300, y: 182, scale: 0.6, facing: "right", track: true }], caption: "The person stops at the fence and reaches toward the top rail." },
      { time: "02:14:18", objects: [{ type: "person", x: 330, y: 238, scale: 0.8, facing: "right", track: true }], caption: "The person is now on the near side of the fence, on the gravel." },
      { time: "02:14:24", objects: [{ type: "person", x: 410, y: 300, scale: 1, facing: "right", track: true }], caption: "The person walks across the property toward the building." },
    ],
  },
  {
    id: "guide-deer",
    siteId: "hcs",
    cameraId: "C3",
    eventType: "Motion detected",
    day: "Tuesday",
    alertTime: "23:41:52",
    frames: [
      { time: "23:41:52", objects: [{ type: "animal", species: "deer", x: 200, y: 285, track: true }], caption: "A deer stands on the gravel inside the fence line." },
      { time: "23:41:58", objects: [{ type: "animal", species: "deer", x: 280, y: 290, track: true }], caption: "The deer walks slowly to the right, grazing." },
      { time: "23:42:05", objects: [{ type: "animal", species: "deer", x: 380, y: 288, track: true }], caption: "The deer continues across the gravel. No people are visible." },
    ],
  },
  {
    id: "p-gate-tue-vest",
    siteId: "hcs",
    cameraId: "C1",
    eventType: "Person detected",
    day: "Tuesday",
    alertTime: "21:06:31",
    frames: [
      { time: "21:06:31", objects: [{ type: "person", x: 330, y: 215, scale: 0.6, vest: true, track: true }], caption: "A person in a high-visibility vest approaches Gate B from outside." },
      { time: "21:06:37", objects: [{ type: "person", x: 335, y: 262, scale: 0.8, vest: true, track: true }], caption: "The person walks through Gate B carrying a cleaning cart handle." },
      { time: "21:06:44", objects: [{ type: "person", x: 345, y: 318, scale: 1, vest: true, track: true }], caption: "The person continues into the yard toward the building entrance." },
    ],
  },
  {
    id: "p-gate-thu-late-vest",
    siteId: "hcs",
    cameraId: "C1",
    eventType: "Person detected",
    day: "Thursday",
    alertTime: "23:38:09",
    frames: [
      { time: "23:38:09", objects: [{ type: "person", x: 320, y: 215, scale: 0.6, vest: true, track: true }], caption: "A person in a high-visibility vest approaches Gate B." },
      { time: "23:38:15", objects: [{ type: "person", x: 325, y: 262, scale: 0.8, vest: true, track: true }], caption: "The person walks through the gate." },
      { time: "23:38:22", objects: [{ type: "person", x: 300, y: 318, scale: 1, vest: true, facing: "left", track: true }], caption: "The person walks into the yard, looking toward the building." },
    ],
  },
  {
    id: "p-fence-sat-sidewalk",
    siteId: "hcs",
    cameraId: "C3",
    eventType: "Person detected",
    day: "Saturday",
    alertTime: "01:22:44",
    frames: [
      { time: "01:22:44", objects: [{ type: "person", x: 90, y: 176, scale: 0.55, facing: "right", track: true }], caption: "A person walks on the public sidewalk beyond the fence." },
      { time: "01:22:50", objects: [{ type: "person", x: 300, y: 176, scale: 0.55, facing: "right", track: true }], caption: "The person keeps walking along the sidewalk without stopping." },
      { time: "01:22:57", objects: [{ type: "person", x: 520, y: 176, scale: 0.55, facing: "right", track: true }], caption: "The person continues past the property and out of view. They never touch the fence." },
    ],
  },
  {
    id: "p-dock-sun-debris",
    siteId: "hcs",
    cameraId: "C2",
    eventType: "Motion detected",
    day: "Sunday",
    alertTime: "03:09:15",
    frames: [
      { time: "03:09:15", objects: [{ type: "debris", x: 120, y: 290, track: true }], caption: "A plastic bag moves across the dock apron in the wind." },
      { time: "03:09:18", objects: [{ type: "debris", x: 260, y: 270, track: true }], caption: "The bag lifts and drifts toward dock door 2." },
      { time: "03:09:21", objects: [{ type: "debris", x: 430, y: 300, track: true }], caption: "The bag drifts out of view to the right. No people are visible." },
    ],
  },
  {
    id: "challenge-dock-sat-vest",
    siteId: "hcs",
    cameraId: "C2",
    eventType: "Person detected",
    day: "Saturday",
    alertTime: "22:47:33",
    frames: [
      { time: "22:47:33", objects: [{ type: "person", x: 90, y: 300, scale: 0.9, vest: true, facing: "right", track: true }], caption: "A person in a high-visibility vest walks onto the dock apron from the left." },
      { time: "22:47:41", objects: [{ type: "person", x: 300, y: 252, scale: 0.85, vest: true, facing: "right", track: true }], caption: "The person goes to dock door 2." },
      { time: "22:47:49", objects: [{ type: "person", x: 318, y: 250, scale: 0.85, vest: true, facing: "left", track: true }], caption: "The person pulls on the dock door handle, then looks back over their shoulder." },
    ],
  },
  // Verification pool
  {
    id: "v-lot-wed-tow",
    siteId: "cra",
    cameraId: "L1",
    eventType: "Vehicle detected",
    day: "Wednesday",
    alertTime: "05:52:10",
    frames: [
      { time: "05:52:10", objects: [{ type: "vehicle", variant: "flatbed", x: 30, y: 318, label: "RIDGELINE", loaded: true, track: true }], caption: "A flatbed truck marked RIDGELINE enters the lot from the left." },
      { time: "05:52:19", objects: [{ type: "vehicle", variant: "flatbed", x: 190, y: 318, label: "RIDGELINE", loaded: true, track: true }], caption: "The truck drives along the front row carrying a car." },
      { time: "05:52:31", objects: [{ type: "vehicle", variant: "flatbed", x: 330, y: 318, label: "RIDGELINE", loaded: true, track: true }, { type: "person", x: 520, y: 318, scale: 0.9 }], caption: "The truck stops; the driver steps out beside it." },
    ],
  },
  {
    id: "v-lot-sun-tow",
    siteId: "cra",
    cameraId: "L1",
    eventType: "Vehicle detected",
    day: "Sunday",
    alertTime: "05:48:02",
    frames: [
      { time: "05:48:02", objects: [{ type: "vehicle", variant: "flatbed", x: 30, y: 318, label: "RIDGELINE", track: true }], caption: "A flatbed truck marked RIDGELINE enters the lot from the left." },
      { time: "05:48:11", objects: [{ type: "vehicle", variant: "flatbed", x: 190, y: 318, label: "RIDGELINE", track: true }], caption: "The truck drives along the front row. The flatbed is empty." },
      { time: "05:48:24", objects: [{ type: "vehicle", variant: "flatbed", x: 330, y: 318, label: "RIDGELINE", track: true }, { type: "person", x: 520, y: 318, scale: 0.9 }], caption: "The truck stops near Row C; the driver steps out." },
    ],
  },
  {
    id: "v-lot-mon-doors",
    siteId: "cra",
    cameraId: "L1",
    eventType: "Person detected",
    day: "Monday",
    alertTime: "23:16:40",
    frames: [
      { time: "23:16:40", objects: [{ type: "person", x: 120, y: 300, scale: 0.85, facing: "right", track: true }], caption: "A person walks between the parked cars in Row A." },
      { time: "23:16:47", objects: [{ type: "person", x: 250, y: 296, scale: 0.85, facing: "right", track: true }], caption: "The person leans toward a car window." },
      { time: "23:16:55", objects: [{ type: "person", x: 390, y: 298, scale: 0.85, facing: "right", track: true }], caption: "The person pulls the door handle of another car." },
    ],
  },
  {
    id: "v-dock-fri-person",
    siteId: "hcs",
    cameraId: "C2",
    eventType: "Person detected",
    day: "Friday",
    alertTime: "03:31:18",
    frames: [
      { time: "03:31:18", objects: [{ type: "person", x: 520, y: 300, scale: 0.9, facing: "left", track: true }], caption: "A person walks onto the dock apron from the right." },
      { time: "03:31:26", objects: [{ type: "person", x: 470, y: 252, scale: 0.85, facing: "left", track: true }], caption: "The person goes to dock door 3." },
      { time: "03:31:34", objects: [{ type: "person", x: 300, y: 252, scale: 0.85, facing: "left", track: true }], caption: "The person moves along the doors toward door 2." },
    ],
  },
  {
    id: "v-fence-thu-rain",
    siteId: "cra",
    cameraId: "L2",
    eventType: "Motion detected",
    day: "Thursday",
    alertTime: "02:05:51",
    frames: [
      { time: "02:05:51", objects: [{ type: "rain", track: false }], caption: "Heavy rain streaks across the image. No people or vehicles are visible." },
      { time: "02:05:56", objects: [{ type: "rain", track: false }], caption: "Rain continues. The lot and sidewalk are empty." },
      { time: "02:06:01", objects: [{ type: "rain", track: false }], caption: "Rain continues. Nothing else moves." },
    ],
  },
  {
    id: "v-dock-mon-raccoon",
    siteId: "hcs",
    cameraId: "C2",
    eventType: "Motion detected",
    day: "Monday",
    alertTime: "04:12:27",
    frames: [
      { time: "04:12:27", objects: [{ type: "animal", species: "raccoon", x: 140, y: 305, track: true }], caption: "A raccoon walks onto the dock apron." },
      { time: "04:12:31", objects: [{ type: "animal", species: "raccoon", x: 240, y: 300, track: true }], caption: "The raccoon sniffs near dock door 1." },
      { time: "04:12:36", objects: [{ type: "animal", species: "raccoon", x: 360, y: 306, track: true }], caption: "The raccoon wanders to the right. No people are visible." },
    ],
  },
  {
    id: "v-fence-fri-sidewalk",
    siteId: "cra",
    cameraId: "L2",
    eventType: "Person detected",
    day: "Friday",
    alertTime: "22:34:05",
    frames: [
      { time: "22:34:05", objects: [{ type: "person", x: 520, y: 176, scale: 0.55, facing: "left", track: true }], caption: "A person walks on the public sidewalk beyond the fence." },
      { time: "22:34:12", objects: [{ type: "person", x: 320, y: 176, scale: 0.55, facing: "left", track: true }], caption: "The person glances at the cars but keeps walking." },
      { time: "22:34:20", objects: [{ type: "person", x: 110, y: 176, scale: 0.55, facing: "left", track: true }], caption: "The person continues out of view. They never touch the fence." },
    ],
  },
  {
    id: "v-fence-sun-sidewalk",
    siteId: "hcs",
    cameraId: "C3",
    eventType: "Person detected",
    day: "Sunday",
    alertTime: "00:47:39",
    frames: [
      { time: "00:47:39", objects: [{ type: "person", x: 480, y: 176, scale: 0.55, facing: "left", track: true }], caption: "A person walks along the public sidewalk beyond the fence." },
      { time: "00:47:47", objects: [{ type: "person", x: 300, y: 176, scale: 0.55, facing: "left", track: true }], caption: "The person pauses briefly, looking at their phone." },
      { time: "00:47:56", objects: [{ type: "person", x: 120, y: 176, scale: 0.55, facing: "left", track: true }], caption: "The person continues walking out of view on the sidewalk." },
    ],
  },
  {
    id: "v-gate-tue-vest",
    siteId: "hcs",
    cameraId: "C1",
    eventType: "Person detected",
    day: "Tuesday",
    alertTime: "22:18:47",
    frames: [
      { time: "22:18:47", objects: [{ type: "person", x: 310, y: 318, scale: 1, vest: true, facing: "left", track: true }], caption: "A person in a high-visibility vest walks from the building toward Gate B." },
      { time: "22:18:54", objects: [{ type: "person", x: 320, y: 262, scale: 0.8, vest: true, track: true }], caption: "The person carries a trash bag toward the gate." },
      { time: "22:19:02", objects: [{ type: "person", x: 330, y: 215, scale: 0.6, vest: true, track: true }], caption: "The person places the bag in the bin outside the gate." },
    ],
  },
  {
    id: "v-gate-thu-vest-early",
    siteId: "hcs",
    cameraId: "C1",
    eventType: "Person detected",
    day: "Thursday",
    alertTime: "20:44:13",
    frames: [
      { time: "20:44:13", objects: [{ type: "person", x: 300, y: 215, scale: 0.6, vest: true, track: true }, { type: "person", x: 360, y: 215, scale: 0.6, vest: true }], caption: "Two people in high-visibility vests approach Gate B." },
      { time: "20:44:20", objects: [{ type: "person", x: 305, y: 262, scale: 0.8, vest: true, track: true }, { type: "person", x: 368, y: 262, scale: 0.8, vest: true }], caption: "They walk through the gate together." },
      { time: "20:44:28", objects: [{ type: "person", x: 310, y: 318, scale: 1, vest: true, track: true }, { type: "person", x: 380, y: 318, scale: 1, vest: true }], caption: "They walk toward the building entrance." },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

const ALL_EVIDENCE: DecisionItem["requiredEvidence"] = ["clip", "schedule", "plan"];
const ALL_C = [C.OBS, C.SI, C.RSP];

const item = (i: Omit<DecisionItem, "prompt" | "requiredEvidence" | "competencies"> & Partial<DecisionItem>): DecisionItem => ({
  prompt: "Investigate this alert. Then choose your action and the response-plan rule that supports it.",
  requiredEvidence: ALL_EVIDENCE,
  competencies: ALL_C,
  ...i,
});

const guideItem = item({
  id: "guide-1",
  scenarioId: "guide-deer",
  correctAction: "false-alarm",
  correctRule: "R1",
  hints: [
    "Watch the clip all the way to the end. What actually triggered the motion alert?",
    "Open the Response Plan. Which rule describes alerts caused by something that is not a person or vehicle?",
    "An animal is a non-human cause. Look for the rule that says to close the alert and record the cause.",
  ],
  explanation:
    "The only thing moving is a deer. The response plan's R1 covers non-human causes: close the alert as a false alarm and record the cause, such as \"deer inside fence line.\" The time of night does not change this — there is no person on the property.",
});

const practiceItems: DecisionItem[] = [
  item({
    id: "practice-1",
    scenarioId: "p-gate-tue-vest",
    correctAction: "authorized",
    correctRule: "R2",
    explanation:
      "Tuesday at 21:06 falls inside the Brightway Janitorial window (Tuesday and Thursday, 20:30–23:00), and the person entered through Gate B as the schedule describes. R2 applies: log it as authorized activity and record schedule entry S1.",
  }),
  item({
    id: "practice-2",
    scenarioId: "p-gate-thu-late-vest",
    correctAction: "escalate",
    correctRule: "R3",
    misconceptionFor: { authorized: "appearance-over-schedule" },
    explanation:
      "Thursday is a cleaning day, but the window ends at 23:00. At 23:38 there is no matching schedule entry, so this is a person on the property while closed. The vest does not authorize them — the schedule does. R3 applies: escalate.",
  }),
  item({
    id: "practice-3",
    scenarioId: "p-fence-sat-sidewalk",
    correctAction: "monitor",
    correctRule: "R4",
    explanation:
      "The person stayed on the public sidewalk beyond the fence for the entire clip and never entered the property. R4 applies: monitor and log, and escalate only if they enter.",
  }),
  item({
    id: "practice-4",
    scenarioId: "p-dock-sun-debris",
    correctAction: "false-alarm",
    correctRule: "R1",
    explanation:
      "The motion was a plastic bag blowing across the dock. That is a non-human cause, so R1 applies: close as a false alarm and record the cause.",
  }),
];

const challengeItem = item({
  id: "challenge-1",
  scenarioId: "challenge-dock-sat-vest",
  correctAction: "escalate",
  correctRule: "R3",
  misconceptionFor: { authorized: "appearance-over-schedule" },
  explanation:
    "Saturday: the site is closed all day and the only schedule entry (Brightway Janitorial) is Tuesday and Thursday. The person is on the property, at a dock door, testing the handle. A vest does not create authorization. R3 applies: escalate — talk-down if available, police dispatch, then keyholders in order.",
});

const verifyGroups: DecisionItem[][] = [
  [
    item({ id: "verify-1a", scenarioId: "v-lot-wed-tow", correctAction: "authorized", correctRule: "R2", explanation: "Wednesday 05:52 is inside the Ridgeline Towing window (Monday–Saturday, 05:30–06:30) and the truck is marked RIDGELINE. R2: log as authorized activity and record entry S1." }),
    item({ id: "verify-1b", scenarioId: "v-lot-sun-tow", correctAction: "escalate", correctRule: "R3", misconceptionFor: { authorized: "appearance-over-schedule" }, explanation: "The schedule says Monday through Saturday and explicitly says no Sunday deliveries. A RIDGELINE marking does not create authorization on Sunday. A vehicle and driver are in the lot while closed with no matching entry: R3, escalate." }),
  ],
  [
    item({ id: "verify-2a", scenarioId: "v-lot-mon-doors", correctAction: "escalate", correctRule: "R3", explanation: "Monday 23:16 is after the 21:00 closing time and there is no schedule entry for that time. A person inside the lot trying car doors: R3, escalate." }),
    item({ id: "verify-2b", scenarioId: "v-dock-fri-person", correctAction: "escalate", correctRule: "R3", explanation: "Friday 03:31 is outside open hours (06:00–20:00) and there is no Friday schedule entry. A person on the dock apron is on the property: R3, escalate." }),
  ],
  [
    item({ id: "verify-3a", scenarioId: "v-fence-thu-rain", correctAction: "false-alarm", correctRule: "R1", explanation: "Only rain is moving. Weather is a non-human cause: R1, close as a false alarm and record \"heavy rain.\"" }),
    item({ id: "verify-3b", scenarioId: "v-dock-mon-raccoon", correctAction: "false-alarm", correctRule: "R1", explanation: "Only a raccoon is moving. An animal is a non-human cause: R1, close as a false alarm and record the cause." }),
  ],
  [
    item({ id: "verify-4a", scenarioId: "v-fence-fri-sidewalk", correctAction: "monitor", correctRule: "R4", explanation: "The person stayed on the public sidewalk beyond the fence and never entered the lot. R4: monitor and log." }),
    item({ id: "verify-4b", scenarioId: "v-fence-sun-sidewalk", correctAction: "monitor", correctRule: "R4", explanation: "The person stayed on the public sidewalk beyond the fence. R4: monitor and log; escalate only if they enter." }),
  ],
  [
    item({ id: "verify-5a", scenarioId: "v-gate-tue-vest", correctAction: "authorized", correctRule: "R2", explanation: "Tuesday 22:18 is inside the Brightway Janitorial window (Tuesday and Thursday, 20:30–23:00). R2: log as authorized activity and record entry S1." }),
    item({ id: "verify-5b", scenarioId: "v-gate-thu-vest-early", correctAction: "authorized", correctRule: "R2", explanation: "Thursday 20:44 is inside the Brightway Janitorial window (20:30–23:00), the crew size (2) is within 1–3, and they entered through Gate B. R2: log as authorized activity." }),
  ],
];

/* ------------------------------------------------------------------ */
/* Module definition                                                   */
/* ------------------------------------------------------------------ */

export const immixAlertInvestigation: LessonModule = {
  key: "immix-alert-investigation",
  version: 1,
  dayNumber: 2,
  title: "Alert Investigation: Evidence Before Action",
  subtitle: "Observe the evidence, consult the site's instructions, then choose a response.",
  estimatedMinutes: 35,
  fictionalNotice:
    "Training simulation. All sites, vendors, people, phone numbers and response plans in this module are fictional and are not Titan policy.",
  competencies: [
    { key: C.OBS, name: "Evidence Observation", description: "Reviews the full event clip and accurately identifies what caused an alert and where it occurred.", category: "IMMIX" },
    { key: C.SI, name: "Site Instruction Application", description: "Checks the site's hours and access schedule and finds the rule that applies before acting.", category: "IMMIX" },
    { key: C.RSP, name: "Response Selection", description: "Selects the response the site's instructions require and can cite the supporting rule.", category: "IMMIX" },
  ],
  actions: [
    { id: "false-alarm", label: "Close as false alarm", detail: "Record what caused the alert." },
    { id: "authorized", label: "Log as authorized activity", detail: "Record the matching schedule entry." },
    { id: "monitor", label: "Monitor and log", detail: "Keep watching. No dispatch unless the situation changes." },
    { id: "escalate", label: "Escalate", detail: "Follow the escalation steps in the response plan, in order." },
  ],
  misconceptions: [
    {
      key: "dismissed-human-activity",
      label: "Closing an alert as false when a person or vehicle caused it",
      explanations: [
        "A false alarm means nothing that needs a response caused the alert — an animal, weather, debris or lighting. When a person or vehicle appears in the clip, the alert is real activity and the site's instructions decide what to do with it.",
        "Try this check: \"Did a person or vehicle cause this alert?\" If yes, it is never a false alarm. Your only question becomes which rule — scheduled, outside the property, or unauthorized — fits what you saw.",
      ],
    },
    {
      key: "unverified-authorization",
      label: "Treating activity as authorized without a matching schedule entry",
      explanations: [
        "Activity is only \"authorized\" when it matches an Access Schedule entry: the right day AND inside the time window. If you cannot point to the specific entry, it is not authorized.",
        "Before choosing \"authorized,\" say the entry out loud: who, which day, which window. If any piece does not match the alert — wrong day, outside the window, wrong entrance — authorization does not apply.",
      ],
    },
    {
      key: "appearance-over-schedule",
      label: "Trusting appearance (vest, uniform, logo) over the schedule",
      explanations: [
        "A vest, uniform or logo tells you what someone looks like, not whether they are allowed to be there right now. Authorization comes from the site's schedule — day and time window — not from appearance.",
        "Imagine anyone can buy a high-visibility vest or paint a logo on a truck. Then ask: does the schedule say this activity is expected at THIS day and time? If not, treat it as unauthorized and follow the plan.",
      ],
    },
    {
      key: "over-escalation",
      label: "Escalating activity the site's instructions classify differently",
      explanations: [
        "Escalation is reserved for what the response plan says requires it. Escalating scheduled activity, animals, or people who stay off the property sends police and wakes keyholders for no reason — and erodes trust in real alarms.",
        "Walk the rules in order: Is it non-human (R1)? Does it match the schedule (R2)? Is it beyond the fence and staying there (R4)? Only when the answer is \"a person or vehicle on the property with no matching schedule\" does R3 apply.",
      ],
    },
    {
      key: "under-escalation",
      label: "Watching when the plan requires escalation",
      explanations: [
        "\"Monitor and log\" is for activity outside the property. Once a person or vehicle is ON the property while closed with no matching schedule entry, the plan requires escalation — waiting costs response time.",
        "Check where the subject is in the LAST frames of the clip, not the first. If they ended up on the property, the situation is no longer \"outside activity,\" and the plan's escalation steps apply now.",
      ],
    },
    {
      key: "unresolved-alert",
      label: "Leaving an explained alert open instead of resolving it",
      explanations: [
        "When the evidence fully explains the alert — an animal, weather, or scheduled activity — the plan tells you how to close or log it. Choosing to keep monitoring leaves the alert unresolved without a reason.",
        "If you can name the cause and point to the rule that covers it, resolve the alert under that rule. \"Monitor\" is a decision for people outside the property, not a way to delay a decision.",
      ],
    },
    {
      key: "rule-mismatch",
      label: "Right action, wrong supporting rule",
      explanations: [
        "Your action was right, but documentation must cite the rule that actually applies. A supervisor reviewing your log needs to see the correct reason, not just the correct outcome.",
        "Read the \"applies when\" line of each rule and match it to what you saw. The right action with the wrong reason is a lucky guess — the rule is what makes the decision defensible.",
      ],
    },
  ],
  sites,
  scenarios,
  steps: [
    {
      id: "intro",
      stage: "introduce",
      kind: "briefing",
      title: "Evidence before action",
      task: "Read this briefing. Select Continue when you are ready.",
      objectives: [
        "Review the entire event clip before deciding anything.",
        "Check the site's hours and access schedule against the alert's day and time.",
        "Find the response-plan rule that applies, then act on it.",
      ],
      body: [
        {
          type: "callout",
          tone: "fictional",
          title: "Fictional training data",
          text: "The sites and response plans in this module are invented for practice. They teach the investigation method, not Titan's actual response procedures.",
        },
        {
          type: "p",
          text: "Every alert asks one question: what does this site need me to do about what I just saw? You cannot answer it from the alert type alone. \"Person detected\" can be a cleaning crew on schedule, a neighbor walking a dog on the sidewalk, or someone breaking in.",
        },
        {
          type: "sequence",
          items: [
            { title: "1 · Observe", text: "Play the whole clip. Note WHAT caused the alert and WHERE it ended up — on the property or beyond the fence." },
            { title: "2 · Check the time", text: "Compare the alert's day and time with the site's open hours and Access Schedule." },
            { title: "3 · Consult the plan", text: "Read the response plan. Find the ONE rule whose \"applies when\" matches what you observed." },
            { title: "4 · Act and document", text: "Choose the action that rule requires, and record the rule as your reason." },
          ],
        },
        {
          type: "callout",
          tone: "caution",
          title: "Common trap",
          text: "Appearance is not authorization. A vest, uniform or company logo does not tell you whether someone is expected. The schedule does.",
        },
      ],
    },
    {
      id: "demo",
      stage: "demonstrate",
      kind: "walkthrough",
      title: "Watch an investigation",
      task: "Follow along. Select Next to move through each part of the investigation.",
      scenarioId: "demo-fence-entry",
      demonstratedAnswer: { action: "escalate", rule: "R3" },
      panels: [
        { focus: "alert", frameIndex: 0, title: "The alert arrives", text: "Camera C3 (Rear Fence Line) reports \"Person detected\" at 02:14 on a Wednesday. Do not decide anything yet." },
        { focus: "clip", frameIndex: 0, title: "First frame: looks harmless", text: "The first frame shows someone on the public sidewalk beyond the fence. If you stopped here, you might think \"outside the property — monitor.\"" },
        { focus: "clip", frameIndex: 3, title: "Last frame: the real situation", text: "By the end of the clip, the person has crossed the fence and is walking on the gravel — on the property. This is why you always watch the entire clip." },
        { focus: "overview", title: "Know the camera view", text: "The site overview explains that on C3, the property is the foreground gravel below the fence. Anyone in that area is on the property." },
        { focus: "schedule", title: "Check the schedule", text: "Harborline is closed outside Monday–Friday 06:00–20:00. The only schedule entry is the cleaning crew on Tuesday and Thursday evenings. Wednesday 02:14 matches nothing." },
        { focus: "plan", title: "Find the rule", text: "R3 — Unauthorized presence: a person on the property while closed with no matching schedule entry. That matches exactly." },
        { focus: "decision", title: "Act and document", text: "Action: Escalate. Reason: R3. Then follow R3's steps in order. Notice that the decision came from the evidence and the site's instructions — never from the alert type alone." },
      ],
    },
    {
      id: "guide",
      stage: "guide",
      kind: "decision",
      title: "Your turn, with help",
      task: "Investigate this alert. Hints are available if you need them.",
      item: guideItem,
    },
    {
      id: "practice",
      stage: "practice",
      kind: "practice",
      title: "Independent practice",
      task: "Handle each alert on your own. Get two right on the first try to move on.",
      items: practiceItems,
      requiredFirstTryCorrect: 2,
    },
    {
      id: "challenge",
      stage: "challenge",
      kind: "decision",
      title: "Full scenario",
      task: "A realistic alert with no hints. Open every source you need before deciding.",
      item: challengeItem,
    },
    {
      id: "verify",
      stage: "verify",
      kind: "assessment",
      title: "Verification",
      task: "Answer all five alerts, then submit. Results appear after you submit.",
      intro:
        "Five alerts from two fictional sites. You must review the required evidence for each before answering. You need 80% (4 of 5) and no critical errors to pass. Critical error in this exercise: failing to escalate an unauthorized presence.",
      groups: verifyGroups,
      passPercent: 80,
    },
  ],
  pendingApproval: [
    "Response-plan rule set R1–R4 is a fictional template. Replace with Titan-approved IMMIX alarm-handling procedure before certification use.",
    "Escalation order (talk-down → police dispatch → keyholders) is fictional. Confirm the actual Titan escalation sequence.",
    "\"Critical error\" definition (failure to escalate unauthorized presence) is a training assumption. Confirm Titan's critical-error criteria.",
    "Pass threshold (80% with no critical errors) is a proposed default. Confirm with SOC leadership.",
  ],
};
