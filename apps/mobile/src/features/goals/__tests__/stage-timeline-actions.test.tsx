import { render } from "@testing-library/react-native";
import type { StagePlanResponse } from "@ridepilot/contracts";
import { StageTimeline } from "../components/StageTimeline";

const plan: StagePlanResponse = {
  id: "plan",
  goalId: "goal",
  goalVersion: 1,
  status: "ACTIVE",
  version: 1,
  startDate: "2028-01-01",
  endDate: "2028-01-14",
  stale: false,
  summary: "基础训练",
  stages: [
    {
      id: "stage",
      position: 0,
      title: "基础阶段",
      purpose: "积累耐力",
      startDate: "2028-01-01",
      endDate: "2028-01-14",
      assessmentSuggestion: "同协议复测",
    },
  ],
};

test("stage timeline does not expose test scheduling", async () => {
  const view = await render(<StageTimeline plan={plan} today="2028-01-10" />);
  expect(view.queryByText("测试建议")).toBeNull();
  expect(view.queryByRole("button", { name: "安排阶段测试" })).toBeNull();
});
