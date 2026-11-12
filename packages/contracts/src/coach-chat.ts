import { z } from "zod";

export const sendCoachChatSchema = z.strictObject({
  clientMessageId: z
    .string()
    .min(8)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  message: z.string().trim().min(1).max(500),
  expectedVersion: z.number().int().nonnegative().default(0),
});

export const coachChatTurnSchema = z.object({
  id: z.uuid(),
  clientMessageId: z.string(),
  question: z.string(),
  answer: z.string().nullable(),
  status: z.enum(["PROCESSING", "COMPLETED", "FAILED"]),
  version: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  errorMessage: z.string().nullable(),
});

export const coachChatHistoryQuerySchema = z.strictObject({
  before: z.uuid().optional(),
});
export const coachChatHistorySchema = z.object({
  turns: z.array(coachChatTurnSchema),
  nextCursor: z.uuid().nullable(),
});
export const coachChatLookupSchema = z.object({
  turn: coachChatTurnSchema.nullable(),
});

export type SendCoachChat = z.infer<typeof sendCoachChatSchema>;
export type CoachChatTurn = z.infer<typeof coachChatTurnSchema>;
export type CoachChatHistory = z.infer<typeof coachChatHistorySchema>;
