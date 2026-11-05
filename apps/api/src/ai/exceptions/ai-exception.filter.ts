import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import { AiException } from "./ai.exception";

@Catch(AiException)
export class AiExceptionFilter implements ExceptionFilter<AiException> {
  catch(error: AiException, host: ArgumentsHost) {
    const guarded = [
      "AI_INPUT_REJECTED",
      "AI_OUTPUT_REJECTED",
      "AI_GUARD_REVIEW_REQUIRED",
    ].includes(error.code);
    const statusCode =
      error.code === "AI_PROVIDER_TIMEOUT"
        ? HttpStatus.GATEWAY_TIMEOUT
        : guarded
          ? HttpStatus.UNPROCESSABLE_ENTITY
          : error.code === "AI_PROVIDER_CONFIG_INVALID" ||
              error.code === "AI_GUARD_FAILED"
            ? HttpStatus.SERVICE_UNAVAILABLE
            : HttpStatus.BAD_GATEWAY;
    const message =
      error.code === "AI_PROVIDER_OUTPUT_TRUNCATED"
        ? "AI 回答未生成完整，请重试或缩小问题范围"
        : error.code === "AI_PROVIDER_TIMEOUT"
          ? "AI 回答超时，请稍后重试"
          : error.code === "AI_PROVIDER_INVALID_RESPONSE"
            ? "AI 暂未返回有效回答，请重试"
            : guarded
              ? "这个问题暂时无法回答，请调整问题后重试"
              : "AI 服务暂时不可用，请稍后重试";
    host
      .switchToHttp()
      .getResponse<{ status(code: number): { json(body: unknown): void } }>()
      .status(statusCode)
      .json({
        statusCode,
        code: error.code,
        message,
        retryable: error.retryable,
      });
  }
}
