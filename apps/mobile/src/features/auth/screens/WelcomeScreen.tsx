import { useState } from "react";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthButton } from "../components/AuthButton";
import { authColors as colors } from "../components/auth-theme";
import { PrivacySheet } from "../components/PrivacySheet";

const hero = require("../../../../assets/road-cycling-hero.png");

export function WelcomeScreen() {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const { height } = useWindowDimensions();
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ImageBackground
          source={hero}
          resizeMode="cover"
          imageStyle={styles.image}
          style={[styles.hero, { height: Math.min(height * 0.58, 468) }]}
        >
          <LinearGradient
            colors={[
              "rgba(13,15,14,0.08)",
              "rgba(13,15,14,0.08)",
              colors.background,
            ]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(13,15,14,0.46)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.mark}>
            <View style={styles.markIcon}>
              <View style={styles.markLine} />
            </View>
            <Text style={styles.markText}>私人骑行训练</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>每一次骑行，</Text>
            <Text style={[styles.heroTitle, styles.heroHighlight]}>
              都更有方向。
            </Text>
            <Text style={styles.heroSubtitle}>
              从你的目标与时间出发，安排训练、饮食和阶段进步。
            </Text>
          </View>
        </ImageBackground>
        <View style={styles.actions}>
          <AuthButton onPress={() => router.push("/register")}>
            创建账号
          </AuthButton>
          <AuthButton secondary onPress={() => router.push("/login")}>
            已有账号，登录
          </AuthButton>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            当前账号使用手机号和密码；注册验证码仅用于测试格式，不发送短信。
          </Text>
          <Pressable
            onPress={() => setPrivacyOpen(true)}
            accessibilityRole="button"
            style={styles.privacyButton}
          >
            <Text style={styles.privacyText}>了解数据与隐私</Text>
          </Pressable>
        </View>
      </ScrollView>
      <PrivacySheet
        kind="welcome"
        visible={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  hero: { width: "100%", justifyContent: "space-between" },
  image: { width: "100%" },
  mark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 23,
    marginLeft: 21,
  },
  markIcon: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  markLine: {
    width: 10,
    borderTopWidth: 2,
    borderTopColor: colors.brand,
    transform: [{ rotate: "-35deg" }],
  },
  markText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  heroCopy: { marginHorizontal: 21, marginBottom: 24 },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  heroHighlight: { color: colors.brand },
  heroSubtitle: {
    color: "#D0D5CD",
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 295,
    marginTop: 10,
  },
  actions: { paddingHorizontal: 20, paddingTop: 5, gap: 10 },
  footer: {
    marginTop: "auto",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 25,
    alignItems: "center",
  },
  footerText: {
    width: "100%",
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
  },
  privacyButton: { minHeight: 44, justifyContent: "center" },
  privacyText: { color: colors.brand, fontSize: 11 },
});
