/**
 * Built-in FICTIONAL simulator scenario. Lets the simulator run (and be tested)
 * on any computer without imported Titan content. Sites, names, scripts and
 * numbers are invented and are not Titan policy.
 */
import type { ImmixConfig, SimScenario } from "@/lib/sim/types";

export const BUILTIN_IMMIX_CONFIG: ImmixConfig = {
  outcomes: ["False Alarm", "Off Site Activity", "On Site Activity", "Talkdown Successful", "Police Dispatched"],
  defaultTalkdown: null,
};

export const BUILTIN_SCENARIOS: SimScenario[] = [
  {
    id: "PRACTICE-TALKDOWN",
    title: "Practice: after-hours visitor at a fictional storage yard",
    fictional: true,
    startLocal: "2026-10-13T23:05:00",
    brief: "Fictional practice scenario. A person is detected inside the fence at Harborline Cold Storage after hours. Work the alert using the site's notes.",
    sites: [
      {
        id: "PRACTICE-HCS",
        name: "Harborline Cold Storage",
        address: "1200 Pier Road, Port Calder (fictional)",
        phone: "555-0140",
        accountId: "PRACTICE-0417",
        notes: [
          "FICTIONAL PRACTICE SITE — not a Titan client.",
          "Closed after 20:00. No one is scheduled on property overnight.",
          "Audio is authorized. Use the site script on file (Scripts tab).",
          "The property is everything inside the perimeter fence. The sidewalk on Pier Road is public.",
        ],
        talkdownScript: "Attention. This area is closed and monitored by security. You are on private property. Leave the property now.",
        audioAuthorized: true,
        cameras: [
          { id: "CAM 01", name: "CAM 01" },
          { id: "CAM 02", name: "CAM 02" },
          { id: "CAM 03", name: "CAM 03" },
          { id: "CAM 04 Speaker", name: "CAM 04 Speaker" },
        ],
        callList: [{ id: "P-DW", name: "Dana Whitfield", role: "Facilities Manager (fictional)", phone: "555-0142", password: "Lighthouse" }],
        boundary: "The perimeter fence encloses the yard and dock (CAM 01, CAM 03). CAM 02 looks across the fence to the public sidewalk.",
        previousEvents: [{ at: "10/12/2026 21:40", summary: "Raccoon near dock door — closed as False Alarm (fictional)." }],
        armingSchedule: "Armed daily 20:00–06:00 (fictional).",
      },
    ],
    alerts: [
      {
        id: "A1",
        siteId: "PRACTICE-HCS",
        type: "HUMAN_DETECTION",
        cameraId: "CAM 01",
        atMin: 0,
        priorityLabel: "Person Seen",
        details: "CAM 01 Object Detected (Person)",
        clips: {
          pre: { lengthSec: 12, beats: [{ fromSec: 0, toSec: 12, subject: "person", x0: 0.2, x1: 0.45, onSite: true, label: "A person walks across the yard inside the fence toward the dock." }] },
          post: { lengthSec: 12, beats: [{ fromSec: 0, toSec: 12, subject: "person", x0: 0.45, x1: 0.55, onSite: true, label: "The person stands at the dock door and pulls on the handle." }] },
        },
        truth: {
          acceptedOutcomes: ["Talkdown Successful"],
          actionable: true,
          onSite: true,
          rationale: "After-hours person inside the fence; notes authorize audio with the site script. Success requires 2 minutes absent on all cameras.",
        },
      },
    ],
    postTalkdownVisibility: [
      { cameraId: "CAM 01", fromSec: 0, toSec: 15 },
      { cameraId: "CAM 03", fromSec: 15, toSec: 30 },
    ],
    tasks: [
      { id: "t1", label: "Review the pre- and post-alarm clips", hint: "Play both clips all the way through at 1.00x. Skipping ahead does not count.", doneWhen: ["c1"] },
      { id: "t2", label: "Check the site notes and map", hint: "Notes tab, then Maps tab. Is audio authorized? Is there a site script?", doneWhen: ["c2", "c3"] },
      { id: "t3", label: "Deliver the talkdown", hint: "Audio → Talk-down. Use the site script on file, through the speaker camera.", doneWhen: ["c4"] },
      { id: "t4", label: "Verify on MultiView: 2 minutes, all cameras", hint: "Open MultiView and keep watching until the person has been gone from every camera for 2 full minutes.", doneWhen: ["c5", "c6"] },
      { id: "t5", label: "Close out and document", hint: "Only after verification. Mention the talkdown and MultiView in the note.", doneWhen: ["c7", "c9"] },
    ],
    criteria: [
      { id: "c1", label: "Reviewed pre and post clips", check: "CLIPS_REVIEWED", params: { alert: "A1" }, weight: 2, critical: true },
      { id: "c2", label: "Checked site notes", check: "SITE_CHECK", params: { tab: "notes", site: "PRACTICE-HCS" }, weight: 1 },
      { id: "c3", label: "Checked the map boundary", check: "SITE_CHECK", params: { tab: "map", site: "PRACTICE-HCS" }, weight: 1 },
      { id: "c4", label: "Used the site script through the speaker", check: "TALKDOWN_VALID", params: { alert: "A1" }, weight: 3, critical: true },
      { id: "c5", label: "Used MultiView", check: "MULTIVIEW_USED", weight: 1 },
      { id: "c6", label: "Watched 2 minutes of absence on all cameras", check: "ABSENCE_VERIFIED", weight: 3, critical: true },
      { id: "c7", label: "Closed as Talkdown Successful", check: "CLOSED_AS", params: { alert: "A1" }, weight: 2 },
      { id: "c8", label: "Did not claim success before verifying", check: "NO_ERROR", params: { codes: ["TALKDOWN_SUCCESS_UNVERIFIED"] }, weight: 2, critical: true },
      { id: "c9", label: "Close note mentions the talkdown and MultiView", check: "CLOSE_NOTE_HAS", params: { alert: "A1", all: ["talkdown", "multiview"] }, weight: 1 },
    ],
  },
];
