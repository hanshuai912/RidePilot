import { StyleSheet, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import type { WorkoutSegment } from "@ridepilot/contracts";
import { AppText } from "../../../components/ui";
import { colors, spacing } from "../../../theme/tokens";
import {
  buildWorkoutProfile,
  formatProfileNumber as number,
  segmentTypeLabels,
  type ProfileMaximums,
} from "../model/workout-profile";
import { segmentTotals } from "../model/segment-totals";

const WIDTH = 316;
const HEIGHT = 83;
const BASELINE = 69;
const PLOT_HEIGHT = 60;
const phaseColors = {
  warmup: colors.neutral,
  work: colors.positive,
  recovery: colors.textMuted,
  cooldown: colors.neutral,
} as const;

export function WorkoutProfileChart({
  segments,
  maximums,
}: {
  segments: WorkoutSegment[];
  maximums?: ProfileMaximums;
}) {
  const profile = buildWorkoutProfile(segments, maximums);
  const distance = segmentTotals(segments).kilometers;
  if (!profile)
    return distance > 0 ? (
      <AppText variant="caption" muted>
        距离目标共 {number(distance)}{" "}
        公里，按动作列表执行；距离不换算为时间曲线。
      </AppText>
    ) : null;

  const description = profile.blocks
    .map(
      (block) =>
        `${segmentTypeLabels[block.type]} ${number(block.minutes)} 分钟，计划强度区间中值 ${number(block.averageIntensity)} ${block.kind === "power_watt" ? "W" : "%FTP"}`,
    )
    .join("；");

  return (
    <View style={styles.container}>
      {profile.lanes.map((lane) => (
        <View key={lane.kind} style={styles.lane}>
          <View style={styles.caption}>
            <AppText variant="label" muted>
              计划区间中值 · {lane.unit}
            </AppText>
            <AppText variant="label" muted>
              0–{number(lane.maximum)} {lane.unit}
            </AppText>
          </View>
          <Svg
            width="100%"
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            accessible
            accessibilityRole="image"
            accessibilityLabel={`训练结构（${lane.unit}）：${description}；时间动作共 ${number(profile.totalMinutes)} 分钟${profile.lanes.length > 1 ? "；不同单位分行显示，共用时间轴" : ""}`}
          >
            {[17, 43].map((y) => (
              <Line
                key={y}
                x1={0}
                x2={WIDTH}
                y1={y}
                y2={y}
                stroke={colors.border}
                strokeDasharray="3 4"
              />
            ))}
            {profile.blocks.map((block, index) => {
              if (block.kind !== lane.kind) return null;
              const height =
                (block.averageIntensity / lane.maximum) * PLOT_HEIGHT;
              return (
                <Rect
                  key={index}
                  x={block.start * WIDTH}
                  y={BASELINE - height}
                  width={block.width * WIDTH}
                  height={height}
                  fill={phaseColors[block.type]}
                  fillOpacity={0.72}
                  stroke={colors.surface1}
                  strokeWidth={0.5}
                />
              );
            })}
            <Line
              x1={0}
              x2={WIDTH}
              y1={BASELINE}
              y2={BASELINE}
              stroke={colors.textMuted}
            />
          </Svg>
          <View style={styles.caption}>
            <AppText variant="label" muted>
              0
            </AppText>
            <AppText variant="label" muted>
              {number(profile.totalMinutes / 2)}
            </AppText>
            <AppText variant="label" muted>
              {number(profile.totalMinutes)} 分钟
            </AppText>
          </View>
        </View>
      ))}
      <View style={styles.legend}>
        {profile.legend.map((entry) => (
          <View key={entry.type} style={styles.legendItem}>
            <View
              style={[styles.dot, { backgroundColor: phaseColors[entry.type] }]}
            />
            <AppText variant="label" muted>
              {number(entry.minutes)} 分钟 {segmentTypeLabels[entry.type]}
            </AppText>
          </View>
        ))}
      </View>
      {distance > 0 ? (
        <AppText variant="caption" muted>
          另含 {number(distance)}{" "}
          公里距离动作，未计入此时间轴；完整顺序见动作列表。
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.sm, gap: spacing.xs },
  lane: { gap: spacing.xs },
  caption: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
