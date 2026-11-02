import {
  useWatch,
  type UseFormReturn,
  type FieldPathValue,
} from "react-hook-form";
import { AppText } from "../../../components/ui";
import type { Assessment } from "@ridepilot/contracts";
import { AssessmentField, AssessmentChoices } from "./AssessmentFields";
import { assessmentSources } from "../model/assessment";
import type { ResultForm } from "../model/result-form";

export function AssessmentResultFields({
  form,
  kind,
  busy,
}: {
  form: UseFormReturn<ResultForm>;
  kind: Assessment["kind"];
  busy: boolean;
}) {
  const values = useWatch({ control: form.control }) as ResultForm;
  const set = <K extends keyof ResultForm>(key: K, value: ResultForm[K]) =>
    form.setValue(key, value as FieldPathValue<ResultForm, K>, {
      shouldDirty: true,
    });
  const field = (
    label: string,
    key: Exclude<
      keyof ResultForm,
      "comparableConditions" | "source" | "status"
    >,
    numeric = false,
    maxLength = 200,
  ) => (
    <AssessmentField
      label={label}
      value={values[key]}
      onChange={(value) => set(key, value)}
      disabled={busy}
      numeric={numeric}
      maxLength={maxLength}
    />
  );
  return (
    <>
      {field("实际测试日期", "actualDate")}
      {field("测试方法 / 协议", "protocol", false, 64)}
      {kind === "FTP" ? (
        <>
          {field("最终 FTP（W）", "resultWatts", true)}
          <AppText muted>
            请填写测试方案给出的最终 FTP，勿直接填写某段平均功率。
          </AppText>
        </>
      ) : null}
      {kind === "POWER_DURATION" ? (
        <>
          {field("平均功率（W）", "resultWatts", true)}
          {field("实际持续时间（秒）", "durationSeconds", true)}
          <AppText muted>此结果不会换算成 FTP。</AppText>
        </>
      ) : null}
      {kind === "FIXED_ROUTE" ? (
        <>
          {field("路线名称", "routeName", false, 120)}
          {field("实际用时（秒）", "durationSeconds", true)}
          {field("路线距离（km）", "distanceKm", true)}
        </>
      ) : null}
      <AssessmentChoices
        label="结果来源"
        options={{ "": "请选择来源", ...assessmentSources }}
        value={values.source}
        onChange={(value) => set("source", value)}
        disabled={busy}
      />
      {field("主观强度 RPE（1–10）", "rpe", true)}
      {field("测试条件（选填）", "conditions")}
      <AppText muted>
        可记录室内 /
        室外、设备、天气等。方法、来源及条件一致且明确确认可比时，才展示历史差值。
      </AppText>
      <AssessmentChoices
        label="条件是否可比"
        options={{ YES: "已确认可比", NO: "尚不确定" }}
        value={values.comparableConditions ? "YES" : "NO"}
        onChange={(value) => set("comparableConditions", value === "YES")}
        disabled={busy}
      />
      {field("备注（选填）", "notes", false, 500)}
    </>
  );
}
