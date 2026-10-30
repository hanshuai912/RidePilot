import { StyleSheet, View } from "react-native";
import {
  calculateHeartRateZones,
  type HeartRateValues,
} from "@ridepilot/contracts";
import { AppText, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";
import { radii } from "../../../theme/radius";

export function HeartRateZones({ values }: { values: HeartRateValues }) {
  const zones = calculateHeartRateZones(values);
  return (
    <View style={styles.section}>
      <AppText variant="card">心率区间</AppText>
      <AppText variant="caption" muted style={styles.caption}>
        {zones.length} 区 · 根据当前填写数值自动计算
      </AppText>
      <Card style={styles.card}>
        {zones.map((zone, index) => (
          <View
            key={zone.id}
            testID={`heart-rate-zone-${zone.id}`}
            style={[styles.row, index > 0 && styles.divider]}
          >
            <View style={styles.code}>
              <AppText variant="caption">{zone.id}</AppText>
            </View>
            <View style={styles.details}>
              <AppText>{zone.name}</AppText>
              <AppText variant="caption" muted>
                {zone.percentage}
              </AppText>
            </View>
            <AppText style={styles.bpm}>
              {zone.minBpm === null
                ? "— bpm"
                : zone.maxBpm === null
                  ? `≥${zone.minBpm} bpm`
                  : values.method === "LTHR" && index === 0
                    ? `≤${zone.maxBpm} bpm`
                    : `${zone.minBpm}–${zone.maxBpm} bpm`}
            </AppText>
          </View>
        ))}
      </Card>
      <AppText variant="caption" muted style={styles.note}>
        {values.method === "RESERVE"
          ? "区间心率 = 静息心率 +（最大心率 − 静息心率）× 区间比例。"
          : values.method === "LTHR"
            ? "区间比例以乳酸阈心率为基准，Z5–Z7 为阈值以上的三个区间。"
            : "区间比例以最大心率为基准，低于 50% 的心率不计入训练区间。"}
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl },
  caption: { marginTop: spacing.sm, marginBottom: spacing.md },
  card: { paddingVertical: 0, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  code: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
    borderRadius: radii.sm,
  },
  details: { flex: 1, minWidth: 84, gap: spacing.xs },
  bpm: { fontVariant: ["tabular-nums"], fontWeight: "600" },
  note: { marginTop: spacing.md },
});
