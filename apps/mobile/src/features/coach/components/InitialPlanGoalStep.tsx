import { Pressable, View } from "react-native";
import { Bike, Flag, Mountain, Target, PencilLine } from "lucide-react-native";
import { AppText, Card, Input } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { GoalType } from "../model/initial-plan-types";
import { SetupChoiceRow } from "./SetupChoiceRow";
import { SetupSection } from "./SetupSection";

const goals = [
  {
    type: "FTP",
    label: "提升 FTP / 阈值能力",
    description: "提高持续输出，打好功率基础",
    icon: Target,
  },
  {
    type: "ENDURANCE",
    label: "提升耐力与长距离能力",
    description: "让长时间骑行更稳定",
    icon: Bike,
  },
  {
    type: "CLIMBING",
    label: "提升爬坡能力",
    description: "围绕爬坡表现安排训练",
    icon: Mountain,
  },
  {
    type: "RACE",
    label: "准备一场比赛",
    description: "结合赛事安排与实际能力逐步备赛",
    icon: Flag,
  },
  {
    type: "CUSTOM",
    label: "自定义目标",
    description: "用补充说明描述你想改善的表现",
    icon: PencilLine,
  },
] as const;

export function GoalStep({
  type,
  setType,
  targetWkg,
  setTargetWkg,
  note,
  setNote,
  cycleWeeks,
  setCycleWeeks,
  disabled = false,
}: {
  type: GoalType;
  setType: (value: GoalType) => void;
  targetWkg: string;
  setTargetWkg: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  cycleWeeks: number;
  setCycleWeeks: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <SetupSection
        title="你想重点提升什么？"
        description="选择一个主要方向，按实际训练和阶段复评逐步推进。"
      >
        <View className="gap-2">
          {goals.map(({ type: value, label, description, icon: Icon }) => (
            <SetupChoiceRow
              key={value}
              label={label}
              description={description}
              icon={
                <Icon
                  size={19}
                  color={type === value ? colors.brand : colors.textSecondary}
                  strokeWidth={1.8}
                />
              }
              selected={type === value}
              onPress={() => setType(value)}
              disabled={disabled}
            />
          ))}
        </View>
      </SetupSection>
      {type === "FTP" ? (
        <SetupSection
          title="目标功体比（选填）"
          description="需要个人资料中的体重，用于计算能力差距。"
        >
          <Card className="gap-2 p-4">
            <View className="flex-row items-center gap-3">
              <Input
                accessibilityLabel="目标功体比"
                keyboardType="decimal-pad"
                value={targetWkg}
                onChangeText={setTargetWkg}
                editable={!disabled}
                className="min-w-0 flex-1"
                placeholder="例如 4"
              />
              <AppText className="text-secondary">W/kg</AppText>
            </View>
          </Card>
        </SetupSection>
      ) : null}
      <SetupSection
        title="本次训练周期"
        description="作为规划参考，先生成近期课程，再根据训练反馈滚动调整。"
      >
        <View className="flex-row gap-2">
          {[4, 8, 12].map((weeks) => {
            const selected = cycleWeeks === weeks;
            return (
              <Pressable
                key={weeks}
                accessibilityRole="radio"
                accessibilityLabel={`${weeks} 周`}
                accessibilityState={{ selected, checked: selected, disabled }}
                disabled={disabled}
                onPress={() => setCycleWeeks(weeks)}
                className={`min-h-16 min-w-0 flex-1 items-center justify-center rounded-xl border px-2 py-4 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
              >
                <AppText
                  variant="title"
                  className={
                    selected ? "tabular-nums text-brand" : "tabular-nums"
                  }
                >
                  {weeks} 周
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" className="text-secondary">
          周期用于安排训练，不是目标达成期限。
        </AppText>
      </SetupSection>
      <SetupSection title="补充目标（选填）">
        <Input
          accessibilityLabel="目标补充说明"
          value={note}
          onChangeText={setNote}
          editable={!disabled}
          maxLength={200}
          multiline
          className="min-h-24 py-3"
          textAlignVertical="top"
          placeholder="例如：想完成一次 100 km 骑行"
        />
      </SetupSection>
    </>
  );
}
