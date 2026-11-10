import { useCallback } from "react";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Plus } from "lucide-react-native";
import { AppText, Button, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
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
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-x-3">
        <AppText variant="section">阶段测试</AppText>
        {canSchedule ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="安排目标测试"
            className="min-h-11 min-w-11 flex-row items-center justify-center gap-1 rounded-xl px-2 active:bg-surface-2"
            onPress={() =>
              router.push({ pathname: "/assessments/new", params: { goalId } })
            }
          >
            <Plus color={colors.brand} size={16} />
            <AppText className="text-brand">安排测试</AppText>
          </Pressable>
        ) : null}
      </View>
      {resource.loading && !resource.data ? (
        <Spinner accessibilityLabel="正在读取阶段测试" />
      ) : null}
      {resource.data !== null ? <AssessmentList items={resource.data} /> : null}
      {resource.error ? (
        <>
          <AppText className="text-negative">{resource.error}</AppText>
          <Button variant="secondary" onPress={resource.retry}>
            重试读取测试
          </Button>
        </>
      ) : null}
    </View>
  );
}
