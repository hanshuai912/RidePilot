import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { GoalChange } from "@ridepilot/contracts";
import { AppText, Button, Card, Input } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useUnsavedTraining } from "../../training/hooks/useUnsavedTraining";
import { ChoicePill } from "../../coach/components/CoachPage";
import { GoalForm } from "../components/GoalForm";
import { GoalEvaluation } from "../components/GoalEvaluation";
import { useGoalLifecycle } from "../hooks/useGoalLifecycle";
import { GoalPreviewDetails } from "../components/GoalPreviewDetails";
import { goalActionLabels } from "../model/goal-lifecycle";

export function GoalManagementScreen() {
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();
  const s = useGoalLifecycle(goalId);
  const guard = useUnsavedTraining(
    s.dirty,
    "离开将放弃尚未确认的目标操作，确认离开？",
    s.busy,
  );
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/goals");
  const goal = s.data?.goal;
  const actions: GoalChange["action"][] =
    goal?.status === "CLOSED"
      ? ["CREATE_NEXT"]
      : goal?.status === "PAUSED"
        ? ["UPDATE", "RESUME", "COMPLETE", "CLOSE"]
        : ["UPDATE", "PAUSE", "COMPLETE", "CLOSE"];
  const showForm =
    !goalId || ["UPDATE", "RESUME", "CREATE_NEXT"].includes(s.action);
  return (
    <TrainingPage
      title={goalId ? "目标管理" : "建立训练目标"}
      onBack={back}
      busy={s.busy}
      loading={!!goalId && s.loading && !goal}
      error={s.error}
      retry={s.retry}
    >
      {guard}
      {s.savedId ? (
        <>
          <Card>
            <AppText variant="section">目标操作已保存</AppText>
            <AppText muted className="mt-2">
              请继续检查阶段与后续训练，已有正式安排仍可查看。
            </AppText>
          </Card>
          <Button
            onPress={() =>
              router.replace({
                pathname: "/goals/[goalId]",
                params: { goalId: s.savedId! },
              })
            }
          >
            查看目标与阶段 · 规划后续训练
          </Button>
          <Button variant="secondary" onPress={() => router.replace("/goals")}>
            返回目标列表
          </Button>
        </>
      ) : s.preview ? (
        <>
          <Card>
            <AppText variant="section">
              {goalId ? "目标变更预览" : "新目标预览"}
            </AppText>
            <GoalPreviewDetails
              comparison={s.preview.comparison}
              input={s.preview.input}
              reason={s.reason}
            />
            {s.preview.warnings.map((w) => (
              <AppText key={w} muted className="mt-3">
                {w}
              </AppText>
            ))}
          </Card>
          <GoalEvaluation data={s.preview.evaluation} />
          <Button loading={s.busy} onPress={() => void s.confirm()}>
            确认保存目标操作
          </Button>
          <Button
            variant="secondary"
            disabled={s.busy}
            onPress={s.cancelPreview}
          >
            返回修改
          </Button>
        </>
      ) : (
        <>
          {goal ? (
            <>
              <GoalEvaluation data={s.data!.evaluation} />
              <View className="flex-row flex-wrap gap-2">
                {actions.map((action) => (
                  <ChoicePill
                    key={action}
                    label={goalActionLabels[action]}
                    selected={s.action === action}
                    onPress={() => {
                      if (!s.busy) s.setAction(action);
                    }}
                  />
                ))}
              </View>
              <AppText muted>
                暂停、完成或结束目标前会列出影响；未来课程、测试与饮食需另行确认调整。
              </AppText>
            </>
          ) : null}
          {showForm ? (
            <GoalForm
              value={s.form}
              onChange={s.changeForm}
              disabled={s.busy}
            />
          ) : null}
          {goalId ? (
            <>
              <AppText>选择理由 / 实际达成证据</AppText>
              <Input
                accessibilityLabel="目标操作理由"
                value={s.reason}
                onChangeText={s.setReason}
                maxLength={300}
                multiline
                editable={!s.busy}
              />
            </>
          ) : null}
          <Button
            loading={s.busy}
            disabled={!!goalId && !goal}
            onPress={() => void s.prepare()}
          >
            预览目标操作
          </Button>
          {s.data?.history.length ? (
            <Card>
              <AppText variant="card">目标决策历史</AppText>
              {s.data.history.map((h) => (
                <AppText key={h.id} muted className="mt-2">
                  {h.createdAt.slice(0, 10)} ·{" "}
                  {goalActionLabels[
                    h.action as keyof typeof goalActionLabels
                  ] ?? "建立目标"}{" "}
                  · {h.reason}
                </AppText>
              ))}
            </Card>
          ) : null}
        </>
      )}
      {s.actionError ? (
        <>
          <AppText className="text-negative">{s.actionError}</AppText>
          <Button variant="secondary" disabled={s.busy} onPress={s.retry}>
            刷新目标资料
          </Button>
        </>
      ) : null}
    </TrainingPage>
  );
}
