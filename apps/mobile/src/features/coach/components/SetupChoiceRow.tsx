import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";

export function SetupChoiceRow({
  label,
  description,
  icon,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  description?: string;
  icon?: ReactNode;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-16 flex-row items-center gap-3 rounded-xl border p-4 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
    >
      {icon ? (
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          className="h-9 w-9 items-center justify-center rounded-xl bg-surface-2"
        >
          {icon}
        </View>
      ) : null}
      <View className="min-w-0 flex-1 gap-1">
        <AppText
          variant="card"
          className={selected ? "text-brand" : "text-primary"}
        >
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" className="text-secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <View
        accessible={false}
        className={`h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-brand bg-brand" : "border-neutral"}`}
      >
        {selected ? (
          <Check size={14} color={colors.brandOn} strokeWidth={2} />
        ) : null}
      </View>
    </Pressable>
  );
}
