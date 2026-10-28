import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import {
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";

import { Screen } from "../../../components/layout/Screen";
import { AppText, Button, Card, Input, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import {
  getProfile,
  patchProfile,
  ProfileApiError,
} from "../services/profile.api";
import type { ProfileResponse } from "@ridepilot/contracts";
import { FtpMeasurementCard } from "../components/FtpMeasurementCard";
import { colors } from "../../../theme/colors";

type EditableProfile = Pick<
  ProfileResponse,
  | "displayName"
  | "gender"
  | "ageBand"
  | "heightCm"
  | "weightKg"
  | "experienceLevel"
  | "trainingPurpose"
  | "viewPreference"
  | "timezone"
>;

const emptyProfile: EditableProfile = {
  displayName: "",
  gender: null,
  ageBand: null,
  heightCm: null,
  weightKg: null,
  experienceLevel: null,
  trainingPurpose: null,
  viewPreference: "SIMPLE",
  timezone: "UTC",
};

const m01Colors = {
  text: colors.textPrimary,
  sub: colors.textSecondary,
  muted: colors.textMuted,
  gold: colors.brand,
  green: colors.positive,
  orange: colors.warning,
} as const;

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 112,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  flushCard: {
    padding: 0,
  },
  profileMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 17,
    paddingTop: 18,
    paddingBottom: 17,
  },
  avatar: {
    height: 58,
    width: 58,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.brandSubtle,
    borderRadius: 29,
    backgroundColor: colors.surface2,
  },
  profileStats: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingHorizontal: 17,
    paddingTop: 13,
    paddingBottom: 14,
  },
  secondStat: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.divider,
    paddingLeft: 15,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 2,
    marginTop: 25,
    marginBottom: 12,
  },
  eyebrow: {
    color: m01Colors.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    lineHeight: 14,
  },
  pageTitle: {
    color: m01Colors.text,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1.1,
    lineHeight: 38,
    marginTop: 4,
  },
  statusText: {
    color: m01Colors.green,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  profileName: {
    color: m01Colors.text,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.5,
    lineHeight: 24,
    marginTop: 5,
  },
  profileMeta: {
    color: m01Colors.sub,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  statLabel: {
    color: m01Colors.muted,
    fontSize: 11,
    lineHeight: 14,
  },
  statValue: {
    color: m01Colors.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 4,
  },
  sectionTitle: {
    color: m01Colors.text,
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  sectionHint: {
    color: m01Colors.muted,
    fontSize: 11,
    lineHeight: 14,
  },
  infoTitle: {
    color: m01Colors.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  infoBody: {
    color: m01Colors.sub,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  row: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowTitle: {
    color: m01Colors.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  rowDescription: {
    color: m01Colors.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  rowValue: {
    color: m01Colors.sub,
    fontSize: 11,
    lineHeight: 14,
    maxWidth: 90,
    flexShrink: 0,
    textAlign: "right",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
});

function editableFromProfile(profile: ProfileResponse): EditableProfile {
  return {
    displayName: profile.displayName === "骑行者" ? "" : profile.displayName,
    gender: profile.gender,
    ageBand: profile.ageBand,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    experienceLevel: profile.experienceLevel,
    trainingPurpose: profile.trainingPurpose,
    viewPreference: profile.viewPreference,
    timezone: profile.timezone,
  };
}

function displayGender(value: ProfileResponse["gender"]): string {
  const labels = {
    MALE: "男性",
    FEMALE: "女性",
    OTHER: "其他",
    PREFER_NOT_TO_SAY: "不愿透露",
  };
  return value ? labels[value] : "未填写";
}

function displayExperience(value: ProfileResponse["experienceLevel"]): string {
  const labels = {
    BEGINNER: "入门",
    INTERMEDIATE: "有训练经验",
    ADVANCED: "进阶",
  };
  return value ? labels[value] : "未填写";
}

export function ProfileScreen() {
  const { logout, session } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [draft, setDraft] = useState<EditableProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    let active = true;
    void getProfile(session.accessToken)
      .then((next) => {
        if (!active) return;
        setProfile(next);
        setDraft(editableFromProfile(next));
        setError(null);
        setLoading(false);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "无法加载个人资料");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const save = async () => {
    if (!session?.accessToken || !profile) return;
    setSaving(true);
    setError(null);
    try {
      const next = await patchProfile(session.accessToken, {
        displayName: draft.displayName.trim() || null,
        gender: draft.gender,
        ageBand: draft.ageBand?.trim() || null,
        heightCm: draft.heightCm,
        weightKg: draft.weightKg,
        experienceLevel: draft.experienceLevel,
        trainingPurpose: draft.trainingPurpose?.trim() || null,
        viewPreference: draft.viewPreference,
        timezone: draft.timezone,
        expectedVersion: profile.version,
      });
      setProfile(next);
      setDraft(editableFromProfile(next));
      setEditorOpen(false);
    } catch (cause) {
      if (cause instanceof ProfileApiError && cause.status === 409) {
        setError("资料已在其他设备更新，请重新读取后再保存");
      } else {
        setError(cause instanceof Error ? cause.message : "保存个人资料失败");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      scrollProps={{
        contentContainerStyle: styles.content,
      }}
    >
      <View style={styles.pageHeader}>
        <View>
          <AppText style={styles.eyebrow}>个人档案与训练偏好</AppText>
          <AppText style={styles.pageTitle}>我的</AppText>
        </View>
        <View className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface">
          <Settings color={m01Colors.sub} size={20} strokeWidth={1.7} />
        </View>
      </View>

      {loading ? <Spinner accessibilityLabel="正在加载个人资料" /> : null}
      {error ? (
        <AppText variant="caption" className="mb-3 text-warning">
          {error}
        </AppText>
      ) : null}
      {profile ? (
        <>
          <Card
            className="overflow-hidden rounded-[20px] p-0"
            style={styles.flushCard}
          >
            <View style={styles.profileMain}>
              <View style={styles.avatar}>
                <CircleUserRound
                  color={m01Colors.gold}
                  size={27}
                  strokeWidth={1.6}
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-positive" />
                  <AppText style={styles.statusText}>档案已建立</AppText>
                </View>
                <AppText style={styles.profileName}>
                  {profile.displayName}
                </AppText>
                <AppText style={styles.profileMeta}>
                  手机号 {profile.phoneMasked}
                </AppText>
              </View>
              <ChevronRight color={m01Colors.muted} size={21} />
            </View>
            <View style={styles.profileStats}>
              <View className="flex-1">
                <AppText style={styles.statLabel}>视图偏好</AppText>
                <AppText style={styles.statValue}>
                  {profile.viewPreference === "PROFESSIONAL"
                    ? "专业视图"
                    : "简洁视图"}
                </AppText>
              </View>
              <View className="flex-1" style={styles.secondStat}>
                <AppText style={styles.statLabel}>档案版本</AppText>
                <AppText style={styles.statValue}>v{profile.version}</AppText>
              </View>
            </View>
          </Card>
          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>我的资料</AppText>
          </View>
          <Card
            className="overflow-hidden rounded-[18px] p-0"
            style={styles.flushCard}
          >
            <ProfileRow
              icon={UserRound}
              iconColor={m01Colors.gold}
              title="账户与页面昵称"
              description="昵称仅用于展示"
              value={profile.displayName}
              onPress={() => setEditorOpen(true)}
            />
            <ProfileRow
              icon={CircleUserRound}
              iconColor={m01Colors.green}
              title="身体与能力"
              description="年龄段、性别、身高、体重与训练经验"
              value={`${displayExperience(profile.experienceLevel)} · ${displayGender(profile.gender)}`}
              onPress={() => setEditorOpen(true)}
            />
            <ProfileRow
              icon={CalendarDays}
              iconColor={m01Colors.orange}
              title="课程显示偏好"
              description="简洁 / 专业视图共用训练数据"
              value={
                profile.viewPreference === "PROFESSIONAL"
                  ? "专业视图"
                  : "简洁视图"
              }
              onPress={() => setEditorOpen(true)}
              last
            />
          </Card>
          {session?.accessToken ? (
            <FtpMeasurementCard token={session.accessToken} />
          ) : null}

          <View style={styles.section}>
            <AppText style={styles.sectionTitle}>数据与隐私</AppText>
          </View>
          <View>
            <Card style={styles.infoCard}>
              <ShieldCheck
                color={m01Colors.muted}
                size={21}
                strokeWidth={1.7}
              />
              <View className="flex-1">
                <AppText style={styles.infoTitle}>资料服务状态</AppText>
                <AppText style={styles.infoBody}>
                  当前仅保存完成个人档案所需的信息；数据导出、删除和设备同步将在对应服务开放后提供。
                </AppText>
              </View>
            </Card>
          </View>
          <Button
            variant="secondary"
            className="mt-5"
            onPress={async () => {
              try {
                await logout();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "退出失败，请重试",
                );
              }
            }}
          >
            退出登录
          </Button>
        </>
      ) : null}

      <ProfileEditor
        visible={editorOpen}
        draft={draft}
        saving={saving}
        onChange={setDraft}
        onClose={() => {
          if (!saving) {
            setDraft(profile ? editableFromProfile(profile) : emptyProfile);
            setEditorOpen(false);
          }
        }}
        onSave={() => void save()}
      />
    </Screen>
  );
}

function ProfileRow({
  icon: Icon,
  iconColor,
  title,
  description,
  value,
  onPress,
  last = false,
}: {
  icon: typeof UserRound;
  iconColor: string;
  title: string;
  description: string;
  value: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.row, !last && styles.rowDivider]}
      onPress={onPress}
    >
      <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-surface-2">
        <Icon color={iconColor} size={19} strokeWidth={1.7} />
      </View>
      <View className="flex-1">
        <AppText style={styles.rowTitle}>{title}</AppText>
        <AppText style={styles.rowDescription}>{description}</AppText>
      </View>
      <AppText numberOfLines={1} style={styles.rowValue}>
        {value}
      </AppText>
      <ChevronRight color={m01Colors.muted} size={20} />
    </Pressable>
  );
}

function ProfileEditor({
  visible,
  draft,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  visible: boolean;
  draft: EditableProfile;
  saving: boolean;
  onChange: (draft: EditableProfile) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Screen scroll scrollProps={{ contentContainerClassName: "px-4 pb-10" }}>
        <View className="mb-5 flex-row items-center justify-between">
          <AppText variant="section">编辑个人资料</AppText>
          <Pressable accessibilityRole="button" onPress={onClose}>
            <AppText className="text-brand">取消</AppText>
          </Pressable>
        </View>
        <AppText variant="label" muted>
          页面昵称
        </AppText>
        <Input
          className="mt-2"
          value={draft.displayName}
          placeholder="未填写时显示骑行者"
          onChangeText={(displayName) => onChange({ ...draft, displayName })}
        />
        <AppText variant="label" className="mt-5" muted>
          性别
        </AppText>
        <OptionGroup
          options={[
            [null, "未填写"],
            ["MALE", "男性"],
            ["FEMALE", "女性"],
            ["OTHER", "其他"],
            ["PREFER_NOT_TO_SAY", "不愿透露"],
          ]}
          value={draft.gender}
          onChange={(gender) =>
            onChange({ ...draft, gender: gender as EditableProfile["gender"] })
          }
        />
        <AppText variant="label" className="mt-5" muted>
          年龄段
        </AppText>
        <Input
          className="mt-2"
          value={draft.ageBand ?? ""}
          placeholder="例如：30-39"
          onChangeText={(ageBand) => onChange({ ...draft, ageBand })}
        />
        <View className="mt-5 flex-row gap-3">
          <View className="flex-1">
            <AppText variant="label" muted>
              身高（cm）
            </AppText>
            <Input
              className="mt-2"
              keyboardType="decimal-pad"
              value={draft.heightCm?.toString() ?? ""}
              placeholder="选填"
              onChangeText={(value) =>
                onChange({ ...draft, heightCm: value ? Number(value) : null })
              }
            />
          </View>
          <View className="flex-1">
            <AppText variant="label" muted>
              体重（kg）
            </AppText>
            <Input
              className="mt-2"
              keyboardType="decimal-pad"
              value={draft.weightKg?.toString() ?? ""}
              placeholder="选填"
              onChangeText={(value) =>
                onChange({ ...draft, weightKg: value ? Number(value) : null })
              }
            />
          </View>
        </View>
        <AppText variant="label" className="mt-5" muted>
          训练经验
        </AppText>
        <OptionGroup
          options={[
            ["BEGINNER", "入门"],
            ["INTERMEDIATE", "有训练经验"],
            ["ADVANCED", "进阶"],
          ]}
          value={draft.experienceLevel}
          onChange={(experienceLevel) =>
            onChange({
              ...draft,
              experienceLevel:
                experienceLevel as EditableProfile["experienceLevel"],
            })
          }
        />
        <AppText variant="label" className="mt-5" muted>
          训练意向
        </AppText>
        <Input
          className="mt-2"
          value={draft.trainingPurpose ?? ""}
          placeholder="例如：提升长距离耐力"
          onChangeText={(trainingPurpose) =>
            onChange({ ...draft, trainingPurpose })
          }
        />
        <AppText variant="label" className="mt-5" muted>
          训练时区
        </AppText>
        <Input
          className="mt-2"
          value={draft.timezone}
          placeholder="例如 Asia/Shanghai"
          autoCapitalize="none"
          onChangeText={(timezone) => onChange({ ...draft, timezone })}
        />
        <AppText variant="caption" muted className="mt-1">
          训练日期会按这个时区解释。
        </AppText>
        <AppText variant="label" className="mt-5" muted>
          课程显示偏好
        </AppText>
        <OptionGroup
          options={[
            ["SIMPLE", "简洁视图"],
            ["PROFESSIONAL", "专业视图"],
          ]}
          value={draft.viewPreference}
          onChange={(viewPreference) =>
            onChange({
              ...draft,
              viewPreference:
                viewPreference as EditableProfile["viewPreference"],
            })
          }
        />
        <Button
          className="w-full"
          size="lg"
          style={{ marginTop: 20 }}
          loading={saving}
          onPress={onSave}
        >
          保存资料
        </Button>
      </Screen>
    </Modal>
  );
}

function OptionGroup({
  options,
  value,
  onChange,
}: {
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
          accessibilityState={{ selected: value === option }}
          className={`rounded-xl border px-3 py-2.5 ${value === option ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
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
