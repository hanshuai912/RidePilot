import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import type {
  NutritionPlanResponse,
  NutritionProfileResponse,
} from "@ridepilot/contracts";
import { NutritionScreen } from "../screens/NutritionScreen";
import { NutritionDateBrowser } from "../components/NutritionDateBrowser";
import { useNutritionOverview } from "../hooks/useNutritionOverview";
import { useNutritionScheduleRange } from "../hooks/useNutritionScheduleRange";
import { getProfile } from "../../profile/services/profile.api";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { nutritionApi } from "../services/nutrition.api";
import { addDays, localDateInTimezone } from "../../coach/model/plan-dates";
import {
  calendarWeeks,
  dateLabel,
  monthRange,
  shiftMonth,
  shortDateLabel,
  weekStart,
} from "../model/nutrition-dates";

jest.mock("../../profile/services/profile.api", () => ({
  getProfile: jest.fn(),
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../services/nutrition.api", () => ({
  NutritionApiError: class extends Error {},
  nutritionApi: {
    getProfile: jest.fn(),
    getPlan: jest.fn(),
    getPlanRange: jest.fn(),
    trainingState: jest.fn(),
    generate: jest.fn(),
    proposal: jest.fn(),
    apply: jest.fn(),
  },
}));
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));

const api = jest.mocked(nutritionApi);
const today = localDateInTimezone(new Date(), "Asia/Shanghai");
const tomorrow = addDays(today, 1);
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const profile: NutritionProfileResponse = {
  id: id(1),
  version: 1,
  dietStyle: "OMNIVORE",
  habits: [],
  allergens: [],
  restrictions: [],
  restrictionNote: null,
  commonFoods: [],
  mealSchedule: [],
};
const empty: NutritionPlanResponse = {
  planId: id(2),
  version: 4,
  status: "ACTIVE",
  timezone: "Asia/Shanghai",
  from: today,
  to: today,
  dailyTarget: null,
  items: [],
};
const meal = (
  date: string,
  title: string,
): NutritionPlanResponse["items"][number] => ({
  id: id(Number(date.slice(8)) + 10),
  localDate: date,
  mealType: "BREAKFAST",
  scheduledLocalTime: "08:00",
  title,
  foods: [
    {
      name: "燕麦",
      amount: 80,
      unit: "g",
      allergenTags: [],
      ingredientStatus: "KNOWN",
    },
  ],
  nutrients: {
    energyKcal: 500,
    carbohydrateG: 70,
    proteinG: 20,
    fatG: 15,
    fluidMl: null,
    sodiumMg: null,
  },
  nutritionSource: "CURATED",
  confidence: "HIGH",
  linkedWorkoutId: null,
  notes: null,
  warnings: [],
});
function dayPlan(date: string, title?: string): NutritionPlanResponse {
  return {
    ...empty,
    from: date,
    to: date,
    items: title ? [meal(date, title)] : [],
    dailyTarget: title
      ? {
          energyKcal: 2300,
          carbohydrateG: 300,
          proteinG: 110,
          fatG: 60,
          basis: "ESTIMATE",
          confidence: "MEDIUM",
        }
      : null,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.resetAllMocks();
  jest
    .mocked(getProfile)
    .mockResolvedValue({ timezone: "Asia/Shanghai" } as Awaited<
      ReturnType<typeof getProfile>
    >);
  jest
    .mocked(useAuth)
    .mockReturnValue({ session: { accessToken: "test-token" } } as ReturnType<
      typeof useAuth
    >);
  api.getProfile.mockResolvedValue(profile);
  api.getPlan.mockImplementation(async (_, date) => dayPlan(date));
  api.getPlanRange.mockImplementation(async (_, from, to) => ({
    ...empty,
    from,
    to,
  }));
  api.trainingState.mockResolvedValue({
    from: today,
    to: today,
    trainingPlanVersion: 1,
    nutritionVersion: 4,
    affectedDates: [],
    generation: null,
    proposal: null,
  });
});

