import { useCallback, type ReactNode } from "react";
import type { CoachOverview, ProposalResponse } from "@ridepilot/contracts";
import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachCenterApi } from "../services/coach-center.api";
import {
  useCoachResource,
  type CoachResource,
} from "../hooks/useCoachResource";
import { CoachContextCard } from "./CoachContextCard";
import {
  CoachNextWorkoutCard,
  CoachNextWorkoutContent,
} from "./CoachNextWorkoutCard";

export function CoachOverviewPanel({ children }: { children?: ReactNode }) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const load = useCallback(
    () =>
      token
        ? coachCenterApi.overview(token)
        : Promise.reject(new Error("请先登录")),
    [token],
  );
  const resource = useCoachResource(load);
  return (
    <CoachOverviewContent resource={resource}>{children}</CoachOverviewContent>
  );
}

export function CoachOverviewContent({
  resource,
  detail,
  children,
}: {
  resource: CoachResource<CoachOverview>;
  detail?: CoachResource<ProposalResponse["draftWorkout"]>;
  children?: ReactNode;
}) {
  const { data, loading, error, retry } = resource;
  return (
    <>
      {loading ? (
        <Card>
          <Spinner accessibilityLabel="正在读取教练概览" />
        </Card>
      ) : error || !data ? (
        <Card className="gap-3">
          <AppText variant="card">暂时无法读取训练概览</AppText>
          <AppText variant="body" className="text-negative">
            {error || "暂无概览"}
          </AppText>
          <Button variant="secondary" onPress={retry}>
            重新读取概览
          </Button>
        </Card>
      ) : (
        <>
          <CoachContextCard data={data} />
          {detail ? (
            <CoachNextWorkoutContent data={data} detail={detail} />
          ) : (
            <CoachNextWorkoutCard data={data} />
          )}
        </>
      )}
      {children}
    </>
  );
}
