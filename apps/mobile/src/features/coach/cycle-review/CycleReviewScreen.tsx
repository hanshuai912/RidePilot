import { AppText, Button, Card } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useCycleReview } from "./useCycleReview";
import { CycleReviewRange } from "./CycleReviewRange";
import { CycleReviewSummary } from "./CycleReviewSummary";
import { CycleReviewActions } from "./CycleReviewActions";
import { CycleReviewHistory } from "./CycleReviewHistory";
import { cycleStatusLabel } from "./cycle-review.model";

export function CycleReviewScreen() {
  const state = useCycleReview();
  const r = state.review;
  return (
    <TrainingPage
      title="训练执行与周期复盘"
      loading={state.loading}
      busy={state.busy}
      onBack={() => state.router.replace("/(tabs)/coach")}
    >
      {state.error ? (
        <Card>
          <AppText className="text-negative">{state.error}</AppText>
          <Button onPress={state.retry}>重新读取复盘</Button>
          <Button
            variant="secondary"
            onPress={() => {
              state.router.setParams({
                startDate: "",
                endDate: "",
                generationId: "",
              });
              state.retry();
            }}
          >
            返回最近七天
          </Button>
        </Card>
      ) : null}
      {r ? (
        <>
          <CycleReviewRange
            key={`${r.startDate}:${r.endDate}`}
            review={r}
            onSelect={state.selectRange}
          />
          <CycleReviewSummary review={r} />
          <Card>
            <AppText variant="section">本周期训练反馈</AppText>
            {!r.workouts.length ? (
              <AppText muted className="mt-2">
                本周期没有计划课程。可以核对现有记录后，主动生成后续训练。
              </AppText>
            ) : null}
            {r.workouts.map((w) => (
              <Card key={w.id} className="mt-3">
                <AppText>
                  {w.date} · {w.title}
                </AppText>
                <AppText muted className="mt-2">
                  {w.feedback
                    ? `${cycleStatusLabel(w.feedback.status)} · 实际 ${w.feedback.durationMin ?? "—"} 分钟 · RPE ${w.feedback.rpe ?? "—"} · 疲劳 ${w.feedback.fatigue ?? "—"}`
                    : "尚未记录，不视为失败"}
                </AppText>
                {w.feedback?.notes ? (
                  <AppText muted className="mt-2">
                    {w.feedback.notes}
                  </AppText>
                ) : null}
                {w.canRecord ? (
                  <Button
                    variant="secondary"
                    onPress={() =>
                      state.router.push({
                        pathname: "/workouts/feedback",
                        params: {
                          workoutId: w.id,
                          source: "cycle-review",
                          reviewStartDate: r.startDate,
                          reviewEndDate: r.endDate,
                        },
                      })
                    }
                  >
                    记录本次训练反馈
                  </Button>
                ) : null}
              </Card>
            ))}
            {r.additionalFeedback.map((f) => (
              <AppText key={f.id} muted className="mt-3">
                额外记录 · {f.date} · {cycleStatusLabel(f.status)} ·{" "}
                {f.durationMin ?? "—"} 分钟 · RPE {f.rpe ?? "—"} · 疲劳{" "}
                {f.fatigue ?? "—"}
                {f.notes ? `\n${f.notes}` : ""}
              </AppText>
            ))}
          </Card>
          {r.tests.length ? (
            <Card>
              <AppText variant="card">本周期测试依据</AppText>
              {r.tests.map((t) => (
                <Button
                  key={t.id}
                  variant="ghost"
                  onPress={() =>
                    state.router.push({
                      pathname: "/assessments/[assessmentId]",
                      params: { assessmentId: t.id },
                    })
                  }
                >
                  {t.date} · {t.title} · {cycleStatusLabel(t.status)}
                  {t.watts === null ? "" : ` · ${t.watts} W`}
                </Button>
              ))}
            </Card>
          ) : null}
          <CycleReviewActions state={state} />
        </>
      ) : null}
      {state.data?.historyError ? (
        <Card>
          <AppText className="text-negative">
            历史读取失败：{state.data.historyError}
          </AppText>
          <Button variant="secondary" onPress={state.retry}>
            重试读取历史
          </Button>
        </Card>
      ) : null}
      {state.data?.history ? (
        <CycleReviewHistory
          history={state.data.history}
          preview={state.preview}
          resume={state.resume}
        />
      ) : null}
    </TrainingPage>
  );
}