test("opens the nearest confirmed future day and returns to today without generating anything", async () => {
  api.getPlanRange.mockImplementation(async (_, from, to) => ({
    ...empty,
    from,
    to,
    items:
      tomorrow >= from && tomorrow <= to
        ? [meal(tomorrow, "明日正式早餐")]
        : [],
  }));
  api.getPlan.mockImplementation(async (_, date) =>
    dayPlan(date, date === tomorrow ? "明日正式早餐" : undefined),
  );
  const view = await render(<NutritionScreen />);
  await view.findByRole("button", {
    name: `查看${shortDateLabel(tomorrow)}安排`,
  });
  expect(view.queryByText("明日正式早餐")).toBeNull();
  await fireEvent.press(
    view.getByRole("button", { name: `查看${shortDateLabel(tomorrow)}安排` }),
  );
  await view.findByText("明日正式早餐");
  expect(view.getByText(`${shortDateLabel(tomorrow)}营养目标`)).toBeTruthy();
  expect(
    view.getByRole("button", {
      name: `生成${shortDateLabel(tomorrow)}营养草稿`,
    }),
  ).toBeTruthy();
  expect(api.getPlan).toHaveBeenLastCalledWith("test-token", tomorrow);
  expect(api.trainingState).toHaveBeenLastCalledWith(
    "test-token",
    tomorrow,
    addDays(tomorrow, 6),
  );
  expect(api.generate).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole("button", { name: "今天" }));
  await view.findByText("今天暂无餐次");
  expect(view.queryByText("明日正式早餐")).toBeNull();
});

test("uses the selected date and current global version for generation, and preserves it after apply", async () => {
  const nextWeek = addDays(today, 7);
  api.generate.mockResolvedValue({
    generationId: id(30),
    status: "READY",
    proposalId: id(31),
    errorCode: null,
    requestId: "test",
  });
  api.proposal.mockResolvedValue({
    proposalId: id(31),
    proposalType: "AI_PLAN",
    status: "READY",
    baseNutritionVersion: 4,
    proposalVersion: 1,
    original: null,
    draft: {
      startDate: nextWeek,
      endDate: nextWeek,
      dailyTarget: null,
      items: [meal(nextWeek, "待确认早餐")],
    },
    validation: { passed: true, warnings: [], blockers: [] },
    metadata: null,
  });
  const applied = deferred<Awaited<ReturnType<typeof nutritionApi.apply>>>();
  api.apply.mockReturnValue(applied.promise);
  const view = await render(<NutritionScreen />);
  await view.findByText("今天暂无餐次");
  await fireEvent.press(view.getByRole("button", { name: "下一周" }));
  await view.findByRole("button", {
    name: `生成${shortDateLabel(nextWeek)}营养草稿`,
  });
  await fireEvent.press(
    view.getByRole("button", {
      name: `生成${shortDateLabel(nextWeek)}营养草稿`,
    }),
  );
  await view.findByText("AI 营养草稿 · 尚未应用");
  expect(api.generate).toHaveBeenCalledWith("test-token", {
    startDate: nextWeek,
    endDate: nextWeek,
    mode: "REGENERATE",
    expectedNutritionVersion: 4,
  });
  expect(view.getByText(`${shortDateLabel(nextWeek)}暂无餐次`)).toBeTruthy();
  expect(
    view.getByRole("button", { name: dateLabel(nextWeek) }),
  ).toBeSelected();
  await fireEvent.press(
    view.getByRole("button", { name: "确认应用到正式计划" }),
  );
  await waitFor(() =>
    expect(view.getByRole("button", { name: "下一周" })).toBeDisabled(),
  );
  expect(api.apply).toHaveBeenCalledWith("test-token", id(31), 4);
  api.getPlan.mockImplementation(async (_, date) =>
    dayPlan(date, date === nextWeek ? "已应用早餐" : undefined),
  );
  api.getPlanRange.mockImplementation(async (_, from, to) => ({
    ...empty,
    from,
    to,
    items:
      nextWeek >= from && nextWeek <= to ? [meal(nextWeek, "已应用早餐")] : [],
  }));
  await act(async () =>
    applied.resolve({
      success: true,
      newNutritionVersion: 5,
      affectedDates: [nextWeek],
    }),
  );
  await view.findByText("已应用早餐");
  expect(api.getPlan).toHaveBeenLastCalledWith("test-token", nextWeek);
  expect(view.queryByText("AI 营养草稿 · 尚未应用")).toBeNull();
  await view.findByRole("button", {
    name: `${dateLabel(nextWeek)}，有正式安排`,
  });
});

