import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { SessionStore } from "./auth/sessions.js";
import { mergeUploadLimits, type UploadLimits } from "./config/upload-limits.js";
import { loadUser } from "./middleware/auth.js";
import { mergeRateLimits, type RateLimitConfig } from "./rate-limit/limits.js";
import { RateLimiter } from "./rate-limit/limiter.js";
import { apiRoutes } from "./routes/api.js";
import { authRoutes } from "./routes/auth.js";
import { backupRoutes } from "./routes/backups.js";
import { recordRoutes } from "./routes/records.js";
import { libraryRoutes } from "./routes/library.js";
import { renderRoutes } from "./routes/render.js";
import { siteRoutes } from "./routes/site.js";
import { stylesheetRoutes } from "./routes/stylesheets.js";
import { userRoutes } from "./routes/users.js";
import type { SiteStore } from "./site/store.js";
import { mountPreview, type PreviewRoots } from "./preview.js";
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
  /**
   * Working snapshot at `/preview/`. Shell HTML is served unchanged;
   * the built runtime, skin, preview data, and library files fill the folder.
   */
  preview?: PreviewRoots;
  backupDir?: string;
  seedDir?: string;
  rateLimiter?: RateLimiter;
  rateLimits?: Partial<RateLimitConfig>;
  uploadLimits?: Partial<UploadLimits>;
}) {
  const app = new Hono({ strict: false });
  const rateLimiter = opts.rateLimiter ?? new RateLimiter();
  const rateLimits = mergeRateLimits(opts.rateLimits);
  const uploadLimits = mergeUploadLimits(opts.uploadLimits);

  app.use("*", async (c, next) => {
    c.set("users", opts.users);
    c.set("sessions", opts.sessions);
    c.set("rateLimiter", rateLimiter);
    c.set("rateLimits", rateLimits);
    c.set("uploadLimits", uploadLimits);
    if (opts.site) c.set("site", opts.site);
    if (opts.siteRoot) c.set("siteRoot", opts.siteRoot);
    if (opts.backupDir) c.set("backupDir", opts.backupDir);
    if (opts.seedDir) c.set("seedDir", opts.seedDir);
    if (opts.preview) c.set("skinDir", opts.preview.skinDir);
    await next();
  });

  app.use("*", loadUser);
  app.use("/api/library/upload", bodyLimit({
    maxSize: uploadLimits.maxTotalBytes,
    onError: (c) => c.json({
      error: `Upload request exceeds the ${uploadLimits.maxTotalBytes}-byte total limit.`,
    }, 413),
  }));

  app.get("/health", (c) => c.json({ ok: true, name: "tessera-editor-api" }));

  app.route("/auth", authRoutes);
  app.route("/api", apiRoutes);
  app.route("/api", recordRoutes);
  app.route("/api", libraryRoutes);
  app.route("/api", renderRoutes);
  app.route("/api", siteRoutes);
  app.route("/api", stylesheetRoutes);
  app.route("/api", backupRoutes);
  app.route("/api", userRoutes);

  if (opts.preview) mountPreview(app, opts.preview);
  if (opts.spaDir) mountSpa(app, opts.spaDir);

  return app;
}
