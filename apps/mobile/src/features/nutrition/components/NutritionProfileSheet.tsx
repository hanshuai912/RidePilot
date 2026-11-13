import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  multiple = false,
  disabled = false,
}: {
  value: T;
  selected: boolean;
  label: string;
  onPress: (value: T) => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={
        multiple
          ? { checked: selected, disabled }
          : { checked: selected, selected, disabled }
      }
      disabled={disabled}
      className={`min-h-12 justify-center rounded-full border px-3 py-2 active:opacity-70 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
      onPress={() => onPress(value)}
    >
      <AppText
        variant="caption"
        className={selected ? "text-brand" : "text-secondary"}
      >
        {selected ? "已选 · " : ""}
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
  error,
}: {
  visible: boolean;
  profile?: NutritionProfileInput;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (input: NutritionProfileInput) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
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
        <View
          style={{ paddingBottom: Math.max(20, insets.bottom) }}
          className="max-h-[92%] rounded-t-[24px] border-t border-border bg-background px-5 pb-5 pt-4"
        >
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
              className="min-h-12 min-w-12 items-center justify-center"
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
              <AppText variant="caption" muted className="mb-2">
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
                    disabled={saving}
                    selected={form.dietStyle === value}
                    onPress={(next) => set("dietStyle", next)}
                  />
                ))}
              </View>
            </View>
            <View>
              <AppText variant="caption" muted className="mb-2">
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
                    multiple
                    disabled={saving}
                    selected={form.habits.includes(value)}
                    onPress={(next) => set("habits", toggle(form.habits, next))}
                  />
                ))}
              </View>
            </View>
            <View>
              <AppText variant="caption" muted className="mb-2">
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
                    multiple
                    disabled={saving}
                    selected={form.allergens.includes(value)}
                    onPress={(next) =>
                      set("allergens", toggle(form.allergens, next))
                    }
                  />
                ))}
              </View>
            </View>
            <View>
              <AppText variant="caption" muted className="mb-2">
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
                    multiple
                    disabled={saving}
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
                  accessibilityLabel="其他饮食限制"
                  editable={!saving}
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
          {error ? (
            <AppText
              accessibilityRole="alert"
              variant="caption"
              className="mb-3 text-negative"
            >
              {error}
            </AppText>
          ) : null}
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
