import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import type { WorkoutSegment } from "@ridepilot/contracts";

import { colors } from "../../../theme/tokens";
import { AppText, Button, Card } from "../../../components/ui";

const segmentTypes: [WorkoutSegment["type"], string][] = [
  ["warmup", "热身"],
  ["work", "训练"],
  ["recovery", "恢复"],
  ["cooldown", "放松"],
];

export function WorkoutSegmentForm({
  initial,
  hasFtp,
  onCancel,
  onSave,
  onDirtyChange,
}: {
  initial?: WorkoutSegment;
  hasFtp: boolean;
  onCancel: () => void;
  onSave: (segment: WorkoutSegment) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [type, setType] = useState<WorkoutSegment["type"]>(
    initial?.type ?? "work",
  );
  const [targetKind, setTargetKind] = useState<"duration" | "distance">(
    initial?.target.kind ?? "duration",
  );
  const [targetValue, setTargetValue] = useState(
    String(initial?.target.value ?? ""),
  );
  const [intensityKind, setIntensityKind] = useState<
    "ftp_percent" | "power_watt"
  >(initial?.intensity.kind ?? (hasFtp ? "ftp_percent" : "power_watt"));
  const [min, setMin] = useState(String(initial?.intensity.min ?? ""));
  const [max, setMax] = useState(String(initial?.intensity.max ?? ""));
  const [repeat, setRepeat] = useState(String(initial?.repeatCount ?? ""));
  const [error, setError] = useState<string | null>(null);
  const dirty =
    type !== (initial?.type ?? "work") ||
    targetKind !== (initial?.target.kind ?? "duration") ||
    targetValue !== String(initial?.target.value ?? "") ||
    intensityKind !==
      (initial?.intensity.kind ?? (hasFtp ? "ftp_percent" : "power_watt")) ||
    min !== String(initial?.intensity.min ?? "") ||
    max !== String(initial?.intensity.max ?? "") ||
    repeat !== String(initial?.repeatCount ?? "");
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const unit = targetKind === "duration" ? "分钟" : "公里";
  const intensityUnit = intensityKind === "ftp_percent" ? "%FTP" : "W";
  const valid = useMemo(
    () =>
      Number(targetValue) > 0 && Number(min) > 0 && Number(max) >= Number(min),
    [targetValue, min, max],
  );

  const save = () => {
    if (intensityKind === "ftp_percent" && !hasFtp) {
      setError("当前没有可用 FTP，请改用绝对功率");
      return;
    }
    if (!valid) {
      setError("请填写有效目标值，并确保最大强度不小于最小强度");
      return;
    }
    const target =
      targetKind === "duration"
        ? {
            kind: "duration" as const,
            value: Number(targetValue),
            unit: "min" as const,
          }
        : {
            kind: "distance" as const,
            value: Number(targetValue),
            unit: "km" as const,
          };
    onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      type,
      target,
      intensity: { kind: intensityKind, min: Number(min), max: Number(max) },
      ...(Number(repeat) > 1 ? { repeatCount: Number(repeat) } : {}),
    });
  };

  return (
    <View style={styles.root}>
      <Card style={styles.card}>
        <AppText variant="label" muted>
          动作类型
        </AppText>
        <View style={styles.toggle}>
          {segmentTypes.map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.option, type === key && styles.activeOption]}
              onPress={() => setType(key)}
            >
              <AppText
                variant="label"
                style={type === key ? styles.activeText : undefined}
              >
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <AppText variant="label" muted>
          目标类型
        </AppText>
        <View style={styles.toggle}>
          {(
            [
              ["duration", "时间"],
              ["distance", "距离"],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.option, targetKind === key && styles.activeOption]}
              onPress={() => setTargetKind(key)}
            >
              <AppText
                variant="label"
                style={targetKind === key ? styles.activeText : undefined}
              >
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.flex}>
            <AppText variant="label" muted>
              目标值（{unit}）
            </AppText>
            <TextInput
              value={targetValue}
              onChangeText={setTargetValue}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="必填"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.flex}>
            <AppText variant="label" muted>
              重复组数（选填）
            </AppText>
            <TextInput
              value={repeat}
              onChangeText={setRepeat}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
      </Card>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View>
            <AppText variant="label" muted>
              强度范围
            </AppText>
            <AppText variant="caption" muted>
              最小和最大强度均必填
            </AppText>
          </View>
          <AppText variant="label" style={styles.required}>
            必填
          </AppText>
        </View>
        <View style={styles.toggle}>
          {(
            [
              ["ftp_percent", "%FTP"],
              ["power_watt", "功率 W"],
            ] as const
          ).map(([key, label]) => {
            const disabled = key === "ftp_percent" && !hasFtp;
            return (
              <Pressable
                key={key}
                disabled={disabled}
                style={[
                  styles.option,
                  intensityKind === key && styles.activeOption,
                  disabled && styles.disabled,
                ]}
                onPress={() => setIntensityKind(key)}
              >
                <AppText
                  variant="label"
                  style={intensityKind === key ? styles.activeText : undefined}
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.flex}>
            <AppText variant="label" muted>
              最小强度（{intensityUnit}）
            </AppText>
            <TextInput
              value={min}
              onChangeText={setMin}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="必填"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.flex}>
            <AppText variant="label" muted>
              最大强度（{intensityUnit}）
            </AppText>
            <TextInput
              value={max}
              onChangeText={setMax}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="必填"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
        {!hasFtp ? (
          <AppText variant="caption" muted style={styles.hint}>
            当前没有可用 FTP，%FTP 已禁用；可以使用绝对功率 W。
          </AppText>
        ) : null}
      </Card>
      {error ? (
        <AppText variant="caption" style={styles.error}>
          {error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button variant="secondary" onPress={onCancel}>
          取消
        </Button>
        <Button onPress={save}>保存动作</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 11 },
  card: { padding: 16, gap: 9 },
  toggle: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    padding: 3,
    borderRadius: 11,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: {
    flex: 1,
    minWidth: 65,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 8,
  },
  activeOption: { backgroundColor: colors.brandSubtle },
  activeText: { color: colors.brand, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  fieldRow: { flexDirection: "row", gap: 10 },
  flex: { flex: 1, gap: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.surface2,
    color: colors.textPrimary,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  required: {
    color: colors.brand,
    backgroundColor: colors.brandSubtle,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  hint: { marginTop: 2 },
  error: { color: colors.negative },
  actions: { flexDirection: "row", gap: 8 },
});
