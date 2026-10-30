import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
    REDIS_URL: z.string().regex(/^rediss?:\/\//),
    SWAGGER_ENABLED: z.stringbool().optional(),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32)
      .refine((value) => !value.startsWith("replace-with")),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32)
      .refine((value) => !value.startsWith("replace-with")),
    AUTH_TEST_CODE_ENABLED: z.stringbool().optional(),
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    AI_PROVIDER: z.enum(["openai-compatible"]).default("openai-compatible"),
    AI_BASE_URL: z.string().url().optional(),
    AI_API_KEY: z.string().min(1).optional(),
    AI_MODEL: z.string().min(1).optional(),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
    AI_GUARD_MODE: z.enum(["noop"]).default("noop"),
    COROS_MCP_URL: z.string().url().default("https://mcp.coros.com/mcp"),
    COROS_OAUTH_SCOPE: z.string().default("openid offline_access mcp.tools"),
    COROS_OAUTH_REDIRECT_URI: z
      .string()
      .url()
      .default(
        "http://localhost:3000/api/v1/integrations/oauth/callback/coros",
      ),
    INTEGRATION_APP_REDIRECT_URI: z
      .string()
      .min(1)
      .default("ridepilot://coros-callback"),
    MCP_TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  })
  .superRefine((input, context) => {
    if (input.JWT_ACCESS_SECRET === input.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "Refresh secret must differ from access secret",
      });
    }

    if (input.NODE_ENV === "production") {
      if (!input.AI_BASE_URL) {
        context.addIssue({
          code: "custom",
          path: ["AI_BASE_URL"],
          message: "AI_BASE_URL is required in production",
        });
      }
      if (!input.AI_API_KEY) {
        context.addIssue({
          code: "custom",
          path: ["AI_API_KEY"],
          message: "AI_API_KEY is required in production",
        });
      }
      if (!input.AI_MODEL) {
        context.addIssue({
          code: "custom",
          path: ["AI_MODEL"],
          message: "AI_MODEL is required in production",
        });
      }
      if (input.AI_GUARD_MODE === "noop") {
        context.addIssue({
          code: "custom",
          path: ["AI_GUARD_MODE"],
          message: "NoopGuard is not allowed in production",
        });
      }
      if (!input.MCP_TOKEN_ENCRYPTION_KEY) {
        context.addIssue({
          code: "custom",
          path: ["MCP_TOKEN_ENCRYPTION_KEY"],
          message: "MCP_TOKEN_ENCRYPTION_KEY is required in production",
        });
      }
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const names = result.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");
  throw new Error(`Invalid environment variables: ${names}`);
}

export const env = {
  ...result.data,
  CORS_ALLOWED_ORIGINS: (result.data.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  SWAGGER_ENABLED:
    result.data.SWAGGER_ENABLED ?? result.data.NODE_ENV !== "production",
  AUTH_TEST_CODE_ENABLED:
    result.data.AUTH_TEST_CODE_ENABLED ?? result.data.NODE_ENV !== "production",
};
