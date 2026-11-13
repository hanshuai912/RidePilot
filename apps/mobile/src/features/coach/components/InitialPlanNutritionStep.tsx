import { Pressable, View } from "react-native";
import { Check, NotebookPen } from "lucide-react-native";
import { AppText, Badge, Card, Input } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { SetupChoiceRow } from "./SetupChoiceRow";
import { SetupSection } from "./SetupSection";

const restrictions = [
  "无特殊限制",
  "素食",
  "乳糖不耐受",
  "需要避开坚果",
  "其他限制",
];

export function NutritionStep({
  restriction,
  setRestriction,
  restrictionNote,
  setRestrictionNote,
  meal,
  setMeal,
  disabled = false,
}: {
  restriction: string;
  setRestriction: (value: string) => void;
  restrictionNote: string;
  setRestrictionNote: (value: string) => void;
  meal: string;
  setMeal: (value: string) => void;
  disabled?: boolean;
}) {
  const requiresNote = restriction === "其他限制";
  return (
    <>
      <Card className="gap-3 p-5">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <NotebookPen size={18} color={colors.brand} />
            <AppText variant="card">饮食偏好记录</AppText>
          </View>
          <Badge variant="neutral">仅本次引导</Badge>
        </View>
        <AppText variant="caption" className="text-secondary">
          这里的信息暂不提交服务器，也不会自动应用到饮食方案。
        </AppText>
      </Card>
      <SetupSection
        title="有什么需要避开的？"
        description="选择最符合的一项，其他限制可在下方补充。"
      >
        <View className="flex-row flex-wrap gap-2">
          {restrictions.map((value) => {
            const selected = restriction === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={value}
                accessibilityState={{ selected, checked: selected, disabled }}
                disabled={disabled}
                onPress={() => setRestriction(value)}
                style={{
                  flexBasis: value === "其他限制" ? "100%" : "46%",
                  flexGrow: 1,
                }}
                className={`min-h-16 min-w-0 flex-row items-center gap-3 rounded-xl border p-4 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${disabled ? "opacity-50" : "active:opacity-70"}`}
              >
                <AppText
                  variant="card"
                  className={`min-w-0 flex-1 ${selected ? "text-brand" : "text-primary"}`}
                >
                  {value}
                </AppText>
                <View
                  accessible={false}
                  className={`h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-brand bg-brand" : "border-neutral"}`}
                >
                  {selected ? <Check size={14} color={colors.brandOn} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View className="mt-1 gap-2">
          <AppText variant="caption" className="text-secondary">
            {requiresNote ? "其他限制（必填）" : "补充说明（选填）"}
          </AppText>
          <Input
            accessibilityLabel="其他饮食限制"
            accessibilityHint={
              requiresNote
                ? "请写明具体食物或成分后再生成草稿"
                : "可补充其他需要避开的食物或成分"
            }
            value={restrictionNote}
            onChangeText={setRestrictionNote}
            editable={!disabled}
            maxLength={200}
            multiline
            textAlignVertical="top"
            className="min-h-24 py-3"
            placeholder="例如：对虾类过敏；不吃猪肉"
          />
          <AppText variant="caption" className="text-secondary">
            {requiresNote
              ? "请写明具体食物或成分，最多 200 字。"
              : "选填，最多 200 字。"}
          </AppText>
        </View>
      </SetupSection>
      <SetupSection title="平时更接近哪种饮食？">
        <View className="gap-2">
          {[
            ["家常饮食", "以家里准备的餐食为主"],
            ["外食较多", "更多在餐厅或通过外卖用餐"],
          ].map(([value, description]) => (
            <SetupChoiceRow
              key={value}
              label={value}
              description={description}
              selected={meal === value}
              onPress={() => setMeal(value)}
              disabled={disabled}
            />
          ))}
        </View>
      </SetupSection>
      <View className="gap-1 border-t border-divider pt-4">
        <AppText variant="card">接下来：预览训练草稿</AppText>
        <AppText variant="caption" className="text-secondary">
          点击右上角“生成”后创建训练草稿，查看安排并确认后才会生效。饮食信息仅保留在本次引导中。
        </AppText>
      </View>
    </>
  );
}
