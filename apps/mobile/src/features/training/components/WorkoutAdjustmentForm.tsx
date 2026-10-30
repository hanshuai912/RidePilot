import React from "react";
import { Pressable, View } from "react-native";
import type { AdjustmentReason as Reason } from "../hooks/useWorkoutAdjustment";

import { AppText, Button, Card, Input } from "../../../components/ui";

const reasons: [Reason, string][] = [
  ["TIME_SHORT", "可用时间不够"],
  ["FATIGUE", "疲劳或睡眠不足"],
  ["WEATHER", "天气不适合"],
  ["SCHEDULE", "临时有事"],
  ["TOO_HARD", "课程太难"],
  ["MISSED", "之前漏练"],
];

export function WorkoutAdjustmentForm({
  loading,
  error,
  onClose,
  onSubmit,
  onDirtyChange,
  onChange,
}: {
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (reason: Reason, notes: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onChange: () => void;
}) {
  const [reason, setReason] = React.useState<Reason>("TIME_SHORT");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    onDirtyChange(reason !== "TIME_SHORT" || notes !== "");
  }, [reason, notes, onDirtyChange]);

  return (
    <View>
      <AppText className="mt-2 text-secondary">
        AI 会保留训练目的，先给出一份可预览的替代课程。
      </AppText>
      <Card className="mt-5">
        <AppText variant="card">发生了什么？</AppText>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {reasons.map(([value, label]) => (
            <Pressable
              key={value}
              disabled={loading}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === value }}
              className={`min-h-11 rounded-[13px] border px-3 py-3 ${reason === value ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
              onPress={() => {
                setReason(value);
                onChange();
              }}
            >
              <AppText className={reason === value ? "text-brand" : undefined}>
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card className="mt-4">
        <AppText variant="card">补充说明（选填）</AppText>
        <Input
          editable={!loading}
          className="mt-3"
          accessibilityLabel="调整原因补充说明"
          value={notes}
          onChangeText={(value) => {
            setNotes(value);
            onChange();
          }}
          maxLength={200}
          placeholder="例如：昨晚只睡了 5 小时"
        />
      </Card>
      {error ? (
        <AppText variant="caption" className="mt-3 text-negative">
          {error}
        </AppText>
      ) : null}
      <View className="mt-6">
        <Button
          size="lg"
          loading={loading}
          onPress={() => onSubmit(reason, notes)}
        >
          生成调整草稿
        </Button>
        <Button
          variant="secondary"
          className="mt-2"
          disabled={loading}
          onPress={onClose}
        >
          取消
        </Button>
      </View>
    </View>
  );
}
