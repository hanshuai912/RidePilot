import { Pressable } from "react-native";
import { AppText } from "../../../components/ui";

export function GoalOption({
  label,
  accessibilityLabel,
  selected,
  disabled,
  danger = false,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  disabled: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flexBasis: "45%", flexGrow: 1 }}
      className={`min-h-[52px] items-center justify-center rounded-xl border px-3 py-3 ${selected ? (danger ? "border-negative bg-negative/10" : "border-brand-subtle bg-brand-subtle") : "border-border bg-surface-2"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
    >
      <AppText
        className={
          selected
            ? danger
              ? "text-negative"
              : "text-brand"
            : "text-secondary"
        }
      >
        {label}
      </AppText>
    </Pressable>
  );
}
