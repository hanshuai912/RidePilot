import { useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { CalendarDays, ChevronDown } from "lucide-react-native";

import { AppText, Button } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { birthDateLabel, type BirthDateFieldProps } from "../model/birth-date";
import { BirthDateSheet } from "./BirthDateSheet";
import { datePickerStyles as styles } from "./birth-date-picker.styles";

export function BirthDateField({
  value,
  onChange,
  disabled = false,
}: BirthDateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.fieldRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="选择出生日期"
          accessibilityValue={{
            text: value ? birthDateLabel(value) : "未填写",
          }}
          accessibilityState={{ disabled, expanded: open }}
          disabled={disabled}
          style={[styles.trigger, disabled && styles.disabled]}
          onPress={() => {
            Keyboard.dismiss();
            setOpen(true);
          }}
        >
          <CalendarDays size={18} color={colors.textMuted} />
          <AppText style={[styles.fieldValue, !value && styles.placeholder]}>
            {value ? birthDateLabel(value) : "请选择年、月、日"}
          </AppText>
          <ChevronDown size={18} color={colors.textSecondary} />
        </Pressable>
        {value ? (
          <Button
            variant="ghost"
            disabled={disabled}
            accessibilityLabel="清空出生日期"
            onPress={() => onChange(null)}
          >
            清空
          </Button>
        ) : null}
      </View>
      {open ? (
        <BirthDateSheet
          value={value}
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
