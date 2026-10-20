import { INestApplication } from "@nestjs/common";
import { env } from "./config/env";
import { configureSwagger } from "./docs/swagger";

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin:
      env.CORS_ALLOWED_ORIGINS.length > 0
        ? env.CORS_ALLOWED_ORIGINS
        : env.NODE_ENV !== "production",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  });

  if (env.SWAGGER_ENABLED) {
    configureSwagger(app);
  }
}
