import { Pressable, StyleSheet, View } from "react-native";
import { Circle, CircleDot } from "lucide-react-native";
import {
  heartRateMethodLabels,
  heartRateInputBounds,
  type HeartRateMethod,
} from "@ridepilot/contracts";
import { AppText, Card, Input } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { spacing } from "../../../theme/spacing";
import { radii } from "../../../theme/radius";
import {
  heartRateFieldLabels,
  type HeartRateDraft,
  type HeartRateField,
} from "../model/heart-rate-draft";

export function HeartRateForm({
  draft,
  update,
  saving,
  errors,
}: {
  draft: HeartRateDraft;
  update: (patch: Partial<HeartRateDraft>) => void;
  saving: boolean;
  errors: string[];
}) {
  const fields: HeartRateField[] =
    draft.method === "LTHR"
      ? ["lactateThresholdHeartRate"]
      : draft.method === "RESERVE"
        ? ["maxHeartRate", "restingHeartRate"]
        : ["maxHeartRate"];
  return (
    <>
      <AppText variant="card">区间类型</AppText>
      <Card
        style={styles.methods}
        accessibilityRole="radiogroup"
        accessibilityLabel="心率区间类型"
      >
        {(Object.keys(heartRateMethodLabels) as HeartRateMethod[]).map(
          (method) => {
            const selected = draft.method === method;
            const Icon = selected ? CircleDot : Circle;
            return (
              <Pressable
                key={method}
                accessibilityRole="radio"
                accessibilityLabel={heartRateMethodLabels[method]}
                accessibilityState={{ checked: selected, disabled: saving }}
                disabled={saving}
                onPress={() => update({ method })}
                style={[styles.method, selected && styles.selected]}
              >
                <Icon
                  size={20}
                  color={selected ? colors.brand : colors.textMuted}
                />
                <AppText
                  className={selected ? "text-brand" : undefined}
                  style={[styles.methodLabel, selected && styles.selectedText]}
                >
                  {heartRateMethodLabels[method]}
                </AppText>
                <AppText variant="caption" muted>
                  {method === "LTHR" ? "7 区" : "5 区"}
                </AppText>
              </Pressable>
            );
          },
        )}
      </Card>
      <Card style={styles.inputs}>
        <AppText variant="card">心率设置</AppText>
        <AppText variant="caption" muted style={styles.caption}>
          填写已测得的心率，切换类型会保留已填数值。
        </AppText>
        {fields.map((field) => (
          <View key={field} style={styles.field}>
            <AppText variant="label" muted>
              {heartRateFieldLabels[field]}（bpm）
            </AppText>
            <Input
              className="mt-2"
              accessibilityLabel={heartRateFieldLabels[field]}
              keyboardType="number-pad"
              placeholder={`请输入${heartRateFieldLabels[field]}`}
              value={draft[field]}
              onChangeText={(value) => update({ [field]: value })}
              editable={!saving}
            />
            <AppText variant="caption" muted className="mt-2">
              {heartRateInputBounds[field].min}–
              {heartRateInputBounds[field].max} bpm
            </AppText>
          </View>
        ))}
        {errors.map((error) => (
          <AppText
            key={error}
            accessibilityRole="alert"
            variant="caption"
            className="mt-2 text-warning"
          >
            {error}
          </AppText>
        ))}
      </Card>
    </>
  );
}
const styles = StyleSheet.create({
  methods: { marginTop: spacing.md, padding: spacing.sm, gap: spacing.xs },
  method: {
    minHeight: 52,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.md,
  },
  selected: { backgroundColor: colors.brandSubtle },
  methodLabel: { flex: 1 },
  selectedText: { color: colors.brand },
  inputs: { marginTop: spacing.xl },
  caption: { marginTop: spacing.sm },
  field: { marginTop: spacing.xl },
});
