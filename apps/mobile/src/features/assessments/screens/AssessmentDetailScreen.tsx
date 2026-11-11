import { useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button, Card } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { assessmentsApi } from "../services/assessments.api";
import { useAssessmentResource } from "../hooks/useAssessmentResource";
import { assessmentKinds, assessmentStatuses } from "../model/assessment";

export function AssessmentDetailScreen() {
  const { assessmentId = "", saved } = useLocalSearchParams<{
    assessmentId?: string;
    saved?: string;
  }>();
  const load = useCallback(
    (token: string) => assessmentsApi.review(token, assessmentId),
    [assessmentId],
  );
  const resource = useAssessmentResource(load);
  const data = resource.data;
  const item = data?.assessment;
  return (
    <TrainingPage
      title="阶段测试"
      busy={false}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/(tabs)/training")
      }
      loading={!data && resource.loading}
      error={!data ? resource.error : null}
      retry={resource.retry}
    >
      {data && item ? (
        <>
          {saved ? (
            <AppText accessibilityLiveRegion="polite" className="text-positive">
              测试建议已保存
            </AppText>
          ) : null}
          <Card>
            <AppText variant="label" className="text-brand">
              {assessmentStatuses[item.status]}
            </AppText>
            <AppText variant="section" className="mt-2">
              {assessmentKinds[item.kind]}
            </AppText>
            <AppText className="mt-2">{item.protocol}</AppText>
            <AppText muted className="mt-2">
              {data.goalTitle ?? "未关联目标"} ·{" "}
              {data.stageTitle ?? "未关联阶段"}
            </AppText>
            <AppText muted className="mt-2">
              计划 {item.localDate}
              {item.actualDate ? ` · 实际 ${item.actualDate}` : ""}
            </AppText>
            <AppText muted className="mt-2">
              安排时 FTP {item.baselineFtpWatts ?? "未知"} W · 当前 FTP{" "}
              {data.currentFtp?.valueWatts ?? "未设置"} W
            </AppText>
          </Card>
          <AppText variant="section">测试用途</AppText>
          <AppText muted>
            测试只用于提醒你在建议时间自行检查身体状态。无需在 App
            录入结果或完成复评；需要调整课程时，请直接更新个人资料。
          </AppText>
          {resource.error ? (
            <>
              <AppText className="text-negative">{resource.error}</AppText>
              <Button variant="secondary" onPress={resource.retry}>
                刷新测试建议
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </TrainingPage>
  );
}
