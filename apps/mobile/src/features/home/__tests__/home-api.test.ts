import { homeApi } from "../services/home.api";
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
const data = {
  localDate: "2026-10-30",
  profile: {
    userId: "00000000-0000-4000-8000-000000000001",
    displayName: "骑行者",
    timezone: "Asia/Shanghai",
  },
  training: {
    status: "READY",
    data: {
      plan: { hasActivePlan: false, planVersion: 0 },
      calendar: {
        from: "2026-10-30",
        to: "2026-10-30",
        ftpAvailable: false,
        items: [],
      },
      nextWorkout: null,
    },
  },
  nutrition: {
    status: "UNAVAILABLE",
    error: { code: "HOME_NUTRITION_UNAVAILABLE", message: "饮食暂不可用" },
  },
};
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
test("fetches the authenticated aggregate endpoint once and accepts partial success", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => data });
  await expect(homeApi.today("token")).resolves.toEqual(data);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/v1\/home\/today$/),
    expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
  );
});
test("rejects malformed data instead of showing a successful empty home", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ localDate: "invalid" }),
  });
  await expect(homeApi.today("token")).rejects.toThrow("首页数据无效");
});
test("does not turn an authentication error into an empty plan", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: "请重新登录" }),
  });
  await expect(homeApi.today("expired")).rejects.toThrow("请重新登录");
});
