import { BadRequestException, Injectable } from "@nestjs/common";
import type { CoachChatInput } from "@ridepilot/contracts";
import { AiService } from "../../ai/ai.service";
import { CoachDataService } from "./coach-data.service";
import { SkillLoaderService } from "./skill-loader.service";

@Injectable()
export class CoachChatService {
  constructor(
    private readonly data: CoachDataService,
    private readonly ai: AiService,
    private readonly skills: SkillLoaderService,
  ) {}

  async explain(userId: string, input: CoachChatInput) {
    const plan = await this.data.activePlan(userId);
    if (!plan?.activeVersion)
      throw new BadRequestException({
        code: "ACTIVE_PLAN_REQUIRED",
        message: "请先建立正式训练计划",
      });
    const skill = await this.skills.load("plan-explanation");
    const workouts = plan.activeVersion.workouts
      .map((item) => ({
        date: item.scheduledDate.toISOString().slice(0, 10),
        title: item.title,
        purpose: item.purpose,
        minutes: item.timeTargetMin ? Number(item.timeTargetMin) : null,
      }))
      .slice(0, 14);
    const response = await this.ai.generate({
      temperature: 0.2,
      maxTokens: 600,
      metadata: { feature: "coach-explanation", skillHash: skill.hash },
      messages: [
        {
          role: "system",
          content:
            "You explain the authenticated user's cycling plan in Simplified Chinese. You cannot modify data or apply proposals. If asked for a change, direct the user to the structured adjustment flow. Avoid medical diagnosis.",
        },
        { role: "system", content: skill.content },
        {
          role: "user",
          content: JSON.stringify({
            question: input.message,
            planVersion: plan.activeVersion.versionNo,
            workouts,
          }),
        },
      ],
    });
    return {
      answer: response.text,
      requestId: response.requestId,
      model: response.model,
      readOnly: true as const,
    };
  }
}
