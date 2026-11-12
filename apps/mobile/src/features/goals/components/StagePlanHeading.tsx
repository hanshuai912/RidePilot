import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { CircleAlert } from "lucide-react-native";
import { AppText, Button, Dialog } from "../../../components/ui";
import { colors } from "../../../theme/colors";

export function StagePlanHeading({
  summary,
  action,
}: {
  summary?: string;
  action?: {
    label: string;
    expanded: boolean;
    disabled: boolean;
    onPress: () => void;
  };
}) {
  const [open, setOpen] = useState(false);
  const description = summary?.trim();
  return (
    <>
      <View className="flex-row flex-wrap items-center justify-between gap-x-2">
        <View className="flex-row items-center">
          <AppText variant="section">阶段安排</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看阶段安排说明"
            accessibilityHint="打开阶段规划说明弹窗"
            className="h-11 w-11 items-center justify-center active:opacity-70"
            onPress={() => setOpen(true)}
          >
            <CircleAlert
              color={colors.textSecondary}
              size={17}
              strokeWidth={1.8}
            />
          </Pressable>
        </View>
        {action ? (
          <Button
            variant="ghost"
            size="sm"
            accessibilityLabel={action.expanded ? "收起阶段规划" : action.label}
            accessibilityState={{
              expanded: action.expanded,
              disabled: action.disabled,
            }}
            disabled={action.disabled}
            onPress={action.onPress}
          >
            {action.expanded ? "收起" : action.label}
          </Button>
        ) : null}
      </View>
      {open ? (
        <Dialog
          visible
          title="阶段安排说明"
          onClose={() => setOpen(false)}
          closeLabel="知道了"
        >
          <ScrollView
            className="mt-3 max-h-80"
            contentContainerClassName="pb-1"
          >
            <AppText className="text-secondary">
              阶段和课程由全部进行中目标共同规划，以主目标决定训练重点，兼顾次目标。测试只提供建议时间，不要求录入结果或完成复评。资料变化后，App
              会提示你是否重新生成课程。
            </AppText>
            {description ? (
              <AppText className="mt-3 text-secondary">{description}</AppText>
            ) : null}
          </ScrollView>
        </Dialog>
      ) : null}
    </>
  );
}
