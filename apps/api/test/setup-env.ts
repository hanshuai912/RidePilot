process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://test:test@127.0.0.1:5432/test";
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6379";
process.env.SWAGGER_ENABLED = "true";
process.env.JWT_ACCESS_SECRET = "test-access-secret-keep-private-32-chars";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-keep-private-32-chars";
process.env.AUTH_TEST_CODE_ENABLED = "true";
