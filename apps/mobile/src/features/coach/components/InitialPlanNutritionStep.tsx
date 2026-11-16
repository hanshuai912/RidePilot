import { View } from "react-native";
import { NotebookPen } from "lucide-react-native";
import { AppText, Badge, Button, Card, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { NutritionProfileForm } from "../../nutrition/components/NutritionProfileForm";
import type { useInitialPlanNutrition } from "../hooks/useInitialPlanNutrition";

export function NutritionStep({
  nutrition,
  disabled = false,
}: {
  nutrition: ReturnType<typeof useInitialPlanNutrition>;
  disabled?: boolean;
}) {
  const unavailable =
    disabled || nutrition.saving || nutrition.loading || nutrition.conflict;
  if (!nutrition.loaded)
    return (
      <Card className="gap-3 p-5">
        {nutrition.loading ? (
          <Spinner accessibilityLabel="读取饮食档案" />
        ) : (
          <>
            <AppText variant="card">暂时无法读取饮食档案</AppText>
            <AppText variant="caption" className="text-secondary">
              重新读取后再继续，避免覆盖已保存的偏好与禁忌。
            </AppText>
            <Button variant="secondary" onPress={() => void nutrition.load()}>
              重新读取饮食档案
            </Button>
          </>
        )}
      </Card>
    );
  return (
    <>
      <Card className="gap-3 p-5">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <NotebookPen size={18} color={colors.brand} accessible={false} />
            <AppText variant="card">你的饮食档案</AppText>
          </View>
          <Badge variant="neutral">
            {nutrition.saving
              ? "正在保存"
              : nutrition.loading
                ? "正在读取"
                : nutrition.profile
                  ? nutrition.dirty
                    ? "有未保存修改"
                    : "已同步"
                  : "首次建立"}
          </Badge>
        </View>
        <AppText variant="caption" className="text-secondary">
          点击右上角“生成”时保存，与饮食页共享，可随时修改。
        </AppText>
      </Card>
      {nutrition.conflict ? (
        <View className="gap-2">
          <Button
            variant="secondary"
            disabled={nutrition.loading}
            onPress={() => void nutrition.load(true)}
          >
            重新读取饮食档案
          </Button>
          <AppText variant="caption" className="text-secondary">
            重新读取会替换本页未保存的修改，请先核对上方提示。
          </AppText>
        </View>
      ) : null}
      <NutritionProfileForm
        value={nutrition.form}
        onChange={nutrition.setForm}
        disabled={unavailable}
      />
      <View className="gap-1 border-t border-divider pt-4">
        <AppText variant="card">接下来：预览训练草稿</AppText>
        <AppText variant="caption" className="text-secondary">
          先保存饮食档案，再生成训练草稿；确认训练后，可按新的训练安排生成餐食与补给，并单独确认。
        </AppText>
      </View>
    </>
  );
}
