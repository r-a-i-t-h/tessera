import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { apiError } from "../http.js";
import { clientIp } from "../rate-limit/client-ip.js";
import type { RateLimitBucket, RateLimitConfig } from "../rate-limit/limits.js";
import type { RateLimitResult } from "../rate-limit/limiter.js";

export function rateLimit(opts: {
  name: string;
  bucket: (limits: RateLimitConfig) => RateLimitBucket;
  key: (c: Context) => string | string[] | Promise<string | string[]>;
}) {
  return createMiddleware(async (c, next) => {
    const limiter = c.get("rateLimiter");
    const bucket = opts.bucket(c.get("rateLimits"));
    const raw = await opts.key(c);
    const keys = (Array.isArray(raw) ? raw : [raw]).filter((k) => k.length > 0);

    let blocked: RateLimitResult | undefined;
    for (const key of keys) {
      const result = limiter.hit(`${opts.name}:${key}`, bucket.max, bucket.windowMs);
      if (!result.ok) blocked = result;
    }

    if (blocked) {
      const retryAfter = Math.max(1, Math.ceil((blocked.resetAt - Date.now()) / 1000));
      c.header("Retry-After", String(retryAfter));
      return apiError(c, 429, "Too many requests. Try again later.");
    }

    await next();
  });
}

export { clientIp };
