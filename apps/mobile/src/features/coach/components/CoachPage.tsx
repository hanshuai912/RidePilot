import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { BottomActionBar } from "../../../components/layout/BottomActionBar";
import { AppHeader } from "../../../components/layout/AppHeader";
import { NavigationHeader } from "../../../components/layout/NavigationHeader";
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
  actionsInScroll = false,
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
  actionsInScroll?: boolean;
}) {
  const progressWidth = progressStep
    ? (`${Math.min(progressStep / progressTotal, 1) * 100}%` as `${number}%`)
    : ("0%" as `${number}%`);

  const actions =
    primary || secondary || error ? (
      <>
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
      </>
    ) : null;

  return (
    <Screen>
      {onBack ? (
        <NavigationHeader title={title} onBack={onBack} disabled={busy} />
      ) : null}
      <ScrollView
        testID="coach-page-content"
        className="flex-1"
        contentContainerClassName="px-5 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {!onBack ? (
          <AppHeader
            eyebrow={eyebrow}
            title={title}
            compact={compactHeader}
            className="mt-2"
          />
        ) : null}
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
        {actionsInScroll ? <View className="mt-5 pb-8">{actions}</View> : null}
      </ScrollView>
      {!actionsInScroll && actions ? (
        <BottomActionBar>{actions}</BottomActionBar>
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
    <View className="h-[66px] w-[66px] items-center justify-center rounded-[19px] border border-brand-subtle bg-brand-subtle">
      <AppText variant="card" className="text-brand">
        AI
      </AppText>
    </View>
  );
}

export function InfoStrip({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row gap-2 rounded-xl border border-positive/40 bg-surface-2 p-3">
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
      <View className="h-7 w-7 items-center justify-center rounded-[9px] bg-brand-subtle">
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
