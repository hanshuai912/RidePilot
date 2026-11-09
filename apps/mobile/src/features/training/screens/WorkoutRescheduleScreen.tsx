import { useState } from "react";
import { router } from "expo-router";
import { AppText, Button, Card, Input } from "../../../components/ui";
import { TrainingNutritionLinkCard } from "../../nutrition/components/TrainingNutritionLinkCard";
import { TrainingPage } from "../components/TrainingPage";
import { useWorkoutActionRoute } from "../hooks/useWorkoutActionRoute";
import { useWorkoutActionExit } from "../hooks/useWorkoutActionExit";
import { useWorkoutReschedule } from "../hooks/useWorkoutReschedule";
import { addDays } from "../model/training";

export function WorkoutRescheduleScreen() {
  const route = useWorkoutActionRoute();
  const state = useWorkoutReschedule(route.token, route.data);
  const [inputDate, setDate] = useState<string | null>(null);
  const date =
    inputDate ?? (route.data ? addDays(route.data.scheduledDate, 1) : "");
  const exit = useWorkoutActionExit(false, state.busy);
  const finish = () =>
    exit.finish({
      pathname: "/(tabs)/training",
      params: {
        date: state.preview?.to,
        ...(state.applied ? { savedAt: String(Date.now()) } : {}),
      },
    });
  return (
    <TrainingPage
      title="课程改期"
      loading={route.loading}
      error={route.error}
      retry={route.retry}
      busy={state.busy}
      onBack={state.applied ? finish : route.back}
    >
      {exit.guard}
      {state.applied ? (
        <>
          <AppText>课程已改期；动作与强度保留，请查看最新日历。</AppText>
          <TrainingNutritionLinkCard
            dates={[state.preview!.from, state.preview!.to]}
          />
          <Button onPress={finish}>查看最新日历</Button>
        </>
      ) : route.data ? (
        <>
          <Card>
            <AppText variant="card">{route.data.title || "骑行训练"}</AppText>
            <AppText muted className="mt-2">
              原日期：{route.data.scheduledDate} ·{" "}
              {route.data.timeTargetMinutes ?? "未知"} 分钟
            </AppText>
          </Card>
          <AppText muted>
            选择新日期，先检查测试、比赛、固定休息日及当日可用时间。确认后创建新的正式计划版本。
          </AppText>
          <Input
            accessibilityLabel="课程改期日期"
            value={date}
            editable={!state.busy && !state.locked}
            onChangeText={(value) => {
              setDate(value);
              state.clear();
            }}
            placeholder="YYYY-MM-DD"
          />
          <Button
            variant="secondary"
            loading={state.busy}
            disabled={state.locked}
            onPress={() => void state.check(date)}
          >
            检查改期方案
          </Button>
          {state.preview ? (
            <Card>
              <AppText variant="card">
                改期预览：{state.preview.from} → {state.preview.to}
              </AppText>
              <AppText muted className="mt-2">
                仅移动此课程；其他课程保留。动作、强度和重复次数不变。
              </AppText>
              {state.preview.conflicts.length ? (
                state.preview.conflicts.map((message) => (
                  <AppText key={message} className="mt-2 text-warning">
                    {message}
                  </AppText>
                ))
              ) : (
                <AppText className="mt-2 text-positive">
                  当前检查无日程冲突，应用时会重新检查。
                </AppText>
              )}
              <AppText variant="card" className="mt-4">
                可选替代日期
              </AppText>
              {state.preview.alternatives.map((option) => (
                <Button
                  key={option.date}
                  variant="secondary"
                  className="mt-2"
                  disabled={state.busy || state.locked}
                  onPress={() => {
                    setDate(option.date);
                    void state.check(option.date);
                  }}
                >
                  {option.date} · 剩余 {option.availableMinutes} 分钟
                </Button>
              ))}
              {!state.preview.alternatives.length ? (
                <AppText muted className="mt-2">
                  后续 14 天未找到满足条件的其他日期，可另选日期再检查。
                </AppText>
              ) : null}
              <Button
                className="mt-4"
                loading={state.busy}
                disabled={!!state.preview.conflicts.length}
                onPress={() => void state.apply()}
              >
                {state.locked ? "重试确认此改期" : "确认应用改期"}
              </Button>
            </Card>
          ) : null}
          {state.error ? (
            <AppText className="text-negative">{state.error}</AppText>
          ) : null}
          {state.locked ? (
            <AppText muted>
              确认请求已发出；重试会沿用同一草稿和幂等键。若计划或日程已变化，请返回日历刷新后重新操作。
            </AppText>
          ) : null}
          <Button
            variant="secondary"
            disabled={state.busy}
            onPress={() => router.dismissTo("/(tabs)/training")}
          >
            返回训练日历
          </Button>
        </>
      ) : null}
    </TrainingPage>
  );
}
