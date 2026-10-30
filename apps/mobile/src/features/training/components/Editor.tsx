import { TextInput, View } from "react-native";
import { AppText, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/tokens";
import type { Draft } from "../model/training";
import { dateLabel } from "../model/training";
import { WorkoutSegmentList, segmentTotals } from "./WorkoutSegmentList";
import { Total, Notice } from "./TrainingParts";
import { styles } from "./training.styles";

export function Editor({
  draft,
  setDraft,
  hasFtp,
  feedback,
  busy,
  onBack,
  onAdd,
  onEdit,
  onDelete,
  onSave,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  hasFtp: boolean;
  feedback: string | null;
  busy?: boolean;
  onBack: () => void;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onSave: () => void;
}) {
  const totals = segmentTotals(draft.segments);
  return (
    <View style={styles.page}>
      <AppText variant="caption" muted>
        {dateLabel(draft.scheduledDate)} ·{" "}
        {draft.dayOrder ? `第 ${draft.dayOrder} 节 · ` : ""}草稿
      </AppText>
      <Card style={styles.card}>
        <AppText variant="label" muted>
          课程名称（选填）
        </AppText>
        <TextInput
          value={draft.title ?? ""}
          editable={!busy}
          onChangeText={(title) => setDraft({ ...draft, title })}
          style={styles.input}
          placeholder="例如：爬坡专项"
          placeholderTextColor={colors.textMuted}
        />
        <AppText variant="label" muted>
          训练目的（选填）
        </AppText>
        <TextInput
          value={draft.purpose ?? ""}
          editable={!busy}
          onChangeText={(purpose) => setDraft({ ...draft, purpose })}
          style={styles.input}
          placeholder="例如：提升爬坡节奏"
          placeholderTextColor={colors.textMuted}
        />
      </Card>
      <View style={styles.sectionRow}>
        <AppText variant="card">训练动作 · {draft.segments.length} 个</AppText>
        <AppText variant="label" style={styles.goldChip}>
          手动创建
        </AppText>
      </View>
      <WorkoutSegmentList
        segments={draft.segments}
        onAdd={busy ? undefined : onAdd}
        onEdit={busy ? undefined : onEdit}
        onDelete={busy ? undefined : onDelete}
      />
      <Card style={styles.card}>
        <View style={styles.totalGrid}>
          <Total
            label="时间目标"
            value={totals.minutes ? `${totals.minutes} 分钟` : "—"}
          />
          <Total
            label="距离目标"
            value={totals.kilometers ? `${totals.kilometers} 公里` : "—"}
          />
        </View>
      </Card>
      <Notice
        text={
          hasFtp
            ? "当前允许使用 %FTP 或绝对功率；每个动作都必须填写强度范围。"
            : "请先设置 FTP，再保存训练课程。"
        }
      />
      {feedback ? (
        <AppText variant="caption" style={styles.error}>
          {feedback}
        </AppText>
      ) : null}
      <View style={styles.bottomButtons}>
        <Button variant="secondary" disabled={busy} onPress={onBack}>
          返回
        </Button>
        <Button loading={busy} onPress={onSave}>
          保存当天课程
        </Button>
      </View>
      {busy ? (
        <AppText accessibilityLiveRegion="polite" variant="caption" muted>
          正在保存课程…
        </AppText>
      ) : null}
    </View>
  );
}
