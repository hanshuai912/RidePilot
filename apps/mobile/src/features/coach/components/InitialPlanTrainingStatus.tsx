import { Pressable, View } from "react-native";
import { Check, ShieldCheck } from "lucide-react-native";
import { AppText, Card, Input } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { TrainingStatusProps } from "../model/initial-plan-types";
import { SetupChoiceRow } from "./SetupChoiceRow";
import { SetupSection } from "./SetupSection";

export function InitialPlanTrainingStatus({
  bodyStatus,
  setBodyStatus,
  bodyNote,
  setBodyNote,
  symptomFlags,
  setSymptomFlags,
  disabled = false,
}: TrainingStatusProps) {
  return (
    <SetupSection
      title="本次训练状态"
      description="用于调整近期训练起点，可随实际状态更新。"
    >
      <View className="gap-2">
        {(
          [
            ["READY", "状态正常，可以按计划训练"],
            ["TIRED", "有些疲劳，希望安排得保守一些"],
            ["RECOVERY", "需要恢复，先降低训练压力"],
          ] as const
        ).map(([value, label]) => (
          <SetupChoiceRow
            key={value}
            label={label}
            selected={bodyStatus === value}
            onPress={() => setBodyStatus(value)}
            disabled={disabled}
          />
        ))}
      </View>
      <View className="mt-1 gap-2">
        <AppText variant="caption" className="text-secondary">
          身体状态补充说明（选填）
        </AppText>
        <Input
          accessibilityLabel="身体状态补充说明"
          value={bodyNote}
          onChangeText={setBodyNote}
          editable={!disabled}
          maxLength={200}
          multiline
          className="py-3"
          placeholder="例如：最近睡眠不足，希望降低强度"
        />
      </View>
      <Card
        className={`mt-1 gap-3 p-4 ${symptomFlags.length ? "border-negative" : "border-border"}`}
      >
        <View className="flex-row items-center gap-2">
          <ShieldCheck
            size={18}
            color={symptomFlags.length ? colors.negative : colors.textSecondary}
          />
          <AppText
            variant="card"
            className={symptomFlags.length ? "text-negative" : "text-primary"}
          >
            安全确认
          </AppText>
        </View>
        <AppText variant="caption" className="text-secondary">
          如有以下不适，请勾选并先暂停训练，进行适当的医疗评估。
        </AppText>
        <View className="gap-2">
          {(
            [
              ["CHEST_PAIN", "胸痛"],
              ["FAINTING", "晕厥或接近晕厥"],
              ["SEVERE_ILLNESS", "明显生病或发热"],
            ] as const
          ).map(([value, label]) => {
            const checked = symptomFlags.includes(value);
            return (
              <Pressable
                key={value}
                accessibilityRole="checkbox"
                accessibilityLabel={label}
                accessibilityState={{ checked, disabled }}
                disabled={disabled}
                onPress={() =>
                  setSymptomFlags(
                    checked
                      ? symptomFlags.filter((item) => item !== value)
                      : [...symptomFlags, value],
                  )
                }
                className={`min-h-12 flex-row items-center gap-3 rounded-xl border px-3 py-3 ${checked ? "border-negative bg-surface-2" : "border-border bg-surface-2"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
              >
                <View
                  accessible={false}
                  className={`h-5 w-5 items-center justify-center rounded border ${checked ? "border-negative bg-negative" : "border-neutral"}`}
                >
                  {checked ? <Check size={14} color={colors.brandOn} /> : null}
                </View>
                <AppText
                  className={`min-w-0 flex-1 ${checked ? "text-negative" : "text-secondary"}`}
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </SetupSection>
  );
}
