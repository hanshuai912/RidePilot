import { useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { CalendarDays, ChevronDown } from "lucide-react-native";
import { AppText } from "./AppText";
import { DatePickerSheet } from "./DatePickerSheet";
import { datePickerLabel } from "./date-picker.model";
import { colors } from "../../theme/colors";

export function DatePickerField({
  label,
  value,
  minimumDate,
  maximumDate,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  minimumDate: string;
  maximumDate?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{
          text: value ? datePickerLabel(value) : "请选择日期",
        }}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        className={`min-h-[64px] flex-row items-center gap-3 px-4 py-3 active:bg-surface-2 ${disabled ? "opacity-50" : ""}`}
      >
        <CalendarDays color={colors.textSecondary} size={18} />
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="caption" className="text-secondary">
            {label}
          </AppText>
          <AppText className="tabular-nums">
            {value ? datePickerLabel(value) : "请选择日期"}
          </AppText>
        </View>
        <ChevronDown color={colors.textSecondary} size={16} />
      </Pressable>
      {open ? (
        <DatePickerSheet
          label={label}
          value={value}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          disabled={disabled}
          onClose={() => setOpen(false)}
          onConfirm={(next) => {
            if (disabled) return;
            onChange(next);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
