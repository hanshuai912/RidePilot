import { registerRequestSchema } from "@ridepilot/contracts";

describe("test-stage registration policy", () => {
  const body = (password: string, confirmPassword = password) => ({
    phone: "13812345678",
    verificationCode: "000000",
    password,
    confirmPassword,
  });

  it.each(["ABCabc", "AAA!!!", "aaa!!!", "Ab!123"])(
    "accepts a six-character password with two required classes: %s",
    (password) => {
      expect(registerRequestSchema.safeParse(body(password)).success).toBe(
        true,
      );
    },
  );

  it.each(["123456", "AAAAAA", "aaaaaa", "!!!!!!", "Ab!12"])(
    "rejects a password without the required length or classes: %s",
    (password) => {
      expect(registerRequestSchema.safeParse(body(password)).success).toBe(
        false,
      );
    },
  );

  it("requires the confirmation to match and accepts any six digits", () => {
    expect(
      registerRequestSchema.safeParse(body("Ab!123", "Ab!124")).success,
    ).toBe(false);
    expect(registerRequestSchema.safeParse(body("Ab!123")).success).toBe(true);
    expect(
      registerRequestSchema.safeParse({
        ...body("Ab!123"),
        verificationCode: "999999",
      }).success,
    ).toBe(true);
  });

  it.each(["12345", "1234567", "12a456"])(
    "rejects a malformed test code: %s",
    (verificationCode) => {
      expect(
        registerRequestSchema.safeParse({
          ...body("Ab!123"),
          verificationCode,
        }).success,
      ).toBe(false);
    },
  );
});
