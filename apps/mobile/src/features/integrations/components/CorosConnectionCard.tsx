import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { openURL, parse, useLinkingURL } from "expo-linking";
import { Activity, CheckCircle2, ShieldAlert } from "lucide-react-native";

import { AppText, Button, Card, Spinner } from "../../../components/ui";
import { colors } from "../../../theme/colors";
import { useAuth } from "../../auth/hooks/AuthProvider";
import {
  disconnectConnection,
  IntegrationsApiError,
  listConnections,
  startCorosAuthorization,
} from "../services/integrations.api";
import type { ExternalConnection } from "@ridepilot/contracts";

const statusLabel: Record<ExternalConnection["status"], string> = {
  AUTHORIZING: "授权中",
  CONNECTED: "已绑定",
  REAUTH_REQUIRED: "需要重新授权",
  DEGRADED: "服务异常",
  FAILED: "绑定失败",
};

const statusColor: Record<ExternalConnection["status"], string> = {
  AUTHORIZING: colors.warning,
  CONNECTED: colors.positive,
  REAUTH_REQUIRED: colors.warning,
  DEGRADED: colors.warning,
  FAILED: colors.negative,
};

export function CorosConnectionCard() {
  const { session } = useAuth();
  const [connection, setConnection] = useState<ExternalConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbackUrl = useLinkingURL();
  const accessToken = session?.accessToken;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const connections = await listConnections(accessToken);
      setConnection(
        connections.find((item) => item.providerKey === "coros") ?? null,
      );
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法读取 COROS 绑定状态",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!callbackUrl || !callbackUrl.startsWith("ridepilot://coros-callback"))
      return;
    const { queryParams } = parse(callbackUrl);
    if (queryParams?.status === "success") {
      const timer = setTimeout(() => void load(), 0);
      return () => clearTimeout(timer);
    }
    if (queryParams?.status === "error") {
      const timer = setTimeout(() => setError("COROS 授权未完成，请重试"), 0);
      return () => clearTimeout(timer);
    }
  }, [callbackUrl, load]);

  const actionLabel = useMemo(() => {
    if (!connection) return "绑定 COROS";
    if (connection.status === "REAUTH_REQUIRED") return "重新授权";
    return "重新绑定";
  }, [connection]);

  const connect = async () => {
    if (!session?.accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const authorization = await startCorosAuthorization(session.accessToken);
      await openURL(authorization.authorizationUrl);
    } catch (cause) {
      const message =
        cause instanceof IntegrationsApiError &&
        cause.code === "INTEGRATION_NOT_CONFIGURED"
          ? "后端尚未配置有效的 COROS MCP 地址，请检查服务端配置"
          : cause instanceof IntegrationsApiError &&
              cause.code === "COROS_OAUTH_REGISTRATION_FAILED"
            ? "COROS MCP 动态授权注册失败，请检查回调地址和网络"
          : cause instanceof Error
            ? cause.message
            : "无法打开 COROS 授权页";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    if (!session?.accessToken || !connection) return;
    Alert.alert(
      "解除 COROS 绑定",
      "解除后 RidePilot 将无法继续读取 COROS 数据。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "解除绑定",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await disconnectConnection(session.accessToken, connection.id);
              setConnection(null);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "解除绑定失败");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Activity color={colors.brand} size={20} strokeWidth={1.7} />
        </View>
        <View style={styles.headerCopy}>
          <AppText style={styles.title}>COROS 数据</AppText>
          <AppText style={styles.description}>
            同步训练记录、睡眠和恢复数据，支持后续训练分析。
          </AppText>
        </View>
        {connection ? (
          <CheckCircle2
            color={statusColor[connection.status]}
            size={19}
            strokeWidth={1.8}
          />
        ) : null}
      </View>
      {loading ? (
        <Spinner accessibilityLabel="正在读取 COROS 绑定状态" />
      ) : null}
      {error ? (
        <View style={styles.errorRow}>
          <ShieldAlert color={colors.warning} size={16} />
          <AppText style={styles.error}>{error}</AppText>
        </View>
      ) : null}
      {connection ? (
        <View style={styles.connectedRow}>
          <View style={styles.connectedCopy}>
            <AppText
              style={[styles.status, { color: statusColor[connection.status] }]}
            >
              {statusLabel[connection.status]}
            </AppText>
            <AppText style={styles.meta}>
              {connection.lastSyncedAt
                ? `最近状态更新 ${new Date(connection.lastSyncedAt).toLocaleString()}`
                : "尚未同步训练数据"}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="解除 COROS 绑定"
            onPress={disconnect}
          >
            <AppText style={styles.unlink}>解除</AppText>
          </Pressable>
        </View>
      ) : null}
      <Button
        variant={connection ? "secondary" : "primary"}
        loading={busy}
        onPress={() => void connect()}
        className="mt-3"
      >
        {actionLabel}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.brandSubtle,
  },
  headerCopy: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  description: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 12,
  },
  error: { flex: 1, color: colors.warning, fontSize: 11, lineHeight: 16 },
  connectedRow: { flexDirection: "row", alignItems: "center", marginTop: 13 },
  connectedCopy: { flex: 1 },
  status: { fontSize: 12, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  unlink: { color: colors.textMuted, fontSize: 12 },
});
