import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { HeartPulse, ChevronRight } from "lucide-react-native";
import {
  heartRateMethodLabels,
  type HeartRateResponse,
} from "@ridepilot/contracts";
import { AppText, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { heartRateApi } from "../services/heart-rate.api";
import { profileMetricStyles as styles } from "./profile-metric-card.styles";

export function HeartRateSettingsCard({ token }: { token: string }) {
  const [settings, setSettings] = useState<HeartRateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void heartRateApi
        .get(token)
        .then((result) => {
          if (active) {
            setSettings(result);
            setError(false);
          }
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [token]),
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="心率区间"
      accessibilityHint="设置心率并查看训练区间"
      onPress={() => router.push("/heart-rate-zones")}
    >
      <View style={styles.row}>
        <View style={styles.icon}>
          <HeartPulse color={colors.brand} size={18} />
        </View>
        <View style={styles.content}>
          <AppText className="font-medium leading-[22px]" style={styles.title}>
            心率区间
          </AppText>
          {settings && !error ? (
            <AppText
              variant="label"
              className="font-normal leading-[18px] text-secondary"
              style={styles.description}
            >
              {heartRateMethodLabels[settings.method]} ·{" "}
              {settings.method === "LTHR" ? 7 : 5} 区
            </AppText>
          ) : null}
        </View>
        {loading ? (
          <Spinner accessibilityLabel="读取心率设置" />
        ) : (
          <AppText
            variant="caption"
            className="font-medium leading-[20px] text-brand"
            style={styles.value}
          >
            {error ? "读取失败" : !settings ? "去填写" : "查看"}
          </AppText>
        )}
        <ChevronRight color={colors.textMuted} size={18} />
      </View>
    </Pressable>
  );
}
