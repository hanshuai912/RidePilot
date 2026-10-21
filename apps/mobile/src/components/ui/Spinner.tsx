import { ActivityIndicator } from "react-native";

import { colors } from "../../theme/colors";

export function Spinner({
  size = "small",
  accessibilityLabel,
}: {
  size?: "small" | "large";
  accessibilityLabel?: string;
}) {
  return (
    <ActivityIndicator
      accessibilityLabel={accessibilityLabel}
      color={colors.brand}
      size={size}
    />
  );
}
