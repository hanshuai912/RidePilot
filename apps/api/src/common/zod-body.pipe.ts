import { BadRequestException, PipeTransform } from "@nestjs/common";
import { z } from "zod";

export class ZodBodyPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "请求参数无效",
      fields: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
}
