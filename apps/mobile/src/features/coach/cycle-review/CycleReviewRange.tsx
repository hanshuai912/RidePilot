import { useState } from "react";
import type { CycleReviewSnapshot } from "@ridepilot/contracts";
import { AppText, Button, Card, Input } from "../../../components/ui";
import { shiftCycleDate } from "./cycle-review.model";

export function CycleReviewRange({
  review,
  onSelect,
}: {
  review: CycleReviewSnapshot;
  onSelect: (range: { startDate: string; endDate: string }) => void;
}) {
  const [start, setStart] = useState(review.startDate),
    [end, setEnd] = useState(review.endDate);
  const monday = shiftCycleDate(
    review.localDate,
    -((new Date(`${review.localDate}T00:00:00Z`).getUTCDay() + 6) % 7),
  );
  return (
    <Card>
      <AppText variant="card">复盘时间范围</AppText>
      <Button
        variant="ghost"
        onPress={() =>
          onSelect({
            startDate: shiftCycleDate(review.localDate, -6),
            endDate: review.localDate,
          })
        }
      >
        最近七天
      </Button>
      <Button
        variant="ghost"
        onPress={() =>
          onSelect({ startDate: monday, endDate: review.localDate })
        }
      >
        本周至今天
      </Button>
      <Button
        variant="ghost"
        onPress={() =>
          onSelect({
            startDate: shiftCycleDate(monday, -7),
            endDate: shiftCycleDate(monday, -1),
          })
        }
      >
        上一个完整周
      </Button>
      <Input
        accessibilityLabel="复盘开始日期"
        value={start}
        onChangeText={setStart}
        placeholder="开始 YYYY-MM-DD"
      />
      <Input
        className="mt-2"
        accessibilityLabel="复盘结束日期"
        value={end}
        onChangeText={setEnd}
        placeholder="结束 YYYY-MM-DD"
      />
      <Button
        className="mt-2"
        variant="secondary"
        onPress={() => onSelect({ startDate: start, endDate: end })}
      >
        查看所选周期
      </Button>
      <AppText variant="caption" muted className="mt-2">
        可选择截至今天的连续 1–84 天；查看复盘不会生成或修改计划。
      </AppText>
    </Card>
  );
}
