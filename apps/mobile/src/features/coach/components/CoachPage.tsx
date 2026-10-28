import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Screen } from "../../../components/layout/Screen";
import { AppText, Button } from "../../../components/ui";

export function CoachPage({
  eyebrow,
  title,
  description,
  children,
  primary,
  onPrimary,
  secondary,
  onSecondary,
  busy = false,
  error,
  progressStep,
  progressTotal = 4,
  progressLabel = "计划设置",
  onBack,
  compactHeader = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  primary?: string;
  onPrimary?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  busy?: boolean;
  error?: string | null;
  progressStep?: number;
  progressTotal?: number;
  progressLabel?: string;
  onBack?: () => void;
  compactHeader?: boolean;
}) {
  const progressWidth = progressStep
    ? (`${Math.min(progressStep / progressTotal, 1) * 100}%` as `${number}%`)
    : ("0%" as `${number}%`);

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {onBack || compactHeader ? (
          <View className="mt-2 min-h-11 flex-row items-center gap-2">
            {onBack ? (
              <Pressable
                accessibilityLabel="返回上一步"
                accessibilityRole="button"
                className="h-11 w-11 items-center justify-center rounded-xl"
                onPress={onBack}
              >
                <AppText className="text-[30px] leading-[30px] text-primary">
                  ‹
                </AppText>
              </Pressable>
            ) : null}
            <View className="flex-1">
              <AppText variant="label" className="text-muted">
                {eyebrow}
              </AppText>
              <AppText variant="card" className="mt-1">
                {title}
              </AppText>
            </View>
          </View>
        ) : (
          <>
            <AppText variant="label" className="mt-3 text-brand">
              {eyebrow}
            </AppText>
            <AppText variant="display" className="mt-2">
              {title}
            </AppText>
          </>
        )}
        {progressStep ? (
          <View className="mt-5">
            <View className="flex-row items-center justify-between">
              <AppText variant="label" className="text-muted">
                {progressLabel}
              </AppText>
              <AppText variant="label" className="text-brand">
                {progressStep}/{progressTotal}
              </AppText>
            </View>
            <View className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
              <View
                className="h-full rounded-full bg-brand"
                style={{ width: progressWidth }}
              />
            </View>
          </View>
        ) : null}
        {description ? (
          <AppText variant="body" className="mt-3 text-secondary">
            {description}
          </AppText>
        ) : null}
        <View className="mt-6 gap-3">{children}</View>
      </ScrollView>
      {primary || secondary || error ? (
        <View className="border-t border-divider bg-background px-5 pb-5 pt-3">
          {error ? (
            <AppText variant="caption" className="mb-2 text-negative">
              {error}
            </AppText>
          ) : null}
          <View className={primary && secondary ? "flex-row gap-2" : ""}>
            {primary ? (
              <Button
                size="lg"
                className={primary && secondary ? "flex-1" : undefined}
                loading={busy}
                onPress={onPrimary}
              >
                {primary}
              </Button>
            ) : null}
            {secondary ? (
              <Button
                variant="secondary"
                size="lg"
                className={primary && secondary ? "mt-0 flex-1" : "mt-2"}
                onPress={onSecondary}
                disabled={busy}
              >
                {secondary}
              </Button>
            ) : null}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

export function ChoicePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`min-h-12 justify-center rounded-xl border px-4 py-3 ${selected ? "border-brand bg-brand-subtle" : "border-border bg-surface-2"}`}
      onPress={onPress}
    >
      <AppText className={selected ? "text-brand" : "text-primary"}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function AiMark() {
  return (
    <View className="h-[66px] w-[66px] items-center justify-center rounded-[19px] border border-[#6D6547] bg-[#302F24]">
      <AppText variant="card" className="text-brand">
        AI
      </AppText>
    </View>
  );
}

export function InfoStrip({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row gap-2 rounded-xl border border-[#3F493F] bg-[#242B25] p-3">
      <AppText className="text-positive">✦</AppText>
      <AppText variant="caption" className="flex-1 text-secondary">
        {children}
      </AppText>
    </View>
  );
}

export function StepItem({
  number,
  children,
}: {
  number: number;
  children: ReactNode;
}) {
  return (
    <View className="min-h-[55px] flex-row items-center gap-3 rounded-[13px] border border-border bg-surface-2 px-3 py-2.5">
      <View className="h-7 w-7 items-center justify-center rounded-[9px] bg-[#303228]">
        <AppText variant="label" className="text-brand">
          {number}
        </AppText>
      </View>
      <AppText variant="caption" className="flex-1 text-primary">
        {children}
      </AppText>
    </View>
  );
}
