import { TextInput, View } from "react-native";
import { WorkoutProfileChart } from "./WorkoutProfileChart";
import { moveSegment } from "../model/workout-edit";
import { AppText, Badge, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/tokens";
import type { Draft } from "../model/training";
import { dateLabel } from "../model/training";
import { WorkoutSegmentList, segmentTotals } from "./WorkoutSegmentList";
import { styles as shared } from "./training.styles";
import { editorStyles as styles } from "./workout-editor.styles";

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
  saveLabel = "保存当天课程",
}: {
  saveLabel?: string;
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
    <View style={styles.page} testID="workout-editor">
      <View style={styles.context}>
        <AppText variant="caption" muted>
          {dateLabel(draft.scheduledDate)}
          {draft.dayOrder ? ` · 第 ${draft.dayOrder} 节` : ""}
        </AppText>
        <Badge variant="brand">课程草稿</Badge>
      </View>
      <View style={styles.section} testID="workout-editor-information">
        <AppText variant="section">课程信息</AppText>
        <Card style={styles.fields}>
          <View style={styles.field}>
            <AppText variant="caption" muted>
              课程名称（选填）
            </AppText>
            <TextInput
              accessibilityLabel="课程名称"
              value={draft.title ?? ""}
              editable={!busy}
              onChangeText={(title) => setDraft({ ...draft, title })}
              style={shared.input}
              placeholder="例如：爬坡专项"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.field}>
            <AppText variant="caption" muted>
              训练目的（选填）
            </AppText>
            <TextInput
              accessibilityLabel="训练目的"
              value={draft.purpose ?? ""}
              editable={!busy}
              onChangeText={(purpose) => setDraft({ ...draft, purpose })}
              style={shared.input}
              placeholder="例如：提升爬坡节奏"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </Card>
      </View>
      <View style={styles.section} testID="workout-editor-overview">
        <AppText variant="section">课程概览</AppText>
        <Card style={styles.overview}>
          <View style={styles.totals}>
            <View style={styles.metric}>
              <AppText variant="caption" muted>
                时间目标
              </AppText>
              <AppText variant="title" style={styles.value}>
                {totals.minutes ? `${totals.minutes} 分钟` : "—"}
              </AppText>
            </View>
            <View style={styles.metric}>
              <AppText variant="caption" muted>
                距离目标
              </AppText>
              <AppText variant="title" style={styles.value}>
                {totals.kilometers ? `${totals.kilometers} 公里` : "—"}
              </AppText>
            </View>
          </View>
          <WorkoutProfileChart segments={draft.segments} />
          {totals.kilometers > 0 ? (
            <AppText variant="caption" muted>
              时间与距离分别汇总，不相互折算。
            </AppText>
          ) : null}
        </Card>
      </View>
      <View style={styles.section} testID="workout-editor-segments">
        <AppText variant="section">
          训练动作 · {draft.segments.length} 个
        </AppText>
        <WorkoutSegmentList
          segments={draft.segments}
          onAdd={busy ? undefined : onAdd}
          onEdit={busy ? undefined : onEdit}
          onDelete={busy ? undefined : onDelete}
          onMove={
            busy
              ? undefined
              : (from, to) =>
                  setDraft({
                    ...draft,
                    segments: moveSegment(draft.segments, from, to),
                  })
          }
        />
        <AppText
          variant="caption"
          className={hasFtp ? "text-secondary" : "text-warning"}
        >
          {hasFtp
            ? "支持 %FTP 或绝对功率，每个动作需填写强度范围。"
            : "请先设置 FTP，再保存训练课程。"}
        </AppText>
      </View>
      {feedback ? (
        <AppText
          accessibilityRole="alert"
          variant="caption"
          style={shared.error}
        >
          {feedback}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button size="lg" loading={busy} onPress={onSave}>
          {saveLabel}
        </Button>
        <Button variant="ghost" disabled={busy} onPress={onBack}>
          返回
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
