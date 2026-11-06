import { useCallback, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppText, Button, Card } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useTrainingResource } from "../../training/hooks/useTrainingResource";
import { ImpactWorkoutCard } from "../components/ImpactWorkoutCard";
import { planImpactApi } from "../services/plan-impact.api";

export function PlanImpactPreviewScreen() {
  const { decisionId = "" } = useLocalSearchParams<{ decisionId?: string }>();
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(async () => {
    if (!token) throw new Error("请先登录");
    return planImpactApi.decision(token, decisionId);
  }, [token, decisionId]);
  const s = useTrainingResource(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const apply = async () => {
    if (!token || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await planImpactApi.apply(token, decisionId);
      s.retry();
    } catch (e) {
      setError(e instanceof Error ? e.message : "应用失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <TrainingPage
      title="处理详情与功率预览"
      loading={s.loading}
      error={s.error}
      retry={s.retry}
      busy={busy}
      onBack={() => router.replace("/plans/input-impact")}
    >
      {s.data ? (
        <>
          <Card>
            <AppText variant="section">
              {s.data.action === "KEEP" ? "保留原安排" : "FTP 重算"} ·{" "}
              {s.data.status === "APPLIED" ? "已确认" : "草稿"}
            </AppText>
            <AppText muted className="mt-2">
              {s.data.startDate} 至 {s.data.endDate} · {s.data.items.length}{" "}
              节课程
            </AppText>
            <AppText muted className="mt-2">
              {s.data.action === "KEEP"
                ? "课程的原功率依据保持。"
                : "百分比强度按新 FTP 换算，绝对瓦数保持。课程日期、时长、结构与目的保持。"}
            </AppText>
          </Card>
          {s.data.items.map((i) => (
            <ImpactWorkoutCard
              key={i.workout.id}
              item={i}
              comparison={s.data!.action !== "KEEP"}
            />
          ))}
          {error ? (
            <AppText accessibilityRole="alert" className="text-negative">
              {error}
            </AppText>
          ) : null}
          {s.data.status === "DRAFT" ? (
            <Button loading={busy} onPress={() => void apply()}>
              确认应用 FTP 重算
            </Button>
          ) : (
            <>
              <AppText className="text-positive">
                {s.data.newPlanVersion
                  ? `已应用为正式版本 V${s.data.newPlanVersion}，请到训练日历核对补给。`
                  : "已记录保留决定，正式计划未变更。"}
              </AppText>
              <Button
                onPress={() =>
                  router.replace({
                    pathname: "/(tabs)/training",
                    params: {
                      date:
                        s.data!.items[0]?.workout.scheduledDate ??
                        s.data!.startDate,
                      savedAt: String(Date.now()),
                    },
                  })
                }
              >
                查看训练与补给
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => router.replace("/plans/input-impact")}
          >
            返回核对其他日期
          </Button>
        </>
      ) : null}
    </TrainingPage>
  );
}
