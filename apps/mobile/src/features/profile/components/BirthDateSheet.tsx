import { useMemo, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText, Button } from "../../../components/ui";
import { layout } from "../../../theme/layout";
import {
  birthDateFromParts,
  birthDateLabel,
  birthDateOptions,
  birthDateParts,
  clampBirthDateParts,
  isSelectableBirthDate,
  localDateToBirthDate,
  type BirthDateParts,
} from "../model/birth-date";
import { BirthDateColumn } from "./BirthDateColumn";
import { datePickerStyles as styles } from "./birth-date-picker.styles";

export function BirthDateSheet({
  value,
  disabled,
  onClose,
  onConfirm,
}: {
  value: string | null;
  disabled: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [scrolling, setScrolling] = useState({
    year: false,
    month: false,
    day: false,
  });
  const wheelBusy = scrolling.year || scrolling.month || scrolling.day;
  const [maximum] = useState(() => new Date());
  const [selection, setSelection] = useState(() =>
    birthDateParts(
      value && isSelectableBirthDate(value)
        ? value
        : localDateToBirthDate(maximum),
    ),
  );
  const { height, fontScale } = useWindowDimensions();
  const [translation] = useState(() => new Animated.Value(0));
  const rowHeight = Math.max(layout.tapMin, Math.ceil(48 * fontScale));
  const visibleRows = height < 700 || fontScale > 1.3 ? 3 : 5;
  const options = birthDateOptions(selection, maximum);

  const pan = useMemo(() => {
    const reset = () =>
      Animated.spring(translation, {
        toValue: 0,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        !disabled && gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx),
      onPanResponderMove: (_event, gesture) =>
        translation.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 72 || (gesture.dy > 20 && gesture.vy > 0.8)) onClose();
        else reset();
      },
      onPanResponderTerminate: reset,
    });
  }, [disabled, onClose, translation]);

  const choose = (part: keyof BirthDateParts, next: number) => {
    setSelection((current) =>
      clampBirthDateParts({ ...current, [part]: next }, maximum),
    );
  };

  return (
    <Modal
      testID="birth-date-sheet"
      visible
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modal} accessibilityViewIsModal>
        <Pressable
          style={styles.scrim}
          accessibilityRole="button"
          accessibilityLabel="取消日期选择"
          onPress={onClose}
        />
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: translation }] }]}
          onAccessibilityEscape={onClose}
        >
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            style={styles.safeArea}
          >
            <Pressable
              {...pan.panHandlers}
              style={styles.handleArea}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="关闭日期抽屉"
            >
              <View style={styles.handle} />
            </Pressable>
            <View style={styles.content}>
              <View style={styles.header}>
                <AppText variant="section" accessibilityRole="header">
                  选择出生日期
                </AppText>
                <Button
                  variant="ghost"
                  accessibilityLabel="取消选择"
                  onPress={onClose}
                >
                  取消
                </Button>
              </View>
              <AppText variant="caption" style={styles.description}>
                上下滚动选择，停在中间即选中
              </AppText>
              <AppText
                testID="birth-date-preview"
                accessibilityLiveRegion="polite"
                style={styles.preview}
              >
                {birthDateLabel(birthDateFromParts(selection))}
              </AppText>
              <View style={styles.columns}>
                <BirthDateColumn
                  label="年"
                  options={options.years}
                  value={selection.year}
                  rowHeight={rowHeight}
                  visibleRows={visibleRows}
                  disabled={disabled}
                  onChange={(year) => choose("year", year)}
                  onBusyChange={(busy) =>
                    setScrolling((current) =>
                      current.year === busy
                        ? current
                        : { ...current, year: busy },
                    )
                  }
                />
                <BirthDateColumn
                  label="月"
                  options={options.months}
                  value={selection.month}
                  rowHeight={rowHeight}
                  visibleRows={visibleRows}
                  disabled={disabled}
                  onChange={(month) => choose("month", month)}
                  onBusyChange={(busy) =>
                    setScrolling((current) =>
                      current.month === busy
                        ? current
                        : { ...current, month: busy },
                    )
                  }
                />
                <BirthDateColumn
                  label="日"
                  options={options.days}
                  value={selection.day}
                  rowHeight={rowHeight}
                  visibleRows={visibleRows}
                  disabled={disabled}
                  onChange={(day) => choose("day", day)}
                  onBusyChange={(busy) =>
                    setScrolling((current) =>
                      current.day === busy
                        ? current
                        : { ...current, day: busy },
                    )
                  }
                />
              </View>
              <View style={styles.actions}>
                <Button
                  size="lg"
                  disabled={disabled || wheelBusy}
                  onPress={() => onConfirm(birthDateFromParts(selection))}
                >
                  确认日期
                </Button>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
