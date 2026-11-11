import { GenerationCancelButton } from "../../coach/components/GenerationCancelButton";
import { useState } from "react";
import { router } from "expo-router";
import { AppText, Button, Card, Dialog, Input } from "../../../components/ui";
import {
  TrainingPage,
  backToTraining,
} from "../../training/components/TrainingPage";
import { ImpactWorkoutCard } from "../components/ImpactWorkoutCard";
import { usePlanImpact } from "../hooks/usePlanImpact";

export function PlanImpactScreen() {
  const s = usePlanImpact();
  const [keep, setKeep] = useState(false);
  const affected = s.data?.items.filter((i) => i.issues.length) ?? [];
  return (
    <TrainingPage
      title="资料变更与未来训练"
      onBack={backToTraining}
      busy={s.busy && !s.generating}
      loading={s.loading}
      error={s.error}
      retry={s.retry}
    >
      {s.data ? (
        <>
          <Card>
            <AppText variant="section">
              {s.data.pendingCount
                ? `${s.data.pendingCount} 节未来课程待核对`
                : "没有待核对的未来课程"}
            </AppText>
            <AppText muted className="mt-2">
              资料已保存。正式计划仍为 V{s.data.basePlanVersion}
              ，确认应用草稿后才会调整训练。
            </AppText>
            <AppText muted className="mt-2">
              当前 FTP{" "}
              {s.data.currentFtpWatts
                ? `${s.data.currentFtpWatts} W`
                : "未设置"}{" "}
              ·{" "}
              {s.data.goalId
                ? s.data.goalDescription || "活跃训练目标"
                : "暂无活跃目标"}
            </AppText>
            <AppText muted className="mt-2">
              {s.data.protectedCount} 节历史或已记录课程受保护。
            </AppText>
          </Card>
          {s.data.stageMessages.map((m) => (
            <AppText key={m} className="text-warning">
              {m}
            </AppText>
          ))}
          <Button
            variant="secondary"
            disabled={s.busy}
            onPress={() => router.push("/goals")}
          >
            查看资料与目标
          </Button>
          {affected.length ? (
            <>
              <AppText variant="card">处理日期范围</AppText>
              <Input
                accessibilityLabel="处理开始日期"
                value={s.startDate}
                onChangeText={s.setStart}
                placeholder="YYYY-MM-DD"
                editable={!s.busy}
              />
              <Input
                accessibilityLabel="处理结束日期"
                value={s.endDate}
                onChangeText={s.setEnd}
                placeholder="YYYY-MM-DD"
                editable={!s.busy}
              />
              <AppText muted>
                每次最多 84 天。范围外课程会继续提示；已记录课程不会被调整。
              </AppText>
              <Button
                disabled={s.busy || !s.data.goalId}
                onPress={() => void s.run("REPLAN")}
                loading={s.busy}
              >
                按最新资料生成重排草稿
              </Button>
              {!s.data.goalId ? (
                <AppText className="text-warning">
                  重新规划需要先恢复或建立活跃目标。
                </AppText>
              ) : null}
              <Button
                variant="secondary"
                disabled={s.busy || !s.data.currentFtpWatts}
                onPress={() => void s.run("FTP_RECALCULATE")}
              >
                仅重算 FTP · 预览功率差异
              </Button>
              <Button
                variant="ghost"
                disabled={s.busy}
                onPress={() => setKeep(true)}
              >
                保留所选范围的安排
              </Button>
              <AppText variant="card">受影响课程与 FTP 换算参考</AppText>
              {affected.map((item) => (
                <ImpactWorkoutCard key={item.workout.id} item={item} />
              ))}
            </>
          ) : (
            <AppText muted>
              没有待处理的未来课程。测试建议不会阻止课程生成。
            </AppText>
          )}
          {s.notice ? (
            <AppText accessibilityLiveRegion="polite" className="text-positive">
              {s.notice}
            </AppText>
          ) : null}
          {s.actionError ? (
            <AppText accessibilityRole="alert" className="text-negative">
              {s.actionError}
            </AppText>
          ) : null}
          <Button variant="secondary" disabled={s.busy} onPress={s.retry}>
            刷新资料与影响
          </Button>
          {s.data.generations.length ? (
            <AppText variant="card">重排任务 · 可离开后继续</AppText>
          ) : null}
          {s.data.generations.map((g) => (
            <Card key={g.id}>
              <AppText>
                {g.startDate} 至 {g.endDate} ·{" "}
                {
                  {
                    QUEUED: "等待生成",
                    RUNNING: "生成中",
                    READY: "草稿已就绪",
                    FAILED: "生成失败，可重新生成",
                    CANCELLED: "已取消，可重新生成",
                  }[g.status]
                }
              </AppText>
              {g.status !== "FAILED" && g.status !== "CANCELLED" ? (
                <Button
                  variant="secondary"
                  disabled={s.busy}
                  onPress={() =>
                    g.proposalId
                      ? router.push({
                          pathname: "/goals/course-preview",
                          params: { proposalId: g.proposalId },
                        })
                      : void s.run("REPLAN", g.id)
                  }
                >
                  继续查看重排任务
                </Button>
              ) : null}
            </Card>
          ))}
          {s.data.decisions.length ? (
            <AppText variant="card">处理记录与 FTP 草稿</AppText>
          ) : null}
          {s.data.decisions.map((d) => (
            <Card key={d.id}>
              <AppText>
                {d.startDate} 至 {d.endDate} ·{" "}
                {d.action === "KEEP" ? "保留原安排" : "FTP 重算"} ·{" "}
                {d.status === "DRAFT" ? "待确认" : "已确认"}
              </AppText>
              <Button
                variant="ghost"
                disabled={s.busy}
                onPress={() =>
                  router.push({
                    pathname: "/plans/input-impact-preview",
                    params: { decisionId: d.id },
                  })
                }
              >
                查看处理详情
              </Button>
            </Card>
          ))}
        </>
      ) : null}
      <Dialog
        visible={keep}
        title="确认保留原安排？"
        description="所选日期的课程将保留原功率依据、日期和时长。缺少历史 FTP 快照时仍无法确定原执行瓦数。新资料会用于之后的规划，本次选择不会更改正式课程。"
        closeLabel="继续核对"
        onClose={() => setKeep(false)}
      >
        <Button
          onPress={() => {
            setKeep(false);
            void s.run("KEEP");
          }}
        >
          确认保留安排
        </Button>
      </Dialog>
      {s.generating ? (
        <GenerationCancelButton cancellation={s.cancellation} />
      ) : null}
    </TrainingPage>
  );
}
