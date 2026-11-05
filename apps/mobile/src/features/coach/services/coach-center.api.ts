import {
  coachOverviewSchema,
  coachSuggestionsSchema,
  coachChatResponseSchema,
  dismissCoachSuggestionResponseSchema,
  type CoachChatInput,
  type DismissCoachSuggestion,
} from "@ridepilot/contracts";
import { coachRequest } from "./coach.api";

export const coachCenterApi = {
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
