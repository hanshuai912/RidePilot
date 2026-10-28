import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApplyProposal,
  AiProposalResponse,
  CalendarResponse,
  CreateManualWorkoutProposal,
  EditWorkoutProposal,
  ProposalResponse,
  RestoreProposalResponse,
  UpdateProposal,
} from "@ridepilot/contracts";
import { randomUUID } from "node:crypto";
import { TrainingApplicationService } from "./training-application.service";
import type { DraftPayload } from "./training.types";
import { toDraft, toSummary, toProposalResponse } from "./training.mapper";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TrainingRepository } from "./training.repository";
import { CoachProposalService } from "../coach/coach-proposal.service";
import { PlanRestoreService } from "../coach/plan-restore.service";
import {
  assertEditableDate,
  assertPlanVersion,
  dateToDb,
  dbToDate,
  validateDraft,
} from "./training.validation";

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: TrainingRepository,
    private readonly application: TrainingApplicationService,
    private readonly coachProposals: CoachProposalService,
    private readonly restore: PlanRestoreService,
  ) {}

  async createManualProposal(
    userId: string,
    input: CreateManualWorkoutProposal,
  ): Promise<ProposalResponse> {
    const plan = await this.repository.findActivePlan(userId);
    const timezone = await this.userTimezone(userId);
    assertEditableDate(input.scheduledDate, timezone);
    const hasFtp = await this.hasFtp(userId);
    const totals = validateDraft(input, hasFtp);
    const dayOrder =
      Math.max(
        0,
        ...(plan?.activeVersion?.workouts ?? [])
          .filter((w) => dbToDate(w.scheduledDate) === input.scheduledDate)
          .map((w) => w.dayOrder),
      ) + 1;
    const draft: DraftPayload = { ...input, id: randomUUID(), dayOrder };
    const proposal = await this.prisma.changeProposal.create({
      data: {
        userId,
        baseVersionId: plan?.activeVersion?.id ?? null,
        proposalType: "MANUAL_WORKOUT_CREATE",
        draft: { ...draft, ...totals },
      },
    });
    return toProposalResponse(
      proposal,
      null,
      draft,
      plan?.activeVersion?.versionNo ?? 0,
    );
  }

  async createEditProposal(
    userId: string,
    workoutId: string,
    input: EditWorkoutProposal,
  ): Promise<ProposalResponse> {
    const workout = await this.repository.findWorkout(userId, workoutId);
    if (
      !workout ||
      workout.planVersion.plan.activeVersionId !== workout.planVersionId
    )
      throw new NotFoundException({
        code: "WORKOUT_NOT_FOUND",
        message: "训练课程不存在",
      });
    const timezone = await this.userTimezone(userId);
    assertEditableDate(dbToDate(workout.scheduledDate), timezone);
    assertPlanVersion(input.expectedPlanVersion, workout.planVersion.versionNo);
    const hasFtp = await this.hasFtp(userId);
    const totals = validateDraft(input, hasFtp);
    const draft: DraftPayload = {
      ...input,
      id: workout.id,
      dayOrder: workout.dayOrder,
    };
    const original = toDraft(workout);
    const proposal = await this.prisma.changeProposal.create({
      data: {
        userId,
        baseVersionId: workout.planVersionId,
        proposalType: "MANUAL_WORKOUT_EDIT",
        targetWorkoutId: workout.id,
        draft: { ...draft, ...totals },
        original,
      },
    });
    return toProposalResponse(
      proposal,
      original,
      draft,
      workout.planVersion.versionNo,
    );
  }

  async getProposal(
    userId: string,
    proposalId: string,
  ): Promise<ProposalResponse | AiProposalResponse | RestoreProposalResponse> {
    const proposal = await this.repository.findProposal(userId, proposalId);
    if (!proposal)
      throw new NotFoundException({
        code: "PROPOSAL_NOT_FOUND",
        message: "训练变更草稿不存在",
      });
    if (this.coachProposals.isAiProposal(proposal.proposalType))
      return this.coachProposals.get(userId, proposalId);
    if (proposal.proposalType === "PLAN_RESTORE")
      return this.restore.get(userId, proposalId);
    return toProposalResponse(
      proposal,
      proposal.original,
      proposal.draft as unknown as DraftPayload,
      await this.versionNumber(proposal.baseVersionId),
    );
  }

  async updateProposal(
    userId: string,
    proposalId: string,
    input: UpdateProposal,
  ): Promise<ProposalResponse> {
    const proposal = await this.repository.findProposal(userId, proposalId);
    if (!proposal)
      throw new NotFoundException({
        code: "PROPOSAL_NOT_FOUND",
        message: "训练变更草稿不存在",
      });
    if (this.coachProposals.isAiProposal(proposal.proposalType))
      throw new BadRequestException({
        code: "AI_PROPOSAL_EDIT_ROUTE_REQUIRED",
        message: "请使用 AI 提案编辑接口",
      });
    if (proposal.proposalType === "PLAN_RESTORE")
      throw new BadRequestException({
        code: "PROPOSAL_NOT_EDITABLE",
        message: "恢复提案不可编辑",
      });
    if (!["DRAFT", "BLOCKED", "READY"].includes(proposal.status))
      throw new ConflictException({
        code: "PROPOSAL_NOT_EDITABLE",
        message: "当前草稿状态不可编辑",
      });
    if (proposal.proposalVersion !== input.expectedProposalVersion)
      throw new ConflictException({
        code: "PROPOSAL_VERSION_CONFLICT",
        message: "草稿已被其他请求修改，请重新读取",
      });
    const hasFtp = await this.hasFtp(userId);
    assertEditableDate(
      input.draft.scheduledDate,
      await this.userTimezone(userId),
    );
    const totals = validateDraft(input.draft, hasFtp);
    const current = proposal.draft as unknown as DraftPayload;
    const draft: DraftPayload = {
      ...input.draft,
      id: current.id,
      dayOrder: current.dayOrder,
    };
    const updated = await this.prisma.changeProposal.updateMany({
      where: {
        id: proposalId,
        userId,
        proposalVersion: input.expectedProposalVersion,
        status: { in: ["DRAFT", "BLOCKED", "READY"] },
      },
      data: {
        draft: { ...draft, ...totals },
        proposalVersion: { increment: 1 },
        status: "DRAFT",
        validationPassed: null,
        validationWarnings: [],
        validationBlockers: [],
      },
    });
    if (updated.count !== 1)
      throw new ConflictException({
        code: "PROPOSAL_VERSION_CONFLICT",
        message: "草稿已被其他请求修改，请重新读取",
      });
    return this.getProposal(userId, proposalId) as Promise<ProposalResponse>;
  }

  async validateProposal(
    userId: string,
    proposalId: string,
  ): Promise<ProposalResponse | AiProposalResponse | RestoreProposalResponse> {
    const proposal = await this.repository.findProposal(userId, proposalId);
    if (!proposal)
      throw new NotFoundException({
        code: "PROPOSAL_NOT_FOUND",
        message: "训练变更草稿不存在",
      });
    if (this.coachProposals.isAiProposal(proposal.proposalType))
      return this.coachProposals.validate(userId, proposalId);
    if (proposal.proposalType === "PLAN_RESTORE")
      return this.restore.validate(userId, proposalId);
    if (!["DRAFT", "BLOCKED", "READY"].includes(proposal.status))
      throw new ConflictException({
        code: "PROPOSAL_NOT_EDITABLE",
        message: "当前草稿状态不可校验",
      });
    const draft = proposal.draft as unknown as DraftPayload;
    const blockers: string[] = [];
    try {
      assertEditableDate(draft.scheduledDate, await this.userTimezone(userId));
      validateDraft(draft, await this.hasFtp(userId));
    } catch (error) {
      if (!(
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ))
        throw error;
      blockers.push(error.message);
    }
    const updated = await this.prisma.changeProposal.updateMany({
      where: {
        id: proposalId,
        userId,
        proposalVersion: proposal.proposalVersion,
        status: { in: ["DRAFT", "BLOCKED", "READY"] },
      },
      data: {
        status: blockers.length ? "BLOCKED" : "READY",
        validationPassed: blockers.length === 0,
        validationWarnings: [],
        validationBlockers: blockers,
      },
    });
    if (updated.count !== 1)
      throw new ConflictException({
        code: "PROPOSAL_VERSION_CONFLICT",
        message: "草稿已被其他请求修改，请重新读取",
      });
    return this.getProposal(userId, proposalId);
  }

  async applyProposal(
    userId: string,
    proposalId: string,
    input: ApplyProposal,
    idempotencyKey: string,
  ): Promise<unknown> {
    return this.application.applyProposal(
      userId,
      proposalId,
      input,
      idempotencyKey,
    );
  }

  async getWorkout(userId: string, workoutId: string) {
    const workout = await this.repository.findWorkout(userId, workoutId);
    if (!workout)
      throw new NotFoundException({
        code: "WORKOUT_NOT_FOUND",
        message: "训练课程不存在",
      });
    return toSummary(workout);
  }

  async getCalendar(
    userId: string,
    from: string,
    to: string,
  ): Promise<CalendarResponse> {
    const items = await this.repository.findCalendar(
      userId,
      dateToDb(from),
      dateToDb(to),
    );
    const [timezone, recordedWorkoutIds] = await Promise.all([
      this.userTimezone(userId),
      this.repository.findRecordedWorkoutIds(
        userId,
        items.map((item) => item.id),
      ),
    ]);
    const currentDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const recordedIds = new Set(recordedWorkoutIds);
    return {
      from,
      to,
      ftpAvailable: await this.hasFtp(userId),
      items: items.map((item) =>
        toSummary({
          ...item,
          editable:
            dbToDate(item.scheduledDate) >= currentDate &&
            !recordedIds.has(item.id),
        }),
      ),
    };
  }

  private async hasFtp(userId: string): Promise<boolean> {
    const value = await this.prisma.abilityMeasurement.findFirst({
      where: { userId, metricType: "FTP", unit: "W" },
      orderBy: { measuredAt: "desc" },
    });
    return Boolean(value && Number(value.value) > 0);
  }

  private async userTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return user?.timezone ?? "UTC";
  }

  private async versionNumber(id: string | null): Promise<number> {
    if (id === null) return 0;
    const version = await this.prisma.planVersion.findUnique({
      where: { id },
      select: { versionNo: true },
    });
    return version?.versionNo ?? 1;
  }
}
