import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  goalInputSchema,
  type AiProposalResponse,
  type AvailabilityInput,
  type ProfileResponse,
  type WeekGenerationInput,
} from "@ridepilot/contracts";

import { useAuth } from "../../auth/hooks/AuthProvider";
import { getProfile, patchProfile } from "../../profile/services/profile.api";
import { trainingApi } from "../../training/services/training.api";
import { addDays, localDateInTimezone, nextMonday } from "../model/plan-dates";
import { firstMissingStep, missingTrainingData } from "../model/readiness";
import { coachApi, type CoachPlanStatus } from "../services/coach.api";
import { waitForCoachProposal } from "../services/generation-task";
import {
  resolveAdjustmentScope,
  type AdjustmentScope,
  type PlanningScope,
} from "../services/adjustment-scope";
import type { Experience, GoalType } from "../components/InitialPlanSteps";

export type { PlanningScope } from "../services/adjustment-scope";

export type InitialPlanStage =
  | "entry"
  | "planning"
  | "basics"
  | "goal"
  | "schedule"
  | "nutrition"
  | "loading"
  | "proposals"
  | "diff"
  | "preview"
  | "success";

export type CoachTask = "REPLAN" | "RECOVERY" | "RACE";

type Resources = {
  profile: ProfileResponse;
  ftpWatts: number | null;
  availability: Awaited<ReturnType<typeof coachApi.availability>>;
  goals: Awaited<ReturnType<typeof coachApi.goals>>;
  readiness: Awaited<ReturnType<typeof coachApi.readiness>>;
  planStatus: CoachPlanStatus;
};

