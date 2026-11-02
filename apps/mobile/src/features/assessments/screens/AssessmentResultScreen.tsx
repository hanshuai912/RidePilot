import { useCallback, useState } from "react";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useWatch, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Assessment, AssessmentPreview } from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useWorkoutActionExit } from "../../training/hooks/useWorkoutActionExit";
import { getProfile } from "../../profile/services/profile.api";
import { localDateInTimezone } from "../../coach/model/plan-dates";
import { assessmentsApi } from "../services/assessments.api";
import { useAssessmentResource } from "../hooks/useAssessmentResource";
import { useAssessmentMutation } from "../hooks/useAssessmentMutation";
import {
  AssessmentChoices,
  AssessmentField,
} from "../components/AssessmentFields";
import { AssessmentResultFields } from "../components/AssessmentResultFields";
import {
  resultFormSchema,
  resultPayload,
  resultStatuses,
  type ResultForm,
} from "../model/result-form";
import { assessmentKinds } from "../model/assessment";

export function AssessmentResultScreen() {
  const { assessmentId = "" } = useLocalSearchParams<{
    assessmentId?: string;
  }>();
  const load = useCallback(
    async (token: string) => {
      const [item, profile] = await Promise.all([
        assessmentsApi.get(token, assessmentId),
        getProfile(token),
      ]);
      return { item, today: localDateInTimezone(new Date(), profile.timezone) };
    },
    [assessmentId],
  );
  const resource = useAssessmentResource(load);
  return resource.data && resource.token ? (
    <ResultFormPage
      key={assessmentId}
      item={resource.data.item}
      today={resource.data.today}
      token={resource.token}
      refresh={resource.retry}
      refreshError={resource.error}
    />
  ) : (
    <TrainingPage
      title="记录测试"
      loading={resource.loading}
      error={resource.error}
      retry={resource.retry}
    />
  );
}

