import { coachApi } from "../services/coach.api";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { CheckCheck } from "lucide-react-native";
import type { CoachSuggestion, CoachSuggestions } from "@ridepilot/contracts";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import {
  useCoachResource,
  type CoachResource,
} from "../hooks/useCoachResource";
import { coachCenterApi } from "../services/coach-center.api";
import { colors } from "../../../theme/colors";
import { selectHomeSuggestion } from "../model/coach-home";
import { CoachSuggestionSpotlight } from "./CoachSuggestionSpotlight";

const shouldPoll = (data: CoachSuggestions) =>
  data.pending.some((p) => p.kind === "GENERATION");
const statusLabels: Record<string, string> = {
  DRAFT: "待预览",
  READY: "待确认",
  BLOCKED: "需调整",
  PENDING_VALIDATION: "待校验",
  QUEUED: "排队中",
  RUNNING: "生成中",
  FAILED: "生成失败",
  CANCELLED: "已取消",
  APPLIED: "已应用",
  REJECTED: "已放弃",
  EXPIRED: "已失效",
  SUPERSEDED: "已被新草稿替代",
  ACTIVE: "已确认",
  ARCHIVED: "已归档",
};

export function CoachSuggestionsPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const router = useRouter();
  const load = useCallback(
    () =>
      token
        ? coachCenterApi.suggestions(token)
        : Promise.reject(new Error("请先登录")),
    [token],
  );
  const resource = useCoachResource(load, shouldPoll);
  const [dismissId, setDismissId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const open = (item: CoachSuggestion) => openSuggestion(router, item);
  const dismiss = async (item: CoachSuggestion) => {
    if (!token || pending.current || item.kind === "GENERATION") return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await coachCenterApi.dismiss(token, item.id, {
        kind: item.kind,
        expectedVersion: item.version,
      });
      setDismissId(null);
      resource.retry();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "放弃失败，请刷新重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const cancelGeneration = async (item: CoachSuggestion) => {
    if (!token || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await coachApi.cancelGeneration(token, item.id);
      resource.retry();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "取消失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  if (compact) return <CoachSuggestionSummary resource={resource} />;
  const render = (item: CoachSuggestion, canDismiss: boolean) => (
    <Card key={`${item.kind}-${item.id}`}>
      <View className="mb-3 flex-row items-center gap-2">
        <View className="rounded-full bg-surface-2 px-2.5 py-1">
          <AppText
            variant="label"
            className={
              item.status === "BLOCKED" || item.status === "FAILED"
                ? "text-warning"
                : "text-brand"
            }
          >
            {statusLabels[item.status] ?? item.status}
          </AppText>
        </View>
        {canDismiss && item.kind !== "GENERATION" ? (
          <AppText variant="caption" className="text-secondary">
            草稿 · 未应用
          </AppText>
        ) : null}
      </View>
      <AppText variant="card">{item.title}</AppText>
      <AppText variant="caption" muted className="mt-2">
        {item.summary}
      </AppText>
      {item.staleReason ? (
        <AppText variant="caption" className="mt-2 text-warning">
          {item.staleReason}
        </AppText>
      ) : null}
      {canDismiss && item.kind === "GENERATION" ? (
        <Button
          variant="secondary"
          loading={busy}
          onPress={() => void cancelGeneration(item)}
        >
          取消生成
        </Button>
      ) : null}
      {item.kind !== "GENERATION" ? (
        <Button
          variant="secondary"
          className="mt-3"
          disabled={busy}
          onPress={() => open(item)}
        >
          {canDismiss ? "继续预览建议" : "查看建议记录"}
        </Button>
      ) : null}
      {canDismiss && item.kind !== "GENERATION" ? (
        dismissId === item.id ? (
          <>
            <AppText className="mt-3">放弃这份建议？正式计划不受影响。</AppText>
            <Button loading={busy} onPress={() => void dismiss(item)}>
              确认放弃建议
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onPress={() => setDismissId(null)}
            >
              保留建议
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            disabled={busy}
            onPress={() => setDismissId(item.id)}
          >
            放弃建议
          </Button>
        )
      ) : null}
    </Card>
  );
  return (
    <View className="gap-3" testID="coach-all-suggestions">
      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-x-2">
        <AppText variant="section">
          待处理建议{resource.data ? ` · ${resource.data.pending.length}` : ""}
        </AppText>
      </View>
      {resource.loading ? (
        <Spinner accessibilityLabel="正在读取待处理建议" />
      ) : null}
      {resource.error || error ? (
        <>
          <AppText className="text-negative">{resource.error || error}</AppText>
          <Button variant="secondary" onPress={resource.retry}>
            刷新建议
          </Button>
        </>
      ) : null}
      {resource.data ? (
        <>
          {!resource.data.pending.length ? (
            <Card>
              <View className="flex-row items-center gap-3">
                <CheckCheck
                  color={colors.textSecondary}
                  size={22}
                  strokeWidth={1.8}
                />
                <View className="min-w-0 flex-1">
                  <AppText variant="body">暂无待处理建议</AppText>
                  <AppText variant="caption" className="mt-1 text-secondary">
                    需要调整时，选择快捷任务开始。
                  </AppText>
                </View>
              </View>
            </Card>
          ) : null}
          {resource.data.pending.map((i) => render(i, true))}
          <Button variant="ghost" disabled={busy} onPress={resource.retry}>
            刷新待处理建议
          </Button>
          <AppText variant="section">最近建议记录</AppText>
          {resource.data.recent.map((i) => render(i, false))}
          {!resource.data.recent.length ? (
            <AppText muted>暂无历史建议</AppText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function openSuggestion(
  router: ReturnType<typeof useRouter>,
  item: CoachSuggestion,
) {
  if (item.kind === "STAGE")
    router.push({
      pathname: "/goals/stage-preview",
      params: { proposalId: item.id, goalId: item.goalId ?? "" },
    });
  else if (item.kind !== "GENERATION")
    router.push({
      pathname: "/(tabs)/coach/suggestion",
      params: { id: item.id, kind: item.kind },
    });
}

export function CoachSuggestionSummary({
  resource,
}: {
  resource: CoachResource<CoachSuggestions>;
}) {
  const router = useRouter();

  if (resource.error)
    return (
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <AppText variant="body" className="text-negative">
          建议暂不可用：{resource.error}
        </AppText>
        <Button variant="ghost" size="sm" onPress={resource.retry}>
          刷新建议
        </Button>
      </View>
    );
  if (resource.loading)
    return <Spinner accessibilityLabel="正在读取待处理建议" />;
  const item = selectHomeSuggestion(resource.data?.pending ?? []);
  if (!item) return null;
  return (
    <CoachSuggestionSpotlight
      item={item}
      status={statusLabels[item.status] ?? item.status}
      count={resource.data?.pending.length ?? 0}
      onOpen={() => openSuggestion(router, item)}
      onAll={() => router.push("/(tabs)/coach/suggestions")}
    />
  );
}
