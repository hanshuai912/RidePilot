import { CircleHelp } from "lucide-react-native";
import { View } from "react-native";

import { colors } from "../../../theme/colors";
import { AppText, Card } from "../../../components/ui";

export function HomeStatusCard() {
  return (
    <View className="mt-6">
      <AppText variant="section" className="mb-3">
        身体状态
      </AppText>
      <Card className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2">
          <CircleHelp
            color={colors.textSecondary}
            size={21}
            strokeWidth={1.7}
          />
        </View>
        <View className="flex-1">
          <AppText variant="label" muted>
            尚无今日主观反馈
          </AppText>
          <AppText variant="card" className="mt-1">
            状态待评估
          </AppText>
          <AppText variant="caption" className="mt-1 text-secondary">
            有训练和反馈数据后，这里会显示可解释的状态信息。
          </AppText>
        </View>
      </Card>
    </View>
  );
}
