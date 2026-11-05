import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  raceResultInputSchema,
  type RaceResultInput,
} from "@ridepilot/contracts";
import { AppText, Button, Card, Input } from "../../../components/ui";
import type { coachApi } from "../../coach/services/coach.api";

type Result = Awaited<ReturnType<typeof coachApi.raceResult>>;
export function RaceResultCard({
  raceId,
  raceDate,
  result,
  busy,
  onSave,
}: {
  raceId: string;
  raceDate: string;
  result: Result;
  busy: boolean;
  onSave: (input: RaceResultInput) => Promise<void>;
}) {
  const [status, setStatus] = useState<RaceResultInput["status"]>(
    result?.status ?? "COMPLETED",
  );
  const [actualDate, setActualDate] = useState(result?.actualDate ?? raceDate);
  const [duration, setDuration] = useState(
    String(result?.durationSeconds ?? ""),
  );
  const [rpe, setRpe] = useState(String(result?.rpe ?? ""));
  const [fatigue, setFatigue] = useState(String(result?.fatigue ?? ""));
  const [notes, setNotes] = useState(result?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const parsed = raceResultInputSchema.safeParse({
      status,
      actualDate,
      durationSeconds: duration ? Number(duration) : null,
      rpe: rpe ? Number(rpe) : null,
      fatigue: fatigue ? Number(fatigue) : null,
      notes: notes || null,
      expectedVersion: result?.version,
    });
    if (!parsed.success) {
      setError("请检查实际日期、用时，以及 1–10 的 RPE 和疲劳评分");
      return;
    }
    setError(null);
    void onSave(parsed.data);
  };
  return (
    <Card>
      <AppText variant="card">赛后结果</AppText>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {(
          [
            ["COMPLETED", "完成"],
            ["PARTIAL", "部分完成"],
            ["DNS", "未出发"],
            ["DNF", "未完赛"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            disabled={busy}
            variant={value === status ? "primary" : "secondary"}
            onPress={() => setStatus(value)}
          >
            {label}
          </Button>
        ))}
      </View>
      <AppText className="mt-4">实际日期</AppText>
      <Input
        accessibilityLabel="比赛实际日期"
        editable={!busy}
        value={actualDate}
        onChangeText={setActualDate}
        placeholder="YYYY-MM-DD"
      />
      <AppText className="mt-4">用时（秒，可选）</AppText>
      <Input
        accessibilityLabel="比赛用时"
        editable={!busy}
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
      />
      <View className="mt-3 flex-row gap-2">
        <Input
          accessibilityLabel="比赛 RPE"
          editable={!busy}
          className="flex-1"
          value={rpe}
          onChangeText={setRpe}
          keyboardType="number-pad"
          placeholder="RPE 1-10"
        />
        <Input
          accessibilityLabel="比赛疲劳"
          editable={!busy}
          className="flex-1"
          value={fatigue}
          onChangeText={setFatigue}
          keyboardType="number-pad"
          placeholder="疲劳 1-10"
        />
      </View>
      <Input
        accessibilityLabel="比赛感受"
        editable={!busy}
        className="mt-3"
        value={notes}
        onChangeText={setNotes}
        placeholder="比赛感受和异常情况"
        maxLength={500}
      />
      {error ? <AppText className="mt-2 text-negative">{error}</AppText> : null}
      <Button className="mt-4" loading={busy} onPress={save}>
        {result ? "更新结果" : "保存结果"}
      </Button>
      <AppText variant="caption" muted className="mt-2">
        保存结果不会自动修改训练，可选择从今天开始的范围生成恢复草稿。
      </AppText>
      {result ? (
        <Button
          className="mt-3"
          variant="secondary"
          disabled={busy}
          onPress={() =>
            router.push({
              pathname: "/races/proposal",
              params: { raceId, recovery: "1" },
            })
          }
        >
          生成赛后恢复草稿
        </Button>
      ) : null}
    </Card>
  );
}
