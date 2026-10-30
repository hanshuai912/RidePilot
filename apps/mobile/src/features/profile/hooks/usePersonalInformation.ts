import { useCallback, useEffect, useRef, useState } from "react";
import { profilePatchSchema, type ProfileResponse } from "@ridepilot/contracts";
import {
  getProfile,
  patchProfile,
  ProfileApiError,
} from "../services/profile.api";
import {
  profileDraft,
  profileDraftChanged,
  profileDraftPayload,
  type ProfileDraft,
} from "../model/profile-draft";

export function usePersonalInformation(token?: string) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const load = useCallback(() => {
    if (!token) return;
    return getProfile(token)
      .then((next) => {
        setProfile(next);
        setDraft(profileDraft(next));
        setError(null);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "无法加载个人信息");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);
  const dirty =
    !!profile && !!draft && profileDraftChanged(draft, profileDraft(profile));
  const save = async () => {
    if (!token || !profile || !draft || !dirty || inFlight.current) return;
    const input = profilePatchSchema.safeParse({
      ...profileDraftPayload(draft),
      expectedVersion: profile.version,
    });
    if (!input.success) {
      setError(
        "请检查输入：昵称最多 80 字，身高为 50–250 cm，体重为 20–400 kg",
      );
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const next = await patchProfile(token, input.data);
      setProfile(next);
      setDraft(profileDraft(next));
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof ProfileApiError && cause.status === 409
          ? "资料已在其他设备更新，请返回后重新进入个人信息再保存"
          : cause instanceof Error
            ? cause.message
            : "保存个人资料失败",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return {
    draft,
    setDraft,
    loading,
    saving,
    saved,
    dirty,
    error,
    save,
    reload: () => {
      setLoading(true);
      setError(null);
      return load();
    },
  };
}
