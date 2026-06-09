import { z } from "zod";

const testStorageEnv = {
  MAX_IMAGE_BYTES: "5242880",
  S3_ACCESS_KEY_ID: "test-access-key-id",
  S3_BUCKET: "test-task-images",
  S3_ENDPOINT: "https://s3.test.invalid",
  S3_PUBLIC_BASE_URL: "https://cdn.test.invalid/test-task-images",
  S3_REGION: "test",
  S3_SECRET_ACCESS_KEY: "test-secret-access-key",
};

const envSchema = z.object({
  CLIENT_DIST_PATH: z.string().trim().optional(),
  DATABASE_URL: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must use a PostgreSQL connection string"
    ),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  MAX_IMAGE_BYTES: z.coerce.number().int().positive(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  S3_ACCESS_KEY_ID: z.string().trim().min(1),
  S3_BUCKET: z.string().trim().min(1),
  S3_ENDPOINT: z.string().trim().url(),
  S3_PUBLIC_BASE_URL: z.string().trim().url(),
  S3_REGION: z.string().trim().min(1),
  S3_SECRET_ACCESS_KEY: z.string().trim().min(1),
});

const envSource =
  process.env.NODE_ENV === "test" ? { ...testStorageEnv, ...process.env } : process.env;

const parsedEnv = envSchema.safeParse(envSource);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsedEnv.data;
export type Env = typeof env;
