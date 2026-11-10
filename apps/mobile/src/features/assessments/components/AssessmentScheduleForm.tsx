import { Pressable, View } from "react-native";
import { Check, Gauge, Route, Timer } from "lucide-react-native";
import type { Assessment, AssessmentSchedule } from "@ridepilot/contracts";
import { AppText, Card, Input } from "../../../components/ui";
import { DatePickerField } from "../../../components/ui/DatePickerField";
import { colors } from "../../../theme/colors";
import { GoalInfoButton } from "../../goals/components/GoalInfoButton";
import { assessmentResult } from "../model/assessment";

const testOptions = [
  {
    kind: "FTP",
    label: "FTP 测试",
    description: "记录方案给出的最终 FTP",
    icon: Gauge,
  },
  {
    kind: "POWER_DURATION",
    label: "持续输出",
    description: "记录指定时长的平均功率",
    icon: Timer,
  },
  {
    kind: "FIXED_ROUTE",
    label: "固定路线",
    description: "比较同一路线的骑行表现",
    icon: Route,
  },
] as const;

export function AssessmentScheduleForm({
  values,
  today,
  disabled,
  prior,
  errors,
  onChange,
}: {
  values: AssessmentSchedule;
  today: string;
  disabled: boolean;
  prior?: Assessment;
  errors: Partial<Record<keyof AssessmentSchedule, { message?: string }>>;
  onChange: <K extends keyof AssessmentSchedule>(
    key: K,
    value: AssessmentSchedule[K],
  ) => void;
}) {
  return (
    <View className="gap-6">
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <AppText variant="section">测试类型</AppText>
          <GoalInfoButton
            title="测试说明"
            description="选择你熟悉且适合当前状态的测试方法。FTP 测试记录方案给出的最终 FTP；仅有平均功率时选择持续输出。固定路线需要保持路线、距离与条件一致。状态不适合时可以改期、跳过或记录未完成，不需要强行完成。"
          />
        </View>
        <Card className="overflow-hidden" style={{ padding: 0 }}>
          {testOptions.map(
            ({ kind, label, description, icon: Icon }, index) => {
              const selected = values.kind === kind;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: selected, disabled }}
                  aria-checked={selected}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onPress={() => onChange("kind", kind)}
                  className={`min-h-[76px] flex-row items-center gap-3 px-4 py-3 active:opacity-70 ${index ? "border-t border-divider" : ""} ${selected ? "bg-brand-subtle" : ""} ${disabled ? "opacity-50" : ""}`}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.8}
                    color={selected ? colors.brand : colors.textSecondary}
                  />
                  <View className="min-w-0 flex-1 gap-1">
                    <AppText
                      className={selected ? "text-brand" : "text-primary"}
                    >
                      {label}
                    </AppText>
                    <AppText variant="caption" className="text-secondary">
                      {description}
                    </AppText>
                  </View>
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-brand bg-brand" : "border-border"}`}
                  >
                    {selected ? (
                      <Check
                        size={13}
                        strokeWidth={2.5}
                        color={colors.brandOn}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            },
          )}
        </Card>
      </View>
      <View className="gap-3">
        <AppText variant="section">日期与方法</AppText>
        <Card className="gap-4" style={{ padding: 0 }}>
          <DatePickerField
            label="计划日期"
            value={values.localDate}
            minimumDate={today}
            disabled={disabled}
            onChange={(value) => onChange("localDate", value)}
          />
          <View className="mx-4 border-t border-divider" />
          <View className="gap-3 px-4 pb-4">
            <AppText>测试方法 / 协议</AppText>
            <Input
              accessibilityLabel="测试方法 / 协议"
              value={values.protocol}
              placeholder={
                values.kind === "FIXED_ROUTE"
                  ? "如：湖畔环线，固定起终点"
                  : "填写设备方案或固定测试方法"
              }
              maxLength={64}
              editable={!disabled}
              onChangeText={(value) => onChange("protocol", value)}
            />
            {errors.protocol ? (
              <AppText accessibilityRole="alert" className="text-negative">
                请填写测试方法（1–64 字）
              </AppText>
            ) : null}
            {prior ? (
              <View className="gap-1 border-t border-divider pt-3">
                <AppText variant="caption" className="text-secondary">
                  最近同方法结果 · {prior.actualDate}
                </AppText>
                <AppText>{assessmentResult(prior)}</AppText>
              </View>
            ) : null}
          </View>
        </Card>
        {errors.localDate ? (
          <AppText accessibilityRole="alert" className="text-negative">
            请选择有效的计划日期
          </AppText>
        ) : null}
        {errors.goalId || errors.stageId || errors.kind ? (
          <AppText accessibilityRole="alert" className="text-negative">
            测试条件有误，请返回目标与阶段重新进入。
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
