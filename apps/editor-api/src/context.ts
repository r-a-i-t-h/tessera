import type { SessionStore } from "./auth/sessions.js";
import type { RateLimitConfig } from "./rate-limit/limits.js";
import type { RateLimiter } from "./rate-limit/limiter.js";
import type { UserRecord } from "./model.js";
import type { SiteStore } from "./site/store.js";
import type { UserStore } from "./store/users.js";

export type AppVariables = {
  users: UserStore;
  sessions: SessionStore;
  user?: UserRecord;
  site?: SiteStore;
  /** Normalized URL prefix, e.g. "" or "/tessera" */
  assetBase: string;
  /** Cookie name scoped to assetBase so multiple mounts on one domain do not clash */
  sessionCookieName: string;
  rateLimiter: RateLimiter;
  rateLimits: RateLimitConfig;
};

declare module "hono" {
  interface ContextVariableMap extends AppVariables {}
}
