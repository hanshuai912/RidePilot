import { View } from "react-native";
import type { ProposalResponse } from "@ridepilot/contracts";
import { AppText, Button, Card } from "../../../components/ui";
import { dateLabel } from "../model/training";
import { Notice } from "./TrainingParts";
import { styles } from "./training.styles";

export function Preview({
  proposal,
  feedback,
  busy,
  onBack,
  onValidate,
  onApply,
}: {
  proposal: ProposalResponse;
  feedback: string | null;
  busy?: boolean;
  onBack: () => void;
  onValidate: () => void;
  onApply: () => void;
}) {
  const ready = proposal.status === "READY" && proposal.validation.passed;
  return (
    <View style={styles.page}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View>
            <AppText variant="label" style={styles.eyebrow}>
              课程草稿
            </AppText>
            <AppText variant="section">
              {proposal.draftWorkout.title || "骑行训练"}
            </AppText>
          </View>
          <AppText variant="label" style={styles.goldChip}>
            {proposal.status === "READY" ? "可应用" : "待校验"}
          </AppText>
        </View>
        <View style={styles.dataRow}>
          <AppText variant="caption">日期与顺序</AppText>
          <AppText variant="caption">
            {dateLabel(proposal.draftWorkout.scheduledDate)} · 第{" "}
            {proposal.draftWorkout.dayOrder} 节
          </AppText>
        </View>
        <View style={styles.dataRow}>
          <AppText variant="caption">目标汇总</AppText>
          <AppText variant="caption">
            {proposal.draftWorkout.timeTargetMinutes ?? "—"} 分钟 +{" "}
            {proposal.draftWorkout.distanceTargetKm ?? "—"} 公里
          </AppText>
        </View>
      </Card>
      {proposal.validation.blockers.length ? (
        <Notice text={proposal.validation.blockers.join("；")} danger />
      ) : (
        <Notice
          text={
            ready
              ? "校验通过。确认后将创建新的正式计划版本。"
              : "保存前需要先完成服务端校验。"
          }
        />
      )}
      {feedback ? (
        <AppText variant="caption" style={styles.error}>
          {feedback}
        </AppText>
      ) : null}
      <View style={styles.bottomButtons}>
        <Button variant="secondary" onPress={onBack}>
          继续编辑
        </Button>
        <Button loading={busy} onPress={ready ? onApply : onValidate}>
          {ready ? "确认并保存" : "校验课程"}
        </Button>
      </View>
    </View>
  );
}
