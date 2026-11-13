import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import {
  nutritionItemDraftSchema,
  type NutritionItemDraft,
} from "@ridepilot/contracts";
import { AppText, Button, Input } from "../../../components/ui";

export function NutritionItemEditor({
  item,
  busy,
  onSave,
  onClose,
  saveError,
}: {
  item: NutritionItemDraft;
  busy: boolean;
  onSave: (item: NutritionItemDraft) => Promise<boolean | undefined>;
  onClose: () => void;
  saveError?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const [time, setTime] = useState(item.scheduledLocalTime);
  const [amounts, setAmounts] = useState(
    item.foods.map((food) => String(food.amount)),
  );
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setError(null);
    const changed = amounts.some(
      (value, index) => Number(value) !== item.foods[index].amount,
    );
    const parsed = nutritionItemDraftSchema.safeParse({
      ...item,
      scheduledLocalTime: time,
      foods: item.foods.map((food, index) => ({
        ...food,
        amount: Number(amounts[index]),
      })),
      ...(changed
        ? {
            nutrients: {
              energyKcal: null,
              carbohydrateG: null,
              proteinG: null,
              fatG: null,
              fluidMl: null,
              sodiumMg: null,
            },
            confidence: "LOW",
            nutritionSource: "USER_ENTERED",
          }
        : {}),
    });
    if (!parsed.success) {
      setError("请输入有效时间（HH:mm）及大于 0、不超过 10000 的份量");
      return;
    }
    try {
      if (await onSave(parsed.data)) onClose();
      else setError("保存未成功，请重试。输入内容已保留。");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "保存失败，请重试。输入内容已保留。",
      );
    }
  };
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View className="flex-1 justify-end bg-black/70">
        <ScrollView
          className="max-h-[85%] rounded-t-[24px] border-t border-border bg-background p-5"
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          <AppText variant="section">编辑{item.title}</AppText>
          <AppText variant="caption" className="mt-4">
            用餐时间（HH:mm）
          </AppText>
          <Input
            editable={!busy}
            accessibilityLabel="用餐时间"
            value={time}
            onChangeText={setTime}
            placeholder="08:00"
            className="mt-4"
          />
          {item.foods.map((food, index) => (
            <View key={index}>
              <AppText variant="caption" className="mt-3">
                {food.name}（{food.unit}）
              </AppText>
              <Input
                editable={!busy}
                placeholder={`${food.name}（${food.unit}）`}
                accessibilityLabel={`${food.name}份量`}
                keyboardType="decimal-pad"
                value={amounts[index]}
                onChangeText={(value) =>
                  setAmounts((current) =>
                    current.map((amount, at) =>
                      at === index ? value : amount,
                    ),
                  )
                }
                className="mt-1"
              />
            </View>
          ))}
          <AppText variant="caption" muted className="mt-3">
            修改份量后营养值将标为待估算。食材、单位和过敏原信息保留，保存后需重新校验并确认应用。
          </AppText>
          {saveError || error ? (
            <AppText accessibilityRole="alert" className="mt-3 text-negative">
              {saveError || error}
            </AppText>
          ) : null}
          <Button className="mt-4" loading={busy} onPress={() => void save()}>
            保存为草稿
          </Button>
          <Button
            className="mb-8 mt-2"
            variant="ghost"
            disabled={busy}
            onPress={onClose}
          >
            取消编辑
          </Button>
        </ScrollView>
      </View>
    </Modal>
  );
}
