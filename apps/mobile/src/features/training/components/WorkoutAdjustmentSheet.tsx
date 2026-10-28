import React from "react";
import { Modal, Pressable, View } from "react-native";
import type { WeekGenerationInput } from "@ridepilot/contracts";

import { AppText, Button, Card, Input } from "../../../components/ui";

type Reason = NonNullable<WeekGenerationInput["reason"]>;

const reasons: [Reason, string][] = [
  ["TIME_SHORT", "今天时间不够"],
  ["FATIGUE", "疲劳或睡眠不足"],
  ["WEATHER", "天气不适合"],
  ["SCHEDULE", "临时有事"],
  ["TOO_HARD", "课程太难"],
  ["MISSED", "之前漏练"],
];

export function WorkoutAdjustmentSheet({
  visible,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (reason: Reason, notes: string) => void;
}) {
  const [reason, setReason] = React.useState<Reason>("TIME_SHORT");
  const [notes, setNotes] = React.useState("");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background px-5 pb-8 pt-3">
        <View className="mx-auto mb-5 h-1 w-9 rounded-full bg-muted" />
        <AppText variant="label" className="text-brand">
          AI 快捷调整
        </AppText>
        <AppText variant="section" className="mt-2">
          只调整这节课程
        </AppText>
        <AppText className="mt-2 text-secondary">
          AI 会保留训练目的，先给出一份可预览的替代课程。
        </AppText>
        <Card className="mt-5">
          <AppText variant="card">发生了什么？</AppText>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {reasons.map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: reason === value }}
                className={`min-h-11 rounded-[13px] border px-3 py-3 ${reason === value ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
                onPress={() => setReason(value)}
              >
                <AppText
                  className={reason === value ? "text-brand" : undefined}
                >
                  {label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Card>
        <Card className="mt-4">
          <AppText variant="card">补充说明（选填）</AppText>
          <Input
            className="mt-3"
            accessibilityLabel="调整原因补充说明"
            value={notes}
            onChangeText={setNotes}
            maxLength={200}
            placeholder="例如：昨晚只睡了 5 小时"
          />
        </Card>
        {error ? (
          <AppText variant="caption" className="mt-3 text-negative">
            {error}
          </AppText>
        ) : null}
        <View className="mt-auto">
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
    </Modal>
  );
}
