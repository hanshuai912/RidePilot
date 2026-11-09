import { useCallback, useContext } from "react";
import Sortable, {
  type SortableGridDragEndParams,
  type SortableGridRenderItem,
} from "react-native-sortables";
import { useSortableSegments } from "../hooks/useSortableSegments";
import { TrainingScrollContext } from "./TrainingScrollContext";
import { Pressable, StyleSheet, View } from "react-native";
import { GripVertical, Plus, Trash2 } from "lucide-react-native";
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

function intensityLabel(segment: WorkoutSegment, ftpWatts?: number | null) {
  return segment.intensity.kind === "ftp_percent"
    ? `FTP ${segment.intensity.min}–${segment.intensity.max}%${ftpWatts ? ` · ${Math.round((ftpWatts * segment.intensity.min) / 100)}–${Math.round((ftpWatts * segment.intensity.max) / 100)} W` : ""}`
    : `${segment.intensity.min}–${segment.intensity.max} W`;
}

type SegmentListProps = {
  onMove?: (from: number, to: number) => void;
  segments: WorkoutSegment[];
  ftpWatts?: number | null;
  onAdd?: () => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
};

type SortableSegment = { key: string; segment: WorkoutSegment };
const segmentKey = (item: SortableSegment) => item.key;

export function WorkoutSegmentList({
  segments,
  ftpWatts,
  onAdd,
  onEdit,
  onDelete,
  onMove,
}: SegmentListProps) {
  const data = useSortableSegments(segments);
  const scrollableRef = useContext(TrainingScrollContext);
  const renderItem = useCallback<SortableGridRenderItem<SortableSegment>>(
    ({ item, index }) => (
      <WorkoutSegmentRow
        segment={item.segment}
        index={index}
        count={segments.length}
        ftpWatts={ftpWatts}
        onMove={onMove}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ),
    [segments.length, ftpWatts, onMove, onEdit, onDelete],
  );
  const finishDrag = useCallback(
    ({ fromIndex, toIndex }: SortableGridDragEndParams<SortableSegment>) => {
      if (
        Number.isInteger(fromIndex) &&
        Number.isInteger(toIndex) &&
        fromIndex >= 0 &&
        fromIndex < segments.length &&
        toIndex >= 0 &&
        toIndex < segments.length &&
        fromIndex !== toIndex
      )
        onMove?.(fromIndex, toIndex);
    },
    [onMove, segments.length],
  );
  return (
    <Card style={styles.card}>
      {onMove ? (
        <>
          {segments.length > 1 ? (
            <AppText variant="caption" muted>
              长按六点图标拖动排序
            </AppText>
          ) : null}
          <Sortable.Grid
            columns={1}
            data={data}
            keyExtractor={segmentKey}
            renderItem={renderItem}
            customHandle
            sortEnabled={segments.length > 1}
            dragActivationDelay={180}
            enableActiveItemSnap={false}
            activeItemScale={1.02}
            inactiveItemOpacity={0.75}
            rowGap={8}
            showDropIndicator
            dropIndicatorStyle={styles.dropIndicator}
            scrollableRef={scrollableRef}
            autoScrollMaxVelocity={500}
            onDragEnd={finishDrag}
          />
        </>
      ) : (
        data.map((item, index) => (
          <WorkoutSegmentRow
            key={item.key}
            segment={item.segment}
            index={index}
            count={data.length}
            ftpWatts={ftpWatts}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
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

function WorkoutSegmentRow({
  segment,
  index,
  count,
  ftpWatts,
  onEdit,
  onDelete,
  onMove,
}: {
  segment: WorkoutSegment;
  index: number;
  count: number;
} & Pick<SegmentListProps, "ftpWatts" | "onEdit" | "onDelete" | "onMove">) {
  const content = (
    <>
      <AppText variant="card">
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
    <View style={styles.segment}>
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
  touch: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { padding: 10, gap: 8 },
  dropIndicator: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSubtle,
    borderRadius: 14,
  },
  segment: {
    backgroundColor: colors.surface2,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  segmentBody: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 9,
    paddingVertical: 13,
    gap: 10,
    borderRadius: 10,
  },
  pressed: { backgroundColor: colors.brandSubtle },
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
