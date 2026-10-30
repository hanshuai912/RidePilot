import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginRequestSchema, type LoginRequest } from "@ridepilot/contracts";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthButton } from "../components/AuthButton";
import { authColors as colors } from "../components/auth-theme";
import { useAuth } from "../hooks/AuthProvider";
import { AuthApiError } from "../services/auth.api";
import { AuthFeedback } from "../components/AuthFeedback";
import { AuthField } from "../components/AuthField";
import { AuthLayout } from "../components/AuthLayout";

export function LoginScreen() {
  const { login } = useAuth();
  const [feedback, setFeedback] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { phone: "", password: "" },
  });
  const submit = handleSubmit(async (input) => {
    setFeedback(null);
    try {
      await login(input);
    } catch (error) {
      setFeedback(
        error instanceof AuthApiError && error.code === "INVALID_CREDENTIALS"
          ? "手机号或密码不正确"
          : error instanceof Error
            ? error.message
            : "登录失败，请重试",
      );
    }
  });
  return (
    <AuthLayout kind="login" eyebrow="继续你的骑行计划" title="登录账号">
      <View style={styles.form}>
        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <AuthField
              label="手机号"
              error={fieldState.error?.message}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="请输入手机号"
              keyboardType="number-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={11}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <AuthField
              label="密码"
              error={fieldState.error?.message}
              password
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="请输入密码"
              autoComplete="current-password"
              textContentType="password"
            />
          )}
        />
        <AuthFeedback message={feedback} />
        <AuthButton loading={isSubmitting} onPress={submit}>
          登录
        </AuthButton>
      </View>
      <Pressable
        style={styles.switch}
        onPress={() => router.push("/register")}
        accessibilityRole="link"
      >
        <Text style={styles.switchText}>
          还没有账号？ <Text style={styles.link}>创建账号</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 29 },
  switch: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  switchText: { color: colors.textSecondary, fontSize: 13 },
  link: { color: colors.brand, fontWeight: "600" },
});