test("day read failure hides previous meals, disables generation, and retry preserves selection", async () => {
  const nextWeek = addDays(today, 7);
  api.getPlan.mockImplementation(async (_, date) => {
    if (date === nextWeek) throw new Error("当天读取失败");
    return dayPlan(date, "今天的早餐");
  });
  const view = await render(<NutritionScreen />);
  await view.findByText("今天的早餐");
  await fireEvent.press(view.getByRole("button", { name: "下一周" }));
  await view.findByText("当天读取失败");
  expect(view.queryByText("今天的早餐")).toBeNull();
  expect(
    view.getByRole("button", {
      name: `生成${shortDateLabel(nextWeek)}营养草稿`,
    }),
  ).toBeDisabled();
  api.getPlan.mockImplementation(async (_, date) =>
    dayPlan(date, "重试后的早餐"),
  );
  await fireEvent.press(view.getByRole("button", { name: "重试读取饮食安排" }));
  await view.findByText("重试后的早餐");
  expect(api.getPlan).toHaveBeenLastCalledWith("test-token", nextWeek);
});

test("month calendar jumps across years, distinguishes confirmed dates, and can return to today", async () => {
  const onSelect = jest.fn();
  api.getPlanRange.mockImplementation(async (_, from, to) => ({
    ...empty,
    from,
    to,
    items:
      from <= "2027-01-04" && to >= "2027-01-04"
        ? [meal("2027-01-04", "正式餐食")]
        : [],
  }));
  const view = await render(
    <NutritionDateBrowser
      token="t"
      date="2026-12-31"
      today="2026-12-31"
      revision={1}
      disabled={false}
      onSelect={onSelect}
    />,
  );
  await fireEvent.press(view.getByRole("button", { name: "展开饮食月历" }));
  await fireEvent.press(view.getByRole("button", { name: "下一个月" }));
  await view.findByText("2027年1月");
  await view.findByRole("button", { name: "2027年1月4日，有正式安排" });
  expect(api.getPlanRange).toHaveBeenLastCalledWith(
    "t",
    "2027-01-01",
    "2027-01-31",
  );
  await fireEvent.press(
    view.getByRole("button", { name: "2027年1月4日，有正式安排" }),
  );
  expect(onSelect).toHaveBeenCalledWith("2027-01-04");
  expect(view.queryByRole("button", { name: "下一个月" })).toBeNull();
});

test("date marker failure is retriable and never prevents selecting a day", async () => {
  api.getPlanRange.mockRejectedValueOnce(new Error("网络失败"));
  const onSelect = jest.fn();
  const view = await render(
    <NutritionDateBrowser
      token="t"
      date="2026-11-16"
      today="2026-11-16"
      revision={1}
      disabled={false}
      onSelect={onSelect}
    />,
  );
  await view.findByText("安排日期加载失败，仍可选择日期查看详情。");
  await fireEvent.press(view.getByRole("button", { name: "2026年11月17日" }));
  expect(onSelect).toHaveBeenCalledWith("2026-11-17");
  await fireEvent.press(view.getByRole("button", { name: "重试日期标记" }));
  await view.findByText("金点 · 已确认的饮食安排");
});

test("rapid day changes discard stale results and refresh keeps the selected day", async () => {
  const older = deferred<NutritionPlanResponse>();
  const recent = deferred<NutritionPlanResponse>();
  api.getPlan.mockImplementation(async (_, date) =>
    date === tomorrow
      ? older.promise
      : date === addDays(today, 2)
        ? recent.promise
        : dayPlan(date),
  );
  const { result } = await renderHook(() => useNutritionOverview("t"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(() => result.current.selectDate(tomorrow));
  expect(result.current.plan).toBeNull();
  await act(() => result.current.selectDate(addDays(today, 2)));
  await act(async () =>
    recent.resolve(dayPlan(addDays(today, 2), "第二天早餐")),
  );
  expect(result.current.plan?.items[0].title).toBe("第二天早餐");
  await act(async () => older.resolve(dayPlan(tomorrow, "过期响应")));
  expect(result.current.plan?.items[0].title).toBe("第二天早餐");
  await act(async () => result.current.refresh());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.date).toBe(addDays(today, 2));
  expect(api.getPlan).toHaveBeenLastCalledWith("t", addDays(today, 2));
});

test("a slow previous calendar range cannot mark the newly visible range", async () => {
  const old = deferred<NutritionPlanResponse>();
  api.getPlanRange.mockReturnValueOnce(old.promise);
  const { result, rerender } = await renderHook(
    ({ from, to }: { from: string; to: string }) =>
      useNutritionScheduleRange("t", from, to, 1),
    { initialProps: { from: "2026-12-01", to: "2026-12-31" } },
  );
  await rerender({ from: "2027-01-01", to: "2027-01-31" });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () =>
    old.resolve({ ...empty, items: [meal("2026-12-20", "旧月份餐食")] }),
  );
  expect(result.current.dates.size).toBe(0);
});

