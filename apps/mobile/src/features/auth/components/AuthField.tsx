import { textStyles } from "../../../theme/typography";
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
      {error || helper ? (
        <Text style={[styles.helper, error ? styles.error : null]}>
          {error || helper || " "}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { width: "100%", marginBottom: 20 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  label: { ...textStyles.card, color: colors.textPrimary },
  hint: { ...textStyles.caption, color: colors.textMuted },
  inputWrap: { position: "relative", width: "100%" },
  input: {
    ...textStyles.body,
    width: "100%",
    minHeight: 54,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface1,
    color: colors.textPrimary,
    paddingHorizontal: 15,
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
  toggleText: { ...textStyles.caption, color: colors.textSecondary },
  helper: {
    ...textStyles.caption,
    minHeight: 19,
    marginTop: 6,
    color: colors.textMuted,
  },
  error: { color: colors.negative },
});
