import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppText } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { DateStep } from "../components/DateStep";
import { TrainingPage, backToTraining } from "../components/TrainingPage";
import { useTrainingDrafts } from "../hooks/TrainingDraftProvider";
import { useTrainingResource } from "../hooks/useTrainingResource";
import { isTrainingDate, iso } from "../model/training";
import { trainingApi } from "../services/training.api";
import { useFtpRequirement } from "../hooks/useFtpRequirement";
import { FtpRequiredState } from "../components/FtpRequiredState";

export function NewWorkoutScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = iso(new Date());
  const [date, setDate] = useState(
    params.date && isTrainingDate(params.date) && params.date >= today
      ? params.date
      : today,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const { session } = useAuth();
  const token = session?.accessToken;
  const { create } = useTrainingDrafts();
  const valid = isTrainingDate(date) && date >= today;
  const load = useCallback(async () => {
    if (!token || !valid) return null;
    return trainingApi.getCalendar(token, date, date);
  }, [token, date, valid]);
  const resource = useTrainingResource(load);
  const ftp = useFtpRequirement();
  const proceed = () => {
    if (!valid) {
      setFeedback("请选择当天或未来的有效日期（YYYY-MM-DD）");
      return;
    }
    if (!resource.data || resource.loading || !ftp.available || ftp.error)
      return;
    const draftId = create(date, true);
    router.push({ pathname: "/workouts/editor", params: { draftId } });
  };
  return (
    <TrainingPage
      title="添加计划"
      onBack={backToTraining}
      error={resource.error ?? ftp.error}
      retry={() => {
        resource.retry();
        ftp.retry();
      }}
      loading={ftp.available === null && !ftp.error}
    >
      {ftp.available === false ? (
        <FtpRequiredState />
      ) : (
        <DateStep
          date={date}
          workouts={resource.data?.items ?? []}
          onBack={backToTraining}
          onChange={(value) => {
            setDate(value);
            setFeedback(null);
          }}
          onContinue={proceed}
        />
      )}
      {resource.loading ? <AppText>正在查询当天课程…</AppText> : null}
      {feedback ? <AppText>{feedback}</AppText> : null}
    </TrainingPage>
  );
}
