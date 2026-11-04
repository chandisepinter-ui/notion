import type { PermissionKey } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: string; permission?: PermissionKey; exact?: boolean };
export type NavSection = { label: string; items: NavItem[] };

/** Navigation is filtered by PERMISSION, so roles can be reconfigured without code changes. */
export const NAV: NavSection[] = [
  {
    label: "Training",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "home", permission: "academy.access" },
      { href: "/academy", label: "Initial Academy", icon: "route", permission: "academy.access" },
      { href: "/simulator", label: "Simulator", icon: "monitor", permission: "academy.access" },
      { href: "/progress", label: "Progress & Competency", icon: "gauge", permission: "academy.access" },
      { href: "/history", label: "Training History", icon: "history", permission: "academy.access" },
      { href: "/refreshers", label: "Refreshers", icon: "refresh", permission: "academy.access" },
    ],
  },
  {
    label: "Explore",
    items: [
      { href: "/skills", label: "Skill Catalog", icon: "grid", permission: "academy.access" },
      { href: "/arcade", label: "Arcade", icon: "gamepad", permission: "arcade.play" },
      { href: "/reference", label: "Reference Center", icon: "book", permission: "academy.access" },
    ],
  },
  {
    label: "Supervision",
    items: [{ href: "/supervisor", label: "Trainees", icon: "users", permission: "supervisor.trainees.view" }],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin", label: "Overview", icon: "shield", permission: "admin.users.manage", exact: true },
      { href: "/admin/users", label: "Accounts & Roles", icon: "user-cog", permission: "admin.users.manage" },
      { href: "/admin/roles", label: "Permission Matrix", icon: "key", permission: "admin.roles.view" },
      { href: "/admin/curriculum", label: "Curriculum", icon: "layers", permission: "admin.curriculum.view" },
      { href: "/admin/decisions", label: "Content Decisions", icon: "gavel", permission: "content.decide" },
      { href: "/admin/audit", label: "Audit Log", icon: "scroll", permission: "admin.audit.view" },
    ],
  },
  { label: "Account", items: [{ href: "/profile", label: "Profile & Preferences", icon: "settings" }] },
];
