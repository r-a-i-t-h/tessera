import { Hono } from "hono";
import type { SessionStore } from "./auth/sessions.js";
import { loadUser } from "./middleware/auth.js";
import { mergeRateLimits, type RateLimitConfig } from "./rate-limit/limits.js";
import { RateLimiter } from "./rate-limit/limiter.js";
import { apiRoutes } from "./routes/api.js";
import { authRoutes } from "./routes/auth.js";
import { backupRoutes } from "./routes/backups.js";
import { recordRoutes } from "./routes/records.js";
import { renderRoutes } from "./routes/render.js";
import type { SiteStore } from "./site/store.js";
import { mountSpa } from "./spa.js";
import type { UserStore } from "./store/users.js";
import "./context.js";

export function createApp(opts: {
  users: UserStore;
  sessions: SessionStore;
  /** Built editor SPA directory (`index.html` + Vite assets). */
  spaDir?: string;
  /** File-backed site records (YAML). */
  site?: SiteStore;
  siteRoot?: string;
  backupDir?: string;
  seedDir?: string;
  rateLimiter?: RateLimiter;
  rateLimits?: Partial<RateLimitConfig>;
}) {
  const app = new Hono({ strict: false });
  const rateLimiter = opts.rateLimiter ?? new RateLimiter();
  const rateLimits = mergeRateLimits(opts.rateLimits);

  app.use("*", async (c, next) => {
    c.set("users", opts.users);
    c.set("sessions", opts.sessions);
    c.set("rateLimiter", rateLimiter);
    c.set("rateLimits", rateLimits);
    if (opts.site) c.set("site", opts.site);
    if (opts.siteRoot) c.set("siteRoot", opts.siteRoot);
    if (opts.backupDir) c.set("backupDir", opts.backupDir);
    if (opts.seedDir) c.set("seedDir", opts.seedDir);
    await next();
  });

  app.use("*", loadUser);

  app.get("/health", (c) => c.json({ ok: true, name: "tessera-editor-api" }));

  app.route("/auth", authRoutes);
  app.route("/api", apiRoutes);
  app.route("/api", recordRoutes);
  app.route("/api", renderRoutes);
  app.route("/api", backupRoutes);

  if (opts.spaDir) mountSpa(app, opts.spaDir);

  return app;
}
