const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");

const apiRoot = path.resolve(__dirname, "..");
const envFile = path.join(apiRoot, ".env.test");

if (!fs.existsSync(envFile)) {
  throw new Error("Create apps/api/.env.test from .env.test.example first");
}

const config = dotenv.parse(fs.readFileSync(envFile));
const databaseUrl = new URL(config.TEST_DATABASE_URL);
const redisUrl = new URL(config.TEST_REDIS_URL);

if (
  !["127.0.0.1", "localhost"].includes(databaseUrl.hostname) ||
  !databaseUrl.pathname.endsWith("_test") ||
  !["127.0.0.1", "localhost"].includes(redisUrl.hostname) ||
  redisUrl.pathname !== "/1"
) {
  throw new Error(
    "Integration tests require local *_test PostgreSQL and Redis DB 1",
  );
}

const environment = {
  ...process.env,
  TEST_DATABASE_URL: config.TEST_DATABASE_URL,
  TEST_REDIS_URL: config.TEST_REDIS_URL,
  DATABASE_URL: config.TEST_DATABASE_URL,
};

for (const args of [["db:deploy"], ["test"]]) {
  const result = spawnSync("pnpm", args, {
    cwd: apiRoot,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
