import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button, Card, Dialog } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useUnsavedTraining } from "../../training/hooks/useUnsavedTraining";
import { assessmentsApi } from "../services/assessments.api";
import { useAssessmentResource } from "../hooks/useAssessmentResource";
import { useAssessmentMutation } from "../hooks/useAssessmentMutation";
import {
  assessmentKinds,
  assessmentStatuses,
  assessmentSources,
  assessmentResult,
} from "../model/assessment";

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
  const mutation = useAssessmentMutation();
  const [confirming, setConfirming] = useState(false);
  const [ftpSaved, setFtpSaved] = useState(false);
  const guard = useUnsavedTraining(false, "", mutation.busy);
  const data = resource.data;
  const item = data?.assessment;
  const confirmFtp = async () => {
    if (!resource.token || !data || !item) return;
    const input = {
      expectedVersion: item.version,
      expectedFtpId: data.currentFtp?.id ?? null,
    };
    const result = await mutation.run(input, (key) =>
      assessmentsApi.confirmFtp(resource.token!, item.id, input, key),
    );
    if (result) {
      setConfirming(false);
      setFtpSaved(true);
      resource.retry();
    }
  };
  return (
    <TrainingPage
      title="阶段测试"
      busy={mutation.busy}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/(tabs)/training")
      }
      loading={!data && resource.loading}
      error={!data ? resource.error : null}
      retry={resource.retry}
    >
      {guard}
      {data && item ? (
        <>
          {saved || ftpSaved ? (
            <AppText accessibilityLiveRegion="polite" className="text-positive">
              {ftpSaved ? "FTP 已确认保存" : "测试记录已保存"}
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
          <Card>
            <AppText variant="card">测试记录</AppText>
            <AppText className="mt-2">{assessmentResult(item)}</AppText>
            {item.source ? (
              <AppText muted className="mt-2">
                来源 {assessmentSources[item.source]} · RPE{" "}
                {item.rpe ?? "未记录"}
              </AppText>
            ) : null}
            {item.conditions ? (
              <AppText muted className="mt-2">
                条件：{item.conditions}
              </AppText>
            ) : null}
            {item.reason ? (
              <AppText className="mt-2">原因：{item.reason}</AppText>
            ) : null}
            {item.notes ? (
              <AppText muted className="mt-2">
                备注：{item.notes}
              </AppText>
            ) : null}
          </Card>
          {["SCHEDULED", "POSTPONED", "INCOMPLETE"].includes(item.status) ? (
            <Button
              onPress={() =>
                router.push({
                  pathname: "/assessments/result",
                  params: { assessmentId: item.id },
                })
              }
            >
              录入结果 / 调整状态
            </Button>
          ) : item.status === "COMPLETED" ? (
            <Button
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/assessments/result",
                  params: { assessmentId: item.id },
                })
              }
            >
              标记结果无效
            </Button>
          ) : null}
          <AppText variant="section">阶段复评</AppText>
          {item.stageId ? (
            <Button
              variant="secondary"
              disabled={mutation.busy}
              onPress={() =>
                router.push({
                  pathname: "/goals/stage-review",
                  params: { stageId: item.stageId! },
                })
              }
            >
              复评阶段达成条件与下一步
            </Button>
          ) : null}
          {data.previous ? (
            <Card>
              <AppText variant="card">
                上次可比结果 · {data.previous.actualDate}
              </AppText>
              <AppText className="mt-2">
                {assessmentResult(data.previous)}
              </AppText>
              {data.comparison?.wattsDelta !== null &&
              data.comparison?.wattsDelta !== undefined ? (
                <AppText className="mt-2">
                  功率差值 {data.comparison.wattsDelta > 0 ? "+" : ""}
                  {data.comparison.wattsDelta} W
                </AppText>
              ) : null}
              {data.comparison?.secondsDelta !== null &&
              data.comparison?.secondsDelta !== undefined ? (
                <AppText className="mt-2">
                  用时差值 {data.comparison.secondsDelta > 0 ? "+" : ""}
                  {data.comparison.secondsDelta} 秒
                </AppText>
              ) : null}
            </Card>
          ) : null}
          {data.training ? (
            <Card>
              <AppText variant="card">阶段训练记录</AppText>
              <AppText muted className="mt-2">
                {data.training.startDate} 至 {data.training.endDate}
              </AppText>
              <AppText className="mt-2">
                共 {data.training.total} 节 · 完成 {data.training.completed} ·
                部分完成 {data.training.partial} · 跳过 {data.training.skipped}{" "}
                · 未记录 {data.training.unrecorded}
              </AppText>
            </Card>
          ) : null}
          {data.messages.map((message) => (
            <AppText key={message} muted>
              {message}
            </AppText>
          ))}
          {data.canUpdateFtp ? (
            <Button
              disabled={mutation.busy || ftpSaved}
              onPress={() => setConfirming(true)}
            >
              确认更新 FTP
            </Button>
          ) : null}
          {item.goalId && item.status !== "SCHEDULED" ? (
            <Button
              variant="secondary"
              disabled={mutation.busy || resource.loading || !!resource.error}
              onPress={() =>
                router.push({
                  pathname: "/goals/[goalId]",
                  params: { goalId: item.goalId!, assessmentId: item.id },
                })
              }
            >
              选择后续阶段 / 课程范围
            </Button>
          ) : null}
          {ftpSaved ? (
            <AppText muted>
              FTP
              变化会使旧阶段草稿过期。请重新生成阶段安排，或按日期生成后续课程。
            </AppText>
          ) : null}
          {resource.error || mutation.error ? (
            <>
              <AppText className="text-negative">
                {resource.error || mutation.error}
              </AppText>
              <Button
                variant="secondary"
                disabled={mutation.busy}
                onPress={resource.retry}
              >
                刷新复评
              </Button>
            </>
          ) : null}
          <Dialog
            visible={confirming}
            title="更新 FTP"
            description={`将当前 FTP ${data.currentFtp?.valueWatts ?? "未设置"} W 更新为 ${item.resultWatts} W。历史课程保持原功率，新课程按当前 FTP 生成；阶段安排可能需要重新生成。`}
            onClose={() => {
              if (!mutation.busy) setConfirming(false);
            }}
            closeLabel="暂不更新"
          >
            <Button
              className="mt-4"
              disabled={mutation.busy}
              onPress={() => void confirmFtp()}
            >
              确认使用测试 FTP
            </Button>
            {mutation.error ? (
              <AppText className="mt-2 text-negative">{mutation.error}</AppText>
            ) : null}
          </Dialog>
        </>
      ) : null}
    </TrainingPage>
  );
}
