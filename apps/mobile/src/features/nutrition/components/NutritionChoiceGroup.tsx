import { Pressable, View } from "react-native";
import { Check } from "lucide-react-native";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";

export function NutritionChoiceGroup<T extends string>({
  title,
  description,
  labels,
  selected,
  onChange,
  multiple = false,
  noneLabel,
  disabled = false,
  compact = false,
}: {
  title: string;
  description?: string;
  labels: Record<T, string>;
  selected: T[];
  onChange: (values: T[]) => void;
  multiple?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const options: { value: T | null; label: string }[] = [
    ...(noneLabel ? [{ value: null, label: noneLabel }] : []),
    ...(Object.entries(labels) as [T, string][]).map(([value, label]) => ({
      value,
      label,
    })),
  ];
  return (
    <View className="gap-3">
      <View className="gap-1">
        <AppText variant="section">{title}</AppText>
        {description ? (
          <AppText variant="caption" className="text-secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {options.map(({ value, label }) => {
          const checked =
            value === null ? selected.length === 0 : selected.includes(value);
          return (
            <Pressable
              key={value ?? "none"}
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityLabel={label}
              aria-checked={checked}
              aria-disabled={disabled}
              accessibilityState={{
                checked,
                disabled,
                ...(multiple ? {} : { selected: checked }),
              }}
              disabled={disabled}
              onPress={() =>
                onChange(
                  value === null
                    ? []
                    : multiple
                      ? checked
                        ? selected.filter((item) => item !== value)
                        : [...selected, value]
                      : [value],
                )
              }
              style={compact ? undefined : { flexBasis: "46%", flexGrow: 1 }}
              className={`min-h-12 min-w-0 flex-row items-center gap-2 rounded-xl border px-3 py-3 ${checked ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
            >
              <View
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                className={`h-5 w-5 items-center justify-center border ${multiple ? "rounded-md" : "rounded-full"} ${checked ? "border-brand bg-brand" : "border-neutral"}`}
              >
                {checked ? <Check size={13} color={colors.brandOn} /> : null}
              </View>
              <AppText
                className={`${compact ? "" : "min-w-0 flex-1"} ${checked ? "text-brand" : "text-primary"}`}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
