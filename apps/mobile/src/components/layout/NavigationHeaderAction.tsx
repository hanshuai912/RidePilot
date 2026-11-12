import { Pressable } from "react-native";
import { AppText, Spinner } from "../ui";

export function NavigationHeaderAction({
  label,
  loading = false,
  disabled = false,
  onPress,
  hint,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  hint?: string;
}) {
  const unavailable = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      className={`min-h-11 w-11 items-center justify-center ${unavailable ? "opacity-50" : "active:opacity-70"}`}
    >
      {loading ? (
        <Spinner accessibilityLabel={`正在${label}`} />
      ) : (
        <AppText
          variant="button"
          numberOfLines={1}
          maxFontSizeMultiplier={1.35}
          className="text-brand"
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}
