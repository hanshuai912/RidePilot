import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { AppText, Button, Card, Input } from "../../../components/ui";
import { TrainingPage } from "../../training/components/TrainingPage";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { coachApi } from "../../coach/services/coach.api";
import { raceInputSchema, type RaceInput } from "@ridepilot/contracts";

const types = [
  ["ROAD_RACE", "公路赛"],
  ["GRAN_FONDO", "Gran Fondo"],
  ["CLIMB", "爬坡赛"],
  ["TIME_TRIAL", "计时赛"],
  ["OTHER", "其他"],
] as const;

export function RaceFormScreen() {
  const { raceId } = useLocalSearchParams<{ raceId?: string }>();
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [localDate, setLocalDate] = useState("");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [distanceKm, setDistanceKm] = useState("");
  const [elevationGainM, setElevationGainM] = useState("");
  const [type, setType] = useState<RaceInput["type"]>("ROAD_RACE");
  const [priority, setPriority] = useState<RaceInput["priority"]>("A");
  const [intent, setIntent] =
    useState<NonNullable<RaceInput["intent"]>>("FINISH");
  const [version, setVersion] = useState<number | null>(null);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!raceId || !session?.accessToken) return;
    void coachApi
      .race(session.accessToken, raceId)
      .then((race) => {
        setVersion(race.version);
        setName(race.name);
        setLocalDate(race.localDate);
        setTimezone(race.timezone);
        setDistanceKm(String(race.distanceKm));
        setElevationGainM(
          race.elevationGainM ? String(race.elevationGainM) : "",
        );
        setType(race.type);
        setPriority(race.priority);
        setIntent(race.intent);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "赛事读取失败"),
      );
  }, [raceId, session?.accessToken]);
  const save = async () => {
    if (!session?.accessToken || pending.current) return;
    const input: RaceInput = {
      name: name.trim(),
      localDate,
      timezone,
      distanceKm: Number(distanceKm),
      elevationGainM: elevationGainM.trim() ? Number(elevationGainM) : null,
      type,
      priority,
      intent,
    };
    const parsed = raceInputSchema.safeParse(input);
    if (!parsed.success) {
      setError("请检查赛事名称、日期、距离和爬升等信息");
      return;
    }
    if (raceId && version === null) {
      setError("请等待赛事读取完成后再保存");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = raceId
        ? await coachApi.updateRace(session.accessToken, raceId, {
            ...parsed.data,
            expectedVersion: version!,
          })
        : await coachApi.createRace(session.accessToken, parsed.data);
      router.replace({
        pathname: "/races/[raceId]",
        params: { raceId: saved.id },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存赛事失败");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <TrainingPage title={raceId ? "编辑赛事" : "添加赛事"} busy={busy}>
      <Card>
        <AppText variant="caption" muted>
          赛事名称
        </AppText>
        <Input
          className="mt-2"
          value={name}
          onChangeText={setName}
          placeholder="例如：环湖公路赛"
        />
        <AppText variant="caption" muted className="mt-4">
          比赛日期（YYYY-MM-DD）
        </AppText>
        <Input
          className="mt-2"
          value={localDate}
          onChangeText={setLocalDate}
          placeholder="2026-12-15"
        />
        <AppText variant="caption" muted className="mt-4">
          比赛时区
        </AppText>
        <Input
          className="mt-2"
          value={timezone}
          onChangeText={setTimezone}
          placeholder="Asia/Shanghai"
        />
        <AppText variant="caption" muted className="mt-4">
          距离（km）
        </AppText>
        <Input
          className="mt-2"
          value={distanceKm}
          onChangeText={setDistanceKm}
          keyboardType="decimal-pad"
          placeholder="100"
        />
        <AppText variant="caption" muted className="mt-4">
          预计爬升（m，可选）
        </AppText>
        <Input
          className="mt-2"
          value={elevationGainM}
          onChangeText={setElevationGainM}
          keyboardType="number-pad"
          placeholder="1500"
        />
      </Card>
      <Card>
        <AppText variant="caption" muted>
          赛事类型
        </AppText>
        <ViewChoices
          options={types}
          value={type ?? "ROAD_RACE"}
          onChange={(value) => setType(value as RaceInput["type"])}
        />
        <AppText variant="caption" muted className="mt-4">
          优先级
        </AppText>
        <ViewChoices
          options={
            [
              ["A", "核心目标赛"],
              ["B", "重要比赛"],
              ["C", "训练型比赛"],
            ] as const
          }
          value={priority}
          onChange={(value) => setPriority(value as RaceInput["priority"])}
        />
        <AppText variant="caption" muted className="mt-4">
          参赛意图
        </AppText>
        <ViewChoices
          options={
            [
              ["FINISH", "稳妥完赛"],
              ["PERFORMANCE", "争取成绩"],
              ["TEST", "能力测试"],
              ["TRAINING", "训练型参加"],
            ] as const
          }
          value={intent}
          onChange={(value) => setIntent(value as typeof intent)}
        />
      </Card>
      {error ? <AppText className="text-negative">{error}</AppText> : null}
      <Button loading={busy} onPress={() => void save()}>
        保存赛事
      </Button>
      <Button variant="secondary" disabled={busy} onPress={() => router.back()}>
        取消
      </Button>
    </TrainingPage>
  );
}

function ViewChoices({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {options.map(([key, label]) => (
        <Button
          key={key}
          size="sm"
          variant={value === key ? "primary" : "secondary"}
          onPress={() => onChange(key)}
        >
          {label}
        </Button>
      ))}
    </View>
  );
}
