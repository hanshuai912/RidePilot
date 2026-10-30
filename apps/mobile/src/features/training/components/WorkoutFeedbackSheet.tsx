import React from "react";
import { Modal, Pressable, View } from "react-native";

import { AppText, Button, Card, Input } from "../../../components/ui";

type ActivityStatus = "COMPLETED" | "PARTIAL" | "SKIPPED";

export function WorkoutFeedbackSheet({
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
  onSubmit: (input: {
    status: ActivityStatus;
    durationMin: number | null;
    rpe: number | null;
    fatigue: number | null;
    notes: string;
  }) => void;
}) {
  const [status, setStatus] = React.useState<ActivityStatus>("COMPLETED");
  const [duration, setDuration] = React.useState("");
  const [rpe, setRpe] = React.useState("");
  const [fatigue, setFatigue] = React.useState("");
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
          训练反馈
        </AppText>
        <AppText variant="section" className="mt-2">
          记录这节训练实际完成情况
        </AppText>
        <Card className="mt-5">
          <AppText variant="card">完成状态</AppText>
          <View className="mt-3 flex-row gap-2">
            {(
              [
                ["COMPLETED", "完成"],
                ["PARTIAL", "部分完成"],
                ["SKIPPED", "跳过"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                disabled={loading}
                accessibilityRole="radio"
                accessibilityState={{ selected: status === value }}
                className={`min-h-11 flex-1 rounded-[13px] border px-2 py-3 ${status === value ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
                onPress={() => setStatus(value)}
              >
                <AppText
                  className={
                    status === value ? "text-center text-brand" : "text-center"
                  }
                >
                  {label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </Card>
        <Card className="mt-4">
          <AppText variant="card">实际训练（选填）</AppText>
          <View className="mt-3 flex-row gap-2">
            <Input
              editable={!loading}
              className="flex-1"
              accessibilityLabel="实际时长"
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
              placeholder="时长（分钟）"
            />
            <Input
              editable={!loading}
              className="flex-1"
              accessibilityLabel="主观用力程度"
              value={rpe}
              onChangeText={setRpe}
              keyboardType="number-pad"
              placeholder="RPE 1-10"
            />
          </View>
          <Input
            editable={!loading}
            className="mt-3"
            accessibilityLabel="疲劳程度"
            value={fatigue}
            onChangeText={setFatigue}
            keyboardType="number-pad"
            placeholder="疲劳 1-10"
          />
          <Input
            editable={!loading}
            className="mt-3"
            accessibilityLabel="训练反馈备注"
            value={notes}
            onChangeText={setNotes}
            maxLength={200}
            placeholder="例如：最后一组没有完成"
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
            onPress={() =>
              onSubmit({
                status,
                durationMin: duration.trim() ? Number(duration) : null,
                rpe: rpe.trim() ? Number(rpe) : null,
                fatigue: fatigue.trim() ? Number(fatigue) : null,
                notes,
              })
            }
          >
            保存训练反馈
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
