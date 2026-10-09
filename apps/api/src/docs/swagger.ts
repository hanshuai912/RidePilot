import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("RidePilot API")
    .setDescription("RidePilot 服务端 API")
    .setVersion("1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "access-token",
    )
    .build();

  SwaggerModule.setup(
    "api/docs",
    app,
    () => SwaggerModule.createDocument(app, config),
    { jsonDocumentUrl: "api/docs-json" },
  );
}
