import { type ReactNode, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { authColors as colors } from "./auth-theme";
import { PrivacySheet } from "./PrivacySheet";

export function AuthLayout({
  eyebrow,
  sectionLabel,
  title,
  subtitle,
  kind,
  children,
}: {
  eyebrow: string;
  sectionLabel: string;
  title: string;
  subtitle: string;
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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.top}>
            <Pressable
              onPress={() => router.replace("/welcome")}
              accessibilityRole="button"
              accessibilityLabel="返回欢迎页"
              style={styles.back}
            >
              <ChevronLeft color={colors.textPrimary} size={20} />
            </Pressable>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          </View>
          <Text style={styles.eyebrow}>{sectionLabel}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
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
    paddingBottom: 28,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 19,
  },
  back: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.surface1,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 1.3,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "700",
    letterSpacing: -1,
    marginTop: 7,
    marginBottom: 7,
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
