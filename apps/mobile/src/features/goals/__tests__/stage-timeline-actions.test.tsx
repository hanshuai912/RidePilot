import { fireEvent, render } from "@testing-library/react-native";
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

test.each(["2028-01-10", "2028-01-20"])(
  "schedule link preserves stage and usable date for %s, review stays independent",
  async (today) => {
    const schedule = jest.fn();
    const review = jest.fn();
    const view = await render(
      <StageTimeline
        plan={plan}
        today={today}
        onAssessment={schedule}
        onReview={review}
      />,
    );
    await fireEvent.press(view.getByRole("button", { name: "安排阶段测试" }));
    expect(schedule).toHaveBeenCalledWith(
      "stage",
      today > plan.endDate ? today : plan.endDate,
    );
    expect(review).not.toHaveBeenCalled();
    await fireEvent.press(
      view.getByRole("button", { name: "复评并选择下一步" }),
    );
    expect(review).toHaveBeenCalledWith("stage");
  },
);

test("stale plan disables scheduling while busy disables both actions", async () => {
  const schedule = jest.fn();
  const review = jest.fn();
  const view = await render(
    <StageTimeline
      plan={{ ...plan, stale: true }}
      onAssessment={schedule}
      onReview={review}
    />,
  );
  expect(view.getByRole("button", { name: "安排阶段测试" })).toBeDisabled();
  expect(view.getByRole("button", { name: "复评并选择下一步" })).toBeEnabled();
  await view.rerender(
    <StageTimeline
      plan={plan}
      disabled
      onAssessment={schedule}
      onReview={review}
    />,
  );
  await fireEvent.press(view.getByRole("button", { name: "安排阶段测试" }));
  await fireEvent.press(view.getByRole("button", { name: "复评并选择下一步" }));
  expect(schedule).not.toHaveBeenCalled();
  expect(review).not.toHaveBeenCalled();
});
