import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { AppText, Button, Card } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { planImpactApi } from "../services/plan-impact.api";

export function PlanImpactEntryCard() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (token)
        Promise.resolve()
          .then(() => planImpactApi.preview(token))
          .then((data) => {
            if (active) {
              setCount(data.pendingCount);
              setFailed(false);
            }
          })
          .catch(() => {
            if (active) {
              setCount(null);
              setFailed(true);
            }
          });
      return () => {
        active = false;
      };
    }, [token]),
  );
  return (
    <Card>
      <AppText variant="card">资料变更与未来训练</AppText>
      <AppText muted className="mt-2">
        {failed
          ? "影响状态读取失败，进入后可重试。"
          : count
            ? `${count} 节未来课程待核对`
            : "修改 FTP、目标或训练时间后，在这里核对未来安排。"}
      </AppText>
      <Button
        variant="secondary"
        onPress={() => router.push("/plans/input-impact")}
      >
        检查未来训练安排
      </Button>
    </Card>
  );
}
