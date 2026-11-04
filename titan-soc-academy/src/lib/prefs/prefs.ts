export const PREF_COOKIES = { theme: "titan-theme", text: "titan-text", motion: "titan-motion" } as const;
export const THEMES = ["system", "light", "dark"] as const;
export const TEXT_SIZES = ["standard", "large"] as const;
export const MOTIONS = ["system", "reduced", "full"] as const;
export type ThemePref = (typeof THEMES)[number];
export type TextPref = (typeof TEXT_SIZES)[number];
export type MotionPref = (typeof MOTIONS)[number];

export function pick<T extends readonly string[]>(list: T, v: string | undefined, fallback: T[number]): T[number] {
  return v && (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}
