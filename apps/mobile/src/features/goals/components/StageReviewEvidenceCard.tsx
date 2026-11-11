import type {
  StageReviewEvidence,
  StageReviewSnapshot,
} from "@ridepilot/contracts";
import { AppText, Card } from "../../../components/ui";
import { decisionLabels, outcomeLabels } from "../model/goal-lifecycle";
import { GoalInfoButton } from "./GoalInfoButton";
import { View } from "react-native";

export function StageReviewFacts({
  snapshot: s,
}: {
  snapshot: StageReviewSnapshot;
}) {
  return (
    <>
      <AppText variant="card">
        {s.stageTitle} · {s.startDate} 至 {s.endDate}
      </AppText>
      <AppText className="mt-2">
        达成条件：{s.criteria || "尚未填写，请先补充可观察的条件"}
      </AppText>
      <AppText muted className="mt-2">
        统计截至 {s.localDate}：计划 {s.training.planned} · 完成{" "}
        {s.training.completed} · 部分完成 {s.training.partial} · 跳过{" "}
        {s.training.skipped} · 未记录 {s.training.unrecorded}
      </AppText>
      <AppText muted className="mt-2">
        实际训练时长：
        {s.training.actualMinutes === null
          ? "未知"
          : `${s.training.actualMinutes} 分钟`}
      </AppText>
      {s.tests.length ? (
        s.tests.map((t) => (
          <AppText key={t.id} muted className="mt-2">
            {t.date} · {t.protocol} ·{" "}
            {t.valid ? "有效记录" : "未完成或不可作为有效实测"} ·{" "}
            {t.watts === null ? "功率未知" : `${t.watts} W`} ·{" "}
            {t.seconds === null ? "用时未知" : `${t.seconds} 秒`} · 来源{" "}
            {t.source ?? "未知"}
          </AppText>
        ))
      ) : (
        <AppText muted className="mt-2">
          暂无阶段测试记录
        </AppText>
      )}
      {s.notices.map((n) => (
        <AppText key={n} muted className="mt-2">
          {n}
        </AppText>
      ))}
    </>
  );
}
export function StageReviewEvidenceCard({
  evidence,
}: {
  evidence: StageReviewEvidence;
}) {
  return (
    <Card>
      <View className="flex-row items-center justify-between gap-2">
        <AppText variant="card" className="flex-1">
          保存时的阶段复评依据
        </AppText>
        <GoalInfoButton
          title="已保存复评说明"
          description="此处保留确认时的事实与决定，不代表当前依据仍然有效。后续草稿在生成与应用时会重新核对目标、阶段、测试、训练资料和版本。"
        />
      </View>
      <AppText muted className="mt-2">
        {evidence.createdAt.slice(0, 10)} · {outcomeLabels[evidence.outcome]} ·{" "}
        {decisionLabels[evidence.decision]}
      </AppText>
      <AppText className="mt-2">理由：{evidence.rationale}</AppText>
      <StageReviewFacts snapshot={evidence.snapshot} />
    </Card>
  );
}
