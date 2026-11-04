/**
 * Titan SOC Academy — database schema.
 *
 * Written with Drizzle ORM for SQLite (local development). The table design is
 * deliberately portable: plain text/integer columns, no SQLite-only features,
 * so the same model can be expressed with `drizzle-orm/pg-core` for PostgreSQL.
 *
 * Lesson CONTENT (steps, scenarios, answers) lives in `src/content` as typed
 * data. The database stores the module registry, people, permissions,
 * progress, attempts, and competency evidence.
 */
import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);

/* ------------------------------------------------------------------ */
/* People, roles and permissions                                       */
/* ------------------------------------------------------------------ */

export const users = sqliteTable("users", {
  id: id(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  title: text("title"),
  /** DAYS | SWINGS | NIGHTS — used for future team competitions. */
  shift: text("shift"),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  themePref: text("theme_pref").notNull().default("system"),
  textSizePref: text("text_size_pref").notNull().default("standard"),
  motionPref: text("motion_pref").notNull().default("system"),
  /** Set when a supervisor approves graduation (Phase 3). Unlocks Reference Center. */
  graduatedAt: integer("graduated_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const roles = sqliteTable("roles", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  /** Determines which dashboard a person lands on (highest wins). */
  rank: integer("rank").notNull().default(0),
});

export const permissions = sqliteTable("permissions", {
  key: text("key").primaryKey(),
  category: text("category").notNull(),
  description: text("description").notNull(),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull().references(() => permissions.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const supervisorAssignments = sqliteTable(
  "supervisor_assignments",
  {
    supervisorId: text("supervisor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    traineeId: text("trainee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.supervisorId, t.traineeId] })],
);

/* ------------------------------------------------------------------ */
/* Curriculum registry                                                 */
/* ------------------------------------------------------------------ */

export const academyDays = sqliteTable("academy_days", {
  dayNumber: integer("day_number").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  format: text("format").notNull(),
});

export const modules = sqliteTable("modules", {
  id: id(),
  key: text("key").notNull().unique(),
  dayNumber: integer("day_number").notNull().references(() => academyDays.dayNumber),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  /** AVAILABLE = playable content exists. PLANNED = not yet built. */
  status: text("status").notNull().default("PLANNED"),
  /** True when a module can be opened ahead of the normal day sequence (Phase 1 demo). */
  isPreview: integer("is_preview", { mode: "boolean" }).notNull().default(false),
  estimatedMinutes: integer("estimated_minutes"),
  sortOrder: integer("sort_order").notNull().default(0),
  contentVersion: integer("content_version").notNull().default(1),
  /** lesson = built-in IMMIX console module · course = imported Titan course module */
  format: text("format").notNull().default("lesson"),
  /** builtin (in this repository) | titan-import (generated from Titan files, never committed) */
  origin: text("origin").notNull().default("builtin"),
  /** Source status from the Titan catalog, e.g. SOURCE_GROUNDED_PENDING_APPROVAL, PARTIAL_SOURCE, NEEDS_SOURCE. */
  contentStatus: text("content_status"),
});

export const competencies = sqliteTable("competencies", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
});

export const moduleCompetencies = sqliteTable(
  "module_competencies",
  {
    moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
    competencyId: text("competency_id").notNull().references(() => competencies.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.moduleId, t.competencyId] })],
);

/* ------------------------------------------------------------------ */
/* Progress, attempts and competency evidence                          */
/* ------------------------------------------------------------------ */

export const moduleProgress = sqliteTable(
  "module_progress",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
    /** NOT_STARTED | IN_PROGRESS | REMEDIATION | PASSED */
    status: text("status").notNull().default("NOT_STARTED"),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    /** Engine state (JSON). Shape defined in src/lib/academy/types.ts (LessonState). */
    stateJson: text("state_json").notNull().default("{}"),
    contentVersion: integer("content_version").notNull().default(1),
    assessmentAttempts: integer("assessment_attempts").notNull().default(0),
    bestScore: integer("best_score"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("module_progress_user_module").on(t.userId, t.moduleId)],
);

/** Every graded answer an operator submits. This is the supervisor's review record. */
export const trainingAttempts = sqliteTable(
  "training_attempts",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    moduleId: text("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
    stepId: text("step_id").notNull(),
    itemId: text("item_id").notNull(),
    stage: text("stage").notNull(),
    /** Which try this was on this item (1 = first try). */
    tryNumber: integer("try_number").notNull(),
    /** For VERIFY attempts: which assessment sitting (1, 2, ...). */
    assessmentAttempt: integer("assessment_attempt"),
    responseJson: text("response_json").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    isCritical: integer("is_critical", { mode: "boolean" }).notNull().default(false),
    misconception: text("misconception"),
    /** Whether the operator had reviewed all required evidence before answering. */
    evidenceComplete: integer("evidence_complete", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("attempts_user_module").on(t.userId, t.moduleId)],
);

export const competencyRecords = sqliteTable(
  "competency_records",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    competencyId: text("competency_id").notNull().references(() => competencies.id, { onDelete: "cascade" }),
    /** NOT_STARTED | LEARNING | ASSISTED | PRACTICING | MASTERY_DEMONSTRATED | REMEDIATION */
    level: text("level").notNull().default("NOT_STARTED"),
    note: text("note"),
    /** Supervisor validation (Day 7) is separate from system-measured level. */
    validatedById: text("validated_by_id").references(() => users.id),
    validatedAt: integer("validated_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("competency_user").on(t.userId, t.competencyId)],
);

/** Append-only history of competency level changes (auditability). */
export const competencyEvents = sqliteTable("competency_events", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  competencyId: text("competency_id").notNull().references(() => competencies.id, { onDelete: "cascade" }),
  fromLevel: text("from_level").notNull(),
  toLevel: text("to_level").notNull(),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

export const supervisorNotes = sqliteTable("supervisor_notes", {
  id: id(),
  traineeId: text("trainee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => users.id),
  /** REMEDIATION | OBSERVATION | COMMENDATION */
  category: text("category").notNull(),
  moduleKey: text("module_key"),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Skill Catalog & Arcade registry                                     */
/* ------------------------------------------------------------------ */

export const skills = sqliteTable("skills", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  /** Module that teaches this skill (LEARN), if built. */
  learnModuleKey: text("learn_module_key"),
  /** Arcade game that practices this skill (PLAY). */
  gameKey: text("game_key"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const arcadeGames = sqliteTable("arcade_games", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  /** PLANNED | AVAILABLE */
  status: text("status").notNull().default("PLANNED"),
  /** Academy module that must be passed before Test mode unlocks. */
  unlockModuleKey: text("unlock_module_key"),
  plannedPhase: integer("planned_phase"),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export const auditLog = sqliteTable("audit_log", {
  id: id(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  detailJson: text("detail_json"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Content decisions (owner rulings on source conflicts)               */
/* ------------------------------------------------------------------ */

/**
 * A ruling on a source conflict from the imported Titan catalog.
 * Append-only: the newest row for a conflict is the current ruling.
 * Stored only in the local database (never in the repository).
 */
export const contentDecisions = sqliteTable("content_decisions", {
  id: id(),
  conflictId: text("conflict_id").notNull(),
  /** A | B | CUSTOM | NOT_APPLICABLE */
  choice: text("choice").notNull(),
  /** The operative rule in plain words, as operators should follow it. */
  ruling: text("ruling").notNull(),
  decidedById: text("decided_by_id").notNull().references(() => users.id),
  createdAt: createdAt(),
});
