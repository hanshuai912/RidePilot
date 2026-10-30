import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import type { NutritionProfileInput } from "@ridepilot/contracts";

import { AppText, Button, Card, Input } from "../../../components/ui";
import {
  allergenLabels,
  defaultNutritionProfile,
  dietStyleLabels,
  habitLabels,
  restrictionLabels,
} from "../model/nutrition";

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function Choice<T extends string>({
  value,
  selected,
  label,
  onPress,
}: {
  value: T;
  selected: boolean;
  label: string;
  onPress: (value: T) => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`rounded-full border px-3 py-2 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
      onPress={() => onPress(value)}
    >
      <AppText
        variant="label"
        className={selected ? "text-brand" : "text-secondary"}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function NutritionProfileEditor({
  visible,
  profile,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  profile?: NutritionProfileInput;
  saving: boolean;
  onClose: () => void;
  onSave: (input: NutritionProfileInput) => Promise<void>;
}) {
  const [form, setForm] = useState<NutritionProfileInput>(
    profile ?? defaultNutritionProfile,
  );

  const set = <K extends keyof NutritionProfileInput>(
    key: K,
    value: NutritionProfileInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <View className="flex-1 justify-end bg-black/70">
        <View className="max-h-[92%] rounded-t-[24px] border-t border-border bg-background px-5 pb-5 pt-4">
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <AppText variant="section">饮食档案</AppText>
              <AppText variant="caption" muted className="mt-1">
                只用于生成建议，正式计划仍需你确认后应用
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭饮食档案"
              disabled={saving}
              onPress={onClose}
            >
              <AppText className="text-brand">关闭</AppText>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-5 pb-5"
          >
            <View>
              <AppText variant="label" muted className="mb-2">
                饮食方式
              </AppText>
              <View className="flex-row flex-wrap gap-2">
                {(
                  Object.entries(dietStyleLabels) as [
                    NutritionProfileInput["dietStyle"],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <Choice
                    key={value}
                    value={value}
                    label={label}
                    selected={form.dietStyle === value}
                    onPress={(next) => set("dietStyle", next)}
                  />
                ))}
              </View>
            </View>
            <View>
              <AppText variant="label" muted className="mb-2">
                日常习惯（可多选）
              </AppText>
              <View className="flex-row flex-wrap gap-2">
                {(
                  Object.entries(habitLabels) as [
                    NutritionProfileInput["habits"][number],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <Choice
                    key={value}
                    value={value}
                    label={label}
                    selected={form.habits.includes(value)}
                    onPress={(next) => set("habits", toggle(form.habits, next))}
                  />
                ))}
              </View>
            </View>
            <View>
              <AppText variant="label" muted className="mb-2">
                过敏原
              </AppText>
              <View className="flex-row flex-wrap gap-2">
                {(
                  Object.entries(allergenLabels) as [
                    NutritionProfileInput["allergens"][number],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <Choice
                    key={value}
                    value={value}
                    label={label}
                    selected={form.allergens.includes(value)}
                    onPress={(next) =>
                      set("allergens", toggle(form.allergens, next))
                    }
                  />
                ))}
              </View>
            </View>
            <View>
              <AppText variant="label" muted className="mb-2">
                饮食限制
              </AppText>
              <View className="flex-row flex-wrap gap-2">
                {(
                  Object.entries(restrictionLabels) as [
                    NutritionProfileInput["restrictions"][number],
                    string,
                  ][]
                ).map(([value, label]) => (
                  <Choice
                    key={value}
                    value={value}
                    label={label}
                    selected={form.restrictions.includes(value)}
                    onPress={(next) =>
                      set("restrictions", toggle(form.restrictions, next))
                    }
                  />
                ))}
              </View>
              {form.restrictions.includes("OTHER") ? (
                <Input
                  className="mt-3"
                  value={form.restrictionNote ?? ""}
                  placeholder="请说明具体限制"
                  onChangeText={(value) => set("restrictionNote", value)}
                />
              ) : null}
            </View>
            <Card className="bg-surface-2">
              <AppText variant="caption" className="text-secondary">
                计划会根据今天的训练安排生成餐食和训练前、中、后补给。热量与营养值缺少可靠输入时会标注为估算。
              </AppText>
            </Card>
          </ScrollView>
          <Button loading={saving} size="lg" onPress={() => void onSave(form)}>
            保存饮食档案
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export function NutritionProfileSheet(
  props: React.ComponentProps<typeof NutritionProfileEditor>,
) {
  return props.visible ? <NutritionProfileEditor {...props} /> : null;
}
