import { Stack, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { within } from "@testing-library/react-native";
import {
  renderRouter,
  screen,
  fireEvent,
  act,
  waitFor,
} from "expo-router/testing-library";
import type { CalendarResponse, PlanImpactPreview } from "@ridepilot/contracts";
import { TrainingScreen } from "../screens/TrainingScreen";
import { trainingApi } from "../services/training.api";
import { planImpactApi } from "../../plan-impact/services/plan-impact.api";
import { coachApi } from "../../coach/services/coach.api";
import { assessmentsApi } from "../../assessments/services/assessments.api";
import { addDays, iso } from "../model/training";

jest.mock("../../auth/hooks/AuthProvider", () => ({
  useAuth: () => ({ session: { accessToken: "token" } }),
}));
jest.mock("../services/training.api", () => ({
  trainingApi: { getCalendar: jest.fn() },
}));
jest.mock("../../plan-impact/services/plan-impact.api", () => ({
  planImpactApi: { preview: jest.fn() },
}));
jest.mock("../../coach/services/coach.api", () => ({
  coachApi: { races: jest.fn() },
}));
jest.mock("../../assessments/services/assessments.api", () => ({
  assessmentsApi: { list: jest.fn() },
}));
const today = iso(new Date());
const calendar: CalendarResponse = {
  ftpAvailable: true,
  from: today,
  to: today,
  timezone: "Asia/Shanghai",
  localDate: today,
  items: [],
  events: [],
};
const preview: PlanImpactPreview = {
  fingerprint: "a".repeat(64),
  localDate: today,
  basePlanVersion: 1,
  currentFtpWatts: 250,
  goalId: null,
  goalDescription: null,
  goalTargetDate: null,
  stageMessages: [],
  items: [],
  protectedCount: 0,
  pendingCount: 0,
  decisions: [],
  generations: [],
};
const courses = jest.mocked(trainingApi);
const impacts = jest.mocked(planImpactApi);
const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  training: TrainingScreen,
  "plans/input-impact": () => <Text>核对未来安排详情</Text>,
  "races/[raceId]": () => <Text>赛事详情</Text>,
  "workouts/new": function NewCourse() {
    return <Text>添加日期：{useLocalSearchParams().date}</Text>;
  },
};
beforeEach(() => {
  jest.resetAllMocks();
  courses.getCalendar.mockResolvedValue(calendar);
  impacts.preview.mockResolvedValue(preview);
  jest.mocked(coachApi.races).mockResolvedValue([]);
  jest.mocked(assessmentsApi.list).mockResolvedValue([]);
});

test("empty selected day provides one creation action and keeps impact checking inside the calendar", async () => {
  await renderRouter(routes, { initialUrl: "/training" });
  await screen.findByText("休息日");
  expect(screen.getAllByRole("button", { name: "添加计划" })).toHaveLength(1);
  expect(
    within(screen.getByTestId("training-calendar-card")).getByRole("button", {
      name: "训练安排核对",
    }),
  ).toBeTruthy();
  expect(screen.queryByText("资料变更与未来训练")).toBeNull();
  expect(screen.queryByText("检查未来训练安排")).toBeNull();
  expect(screen.queryByText("0 节课程")).toBeNull();
  expect(screen.queryByText(/尚无训练计划/)).toBeNull();
  expect(screen.getByLabelText(`${today}，今天，休息`)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "添加计划" }));
  await screen.findByText(`添加日期：${today}`);
});

test("historical empty days do not offer creation and can return to today", async () => {
  await renderRouter(routes, {
    initialUrl: `/training?date=${addDays(today, -1)}`,
  });
  await screen.findByText("休息日");
  expect(screen.queryByRole("button", { name: "添加计划" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "回到今天" }));
  await screen.findByText("休息日");
  expect(screen.queryByRole("button", { name: "回到今天" })).toBeNull();
});

test("fixed rest and days without courses share the same rest presentation", async () => {
  courses.getCalendar.mockResolvedValue({
    ...calendar,
    events: [
      {
        id: "rest",
        date: today,
        kind: "REST",
        source: "AVAILABILITY",
        title: "固定休息日",
      },
    ],
  });
  await renderRouter(routes, { initialUrl: "/training" });
  await screen.findByText("休息日");
  expect(screen.getByText("当天没有安排训练，留些时间休息。")).toBeTruthy();
  expect(screen.queryByText("当天暂无课程")).toBeNull();
  expect(screen.getAllByRole("button", { name: "添加计划" })).toHaveLength(1);
});

test("loading and failed requests never masquerade as empty days, and retry recovers", async () => {
  let reject!: (error: Error) => void;
  courses.getCalendar.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await renderRouter(routes, { initialUrl: "/training" });
  await screen.findByText("正在读取训练安排…");
  expect(screen.queryByText("休息日")).toBeNull();
  expect(screen.queryByLabelText(new RegExp(`${today}.*，休息`))).toBeNull();
  expect(screen.queryByRole("button", { name: "添加计划" })).toBeNull();
  await act(async () => reject(new Error("网络暂时中断")));
  await screen.findByText("训练安排暂时无法加载");
  expect(screen.getByText("网络暂时中断")).toBeTruthy();
  expect(screen.queryByText("休息日")).toBeNull();
  expect(screen.queryByLabelText(new RegExp(`${today}.*，休息`))).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "重新加载训练安排" }),
  );
  await screen.findByText("休息日");
});

test("pending status refreshes with calendar retry and links to the existing review flow", async () => {
  impacts.preview.mockRejectedValueOnce(new Error("状态读取失败"));
  await renderRouter(routes, { initialUrl: "/training" });
  await screen.findByText("状态读取失败，进入后可重试");
  impacts.preview.mockResolvedValue({ ...preview, pendingCount: 3 });
  await fireEvent.press(screen.getByRole("button", { name: "刷新训练日历" }));
  await screen.findByText("3 节未来课程待核对");
  expect(impacts.preview).toHaveBeenCalledTimes(2);
  await fireEvent.press(screen.getByRole("button", { name: "训练安排核对" }));
  await screen.findByText("核对未来安排详情");
});

test("races share the selected day's section and keep their detail navigation", async () => {
  jest.mocked(coachApi.races).mockResolvedValue([
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "周末公路赛",
      localDate: today,
      timezone: "Asia/Shanghai",
      distanceKm: 80,
      priority: "A",
      status: "CONFIRMED",
      type: "ROAD_RACE",
      elevationGainM: null,
      intent: "FINISH",
      version: 1,
    },
  ]);
  await renderRouter(routes, { initialUrl: "/training" });
  await waitFor(() =>
    expect(
      within(screen.getByTestId("training-day-section")).getByText(
        "比赛 · 周末公路赛",
      ),
    ).toBeTruthy(),
  );
  expect(screen.queryByText("休息日")).toBeNull();
  expect(screen.queryByLabelText(new RegExp(`${today}.*，休息`))).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "查看赛事与备赛安排" }),
  );
  await screen.findByText("赛事详情");
});
