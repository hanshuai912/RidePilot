import { StyleSheet, View } from "react-native";
import { AppText, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { radii } from "../../../theme/radius";
import { spacing } from "../../../theme/spacing";
import { cyclingPowerZones } from "../model/power-zones";

export function FtpPowerZones({ ftp }: { ftp: number | null }) {
  return (
    <View style={styles.section}>
      <AppText variant="card">功率区间</AppText>
      <AppText variant="caption" muted style={styles.caption}>
        {ftp === null
          ? "填写有效 FTP 后，自动显示 7 区功率"
          : `7 区 · 基于 FTP ${ftp} W`}
      </AppText>
      <Card style={styles.card}>
        {cyclingPowerZones(ftp).map((zone, index) => (
          <View
            key={zone.id}
            testID={`power-zone-${zone.id}`}
            style={[styles.row, index > 0 && styles.divider]}
          >
            <View style={styles.code}>
              <AppText variant="caption">{zone.id}</AppText>
            </View>
            <View style={styles.details}>
              <AppText>{zone.name}</AppText>
              <AppText variant="caption" muted style={styles.percentage}>
                {zone.percentage}
              </AppText>
            </View>
            <AppText style={styles.watts}>
              {zone.minWatts === null
                ? "— W"
                : zone.maxWatts === null
                  ? `≥${zone.minWatts} W`
                  : `${zone.minWatts}–${zone.maxWatts} W`}
            </AppText>
          </View>
        ))}
      </Card>
      <AppText variant="caption" muted style={styles.note}>
        Z7 为冲刺参考区间，实际以个人短时最大功率为准。
      </AppText>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl },
  caption: { marginTop: spacing.sm, marginBottom: spacing.md },
  note: { marginTop: spacing.md },
  card: { paddingVertical: 0, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: spacing.md,
    flexWrap: "wrap",
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
  details: { flex: 1, minWidth: 96 },
  percentage: { marginTop: spacing.xs },
  watts: {
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
