import { View } from "react-native";
import { CalendarCheck, CircleAlert } from "lucide-react-native";
import type {
  AssessmentPreview,
  AssessmentSchedule,
} from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { datePickerLabel } from "../../../components/ui/date-picker.model";
import { colors } from "../../../theme/colors";
import { assessmentKinds } from "../model/assessment";

const conflictLabels = { WORKOUT: "训练", RACE: "赛事", ASSESSMENT: "测试" };

export function AssessmentSchedulePreview({
  values,
  preview,
  disabled,
  onEdit,
}: {
  values: AssessmentSchedule;
  preview: AssessmentPreview;
  disabled: boolean;
  onEdit: () => void;
}) {
  const hasConflicts = preview.conflicts.length > 0;
  const Icon = hasConflicts ? CircleAlert : CalendarCheck;
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AppText variant="section">确认测试安排</AppText>
        <Button variant="ghost" size="sm" disabled={disabled} onPress={onEdit}>
          修改安排
        </Button>
      </View>
      <Card className="gap-4 p-5">
        <AppText variant="section" className="text-brand tabular-nums">
          {datePickerLabel(values.localDate)}
        </AppText>
        <View className="gap-2 border-t border-divider pt-4">
          <AppText variant="card">{assessmentKinds[values.kind]}</AppText>
          <AppText className="text-secondary">{values.protocol.trim()}</AppText>
        </View>
      </Card>
      <Card className="gap-3 p-5">
        <View className="flex-row items-center gap-2">
          <Icon
            size={20}
            color={hasConflicts ? colors.warning : colors.positive}
          />
          <AppText
            variant="card"
            className={hasConflicts ? "text-warning" : "text-positive"}
          >
            {hasConflicts ? "同日已有安排" : "同日暂无冲突"}
          </AppText>
        </View>
        {preview.conflicts.map((item) => (
          <View key={item.id} className="gap-1 border-t border-divider pt-3">
            <AppText variant="caption" className="text-secondary">
              {conflictLabels[item.type]}
            </AppText>
            <AppText>{item.title}</AppText>
          </View>
        ))}
        {hasConflicts ? (
          <AppText className="text-secondary">
            确认后会保留以上安排。如需错开，请先修改日期。
          </AppText>
        ) : null}
      </Card>
    </View>
  );
}
