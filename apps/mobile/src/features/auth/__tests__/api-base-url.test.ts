import { resolveApiBaseUrl } from "../services/api-base-url";

test("physical Android uses the current Metro LAN host for the local API", () => {
  expect(
    resolveApiBaseUrl({
      metroHostUri: "192.168.0.73:8081",
      platform: "android",
      isDevelopment: true,
    }),
  ).toBe("http://192.168.0.73:3000/api/v1");
});

test("explicit API URL takes precedence over the Metro host", () => {
  expect(
    resolveApiBaseUrl({
      configuredUrl: " http://127.0.0.1:3000/api/v1/ ",
      metroHostUri: "192.168.0.73:8081",
      platform: "android",
      isDevelopment: true,
    }),
  ).toBe("http://127.0.0.1:3000/api/v1");
});

test("Android emulator fallback remains available without a Metro host", () => {
  expect(
    resolveApiBaseUrl({ platform: "android", isDevelopment: true }),
  ).toBe("http://10.0.2.2:3000/api/v1");
});
