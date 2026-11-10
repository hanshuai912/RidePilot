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
  const guard = useUnsavedTraining(
    dirty && focused,
    "返回将放弃当前生成条件，确认离开？",
    flow.busy,
  );
  const data = flow.data;
  const active = data?.goal.status === "ACTIVE";
  const canPlan = active && !!data?.ftp;
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
          <GoalSwitcher current={data.goal} disabled={flow.busy} />
          <GoalSummaryCard
            goal={data.goal}
            currentFtp={data.ftp?.valueWatts}
            busy={flow.busy}
            onManage={() =>
              router.push({ pathname: "/goals/manage", params: { goalId } })
            }
          />
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
                          params: { goalId, stageId, date },
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
            goalId={goalId}
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
