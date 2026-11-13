import { View } from "react-native";
import type { ManualWorkoutDraft } from "@ridepilot/contracts";
import { AppText, Card, Disclosure } from "../../../components/ui";
import { segmentTotals, WorkoutSegmentList } from "./WorkoutSegmentList";
import { WorkoutProfileChart } from "./WorkoutProfileChart";
import { comparisonMaximums } from "../model/workout-profile";

export function WorkoutDiff({
  before,
  after,
}: {
  before: ManualWorkoutDraft;
  after: ManualWorkoutDraft;
}) {
  const oldTotals = segmentTotals(before.segments);
  const newTotals = segmentTotals(after.segments);
  const delta = newTotals.minutes - oldTotals.minutes;
  const maximums = comparisonMaximums(before.segments, after.segments);
  return (
    <Card>
      <AppText variant="card">详细变化</AppText>
      <AppText className="mt-2">
        日期：{before.scheduledDate} → {after.scheduledDate}
      </AppText>
      <AppText className="mt-2">
        时间目标：{oldTotals.minutes} → {newTotals.minutes} 分钟（
        {delta > 0 ? "+" : ""}
        {Math.round(delta * 100) / 100}）
      </AppText>
      <AppText className="mt-2">
        距离目标：{oldTotals.kilometers} → {newTotals.kilometers} 公里
      </AppText>
      <AppText className="mt-2">
        动作数：{before.segments.length} → {after.segments.length}
      </AppText>
      {([before, after] as const).map((workout, i) => (
        <View key={i} className="mt-4 gap-2">
          <AppText
            variant="label"
            className={i ? "text-brand" : "text-secondary"}
          >
            {i ? "调整后 · " : "原课程 · "}
            {workout.title || "骑行训练"}
          </AppText>
          <AppText muted>目的：{workout.purpose || "未填写"}</AppText>
          <WorkoutProfileChart
            segments={workout.segments}
            maximums={maximums}
          />
          <Disclosure title={i ? "查看调整后动作" : "查看原课程动作"}>
            <WorkoutSegmentList segments={workout.segments} />
          </Disclosure>
        </View>
      ))}
      <AppText muted className="mt-3">
        两图同单位使用相同强度刻度；横轴各自显示课程时长。展开可核对完整动作，距离不换算为时长。
      </AppText>
    </Card>
  );
}
