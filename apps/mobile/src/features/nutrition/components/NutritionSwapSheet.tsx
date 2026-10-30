import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import type { NutritionPlanResponse } from "@ridepilot/contracts";

import { AppText, Button, Input, Tabs } from "../../../components/ui";
import { mealTypeLabels } from "../model/nutrition";

type NutritionItem = NutritionPlanResponse["items"][number];
type Reason = "DISLIKE" | "MISSING_INGREDIENT" | "EATING_OUT" | "LIMITED_PREP_TIME" | "TRAINING_CHANGED";

const reasons: { key: Reason; label: string }[] = [
  { key: "DISLIKE", label: "不想吃" },
  { key: "MISSING_INGREDIENT", label: "缺少食材" },
  { key: "EATING_OUT", label: "今天外食" },
  { key: "LIMITED_PREP_TIME", label: "准备时间少" },
  { key: "TRAINING_CHANGED", label: "训练改变" },
];

export function NutritionSwapSheet({
  item,
  busy,
  onClose,
  onSubmit,
}: {
  item: NutritionItem | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { item: NutritionItem; reason: Reason; foodName: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState<Reason>("DISLIKE");
  const [foodName, setFoodName] = useState("");

  useEffect(() => {
    if (item) {
      setReason("DISLIKE");
      setFoodName("");
    }
  }, [item]);

  if (!item) return null;
  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="rounded-t-[24px] border-t border-border bg-background px-5 pb-5 pt-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <AppText variant="section">替换{mealTypeLabels[item.mealType]}</AppText>
              <AppText variant="caption" muted className="mt-1">当前：{item.title}</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭替换餐食" onPress={onClose}>
              <AppText className="text-brand">关闭</AppText>
            </Pressable>
          </View>
          <AppText variant="label" muted className="mb-2 mt-5">替换原因</AppText>
          <Tabs options={reasons} value={reason} onValueChange={(value) => setReason(value as Reason)} />
          <AppText variant="label" muted className="mb-2 mt-5">想换成什么（可选）</AppText>
          <Input value={foodName} onChangeText={setFoodName} placeholder="例如：香蕉和酸奶" />
          <AppText variant="caption" muted className="mt-3 leading-5">
            新食材会先以低置信度草稿提交，服务端校验通过后才能应用。请结合食品标签确认营养值。
          </AppText>
          <Button
            className="mt-5"
            size="lg"
            loading={busy}
            onPress={() => void onSubmit({ item, reason, foodName: foodName.trim() || "待补充食材" })}
          >
            生成替换草稿
          </Button>
        </View>
      </View>
    </Modal>
  );
}
