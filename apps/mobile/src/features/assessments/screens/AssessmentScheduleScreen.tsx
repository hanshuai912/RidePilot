import { useCallback, useState } from "react";
import { View } from "react-native";
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
import { AssessmentScheduleForm } from "../components/AssessmentScheduleForm";
import { AssessmentSchedulePreview } from "../components/AssessmentSchedulePreview";

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
        preview
          ? setPreview(null)
          : router.canGoBack()
            ? router.back()
            : router.replace("/goals")
      }
      loading={!data && resource.loading}
      error={!data ? resource.error : null}
      retry={resource.retry}
    >
      {exit.guard}
      {data ? (
        <View className="gap-6 py-3">
          <Card className="flex-row items-center gap-4 p-5">
            <View className="min-w-0 flex-1 gap-2">
              <AppText variant="caption" className="text-secondary">
                综合训练测试
              </AppText>
              <AppText variant="card">
                {data.stage?.title ?? "全部进行中目标"}
              </AppText>
            </View>
            {data.ftp ? (
              <View className="items-end gap-1 border-l border-divider pl-4">
                <AppText variant="caption" className="text-secondary">
                  当前 FTP
                </AppText>
                <AppText variant="title" className="tabular-nums">
                  {data.ftp.valueWatts}
                  <AppText variant="caption" className="text-secondary">
                    {" "}
                    W
                  </AppText>
                </AppText>
              </View>
            ) : null}
          </Card>
          {resource.error ? (
            <View className="gap-2">
              <AppText accessibilityRole="alert" className="text-negative">
                {resource.error}
              </AppText>
              <Button
                variant="ghost"
                disabled={mutation.busy}
                onPress={resource.retry}
              >
                重试读取测试条件
              </Button>
            </View>
          ) : null}
          {!data.ftp ? (
            <FtpRequiredState />
          ) : (
            <>
              {preview ? (
                <AssessmentSchedulePreview
                  values={input}
                  preview={preview}
                  disabled={mutation.busy}
                  onEdit={() => setPreview(null)}
                />
              ) : (
                <AssessmentScheduleForm
                  values={input}
                  today={data.today}
                  disabled={mutation.busy}
                  prior={prior}
                  errors={form.formState.errors}
                  onChange={update}
                />
              )}
              {mutation.error ? (
                <AppText accessibilityRole="alert" className="text-negative">
                  {mutation.error}
                </AppText>
              ) : null}
              <Button
                size="lg"
                loading={mutation.busy}
                disabled={mutation.busy}
                onPress={() => void (preview ? confirm() : submitPreview())}
              >
                {preview
                  ? preview.conflicts.length
                    ? "保留原安排并确认测试"
                    : "确认安排测试"
                  : "预览测试安排"}
              </Button>
            </>
          )}
        </View>
      ) : null}
    </TrainingPage>
  );
}
