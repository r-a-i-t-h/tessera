export type RateLimitBucket = {
  max: number;
  windowMs: number;
};

export type RateLimitConfig = {
  auth: RateLimitBucket;
};

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  auth: { max: 5, windowMs: 15 * 60 * 1000 },
};

export function mergeRateLimits(overrides?: Partial<RateLimitConfig>): RateLimitConfig {
  return {
    auth: { ...DEFAULT_RATE_LIMITS.auth, ...overrides?.auth },
  };
}
