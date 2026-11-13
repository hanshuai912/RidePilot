import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import type { NutritionPlanResponse } from "@ridepilot/contracts";

import { AppText, Button, Input } from "../../../components/ui";
import { mealTypeLabels } from "../model/nutrition";

type NutritionItem = NutritionPlanResponse["items"][number];
type Reason =
  | "DISLIKE"
  | "MISSING_INGREDIENT"
  | "EATING_OUT"
  | "LIMITED_PREP_TIME"
  | "TRAINING_CHANGED";

const reasons: { key: Reason; label: string }[] = [
  { key: "DISLIKE", label: "不想吃" },
  { key: "MISSING_INGREDIENT", label: "缺少食材" },
  { key: "EATING_OUT", label: "今天外食" },
  { key: "LIMITED_PREP_TIME", label: "准备时间少" },
  { key: "TRAINING_CHANGED", label: "训练改变" },
];

function NutritionSwapEditor({
  item,
  busy,
  onClose,
  onSubmit,
  error,
}: {
  item: NutritionItem;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: {
    item: NutritionItem;
    reason: Reason;
    foodName: string;
  }) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<Reason>("DISLIKE");
  const [foodName, setFoodName] = useState("");

  return (
    <Modal
      animationType="slide"
      transparent
      visible
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View className="flex-1 justify-end bg-black/70">
        <ScrollView
          className="max-h-[90%] rounded-t-[24px] border-t border-border bg-background"
          contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom) }}
          contentContainerClassName="px-5 pt-5"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <AppText variant="section">
                替换{mealTypeLabels[item.mealType]}
              </AppText>
              <AppText variant="caption" muted className="mt-1">
                当前：{item.title}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭替换餐食"
              disabled={busy}
              className="min-h-12 min-w-12 items-center justify-center"
              onPress={onClose}
            >
              <AppText className="text-brand">关闭</AppText>
            </Pressable>
          </View>
          <AppText variant="caption" muted className="mb-2 mt-5">
            替换原因
          </AppText>
          <View className="flex-row flex-wrap gap-2">
            {reasons.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: option.key === reason,
                  selected: option.key === reason,
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() => setReason(option.key)}
                className={`min-h-12 justify-center rounded-xl border px-3 py-2 active:opacity-70 ${option.key === reason ? "border-brand bg-brand-subtle" : "border-border bg-surface"}`}
              >
                <AppText variant="caption">
                  {option.key === reason ? "已选 · " : ""}
                  {option.label}
                </AppText>
              </Pressable>
            ))}
          </View>
          <AppText variant="caption" muted className="mb-2 mt-5">
            想换成什么（可选）
          </AppText>
          <Input
            accessibilityLabel="替换食材"
            editable={!busy}
            value={foodName}
            onChangeText={setFoodName}
            placeholder="例如：香蕉和酸奶"
          />
          <AppText variant="caption" muted className="mt-3 leading-5">
            留空会创建「待补充食材」草稿，不会自动推荐食材。新食材的营养值需核对补充，校验并确认后才能应用。
          </AppText>
          {error ? (
            <AppText accessibilityRole="alert" className="mt-3 text-negative">
              {error}
            </AppText>
          ) : null}
          <Button
            className="mt-5"
            size="lg"
            loading={busy}
            onPress={() =>
              void onSubmit({
                item,
                reason,
                foodName: foodName.trim() || "待补充食材",
              })
            }
          >
            生成替换草稿
          </Button>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function NutritionSwapSheet(
  props: Omit<React.ComponentProps<typeof NutritionSwapEditor>, "item"> & {
    item: NutritionItem | null;
  },
) {
  return props.item ? (
    <NutritionSwapEditor key={props.item.id} {...props} item={props.item} />
  ) : null;
}
