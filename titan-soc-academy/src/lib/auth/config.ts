/**
 * Authentication mode.
 *  - "demo": one-click demonstration accounts for local testing. NOT SECURE.
 *  - "production": demo sign-in is refused. A real identity provider
 *    (planned: Microsoft Entra ID via OpenID Connect) must be configured.
 */
export type AuthMode = "demo" | "production";

export function getAuthMode(): AuthMode {
  return process.env.AUTH_MODE === "demo" ? "demo" : "production";
}

export function isDemoAuth(): boolean {
  return getAuthMode() === "demo";
}
