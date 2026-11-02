import { useCallback } from "react";
import { router } from "expo-router";
import { AppText, Button, Spinner } from "../../../components/ui";
import { assessmentsApi } from "../services/assessments.api";
import { useAssessmentResource } from "../hooks/useAssessmentResource";
import { AssessmentList } from "./AssessmentList";

export function GoalAssessments({
  goalId,
  canSchedule,
}: {
  goalId: string;
  canSchedule: boolean;
}) {
  const load = useCallback(
    (token: string) => assessmentsApi.list(token, { goalId }),
    [goalId],
  );
  const resource = useAssessmentResource(load);
  return (
    <>
      <AppText variant="section">阶段测试</AppText>
      {resource.loading && !resource.data ? (
        <Spinner accessibilityLabel="正在读取阶段测试" />
      ) : null}
      <AssessmentList items={resource.data ?? []} />
      {resource.error ? (
        <>
          <AppText className="text-negative">{resource.error}</AppText>
          <Button variant="secondary" onPress={resource.retry}>
            重试读取测试
          </Button>
        </>
      ) : null}
      {canSchedule ? (
        <Button
          variant="secondary"
          onPress={() =>
            router.push({ pathname: "/assessments/new", params: { goalId } })
          }
        >
          安排目标测试
        </Button>
      ) : null}
    </>
  );
}
