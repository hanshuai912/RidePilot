import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import type { AiProposalResponse, WorkoutSegment } from "@ridepilot/contracts";
import { PlanCandidates } from "../components/PlanCandidates";
import { PlanPreview } from "../components/PlanPreview";
import { GenerationProgress } from "../components/GenerationProgress";
import { summarizeProposal } from "../model/proposal-summary";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const segments: WorkoutSegment[] = [
  {
    type: "work",
    target: { kind: "duration", value: 5, unit: "min" },
    intensity: { kind: "power_watt", min: 100, max: 150 },
    repeatCount: 3,
  },
  {
    type: "work",
    target: { kind: "distance", value: 10, unit: "km" },
    intensity: { kind: "ftp_percent", min: 60, max: 70 },
    repeatCount: 2,
  },
];
const proposal: AiProposalResponse = {
  proposalId: "00000000-0000-4000-8000-000000000003",
  status: "BLOCKED",
  proposalVersion: 1,
  basePlanVersion: 1,
  scene: "WEEK_PLAN",
  replaceWorkoutIds: [],
  weekStartDate: "2030-01-07",
  summary: "耐力训练草稿",
  stageSummary: "建立耐力",
  assessmentSuggestion: "数周后复评",
  workouts: [0, 1].map((index) => ({
    scheduledDate: "2030-01-08",
    title: `耐力课程 ${index + 1}`,
    purpose: "练习持续输出",
    segments,
  })),
  blockers: ["训练资料已变化，请重新校验"],
  warnings: ["注意恢复"],
  skillVersion: "1",
  model: "test",
};

test("overview and preview count repeated time and distance, distinct days and courses consistently", async () => {
  expect(summarizeProposal(proposal)).toMatchObject({
    days: 1,
    courses: 2,
    minutes: 30,
    kilometers: 40,
  });
  const view = await render(<PlanCandidates proposal={proposal} />);
  expect(view.getByText("1 个训练日 · 2 节课程")).toBeTruthy();
  expect(view.getByText("30 分钟")).toBeTruthy();
  expect(view.getByText("40 公里距离目标")).toBeTruthy();
  expect(view.queryByRole("radio")).toBeNull();
  expect(view.queryByText("后续开放")).toBeNull();
  await view.rerender(<PlanPreview proposal={proposal} ftpWatts={250} />);
  expect(view.getByText("30 分钟")).toBeTruthy();
  expect(view.getByText(/另含 40 公里/)).toBeTruthy();
});

test("blockers precede courses, while collapsed actions and editing remain accessible", async () => {
  const view = await render(<PlanPreview proposal={proposal} ftpWatts={250} />);
  const content = JSON.stringify(view.toJSON());
  expect(content.indexOf(proposal.blockers[0])).toBeLessThan(
    content.indexOf("耐力课程 1"),
  );
  expect(view.getByText("当前无法应用")).toBeTruthy();
  expect(view.queryByText("时间 · 5 分钟 × 3")).toBeNull();
  const toggle = view.getByRole("button", { name: "查看第 1 节动作" });
  expect(toggle.props.accessibilityState.expanded).toBe(false);
  await fireEvent.press(toggle);
  expect(view.getByText("时间 · 5 分钟 × 3")).toBeTruthy();
  await fireEvent.press(
    view.getByRole("button", { name: "局部编辑第 2 节候选" }),
  );
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/workouts/candidate",
    params: { proposalId: proposal.proposalId, index: "1" },
  });
});

test.each(["QUEUED", "RUNNING", "FAILED", "CANCELLED"] as const)(
  "generation only displays actual task state: %s",
  async (status) => {
    const view = await render(
      <GenerationProgress
        status={status}
        error={status === "FAILED" ? "生成连接中断" : null}
      />,
    );
    expect(view.queryByRole("progressbar")).toBeNull();
    expect(view.queryByText(/✓/)).toBeNull();
    if (status === "FAILED")
      expect(view.getByRole("alert").props.children).toBe("生成连接中断");
  },
);
