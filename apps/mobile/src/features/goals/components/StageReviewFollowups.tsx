import { router } from "expo-router";
import type { StageReviewFollowup } from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";

export function StageReviewFollowups({
  items,
  goalId,
  busy,
  resume,
  refresh,
}: {
  items: StageReviewFollowup[];
  goalId: string;
  busy: boolean;
  resume: (id: string, roadmap: boolean) => void;
  refresh: () => void;
}) {
  if (!items.length) return null;
  const labels = {
    QUEUED: "等待生成",
    RUNNING: "正在生成",
    READY: "草稿已生成",
    FAILED: "生成未完成",
  };
  return (
    <Card>
      <AppText variant="section">复评后的生成记录</AppText>
      <AppText muted>
        包含历史决定的任务。草稿需重新核对当前依据，正式应用以预览校验为准。
      </AppText>
      {items.map((item) => (
        <Card key={item.generationId} className="mt-3">
          <AppText>
            {item.kind === "STAGES" ? "阶段安排" : "课程计划"} ·{" "}
            {labels[item.status]}
          </AppText>
          {item.proposalId ? (
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() =>
                router.push({
                  pathname:
                    item.kind === "STAGES"
                      ? "/goals/stage-preview"
                      : "/goals/course-preview",
                  params: { proposalId: item.proposalId!, goalId },
                })
              }
            >
              查看已生成草稿
            </Button>
          ) : item.status === "QUEUED" || item.status === "RUNNING" ? (
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() => resume(item.generationId, item.kind === "STAGES")}
            >
              继续查询原生成任务
            </Button>
          ) : (
            <AppText muted>请核对当前证据后，主动重新生成。</AppText>
          )}
        </Card>
      ))}
      <Button variant="ghost" disabled={busy} onPress={refresh}>
        刷新复评与生成记录
      </Button>
    </Card>
  );
}
