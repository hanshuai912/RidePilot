import { cyclingPowerZones, parseFtpWatts } from "../model/power-zones";

test("200 W produces seven continuous zones and an open sprint band", () => {
  expect(
    cyclingPowerZones(200).map(({ minWatts, maxWatts }) => [
      minWatts,
      maxWatts,
    ]),
  ).toEqual([
    [0, 110],
    [111, 150],
    [151, 180],
    [181, 210],
    [211, 240],
    [241, 300],
    [301, null],
  ]);
});

test("every valid FTP has non-overlapping integer boundaries without missing watts", () => {
  for (let ftp = 50; ftp <= 800; ftp++) {
    const zones = cyclingPowerZones(ftp);
    expect(zones).toHaveLength(7);
    expect(zones[0].minWatts).toBe(0);
    for (let index = 1; index < zones.length; index++) {
      expect(zones[index].minWatts).toBe(zones[index - 1].maxWatts! + 1);
    }
    expect(zones[6].maxWatts).toBeNull();
  }
  expect(cyclingPowerZones(193).map((zone) => zone.maxWatts)).toEqual([
    106,
    144,
    173,
    202,
    231,
    289,
    null,
  ]);
});

test.each([null, 0, 49, 801, NaN, Infinity, 200.5])(
  "invalid FTP %s never displays calculated wattage",
  (ftp) => {
    expect(
      cyclingPowerZones(ftp).every(
        (zone) => zone.minWatts === null && zone.maxWatts === null,
      ),
    ).toBe(true);
  },
);

test.each(["", " ", "49", "801", "200.5", "abc", "1e2", "-100"])(
  "rejects invalid input %s",
  (text) => {
    expect(parseFtpWatts(text)).toBeNull();
  },
);

test.each(["50", "800", " 193 "])("accepts valid integer input %s", (text) => {
  expect(parseFtpWatts(text)).toBe(Number(text));
});
