import { useCallback } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { AppText, Card } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useCoachResource } from "../hooks/useCoachResource";
import { coachCenterApi } from "../services/coach-center.api";
import { coachStatusSummary } from "../model/coach-home";

export function CoachStatusScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(
    () =>
      token
        ? coachCenterApi.overview(token)
        : Promise.reject(new Error("请先登录")),
    [token],
  );
  const { data, loading, error, retry } = useCoachResource(load);
  return (
    <TrainingPage
      title="训练状态"
      onBack={() => router.replace("/(tabs)/coach")}
      loading={loading}
      error={error}
      retry={retry}
    >
      {data ? (
        <>
          <Card>
            <AppText variant="section">
              {coachStatusSummary[data.status.code]}
            </AppText>
            <AppText className="mt-2 text-secondary">
              {data.status.explanation}
            </AppText>
            <AppText variant="caption" className="mt-3 text-secondary">
              {data.localDate} · {data.timezone} · 近七天依据
            </AppText>
            {data.status.evidence.map((e) => (
              <View
                key={`${e.kind}-${e.id}`}
                className="mt-3 border-t border-divider pt-3"
              >
                <AppText variant="caption">
                  {e.date} · {e.title}
                </AppText>
                <AppText variant="caption" className="mt-1 text-secondary">
                  {e.detail}
                </AppText>
              </View>
            ))}
            {!data.status.evidence.length ? (
              <AppText className="mt-3 text-secondary">
                暂无训练或比赛反馈，可从训练详情记录实际感受；测试仅作为时间建议。
              </AppText>
            ) : null}
          </Card>
          <Card>
            <AppText variant="card">
              {data.stage?.upcoming ? "下一阶段" : "当前阶段"} ·{" "}
              {data.stage?.title ?? "阶段待规划"}
            </AppText>
            {data.stage ? (
              <>
                <AppText className="mt-2">{data.stage.purpose}</AppText>
                <AppText variant="caption" className="mt-2 text-secondary">
                  {data.stage.startDate} — {data.stage.endDate}
                </AppText>
              </>
            ) : null}
            {data.stageNotice ? (
              <AppText variant="caption" className="mt-2 text-warning">
                {data.stageNotice}
              </AppText>
            ) : null}
          </Card>
          <AppText variant="section">最近计划版本</AppText>
          {data.versions.map((v) => (
            <Card key={v.id}>
              <AppText variant="card">
                v{v.version}
                {v.active ? " · 当前执行" : ""}
              </AppText>
              <AppText variant="caption" className="mt-2 text-secondary">
                {v.appliedAt
                  ? new Date(v.appliedAt).toLocaleDateString("zh-CN", {
                      timeZone: data.timezone,
                    })
                  : "—"}{" "}
                · {v.reason || "计划应用"}
              </AppText>
            </Card>
          ))}
          {!data.versions.length ? (
            <AppText className="text-secondary">暂无已应用版本</AppText>
          ) : null}
        </>
      ) : null}
    </TrainingPage>
  );
}
