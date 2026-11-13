import { View } from "react-native";
import { router, useLocalSearchParams, useIsFocused } from "expo-router";
import type { GoalChange } from "@ridepilot/contracts";
import { AppText, Button, Card, Input } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useUnsavedTraining } from "../../training/hooks/useUnsavedTraining";
import { GoalForm } from "../components/GoalForm";
import { GoalEvaluation } from "../components/GoalEvaluation";
import { useGoalLifecycle } from "../hooks/useGoalLifecycle";
import { GoalPreviewDetails } from "../components/GoalPreviewDetails";
import { GoalActionPicker } from "../components/GoalActionPicker";
import { GoalCompletionForm } from "../components/GoalCompletionForm";
import { GoalManagementResult } from "../components/GoalManagementResult";
import { GoalPriorityControl } from "../components/GoalPriorityControl";

export function GoalManagementScreen({
  mode = "edit",
}: {
  mode?: "create" | "edit";
}) {
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();
  const id = mode === "create" ? undefined : goalId;
  return (
    <GoalEditor key={mode === "create" ? "new" : id} goalId={id} mode={mode} />
  );
}

function GoalEditor({
  goalId,
  mode,
}: {
  goalId?: string;
  mode: "create" | "edit";
}) {
  const s = useGoalLifecycle(goalId);
  const focused = useIsFocused();
  const guard = useUnsavedTraining(
    s.dirty && focused,
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
      title={mode === "create" ? "添加目标" : "编辑目标"}
      onBack={back}
      busy={s.busy}
      loading={s.loading && !goal}
      error={
        mode === "edit" && !goalId
          ? "未指定要编辑的目标，请返回目标列表"
          : s.error
      }
      retry={s.retry}
    >
      {guard}
      <View className="gap-6 py-3">
        {s.savedId ? (
          <GoalManagementResult
            goalId={s.savedId}
            created={mode === "create" || s.action === "CREATE_NEXT"}
          />
        ) : s.preview ? (
          <>
            <Card className="gap-4 p-5">
              <AppText variant="section">
                {goalId ? "目标变更预览" : "新目标预览"}
              </AppText>
              <GoalPreviewDetails
                comparison={s.preview.comparison}
                input={s.preview.input}
                reason={s.reason}
              />
              {s.preview.warnings.length ? (
                <View className="gap-3 border-t border-divider pt-4">
                  {s.preview.warnings.map((warning) => (
                    <AppText
                      key={warning}
                      variant="caption"
                      className="text-warning"
                    >
                      {warning}
                    </AppText>
                  ))}
                </View>
              ) : null}
            </Card>
            <GoalEvaluation data={s.preview.evaluation} />
            <Button size="lg" loading={s.busy} onPress={() => void s.confirm()}>
              {mode === "create" || s.action === "CREATE_NEXT"
                ? "确认添加目标"
                : "确认保存修改"}
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
                <GoalEvaluation data={s.data!.evaluation} goal={goal} compact />
                <GoalActionPicker
                  actions={actions}
                  value={s.action}
                  disabled={s.busy}
                  onChange={s.setAction}
                />
              </>
            ) : null}
            {showForm ? (
              <GoalForm
                value={s.form}
                onChange={s.changeForm}
                disabled={s.busy}
                priorityControl={
                  s.showPriority ? (
                    <GoalPriorityControl
                      value={s.form.priority}
                      canPromote={s.canPromote}
                      disabled={s.busy}
                      onChange={(priority) =>
                        s.changeForm({ ...s.form, priority })
                      }
                    />
                  ) : undefined
                }
              />
            ) : null}
            {goalId && s.action === "COMPLETE" ? (
              <GoalCompletionForm
                criteria={s.completionCriteria}
                evidence={s.reason}
                disabled={s.busy}
                onCriteriaChange={s.changeCompletionCriteria}
                onEvidenceChange={s.setReason}
              />
            ) : goalId ? (
              <View className="gap-3">
                <AppText variant="section">操作理由</AppText>
                <Card className="p-5">
                  <Input
                    accessibilityLabel="目标操作理由"
                    placeholder="填写本次调整或选择的原因"
                    className="min-h-[96px]"
                    value={s.reason}
                    onChangeText={s.setReason}
                    maxLength={300}
                    multiline
                    editable={!s.busy}
                  />
                </Card>
              </View>
            ) : null}
            <Button
              size="lg"
              loading={s.busy}
              disabled={!!goalId && !goal}
              onPress={() => void s.prepare()}
            >
              {mode === "create" || s.action === "CREATE_NEXT"
                ? "预览新目标"
                : "预览目标修改"}
            </Button>
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
      </View>
    </TrainingPage>
  );
}
