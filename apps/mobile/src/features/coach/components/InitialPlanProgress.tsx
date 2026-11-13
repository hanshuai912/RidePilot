import { View } from "react-native";
import { AppText } from "../../../components/ui";

const steps = ["骑行基础", "训练目标", "时间安排", "饮食偏好"];

export function InitialPlanProgress({ step }: { step: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`计划设置，第 ${step} 步，共 4 步，${steps[step - 1]}`}
      className="mt-5 flex-row gap-2"
    >
      {steps.map((label, index) => (
        <View key={label} className="min-w-0 flex-1 gap-2">
          <View
            className={`h-1 rounded-full ${index < step ? "bg-brand" : "bg-surface-2"}`}
          />
          <AppText
            variant="label"
            className={index === step - 1 ? "text-brand" : "text-muted"}
          >
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
