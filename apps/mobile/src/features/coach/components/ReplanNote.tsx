import { Pressable, View } from "react-native";
import { AppText, Input } from "../../../components/ui";

const prompts = [
  { label: "时间不足", text: "可训练时间减少，希望缩短单次训练。" },
  { label: "强度偏高", text: "目前训练强度偏高，希望适当降低强度。" },
  { label: "训练环境变化", text: "训练环境有变化，希望调整骑行安排。" },
  { label: "调整训练重点", text: "希望调整训练重点，同时兼顾当前目标。" },
];
const maxLength = 240;

export function ReplanNote({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <View testID="replan-note-section">
      <View className="mb-3 flex-row items-center justify-between">
        <AppText variant="section">有哪些变化</AppText>
        <AppText variant="caption" className="text-secondary">
          选填
        </AppText>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {prompts.map(({ label, text }) => {
          const added = value.includes(text);
          const next = value ? `${value}\n${text}` : text;
          const unavailable = disabled || added || next.length > maxLength;
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint="将变化补充到说明中，可继续编辑"
              accessibilityState={{ selected: added, disabled: unavailable }}
              disabled={unavailable}
              onPress={() => onChange(next)}
              className={`min-h-11 min-w-[120px] flex-1 basis-[45%] items-center justify-center rounded-xl border px-3 py-3 ${added ? "border-brand bg-brand-subtle" : "border-border bg-surface"} ${disabled || (!added && unavailable) ? "opacity-50" : "active:opacity-70"}`}
            >
              <AppText
                variant="caption"
                className={added ? "text-brand" : "text-secondary"}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" className="mb-3 mt-2 text-secondary">
        点击补充到说明，也可以直接填写。
      </AppText>
      <Input
        accessibilityLabel="训练调整说明"
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        multiline
        textAlignVertical="top"
        maxLength={maxLength}
        className="py-4"
        style={{ minHeight: 120 }}
        placeholder="例如：这周工作比较忙，每次只能练 40 分钟，希望保留耐力训练。"
      />
      <AppText variant="caption" className="mt-2 text-right text-secondary">
        {value.length}/{maxLength}
      </AppText>
    </View>
  );
}
