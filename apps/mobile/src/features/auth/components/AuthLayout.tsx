import { type ReactNode, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { NavigationHeader } from "../../../components/layout/NavigationHeader";

import { authColors as colors } from "./auth-theme";
import { PrivacySheet } from "./PrivacySheet";

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  kind,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  kind: "login" | "register";
  children: ReactNode;
}) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <NavigationHeader
          title={title}
          backLabel="返回欢迎页"
          onBack={() => router.replace("/welcome")}
        />
        <ScrollView
          testID="auth-page-content"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
          <Pressable
            onPress={() => setPrivacyOpen(true)}
            accessibilityRole="button"
            style={styles.privacy}
          >
            {kind === "login" ? (
              <Text style={styles.privacyNote}>请妥善保管注册号码与密码。</Text>
            ) : null}
            <Text style={styles.privacyText}>查看数据与隐私说明</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <PrivacySheet
        kind={kind}
        visible={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  privacy: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    paddingTop: 24,
  },
  privacyNote: { color: colors.textMuted, fontSize: 11, marginBottom: 5 },
  privacyText: { color: colors.brand, fontSize: 11 },
});
