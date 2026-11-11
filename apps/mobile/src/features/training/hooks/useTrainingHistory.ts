import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { TrainingHistoryResponse } from "@ridepilot/contracts";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { trainingApi } from "../services/training.api";

export function useTrainingHistory() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState<TrainingHistoryResponse["items"]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const pendingPage = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void attempt;
      const version = ++generation.current;
      pendingPage.current = false;
      setItems([]);
      setNextCursor(null);
      setError(null);
      setMoreError(null);
      setLoadingMore(false);
      setLoading(true);
      if (!token) {
        setError("请先登录后查看训练历史。");
        setLoading(false);
        return;
      }
      void trainingApi
        .history(token)
        .then((page) => {
          if (generation.current !== version) return;
          setItems(page.items);
          setNextCursor(page.nextCursor);
        })
        .catch((cause) => {
          if (generation.current === version)
            setError(
              cause instanceof Error ? cause.message : "训练历史加载失败",
            );
        })
        .finally(() => {
          if (generation.current === version) setLoading(false);
        });
      return () => {
        generation.current++;
      };
    }, [token, attempt]),
  );

  const loadMore = async () => {
    if (!token || !nextCursor || loading || pendingPage.current) return;
    const version = generation.current;
    pendingPage.current = true;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await trainingApi.history(token, nextCursor);
      if (generation.current !== version) return;
      setItems((current) => {
        const seen = new Set(current.map((w) => w.id));
        return [...current, ...page.items.filter((w) => !seen.has(w.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (generation.current === version)
        setMoreError(
          cause instanceof Error ? cause.message : "更早训练加载失败",
        );
    } finally {
      if (generation.current === version) {
        pendingPage.current = false;
        setLoadingMore(false);
      }
    }
  };

  return {
    items,
    nextCursor,
    loading,
    loadingMore,
    error,
    moreError,
    loadMore,
    retry: () => setAttempt((v) => v + 1),
  };
}
