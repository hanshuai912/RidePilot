import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { DateWheelColumn } from "./DateWheelColumn";
import { datePickerStyles as styles } from "./date-picker.styles";
import {
  clampDateParts,
  dateFromParts,
  dateParts,
  datePickerLabel,
  datePickerOptions,
  type DateParts,
} from "./date-picker.model";

export function DatePickerSheet({
  label,
  value,
  minimumDate,
  maximumDate,
  disabled,
  onClose,
  onConfirm,
}: {
  label: string;
  value: string;
  minimumDate: string;
  maximumDate?: string;
  disabled: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [selection, setSelection] = useState(() =>
    clampDateParts(dateParts(value || minimumDate), minimumDate, maximumDate),
  );
  const [scrolling, setScrolling] = useState({
    year: false,
    month: false,
    day: false,
  });
  const { height, fontScale } = useWindowDimensions();
  const rowHeight = Math.max(44, Math.ceil(48 * fontScale));
  const visibleRows = height < 700 || fontScale > 1.3 ? 3 : 5;
  const current = clampDateParts(selection, minimumDate, maximumDate);
  const options = datePickerOptions(current, minimumDate, maximumDate);
  const choose = (part: keyof DateParts, next: number) =>
    setSelection(
      clampDateParts({ ...current, [part]: next }, minimumDate, maximumDate),
    );
  return (
    <Modal
      testID="date-picker-sheet"
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modal} accessibilityViewIsModal>
        <Pressable
          style={styles.scrim}
          accessibilityRole="button"
          accessibilityLabel="取消日期选择"
          onPress={onClose}
        />
        <View style={styles.sheet} onAccessibilityEscape={onClose}>
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            style={styles.safeArea}
          >
            <ScrollView
              contentContainerStyle={{ paddingTop: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.content}>
                <View style={styles.header}>
                  <AppText variant="section" accessibilityRole="header">
                    选择{label}
                  </AppText>
                  <Button variant="ghost" onPress={onClose}>
                    取消
                  </Button>
                </View>
                <AppText
                  testID="date-picker-preview"
                  accessibilityLiveRegion="polite"
                  style={styles.preview}
                >
                  {datePickerLabel(dateFromParts(current))}
                </AppText>
                <View style={styles.columns}>
                  {(
                    [
                      ["year", "年", options.years],
                      ["month", "月", options.months],
                      ["day", "日", options.days],
                    ] as const
                  ).map(([part, suffix, values]) => (
                    <DateWheelColumn
                      key={part}
                      label={suffix}
                      options={values}
                      value={current[part]}
                      rowHeight={rowHeight}
                      visibleRows={visibleRows}
                      disabled={disabled}
                      onChange={(next) => choose(part, next)}
                      onBusyChange={(busy) =>
                        setScrolling((previous) => ({
                          ...previous,
                          [part]: busy,
                        }))
                      }
                    />
                  ))}
                </View>
                <View style={styles.actions}>
                  <Button
                    size="lg"
                    disabled={
                      disabled || Object.values(scrolling).some(Boolean)
                    }
                    onPress={() => onConfirm(dateFromParts(current))}
                  >
                    确认日期
                  </Button>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}
