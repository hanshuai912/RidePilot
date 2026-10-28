import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { AppText } from "../../../components/ui";

export function GenerationProgress({
  status,
  error,
}: {
  status: "QUEUED" | "RUNNING" | "FAILED";
  error: string | null;
}) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (status === "FAILED") return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, status]);

  const copy =
    status === "QUEUED"
      ? "请求已提交，正在等待生成"
      : status === "RUNNING"
        ? "正在生成并校验训练草稿"
        : "生成失败，正式计划没有变化";

  return (
    <View className="items-center pt-12">
      <Animated.View
        className="h-24 w-24 items-center justify-center rounded-full border border-brand bg-brand-subtle"
        style={{
          opacity:
            status === "FAILED"
              ? 1
              : pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                }),
          transform: [
            {
              scale:
                status === "FAILED"
                  ? 1
                  : pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.88, 1.08],
                    }),
            },
          ],
        }}
      >
        <AppText variant="display" className="text-brand">
          AI
        </AppText>
      </Animated.View>
      <AppText
        variant="section"
        className="mt-7 text-center"
        accessibilityLiveRegion="polite"
      >
        {copy}
      </AppText>
      <AppText variant="caption" muted className="mt-3 text-center">
        {status === "QUEUED"
          ? "任务状态：排队中"
          : status === "RUNNING"
            ? "任务状态：生成与规则校验中"
            : `任务状态：失败${error ? ` · ${error}` : ""}`}
      </AppText>
      <View className="mt-8 w-full">
        <View className="h-1 overflow-hidden rounded-full bg-surface-2">
          <View
            className={`h-full rounded-full bg-brand ${status === "QUEUED" ? "w-1/3" : status === "RUNNING" ? "w-2/3" : "w-full"}`}
          />
        </View>
        <View className="mt-4 rounded-[15px] border border-border bg-surface p-4">
          <AppText className="text-positive">
            ✓ 读取基础、目标与可训练时间
          </AppText>
          <AppText className="mt-3 text-secondary">
            {status === "QUEUED" ? "○" : "✓"} 生成近期课程和阶段路线
          </AppText>
          <AppText className="mt-3 text-secondary">
            {status === "RUNNING" ? "○" : status === "FAILED" ? "!" : "✓"}{" "}
            校验训练结构，饮食信息暂不提交
          </AppText>
        </View>
      </View>
      <AppText variant="caption" muted className="mt-4 text-center">
        动画只表示任务仍在处理，不代表准确进度。确认应用前不会改动正式计划。
      </AppText>
    </View>
  );
}
