import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Activity, ChevronRight } from "lucide-react-native";
import type { FtpMeasurementInput } from "@ridepilot/contracts";
import { AppText, Card, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { coachApi } from "../../coach/services/coach.api";

type Ftp = FtpMeasurementInput & { id: string };

export function FtpMeasurementCard({ token }: { token: string }) {
  const [ftp, setFtp] = useState<Ftp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void coachApi
        .ftp(token)
        .then((value) => {
          if (active) {
            setFtp(value);
            setError(null);
          }
        })
        .catch((cause) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "读取 FTP 失败");
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
      accessibilityLabel="FTP 功率"
      accessibilityHint="编辑 FTP 并查看七个功率区间"
      onPress={() => router.push("/cycling-power-zones")}
    >
      <Card className="mt-3 flex-row items-center gap-3 rounded-[18px] p-4">
        <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-brand-subtle">
          <Activity color={colors.brand} size={19} />
        </View>
        <AppText variant="card" className="flex-1">
          FTP 功率
        </AppText>
        {loading ? (
          <Spinner accessibilityLabel="读取 FTP" />
        ) : (
          <AppText className="text-brand">
            {error ? "读取失败" : ftp ? `${ftp.valueWatts} W` : "去填写"}
          </AppText>
        )}
        <ChevronRight color={colors.textMuted} size={18} />
      </Card>
    </Pressable>
  );
}
