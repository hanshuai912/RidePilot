import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { env } from "./config/env";
import { configureApp } from "./configure-app";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  configureApp(app);
  app.enableShutdownHooks();
  try {
    await app.listen(env.PORT, "0.0.0.0");
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error
      ? error.message
      : "API 启动失败，请检查依赖服务和环境配置。",
    "Bootstrap",
  );
  process.exitCode = 1;
});
