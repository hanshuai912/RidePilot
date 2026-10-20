import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";
import { authColors } from "./auth-theme";

export function AuthButton({
  children,
  secondary = false,
  loading = false,
  disabled,
  ...props
}: PressableProps & {
  children: string;
  secondary?: boolean;
  loading?: boolean;
}) {
  const unavailable = disabled || loading;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      style={[
        styles.button,
        secondary ? styles.secondary : styles.primary,
        unavailable ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={secondary ? authColors.textPrimary : authColors.brandOn}
        />
      ) : (
        <Text
          style={[
            styles.label,
            secondary ? styles.secondaryLabel : styles.primaryLabel,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 52,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { borderColor: authColors.brand, backgroundColor: authColors.brand },
  secondary: { borderColor: "#555E54", backgroundColor: "#252A26" },
  disabled: { opacity: 0.48 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  primaryLabel: { color: authColors.brandOn },
  secondaryLabel: { color: authColors.textPrimary, fontWeight: "600" },
});
