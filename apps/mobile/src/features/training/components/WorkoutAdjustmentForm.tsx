import { addDays, isTrainingDate } from "../model/training";
import React from "react";
import { Pressable, View } from "react-native";
import type { AdjustmentReason as Reason } from "../hooks/useWorkoutAdjustment";

import { AppText, Button, Card, Input, Dialog } from "../../../components/ui";

const reasons: [Reason, string][] = [
  ["TIME_SHORT", "可用时间不够"],
  ["FATIGUE", "疲劳或睡眠不足"],
  ["WEATHER", "天气不适合"],
  ["SCHEDULE", "临时有事"],
  ["TOO_HARD", "课程太难"],
  ["MISSED", "之前漏练"],
];

export function WorkoutAdjustmentForm({
  scheduledDate,
  loading,
  error,
  onClose,
  onSubmit,
  onDirtyChange,
  onChange,
}: {
  scheduledDate: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (reason: Reason, notes: string, endDate?: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onChange: () => void;
}) {
  const [reason, setReason] = React.useState<Reason>("TIME_SHORT");
  const [scope, setScope] = React.useState<"SINGLE" | "FUTURE">("SINGLE");
  const [endDate, setEndDate] = React.useState(addDays(scheduledDate, 6));
  const [confirm, setConfirm] = React.useState(false);
  const validRange =
    isTrainingDate(endDate) &&
    endDate >= scheduledDate &&
    endDate <= addDays(scheduledDate, 83);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    onDirtyChange(
      reason !== "TIME_SHORT" || notes !== "" || scope !== "SINGLE",
    );
  }, [reason, notes, scope, onDirtyChange]);

  return (
    <View>
      <AppText className="mt-2 text-secondary">
        AI 会保留训练目的，先给出一份可预览的替代课程。
      </AppText>
      <Card className="mt-4">
        <AppText variant="card">调整范围</AppText>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Button
            variant={scope === "SINGLE" ? "primary" : "secondary"}
            disabled={loading}
            onPress={() => {
              setScope("SINGLE");
              onChange();
            }}
          >
            仅此课程
          </Button>
          <Button
            variant={scope === "FUTURE" ? "primary" : "secondary"}
            disabled={loading}
            onPress={() => {
              setScope("FUTURE");
              onChange();
            }}
          >
            联动后续课程
          </Button>
        </View>
        {scope === "FUTURE" ? (
          <>
            <AppText muted className="mt-3">
              从 {scheduledDate} 起重排至以下日期（最多 84
              天）。已记录课程保留；阶段、测试与补给需另行确认。
            </AppText>
            <Input
              accessibilityLabel="后续联动结束日期"
              value={endDate}
              editable={!loading}
              onChangeText={(value) => {
                setEndDate(value);
                onChange();
              }}
              placeholder="YYYY-MM-DD"
            />
            {!validRange ? (
              <AppText className="text-negative">
                请选择有效结束日期，范围不得超过 84 天
              </AppText>
            ) : null}
          </>
        ) : null}
      </Card>
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
      <Dialog
        visible={confirm}
        title="确认后续联动范围"
        description={`将为 ${scheduledDate} 至 ${endDate} 的未来未记录课程生成替代草稿。请在差异预览中核对全部受影响课程后再应用。`}
        onClose={() => setConfirm(false)}
      >
        <Button
          onPress={() => {
            setConfirm(false);
            onSubmit(reason, notes, endDate);
          }}
        >
          确认范围并生成草稿
        </Button>
      </Dialog>
      <View className="mt-6">
        <Button
          size="lg"
          loading={loading}
          disabled={scope === "FUTURE" && !validRange}
          onPress={() =>
            scope === "FUTURE" ? setConfirm(true) : onSubmit(reason, notes)
          }
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
