import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "expo-router";
import { Modal, View } from "react-native";

import { Screen } from "../../../components/layout/Screen";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import {
  BasicsStep,
  GoalStep,
  NutritionStep,
  ScheduleStep,
} from "../components/InitialPlanSteps";
import { CoachHome } from "../components/CoachHome";
import {
  AiMark,
  CoachPage,
  InfoStrip,
  StepItem,
} from "../components/CoachPage";
import { GenerationProgress } from "../components/GenerationProgress";
import { PlanCandidates } from "../components/PlanCandidates";
import { PlanPreview } from "../components/PlanPreview";
import { PlanningBrief, planningTaskCopy } from "../components/PlanningBrief";
import { useCoachFlow } from "../hooks/CoachFlowContext";
import type { CoachTask, InitialPlanStage } from "../hooks/useInitialPlan";
import { localDateInTimezone } from "../model/plan-dates";
import { firstMissingStep, missingTrainingData } from "../model/readiness";

type CoachRoutePath =
  | "/(tabs)/coach/basics"
  | "/(tabs)/coach/goal"
  | "/(tabs)/coach/schedule"
  | "/(tabs)/coach/nutrition"
  | "/(tabs)/coach/planning"
  | "/(tabs)/coach/loading"
  | "/(tabs)/coach/proposals"
  | "/(tabs)/coach/diff"
  | "/(tabs)/coach/success";

const coachRoute = (screen: string) =>
  `/(tabs)/coach/${screen}` as CoachRoutePath;

