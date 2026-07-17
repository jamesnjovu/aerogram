import { z } from "zod";

/**
 * Validated server configuration, loaded from the environment.
 * The process is started with `tsx --env-file=.env`, so process.env is already populated.
 */
const schema = z.object({
  API_ID: z.coerce.number().int().positive(),
  API_HASH: z.string().min(10),
  SESSION_ENC_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "SESSION_ENC_KEY must be 64 hex chars (32 bytes)"),
  JWT_SECRET: z.string().min(16),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  MEDIA_CACHE_DIR: z.string().default("./.cache/media"),
  DATA_DIR: z.string().default("./data"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  console.error(
    `\n[config] Invalid or missing environment variables:\n${issues}\n\n` +
      `Copy apps/server/.env.example to apps/server/.env and fill it in.\n`,
  );
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
