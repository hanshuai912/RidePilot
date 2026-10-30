export const powerZoneDefinitions = [
  { id: "Z1", name: "主动恢复", upperPercent: 55 },
  { id: "Z2", name: "有氧耐力", upperPercent: 75 },
  { id: "Z3", name: "节奏", upperPercent: 90 },
  { id: "Z4", name: "乳酸阈值", upperPercent: 105 },
  { id: "Z5", name: "最大摄氧量", upperPercent: 120 },
  { id: "Z6", name: "无氧能力", upperPercent: 150 },
  { id: "Z7", name: "神经肌肉功率", upperPercent: null },
] as const;

export function parseFtpWatts(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 50 && value <= 800 ? value : null;
}

// Use the previous zone's integer upper bound + 1 W to avoid gaps or overlaps.
// Z7 >150% is the app's sprint reference band, not a measured sprint maximum.
export function cyclingPowerZones(ftp: number | null) {
  const valid =
    ftp !== null && Number.isInteger(ftp) && ftp >= 50 && ftp <= 800;
  return powerZoneDefinitions.map((zone, index) => {
    const lowerPercent =
      index === 0 ? 0 : powerZoneDefinitions[index - 1].upperPercent!;
    const minWatts = valid
      ? index === 0
        ? 0
        : Math.floor((ftp * lowerPercent) / 100) + 1
      : null;
    const maxWatts =
      valid && zone.upperPercent !== null
        ? Math.floor((ftp * zone.upperPercent) / 100)
        : null;
    const percentage =
      index === 0
        ? "≤55% FTP"
        : zone.upperPercent === null
          ? ">150% FTP"
          : `>${lowerPercent}%–${zone.upperPercent}% FTP`;
    return { ...zone, minWatts, maxWatts, percentage };
  });
}
