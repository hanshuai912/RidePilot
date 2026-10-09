import { INestApplication } from "@nestjs/common";
import { env } from "./config/env";
import { configureSwagger } from "./docs/swagger";

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api/v1");

  if (env.SWAGGER_ENABLED) {
    configureSwagger(app);
  }
}
