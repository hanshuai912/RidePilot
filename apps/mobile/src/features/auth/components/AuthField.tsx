import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { authColors as colors } from "./auth-theme";

type Props = TextInputProps & {
  label: string;
  hint?: string;
  helper?: string;
  error?: string;
  password?: boolean;
};

export function AuthField({
  label,
  hint,
  helper,
  error,
  password,
  ...inputProps
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          {...inputProps}
          style={[
            styles.input,
            error ? styles.inputError : null,
            password ? styles.passwordInput : null,
          ]}
          placeholderTextColor={colors.inputPlaceholder}
          secureTextEntry={password && !visible}
          accessibilityLabel={label}
        />
        {password ? (
          <Pressable
            style={styles.toggle}
            onPress={() => setVisible(!visible)}
            accessibilityRole="button"
            accessibilityLabel={visible ? `隐藏${label}` : `显示${label}`}
          >
            <Text style={styles.toggleText}>{visible ? "隐藏" : "显示"}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.helper, error ? styles.error : null]}>
        {error || helper || " "}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { width: "100%", marginBottom: 20 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  hint: { color: colors.textMuted, fontSize: 11 },
  inputWrap: { position: "relative", width: "100%" },
  input: {
    width: "100%",
    height: 54,
    borderWidth: 1,
    borderColor: "#485149",
    borderRadius: 13,
    backgroundColor: colors.surface1,
    color: colors.textPrimary,
    paddingHorizontal: 15,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  inputError: { borderColor: colors.negative },
  passwordInput: { paddingRight: 64 },
  toggle: {
    position: "absolute",
    right: 5,
    top: 5,
    zIndex: 1,
    minWidth: 49,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { color: colors.textSecondary, fontSize: 12 },
  helper: {
    minHeight: 19,
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  error: { color: "#E3A39B" },
});
