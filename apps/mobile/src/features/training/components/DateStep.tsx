import { TextInput, View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/tokens";
import type { Workout } from "../model/training";
import { dateLabel, weekday } from "../model/training";
import { Notice } from "./TrainingParts";
import { styles } from "./training.styles";

export function DateStep({
  date,
  workouts,
  onBack,
  onChange,
  onContinue,
}: {
  date: string;
  workouts: Workout[];
  onBack: () => void;
  onChange: (date: string) => void;
  onContinue: () => void;
}) {
  return (
    <View style={styles.page}>
      <Card style={styles.card}>
        <AppText variant="label" muted>
          训练日期
        </AppText>
        <TextInput
          value={date}
          onChangeText={onChange}
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
        />
        <AppText variant="caption" muted>
          同一天已有 {workouts.length} 节课程，新课程会作为第{" "}
          {workouts.length + 1} 节添加。
        </AppText>
      </Card>
      <Card style={styles.card}>
        <AppText variant="card">
          {dateLabel(date)} · {weekday(date)}
        </AppText>
        {workouts.map((item) => (
          <View key={item.id} style={styles.dataRow}>
            <AppText variant="caption">
              第 {item.dayOrder} 节 · {item.title || "骑行训练"}
            </AppText>
            <AppText variant="caption" muted>
              {item.timeTargetMinutes
                ? `${item.timeTargetMinutes} 分钟`
                : "手动"}
            </AppText>
          </View>
        ))}
      </Card>
      <Notice text="手动课程只记录日期和当天顺序，不设置具体开始时间。" />
      <View style={styles.bottomButtons}>
        <Button variant="secondary" onPress={onBack}>
          取消
        </Button>
        <Button onPress={onContinue}>创建第 {workouts.length + 1} 节</Button>
      </View>
    </View>
  );
}
