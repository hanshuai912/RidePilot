import { Pressable, StyleSheet, View } from "react-native";
import { Ellipsis, GripVertical, Plus, Trash2 } from "lucide-react-native";
import type { WorkoutSegment } from "@ridepilot/contracts";

import { colors } from "../../../theme/tokens";
import { AppText, Card } from "../../../components/ui";

const typeLabels = {
  warmup: "热身",
  work: "训练",
  recovery: "恢复",
  cooldown: "放松",
} as const;

function targetLabel(segment: WorkoutSegment) {
  const repeat =
    segment.repeatCount && segment.repeatCount > 1
      ? ` × ${segment.repeatCount}`
      : "";
  return segment.target.kind === "duration"
    ? `时间 · ${segment.target.value} 分钟${repeat}`
    : `距离 · ${segment.target.value} 公里${repeat}`;
}

function intensityLabel(segment: WorkoutSegment) {
  return segment.intensity.kind === "ftp_percent"
    ? `FTP ${segment.intensity.min}–${segment.intensity.max}%`
    : `${segment.intensity.min}–${segment.intensity.max} W`;
}

export function WorkoutSegmentList({
  segments,
  onAdd,
  onEdit,
  onDelete,
}: {
  segments: WorkoutSegment[];
  onAdd?: () => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}) {
  return (
    <Card style={styles.card}>
      {segments.map((segment, index) => (
        <View key={`${segment.id ?? "new"}-${index}`} style={styles.segment}>
          <View style={styles.segmentHead}>
            <View style={styles.segmentTitle}>
              <GripVertical size={15} color={colors.textMuted} />
              <AppText variant="card">
                {index + 1} · {typeLabels[segment.type]}
              </AppText>
            </View>
            <View style={styles.actions}>
              {onEdit ? (
                <Pressable
                  onPress={() => onEdit(index)}
                  accessibilityLabel={`编辑第${index + 1}个动作`}
                >
                  <Ellipsis size={19} color={colors.textMuted} />
                </Pressable>
              ) : null}
              {onDelete ? (
                <Pressable
                  onPress={() => onDelete(index)}
                  accessibilityLabel={`删除第${index + 1}个动作`}
                >
                  <Trash2 size={16} color={colors.negative} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={styles.metaRow}>
            <AppText variant="caption" muted>
              {targetLabel(segment)}
            </AppText>
            <AppText variant="caption" style={styles.intensity}>
              {intensityLabel(segment)}
            </AppText>
          </View>
        </View>
      ))}
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          style={styles.addButton}
          accessibilityRole="button"
        >
          <Plus size={16} color={colors.brand} />
          <AppText variant="label" style={styles.addLabel}>
            添加动作
          </AppText>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function segmentTotals(segments: WorkoutSegment[]) {
  return segments.reduce(
    (totals, segment) => {
      const value = segment.target.value * (segment.repeatCount ?? 1);
      if (segment.target.kind === "duration") totals.minutes += value;
      else totals.kilometers += value;
      return totals;
    },
    { minutes: 0, kilometers: 0 },
  );
}

const styles = StyleSheet.create({
  card: { padding: 10, gap: 8 },
  segment: {
    backgroundColor: colors.surface2,
    borderRadius: 14,
    padding: 13,
    gap: 10,
  },
  segmentHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  segmentTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  actions: { flexDirection: "row", gap: 13, alignItems: "center" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  intensity: {
    color: colors.brand,
    backgroundColor: colors.brandSubtle,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addButton: {
    marginTop: 2,
    borderStyle: "dashed",
    flexDirection: "row",
    gap: 6,
  },
  addLabel: { color: colors.brand },
});
