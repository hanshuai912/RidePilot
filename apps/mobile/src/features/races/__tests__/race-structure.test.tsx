import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { coachApi } from "../../coach/services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";
import { RaceFormScreen } from "../screens/RaceFormScreen";
import { RaceDetailScreen } from "../screens/RaceDetailScreen";

let mockParams: { raceId?: string } = {};
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
    back: jest.fn(),
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({
  useAuth: () => ({ session: { accessToken: "token" } }),
}));
jest.mock("../../coach/services/coach.api", () => ({
  coachApi: {
    race: jest.fn(),
    raceImpact: jest.fn(),
    raceResult: jest.fn(),
    createRace: jest.fn(),
    updateRace: jest.fn(),
  },
}));
jest.mock("../../nutrition/services/nutrition.api", () => ({
  nutritionApi: { raceState: jest.fn() },
}));

const api = jest.mocked(coachApi);
const race: Awaited<ReturnType<typeof coachApi.race>> = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "环湖赛",
  localDate: "2030-06-09",
  timezone: "Asia/Shanghai",
  distanceKm: 100,
  elevationGainM: 500,
  type: "ROAD_RACE",
  priority: "A",
  intent: "FINISH",
  status: "CONFIRMED",
  version: 2,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  api.race.mockResolvedValue(race);
  api.raceImpact.mockResolvedValue({
    race,
    conflicts: [],
    affectedDates: [],
    currentTrainingVersion: 3,
    requiresReplan: false,
    startDate: "2030-06-01",
    endDate: "2030-06-12",
  });
  api.raceResult.mockResolvedValue(null);
  jest
    .mocked(nutritionApi.raceState)
    .mockResolvedValue({ generation: null, proposal: null });
});

test("editing waits for loaded values and retains version checking when saving", async () => {
  mockParams = { raceId: race.id };
  let resolve!: (value: typeof race) => void;
  api.race.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  api.updateRace.mockResolvedValue({ ...race, name: "环湖挑战赛", version: 3 });
  const view = await render(<RaceFormScreen />);
  expect(view.getByLabelText("正在加载训练数据")).toBeTruthy();
  expect(view.queryByLabelText("赛事名称")).toBeNull();
  expect(view.queryByText("保存赛事")).toBeNull();
  await act(async () => {
    resolve(race);
  });
  expect(view.getByLabelText("赛事名称").props.value).toBe("环湖赛");
  await fireEvent.changeText(view.getByLabelText("赛事名称"), "环湖挑战赛");
  await fireEvent.press(view.getByText("保存赛事"));
  await waitFor(() =>
    expect(api.updateRace).toHaveBeenCalledWith(
      "token",
      race.id,
      expect.objectContaining({ name: "环湖挑战赛", expectedVersion: 2 }),
    ),
  );
  expect(router.replace).toHaveBeenCalledWith({
    pathname: "/races/[raceId]",
    params: { raceId: race.id },
  });
});

test("invalid race fields stay editable and never submit", async () => {
  const view = await render(<RaceFormScreen />);
  await fireEvent.press(view.getByText("保存赛事"));
  expect(view.getByText("赛事名称需为 1–120 个字符")).toBeTruthy();
  expect(view.getByText("请输入有效日期（YYYY-MM-DD）")).toBeTruthy();
  expect(view.getByText("距离需大于 0 且不超过 2000 km")).toBeTruthy();
  expect(api.createRace).not.toHaveBeenCalled();
  expect(view.getByLabelText("比赛时区").props.value).toBe("Asia/Shanghai");
});

test("race read failure can retry and management and result entries remain available", async () => {
  mockParams = { raceId: race.id };
  api.race.mockRejectedValueOnce(new Error("赛事读取中断"));
  const view = await render(<RaceDetailScreen />);
  await view.findByText("赛事读取中断");
  await fireEvent.press(view.getByRole("button", { name: "重试" }));
  await view.findByText("环湖赛");
  expect(view.getByText("查看备赛计划与草稿")).toBeTruthy();
  expect(view.queryByText("编辑赛事")).toBeNull();
  expect(view.queryByText("赛后结果")).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "管理赛事" }));
  expect(view.getByText("编辑赛事")).toBeTruthy();
  expect(view.getByText("取消赛事")).toBeTruthy();
  await fireEvent.press(view.getByRole("button", { name: "记录比赛结果" }));
  expect(view.getByText("赛后结果")).toBeTruthy();
  expect(api.updateRace).not.toHaveBeenCalled();
});
