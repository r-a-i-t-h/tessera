import { Hono } from "hono";
import type { SessionStore } from "./auth/sessions.js";
import { loadUser, sessionCookieNameForBase } from "./middleware/auth.js";
import { mergeRateLimits, type RateLimitConfig } from "./rate-limit/limits.js";
import { RateLimiter } from "./rate-limit/limiter.js";
import { apiRoutes } from "./routes/api.js";
import { authRoutes } from "./routes/auth.js";
import { mountSpa } from "./spa.js";
import type { UserStore } from "./store/users.js";
import "./context.js";

export function createApp(opts: {
  users: UserStore;
  sessions: SessionStore;
  /** URL prefix with no trailing slash, e.g. "" or "/tessera" */
  assetBase?: string;
  /** Built editor SPA directory (`index.html` + Vite assets). */
  spaDir?: string;
  rateLimiter?: RateLimiter;
  rateLimits?: Partial<RateLimitConfig>;
}) {
  const assetBase = normalizeBase(opts.assetBase ?? "");
  // strict:false so /tessera and /tessera/ both hit the app root under a base path
  const app = assetBase
    ? new Hono({ strict: false }).basePath(assetBase)
    : new Hono({ strict: false });
  const sessionCookieName = sessionCookieNameForBase(assetBase);
  const rateLimiter = opts.rateLimiter ?? new RateLimiter();
  const rateLimits = mergeRateLimits(opts.rateLimits);

  app.use("*", async (c, next) => {
    c.set("users", opts.users);
    c.set("sessions", opts.sessions);
    c.set("assetBase", assetBase);
    c.set("sessionCookieName", sessionCookieName);
    c.set("rateLimiter", rateLimiter);
    c.set("rateLimits", rateLimits);
    await next();
  });

  app.use("*", loadUser);

  app.get("/health", (c) => c.json({ ok: true, name: "tessera-editor-api" }));

  app.route("/auth", authRoutes);
  app.route("/api", apiRoutes);

  if (opts.spaDir) mountSpa(app, opts.spaDir);

  return app;
}

export function normalizeBase(base: string): string {
  if (!base || base === "/") return "";
  return `/${base.replace(/^\/+|\/+$/g, "")}`;
}
