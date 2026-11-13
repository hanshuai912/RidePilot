import { useCallback, useContext, useState } from "react";
import Sortable, {
  type SortableGridDragEndParams,
  type SortableGridRenderItem,
} from "react-native-sortables";
import { useSortableSegments } from "../hooks/useSortableSegments";
import { TrainingScrollContext } from "./TrainingScrollContext";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Plus } from "lucide-react-native";
import type { WorkoutSegment } from "@ridepilot/contracts";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../components/ui";
import { WorkoutSegmentRow } from "./WorkoutSegmentRow";
import { segmentListStyles as styles } from "./workout-segment-list.styles";

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
  const [contentWidth, setContentWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  // Sorting keeps the same geometry; edited/added/removed rows need fresh
  // measurements, including when the editor was frozen behind a parameter page.
  const contentGeometry = data
    .map(({ key, segment }) => JSON.stringify([key, segment]))
    .sort()
    .join("|");
  const scrollableRef = useContext(TrainingScrollContext);
  const renderItem = useCallback<SortableGridRenderItem<SortableSegment>>(
    ({ item, index }) => (
      <WorkoutSegmentRow
        segment={item.segment}
        index={index}
        count={segments.length}
        width={contentWidth || undefined}
        ftpWatts={ftpWatts}
        onMove={onMove}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ),
    [segments.length, contentWidth, ftpWatts, onMove, onEdit, onDelete],
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
    <View testID="workout-segment-list" style={styles.card}>
      {onMove && segments.length > 1 ? (
        <AppText variant="caption" muted>
          长按六点图标拖动排序
        </AppText>
      ) : null}
      <View
        testID="workout-segment-rows"
        style={styles.rows}
        onLayout={({ nativeEvent }) => {
          // Measure the actual row area, preserving fractional layout widths.
          // Ignore hidden-screen measurements while the parameter editor is open.
          const measuredWidth = nativeEvent.layout.width;
          if (Number.isFinite(measuredWidth) && measuredWidth > 0)
            setContentWidth(measuredWidth);
        }}
      >
        {onMove ? (
          <Sortable.Grid
            // Native sortable cells cache measured geometry. Recreate it when
            // available width or font scaling changes, keeping draft data intact.
            key={`padded-cards-${contentWidth}-${fontScale}-${ftpWatts ?? ""}-${contentGeometry}`}
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
            rowGap={spacing.md}
            itemEntering={null}
            itemExiting={null}
            itemsLayoutTransitionMode="reorder"
            showDropIndicator
            dropIndicatorStyle={styles.dropIndicator}
            scrollableRef={scrollableRef}
            autoScrollMaxVelocity={500}
            onDragEnd={finishDrag}
          />
        ) : (
          data.map((item, index) => (
            <WorkoutSegmentRow
              key={item.key}
              segment={item.segment}
              index={index}
              count={data.length}
              width={contentWidth || undefined}
              ftpWatts={ftpWatts}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </View>
      {onAdd ? (
        <Pressable
          onPress={onAdd}
          style={styles.addButton}
          accessibilityRole="button"
        >
          <Plus size={16} color={colors.brand} />
          <AppText variant="button" style={styles.addLabel}>
            添加动作
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export { segmentTotals } from "../model/segment-totals";
