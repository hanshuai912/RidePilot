import { GenerationCancelButton } from "../../coach/components/GenerationCancelButton";
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button, Card, Input, Spinner } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { NutritionProfileSheet } from "../components/NutritionProfileSheet";
import { NutritionProposalCard } from "../components/NutritionProposalCard";
import { NutritionItemEditor } from "../components/NutritionItemEditor";
import { profileInputFromResponse } from "../model/nutrition";
import { useTrainingNutrition } from "../hooks/useTrainingNutrition";

export function TrainingNutritionScreen() {
  const { from, to } = useLocalSearchParams<{ from?: string; to?: string }>();
  const flow = useTrainingNutrition(from, to);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <TrainingPage
      title="训练与补给联动"
      loading={flow.loading}
      busy={flow.busy && !flow.status}
    >
      {flow.error ? (
        <Card>
          <AppText className="text-negative">{flow.error}</AppText>
          <Button
            variant="secondary"
            className="mt-3"
            disabled={flow.busy}
            onPress={() => void flow.refresh()}
          >
            刷新并继续查询
          </Button>
        </Card>
      ) : null}
      <Card>
        <AppText variant="card">按最新正式训练安排补给</AppText>
        <AppText variant="caption" muted className="mt-2">
          使用饮食偏好、过敏原和用餐时间生成草稿。训练和饮食分别确认应用。
        </AppText>
        <AppText variant="label" muted className="mt-4">
          开始日期（YYYY-MM-DD）
        </AppText>
        <Input
          accessibilityLabel="补给开始日期"
          value={flow.range.from}
          editable={!flow.busy}
          onChangeText={(value) =>
            flow.setRange((range) => ({ ...range, from: value }))
          }
        />
        <AppText variant="label" muted className="mt-3">
          结束日期（一次最多 31 天）
        </AppText>
        <Input
          accessibilityLabel="补给结束日期"
          value={flow.range.to}
          editable={!flow.busy}
          onChangeText={(value) =>
            flow.setRange((range) => ({ ...range, to: value }))
          }
        />
        <Button
          className="mt-3"
          variant="secondary"
          disabled={flow.busy}
          onPress={() => void flow.refresh(flow.range)}
        >
          读取所选范围 / 继续查询
        </Button>
        {flow.state ? (
          <>
            <AppText variant="caption" muted className="mt-3">
              当前已读取 {flow.state.from} 至 {flow.state.to} · 训练 v
              {flow.state.trainingPlanVersion} · 饮食 v
              {flow.state.nutritionVersion}
            </AppText>
            <AppText variant="caption" className="mt-2 text-warning">
              {flow.state.affectedDates.length
                ? `待核对日期：${flow.state.affectedDates.join("、")}`
                : "所选日期的补给已按最新训练核对"}
            </AppText>
          </>
        ) : null}
      </Card>
      {!flow.loading && !flow.profile ? (
        <Card>
          <AppText>
            先填写饮食档案中的基本信息，补充偏好、禁忌和用餐时间。
          </AppText>
          <Button
            className="mt-3"
            disabled={flow.busy}
            onPress={() => setProfileOpen(true)}
          >
            填写饮食档案
          </Button>
        </Card>
      ) : (
        <Button
          variant="ghost"
          disabled={flow.busy}
          onPress={() => setProfileOpen(true)}
        >
          编辑饮食档案
        </Button>
      )}
      {flow.status ? (
        <Card>
          <Spinner accessibilityLabel="正在生成训练补给草稿" />
          <GenerationCancelButton cancellation={flow.cancellation} />
          <AppText className="mt-3">
            {flow.status === "QUEUED"
              ? "草稿正在排队"
              : "正在生成并校验补给草稿"}
          </AppText>
          <AppText variant="caption" muted>
            等待超时后可继续查询，离开页面不会应用草稿。
          </AppText>
        </Card>
      ) : null}
      {flow.proposal ? (
        <NutritionProposalCard
          proposal={flow.proposal}
          applying={flow.busy}
          validating={flow.busy}
          onValidate={() => void flow.validate()}
          onApply={() => void flow.apply()}
          onDismiss={() => router.back()}
          onEdit={setEditing}
        />
      ) : null}
      <Button
        loading={flow.busy && !flow.status}
        disabled={flow.busy || !flow.profile || !flow.state}
        onPress={() => void flow.generate(!!flow.proposal)}
      >
        {flow.proposal ? "重新生成训练补给草稿" : "生成训练补给草稿"}
      </Button>
      <AppText variant="caption" muted>
        进入页面、填写档案和读取范围均不会自动生成。暂不处理可继续沿用现有饮食。
      </AppText>
      <Button
        variant="secondary"
        disabled={flow.busy && !flow.status}
        onPress={() => router.back()}
      >
        暂不调整，返回
      </Button>
      <NutritionProfileSheet
        visible={profileOpen}
        profile={
          flow.profile ? profileInputFromResponse(flow.profile) : undefined
        }
        saving={flow.busy}
        error={flow.error}
        onClose={() => setProfileOpen(false)}
        onSave={async (input) => {
          if (await flow.saveProfile(input)) setProfileOpen(false);
        }}
      />
      {editing !== null && flow.proposal?.draft.items[editing] ? (
        <NutritionItemEditor
          key={`${flow.proposal.proposalVersion}-${editing}`}
          item={flow.proposal.draft.items[editing]}
          busy={flow.busy}
          onSave={(item) => flow.edit(editing, item)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </TrainingPage>
  );
}
