import { RedisService } from "../src/infra/redis/redis.service";
import { AuthRateLimitService } from "../src/modules/auth/auth-rate-limit.service";

describe("authentication rate limit dependency", () => {
  it("fails closed with a stable error when Redis is unavailable", async () => {
    const redis = {
      incrementWithExpiry: jest
        .fn()
        .mockRejectedValue(new Error("secret redis URL")),
    } as unknown as RedisService;
    const service = new AuthRateLimitService(redis);

    await expect(
      service.check("login", "13812345678", "127.0.0.1"),
    ).rejects.toMatchObject({
      status: 503,
      response: {
        code: "AUTH_RATE_LIMIT_UNAVAILABLE",
      },
    });
  });
});
