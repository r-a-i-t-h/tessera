export type UploadLimits = {
  maxFileBytes: number;
  maxFiles: number;
  maxTotalBytes: number;
};

export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  maxFileBytes: 25 * 1024 * 1024,
  maxFiles: 100,
  maxTotalBytes: 100 * 1024 * 1024,
};

export function mergeUploadLimits(
  overrides?: Partial<UploadLimits>,
  env: NodeJS.ProcessEnv = process.env,
): UploadLimits {
  return {
    maxFileBytes: overrides?.maxFileBytes
      ?? envLimit(env, "TESSERA_UPLOAD_MAX_FILE_BYTES", DEFAULT_UPLOAD_LIMITS.maxFileBytes),
    maxFiles: overrides?.maxFiles
      ?? envLimit(env, "TESSERA_UPLOAD_MAX_FILES", DEFAULT_UPLOAD_LIMITS.maxFiles),
    maxTotalBytes: overrides?.maxTotalBytes
      ?? envLimit(env, "TESSERA_UPLOAD_MAX_TOTAL_BYTES", DEFAULT_UPLOAD_LIMITS.maxTotalBytes),
  };
}

function envLimit(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}
