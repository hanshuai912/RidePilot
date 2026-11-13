import React from "react";
import { Pressable, View } from "react-native";

import { AppText, Button, Card, Input } from "../../../components/ui";

export type ActivityStatus = "COMPLETED" | "PARTIAL" | "SKIPPED";

export function WorkoutFeedbackForm({
  loading,
  error,
  onClose,
  onSubmit,
  onDirtyChange,
}: {
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
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

  React.useEffect(() => {
    onDirtyChange(
      status !== "COMPLETED" ||
        [duration, rpe, fatigue, notes].some((value) => value !== ""),
    );
  }, [status, duration, rpe, fatigue, notes, onDirtyChange]);

  return (
    <View>
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
        <View className="mt-3 gap-2">
          <AppText variant="caption">实际时长（分钟）</AppText>
          <Input
            editable={!loading}
            accessibilityLabel="实际时长"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            placeholder="时长（分钟）"
          />
          <AppText variant="caption">主观用力程度 RPE（1–10）</AppText>
          <AppText variant="caption" muted>
            评价本次训练有多吃力，1 最轻松，10 最吃力。
          </AppText>
          <Input
            editable={!loading}
            accessibilityLabel="主观用力程度"
            value={rpe}
            onChangeText={setRpe}
            keyboardType="number-pad"
            placeholder="RPE 1-10"
          />
        </View>
        <AppText variant="caption" className="mt-3">
          训练后疲劳程度（1–10）
        </AppText>
        <AppText variant="caption" muted>
          评价身体的疲劳感，1 最低，10 最高。
        </AppText>
        <Input
          editable={!loading}
          className="mt-3"
          accessibilityLabel="疲劳程度"
          value={fatigue}
          onChangeText={setFatigue}
          keyboardType="number-pad"
          placeholder="疲劳 1-10"
        />
        <AppText variant="caption" className="mt-3">
          训练备注（选填）
        </AppText>
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
      <View className="mt-6">
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
  );
}
