import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { CoachRacePreparationScreen } from "../screens/CoachRacePreparationScreen";
import { ReplanBrief } from "../components/ReplanBrief";
import { coachApi } from "../services/coach.api";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSession: { accessToken: string } | null = { accessToken: "token" };
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));
jest.mock("../../auth/hooks/AuthProvider", () => ({
  useAuth: () => ({ session: mockSession }),
}));
jest.mock("../services/coach.api", () => ({ coachApi: { races: jest.fn() } }));
const api = jest.mocked(coachApi);
const race: Awaited<ReturnType<typeof coachApi.races>>[number] = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "山地公路挑战赛",
  localDate: "2030-01-11",
  timezone: "Asia/Shanghai",
  distanceKm: 100,
  priority: "A",
  type: "ROAD_RACE",
  elevationGainM: null,
  intent: "FINISH",
  status: "CONFIRMED",
  version: 1,
};
beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers({ now: new Date("2030-01-09T16:30:00Z") });
  mockSession = { accessToken: "token" };
  api.races.mockResolvedValue([race]);
});
afterEach(() => jest.useRealTimers());

it("selects an upcoming race and opens its preparation draft without a generic planning form", async () => {
  const ui = await render(<CoachRacePreparationScreen />);
  await ui.findByText(race.name);
  await fireEvent.press(
    ui.getByRole("button", { name: `为${race.name}制定备赛计划` }),
  );
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/races/proposal",
    params: { raceId: race.id, phase: "PREPARATION" },
  });
  expect(ui.queryByLabelText("训练调整说明")).toBeNull();
  await fireEvent.press(ui.getByRole("button", { name: "添加赛事" }));
  expect(mockPush).toHaveBeenLastCalledWith("/races/new");
  await fireEvent.press(ui.getByRole("button", { name: "返回上一页" }));
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/coach");
});

it("filters by each race's local date and status, then orders eligible races by date", async () => {
  api.races.mockResolvedValue([
    race,
    { ...race, id: "past", name: "已过期赛事", localDate: "2030-01-09" },
    { ...race, id: "cancelled", name: "已取消赛事", status: "CANCELLED" },
    { ...race, id: "completed", name: "已完成赛事", status: "COMPLETED" },
    {
      ...race,
      id: "western",
      name: "当地今日赛事",
      localDate: "2030-01-09",
      timezone: "America/Los_Angeles",
    },
  ]);
  const ui = await render(<CoachRacePreparationScreen />);
  await ui.findByText(race.name);
  for (const name of ["已过期赛事", "已取消赛事", "已完成赛事"])
    expect(ui.queryByText(name)).toBeNull();
  expect(
    ui
      .getAllByRole("button")
      .filter((button) => button.props.accessibilityLabel?.startsWith("为"))
      .map((button) => button.props.accessibilityLabel),
  ).toEqual(["为当地今日赛事制定备赛计划", `为${race.name}制定备赛计划`]);
});

it("offers adding and managing races when none are eligible", async () => {
  api.races.mockResolvedValue([{ ...race, status: "COMPLETED" }]);
  const ui = await render(<CoachRacePreparationScreen />);
  await ui.findByText("暂无待备赛赛事");
  await fireEvent.press(ui.getByRole("button", { name: "添加赛事" }));
  expect(mockPush).toHaveBeenLastCalledWith("/races/new");
  await fireEvent.press(ui.getByRole("button", { name: "查看全部赛事" }));
  expect(mockPush).toHaveBeenLastCalledWith("/races");
});

it("shows one loader while reading and retries a failed read without claiming an empty list", async () => {
  let reject!: (error: Error) => void;
  api.races.mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  const ui = await render(<CoachRacePreparationScreen />);
  expect(ui.getByLabelText("读取待备赛赛事")).toBeTruthy();
  expect(ui.queryByText("暂无待备赛赛事")).toBeNull();
  reject(new Error("赛事离线"));
  await ui.findByText("赛事离线");
  expect(ui.queryByText("暂无待备赛赛事")).toBeNull();
  await fireEvent.press(ui.getByRole("button", { name: "重新读取赛事" }));
  await ui.findByText(race.name);
  expect(api.races).toHaveBeenCalledTimes(2);
});

it("requires login before reading or offering race actions", async () => {
  mockSession = null;
  const ui = await render(<CoachRacePreparationScreen />);
  await ui.findByText("请先登录后查看赛事。");
  expect(api.races).not.toHaveBeenCalled();
  expect(ui.queryByText("暂无待备赛赛事")).toBeNull();
});

it("keeps training adjustments focused on supported scopes, a note and the current goal", async () => {
  const setPlanningScope = jest.fn(),
    setTaskNote = jest.fn(),
    onEditGoal = jest.fn();
  const ui = await render(
    <ReplanBrief
      planningScope="NEXT_WEEK"
      setPlanningScope={setPlanningScope}
      taskNote="每次只练 40 分钟"
      setTaskNote={setTaskNote}
      planStatus={{ hasActivePlan: true, planVersion: 2 }}
      goalLabel="耐力目标"
      goalDate="2030-05-01"
      onEditGoal={onEditGoal}
    />,
  );
  expect(ui.getAllByRole("radio")).toHaveLength(3);
  expect(ui.queryByText("整个训练周期")).toBeNull();
  expect(
    ui.getByRole("radio", { name: "从下周开始" }).props.accessibilityState
      .checked,
  ).toBe(true);
  await fireEvent.press(ui.getByRole("radio", { name: "下一节训练" }));
  expect(setPlanningScope).toHaveBeenCalledWith("NEXT_WORKOUT");
  await fireEvent.changeText(ui.getByLabelText("训练调整说明"), "下周出差");
  expect(setTaskNote).toHaveBeenCalledWith("下周出差");
  await fireEvent.press(ui.getByRole("button", { name: "修改当前目标与日期" }));
  expect(onEditGoal).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(ui.getByText(/基于正式计划 v2/)).toBeTruthy());
});
