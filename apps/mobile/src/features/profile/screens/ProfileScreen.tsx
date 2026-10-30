import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  ChevronRight,
  CircleUserRound,
  Settings,
  ShieldCheck,
} from "lucide-react-native";

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
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 112,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  flushCard: {
    padding: 0,
  },
  profileMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 17,
    paddingTop: 18,
    paddingBottom: 17,
  },
  avatar: {
    height: 58,
    width: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.brandSubtle,
    borderRadius: 29,
    backgroundColor: colors.surface2,
  },
  profileStats: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingHorizontal: 17,
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
  eyebrow: {
    color: m01Colors.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    lineHeight: 14,
  },
  pageTitle: {
    color: m01Colors.text,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1.1,
    lineHeight: 38,
    marginTop: 4,
  },
  statusText: {
    color: m01Colors.green,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  profileName: {
    color: m01Colors.text,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.5,
    lineHeight: 24,
    marginTop: 5,
  },
  profileMeta: {
    color: m01Colors.sub,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  statLabel: {
    color: m01Colors.muted,
    fontSize: 11,
    lineHeight: 14,
  },
  statValue: {
    color: m01Colors.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 4,
  },
  sectionTitle: {
    color: m01Colors.text,
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  sectionHint: {
    color: m01Colors.muted,
    fontSize: 11,
    lineHeight: 14,
  },
  infoTitle: {
    color: m01Colors.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  infoBody: {
    color: m01Colors.sub,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
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
      <View style={styles.pageHeader}>
        <View>
          <AppText style={styles.eyebrow}>个人档案与训练偏好</AppText>
          <AppText style={styles.pageTitle}>我的</AppText>
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface">
          <Settings color={m01Colors.sub} size={20} strokeWidth={1.7} />
        </View>
      </View>

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
              className="overflow-hidden rounded-[20px] p-0"
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
                <View className="flex-1">
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
                  <AppText style={styles.statLabel}>档案版本</AppText>
                  <AppText style={styles.statValue}>v{profile.version}</AppText>
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
