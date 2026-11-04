/**
 * Curriculum registry: the seven-day Academy, module list, Skill Catalog and
 * Arcade. The seed script writes this into the database. Modules marked
 * PLANNED have no content yet and are shown as "Not yet available".
 */
import type { LessonModule } from "@/lib/academy/types";
import { immixAlertInvestigation } from "./modules/immix-alert-investigation";

/** Every module with playable content, by key. Add new modules here. */
export const LESSON_MODULES: Record<string, LessonModule> = {
  [immixAlertInvestigation.key]: immixAlertInvestigation,
};

export function getLessonModule(key: string): LessonModule | undefined {
  return LESSON_MODULES[key];
}

export const ACADEMY_DAYS = [
  { dayNumber: 1, title: "Policies & Expectations", format: "Guided instruction + practice", summary: "Titan standards, conduct, confidentiality, shift expectations and how the SOC operates." },
  { dayNumber: 2, title: "IMMIX", format: "Guided instruction + simulation", summary: "Alarm monitoring: reading alerts, reviewing video, applying site instructions, resolving events." },
  { dayNumber: 3, title: "HubSpot & TrackTik", format: "Guided instruction + simulation", summary: "Documentation, tickets, site records and officer/patrol tracking." },
  { dayNumber: 4, title: "Email & Teams", format: "Guided instruction + simulation", summary: "Professional written communication, notifications and internal coordination." },
  { dayNumber: 5, title: "ATM Operations", format: "Guided instruction + simulation", summary: "ATM alarm and service workflows." },
  { dayNumber: 6, title: "Radio Operations", format: "Guided instruction + simulation", summary: "Phonetic alphabet, military time, radio discipline, call signs and logging." },
  { dayNumber: 7, title: "Supervisor Review", format: "8-hour simulated validation shift", summary: "A continuous eight-hour simulated operational shift. Your supervisor evaluates each practical skill and signs off graduation." },
] as const;

export type ModuleSeed = {
  key: string;
  dayNumber: number;
  title: string;
  summary: string;
  status: "AVAILABLE" | "PLANNED";
  isPreview: boolean;
  estimatedMinutes: number | null;
  sortOrder: number;
};

export const MODULE_SEEDS: ModuleSeed[] = [
  { key: "policies-orientation", dayNumber: 1, title: "SOC Orientation & Expectations", summary: "How the SOC operates and what is expected on every shift.", status: "PLANNED", isPreview: false, estimatedMinutes: null, sortOrder: 1 },
  {
    key: immixAlertInvestigation.key,
    dayNumber: 2,
    title: immixAlertInvestigation.title,
    summary: immixAlertInvestigation.subtitle,
    status: "AVAILABLE",
    isPreview: true,
    estimatedMinutes: immixAlertInvestigation.estimatedMinutes,
    sortOrder: 90,
  },
  { key: "immix-event-handling", dayNumber: 2, title: "IMMIX Event Handling & Closure", summary: "Working the alarm queue end to end, including documentation.", status: "PLANNED", isPreview: false, estimatedMinutes: null, sortOrder: 2 },
  { key: "hubspot-tickets", dayNumber: 3, title: "HubSpot Incident Documentation", summary: "Creating accurate, complete incident records.", status: "PLANNED", isPreview: false, estimatedMinutes: null, sortOrder: 1 },
  { key: "tracktik-operations", dayNumber: 3, title: "TrackTik Operations", summary: "Site records, officer tracking and reports.", status: "PLANNED", isPreview: false, estimatedMinutes: null, sortOrder: 2 },
  { key: "email-teams-communication", dayNumber: 4, title: "Professional Communication", summary: "Email and Teams standards for notifications and coordination.", status: "PLANNED", isPreview: false, estimatedMinutes: null, sortOrder: 1 },
  { key: "atm-operations", dayNumber: 5, title: "ATM Operations", summary: "ATM alarm and service workflows.", status: "PLANNED", isPreview: false, estimatedMinutes: null, sortOrder: 1 },
  { key: "radio-operations", dayNumber: 6, title: "Radio Operations", summary: "Radio discipline, phonetics, military time and logging.", status: "PLANNED", isPreview: false, estimatedMinutes: null, sortOrder: 1 },
  { key: "day7-validation-shift", dayNumber: 7, title: "Simulated Validation Shift", summary: "Continuous eight-hour simulated shift across IMMIX, HubSpot, TrackTik, phones, email/Teams and radio, evaluated and signed off by a supervisor. Requires the simulator (Phase 3).", status: "PLANNED", isPreview: false, estimatedMinutes: 480, sortOrder: 1 },
];

