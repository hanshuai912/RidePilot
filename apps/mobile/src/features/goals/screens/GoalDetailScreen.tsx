import { useState } from "react";
import { View } from "react-native";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { GenerationCancelButton } from "../../coach/components/GenerationCancelButton";
import { GoalAssessments } from "../../assessments/components/GoalAssessments";
import { TrainingPage } from "../../training/components/TrainingPage";
import { FtpRequiredState } from "../../training/components/FtpRequiredState";
import { useUnsavedTraining } from "../../training/hooks/useUnsavedTraining";
import { useGoalPlanning } from "../hooks/useGoalPlanning";
import { StageTimeline } from "../components/StageTimeline";
import { GoalSummaryCard } from "../components/GoalSummaryCard";
import { AddGoalButton } from "../components/AddGoalButton";
import { GoalSwitcher } from "../components/GoalSwitcher";
import { GoalCoursePlanner } from "../components/GoalCoursePlanner";
import { StagePlanHeading } from "../components/StagePlanHeading";
import { GoalStagePlanner } from "../components/GoalStagePlanner";
import { GoalInfoButton } from "../components/GoalInfoButton";

export function GoalDetailScreen() {
  const { goalId = "", assessmentId } = useLocalSearchParams<{
    goalId?: string;
    assessmentId?: string;
  }>();
  return (
    <GoalDetailContent
      key={`${goalId}:${assessmentId ?? ""}`}
      goalId={goalId}
      assessmentId={assessmentId}
    />
  );
}

function GoalDetailContent({
  goalId,
  assessmentId,
}: {
  goalId: string;
  assessmentId?: string;
}) {
  const flow = useGoalPlanning(goalId, assessmentId);
  const focused = useIsFocused();
  const [dirty, setDirty] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState(goalId);
  const guard = useUnsavedTraining(
    dirty && focused,
    "返回将放弃当前生成条件，确认离开？",
    flow.busy,
  );
  const data = flow.data;
  const selectedGoal =
    data?.goals.find((g) => g.id === selectedGoalId) ?? data?.goal;
  const planningGoal = data?.goals.find(
    (g) => g.status === "ACTIVE" && g.priority === "PRIMARY",
  );
  const canPlan = !!data?.ftp && !!planningGoal && !data?.goalsError;
  return (
    <TrainingPage
      title="目标与阶段"
      busy={flow.busy}
      headerAction={<AddGoalButton disabled={flow.busy} />}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/goals")
      }
      error={!data ? flow.error : null}
      retry={flow.retry}
      loading={!data && flow.loading}
    >
      {guard}
      {data ? (
        <View className="gap-6 py-3">
          <GoalSwitcher
            current={selectedGoal!}
            disabled={flow.busy}
            goals={data.goals}
            error={data.goalsError}
            retry={flow.retry}
            onSelect={setSelectedGoalId}
          />
          <GoalSummaryCard
            goal={selectedGoal!}
            currentFtp={data.ftp?.valueWatts}
            busy={flow.busy}
            onManage={() =>
              router.push({
                pathname: "/goals/manage",
                params: { goalId: selectedGoal!.id },
              })
            }
          />
          <View className="flex-row items-center">
            <AppText variant="section">综合训练规划</AppText>
            <GoalInfoButton
              title="综合训练规划说明"
              description="阶段、测试和课程由全部进行中目标共同规划，以主目标决定训练重点，兼顾次目标。切换上方目标只查看各自信息，不会切换另一套训练安排。目标有变更时，需重新生成并确认草稿。"
            />
          </View>
          {!data.goalsError && !planningGoal ? (
            <AppText className="text-warning">
              请先在目标管理中确定一个进行中的主目标。
            </AppText>
          ) : null}
          <View className="gap-4">
            {canPlan ? (
              <GoalStagePlanner flow={flow} onEdit={() => setDirty(true)} />
            ) : (
              <StagePlanHeading summary={data.stages?.summary} />
            )}
            {data.stages ? (
              <StageTimeline
                plan={data.stages}
                today={data.today}
                disabled={flow.busy}
                showSummary={false}
                onReview={(stageId) =>
                  router.push({
                    pathname: "/goals/stage-review",
                    params: { stageId },
                  })
                }
                onAssessment={
                  canPlan
                    ? (stageId, date) =>
                        router.push({
                          pathname: "/assessments/new",
                          params: {
                            goalId: data.stages!.goalId,
                            stageId,
                            date,
                          },
                        })
                    : undefined
                }
              />
            ) : (
              <Card className="gap-2 p-5">
                <AppText variant="card">尚无阶段安排</AppText>
                {canPlan ? (
                  <AppText className="text-secondary">
                    点击上方「规划阶段」建立安排，也可直接按日期规划课程。
                  </AppText>
                ) : null}
              </Card>
            )}
          </View>
          <GoalAssessments
            goalId={planningGoal?.id ?? goalId}
            canSchedule={canPlan && !flow.busy}
          />
          {data.assessment ? (
            <Card>
              <AppText>
                基于测试「{data.assessment.protocol}」规划后续课程。
              </AppText>
            </Card>
          ) : null}
          {!data.ftp ? (
            <FtpRequiredState />
          ) : canPlan ? (
            <GoalCoursePlanner flow={flow} onEdit={() => setDirty(true)} />
          ) : null}
          {flow.busy ? (
            <View className="gap-3">
              <Spinner accessibilityLabel="正在生成计划草稿" />
              <GenerationCancelButton cancellation={flow.cancellation} />
            </View>
          ) : null}
          {flow.error ? (
            <View className="gap-3">
              <AppText className="text-negative">{flow.error}</AppText>
              <Button variant="secondary" onPress={flow.retry}>
                刷新训练资料
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
    </TrainingPage>
  );
}
