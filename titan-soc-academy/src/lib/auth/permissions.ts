/**
 * Permission catalogue. Code checks PERMISSIONS, never role names or people.
 * Which roles hold which permissions is stored in the database (role_permissions)
 * and can be changed without touching code. The defaults below are only the
 * starting configuration written by the seed script.
 */
export const PERMISSIONS = {
  ACADEMY_ACCESS: "academy.access",
  ACADEMY_PREVIEW_ALL: "academy.preview_all",
  ARCADE_PLAY: "arcade.play",
  REFERENCE_ACCESS_ANYTIME: "reference.access_anytime",
  SUPERVISOR_TRAINEES_VIEW: "supervisor.trainees.view",
  SUPERVISOR_TRAINEES_VIEW_ALL: "supervisor.trainees.view_all",
  SUPERVISOR_NOTES_WRITE: "supervisor.notes.write",
  SUPERVISOR_GRADUATION_APPROVE: "supervisor.graduation.approve",
  ADMIN_USERS_MANAGE: "admin.users.manage",
  ADMIN_ROLES_VIEW: "admin.roles.view",
  ADMIN_CURRICULUM_VIEW: "admin.curriculum.view",
  ADMIN_AUDIT_VIEW: "admin.audit.view",
  CONTENT_DECIDE: "content.decide",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DEFINITIONS: { key: PermissionKey; category: string; description: string }[] = [
  { key: PERMISSIONS.ACADEMY_ACCESS, category: "Training", description: "Take Academy modules and see personal progress." },
  { key: PERMISSIONS.ACADEMY_PREVIEW_ALL, category: "Training", description: "Open any Academy module without completing earlier ones (preview)." },
  { key: PERMISSIONS.ARCADE_PLAY, category: "Training", description: "Open the Arcade (games available as they are released)." },
  { key: PERMISSIONS.REFERENCE_ACCESS_ANYTIME, category: "Training", description: "Open the Reference Center without graduating first." },
  { key: PERMISSIONS.SUPERVISOR_TRAINEES_VIEW, category: "Supervision", description: "View progress and answers of assigned trainees." },
  { key: PERMISSIONS.SUPERVISOR_TRAINEES_VIEW_ALL, category: "Supervision", description: "View every trainee, not just assigned ones." },
  { key: PERMISSIONS.SUPERVISOR_NOTES_WRITE, category: "Supervision", description: "Record remediation, observation and commendation notes." },
  { key: PERMISSIONS.SUPERVISOR_GRADUATION_APPROVE, category: "Supervision", description: "Conduct Day 7 evaluation and approve graduation (feature planned)." },
  { key: PERMISSIONS.ADMIN_USERS_MANAGE, category: "Administration", description: "View accounts and change role assignments." },
  { key: PERMISSIONS.ADMIN_ROLES_VIEW, category: "Administration", description: "View roles and the permission matrix." },
  { key: PERMISSIONS.ADMIN_CURRICULUM_VIEW, category: "Administration", description: "View curriculum, scenarios and items pending SME approval." },
  { key: PERMISSIONS.CONTENT_DECIDE, category: "Administration", description: "Rule on source conflicts in the training content (decisions are shown to operators)." },
  { key: PERMISSIONS.ADMIN_AUDIT_VIEW, category: "Administration", description: "View the administrative audit log." },
];

export const ROLE_DEFINITIONS: {
  key: string;
  name: string;
  description: string;
  rank: number;
  permissions: PermissionKey[];
}[] = [
  {
    key: "OPERATOR",
    name: "Operator",
    description: "SOC dispatch operator. Completes Academy training and refreshers.",
    rank: 10,
    permissions: [PERMISSIONS.ACADEMY_ACCESS, PERMISSIONS.ARCADE_PLAY],
  },
  {
    key: "SUPERVISOR",
    name: "Supervisor",
    description: "Monitors assigned trainees, reviews answers, documents remediation, conducts Day 7.",
    rank: 20,
    permissions: [
      PERMISSIONS.ACADEMY_ACCESS,
      PERMISSIONS.ARCADE_PLAY,
      PERMISSIONS.REFERENCE_ACCESS_ANYTIME,
      PERMISSIONS.ACADEMY_PREVIEW_ALL,
      PERMISSIONS.SUPERVISOR_TRAINEES_VIEW,
      PERMISSIONS.SUPERVISOR_NOTES_WRITE,
      PERMISSIONS.SUPERVISOR_GRADUATION_APPROVE,
    ],
  },
  {
    key: "SENIOR_SUPERVISOR",
    name: "Senior Supervisor",
    description: "Supervisor oversight across every trainee and shift.",
    rank: 30,
    permissions: [
      PERMISSIONS.ACADEMY_ACCESS,
      PERMISSIONS.ARCADE_PLAY,
      PERMISSIONS.REFERENCE_ACCESS_ANYTIME,
      PERMISSIONS.ACADEMY_PREVIEW_ALL,
      PERMISSIONS.SUPERVISOR_TRAINEES_VIEW,
      PERMISSIONS.SUPERVISOR_TRAINEES_VIEW_ALL,
      PERMISSIONS.SUPERVISOR_NOTES_WRITE,
      PERMISSIONS.SUPERVISOR_GRADUATION_APPROVE,
    ],
  },
  {
    key: "ADMINISTRATOR",
    name: "Administrator",
    description: "Manages accounts, role assignments, curriculum and oversight.",
    rank: 40,
    permissions: [
      PERMISSIONS.ACADEMY_ACCESS,
      PERMISSIONS.ARCADE_PLAY,
      PERMISSIONS.REFERENCE_ACCESS_ANYTIME,
      PERMISSIONS.ACADEMY_PREVIEW_ALL,
      PERMISSIONS.SUPERVISOR_TRAINEES_VIEW,
      PERMISSIONS.SUPERVISOR_TRAINEES_VIEW_ALL,
      PERMISSIONS.ADMIN_USERS_MANAGE,
      PERMISSIONS.ADMIN_ROLES_VIEW,
      PERMISSIONS.ADMIN_CURRICULUM_VIEW,
      PERMISSIONS.ADMIN_AUDIT_VIEW,
      PERMISSIONS.CONTENT_DECIDE,
    ],
  },
];
