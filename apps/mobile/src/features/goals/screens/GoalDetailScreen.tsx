import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppText, Button, Card, Input, Spinner } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { FtpRequiredState } from "../../training/components/FtpRequiredState";
import { useUnsavedTraining } from "../../training/hooks/useUnsavedTraining";
import { ChoicePill } from "../../coach/components/CoachPage";
import { useGoalPlanning } from "../hooks/useGoalPlanning";
import { StageTimeline } from "../components/StageTimeline";
import { goalLabels } from "./GoalsScreen";

export function GoalDetailScreen() {
  const { goalId = "" } = useLocalSearchParams<{ goalId?: string }>();
  const flow = useGoalPlanning(goalId);
  const focused = useIsFocused();
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedTraining(
    dirty && focused,
    "返回将放弃当前生成条件，确认离开？",
    flow.busy,
  );
  const data = flow.data;
  return (
    <TrainingPage
      title="目标与阶段"
      busy={flow.busy}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/goals")
      }
      error={!data ? flow.error : null}
      retry={flow.retry}
      loading={!data && flow.loading}
    >
      {guard}
      {data ? (
        <>
          <Card>
            <AppText variant="section">{goalLabels[data.goal.type]}</AppText>
            <AppText className="mt-2" muted>
              {data.goal.description || "以持续训练与实际测量评估进展"}
            </AppText>
            <AppText variant="caption" muted className="mt-3">
              目标日期 {data.goal.targetDate}
              {data.goal.targetWkg
                ? ` · 目标功体比 ${data.goal.targetWkg} W/kg`
                : ""}
            </AppText>
            <AppText variant="caption" muted className="mt-2">
              {data.ftp ? `当前 FTP ${data.ftp.valueWatts} W` : "尚未设置 FTP"}
            </AppText>
          </Card>
          {!data.ftp ? (
            <FtpRequiredState />
          ) : data.goal.status !== "ACTIVE" ? (
            <AppText>当前目标已暂停或结束，请选择活跃目标。</AppText>
          ) : (
            <>
              <AppText variant="section">阶段安排</AppText>
              {data.stages ? (
                <StageTimeline
                  plan={data.stages}
                  today={data.today}
                  selectedId={flow.stageId}
                  onSelect={
                    flow.busy
                      ? undefined
                      : (id) => {
                          setDirty(true);
                          flow.setStageId(id);
                          flow.setScope("STAGE");
                        }
                  }
                />
              ) : (
                <Card>
                  <AppText>
                    尚无阶段安排。可先生成阶段草稿，也可以直接按日期生成课程。
                  </AppText>
                </Card>
              )}
              <Card>
                <AppText variant="card">生成条件</AppText>
                <View className="mt-3 flex-row gap-2">
                  <ChoicePill
                    label="日期范围"
                    selected={flow.scope === "DATES"}
                    onPress={() => {
                      if (!flow.busy) {
                        setDirty(true);
                        flow.setScope("DATES");
                      }
                    }}
                  />
                  <ChoicePill
                    label="所选阶段"
                    selected={flow.scope === "STAGE"}
                    onPress={() => {
                      if (!flow.busy) {
                        setDirty(true);
                        flow.setScope("STAGE");
                      }
                    }}
                  />
                </View>
                <AppText variant="label" muted className="mt-4 mb-2">
                  开始日期
                </AppText>
                <Input
                  accessibilityLabel="开始日期"
                  value={flow.startDate}
                  placeholder="YYYY-MM-DD"
                  editable={!flow.busy}
                  onChangeText={(value) => {
                    setDirty(true);
                    flow.setStartDate(value);
                  }}
                />
                <AppText variant="label" muted className="mt-3 mb-2">
                  结束日期
                </AppText>
                <Input
                  accessibilityLabel="结束日期"
                  value={flow.endDate}
                  placeholder="YYYY-MM-DD"
                  editable={!flow.busy}
                  onChangeText={(value) => {
                    setDirty(true);
                    flow.setEndDate(value);
                  }}
                />
                <AppText variant="caption" muted className="mt-3">
                  阶段安排最多规划 365 天，每个阶段最多 84 天。具体课程一次生成
                  1–84 天；选择阶段时使用该阶段日期，仅安排尚未过去的可训练日。
                </AppText>
                <AppText variant="label" muted className="mt-3 mb-2">
                  课程补充要求（选填）
                </AppText>
                <Input
                  accessibilityLabel="课程补充要求"
                  value={flow.notes}
                  editable={!flow.busy}
                  onChangeText={(value) => {
                    setDirty(true);
                    flow.setNotes(value);
                  }}
                  maxLength={200}
                  multiline
                />
                <AppText variant="caption" muted className="mt-3">
                  课程草稿会列出范围内拟替换的课程。已完成、已记录和范围外的课程会保留。
                </AppText>
                <Button
                  className="mt-4"
                  disabled={flow.busy}
                  onPress={() => void flow.generate("COURSES")}
                >
                  生成课程草稿
                </Button>
                <Button
                  className="mt-2"
                  variant="secondary"
                  disabled={flow.busy}
                  onPress={() => void flow.generate("STAGES")}
                >
                  {data.stages ? "重新生成阶段草稿" : "生成阶段草稿"}
                </Button>
              </Card>
            </>
          )}
          {flow.busy ? (
            <>
              <Spinner accessibilityLabel="正在生成计划草稿" />
              <AppText muted>正在生成并校验，请稍候…</AppText>
            </>
          ) : null}
          {flow.error ? (
            <>
              <AppText className="text-negative">{flow.error}</AppText>
              <Button variant="secondary" onPress={flow.retry}>
                刷新训练资料
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </TrainingPage>
  );
}
