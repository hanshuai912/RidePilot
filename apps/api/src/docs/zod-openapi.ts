import { SchemaObject } from "@nestjs/swagger";
import { z } from "zod";

export function toOpenApiSchema(
  schema: z.ZodType,
  io: "input" | "output" = "output",
): SchemaObject {
  // Zod's generic JSON Schema type includes variants outside the OpenAPI 3.0 target.
  return z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io,
  }) as unknown as SchemaObject;
}