test("account timezone determines today rather than the device timezone", async () => {
  jest
    .mocked(getProfile)
    .mockResolvedValue({ timezone: "Pacific/Kiritimati" } as Awaited<
      ReturnType<typeof getProfile>
    >);
  const { result } = await renderHook(() => useNutritionOverview("t"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.today).toBe(
    localDateInTimezone(new Date(), "Pacific/Kiritimati"),
  );
  expect(api.getPlan).toHaveBeenLastCalledWith("t", result.current.today);
});

test("calendar date calculations handle leap days, Monday weeks and month/year boundaries", () => {
  expect(monthRange("2028-02-10")).toEqual(["2028-02-01", "2028-02-29"]);
  expect(shiftMonth("2026-12-31", 1)).toBe("2027-01-01");
  expect(shiftMonth("2027-01-31", -1)).toBe("2026-12-01");
  expect(weekStart("2027-01-03")).toBe("2026-12-28");
  const days = calendarWeeks("2028-02-01").flat().filter(Boolean);
  expect(days).toHaveLength(29);
  expect(days.at(-1)).toBe("2028-02-29");
  expect(calendarWeeks("2026-11-01")).toHaveLength(6);
});

test("generation locks date changes until its selected-day result is ready", async () => {
  const generation =
    deferred<Awaited<ReturnType<typeof nutritionApi.generate>>>();
  api.generate.mockReturnValue(generation.promise);
  const view = await render(<NutritionScreen />);
  await view.findByRole("button", { name: "生成今日营养草稿" });
  await fireEvent.press(view.getByRole("button", { name: "生成今日营养草稿" }));
  expect(view.getByRole("button", { name: "下一周" })).toBeDisabled();
  expect(view.getByRole("button", { name: "展开饮食月历" })).toBeDisabled();
  await act(async () => generation.reject(new Error("生成服务暂不可用")));
  await view.findByText("生成服务暂不可用");
  expect(view.getByRole("button", { name: "下一周" })).not.toBeDisabled();
  expect(api.getPlan).toHaveBeenLastCalledWith("test-token", today);
});

test("future lookup failure offers retry rather than claiming no future schedule", async () => {
  let lookupFailed = false;
  api.getPlanRange.mockImplementation(async (_, from, to) => {
    if (from === tomorrow && !lookupFailed) {
      lookupFailed = true;
      throw new Error("网络失败");
    }
    return {
      ...empty,
      from,
      to,
      items: from === tomorrow ? [meal(tomorrow, "未来早餐")] : [],
    };
  });
  const view = await render(<NutritionScreen />);
  await view.findByRole("button", { name: "重试查找后续安排" });
  expect(
    view.queryByText("未来 30 天暂无已确认的安排，可展开月历查看其他日期。"),
  ).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "重试查找后续安排" }));
  await view.findByRole("button", {
    name: `查看${shortDateLabel(tomorrow)}安排`,
  });
});

test("account read failure is retriable and does not pretend the nutrition profile is missing", async () => {
  jest.mocked(getProfile).mockRejectedValueOnce(new Error("账号资料读取失败"));
  const view = await render(<NutritionScreen />);
  await view.findByText("账号资料读取失败");
  expect(view.queryByText("建立你的饮食档案")).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "重试读取饮食安排" }));
  await view.findByText("今天暂无餐次");
});
