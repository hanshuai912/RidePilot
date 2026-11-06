import { coachApi } from "../services/coach.api";

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
const saved = {
  id: "00000000-0000-4000-8000-000000000001",
  valueWatts: 220,
  measuredAt: "2026-10-01T00:00:00.000Z",
  source: "MANUAL",
};

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

test("saving current FTP uses the server timestamp even when the device clock is ahead", async () => {
  jest.useFakeTimers({ now: new Date("2026-10-01T08:00:00.000Z") });
  fetchMock.mockResolvedValue({ ok: true, json: async () => saved });
  await expect(coachApi.addFtp("token", 220)).resolves.toEqual(saved);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/v1\/me\/ability-measurements\/ftp$/),
    expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ valueWatts: 220, source: "MANUAL" }),
    }),
  );
});

test("a saved FTP response must still contain a valid measurement timestamp", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      id: saved.id,
      valueWatts: saved.valueWatts,
      source: saved.source,
    }),
  });
  await expect(coachApi.addFtp("token", 220)).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});

test("a failed FTP write preserves the server error for the editor", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({
      code: "FTP_DATE_IN_FUTURE",
      message: "FTP 测量日期不能晚于当前时间",
    }),
  });
  await expect(coachApi.addFtp("token", 220)).rejects.toMatchObject({
    status: 400,
    code: "FTP_DATE_IN_FUTURE",
    message: "FTP 测量日期不能晚于当前时间",
  });
});