export function CoachScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const flow = useCoachFlow();
  const { resources, stage: flowStage, error, busy } = flow;
  const previousFlowStage = useRef(flowStage);
  const visiblePath =
    pathname.replace(/^\/\(tabs\)/, "").replace(/\/$/, "") || "/";
  const routeStage: InitialPlanStage | null =
    visiblePath === "/coach"
      ? "entry"
      : visiblePath === "/coach/basics"
        ? "basics"
        : visiblePath === "/coach/goal"
          ? "goal"
          : visiblePath === "/coach/schedule"
            ? "schedule"
            : visiblePath === "/coach/nutrition"
              ? "nutrition"
              : visiblePath === "/coach/planning"
                ? "planning"
                : visiblePath === "/coach/loading"
                  ? "loading"
                  : visiblePath === "/coach/proposals"
                    ? "proposals"
                    : visiblePath === "/coach/diff"
                      ? "diff"
                      : visiblePath === "/coach/success"
                        ? "success"
                        : null;
  const stage = routeStage ?? flowStage;
  useEffect(() => {
    const stageChanged = previousFlowStage.current !== flowStage;
    previousFlowStage.current = flowStage;
    if (!stageChanged) return;
    if (routeStage === "loading" && flowStage === "proposals") {
      router.replace(coachRoute("proposals"));
    } else if (
      (routeStage === "loading" || routeStage === "diff") &&
      flowStage === "success"
    ) {
      router.replace(coachRoute("success"));
    }
  }, [flowStage, routeStage]);

  if (!flow.token)
    return (
      <Screen className="justify-center px-5">
        <AppText>请先登录后使用 AI 教练。</AppText>
      </Screen>
    );
  if (flow.loading && !resources)
    return (
      <Screen className="items-center justify-center">
        <Spinner accessibilityLabel="读取 AI 教练资料" />
      </Screen>
    );
  if (!resources)
    return (
      <CoachPage
        eyebrow="AI 教练"
        title="暂时无法读取资料"
        description="请检查网络或 API 服务状态。"
        primary="重试"
        onPrimary={() => void flow.refresh()}
        error={error}
      >
        <Card>
          <AppText>已有计划和草稿不会因此改变。</AppText>
        </Card>
      </CoachPage>
    );

  const toProfile = () => router.push("/(tabs)/profile");
  const today = localDateInTimezone(new Date(), resources.profile.timezone);
  const hasActivePlan = resources.planStatus.hasActivePlan;
  const missingFields = resources.readiness.missingFields;
  const ready = resources.readiness.ready;
  const goToStage = (next: InitialPlanStage) => {
    if (next === "entry") {
      router.replace("/(tabs)/coach");
      return;
    }
    if (
      next === "basics" ||
      next === "goal" ||
      next === "schedule" ||
      next === "nutrition" ||
      next === "planning" ||
      next === "loading" ||
      next === "proposals" ||
      next === "diff"
    ) {
      router.replace(coachRoute(next));
    }
  };
  const startTask = (task: CoachTask) => {
    flow.beginTask(task);
    router.push(coachRoute("planning"));
  };
  const startWeekGeneration = (week: "current" | "next") => {
    void flow.generateActiveWeek(week);
    router.push(coachRoute("loading"));
  };
  const openAppliedDates = () =>
    router.push({
      pathname: "/(tabs)/training",
      params: flow.appliedDates[0] ? { date: flow.appliedDates[0] } : {},
    });
  const openActiveCalendar = async () => {
    const date = await flow.upcomingWorkoutDate();
    if (date === undefined) return;
    router.push({
      pathname: "/(tabs)/training",
      params: date ? { date } : {},
    });
  };

  if (stage === "success")
    return (
      <CoachPage
        eyebrow={`正式计划 v${resources.planStatus.planVersion}`}
        title="计划已建立"
        compactHeader
        description=""
        primary="查看训练日历"
        onPrimary={openAppliedDates}
        secondary="返回 AI 教练"
        onSecondary={() => router.replace("/(tabs)/coach")}
      >
        <View className="items-center">
          <View className="h-[72px] w-[72px] items-center justify-center rounded-full border border-[#68866D] bg-[#26352A]">
            <AppText className="text-[35px] leading-[40px] text-positive">
              ✓
            </AppText>
          </View>
          <AppText variant="display" className="mt-5 text-center text-[27px]">
            你的训练计划已准备好
          </AppText>
          <AppText variant="caption" muted className="mt-2 text-center">
            首页和训练日历现在会展示正式安排。后续变化仍会先生成草稿，确认后才会应用。
          </AppText>
        </View>
        <View className="rounded-[17px] border border-border bg-surface p-4">
          <AppText variant="label" className="text-positive">
            正式计划 v{resources.planStatus.planVersion}
          </AppText>
          <AppText variant="card" className="mt-2">
            首个训练周期
          </AppText>
          <AppText variant="caption" muted className="mt-1">
            本次只应用骑行训练计划；饮食与禁忌信息已保留在本次引导，未提交后端。
          </AppText>
        </View>
        <InfoStrip>计划已经生效，可以先查看第一节训练。</InfoStrip>
      </CoachPage>
    );

  if (hasActivePlan && stage === "entry")
    return (
      <CoachPage
        eyebrow="AI 教练"
        title="你的训练状态中心"
        compactHeader
        description=""
        primary={ready ? undefined : "补全训练资料"}
        onPrimary={() => {
          const next = firstMissingStep(missingFields);
          flow.goTo(next);
          router.push(coachRoute(next));
        }}
        secondary="查看训练日历"
        onSecondary={() => void openActiveCalendar()}
        busy={busy}
        error={error}
      >
        <CoachHome
          planVersion={resources.planStatus.planVersion}
          ready={ready}
          missingData={missingTrainingData(missingFields)}
          onTask={startTask}
          onFeedback={() => router.push("/(tabs)/training")}
          onCalendar={() => void openActiveCalendar()}
          onCurrentWeek={() => startWeekGeneration("current")}
          onNextWeek={() => startWeekGeneration("next")}
        />
      </CoachPage>
    );

  if (stage === "entry")
    return (
      <CoachPage
        eyebrow="首次使用 · 尚无正式计划"
        title="AI 教练"
        compactHeader
        primary="开始建立计划"
        onPrimary={() => {
          flow.goTo("basics");
          router.push(coachRoute("basics"));
        }}
        secondary="先手动创建一节训练"
        onSecondary={() => router.push("/workouts/new")}
        error={error}
      >
        <View className="overflow-hidden rounded-[18px] border border-border bg-surface p-4">
          <AiMark />
          <AppText variant="label" className="mt-4 text-muted">
            需要先建立计划
          </AppText>
          <AppText
            variant="display"
            className="mt-2 text-[27px] leading-[32px]"
          >
            先建立你的训练基础
          </AppText>
          <AppText variant="body" className="mt-2 text-secondary">
            告诉我你的目标、时间和骑行基础，我会先生成一份可检查、可调整的计划草稿。
          </AppText>
          <View className="mt-4">
            <InfoStrip>
              已有资料会自动复用；饮食与禁忌会先保存在本次引导，不会提交后端。
            </InfoStrip>
          </View>
        </View>
        <View className="mt-1 gap-2">
          <AppText variant="card" className="mb-1">
            这次会完成
          </AppText>
          <StepItem number={1}>确认骑行基础和 FTP</StepItem>
          <StepItem number={2}>设定训练目标、周期和明确日期</StepItem>
          <StepItem number={3}>安排每周训练日与单次时长</StepItem>
          <StepItem number={4}>记录饮食限制，预览后确认应用</StepItem>
        </View>
        <AppText variant="caption" muted className="mt-1">
          预计用时 3–5 分钟，之后可以根据每天状态调整课程。
        </AppText>
      </CoachPage>
    );

  if (stage === "planning") {
    const task = flow.task ?? "REPLAN";
    const copy = planningTaskCopy(task);
    const activeGoal =
      resources.goals.find(
        (goal) => goal.status === "ACTIVE" && goal.priority === "PRIMARY",
      ) ?? resources.goals.find((goal) => goal.status === "ACTIVE");
    return (
      <CoachPage
        eyebrow={`AI 教练 · ${copy.eyebrow}`}
        title={copy.title}
        description={copy.description}
        primary={copy.primary}
        onPrimary={() => {
          void flow.submitTask();
          router.push(coachRoute("loading"));
        }}
        secondary="返回 AI 教练"
        onSecondary={() => {
          flow.cancelTask();
          router.replace("/(tabs)/coach");
        }}
        onBack={() => {
          flow.cancelTask();
          router.replace("/(tabs)/coach");
        }}
        busy={busy}
        error={error}
      >
        <PlanningBrief
          task={task}
          planningScope={flow.planningScope}
          setPlanningScope={flow.setPlanningScope}
          taskNote={flow.taskNote}
          setTaskNote={flow.setTaskNote}
          bodyStatus={flow.bodyStatus}
          setBodyStatus={flow.setBodyStatus}
          planStatus={resources.planStatus}
          goalLabel={
            activeGoal?.type === "FTP"
              ? "提升 FTP"
              : activeGoal?.type === "RACE"
                ? "准备比赛"
                : "提升耐力"
          }
          goalDate={activeGoal?.targetDate ?? "待补充"}
          onEditGoal={() => {
            flow.editTaskGoal();
            router.push(coachRoute("goal"));
          }}
        />
      </CoachPage>
    );
  }

  if (stage === "basics")
    return (
      <CoachPage
        eyebrow={
          hasActivePlan ? "补全训练资料 · 第 1 步" : "新用户引导 · 第 1 步"
        }
        title="骑行基础"
        description="先确认训练经验和可用 FTP，AI 计划会按实际测量值计算功率范围。"
        primary="下一步"
        onPrimary={() => {
          void flow.nextFromBasics().then((next) => {
            if (next) goToStage(next);
          });
        }}
        secondary="返回"
        onSecondary={() => {
          flow.goTo("entry");
          router.replace("/(tabs)/coach");
        }}
        onBack={() => {
          flow.goTo("entry");
          router.replace("/(tabs)/coach");
        }}
        progressStep={1}
        progressLabel="先告诉我你的骑行基础"
        busy={busy}
        error={error}
      >
        <BasicsStep
          experience={flow.experience}
          setExperience={flow.setExperience}
          ftpWatts={resources.ftpWatts}
          profile={resources.profile}
          onFtp={toProfile}
          bodyStatus={flow.bodyStatus}
          setBodyStatus={flow.setBodyStatus}
          bodyNote={flow.bodyNote}
          setBodyNote={flow.setBodyNote}
          symptomFlags={flow.symptomFlags}
          setSymptomFlags={flow.setSymptomFlags}
        />
      </CoachPage>
    );

  if (stage === "goal")
    return (
      <CoachPage
        eyebrow={
          hasActivePlan ? "补全训练资料 · 第 2 步" : "新用户引导 · 第 2 步"
        }
        title="训练目标"
        description="确定训练方向与目标日期；目标差距是参考，不代表保证达到。"
        primary="下一步"
        onPrimary={() => {
          void flow.nextFromGoal().then((next) => {
            if (next) goToStage(next);
          });
        }}
        secondary={hasActivePlan ? "返回 AI 教练" : "返回骑行基础"}
        onSecondary={() => {
          const next = hasActivePlan ? "entry" : "basics";
          flow.goTo(next);
          router.replace(next === "entry" ? "/(tabs)/coach" : coachRoute(next));
        }}
        onBack={() => {
          const next = hasActivePlan ? "entry" : "basics";
          flow.goTo(next);
          router.replace(next === "entry" ? "/(tabs)/coach" : coachRoute(next));
        }}
        progressStep={2}
        progressLabel="这份计划最想帮助你什么？"
        busy={busy}
        error={error}
      >
        <GoalStep
          type={flow.goalType}
          setType={flow.setGoalType}
          date={flow.goalDate}
          setDate={flow.setGoalDate}
          today={today}
          targetWkg={flow.targetWkg}
          setTargetWkg={flow.setTargetWkg}
          note={flow.goalNote}
          setNote={flow.setGoalNote}
          cycleWeeks={flow.cycleWeeks}
          setCycleWeeks={flow.setCycleWeeks}
        />
        {flow.goalType === "FTP" &&
        flow.targetWkg &&
        !resources.profile.weightKg ? (
          <Button variant="secondary" onPress={toProfile}>
            到个人资料补充体重
          </Button>
        ) : null}
      </CoachPage>
    );

  if (stage === "schedule")
    return (
      <CoachPage
        eyebrow={
          hasActivePlan ? "补全训练资料 · 第 3 步" : "新用户引导 · 第 3 步"
        }
        title="时间安排"
        description="选择比较稳定的骑行日和单次可用时长，计划会保留恢复空间。"
        primary={hasActivePlan ? "保存并返回 AI 教练" : "下一步"}
        onPrimary={() => {
          void flow.nextFromSchedule().then((next) => {
            if (next) goToStage(next);
          });
        }}
        secondary={hasActivePlan ? "返回 AI 教练" : "返回训练目标"}
        onSecondary={() => {
          const next = hasActivePlan ? "entry" : "goal";
          flow.goTo(next);
          router.replace(next === "entry" ? "/(tabs)/coach" : coachRoute(next));
        }}
        onBack={() => {
          const next = hasActivePlan ? "entry" : "goal";
          flow.goTo(next);
          router.replace(next === "entry" ? "/(tabs)/coach" : coachRoute(next));
        }}
        progressStep={3}
        progressLabel="每周哪些时间适合骑行？"
        busy={busy}
        error={error}
      >
        <ScheduleStep
          days={flow.days}
          setDays={flow.setDays}
          minutes={flow.minutes}
          setMinutes={flow.setMinutes}
        />
      </CoachPage>
    );

  if (stage === "nutrition")
    return (
      <CoachPage
        eyebrow="新用户引导 · 第 4 步"
        title="饮食与禁忌"
        description="先记录饮食限制和偏好。当前只保存在本次引导，不提交后端接口。"
        primary="生成计划草稿"
        onPrimary={() => {
          if (flow.restriction === "其他限制" && !flow.restrictionNote.trim()) {
            void flow.generate("initial");
            return;
          }
          void flow.generate("initial");
          router.push(coachRoute("loading"));
        }}
        secondary="返回时间安排"
        onSecondary={() => {
          flow.goTo("schedule");
          router.replace(coachRoute("schedule"));
        }}
        onBack={() => {
          flow.goTo("schedule");
          router.replace(coachRoute("schedule"));
        }}
        progressStep={4}
        progressLabel="最后确认饮食相关的关键限制"
        error={error}
      >
        <NutritionStep
          restriction={flow.restriction}
          setRestriction={flow.setRestriction}
          restrictionNote={flow.restrictionNote}
          setRestrictionNote={flow.setRestrictionNote}
          meal={flow.meal}
          setMeal={flow.setMeal}
        />
      </CoachPage>
    );

  if (stage === "loading")
    return (
      <CoachPage
        eyebrow="AI 训练草稿"
        title={hasActivePlan ? "正在准备训练调整" : "正在准备你的第一份计划"}
        description="服务端生成并校验后，才会提供可预览的草稿。"
        primary={flow.jobStatus === "FAILED" ? "重新生成" : undefined}
        onPrimary={() => {
          flow.retryGeneration();
        }}
        secondary="返回填写"
        onSecondary={() => {
          flow.leaveLoading();
          if (flow.task) router.replace(coachRoute("planning"));
          else if (hasActivePlan) router.replace("/(tabs)/coach");
          else router.replace(coachRoute("nutrition"));
        }}
        error={error}
      >
        <GenerationProgress status={flow.jobStatus} error={error} />
      </CoachPage>
    );

  if (stage === "proposals")
    return (
      <CoachPage
        eyebrow="候选草稿 · 尚未应用"
        title="选择计划方向"
        description="先查看推荐草稿，再检查日期、训练量和应用影响。正式计划不会自动改变。"
        primary="预览所选方案"
        onPrimary={() => {
          flow.goTo("diff");
          router.push(coachRoute("diff"));
        }}
        secondary={hasActivePlan ? "返回 AI 教练" : "返回饮食与禁忌"}
        onSecondary={() => {
          const next = hasActivePlan ? "entry" : "nutrition";
          flow.goTo(next);
          router.replace(next === "entry" ? "/(tabs)/coach" : coachRoute(next));
        }}
        onBack={() => {
          const next = hasActivePlan ? "entry" : "nutrition";
          flow.goTo(next);
          router.replace(next === "entry" ? "/(tabs)/coach" : coachRoute(next));
        }}
        error={error}
      >
        {flow.proposal ? (
          <PlanCandidates
            proposal={flow.proposal}
            selected
            onSelect={() => undefined}
          />
        ) : (
          <Spinner accessibilityLabel="读取候选草稿" />
        )}
      </CoachPage>
    );

  return (
    <>
      <CoachPage
        eyebrow="草稿 → 正式计划 · 尚未应用"
        title="计划差异预览"
        description="请核对训练安排、阶段建议和本次饮食信息状态，再决定是否校验并应用。"
        primary="校验并继续"
        onPrimary={() => void flow.validate()}
        secondary="继续修改"
        onSecondary={() => {
          flow.goTo("proposals");
          router.replace(coachRoute("proposals"));
        }}
        onBack={() => {
          flow.goTo("proposals");
          router.replace(coachRoute("proposals"));
        }}
        busy={busy}
        error={error}
      >
        {flow.proposal ? (
          <PlanPreview
            proposal={flow.proposal}
            ftpWatts={resources.ftpWatts}
            nutritionSummary={flow.restriction}
          />
        ) : (
          <Spinner accessibilityLabel="读取计划草稿" />
        )}
      </CoachPage>
      <Modal
        visible={flow.confirmOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => flow.setConfirmOpen(false)}
      >
        <Screen className="justify-end px-5 pb-8">
          <View className="rounded-t-[24px] border border-border bg-surface px-4 pb-5 pt-4">
            <View className="mx-auto mb-4 h-1 w-9 rounded-full bg-muted" />
            <AppText variant="section">
              {hasActivePlan ? "确认更新正式计划？" : "确认建立正式计划？"}
            </AppText>
            <AppText variant="caption" className="mt-2 text-secondary">
              确认后会把当前一周草稿应用为正式计划。
              {flow.proposal?.replaceWorkoutIds.length
                ? `将替换 ${flow.proposal.replaceWorkoutIds.length} 节未来课程。`
                : hasActivePlan
                  ? "已有课程将保留。"
                  : ""}
              饮食与禁忌只保存在本次引导，不会提交后端。
            </AppText>
            <View className="mt-4 rounded-xl bg-surface-2 px-3">
              <View className="flex-row justify-between border-b border-divider py-3">
                <AppText variant="caption" muted>
                  计划版本
                </AppText>
                <AppText variant="caption">
                  v{resources.planStatus.planVersion} → v
                  {resources.planStatus.planVersion + 1}
                </AppText>
              </View>
              <View className="flex-row justify-between py-3">
                <AppText variant="caption" muted>
                  草稿课程
                </AppText>
                <AppText variant="caption">
                  {flow.proposal?.workouts.length ?? 0} 节
                </AppText>
              </View>
              <View className="flex-row justify-between border-t border-divider py-3">
                <AppText variant="caption" muted>
                  饮食信息
                </AppText>
                <AppText variant="caption">已记录 · 暂不提交</AppText>
              </View>
            </View>
            {error ? (
              <AppText variant="caption" className="mt-3 text-negative">
                {error}
              </AppText>
            ) : null}
            <Button
              className="mt-5"
              size="lg"
              loading={busy}
              onPress={() => void flow.apply()}
            >
              确认应用
            </Button>
            <Button
              variant="secondary"
              className="mt-2"
              disabled={busy}
              onPress={() => flow.setConfirmOpen(false)}
            >
              返回预览
            </Button>
          </View>
        </Screen>
      </Modal>
    </>
  );
}

export function CoachRoute() {
  return <CoachScreen />;
}
