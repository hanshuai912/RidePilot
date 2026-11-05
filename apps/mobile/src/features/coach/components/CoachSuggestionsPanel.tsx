import { useCallback, useRef, useState } from "react";
import { useRouter } from "expo-router";
import type { CoachSuggestion, CoachSuggestions } from "@ridepilot/contracts";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { useCoachResource } from "../hooks/useCoachResource";
import { coachCenterApi } from "../services/coach-center.api";

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
  const open = (item: CoachSuggestion) => {
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
  };
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
  const render = (item: CoachSuggestion, canDismiss: boolean) => (
    <Card key={`${item.kind}-${item.id}`}>
      <AppText variant="card">
        {item.title} · {statusLabels[item.status] ?? item.status}
      </AppText>
      <AppText variant="caption" muted className="mt-2">
        {item.summary}
      </AppText>
      {item.staleReason ? (
        <AppText variant="caption" className="mt-2 text-warning">
          {item.staleReason}
        </AppText>
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
      {!compact && canDismiss && item.kind !== "GENERATION" ? (
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
    <>
      <AppText variant="section">
        待处理建议{resource.data ? ` · ${resource.data.pending.length}` : ""}
      </AppText>
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
              <AppText muted>
                暂无待处理建议。需要变化时，可主动选择下方快捷操作。
              </AppText>
            </Card>
          ) : null}
          {(compact
            ? resource.data.pending.slice(0, 3)
            : resource.data.pending
          ).map((i) => render(i, true))}
          {compact ? (
            <Button
              variant="secondary"
              onPress={() => router.push("/(tabs)/coach/suggestions")}
            >
              查看全部建议与历史
            </Button>
          ) : (
            <>
              <Button variant="ghost" disabled={busy} onPress={resource.retry}>
                刷新待处理建议
              </Button>
              <AppText variant="section">最近建议记录</AppText>
              {resource.data.recent.map((i) => render(i, false))}
              {!resource.data.recent.length ? (
                <AppText muted>暂无历史建议</AppText>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </>
  );
}
