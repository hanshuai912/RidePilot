import { textStyles } from "../../../theme/typography";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  ChevronRight,
  CircleUserRound,
  ShieldCheck,
} from "lucide-react-native";

import { AppHeader } from "../../../components/layout/AppHeader";
import { Screen } from "../../../components/layout/Screen";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { getProfile } from "../services/profile.api";
import { router, useFocusEffect } from "expo-router";
import type { ProfileResponse } from "@ridepilot/contracts";
import { ProfileSettingsList } from "../components/ProfileSettingsList";
import { colors } from "../../../theme/colors";

const m01Colors = {
  text: colors.textPrimary,
  sub: colors.textSecondary,
  muted: colors.textMuted,
  gold: colors.brand,
  green: colors.positive,
  orange: colors.warning,
} as const;

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  flushCard: {
    padding: 0,
  },
  profileMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  avatar: {
    height: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.brandSubtle,
    borderRadius: 24,
    backgroundColor: colors.surface2,
  },
  profileStats: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 14,
  },
  secondStat: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.divider,
    paddingLeft: 15,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 2,
    marginTop: 25,
    marginBottom: 12,
  },
  statusText: { ...textStyles.label, color: m01Colors.green },
  profileName: { ...textStyles.section, color: m01Colors.text, marginTop: 5 },
  profileMeta: { ...textStyles.caption, color: m01Colors.sub, marginTop: 4 },
  statLabel: { ...textStyles.caption, color: m01Colors.muted },
  statValue: { ...textStyles.card, color: m01Colors.text, marginTop: 4 },
  sectionTitle: { ...textStyles.section, color: m01Colors.text },
  infoTitle: { ...textStyles.card, color: m01Colors.text },
  infoBody: { ...textStyles.caption, color: m01Colors.sub, marginTop: 4 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
});

function displayExperience(value: ProfileResponse["experienceLevel"]): string {
  const labels = {
    BEGINNER: "入门",
    INTERMEDIATE: "有训练经验",
    ADVANCED: "进阶",
  };
  return value ? labels[value] : "未填写";
}

export function ProfileScreen() {
  const { logout, session } = useAuth();
  const token = session?.accessToken;
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let active = true;
      void getProfile(token)
        .then((next) => {
          if (!active) return;
          setProfile(next);
          setError(null);
          setLoading(false);
        })
        .catch((cause) => {
          if (!active) return;
          setError(cause instanceof Error ? cause.message : "无法加载个人资料");
          setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [token]),
  );

  return (
    <Screen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
      }}
    >
      <AppHeader title="我的" subtitle="个人档案与训练偏好" />

      {loading ? <Spinner accessibilityLabel="正在加载个人资料" /> : null}
      {error ? (
        <AppText variant="caption" className="mb-3 text-warning">
          {error}
        </AppText>
      ) : null}
      {profile ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="个人信息"
            accessibilityHint="查看和编辑个人信息"
            onPress={() => router.push("/personal-info")}
          >
            <Card
              padding="none"
              className="overflow-hidden rounded-[20px]"
              style={styles.flushCard}
            >
              <View style={styles.profileMain}>
                <View style={styles.avatar}>
                  <CircleUserRound
                    color={m01Colors.gold}
                    size={27}
                    strokeWidth={1.6}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-1.5 w-1.5 rounded-full bg-positive" />
                    <AppText style={styles.statusText}>档案已建立</AppText>
                  </View>
                  <AppText style={styles.profileName}>
                    {profile.displayName}
                  </AppText>
                  <AppText style={styles.profileMeta}>
                    手机号 {profile.phoneMasked}
                  </AppText>
                </View>
                <ChevronRight color={m01Colors.muted} size={21} />
              </View>
              <View style={styles.profileStats}>
                <View className="flex-1">
                  <AppText style={styles.statLabel}>训练经验</AppText>
                  <AppText style={styles.statValue}>
                    {displayExperience(profile.experienceLevel)}
                  </AppText>
                </View>
                <View className="flex-1" style={styles.secondStat}>
                  <AppText style={styles.statLabel}>体重</AppText>
                  <AppText style={styles.statValue}>
                    {profile.weightKg === null
                      ? "未填写"
                      : `${profile.weightKg} kg`}
                  </AppText>
                </View>
              </View>
            </Card>
          </Pressable>
          {session?.accessToken ? (
            <ProfileSettingsList token={session.accessToken} />
          ) : null}

          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>数据与隐私</AppText>
          </View>
          <View>
            <Card style={styles.infoCard}>
              <ShieldCheck
                color={m01Colors.muted}
                size={21}
                strokeWidth={1.7}
              />
              <View className="flex-1">
                <AppText style={styles.infoTitle}>资料服务状态</AppText>
                <AppText style={styles.infoBody}>
                  当前仅保存完成个人档案所需的信息；数据导出、删除和设备同步将在对应服务开放后提供。
                </AppText>
              </View>
            </Card>
          </View>
          <Button
            variant="secondary"
            className="mt-5"
            onPress={async () => {
              try {
                await logout();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "退出失败，请重试",
                );
              }
            }}
          >
            退出登录
          </Button>
        </>
      ) : null}
    </Screen>
  );
}
