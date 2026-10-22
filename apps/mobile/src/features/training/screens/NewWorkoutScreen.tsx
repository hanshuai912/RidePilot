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
  const proceed = () => {
    if (!valid) {
      setFeedback("请选择当天或未来的有效日期（YYYY-MM-DD）");
      return;
    }
    if (!resource.data || resource.loading) return;
    const draftId = create(date, resource.data.ftpAvailable);
    router.push({ pathname: "/workouts/editor", params: { draftId } });
  };
  return (
    <TrainingPage error={resource.error} retry={resource.retry}>
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
      {resource.loading ? <AppText>正在查询当天课程…</AppText> : null}
      {feedback ? <AppText>{feedback}</AppText> : null}
    </TrainingPage>
  );
}
