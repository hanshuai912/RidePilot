import { View } from "react-native";
import { Zap } from "lucide-react-native";
import type { ProfileResponse } from "@ridepilot/contracts";
import { AppText, Badge, Button, Card } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import type {
  Experience,
  TrainingStatusProps,
} from "../model/initial-plan-types";
import { InitialPlanTrainingStatus } from "./InitialPlanTrainingStatus";
import { SetupChoiceRow } from "./SetupChoiceRow";
import { SetupSection } from "./SetupSection";

type BasicsStepProps = TrainingStatusProps & {
  experience: Experience;
  setExperience: (value: Experience) => void;
  ftpWatts: number | null;
  profile: ProfileResponse;
  onFtp: () => void;
  onProfile?: () => void;
  showTrainingStatus?: boolean;
};

export function BasicsStep({
  experience,
  setExperience,
  ftpWatts,
  profile,
  onFtp,
  onProfile = onFtp,
  showTrainingStatus = true,
  disabled = false,
  ...status
}: BasicsStepProps) {
  return (
    <>
      <Card className="gap-4 p-5">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <Zap size={18} color={colors.brand} />
            <AppText variant="card">当前 FTP</AppText>
          </View>
          <Badge variant={ftpWatts ? "neutral" : "warning"}>
            {ftpWatts ? "已填写" : "待补充"}
          </Badge>
        </View>
        <View className="flex-row flex-wrap items-end justify-between gap-2">
          <View className="min-w-0 flex-row items-baseline gap-2">
            <AppText variant="display" className="tabular-nums text-brand">
              {ftpWatts ?? "—"}
            </AppText>
            <AppText className="text-secondary">W</AppText>
          </View>
          <Button variant="ghost" size="sm" disabled={disabled} onPress={onFtp}>
            {ftpWatts ? "更新 FTP" : "补充 FTP"}
          </Button>
        </View>
        <AppText variant="caption" className="text-secondary">
          训练功率以实测 FTP 为依据，可手动填写可信的测量结果。
        </AppText>
      </Card>
      <SetupSection
        title="你的骑行经验"
        description="用于选择训练起点，不代表能力评级。"
      >
        <View className="gap-2">
          {(
            [
              ["BEGINNER", "刚开始骑行", "先适应节奏，逐步建立骑行习惯"],
              ["INTERMEDIATE", "规律骑行", "已有骑行习惯，希望更有计划"],
              ["ADVANCED", "有系统训练", "有训练经验，关注专项能力提升"],
            ] as const
          ).map(([value, label, description]) => (
            <SetupChoiceRow
              key={value}
              label={label}
              description={description}
              selected={experience === value}
              onPress={() => setExperience(value)}
              disabled={disabled}
            />
          ))}
        </View>
      </SetupSection>
      <SetupSection title="身体资料" description="沿用个人资料中的最新信息。">
        <Card className="gap-3 p-4">
          <View className="flex-row gap-4">
            <View className="min-w-0 flex-1 gap-1">
              <AppText variant="caption" className="text-secondary">
                身高
              </AppText>
              <AppText variant="card">
                {profile.heightCm ? `${profile.heightCm} cm` : "未填写"}
              </AppText>
            </View>
            <View className="min-w-0 flex-1 gap-1 border-l border-divider pl-4">
              <AppText variant="caption" className="text-secondary">
                体重
              </AppText>
              <AppText variant="card">
                {profile.weightKg ? `${profile.weightKg} kg` : "未填写"}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" className="text-secondary">
            时区：{profile.timezone}
          </AppText>
          {!profile.weightKg ? (
            <Button variant="secondary" disabled={disabled} onPress={onProfile}>
              到个人资料补充体重
            </Button>
          ) : null}
        </Card>
      </SetupSection>
      {showTrainingStatus ? (
        <InitialPlanTrainingStatus {...status} disabled={disabled} />
      ) : null}
    </>
  );
}
