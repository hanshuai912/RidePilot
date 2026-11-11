import { useState } from "react";
import { Pressable, View } from "react-native";
import type { StageReviewInput } from "@ridepilot/contracts";
import { AppText, Button, Card, Input } from "../../../components/ui";
import type { useStageReview } from "../hooks/useStageReview";
import { decisionLabels, outcomeLabels } from "../model/goal-lifecycle";
import { GoalInfoButton } from "./GoalInfoButton";

function ReviewChoices<T extends string>({
  options,
  value,
  disabled,
  onChange,
  columns = false,
}: {
  options: Record<T, string>;
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
  columns?: boolean;
}) {
  return (
    <View className={columns ? "flex-row flex-wrap gap-2" : "gap-2"}>
      {(Object.keys(options) as T[]).map((key) => (
        <Pressable
          key={key}
          accessibilityRole="radio"
          accessibilityLabel={options[key]}
          accessibilityState={{ checked: value === key, disabled }}
          aria-checked={value === key}
          aria-disabled={disabled}
          disabled={disabled}
          onPress={() => onChange(key)}
          style={columns ? { flexBasis: "44%", flexGrow: 1 } : undefined}
          className={`min-h-[52px] justify-center rounded-xl border px-4 py-3 ${value === key ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
        >
          <AppText className={value === key ? "text-brand" : "text-secondary"}>
            {options[key]}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

export function StageReviewForm({
  flow: s,
  busy,
}: {
  flow: ReturnType<typeof useStageReview>;
  busy: boolean;
}) {
  const [editingCriteria, setEditingCriteria] = useState(
    !s.data?.snapshot.criteria,
  );
  const criteriaChanged =
    s.criteria.trim() !== (s.data?.snapshot.criteria ?? "");
  return (
    <View className="gap-6">
      <Card className="gap-3 p-5">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center">
            <AppText variant="card">阶段达成条件</AppText>
            <GoalInfoButton
              title="阶段条件说明"
              description="用可观察、可核对的条件复评当前阶段。修改条件后先单独保存，再预览复评决定；没有条件时只能记录证据不足。保存条件不会改变正式课程或目标完成状态。"
            />
          </View>
          {!editingCriteria ? (
            <Button
              variant="ghost"
              size="sm"
              accessibilityLabel="编辑达成条件"
              disabled={busy}
              onPress={() => setEditingCriteria(true)}
            >
              编辑
            </Button>
          ) : null}
        </View>
        {editingCriteria ? (
          <>
            <Input
              accessibilityLabel="阶段达成条件"
              value={s.criteria}
              onChangeText={s.setCriteria}
              maxLength={300}
              multiline
              editable={!busy}
              className="min-h-[96px] py-3"
              textAlignVertical="top"
              placeholder="填写可观察、可核对的阶段达成条件"
            />
            <View className="flex-row flex-wrap justify-end gap-2">
              {s.data?.snapshot.criteria ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onPress={() => {
                    s.setCriteria(s.data!.snapshot.criteria ?? "");
                    setEditingCriteria(false);
                  }}
                >
                  取消编辑
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !criteriaChanged || !s.criteria.trim()}
                onPress={() => void s.saveCriteria()}
              >
                保存达成条件
              </Button>
            </View>
            {criteriaChanged ? (
              <AppText variant="caption" className="text-warning">
                请先保存修改后的条件，再预览复评。
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText>{s.criteria}</AppText>
        )}
      </Card>
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <AppText variant="section">本次结论</AppText>
          <GoalInfoButton
            title="复评结论说明"
            description="根据阶段条件与实际证据选择结论，日期结束和训练完成率不代表达成。证据不足时可以如实记录；确认复评不会自动更新 FTP、推进阶段或修改课程。"
          />
        </View>
        <ReviewChoices<StageReviewInput["outcome"]>
          options={outcomeLabels}
          value={s.outcome}
          disabled={busy}
          onChange={s.setOutcome}
        />
      </View>
      <View className="gap-3">
        <AppText variant="section">选择下一步</AppText>
        <ReviewChoices<StageReviewInput["decision"]>
          options={decisionLabels}
          value={s.decision}
          disabled={busy}
          onChange={s.setDecision}
          columns
        />
      </View>
      <Card className="gap-3 p-5">
        <AppText variant="card">理由与证据</AppText>
        <Input
          accessibilityLabel="复评理由与证据"
          value={s.rationale}
          onChangeText={s.setRationale}
          maxLength={500}
          multiline
          editable={!busy}
          className="min-h-[120px] py-3"
          textAlignVertical="top"
          placeholder="填写实际表现与判断依据"
        />
      </Card>
      <Button
        size="lg"
        loading={s.busy}
        disabled={busy}
        onPress={() => void s.prepare()}
      >
        预览本次复评决定
      </Button>
    </View>
  );
}
