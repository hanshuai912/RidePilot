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
  })
  .superRefine((input, context) => {
    if (input.JWT_ACCESS_SECRET === input.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "Refresh secret must differ from access secret",
      });
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
  SWAGGER_ENABLED:
    result.data.SWAGGER_ENABLED ?? result.data.NODE_ENV !== "production",
  AUTH_TEST_CODE_ENABLED:
    result.data.AUTH_TEST_CODE_ENABLED ?? result.data.NODE_ENV !== "production",
};
