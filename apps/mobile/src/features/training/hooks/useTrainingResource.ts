import { useCallback, useEffect, useState } from "react";

export function useTrainingResource<T>(load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    load: typeof load;
    attempt: number;
    data: T | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    load()
      .then((data) => {
        if (active) setState({ load, attempt, data, error: null });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            load,
            attempt,
            data: null,
            error: error instanceof Error ? error.message : "训练数据加载失败",
          });
      });
    return () => {
      active = false;
    };
  }, [load, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const current = state?.load === load && state.attempt === attempt;
  return {
    data: current ? state.data : null,
    loading: !current,
    error: current ? state.error : null,
    retry,
  };
}
