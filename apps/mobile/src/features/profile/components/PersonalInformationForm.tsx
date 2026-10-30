import { Pressable, View } from "react-native";
import { AppText, Input } from "../../../components/ui";
import { BirthDateField } from "./BirthDateField";
import type { ProfileDraft } from "../model/profile-draft";

export function PersonalInformationForm({
  draft,
  saving,
  onChange,
}: {
  draft: ProfileDraft;
  saving: boolean;
  onChange: (draft: ProfileDraft) => void;
}) {
  return (
    <View>
      <AppText variant="label" muted>
        页面昵称
      </AppText>
      <Input
        className="mt-2"
        accessibilityLabel="页面昵称"
        editable={!saving}
        value={draft.displayName}
        placeholder="未填写时显示骑行者"
        onChangeText={(displayName) => onChange({ ...draft, displayName })}
      />
      <AppText variant="label" className="mt-5" muted>
        性别
      </AppText>
      <OptionGroup
        disabled={saving}
        options={[
          [null, "未填写"],
          ["MALE", "男性"],
          ["FEMALE", "女性"],
          ["OTHER", "其他"],
          ["PREFER_NOT_TO_SAY", "不愿透露"],
        ]}
        value={draft.gender}
        onChange={(gender) =>
          onChange({ ...draft, gender: gender as ProfileDraft["gender"] })
        }
      />
      <AppText variant="label" className="mt-5" muted>
        出生日期
      </AppText>
      <BirthDateField
        value={draft.birthDate}
        disabled={saving}
        onChange={(birthDate) => onChange({ ...draft, birthDate })}
      />
      <View className="mt-5 flex-row gap-3">
        <View className="flex-1">
          <AppText variant="label" muted>
            身高（cm）
          </AppText>
          <Input
            className="mt-2"
            editable={!saving}
            keyboardType="decimal-pad"
            accessibilityLabel="身高（cm）"
            value={draft.heightCm}
            placeholder="选填"
            onChangeText={(value) => onChange({ ...draft, heightCm: value })}
          />
        </View>
        <View className="flex-1">
          <AppText variant="label" muted>
            体重（kg）
          </AppText>
          <Input
            className="mt-2"
            editable={!saving}
            keyboardType="decimal-pad"
            accessibilityLabel="体重（kg）"
            value={draft.weightKg}
            placeholder="选填"
            onChangeText={(value) => onChange({ ...draft, weightKg: value })}
          />
        </View>
      </View>
      <AppText variant="label" className="mt-5" muted>
        训练经验
      </AppText>
      <OptionGroup
        disabled={saving}
        options={[
          ["BEGINNER", "入门"],
          ["INTERMEDIATE", "有训练经验"],
          ["ADVANCED", "进阶"],
        ]}
        value={draft.experienceLevel}
        onChange={(experienceLevel) =>
          onChange({
            ...draft,
            experienceLevel: experienceLevel as ProfileDraft["experienceLevel"],
          })
        }
      />
    </View>
  );
}

function OptionGroup({
  disabled,
  options,
  value,
  onChange,
}: {
  disabled: boolean;
  options: [string | null, string][];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <View className="mt-2 flex-row flex-wrap gap-2">
      {options.map(([option, label]) => (
        <Pressable
          key={label}
          accessibilityRole="radio"
          disabled={disabled}
          accessibilityState={{ checked: value === option, disabled }}
          className={`min-h-[44px] items-center justify-center rounded-xl border px-3 py-2.5 ${value === option ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
          onPress={() => onChange(option)}
        >
          <AppText
            variant="label"
            className={value === option ? "text-brand" : "text-secondary"}
          >
            {label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
