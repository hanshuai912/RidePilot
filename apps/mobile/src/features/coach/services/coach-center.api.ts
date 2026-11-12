import {
  coachOverviewSchema,
  coachSuggestionsSchema,
  coachChatResponseSchema,
  dismissCoachSuggestionResponseSchema,
  type CoachChatInput,
  type DismissCoachSuggestion,
  coachChatHistorySchema,
  coachChatLookupSchema,
  coachChatTurnSchema,
  type SendCoachChat,
} from "@ridepilot/contracts";
import { coachRequest } from "./coach.api";

export const coachCenterApi = {
  chatHistory: (token: string, before?: string) =>
    coachRequest(
      `ai-coach/chat/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
      token,
      coachChatHistorySchema,
    ),
  chatTurn: (token: string, clientMessageId: string) =>
    coachRequest(
      `ai-coach/chat/messages/${encodeURIComponent(clientMessageId)}`,
      token,
      coachChatLookupSchema,
    ).then((response) => response.turn),
  sendChat: (token: string, input: SendCoachChat) =>
    coachRequest("ai-coach/chat/messages", token, coachChatTurnSchema, {
      method: "POST",
      body: input,
      timeoutMs: 90_000,
    }),
  overview: (token: string) =>
    coachRequest("ai-coach/overview", token, coachOverviewSchema),
  suggestions: (token: string) =>
    coachRequest("ai-coach/suggestions", token, coachSuggestionsSchema),
  chat: (token: string, input: CoachChatInput) =>
    coachRequest("ai-coach/chat", token, coachChatResponseSchema, {
      method: "POST",
      body: input,
      timeoutMs: 90_000,
    }),
  dismiss: (token: string, id: string, input: DismissCoachSuggestion) =>
    coachRequest(
      `ai-coach/suggestions/${encodeURIComponent(id)}/dismiss`,
      token,
      dismissCoachSuggestionResponseSchema,
      { method: "POST", body: input },
    ),
};
