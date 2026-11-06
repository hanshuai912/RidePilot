import type {
  GoalChangePreview,
  GoalEvaluation,
  StageReviewSnapshot,
  StageReviewEvidence,
} from "@ridepilot/contracts";
export const goalId = "00000000-0000-4000-8000-000000000001";
export const stageId = "00000000-0000-4000-8000-000000000002";
export const reviewId = "00000000-0000-4000-8000-000000000003";
export const goal = {
  id: goalId,
  type: "FTP" as const,
  description: "提升能力",
  successCriteria: "同协议实测",
  targetFtpWatts: 300,
  targetWkg: null,
  targetDate: "2099-02-28",
  priority: "PRIMARY" as const,
  status: "ACTIVE" as const,
  version: 1,
};
export const evaluation: GoalEvaluation = {
  localDate: "2099-01-01",
  daysRemaining: 58,
  weeklyMinutes: 300,
  currentFtp: null,
  wattsGap: null,
  wkgGap: null,
  notices: ["缺少基线，无法预测固定增长"],
};
export const comparison: GoalChangePreview = {
  fingerprint: "a".repeat(64),
  before: goal,
  after: { ...goal, status: "PAUSED", version: 2 },
  nextGoal: null,
  affected: {
    workouts: [{ id: reviewId, date: "2099-01-02", title: "保留正式课程" }],
    stages: [],
    assessments: [],
    otherPrimaryGoals: [],
  },
  evaluation,
  warnings: ["需另行确认训练变更"],
};
export const snapshot: StageReviewSnapshot = {
  fingerprint: "a".repeat(64),
  localDate: "2099-01-01",
  goalId,
  goalVersion: 1,
  goalStatus: "ACTIVE",
  goalTargetDate: goal.targetDate,
  stageId,
  stagePlanId: goalId,
  stagePlanVersion: 2,
  stageTitle: "耐力基础",
  startDate: "2099-01-01",
  endDate: "2099-01-14",
  criteria: "完成耐力骑行并记录感受",
  criteriaVersion: 1,
  stale: false,
  nextStage: {
    id: reviewId,
    title: "巩固阶段",
    startDate: "2099-01-15",
    endDate: "2099-01-28",
  },
  training: {
    planned: 2,
    completed: 1,
    partial: 0,
    skipped: 0,
    unrecorded: 1,
    actualMinutes: 30,
  },
  tests: [],
  notices: ["日期结束不代表达成"],
};
export const evidence: StageReviewEvidence = {
  id: reviewId,
  stageId,
  outcome: "INSUFFICIENT",
  decision: "KEEP",
  rationale: "仍缺可比测量",
  createdAt: "2099-01-01T00:00:00Z",
  snapshot,
};
