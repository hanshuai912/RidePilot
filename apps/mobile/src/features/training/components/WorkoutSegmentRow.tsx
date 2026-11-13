import { Pressable, View } from "react-native";
import Sortable from "react-native-sortables";
import { GripVertical, Trash2 } from "lucide-react-native";
import type { WorkoutSegment } from "@ridepilot/contracts";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { segmentListStyles as styles } from "./workout-segment-list.styles";

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

function intensityLabel(segment: WorkoutSegment, ftpWatts?: number | null) {
  return segment.intensity.kind === "ftp_percent"
    ? `FTP ${segment.intensity.min}–${segment.intensity.max}%${ftpWatts ? ` · ${Math.round((ftpWatts * segment.intensity.min) / 100)}–${Math.round((ftpWatts * segment.intensity.max) / 100)} W` : ""}`
    : `${segment.intensity.min}–${segment.intensity.max} W`;
}

export function WorkoutSegmentRow({
  segment,
  index,
  count,
  width,
  ftpWatts,
  onEdit,
  onDelete,
  onMove,
}: {
  segment: WorkoutSegment;
  index: number;
  count: number;
  width?: number;
} & {
  ftpWatts?: number | null;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  onMove?: (from: number, to: number) => void;
}) {
  const content = (
    <>
      <AppText variant="card" style={styles.segmentTitle}>
        {index + 1} · {typeLabels[segment.type]}
      </AppText>
      <View style={styles.metaRow}>
        <AppText variant="caption" muted>
          {targetLabel(segment)}
        </AppText>
        <AppText variant="caption" style={styles.intensity}>
          {intensityLabel(segment, ftpWatts)}
        </AppText>
      </View>
    </>
  );
  return (
    <View
      testID={`workout-segment-${index}`}
      style={[styles.segment, width ? { width } : undefined]}
    >
      {onMove && count > 1 ? (
        <Sortable.Handle>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`拖动第${index + 1}个动作排序`}
            accessibilityHint="长按六点图标后上下拖动；读屏可使用调整操作改变顺序"
            accessibilityValue={{ min: 1, max: count, now: index + 1 }}
            accessibilityActions={[
              ...(index > 0
                ? [{ name: "decrement", label: "移至前一位" }]
                : []),
              ...(index < count - 1
                ? [{ name: "increment", label: "移至后一位" }]
                : []),
            ]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === "decrement" && index > 0)
                onMove(index, index - 1);
              if (nativeEvent.actionName === "increment" && index < count - 1)
                onMove(index, index + 1);
            }}
            style={styles.touch}
          >
            <GripVertical size={21} color={colors.textMuted} />
          </View>
        </Sortable.Handle>
      ) : null}
      {onEdit ? (
        <Pressable
          style={({ pressed }) => [
            styles.segmentBody,
            pressed && styles.pressed,
          ]}
          onPress={() => onEdit(index)}
          accessibilityRole="button"
          accessibilityLabel={`编辑第${index + 1}个动作`}
        >
          {content}
        </Pressable>
      ) : (
        <View style={styles.segmentBody}>{content}</View>
      )}
      {onDelete ? (
        <Pressable
          style={({ pressed }) => [styles.touch, pressed && styles.pressed]}
          onPress={() => onDelete(index)}
          accessibilityRole="button"
          accessibilityLabel={`删除第${index + 1}个动作`}
        >
          <Trash2 size={18} color={colors.negative} />
        </Pressable>
      ) : null}
    </View>
  );
}
