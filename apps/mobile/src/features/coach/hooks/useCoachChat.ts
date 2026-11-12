import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { CoachChatTurn } from "@ridepilot/contracts";
import { coachCenterApi } from "../services/coach-center.api";

function mergeTurns(old: CoachChatTurn[], incoming: CoachChatTurn[]) {
  const rows = new Map(old.map((turn) => [turn.clientMessageId, turn]));
  for (const turn of incoming) {
    const previous = rows.get(turn.clientMessageId);
    if (!previous || previous.version <= turn.version)
      rows.set(turn.clientMessageId, turn);
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

export function useCoachChat(token?: string) {
  const [turns, setTurns] = useState<CoachChatTurn[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const alive = useRef(true);
  const sendingRef = useRef(false);
  const moreRef = useRef(false);
  const loaded = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!loaded.current) setLoading(true);
    try {
      const history = await coachCenterApi.chatHistory(token);
      if (!alive.current) return;
      setTurns((old) => mergeTurns(old, history.turns));
      // A different device may have added more than one page while we were away.
      // Restart pagination at the latest page so no intervening history is skipped.
      setNextCursor(history.nextCursor);
      loaded.current = true;
      setLoadError(null);
      setSyncError(null);
    } catch (error) {
      if (alive.current) {
        const text =
          error instanceof Error ? error.message : "聊天记录读取失败";
        if (loaded.current) setSyncError(text);
        else setLoadError(text);
      }
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [token]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const loadMore = async () => {
    if (!token || !nextCursor || moreRef.current) return;
    moreRef.current = true;
    setLoadingMore(true);
    try {
      const history = await coachCenterApi.chatHistory(token, nextCursor);
      if (!alive.current) return;
      setTurns((old) => mergeTurns(old, history.turns));
      setNextCursor(history.nextCursor);
      setMoreError(null);
    } catch (error) {
      if (alive.current)
        setMoreError(
          error instanceof Error ? error.message : "更早记录读取失败",
        );
    } finally {
      moreRef.current = false;
      if (alive.current) setLoadingMore(false);
    }
  };

  const pendingKeys = turns
    .filter((t) => t.status === "PROCESSING")
    .map((t) => t.clientMessageId)
    .join(",");
  useFocusEffect(
    useCallback(() => {
      if (!token || !pendingKeys) return;
      let active = true;
      let running = false;
      const timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
          const rows = await Promise.all(
            pendingKeys
              .split(",")
              .map((key) => coachCenterApi.chatTurn(token, key)),
          );
          if (active && alive.current) {
            setTurns((old) =>
              mergeTurns(
                old,
                rows.filter((row): row is CoachChatTurn => row !== null),
              ),
            );
            setSyncError(null);
          }
        } catch {
          if (active && alive.current)
            setSyncError("暂时无法同步回复，请检查网络后重试");
        } finally {
          running = false;
        }
      }, 3000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [token, pendingKeys]),
  );

  const send = async (retry?: CoachChatTurn) => {
    const question = retry?.question ?? message.trim();
    if (
      !token ||
      !question ||
      sendingRef.current ||
      loading ||
      loadError ||
      turns.some((turn) => turn.status === "PROCESSING")
    )
      return;
    sendingRef.current = true;
    setSending(true);
    const now = new Date().toISOString();
    const turn: CoachChatTurn = retry ?? {
      id: `local-${Date.now()}`,
      clientMessageId: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
      question,
      answer: null,
      status: "PROCESSING",
      version: 0,
      createdAt: now,
      updatedAt: now,
      errorMessage: null,
    };
    setTurns((old) =>
      mergeTurns(old, [{ ...turn, status: "PROCESSING", errorMessage: null }]),
    );
    if (!retry) setMessage("");
    try {
      const result = await coachCenterApi.sendChat(token, {
        clientMessageId: turn.clientMessageId,
        message: question,
        expectedVersion: turn.version,
      });
      if (alive.current) setTurns((old) => mergeTurns(old, [result]));
    } catch (error) {
      // A timed-out POST may still finish on the server. Reconcile by the same key.
      let saved: CoachChatTurn | null = null;
      try {
        saved = await coachCenterApi.chatTurn(token, turn.clientMessageId);
      } catch {
        /* Keep the local question retryable while offline. */
      }
      if (alive.current)
        setTurns((old) => {
          if (saved) return mergeTurns(old, [saved]);
          return old.map((row) =>
            row.clientMessageId === turn.clientMessageId
              ? {
                  ...row,
                  status: "FAILED",
                  errorMessage:
                    error instanceof Error ? error.message : "发送失败，请重试",
                }
              : row,
          );
        });
    } finally {
      sendingRef.current = false;
      if (alive.current) setSending(false);
    }
  };

  return {
    turns,
    message,
    setMessage,
    loading,
    loadError,
    syncError,
    moreError,
    loadingMore,
    nextCursor,
    sending,
    refresh,
    loadMore,
    send,
    blocked:
      !token ||
      loading ||
      !!loadError ||
      sending ||
      turns.some((turn) => turn.status === "PROCESSING"),
  };
}