export const SKILL_SEEDS = [
  { key: "immix-alert-investigation", name: "Alert investigation", category: "IMMIX", description: "Review event video, identify the cause and location, and apply site instructions.", learnModuleKey: immixAlertInvestigation.key, gameKey: "alarm-desk", sortOrder: 1 },
  { key: "site-instructions", name: "Applying site instructions", category: "IMMIX", description: "Match an event to the correct rule in a site's response plan and access schedule.", learnModuleKey: immixAlertInvestigation.key, gameKey: "alarm-desk", sortOrder: 2 },
  { key: "temp-notes", name: "Temporary site notes", category: "Documentation", description: "Build accurate temporary notes using the approved template.", learnModuleKey: null, gameKey: "temp-notes", sortOrder: 3 },
  { key: "phonetic-alphabet", name: "Phonetic alphabet", category: "Radio", description: "Spell names, plates and identifiers clearly over the radio.", learnModuleKey: null, gameKey: "radio-rush", sortOrder: 4 },
  { key: "military-time", name: "Military time", category: "Radio", description: "Read, write and convert 24-hour time without hesitation.", learnModuleKey: null, gameKey: "radio-rush", sortOrder: 5 },
  { key: "radio-logging", name: "Radio logging", category: "Radio", description: "Record radio traffic accurately in the Radio Log.", learnModuleKey: null, gameKey: "radio-rush", sortOrder: 6 },
  { key: "incident-documentation", name: "Incident documentation", category: "HubSpot", description: "Create complete, accurate incident records.", learnModuleKey: null, gameKey: null, sortOrder: 7 },
  { key: "professional-email", name: "Professional email", category: "Communication", description: "Write clear notifications and updates.", learnModuleKey: null, gameKey: null, sortOrder: 8 },
];

export const ARCADE_SEEDS = [
  {
    key: "alarm-desk",
    name: "Alarm Desk",
    tagline: "Investigate simulated IMMIX events and apply site instructions.",
    description: "Work a queue of simulated alerts. Inspect video, cross-check schedules and plans, and resolve each event correctly. Accuracy is scored; there is no timer.",
    status: "PLANNED",
    unlockModuleKey: immixAlertInvestigation.key,
    plannedPhase: 4,
    sortOrder: 1,
  },
  {
    key: "radio-rush",
    name: "Radio Rush",
    tagline: "Phonetics, military time, call signs and radio logging.",
    description: "Decode and transmit radio traffic, convert times and log calls correctly. Builds radio fluency through puzzles rather than flashcards.",
    status: "PLANNED",
    unlockModuleKey: "radio-operations",
    plannedPhase: 4,
    sortOrder: 2,
  },
  {
    key: "temp-notes",
    name: "Temp Notes",
    tagline: "Build accurate temporary site notes from the approved template.",
    description: "Assemble temporary site notes from scattered information, catching missing or conflicting details. Requires the approved Titan template before build.",
    status: "PLANNED",
    unlockModuleKey: null,
    plannedPhase: 4,
    sortOrder: 3,
  },
];

/** Fictional demonstration accounts. Names are invented. */
export const DEMO_USERS = [
  { key: "operator", displayName: "Jordan Reyes", email: "jordan.reyes@demo.titan-academy.local", title: "Operator Trainee", shift: "DAYS", roles: ["OPERATOR"] },
  { key: "operator2", displayName: "Sam Okafor", email: "sam.okafor@demo.titan-academy.local", title: "Operator Trainee", shift: "NIGHTS", roles: ["OPERATOR"] },
  { key: "supervisor", displayName: "Morgan Ellis", email: "morgan.ellis@demo.titan-academy.local", title: "SOC Supervisor", shift: "DAYS", roles: ["SUPERVISOR"] },
  { key: "senior", displayName: "Riley Chen", email: "riley.chen@demo.titan-academy.local", title: "Senior SOC Supervisor", shift: "SWINGS", roles: ["SENIOR_SUPERVISOR"] },
  { key: "admin", displayName: "Taylor Quinn", email: "taylor.quinn@demo.titan-academy.local", title: "Academy Administrator", shift: null, roles: ["ADMINISTRATOR"] },
] as const;
