import { HttpException, Injectable } from "@nestjs/common";
import type { SendCoachChat } from "@ridepilot/contracts";
import { AiException } from "../../ai/exceptions/ai.exception";
import { CoachChatService } from "./coach-chat.service";
import { CoachChatRepository, chatTurnResponse } from "./coach-chat.repository";

function safeFailure(error: unknown) {
  if (error instanceof AiException) {
    if (
      [
        "AI_INPUT_REJECTED",
        "AI_OUTPUT_REJECTED",
        "AI_GUARD_REVIEW_REQUIRED",
      ].includes(error.code)
    )
      return "这个问题暂时无法回答，请调整问题后重试";
    if (error.code === "AI_PROVIDER_TIMEOUT") return "AI 回答超时，请稍后重试";
    if (error.code === "AI_PROVIDER_OUTPUT_TRUNCATED")
      return "AI 回答未生成完整，请重试或缩小问题范围";
    return "AI 服务暂时不可用，请稍后重试";
  }
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (
      typeof body === "object" &&
      "code" in body &&
      body.code === "ACTIVE_PLAN_REQUIRED"
    )
      return "请先建立正式训练计划";
  }
  return "回复失败，请稍后重试";
}

@Injectable()
export class CoachChatHistoryService {
  constructor(
    private readonly repository: CoachChatRepository,
    private readonly chat: CoachChatService,
  ) {}

  history(userId: string, before?: string) {
    return this.repository.history(userId, before);
  }

  find(userId: string, clientMessageId: string) {
    return this.repository.find(userId, clientMessageId);
  }

  async send(userId: string, input: SendCoachChat) {
    const { row, claimed } = await this.repository.claim(userId, input);
    if (!claimed) return chatTurnResponse(row);
    let result: { answer: string } | { errorMessage: string };
    try {
      const history = await this.repository.context(userId, row);
      const response = await this.chat.explain(userId, {
        message: input.message,
        history,
      });
      result = { answer: response.answer };
    } catch (error) {
      result = { errorMessage: safeFailure(error) };
    }
    return chatTurnResponse(await this.repository.finish(row, result));
  }
}
