import { z } from "zod";

// PRD V1.3's proposed test-stage format; the market and exact punctuation set remain configurable decisions.
export const phoneSchema = z.string().regex(/^\d{11}$/, "手机号须为 11 位数字");

function passwordClassCount(password: string): number {
  const characters = Array.from(password);
  const hasUpper = characters.some((char) => /^[A-Z]$/.test(char));
  const hasLower = characters.some((char) => /^[a-z]$/.test(char));
  const hasSpecial = characters.some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code >= 33 && code <= 126 && !/^[A-Za-z0-9]$/.test(char);
  });
  return Number(hasUpper) + Number(hasLower) + Number(hasSpecial);
}

export const passwordSchema = z
  .string()
  .min(6, "密码至少需要 6 个字符")
  .max(1024, "密码过长")
  .describe("至少 6 个字符，且包含大写字母、小写字母、特殊符号中的至少两类")
  .superRefine((password, context) => {
    if (password.length >= 6 && Array.from(password).length < 6) {
      context.addIssue({
        code: "custom",
        message: "密码至少需要 6 个字符",
      });
    }
    if (passwordClassCount(password) < 2) {
      context.addIssue({
        code: "custom",
        message: "密码须包含大写字母、小写字母、特殊符号中的至少两类",
      });
    }
  });

export const registerRequestSchema = z
  .object({
    phone: phoneSchema,
    verificationCode: z.string().regex(/^\d{6}$/, "验证码须为 6 位数字"),
    password: passwordSchema,
    confirmPassword: z.string().max(1024),
  })
  .superRefine((input, context) => {
    if (input.password !== input.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "两次输入的密码不一致",
      });
    }
  });

export const loginRequestSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(1024),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(4096),
});

export const authUserSchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  phoneVerified: z.boolean(),
});

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresInSeconds: z.number().int().positive(),
});

export const authResponseSchema = z.object({
  user: authUserSchema,
  tokens: tokenPairSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
