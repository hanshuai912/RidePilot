import { Flag, Moon, RefreshCw } from "lucide-react-native";
import { View } from "react-native";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type { calendarDayActivity } from "../model/calendar-day";
import { styles } from "./training-home.styles";

export function TrainingDayState({
  loading,
  error,
  activity,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  activity: ReturnType<typeof calendarDayActivity>;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <Card style={styles.emptyCard}>
        <Spinner accessibilityLabel="正在加载训练日历" />
        <AppText muted variant="caption">
          正在读取训练安排…
        </AppText>
      </Card>
    );
  if (error)
    return (
      <Card style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <RefreshCw size={28} color={colors.negative} strokeWidth={1.5} />
        </View>
        <View style={styles.emptyCopy}>
          <AppText variant="card" style={styles.centerText}>
            训练安排暂时无法加载
          </AppText>
          <AppText muted variant="caption" style={styles.emptyDescription}>
            {error}
          </AppText>
        </View>
        <Button variant="secondary" onPress={onRetry}>
          重新加载训练安排
        </Button>
      </Card>
    );
  // Races have their own details; tests remain calendar markers only.
  if (activity === "RACE" || activity === "ASSESSMENT") return null;
  const recovery = activity === "RECOVERY";
  const Icon = recovery ? Flag : Moon;
  return (
    <Card style={styles.restCard}>
      <View style={styles.restIcon}>
        <Icon size={28} color={colors.positive} strokeWidth={1.5} />
      </View>
      <View style={styles.restCopy}>
        <AppText variant="section">{recovery ? "恢复安排" : "休息日"}</AppText>
        <AppText muted variant="caption" style={styles.restDescription}>
          {recovery
            ? "当天已安排恢复活动。"
            : "当天没有安排训练，留些时间休息。"}
        </AppText>
      </View>
    </Card>
  );
}
