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
  /** Site directory (`TESSERA_DATA`). Backups archive this tree. */
  siteRoot?: string;
  /** Offline dated archives, sibling of the site directory unless `TESSERA_BACKUP` is set. */
  backupDir?: string;
  seedDir?: string;
  rateLimiter: RateLimiter;
  rateLimits: RateLimitConfig;
};

declare module "hono" {
  interface ContextVariableMap extends AppVariables {}
}
