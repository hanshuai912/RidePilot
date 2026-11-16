import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import type { NutritionProfileInput } from "@ridepilot/contracts";

import { AppText, Button } from "../../../components/ui";
import { defaultNutritionProfile } from "../model/nutrition";
import { NutritionProfileForm } from "./NutritionProfileForm";

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
          <View className="mb-4 flex-row items-center gap-3">
            <View className="min-w-0 flex-1">
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
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="on-drag"
          >
            <NutritionProfileForm
              value={form}
              onChange={setForm}
              disabled={saving}
            />
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
