import { useCallback, useState } from "react";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useWatch, useForm, type FieldPathValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  assessmentScheduleSchema,
  type AssessmentSchedule,
  type AssessmentPreview,
} from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { FtpRequiredState } from "../../training/components/FtpRequiredState";
import { useWorkoutActionExit } from "../../training/hooks/useWorkoutActionExit";
import { coachApi } from "../../coach/services/coach.api";
import { localDateInTimezone } from "../../coach/model/plan-dates";
import { getProfile } from "../../profile/services/profile.api";
import { goalsApi } from "../../goals/services/goals.api";
import { assessmentsApi } from "../services/assessments.api";
import { useAssessmentResource } from "../hooks/useAssessmentResource";
import { useAssessmentMutation } from "../hooks/useAssessmentMutation";
import {
  AssessmentChoices,
  AssessmentField,
} from "../components/AssessmentFields";
import { assessmentResult } from "../model/assessment";

export function AssessmentScheduleScreen() {
  const {
    goalId = "",
    stageId,
    date,
  } = useLocalSearchParams<{
    goalId?: string;
    stageId?: string;
    date?: string;
  }>();
  const load = useCallback(
    async (token: string) => {
      const [goal, stages, ftp, profile, tests] = await Promise.all([
        coachApi.goal(token, goalId),
        goalsApi.activeStages(token, goalId),
        coachApi.ftp(token),
        getProfile(token),
        assessmentsApi.list(token),
      ]);
      return {
        goal,
        stage: stages?.stages.find((item) => item.id === stageId),
        ftp,
        today: localDateInTimezone(new Date(), profile.timezone),
        tests,
      };
    },
    [goalId, stageId],
  );
  const resource = useAssessmentResource(load);
  const mutation = useAssessmentMutation();
  const focused = useIsFocused();
  const [preview, setPreview] = useState<AssessmentPreview | null>(null);
  const form = useForm<AssessmentSchedule>({
    resolver: zodResolver(assessmentScheduleSchema),
    defaultValues: {
      goalId,
      stageId: stageId ?? null,
      localDate: date ?? "",
      kind: "FTP",
      protocol: "",
    },
  });
  const exit = useWorkoutActionExit(
    form.formState.isDirty && focused,
    mutation.busy && focused,
    "还有未保存的测试输入",
  );
  const values = useWatch({ control: form.control }) as AssessmentSchedule;
  const update = <K extends keyof AssessmentSchedule>(
    key: K,
    value: AssessmentSchedule[K],
  ) => {
    setPreview(null);
    form.setValue(key, value as FieldPathValue<AssessmentSchedule, K>, {
      shouldDirty: true,
    });
  };
  const input = {
    ...values,
    localDate: values.localDate || resource.data?.today || "",
  };
  const submitPreview = async () => {
    form.setValue("localDate", input.localDate);
    await form.handleSubmit(async (valid) => {
      if (!resource.token) return;
      const result = await mutation.run({ preview: valid }, () =>
        assessmentsApi.preview(resource.token!, valid),
      );
      if (result) setPreview(result);
    })();
  };
  const confirm = async () => {
    if (!preview || !resource.token) return;
    const payload = {
      ...input,
      previewToken: preview.token,
      acknowledgeConflicts: true,
    };
    const item = await mutation.run(payload, (key) =>
      assessmentsApi.create(resource.token!, payload, key),
    );
    if (item)
      exit.finish({
        pathname: "/assessments/[assessmentId]",
        params: { assessmentId: item.id, saved: "1" },
      });
  };
  const data = resource.data;
  const prior = data?.tests
    .slice()
    .sort((a, b) => (b.actualDate ?? "").localeCompare(a.actualDate ?? ""))
    .find(
      (item) =>
        item.kind === values.kind &&
        item.protocol === values.protocol &&
        item.status === "COMPLETED",
    );
  return (
    <TrainingPage
      title="安排测试"
      busy={mutation.busy}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/goals")
      }
      loading={!data && resource.loading}
      error={!data ? resource.error : null}
      retry={resource.retry}
    >
      {exit.guard}
      {data ? (
        <>
          <Card>
            <AppText variant="card">综合训练测试</AppText>
            <AppText muted className="mt-2">
              {data.stage?.title ?? "全部进行中目标"}
            </AppText>
            <AppText muted className="mt-2">
              当前 FTP {data.ftp?.valueWatts ?? "未设置"} W
            </AppText>
          </Card>
          {!data.ftp ? (
            <FtpRequiredState />
          ) : (
            <>
              <AssessmentChoices
                label="测试类型"
                options={{
                  FTP: "FTP 测试",
                  POWER_DURATION: "持续输出",
                  FIXED_ROUTE: "固定路线",
                }}
                value={values.kind}
                onChange={(value) => update("kind", value)}
                disabled={mutation.busy}
              />
              <AssessmentField
                label="计划日期"
                value={input.localDate}
                placeholder="YYYY-MM-DD"
                onChange={(value) => update("localDate", value)}
                disabled={mutation.busy}
              />
              <AssessmentField
                label="测试方法 / 协议"
                value={values.protocol}
                placeholder="填写设备测试方案或固定测试方法"
                maxLength={64}
                onChange={(value) => update("protocol", value)}
                disabled={mutation.busy}
              />
              <AppText muted>
                状态不适合时可改期、跳过或记录未完成，不需要强行完成测试。使用你熟悉且适合当前状态的测试方案。FTP
                测试填写方案给出的最终 FTP；仅有平均功率时选择持续输出。
              </AppText>
              {prior ? (
                <AppText muted>
                  最近同类记录：{prior.actualDate} · {assessmentResult(prior)}
                  。复评时还会检查来源及条件是否可比。
                </AppText>
              ) : (
                <AppText muted>
                  暂无同方法的有效历史结果，本次可建立基线。
                </AppText>
              )}
              {Object.entries(form.formState.errors).map(([key, error]) => (
                <AppText key={key} className="text-negative">
                  请检查
                  {key === "protocol"
                    ? "测试方法"
                    : key === "localDate"
                      ? "日期格式"
                      : "测试条件"}
                  ：{error.message}
                </AppText>
              ))}
              <Button
                disabled={mutation.busy}
                onPress={() => void submitPreview()}
              >
                预览测试安排
              </Button>
              {preview ? (
                <Card>
                  <AppText variant="card">
                    {preview.conflicts.length ? "同日已有安排" : "同日暂无冲突"}
                  </AppText>
                  {preview.conflicts.map((item) => (
                    <AppText key={item.id} className="mt-2">
                      {item.title}
                    </AppText>
                  ))}
                  <AppText muted className="mt-3">
                    确认仅添加测试日程，已有课程与赛事会保留。如不适合同时进行，请修改日期后重新预览。
                  </AppText>
                  <Button
                    className="mt-3"
                    disabled={mutation.busy}
                    onPress={() => void confirm()}
                  >
                    {preview.conflicts.length
                      ? "保留原安排并确认测试"
                      : "确认安排测试"}
                  </Button>
                </Card>
              ) : null}
            </>
          )}
          {mutation.error || resource.error ? (
            <AppText className="text-negative">
              {mutation.error || resource.error}
            </AppText>
          ) : null}
        </>
      ) : null}
    </TrainingPage>
  );
}
