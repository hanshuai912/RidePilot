import { View } from "react-native";
import { AppText, Button, Input } from "../../../components/ui";

export function AssessmentField({
  label,
  value,
  onChange,
  disabled,
  numeric,
  maxLength = 200,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  numeric?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <View className="gap-2">
      <AppText variant="label" muted>
        {label}
      </AppText>
      <Input
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        keyboardType={numeric ? "decimal-pad" : "default"}
        maxLength={maxLength}
        placeholder={placeholder}
      />
    </View>
  );
}

export function AssessmentChoices<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: Partial<Record<T, string>>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View className="gap-2">
      <AppText variant="label" muted>
        {label}
      </AppText>
      <View className="flex-row flex-wrap gap-2">
        {(Object.keys(options) as T[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={key === value ? "primary" : "secondary"}
            disabled={disabled}
            onPress={() => onChange(key)}
          >
            {options[key]}
          </Button>
        ))}
      </View>
    </View>
  );
}
