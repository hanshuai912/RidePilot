import type { CourseStagePlan } from "@ridepilot/contracts";
import { AppText, Card, Disclosure } from "../../../components/ui";

const descriptions = {
  CREATE: "确认课程时将一并建立阶段安排，无需再次生成。",
  REPLACE: "原阶段依据已失效。确认时将归档原阶段，并与课程一起应用以下新阶段。",
  EXTEND: "确认时将补齐课程日期所需的阶段，保留已有阶段及其测试、复评关联。",
  REUSE: "本次课程沿用已有阶段安排，无需再次生成阶段。",
};

export function CourseStagePreview({
  plan,
  applied,
}: {
  plan: CourseStagePlan;
  applied: boolean;
}) {
  return (
    <Card className="gap-3 p-5">
      <AppText variant="section">阶段安排</AppText>
      <AppText>
        {applied ? "已随课程确认阶段安排" : descriptions[plan.action]}
      </AppText>
      <AppText variant="caption" muted>
        {plan.startDate} 至 {plan.endDate} · {plan.stages.length} 个阶段
      </AppText>
      <Disclosure
        title="查看本次阶段安排"
        defaultExpanded={plan.action !== "REUSE"}
      >
        <AppText muted>{plan.summary}</AppText>
        {plan.stages.map((stage, index) => (
          <Card key={`${stage.startDate}-${index}`} className="gap-2">
            <AppText variant="card">
              {index + 1}. {stage.title}
            </AppText>
            <AppText variant="caption" muted>
              {stage.startDate} — {stage.endDate}
            </AppText>
            <AppText>{stage.purpose}</AppText>
            <AppText variant="caption" muted>
              复评建议：{stage.assessmentSuggestion}
            </AppText>
          </Card>
        ))}
      </Disclosure>
      <AppText variant="caption" muted>
        测试建议不会自动创建测试日程。
      </AppText>
    </Card>
  );
}
