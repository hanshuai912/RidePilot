import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachCenterApi } from "../services/coach-center.api";
import { useCoachResource } from "../hooks/useCoachResource";

export function CoachOverviewPanel() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const router = useRouter();
  const load = useCallback(() => {
    if (!token) return Promise.reject(new Error("请先登录"));
    return coachCenterApi.overview(token);
  }, [token]);
  const { data, loading, error, retry } = useCoachResource(load);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  if (loading)
    return (
      <Card>
        <Spinner accessibilityLabel="正在读取教练概览" />
      </Card>
    );
  if (error || !data)
    return (
      <Card>
        <AppText className="text-negative">{error || "暂无概览"}</AppText>
        <Button variant="secondary" onPress={retry}>
          重新读取概览
        </Button>
      </Card>
    );
  return (
    <>
      <Card>
        <AppText variant="label" className="text-brand">
          {data.stage?.upcoming ? "下一阶段" : "当前阶段"}
        </AppText>
        <AppText variant="section" className="mt-2">
          {data.stage?.title ?? "阶段待规划"}
        </AppText>
        {data.goal ? (
          <AppText muted className="mt-2">
            目标：{data.goal.title} · {data.goal.targetDate}
          </AppText>
        ) : null}
        {data.stage ? (
          <>
            <AppText className="mt-2">{data.stage.purpose}</AppText>
            <AppText muted className="mt-2">
              {data.stage.startDate} 至 {data.stage.endDate}
            </AppText>
          </>
        ) : null}
        {data.stageNotice ? (
          <AppText className="mt-2 text-warning">{data.stageNotice}</AppText>
        ) : null}
        <Button
          variant="ghost"
          onPress={() =>
            data.goal
              ? router.push({
                  pathname: "/goals/[goalId]",
                  params: { goalId: data.goal.id },
                })
              : router.push("/goals")
          }
        >
          查看目标与阶段
        </Button>
      </Card>
      <Card>
        <AppText variant="label" className="text-brand">
          状态与依据 · {data.localDate}
        </AppText>
        <AppText variant="section" className="mt-2">
          {data.status.label}
        </AppText>
        <AppText muted className="mt-2">
          {data.status.explanation}
        </AppText>
        <AppText variant="caption" muted className="mt-2">
          按 {data.timezone} 展示 · 近七天记录
        </AppText>
        {data.status.evidence.slice(0, showEvidence ? 10 : 2).map((e) => (
          <AppText
            key={`${e.kind}-${e.id}`}
            variant="caption"
            className="mt-3 text-secondary"
          >
            {e.date} · {e.title}
            {"\n"}
            {e.detail}
          </AppText>
        ))}
        {data.status.evidence.length > 2 ? (
          <Button variant="ghost" onPress={() => setShowEvidence((v) => !v)}>
            {showEvidence ? "收起依据" : "展开状态依据"}
          </Button>
        ) : null}
        {!data.status.evidence.length ? (
          <AppText muted className="mt-2">
            暂无训练、比赛或测试反馈，可从训练详情记录实际感受。
          </AppText>
        ) : null}
      </Card>
      <Card>
        <AppText variant="card">下一训练 / 测试</AppText>
        <AppText className="mt-3">
          {data.nextWorkout
            ? `${data.nextWorkout.date} · ${data.nextWorkout.title}${data.nextWorkout.minutes ? ` · ${data.nextWorkout.minutes} 分钟` : ""}`
            : "暂无待执行训练，可主动规划本周或下周"}
        </AppText>
        {data.nextWorkout ? (
          <Button
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: "/workouts/[workoutId]",
                params: { workoutId: data.nextWorkout!.id },
              })
            }
          >
            查看下一训练
          </Button>
        ) : null}
        <AppText className="mt-3">
          {data.nextAssessment
            ? `${data.nextAssessment.date} · ${data.nextAssessment.title}${data.nextAssessment.overdue ? " · 已到期，请更新结果或安排" : ""}`
            : "暂无已安排测试"}
        </AppText>
        <Button
          variant="ghost"
          onPress={() =>
            data.nextAssessment
              ? router.push({
                  pathname: "/assessments/[assessmentId]",
                  params: { assessmentId: data.nextAssessment.id },
                })
              : router.push("/assessments/new")
          }
        >
          {data.nextAssessment ? "查看测试 / 录入结果" : "安排阶段测试"}
        </Button>
      </Card>
      <Button
        variant="secondary"
        onPress={() => router.push("/(tabs)/coach/cycle-review")}
      >
        训练执行与周期复盘
      </Button>
      <Button
        variant="secondary"
        onPress={() => router.push("/(tabs)/coach/chat")}
      >
        问 AI 教练
      </Button>
      <Card>
        <Button variant="ghost" onPress={() => setShowVersions((v) => !v)}>
          {showVersions ? "收起版本历史" : "最近计划版本"}
        </Button>
        {showVersions
          ? data.versions.map((v) => (
              <AppText
                key={v.id}
                variant="caption"
                className="mt-3 text-secondary"
              >
                v{v.version}
                {v.active ? " · 当前执行" : ""} ·{" "}
                {v.appliedAt
                  ? new Date(v.appliedAt).toLocaleDateString("zh-CN", {
                      timeZone: data.timezone,
                    })
                  : "—"}
                {"\n"}
                {v.reason || "计划应用"}
              </AppText>
            ))
          : null}
        {showVersions && !data.versions.length ? (
          <AppText muted>暂无已应用版本</AppText>
        ) : null}
      </Card>
    </>
  );
}