function key() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function useInitialPlan() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [resources, setResources] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<InitialPlanStage>("entry");
  const [task, setTask] = useState<CoachTask | null>(null);
  const [planningScope, setPlanningScope] =
    useState<PlanningScope>("NEXT_WEEK");
  const [taskNote, setTaskNote] = useState("");
  const [returnStage, setReturnStage] = useState<"planning" | null>(null);
  const [experience, setExperience] = useState<Experience>("BEGINNER");
  const [goalType, setGoalType] = useState<GoalType>("ENDURANCE");
  const [goalDate, setGoalDate] = useState("");
  const [targetWkg, setTargetWkg] = useState("");
  const [goalNote, setGoalNote] = useState("");
  const [cycleWeeks, setCycleWeeks] = useState(8);
  const [days, setDays] = useState<number[]>([2, 4, 6]);
  const [minutes, setMinutes] = useState(60);
  const [bodyStatus, setBodyStatus] = useState<"READY" | "TIRED" | "RECOVERY">(
    "READY",
  );
  const [bodyNote, setBodyNote] = useState("");
  const [symptomFlags, setSymptomFlags] = useState<
    ("CHEST_PAIN" | "FAINTING" | "SEVERE_ILLNESS")[]
  >([]);
  const [restriction, setRestriction] = useState("无特殊限制");
  const [restrictionNote, setRestrictionNote] = useState("");
  const [meal, setMeal] = useState("家常饮食");
  const [jobStatus, setJobStatus] = useState<"QUEUED" | "RUNNING" | "FAILED">(
    "QUEUED",
  );
  const [proposal, setProposal] = useState<AiProposalResponse | null>(null);
  const [appliedDates, setAppliedDates] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const initialized = useRef(false);
  const operation = useRef(0);
  const applyKey = useRef<string | null>(null);
  const generationRequest = useRef<{
    mode: WeekGenerationInput["mode"];
    weekStartDate?: string;
    targetWorkoutId?: string;
    expectedPlanVersion?: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [profile, ftp, availability, goals, readiness, planStatus] =
      await Promise.all([
        getProfile(token),
        coachApi.ftp(token),
        coachApi.availability(token),
        coachApi.goals(token),
        coachApi.readiness(token),
        coachApi.planStatus(token),
      ]);
    const next: Resources = {
      profile,
      ftpWatts: ftp?.valueWatts ?? null,
      availability,
      goals,
      readiness,
      planStatus,
    };
    setResources(next);
    if (!initialized.current) {
      initialized.current = true;
      setExperience(profile.experienceLevel ?? "BEGINNER");
      const activeGoal =
        goals.find(
          (goal) => goal.status === "ACTIVE" && goal.priority === "PRIMARY",
        ) ?? goals.find((goal) => goal.status === "ACTIVE");
      if (activeGoal) {
        setGoalType(
          activeGoal.type === "FTP" || activeGoal.type === "RACE"
            ? activeGoal.type
            : "ENDURANCE",
        );
        setGoalDate(activeGoal.targetDate);
        setTargetWkg(activeGoal.targetWkg?.toString() ?? "");
        setGoalNote(activeGoal.description ?? "");
      } else {
        setGoalDate(
          addDays(localDateInTimezone(new Date(), profile.timezone), 84),
        );
      }
      if (availability) {
        setDays(availability.weekdays.map((slot) => slot.weekday));
        setMinutes(availability.maxSessionMinutes);
      }
    }
    return next;
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void refresh()
        .catch((cause: unknown) => {
          if (active) setError(errorMessage(cause, "读取 AI 教练资料失败"));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [refresh]),
  );

  useEffect(
    () => () => {
      operation.current += 1;
    },
    [],
  );

  const nextFromBasics = async (): Promise<InitialPlanStage | undefined> => {
    if (!token || !resources) return;
    if (!resources.ftpWatts) {
      setError("请先设置 FTP，然后返回继续");
      return;
    }
    if (
      resources.readiness.missingFields.includes("weightKg") &&
      !resources.profile.weightKg
    ) {
      setError("请先到个人资料补充体重，然后返回继续");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (resources.profile.experienceLevel !== experience) {
        await patchProfile(token, {
          experienceLevel: experience,
          expectedVersion: resources.profile.version,
        });
      }
      const latest = await refresh();
      const nextStage = resources.planStatus.hasActivePlan
        ? latest?.readiness.ready
          ? "entry"
          : latest
            ? firstMissingStep(latest.readiness.missingFields)
            : "entry"
        : "goal";
      if (task && latest?.readiness.ready) {
        setReturnStage(null);
        setStage("planning");
        return "planning";
      }
      setStage(nextStage);
      return task && returnStage === "planning"
        ? nextStage
        : resources.planStatus.hasActivePlan && latest?.readiness.ready
          ? "entry"
          : resources.planStatus.hasActivePlan && latest
            ? firstMissingStep(latest.readiness.missingFields)
            : "goal";
    } catch (cause) {
      setError(errorMessage(cause, "保存训练经验失败"));
    } finally {
      setBusy(false);
    }
  };

  const nextFromGoal = async (): Promise<InitialPlanStage | undefined> => {
    if (!token || !resources) return;
    const parsed = goalInputSchema.safeParse({
      type: goalType,
      description: goalNote.trim() || null,
      targetWkg:
        goalType === "FTP" && targetWkg.trim() ? Number(targetWkg) : null,
      targetDate: goalDate,
      priority: "PRIMARY",
    });
    const today = localDateInTimezone(new Date(), resources.profile.timezone);
    if (!parsed.success || goalDate < today) {
      setError("请填写有效的目标日期和目标数值，日期不能早于今天");
      return;
    }
    if (parsed.data.targetWkg && !resources.profile.weightKg) {
      setError("功体比目标需要体重，请先到个人资料补充体重");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const current =
        resources.goals.find(
          (goal) => goal.status === "ACTIVE" && goal.priority === "PRIMARY",
        ) ?? resources.goals.find((goal) => goal.status === "ACTIVE");
      if (current)
        await coachApi.updateGoal(token, current.id, {
          ...parsed.data,
          expectedVersion: current.version,
        });
      else await coachApi.createGoal(token, parsed.data);
      const latest = await refresh();
      const nextStage = resources.planStatus.hasActivePlan
        ? latest?.readiness.ready
          ? "entry"
          : latest
            ? firstMissingStep(latest.readiness.missingFields)
            : "entry"
        : "schedule";
      if (task && latest?.readiness.ready) {
        setReturnStage(null);
        setStage("planning");
        return "planning";
      }
      setStage(nextStage);
      return nextStage;
    } catch (cause) {
      setError(errorMessage(cause, "保存目标失败"));
    } finally {
      setBusy(false);
    }
  };

  const nextFromSchedule = async (): Promise<InitialPlanStage | undefined> => {
    if (!token || !resources) return;
    if (!days.length) {
      setError("请至少选择一个可训练日");
      return;
    }
    const input: AvailabilityInput = {
      timezone: resources.profile.timezone,
      weekdays: [...days]
        .sort((a, b) => a - b)
        .map((weekday) => ({ weekday, availableMinutes: minutes })),
      maxSessionMinutes: minutes,
      ...(resources.availability
        ? { expectedVersion: resources.availability.version }
        : {}),
    };
    setBusy(true);
    setError(null);
    try {
      await coachApi.saveAvailability(token, input);
      const latest = await refresh();
      const nextStage = resources.planStatus.hasActivePlan
        ? latest?.readiness.ready
          ? "entry"
          : latest
            ? firstMissingStep(latest.readiness.missingFields)
            : "entry"
        : "nutrition";
      if (task && latest?.readiness.ready) {
        setReturnStage(null);
        setStage("planning");
        return "planning";
      }
      setStage(nextStage);
      return task && returnStage === "planning"
        ? nextStage
        : resources.planStatus.hasActivePlan && latest?.readiness.ready
          ? "entry"
          : resources.planStatus.hasActivePlan && latest
            ? firstMissingStep(latest.readiness.missingFields)
            : "nutrition";
    } catch (cause) {
      setError(errorMessage(cause, "保存可训练时间失败"));
    } finally {
      setBusy(false);
    }
  };

  const generate = async (
    mode: WeekGenerationInput["mode"] = "initial",
    weekStartDate?: string,
    scope?: Pick<AdjustmentScope, "targetWorkoutId" | "expectedPlanVersion">,
  ) => {
    if (!token) return;
    if (symptomFlags.length) {
      setError("检测到明显不适，请先暂停训练并进行适当的医疗评估");
      setStage("basics");
      return;
    }
    if (restriction === "其他限制" && !restrictionNote.trim()) {
      setError("请补充其他饮食限制的具体食物或成分");
      setStage("nutrition");
      return;
    }
    generationRequest.current = { mode, weekStartDate, ...scope };
    const currentOperation = ++operation.current;
    setError(null);
    setJobStatus("QUEUED");
    setStage("loading");
    setProposal(null);
    try {
      const latest = await refresh();
      if (!latest) return;
      if (
        scope?.expectedPlanVersion !== undefined &&
        scope.expectedPlanVersion !== latest.planStatus.planVersion
      )
        throw new Error("正式计划已变化，请返回重新选择调整范围");
      if (!latest.readiness.ready) {
        setError(
          `请先补全训练资料：${missingTrainingData(latest.readiness.missingFields)}`,
        );
        if (task) setReturnStage("planning");
        setStage(firstMissingStep(latest.readiness.missingFields));
        return;
      }
      const goal =
        latest.goals.find(
          (item) => item.status === "ACTIVE" && item.priority === "PRIMARY",
        ) ?? latest.goals.find((item) => item.status === "ACTIVE");
      if (!goal) throw new Error("没有可用的训练目标，请返回目标步骤");
      const today = localDateInTimezone(new Date(), latest.profile.timezone);
      const input = {
        weekStartDate: weekStartDate ?? nextMonday(today),
        goalId: goal.id,
        mode,
        expectedBaseVersion: latest.planStatus.planVersion,
        ...(scope?.targetWorkoutId
          ? { targetWorkoutId: scope.targetWorkoutId }
          : {}),
        notes: [
          `当前状态：${bodyStatus === "TIRED" ? "有些疲劳" : bodyStatus === "RECOVERY" ? "需要恢复" : "状态正常"}`,
          `计划周期：${cycleWeeks} 周`,
          taskNote.trim(),
          bodyNote.trim(),
        ]
          .filter(Boolean)
          .join("；")
          .slice(0, 200),
        ...(bodyStatus === "TIRED" ? { reason: "FATIGUE" as const } : {}),
        ...(symptomFlags.length ? { symptomFlags } : {}),
      } as const;
      const job =
        mode === "replace_workout" && scope?.targetWorkoutId
          ? await coachApi.adjustWorkout(
              token,
              scope.targetWorkoutId,
              input,
              key(),
            )
          : mode === "replace_week"
            ? await coachApi.adjustPlan(token, input, key())
            : await coachApi.generate(token, input, key());
      const draft = await waitForCoachProposal(
        token,
        job,
        setJobStatus,
        () => operation.current === currentOperation,
      );
      if (!draft || operation.current !== currentOperation) return;
      setProposal(draft);
      applyKey.current = null;
      setStage("proposals");
    } catch (cause) {
      if (operation.current !== currentOperation) return;
      setJobStatus("FAILED");
      setError(errorMessage(cause, "生成训练计划失败"));
    }
  };

  const generateActiveWeek = async (week: "current" | "next") => {
    if (!token || !resources) return;
    setBusy(true);
    setError(null);
    try {
      const today = localDateInTimezone(new Date(), resources.profile.timezone);
      const scope = await resolveAdjustmentScope(
        token,
        week === "current" ? "THIS_WEEK" : "NEXT_WEEK",
        today,
      );
      await generate(scope.mode, scope.weekStartDate, scope);
    } catch (cause) {
      setError(errorMessage(cause, "读取训练日历失败，请重试"));
    } finally {
      setBusy(false);
    }
  };

  const beginTask = (nextTask: CoachTask) => {
    setTask(nextTask);
    setReturnStage(null);
    setPlanningScope("NEXT_WEEK");
    setTaskNote("");
    setError(null);
    setStage("planning");
  };

  const cancelTask = () => {
    setTask(null);
    setReturnStage(null);
    setTaskNote("");
    setError(null);
    setStage("entry");
  };

  const editTaskGoal = () => {
    setReturnStage("planning");
    setError(null);
    setStage("goal");
  };

  const submitTask = async () => {
    if (!token || !resources || busy) return;
    setBusy(true);
    setError(null);
    try {
      const today = localDateInTimezone(new Date(), resources.profile.timezone);
      const scope = await resolveAdjustmentScope(token, planningScope, today);
      await generate(scope.mode, scope.weekStartDate, scope);
    } catch (cause) {
      setError(errorMessage(cause, "读取调整范围失败，请重试"));
    } finally {
      setBusy(false);
    }
  };

  const retryGeneration = () => {
    const previous = generationRequest.current;
    if (previous)
      void generate(previous.mode, previous.weekStartDate, previous);
  };

  const upcomingWorkoutDate = async (): Promise<string | null | undefined> => {
    if (!token || !resources) return undefined;
    setBusy(true);
    setError(null);
    try {
      const today = localDateInTimezone(new Date(), resources.profile.timezone);
      const calendar = await trainingApi.getCalendar(
        token,
        today,
        addDays(today, 56),
      );
      return calendar.items[0]?.scheduledDate ?? null;
    } catch (cause) {
      setError(errorMessage(cause, "读取训练日历失败，请重试"));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    if (!token || !proposal) return;
    setBusy(true);
    setError(null);
    try {
      const validated = await coachApi.validate(token, proposal.proposalId);
      setProposal(validated);
      if (validated.status !== "READY" || validated.blockers.length) {
        setError("草稿未通过校验，请返回修改资料后重新生成");
      } else {
        setConfirmOpen(true);
      }
    } catch (cause) {
      setError(errorMessage(cause, "计划校验失败"));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!token || !proposal) return;
    setBusy(true);
    setError(null);
    applyKey.current ??= key();
    try {
      const applied = await coachApi.apply(
        token,
        proposal.proposalId,
        proposal.basePlanVersion,
        applyKey.current,
      );
      setConfirmOpen(false);
      setAppliedDates(applied.affectedDates);
      setStage("success");
      setResources((current) =>
        current
          ? {
              ...current,
              planStatus: {
                hasActivePlan: true,
                planVersion: applied.newPlanVersion,
              },
            }
          : current,
      );
    } catch (cause) {
      setError(errorMessage(cause, "应用计划失败，请重新校验后重试"));
    } finally {
      setBusy(false);
    }
  };

  const leaveLoading = () => {
    operation.current += 1;
    setStage(
      task
        ? "planning"
        : resources?.planStatus.hasActivePlan
          ? "entry"
          : "nutrition",
    );
    setError("已返回填写步骤；服务端任务可能仍在处理，本次未应用正式计划");
  };

  const goTo = (next: InitialPlanStage) => {
    setError(null);
    setStage(next);
  };

  return {
    token,
    resources,
    loading,
    busy,
    error,
    stage,
    task,
    planningScope,
    setPlanningScope,
    taskNote,
    setTaskNote,
    beginTask,
    cancelTask,
    submitTask,
    editTaskGoal,
    goTo,
    experience,
    setExperience,
    goalType,
    setGoalType,
    goalDate,
    setGoalDate,
    targetWkg,
    setTargetWkg,
    goalNote,
    setGoalNote,
    cycleWeeks,
    setCycleWeeks,
    days,
    setDays,
    minutes,
    setMinutes,
    bodyStatus,
    setBodyStatus,
    bodyNote,
    setBodyNote,
    symptomFlags,
    setSymptomFlags,
    restriction,
    setRestriction,
    restrictionNote,
    setRestrictionNote,
    meal,
    setMeal,
    jobStatus,
    proposal,
    appliedDates,
    confirmOpen,
    setConfirmOpen,
    refresh,
    nextFromBasics,
    nextFromGoal,
    nextFromSchedule,
    generate,
    generateActiveWeek,
    retryGeneration,
    upcomingWorkoutDate,
    validate,
    apply,
    leaveLoading,
  };
}
