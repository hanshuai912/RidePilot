import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight, SlidersHorizontal } from "lucide-react-native";
import { AppText } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { planImpactApi } from "../services/plan-impact.api";

export function PlanImpactEntryCard({
  refreshKey = 0,
}: {
  refreshKey?: number;
}) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      // Refresh alongside the calendar even when the token is unchanged.
      void refreshKey;
      let active = true;
      setCount(null);
      setFailed(false);
      if (token)
        Promise.resolve()
          .then(() => planImpactApi.preview(token))
          .then((data) => {
            if (active) {
              setCount(data.pendingCount);
              setFailed(false);
            }
          })
          .catch(() => {
            if (active) {
              setCount(null);
              setFailed(true);
            }
          });
      return () => {
        active = false;
      };
    }, [token, refreshKey]),
  );
  const pending = count !== null && count > 0;
  const description = failed
    ? "状态读取失败，进入后可重试"
    : count === null
      ? "正在检查资料变化…"
      : pending
        ? `${count} 节未来课程待核对`
        : "资料变化后，核对未来课程";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="训练安排核对"
      accessibilityHint={description}
      onPress={() => router.push("/plans/input-impact")}
      style={styles.entry}
    >
      <View style={styles.icon}>
        <SlidersHorizontal
          size={18}
          color={pending ? colors.brand : colors.textSecondary}
          strokeWidth={1.6}
        />
      </View>
      <View style={styles.copy}>
        <AppText variant="body">训练安排核对</AppText>
        <AppText
          variant="caption"
          style={{ color: pending ? colors.brand : colors.textMuted }}
          accessibilityLiveRegion="polite"
        >
          {description}
        </AppText>
      </View>
      <ChevronRight size={17} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    minHeight: 68,
  },
  icon: {
    width: 32,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: spacing.xs },
});