function ResultFormPage({
  item,
  today,
  token,
  refresh,
  refreshError,
}: {
  item: Assessment;
  today: string;
  token: string;
  refresh: () => void;
  refreshError: string | null;
}) {
  const form = useForm<ResultForm>({
    resolver: zodResolver(resultFormSchema(item.kind, today)),
    defaultValues: {
      status:
        item.status === "COMPLETED"
          ? "INVALID"
          : item.kind === "LEGACY"
            ? "SKIPPED"
            : "COMPLETED",
      protocol: item.protocol,
      actualDate:
        item.actualDate ?? (item.localDate <= today ? item.localDate : today),
      localDate: item.localDate,
      resultWatts: item.resultWatts?.toString() ?? "",
      durationSeconds: item.durationSeconds?.toString() ?? "",
      routeName: item.routeName ?? "",
      distanceKm: item.distanceKm?.toString() ?? "",
      source: item.source ?? "",
      rpe: item.rpe?.toString() ?? "",
      conditions: item.conditions ?? "",
      notes: item.notes ?? "",
      reason: "",
      comparableConditions: item.comparableConditions,
    },
  });
  const [preview, setPreview] = useState<{
    data: AssessmentPreview;
    signature: string;
  } | null>(null);
  const mutation = useAssessmentMutation();
  const focused = useIsFocused();
  const exit = useWorkoutActionExit(
    form.formState.isDirty && focused,
    mutation.busy && focused,
    "还有未保存的测试输入",
  );
  const values = useWatch({ control: form.control }) as ResultForm;
  const submit = form.handleSubmit(async (valid) => {
    let payload = resultPayload(item, valid);
    if (valid.status === "POSTPONED") {
      if (!item.goalId || item.kind === "LEGACY") return;
      const input = {
        goalId: item.goalId,
        stageId: item.stageId,
        kind: item.kind,
        protocol: item.protocol,
        localDate: valid.localDate,
        excludeId: item.id,
      };
      const signature = JSON.stringify(input);
      if (preview?.signature !== signature) {
        const result = await mutation.run(input, () =>
          assessmentsApi.preview(token, input),
        );
        if (result) setPreview({ data: result, signature });
        return;
      }
      payload = {
        ...payload,
        previewToken: preview.data.token,
        acknowledgeConflicts: true,
      };
    }
    const result = await mutation.run(payload, (key) =>
      assessmentsApi.patch(token, item.id, payload, key),
    );
    if (result)
      exit.finish({
        pathname: "/assessments/[assessmentId]",
        params: { assessmentId: item.id, saved: "1" },
      });
  });
  const editable =
    ["SCHEDULED", "POSTPONED", "INCOMPLETE"].includes(item.status) ||
    item.status === "COMPLETED";
  return (
    <TrainingPage
      title="记录测试"
      busy={mutation.busy}
      onBack={() =>
        router.canGoBack()
          ? router.back()
          : router.replace({
              pathname: "/assessments/[assessmentId]",
              params: { assessmentId: item.id },
            })
      }
    >
      {exit.guard}
      <Card>
        <AppText variant="card">
          {assessmentKinds[item.kind]} · {item.protocol}
        </AppText>
        <AppText muted className="mt-2">
          计划日期 {item.localDate} · 安排时 FTP{" "}
          {item.baselineFtpWatts ?? "未知"} W
        </AppText>
      </Card>
      {!editable ? (
        <AppText>该测试已结束，请返回查看复评。</AppText>
      ) : (
        <>
          <AssessmentChoices
            label="完成状态"
            options={
              item.status === "COMPLETED"
                ? { INVALID: "标记无效" }
                : item.kind === "LEGACY"
                  ? { SKIPPED: "跳过", INVALID: "无效" }
                  : resultStatuses
            }
            value={values.status}
            disabled={mutation.busy}
            onChange={(value) => {
              form.setValue("status", value, { shouldDirty: true });
              setPreview(null);
            }}
          />
          {values.status === "COMPLETED" ? (
            <AssessmentResultFields
              form={form}
              kind={item.kind}
              busy={mutation.busy}
            />
          ) : (
            <>
              {values.status === "POSTPONED" ? (
                <AssessmentField
                  label="新的测试日期"
                  value={values.localDate}
                  onChange={(value) => {
                    form.setValue("localDate", value, { shouldDirty: true });
                    setPreview(null);
                  }}
                  disabled={mutation.busy}
                />
              ) : null}
              {values.status === "INCOMPLETE" ? (
                <AssessmentField
                  label="实际测试日期"
                  value={values.actualDate}
                  onChange={(value) =>
                    form.setValue("actualDate", value, { shouldDirty: true })
                  }
                  disabled={mutation.busy}
                />
              ) : null}
              <AssessmentField
                label="原因"
                value={values.reason}
                onChange={(value) =>
                  form.setValue("reason", value, { shouldDirty: true })
                }
                disabled={mutation.busy}
              />
            </>
          )}
          {Object.entries(form.formState.errors).map(([key, error]) => (
            <AppText key={key} className="text-negative">
              {error.message}
            </AppText>
          ))}
          {preview && values.status === "POSTPONED" ? (
            <Card>
              <AppText variant="card">
                {preview.data.conflicts.length
                  ? "改期当天已有安排"
                  : "改期当天暂无冲突"}
              </AppText>
              {preview.data.conflicts.map((item) => (
                <AppText key={item.id}>{item.title}</AppText>
              ))}
              <AppText muted>
                已有课程与赛事会保留，请确认是否适合同时进行。
              </AppText>
              <Button
                className="mt-3"
                variant="secondary"
                disabled={mutation.busy}
                onPress={() => setPreview(null)}
              >
                重新预览改期
              </Button>
            </Card>
          ) : null}
          <AppText muted>
            保存测试结果不会更新 FTP 或课程；有效 FTP
            结果需在复评页单独确认更新。
          </AppText>
          <Button disabled={mutation.busy} onPress={() => void submit()}>
            {values.status === "POSTPONED"
              ? preview
                ? "确认改期并保留原安排"
                : "预览改期安排"
              : "保存测试记录"}
          </Button>
        </>
      )}
      {mutation.error || refreshError ? (
        <>
          <AppText className="text-negative">
            {mutation.error || refreshError}
          </AppText>
          <Button
            variant="secondary"
            disabled={mutation.busy}
            onPress={refresh}
          >
            刷新测试版本（保留输入）
          </Button>
        </>
      ) : null}
    </TrainingPage>
  );
}
