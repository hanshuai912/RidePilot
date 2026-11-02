import { router } from "expo-router";
import type { Assessment } from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { assessmentKinds, assessmentStatuses } from "../model/assessment";

export function AssessmentList({
  items,
  empty = "尚未安排阶段测试",
}: {
  items: Assessment[];
  empty?: string;
}) {
  return items.length ? (
    <>
      {items.map((item) => (
        <Card key={item.id}>
          <AppText variant="card">
            {assessmentKinds[item.kind]} · {assessmentStatuses[item.status]}
          </AppText>
          <AppText muted className="mt-2">
            {item.localDate} · {item.protocol}
          </AppText>
          <Button
            variant="secondary"
            className="mt-3"
            onPress={() =>
              router.push({
                pathname: "/assessments/[assessmentId]",
                params: { assessmentId: item.id },
              })
            }
          >
            查看测试
          </Button>
        </Card>
      ))}
    </>
  ) : (
    <AppText muted>{empty}</AppText>
  );
}
