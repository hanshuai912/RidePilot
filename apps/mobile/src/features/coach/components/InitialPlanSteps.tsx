import { Pressable, View } from "react-native";
import type { ProfileResponse } from "@ridepilot/contracts";

import { AppText, Button, Card, Input } from "../../../components/ui";
import { targetDateAfterWeeks } from "../model/plan-dates";
import { ChoicePill } from "./CoachPage";

export type Experience = NonNullable<ProfileResponse["experienceLevel"]>;
export type GoalType = "FTP" | "ENDURANCE" | "RACE";

function GoalOption({
  icon,
  label,
  description,
  selected,
  onPress,
}: {
  icon: string;
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`min-h-[72px] flex-row items-center gap-3 rounded-[15px] border px-3 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
      onPress={onPress}
    >
      <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#2D332D]">
        <AppText className="text-brand">{icon}</AppText>
      </View>
      <View className="flex-1">
        <AppText className={selected ? "text-brand" : "text-primary"}>
          {label}
        </AppText>
        <AppText variant="caption" muted className="mt-1">
          {description}
        </AppText>
      </View>
      <AppText className={selected ? "text-brand" : "text-muted"}>
        {selected ? "✓" : "○"}
      </AppText>
    </Pressable>
  );
}

export function BasicsStep({
  experience,
  setExperience,
  ftpWatts,
  profile,
  onFtp,
  bodyStatus,
  setBodyStatus,
  bodyNote,
  setBodyNote,
  symptomFlags,
  setSymptomFlags,
}: {
  experience: Experience;
  setExperience: (value: Experience) => void;
  ftpWatts: number | null;
  profile: ProfileResponse;
  onFtp: () => void;
  bodyStatus: "READY" | "TIRED" | "RECOVERY";
  setBodyStatus: (value: "READY" | "TIRED" | "RECOVERY") => void;
  bodyNote: string;
  setBodyNote: (value: string) => void;
  symptomFlags: ("CHEST_PAIN" | "FAINTING" | "SEVERE_ILLNESS")[];
  setSymptomFlags: (
    value: ("CHEST_PAIN" | "FAINTING" | "SEVERE_ILLNESS")[],
  ) => void;
}) {
  return (
    <>
      <Card>
        <AppText variant="label" className="text-brand">
          训练经验
        </AppText>
        <AppText variant="card" className="mt-2">
          你目前处于哪个阶段？
        </AppText>
        <AppText variant="caption" muted className="mt-1">
          用于控制计划起点和解释方式，不代表能力评级。
        </AppText>
        <View className="mt-4 gap-2">
          <ChoicePill
            label="刚开始骑行"
            selected={experience === "BEGINNER"}
            onPress={() => setExperience("BEGINNER")}
          />
          <ChoicePill
            label="规律骑行"
            selected={experience === "INTERMEDIATE"}
            onPress={() => setExperience("INTERMEDIATE")}
          />
          <ChoicePill
            label="有系统训练"
            selected={experience === "ADVANCED"}
            onPress={() => setExperience("ADVANCED")}
          />
        </View>
      </Card>
      <Card>
        <AppText variant="label" className="text-brand">
          功率数据
        </AppText>
        <AppText variant="card" className="mt-2">
          你是否有可用的 FTP 数据？
        </AppText>
        <AppText className="mt-2 text-brand">
          {ftpWatts ? `${ftpWatts} W` : "尚未填写"}
        </AppText>
        <AppText variant="caption" muted className="mt-2">
          AI 骑行计划需要已测得的 FTP。没有功率计也可以手动录入可信的测量结果。
        </AppText>
        <Button variant="secondary" className="mt-4" onPress={onFtp}>
          {ftpWatts ? "到个人资料更新 FTP" : "到个人资料补充 FTP"}
        </Button>
      </Card>
      <Card>
        <AppText variant="caption" muted>
          已读取资料
        </AppText>
        <AppText className="mt-2">
          身高 {profile.heightCm ?? "未填写"} cm · 体重{" "}
          {profile.weightKg ?? "未填写"} kg
        </AppText>
        <AppText variant="caption" muted className="mt-1">
          时区：{profile.timezone}
        </AppText>
        {!profile.weightKg ? (
          <Button variant="secondary" className="mt-4" onPress={onFtp}>
            到个人资料补充体重
          </Button>
        ) : null}
      </Card>
      <Card>
        <AppText variant="card">本次训练状态</AppText>
        <AppText variant="caption" muted className="mt-1">
          只影响本次草稿的起始强度，不会修改你的个人档案。
        </AppText>
        <View className="mt-4 gap-2">
          <ChoicePill
            label="状态正常，可以按计划训练"
            selected={bodyStatus === "READY"}
            onPress={() => setBodyStatus("READY")}
          />
          <ChoicePill
            label="有些疲劳，希望安排得保守一些"
            selected={bodyStatus === "TIRED"}
            onPress={() => setBodyStatus("TIRED")}
          />
          <ChoicePill
            label="需要恢复，先降低训练压力"
            selected={bodyStatus === "RECOVERY"}
            onPress={() => setBodyStatus("RECOVERY")}
          />
        </View>
        <Input
          className="mt-3"
          accessibilityLabel="身体状态补充说明"
          value={bodyNote}
          onChangeText={setBodyNote}
          maxLength={200}
          placeholder="例如：最近睡眠不足，希望安排得保守一些"
        />
        <View className="mt-4 rounded-xl border border-negative bg-surface-2 p-3">
          <AppText variant="label" className="text-negative">
            安全确认
          </AppText>
          <AppText variant="caption" muted className="mt-1">
            如果有以下情况，请先暂停训练并进行适当的医疗评估。
          </AppText>
          <View className="mt-3 gap-2">
            {(
              [
                ["CHEST_PAIN", "胸痛"],
                ["FAINTING", "晕厥或接近晕厥"],
                ["SEVERE_ILLNESS", "明显生病或发热"],
              ] as const
            ).map(([value, label]) => {
              const selected = symptomFlags.includes(value);
              return (
                <Pressable
                  key={value}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  className={`rounded-xl border px-3 py-3 ${selected ? "border-negative bg-[#3B2827]" : "border-border bg-surface-2"}`}
                  onPress={() =>
                    setSymptomFlags(
                      selected
                        ? symptomFlags.filter((item) => item !== value)
                        : [...symptomFlags, value],
                    )
                  }
                >
                  <AppText className={selected ? "text-negative" : undefined}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>
    </>
  );
}

export function GoalStep({
  type,
  setType,
  date,
  setDate,
  today,
  targetWkg,
  setTargetWkg,
  note,
  setNote,
  cycleWeeks,
  setCycleWeeks,
}: {
  type: GoalType;
  setType: (value: GoalType) => void;
  date: string;
  setDate: (value: string) => void;
  today: string;
  targetWkg: string;
  setTargetWkg: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  cycleWeeks: number;
  setCycleWeeks: (value: number) => void;
}) {
  return (
    <>
      <Card>
        <AppText variant="card">训练目标</AppText>
        <AppText variant="caption" muted className="mt-1">
          选择一项主要方向，后续可以在计划里继续调整。
        </AppText>
        <View className="mt-4 gap-2">
          <GoalOption
            icon="↗"
            label="提升 FTP / 阈值能力"
            description="提高持续输出和爬坡能力"
            selected={type === "FTP"}
            onPress={() => setType("FTP")}
          />
          <GoalOption
            icon="◌"
            label="提升耐力与长距离能力"
            description="让长时间骑行更稳定"
            selected={type === "ENDURANCE"}
            onPress={() => setType("ENDURANCE")}
          />
          <GoalOption
            icon="◆"
            label="准备一场比赛"
            description="围绕目标日期安排阶段训练"
            selected={type === "RACE"}
            onPress={() => setType("RACE")}
          />
        </View>
      </Card>
      <Card>
        <AppText variant="card">目标日期</AppText>
        <AppText variant="caption" muted className="mt-1">
          请选择明确日期。阶段检查点只是建议，不保证届时达到目标。
        </AppText>
        <View className="mt-3 flex-row gap-2">
          {[8, 12, 16].map((weeks) => (
            <Pressable
              key={weeks}
              accessibilityRole="button"
              className={`flex-1 rounded-xl border p-3 ${date === targetDateAfterWeeks(today, weeks) ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
              onPress={() => setDate(targetDateAfterWeeks(today, weeks))}
            >
              <AppText className="text-center text-brand">{weeks} 周后</AppText>
            </Pressable>
          ))}
        </View>
        <Input
          className="mt-3"
          accessibilityLabel="目标日期"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          maxLength={10}
        />
      </Card>
      {type === "FTP" ? (
        <Card>
          <AppText variant="card">目标功体比（选填）</AppText>
          <AppText variant="caption" muted className="mt-1">
            例如 4 W/kg；填写后需要档案中有体重。
          </AppText>
          <Input
            className="mt-3"
            accessibilityLabel="目标功体比"
            keyboardType="decimal-pad"
            value={targetWkg}
            onChangeText={setTargetWkg}
            placeholder="例如 4"
          />
        </Card>
      ) : null}
      <Card>
        <AppText variant="card">本次训练周期</AppText>
        <AppText variant="caption" muted className="mt-1">
          AI 会先生成近期可执行课程，后续按训练反馈滚动调整。
        </AppText>
        <View className="mt-4 flex-row gap-2">
          {[4, 8, 12].map((weeks) => (
            <Pressable
              key={weeks}
              accessibilityRole="radio"
              accessibilityState={{ selected: cycleWeeks === weeks }}
              className={`flex-1 rounded-xl border p-3 ${cycleWeeks === weeks ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
              onPress={() => setCycleWeeks(weeks)}
            >
              <AppText
                className={
                  cycleWeeks === weeks
                    ? "text-center text-brand"
                    : "text-center"
                }
              >
                {weeks} 周
              </AppText>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card>
        <AppText variant="card">补充目标（选填）</AppText>
        <Input
          className="mt-3"
          accessibilityLabel="目标补充说明"
          value={note}
          onChangeText={setNote}
          maxLength={200}
          placeholder="例如：想完成一次 100 km 骑行"
        />
      </Card>
    </>
  );
}

const weekdays = [
  [1, "周一"],
  [2, "周二"],
  [3, "周三"],
  [4, "周四"],
  [5, "周五"],
  [6, "周六"],
  [0, "周日"],
] as const;

export function ScheduleStep({
  days,
  setDays,
  minutes,
  setMinutes,
}: {
  days: number[];
  setDays: (value: number[]) => void;
  minutes: number;
  setMinutes: (value: number) => void;
}) {
  return (
    <>
      <Card>
        <AppText variant="card">每周可训练日</AppText>
        <AppText variant="caption" muted className="mt-1">
          其余日期作为休息日；临时变化可以之后调整。
        </AppText>
        <View className="mt-4 flex-row flex-wrap gap-2">
          {weekdays.map(([day, label]) => (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: days.includes(day) }}
              className={`min-w-[29%] rounded-xl border px-3 py-3 ${days.includes(day) ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
              onPress={() =>
                setDays(
                  days.includes(day)
                    ? days.filter((value) => value !== day)
                    : [...days, day],
                )
              }
            >
              <AppText
                className={days.includes(day) ? "text-brand" : "text-primary"}
              >
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card>
        <AppText variant="card">单次可训练时间上限</AppText>
        <View className="mt-4 flex-row flex-wrap gap-2">
          {[45, 60, 90, 120].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: minutes === value }}
              className={`rounded-xl border px-3 py-3 ${minutes === value ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
              onPress={() => setMinutes(value)}
            >
              <AppText
                className={minutes === value ? "text-brand" : "text-primary"}
              >
                {value} 分钟
              </AppText>
            </Pressable>
          ))}
        </View>
        <AppText variant="caption" muted className="mt-3">
          这是上限，生成的每节课程可能更短。
        </AppText>
      </Card>
    </>
  );
}

export function NutritionStep({
  restriction,
  setRestriction,
  restrictionNote,
  setRestrictionNote,
  meal,
  setMeal,
}: {
  restriction: string;
  setRestriction: (value: string) => void;
  restrictionNote: string;
  setRestrictionNote: (value: string) => void;
  meal: string;
  setMeal: (value: string) => void;
}) {
  const restrictions = [
    "无特殊限制",
    "素食",
    "乳糖不耐受",
    "需要避开坚果",
    "其他限制",
  ];

  return (
    <>
      <Card>
        <AppText variant="label" className="text-brand">
          饮食偏好
        </AppText>
        <AppText variant="card" className="mt-2">
          有什么需要避开的？
        </AppText>
        <AppText variant="caption" muted className="mt-1">
          先记录你的饮食限制，当前只保存在本次引导，不提交服务器。
        </AppText>
        <View className="mt-4 flex-row flex-wrap gap-2">
          {restrictions.map((value) => (
            <View
              key={value}
              className={value === "其他限制" ? "w-full" : "w-[48%]"}
            >
              <ChoicePill
                label={value}
                selected={restriction === value}
                onPress={() => setRestriction(value)}
              />
            </View>
          ))}
        </View>
        <AppText variant="label" className="mt-4">
          其他需要说明{" "}
          <AppText variant="label" muted>
            {restriction === "其他限制" ? "必填" : "可选"}
          </AppText>
        </AppText>
        <Input
          className="mt-2"
          accessibilityLabel="其他饮食限制"
          value={restrictionNote}
          onChangeText={setRestrictionNote}
          maxLength={200}
          placeholder="例如：对虾类过敏；不吃猪肉"
        />
        <AppText variant="caption" muted className="mt-2">
          选择“其他限制”时请写明具体食物或成分，最多 200 字。
        </AppText>
      </Card>
      <Card>
        <AppText variant="card">平时更接近哪种饮食？</AppText>
        <View className="mt-4 flex-row gap-2">
          {["家常饮食", "外食较多"].map((value) => (
            <View key={value} className="flex-1">
              <ChoicePill
                label={value}
                selected={meal === value}
                onPress={() => setMeal(value)}
              />
            </View>
          ))}
        </View>
      </Card>
      <View className="rounded-[14px] border border-[#3F493F] bg-[#242B25] p-3">
        <AppText variant="label" className="text-positive">
          本次生成范围
        </AppText>
        <AppText variant="caption" className="mt-2 text-secondary">
          训练计划会进入草稿生成；饮食与禁忌只做本地记录，暂不提交或应用。
        </AppText>
      </View>
    </>
  );
}
