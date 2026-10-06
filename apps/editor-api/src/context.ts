import type { SessionStore } from "./auth/sessions.js";
import type { UploadLimits } from "./config/upload-limits.js";
import type { RateLimitConfig } from "./rate-limit/limits.js";
import type { RateLimiter } from "./rate-limit/limiter.js";
import type { UserRecord } from "./model.js";
import type { SiteStore } from "./site/store.js";
import type { UserStore } from "./store/users.js";

export type AppVariables = {
  users: UserStore;
  sessions: SessionStore;
  user?: UserRecord;
  editor: UserRecord;
  site?: SiteStore;
  requiredSite: SiteStore;
  /** Site directory (`TESSERA_DATA`). Backups archive this tree. */
  siteRoot?: string;
  requiredSiteRoot: string;
  /** Offline dated archives, sibling of the site directory unless `TESSERA_BACKUP` is set. */
  backupDir?: string;
  seedDir?: string;
  /** Skin CSS directory. Set with the preview roots. */
  skinDir?: string;
  rateLimiter: RateLimiter;
  rateLimits: RateLimitConfig;
  uploadLimits: UploadLimits;
};

declare module "hono" {
  interface ContextVariableMap extends AppVariables {}
}
