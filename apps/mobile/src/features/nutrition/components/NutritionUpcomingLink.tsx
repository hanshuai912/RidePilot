import { View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";
import { addDays } from "../../coach/model/plan-dates";
import { useNutritionScheduleRange } from "../hooks/useNutritionScheduleRange";
import { shortDateLabel } from "../model/nutrition-dates";

// Bound the shortcut to 30 future days; the month browser can reach any date.
export function NutritionUpcomingLink({
  token,
  today,
  revision,
  disabled,
  onSelect,
}: {
  token: string;
  today: string;
  revision: number;
  disabled: boolean;
  onSelect: (date: string) => void;
}) {
  const range = useNutritionScheduleRange(
    token,
    addDays(today, 1),
    addDays(today, 30),
    revision,
  );
  const nearest = [...range.dates].sort()[0];
  if (range.loading)
    return (
      <AppText variant="caption" muted>
        正在查找未来 30 天的安排…
      </AppText>
    );
  if (range.error)
    return (
      <View className="gap-1">
        <AppText variant="caption" muted>
          暂时无法查找后续安排，可通过日历选择日期。
        </AppText>
        <Button size="sm" variant="ghost" onPress={range.retry}>
          重试查找后续安排
        </Button>
      </View>
    );
  if (!nearest)
    return (
      <AppText variant="caption" muted>
        未来 30 天暂无已确认的安排，可展开月历查看其他日期。
      </AppText>
    );
  return (
    <Card className="gap-2 border-brand/40 bg-brand-subtle">
      <AppText variant="card">后续饮食已安排</AppText>
      <AppText variant="caption" muted>
        未来 30 天内，最近的正式安排在{shortDateLabel(nearest)}。
      </AppText>
      <Button
        variant="secondary"
        disabled={disabled}
        onPress={() => onSelect(nearest)}
      >
        查看{shortDateLabel(nearest)}安排
      </Button>
    </Card>
  );
}
