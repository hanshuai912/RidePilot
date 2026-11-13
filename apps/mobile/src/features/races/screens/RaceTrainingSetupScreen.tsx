import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button, Card } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import {
  BasicsStep,
  GoalStep,
  ScheduleStep,
} from "../../coach/components/InitialPlanSteps";
import { useInitialPlan } from "../../coach/hooks/useInitialPlan";
import {
  firstMissingStep,
  missingTrainingData,
} from "../../coach/model/readiness";

export function RaceTrainingSetupScreen() {
  const {
    raceId = "",
    recovery,
    phase,
  } = useLocalSearchParams<{
    raceId?: string;
    recovery?: string;
    phase?: string;
  }>();
  const flow = useInitialPlan();
  const { resources } = flow;
  const step = resources
    ? firstMissingStep(resources.readiness.missingFields)
    : "basics";
  const ready = resources?.readiness.ready;
  const resume = () =>
    router.dismissTo({
      pathname: "/races/proposal",
      params: {
        raceId,
        ...(recovery ? { recovery } : {}),
        ...(phase ? { phase } : {}),
      },
    });
  const save = () => {
    if (step === "basics") void flow.nextFromBasics();
    else if (step === "goal") void flow.nextFromGoal();
    else void flow.nextFromSchedule();
  };
  return (
    <TrainingPage
      title="备赛基本信息"
      loading={flow.loading && !resources}
      error={!resources ? flow.error : undefined}
      retry={() => void flow.refresh()}
      busy={flow.busy}
    >
      {resources ? (
        <>
          <Card>
            <AppText variant="card">
              {ready ? "备赛资料已齐全" : "补全备赛所需资料"}
            </AppText>
            <AppText muted className="mt-2">
              {ready
                ? "返回本赛事后，点击生成即可创建训练草稿，预览确认后才会应用。"
                : `还需要：${missingTrainingData(resources.readiness.missingFields)}。已填写的信息会自动复用。`}
            </AppText>
          </Card>
          {!ready && step === "basics" ? (
            <BasicsStep
              disabled={flow.busy}
              experience={flow.experience}
              setExperience={flow.setExperience}
              ftpWatts={resources.ftpWatts}
              profile={resources.profile}
              onFtp={() => router.push("/cycling-power-zones")}
              onProfile={() => router.push("/personal-info")}
              showTrainingStatus={false}
              bodyStatus={flow.bodyStatus}
              setBodyStatus={flow.setBodyStatus}
              bodyNote={flow.bodyNote}
              setBodyNote={flow.setBodyNote}
              symptomFlags={flow.symptomFlags}
              setSymptomFlags={flow.setSymptomFlags}
            />
          ) : null}
          {!ready && step === "goal" ? (
            <>
              <GoalStep
                disabled={flow.busy}
                type={flow.goalType}
                setType={flow.setGoalType}
                targetWkg={flow.targetWkg}
                setTargetWkg={flow.setTargetWkg}
                note={flow.goalNote}
                setNote={flow.setGoalNote}
                cycleWeeks={flow.cycleWeeks}
                setCycleWeeks={flow.setCycleWeeks}
              />
              {flow.targetWkg && !resources.profile.weightKg ? (
                <Button
                  variant="secondary"
                  onPress={() => router.push("/personal-info")}
                >
                  到个人资料补充体重
                </Button>
              ) : null}
            </>
          ) : null}
          {!ready && step === "schedule" ? (
            <ScheduleStep
              disabled={flow.busy}
              days={flow.days}
              setDays={flow.setDays}
              minutes={flow.minutes}
              setMinutes={flow.setMinutes}
            />
          ) : null}
          {flow.error ? (
            <AppText className="text-negative">{flow.error}</AppText>
          ) : null}
          {flow.symptomFlags.length ? (
            <AppText className="text-negative">
              存在明显不适，请先暂停训练并进行适当的医疗评估。
            </AppText>
          ) : (
            <Button loading={flow.busy} onPress={ready ? resume : save}>
              {ready ? "返回备赛计划" : "保存并继续"}
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={flow.busy}
            onPress={() => router.back()}
          >
            返回
          </Button>
        </>
      ) : null}
    </TrainingPage>
  );
}
