import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Activity, ChevronRight } from "lucide-react-native";
import type { FtpMeasurementInput } from "@ridepilot/contracts";

import { Screen } from "../../../components/layout/Screen";
import { AppText, Button, Card, Input, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { coachApi } from "../../coach/services/coach.api";

type Ftp = FtpMeasurementInput & { id: string };

export function FtpMeasurementCard({ token }: { token: string }) {
  const [ftp, setFtp] = useState<Ftp | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [watts, setWatts] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void coachApi
      .ftp(token)
      .then((value) => {
        if (!active) return;
        setFtp(value);
        setWatts(value?.valueWatts.toString() ?? "");
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "读取 FTP 失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const save = async () => {
    const value = Number(watts.trim());
    if (!Number.isInteger(value) || value < 50 || value > 800) {
      setError("请输入 50–800 W 之间的整数 FTP");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await coachApi.addFtp(token, value);
      setFtp(next);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存 FTP 失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="FTP 功率"
        onPress={() => setOpen(true)}
      >
        <Card className="mt-3 flex-row items-center gap-3 rounded-[18px] p-4">
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-brand-subtle">
            <Activity color={colors.brand} size={19} />
          </View>
          <View className="flex-1">
            <AppText variant="card">FTP 功率</AppText>
            <AppText variant="caption" muted>
              {error && !open
                ? "读取 FTP 失败，点此重试或补录"
                : ftp
                  ? `最近测量：${ftp.measuredAt.slice(0, 10)} · 手动录入`
                  : "AI 骑行计划生成前需要补充"}
            </AppText>
          </View>
          {loading ? (
            <Spinner accessibilityLabel="读取 FTP" />
          ) : (
            <AppText className="text-brand">
              {ftp ? `${ftp.valueWatts} W` : "去填写"}
            </AppText>
          )}
          <ChevronRight color={colors.textMuted} size={18} />
        </Card>
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <Screen
          scroll
          scrollProps={{ contentContainerClassName: "px-4 pb-10" }}
        >
          <View className="mb-5 flex-row items-center justify-between">
            <AppText variant="section">记录 FTP</AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
            >
              <AppText className="text-brand">取消</AppText>
            </Pressable>
          </View>
          <Card>
            <AppText>
              当前可用 FTP：{ftp ? `${ftp.valueWatts} W` : "未填写"}
            </AppText>
            <AppText variant="caption" muted className="mt-2">
              填写你已测得的 FTP。保存后会作为一条新的手动测量记录，供 AI
              计划计算训练强度。
            </AppText>
          </Card>
          <AppText variant="label" muted className="mt-6">
            FTP（W）
          </AppText>
          <Input
            className="mt-2"
            accessibilityLabel="FTP 数值"
            keyboardType="number-pad"
            value={watts}
            placeholder="例如 193"
            onChangeText={setWatts}
          />
          {error ? (
            <AppText variant="caption" className="mt-3 text-negative">
              {error}
            </AppText>
          ) : null}
          <Button className="mt-6" loading={saving} onPress={() => void save()}>
            保存 FTP
          </Button>
        </Screen>
      </Modal>
    </>
  );
}
