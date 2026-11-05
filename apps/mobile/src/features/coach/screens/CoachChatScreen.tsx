import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import type { CoachChatInput } from "@ridepilot/contracts";
import { AppText, Button, Card, Input } from "../../../components/ui";
import { useAuth } from "../../auth/hooks/AuthProvider";
import { TrainingPage } from "../../training/components/TrainingPage";
import { coachCenterApi } from "../services/coach-center.api";

type Message = NonNullable<CoachChatInput["history"]>[number];

export function CoachChatScreen() {
  const { session } = useAuth();
  return (
    <CoachChatSession
      key={session?.user.id ?? "signed-out"}
      token={session?.accessToken}
    />
  );
}

function CoachChatSession({ token }: { token?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const ask = async () => {
    const question = message.trim();
    if (sending.current || !question || !token) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const answer = await coachCenterApi.chat(token, {
        message: question,
        history: messages.slice(-6),
      });
      setMessages(
        (old) =>
          [
            ...old,
            { role: "user", content: question },
            { role: "assistant", content: answer.answer },
          ].slice(-20) as Message[],
      );
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "问答失败，请重试");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <TrainingPage
      title="问 AI 教练"
      onBack={() => router.replace("/(tabs)/coach")}
    >
      <AppText muted>
        依据当前计划和近期记录解答；需要改变安排时，请返回选择结构化调整。本页问答仅在当前页面保留，模型参考最近三轮对话。
      </AppText>
      {messages.map((m, i) => (
        <Card key={i}>
          <AppText
            variant="label"
            className={m.role === "user" ? "text-secondary" : "text-brand"}
          >
            {m.role === "user" ? "我" : "AI 教练 · 只读建议"}
          </AppText>
          <AppText className="mt-2" selectable>
            {m.content}
          </AppText>
        </Card>
      ))}
      {!token ? <AppText className="text-negative">请先登录</AppText> : null}
      <Input
        accessibilityLabel="向 AI 教练提问"
        placeholder="例如：为什么下一节安排耐力训练？"
        multiline
        maxLength={500}
        value={message}
        onChangeText={setMessage}
        editable={!busy}
        className="min-h-28 py-3"
      />
      {error ? (
        <AppText accessibilityRole="alert" className="text-negative">
          {error}
        </AppText>
      ) : null}
      <Button
        loading={busy}
        disabled={!token || !message.trim()}
        onPress={() => void ask()}
      >
        {error ? "重试提问" : "发送问题"}
      </Button>
      {busy ? (
        <AppText muted>正在读取最新训练上下文并回答，可稍后返回。</AppText>
      ) : null}
      <Button
        variant="secondary"
        onPress={() => router.replace("/(tabs)/coach")}
      >
        返回教练 · 选择调整范围
      </Button>
    </TrainingPage>
  );
}
