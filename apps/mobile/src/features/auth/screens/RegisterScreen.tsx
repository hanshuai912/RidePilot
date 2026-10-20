import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registerRequestSchema,
  type RegisterRequest,
} from "@ridepilot/contracts";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthButton } from "../components/AuthButton";
import { authColors as colors } from "../components/auth-theme";
import { AuthFeedback } from "../components/AuthFeedback";
import { AuthField } from "../components/AuthField";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../hooks/AuthProvider";
import { AuthApiError } from "../services/auth.api";

export function RegisterScreen() {
  const { register } = useAuth();
  const [feedback, setFeedback] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      phone: "",
      verificationCode: "",
      password: "",
      confirmPassword: "",
    },
  });

  const submit = handleSubmit(async (input) => {
    setFeedback(null);
    try {
      await register(input);
    } catch (error) {
      setFeedback(
        error instanceof AuthApiError &&
          error.code === "PHONE_ALREADY_REGISTERED"
          ? "该手机号已注册，请返回登录"
          : error instanceof Error
            ? error.message
            : "注册失败，请重试",
      );
    }
  });
  return (
    <AuthLayout
      kind="register"
      eyebrow="开始你的训练计划"
      sectionLabel="创建账号"
      title="先建立你的账号"
    >
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
          name="verificationCode"
          render={({ field, fieldState }) => (
            <AuthField
              label="验证码"
              error={fieldState.error?.message}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="请输入验证码"
              keyboardType="number-pad"
              maxLength={6}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <AuthField
              label="设置密码"
              helper="密码至少6位，包含大小写字母、特殊字符。"
              error={fieldState.error?.message}
              password
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="请设置密码"
              autoComplete="new-password"
              textContentType="newPassword"
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <AuthField
              label="确认密码"
              helper="请再次输入密码"
              error={fieldState.error?.message}
              password
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="请再次输入密码"
              autoComplete="new-password"
              textContentType="newPassword"
            />
          )}
        />
        <AuthFeedback message={feedback} />
        <AuthButton loading={isSubmitting} onPress={submit}>
          创建账号
        </AuthButton>
      </View>
      <Pressable
        style={styles.switch}
        onPress={() => router.replace("/login")}
        accessibilityRole="link"
      >
        <Text style={styles.switchText}>
          已经有账号？ <Text style={styles.link}>去登录</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 29 },
  ruleCard: {
    backgroundColor: colors.surface1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    marginTop: -3,
    marginBottom: 18,
  },
  ruleTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  ruleDescription: { color: colors.textSecondary, fontSize: 11, marginTop: 5 },
  ruleList: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  rule: {
    borderWidth: 1,
    borderColor: "#495149",
    backgroundColor: "#272D28",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  ruleMet: { borderColor: "#5B765D", backgroundColor: "#29372B" },
  ruleText: { color: colors.textSecondary, fontSize: 11 },
  ruleTextMet: { color: "#ADD0B1" },
  note: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 18,
  },
  switch: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  switchText: { color: colors.textSecondary, fontSize: 13 },
  link: { color: colors.brand, fontWeight: "600" },
});
