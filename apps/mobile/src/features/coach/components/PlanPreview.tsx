import { WorkoutSegmentList } from "../../training/components/WorkoutSegmentList";
import { WorkoutDiff } from "../../training/components/WorkoutDiff";
import { ImpactWorkoutCard } from "../../plan-impact/components/ImpactWorkoutCard";
import { StageReviewEvidenceCard } from "../../goals/components/StageReviewEvidenceCard";
import { PlanningGoalsCard } from "../../goals/components/PlanningGoalsCard";
import { CourseStagePreview } from "../../goals/components/CourseStagePreview";
import { CycleReviewEvidenceCard } from "../cycle-review/CycleReviewEvidenceCard";
import { View } from "react-native";
import type { AiProposalResponse } from "@ridepilot/contracts";

import { AppText, Card, Disclosure } from "../../../components/ui";
import { summarizeProposal } from "../model/proposal-summary";
import { ProposalWorkoutCard } from "./ProposalWorkoutCard";

export function PlanPreview({
  proposal,
  ftpWatts,
  nutritionSummary = "无特殊限制",
}: {
  proposal: AiProposalResponse;
  ftpWatts: number | null;
  nutritionSummary?: string;
}) {
  const summary = summarizeProposal(proposal);

  return (
    <>
      {proposal.blockers.length ? (
        <Card>
          <AppText variant="card" className="text-negative">
            当前无法应用
          </AppText>
          {proposal.blockers.map((blocker, index) => (
            <AppText key={index} className="mt-2 text-secondary">
              {blocker}
            </AppText>
          ))}
        </Card>
      ) : null}
      {proposal.warnings.length ? (
        <Card>
          <AppText variant="card" className="text-warning">
            需要留意
          </AppText>
          {proposal.warnings.map((warning, index) => (
            <AppText key={index} className="mt-2 text-secondary">
              {warning}
            </AppText>
          ))}
        </Card>
      ) : null}
      <View className="rounded-[18px] border border-border border-l-4 border-l-brand bg-surface p-4">
        <AppText variant="label" className="text-brand">
          {proposal.status === "APPLIED"
            ? "AI 训练方案 · 已应用"
            : "AI 训练草稿 · 尚未应用"}
        </AppText>
        <AppText variant="section" className="mt-2">
          {proposal.summary}
        </AppText>
        <AppText variant="caption" className="mt-3 text-secondary">
          {proposal.scene === "WORKOUT_ADJUST"
            ? "仅调整选中的一节训练"
            : proposal.endDate
              ? `${proposal.weekStartDate} 至 ${proposal.endDate}`
              : `训练周从 ${proposal.weekStartDate} 开始`}{" "}
          · {summary.days} 个训练日
        </AppText>
        <View className="mt-4 flex-row flex-wrap gap-x-5 gap-y-2 border-y border-divider py-3">
          <AppText variant="card">{summary.courses} 节课程</AppText>
          <AppText variant="card" className="text-brand">
            {summary.minutes || "—"} {summary.minutes ? "分钟" : ""}
          </AppText>
        </View>
        {summary.kilometers > 0 ? (
          <AppText variant="caption" muted className="mt-3">
            另含 {summary.kilometers} 公里距离目标，不折算时长
          </AppText>
        ) : null}
        <AppText variant="caption" muted className="mt-3">
          {proposal.status === "APPLIED"
            ? `应用时：正式计划 v${proposal.basePlanVersion} → v${proposal.basePlanVersion + 1}`
            : proposal.basePlanVersion === 0
              ? "首次应用：无正式计划 → 正式计划 v1"
              : `应用后：正式计划 v${proposal.basePlanVersion} → v${proposal.basePlanVersion + 1}`}
          {proposal.replaceWorkoutIds.length
            ? ` · 将替换 ${proposal.replaceWorkoutIds.length} 节未来课程`
            : " · 保留已有课程"}
        </AppText>
      </View>
      <AppText variant="caption" muted>
        饮食限制：{nutritionSummary} · 本次不修改饮食计划
      </AppText>
      <PlanningGoalsCard
        goals={proposal.planningGoals}
        tradeoffs={proposal.goalTradeoffs}
      />
      {proposal.stagePlan ? (
        <CourseStagePreview
          plan={proposal.stagePlan}
          applied={proposal.status === "APPLIED"}
        />
      ) : null}
      {proposal.planImpact || proposal.stageReview || proposal.cycleReview ? (
        <Disclosure title="查看原安排与复盘依据" defaultExpanded>
          {proposal.planImpact ? (
            <>
              <AppText variant="section">资料变更前的课程</AppText>
              <AppText muted>
                以下为原安排。确认应用后，仅替换所选范围内的未来未记录课程。
              </AppText>
              {proposal.planImpact.before.map((item) => (
                <ImpactWorkoutCard
                  key={item.workout.id}
                  item={item}
                  comparison={false}
                />
              ))}
              <AppText variant="section">按最新资料生成的新课程</AppText>
            </>
          ) : null}
          {proposal.stageReview ? (
            <StageReviewEvidenceCard evidence={proposal.stageReview} />
          ) : null}
          {proposal.cycleReview ? (
            <CycleReviewEvidenceCard evidence={proposal.cycleReview} />
          ) : null}
        </Disclosure>
      ) : null}
      {proposal.replacedWorkouts?.map((before) => {
        const after =
          proposal.scene === "WORKOUT_ADJUST"
            ? proposal.workouts[0]
            : undefined;
        if (before.segments && after)
          return (
            <WorkoutDiff
              key={`diff-${before.id}`}
              before={{ ...before, segments: before.segments }}
              after={after}
            />
          );
        return (
          <Card key={`before-${before.id}`}>
            <AppText variant="card">
              原课程 · {before.scheduledDate} · {before.title}
            </AppText>
            {before.segments ? (
              <>
                <AppText muted>{before.purpose || "未填写训练目的"}</AppText>
                <Disclosure title={`查看原课程动作：${before.title}`}>
                  <WorkoutSegmentList segments={before.segments} />
                </Disclosure>
              </>
            ) : (
              <AppText muted>旧草稿未保存动作明细，请读取原课程核对。</AppText>
            )}
          </Card>
        );
      })}
      <AppText variant="section">课程安排</AppText>
      <View className="gap-3">
        {proposal.workouts.map((workout, index) => (
          <ProposalWorkoutCard
            key={`${workout.scheduledDate}-${index}`}
            proposal={proposal}
            index={index}
            ftpWatts={proposal.planImpact?.ftpWatts ?? ftpWatts}
          />
        ))}
      </View>
      <Disclosure title="阶段方向与复评建议">
        <View className="rounded-[14px] border border-positive/40 bg-surface-2 p-3">
          <AppText variant="label" className="text-positive">
            计划说明
          </AppText>
          <AppText variant="card" className="mt-2">
            阶段方向
          </AppText>
          <AppText variant="caption" className="mt-1 text-secondary">
            {proposal.stageSummary}
          </AppText>
          <AppText variant="card" className="mt-4">
            复评建议
          </AppText>
          <AppText variant="caption" className="mt-1 text-secondary">
            {proposal.assessmentSuggestion}
          </AppText>
          <AppText variant="caption" muted className="mt-3">
            {proposal.stagePlan
              ? "阶段安排已在上方列出，将随课程一并确认；本次不会创建测试日程。"
              : "此处的阶段与复评是课程建议说明。正式阶段安排请在目标详情查看；本次不会创建测试日程。"}
          </AppText>
        </View>
      </Disclosure>
    </>
  );
}
