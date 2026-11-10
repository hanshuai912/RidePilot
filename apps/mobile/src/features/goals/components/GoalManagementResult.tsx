import { View } from "react-native";
import { router } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { AppText, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { GoalInfoButton } from "./GoalInfoButton";

export function GoalManagementResult({
  goalId,
  created = false,
}: {
  goalId: string;
  created?: boolean;
}) {
  return (
    <View className="gap-4">
      <Card className="gap-3 p-5">
        <CircleCheck color={colors.brand} size={28} />
        <View className="flex-row items-center">
          <AppText variant="section" className="flex-1">
            {created ? "新目标已添加" : "目标修改已保存"}
          </AppText>
          <GoalInfoButton
            title="保存后说明"
            description="目标操作已保存，现有正式课程、测试与饮食仍按原安排执行。你可以查看目标与阶段，或检查未来训练安排，再决定是否生成调整草稿。"
          />
        </View>
      </Card>
      <Button
        size="lg"
        onPress={() =>
          router.replace({ pathname: "/goals/[goalId]", params: { goalId } })
        }
      >
        查看目标与阶段
      </Button>
      <Button
        variant="secondary"
        onPress={() => router.push("/plans/input-impact")}
      >
        检查未来训练安排
      </Button>
      <Button variant="ghost" onPress={() => router.replace("/goals")}>
        返回目标列表
      </Button>
    </View>
  );
}
