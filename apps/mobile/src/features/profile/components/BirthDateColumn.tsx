import { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { AppText } from "../../../components/ui";
import { datePickerStyles as styles } from "./birth-date-picker.styles";

export function BirthDateColumn({
  label,
  options,
  value,
  rowHeight,
  visibleRows,
  disabled,
  onChange,
  onBusyChange,
}: {
  label: string;
  options: number[];
  value: number;
  rowHeight: number;
  visibleRows: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const list = useRef<ScrollView>(null);
  const lastReported = useRef(value);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  const momentum = useRef(false);
  const offset = useRef(0);
  const busy = useRef(false);
  const selectedIndex = Math.max(0, options.indexOf(value));
  const [initialIndex] = useState(selectedIndex);
  const padding = rowHeight * Math.floor(visibleRows / 2);

  useEffect(() => {
    if (lastReported.current !== value) {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      lastReported.current = value;
      list.current?.scrollTo({ y: selectedIndex * rowHeight, animated: false });
    }
  }, [value, selectedIndex, rowHeight]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [options.length, rowHeight, disabled],
  );

  const markBusy = (next: boolean) => {
    if (busy.current !== next) {
      busy.current = next;
      onBusyChange(next);
    }
  };
  const settle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (disabled) return;
    const index = Math.max(
      0,
      Math.min(options.length - 1, Math.round(offset.current / rowHeight)),
    );
    const next = options[index];
    if (next !== lastReported.current) {
      lastReported.current = next;
      onChange(next);
    }
    // Native snapping already positions the row. This fallback covers Web and
    // a drag with no momentum; never correct position during a fling.
    if (Math.abs(offset.current - index * rowHeight) > 0.5) {
      list.current?.scrollTo({ y: index * rowHeight, animated: false });
    }
    markBusy(false);
  };
  const scheduleSettle = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, 180);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    if (disabled) return;
    if (dragging.current || momentum.current || Platform.OS === "web")
      markBusy(true);
    if (Platform.OS === "web" && !dragging.current) scheduleSettle();
  };

  return (
    <View style={styles.column}>
      <AppText style={styles.columnLabel}>{label}</AppText>
      <View style={[styles.wheel, { height: rowHeight * visibleRows }]}>
        <View
          pointerEvents="none"
          style={[styles.selectionBand, { top: padding, height: rowHeight }]}
        />
        <ScrollView
          ref={list}
          testID={`birth-date-column-${label}`}
          accessibilityLabel={`滚动选择${label}`}
          contentOffset={{ x: 0, y: initialIndex * rowHeight }}
          contentContainerStyle={{ paddingVertical: padding }}
          onLayout={() =>
            list.current?.scrollTo({
              y: selectedIndex * rowHeight,
              animated: false,
            })
          }
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          overScrollMode="never"
          scrollEnabled={!disabled}
          snapToInterval={rowHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onScrollBeginDrag={() => {
            dragging.current = true;
            if (settleTimer.current) clearTimeout(settleTimer.current);
            markBusy(true);
          }}
          onScrollEndDrag={(event) => {
            dragging.current = false;
            offset.current = event.nativeEvent.contentOffset.y;
            scheduleSettle();
          }}
          onMomentumScrollBegin={() => {
            momentum.current = true;
            if (settleTimer.current) clearTimeout(settleTimer.current);
            markBusy(true);
          }}
          onMomentumScrollEnd={(event) => {
            momentum.current = false;
            dragging.current = false;
            offset.current = event.nativeEvent.contentOffset.y;
            settle();
          }}
          keyboardShouldPersistTaps="handled"
          style={styles.options}
        >
          {options.map((item, index) => (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityLabel={`${item}${label}`}
              accessibilityState={{ checked: item === value, disabled }}
              disabled={disabled}
              style={[styles.option, { height: rowHeight }]}
              onPress={() => {
                if (settleTimer.current) clearTimeout(settleTimer.current);
                lastReported.current = item;
                offset.current = index * rowHeight;
                list.current?.scrollTo({
                  y: index * rowHeight,
                  animated: false,
                });
                onChange(item);
                markBusy(false);
              }}
            >
              <AppText
                style={[
                  styles.optionText,
                  item === value && styles.selectedText,
                ]}
              >
                {item}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
