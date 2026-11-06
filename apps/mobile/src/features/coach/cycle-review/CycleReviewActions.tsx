import { AppText, Button, Card, Input } from "../../../components/ui";
import type { useCycleReview } from "./useCycleReview";
import { cycleActionLabels, cycleGenerationError } from "./cycle-review.model";

export function CycleReviewActions({
  state,
}: {
  state: ReturnType<typeof useCycleReview>;
}) {
  const r = state.review;
  if (!r) return null;
  const job = state.data?.job;
  const working = !!job && ["QUEUED", "RUNNING"].includes(job.status);
  return (
    <>
      <Card>
        <AppText variant="section">选择下一步</AppText>
        <Button
          variant="secondary"
          onPress={() => state.router.push("/(tabs)/training")}
        >
          保留当前计划，前往训练
        </Button>
        <Button
          variant="ghost"
          onPress={() =>
            state.router.push({
              pathname: "/assessments/new",
              params: r.goal ? { goalId: r.goal.id } : {},
            })
          }
        >
          安排下一次测试
        </Button>
        <AppText variant="caption" muted>
          安排测试会进入测试确认流程；不会自动排期、更新 FTP 或推进阶段。
        </AppText>
        {r.goal ? (
          <Button
            variant="secondary"
            disabled={state.busy}
            onPress={() =>
              state.router.push({
                pathname: "/goals/manage",
                params: { goalId: r.goal!.id },
              })
            }
          >
            复评目标 · 延期 / 完成 / 结束
          </Button>
        ) : null}
        {r.missingFields.length ? (
          <>
            <AppText className="mt-3 text-warning">
              生成前请补全：
              {r.missingFields
                .map(
                  (f) =>
                    ({
                      goal: "训练目标",
                      ftp: "FTP",
                      availability: "可训练时间",
                      experienceLevel: "训练经验",
                      weightKg: "体重",
                    })[f] ?? f,
                )
                .join("、")}
            </AppText>
            {r.missingFields.includes("goal") ? (
              <Button
                variant="secondary"
                onPress={() => state.router.push("/goals")}
              >
                设置训练目标
              </Button>
            ) : null}
            {r.missingFields.some((f) =>
              ["ftp", "experienceLevel", "weightKg"].includes(f),
            ) ? (
              <Button
                variant="secondary"
                onPress={() => state.router.push("/(tabs)/coach/basics")}
              >
                补全训练基础资料
              </Button>
            ) : null}
            {r.missingFields.includes("availability") ? (
              <Button
                variant="secondary"
                onPress={() => state.router.push("/(tabs)/coach/schedule")}
              >
                设置可训练时间
              </Button>
            ) : null}
            <AppText muted>返回后会重新读取资料，仍需你点击生成。</AppText>
          </>
        ) : (
          <>
            {Object.entries(cycleActionLabels).map(([action, label]) => (
              <Button
                key={action}
                variant={state.action === action ? "primary" : "secondary"}
                onPress={() =>
                  state.setAction(action as keyof typeof cycleActionLabels)
                }
              >
                {state.action === action ? `已选：${label}` : label}
              </Button>
            ))}
            {state.action === "RECOVERY" ? (
              <AppText muted>
                恢复草稿所有区段上限为 70% FTP；如仍有明显不适，请先休息并评估。
              </AppText>
            ) : null}
            <AppText className="mt-3">后续训练范围</AppText>
            <Input
              accessibilityLabel="后续训练开始日期"
              value={state.from}
              onChangeText={state.setTargetStart}
            />
            <Input
              className="mt-2"
              accessibilityLabel="后续训练结束日期"
              value={state.to}
              onChangeText={state.setTargetEnd}
            />
            <AppText variant="caption" muted className="mt-2">
              须晚于复盘结束日，从今天或未来开始，不超过目标日期{" "}
              {r.goal?.targetDate}。已有可修改课程会在预览中列出替换范围。
            </AppText>
            <Input
              className="mt-2"
              accessibilityLabel="复盘调整备注"
              placeholder="可选：希望调整的时间或训练感受"
              value={state.notes}
              onChangeText={state.setNotes}
              multiline
              maxLength={200}
            />
            <Button
              className="mt-3"
              disabled={working || state.busy}
              loading={state.busy}
              onPress={() => void state.generate(!!job)}
            >
              {job ? "按当前选择重新生成草稿" : "确认选择，生成后续训练草稿"}
            </Button>
          </>
        )}
        {state.actionError ? (
          <AppText className="mt-2 text-negative">{state.actionError}</AppText>
        ) : null}
      </Card>
      {job ? (
        <Card>
          <AppText variant="card">
            {working
              ? "草稿正在生成，可离开后继续查看"
              : job.status === "FAILED"
                ? "本次生成未完成"
                : "生成任务已完成"}
          </AppText>
          {job.status === "FAILED" ? (
            <AppText className="mt-2 text-warning">
              {cycleGenerationError(job.errorCode)}
            </AppText>
          ) : null}
          {job.proposalId ? (
            <Button onPress={() => state.preview(job.proposalId!)}>
              预览本次训练草稿
            </Button>
          ) : null}
          <Button variant="ghost" onPress={state.retry}>
            刷新复盘与生成状态
          </Button>
        </Card>
      ) : null}
    </>
  );
}
