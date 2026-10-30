import { useEffect, useState } from "react";
import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { Button, Dialog } from "../../../components/ui";

function back() {
  if (router.canGoBack()) router.back();
  else router.replace("/profile");
}

export function useProfileEditorNavigation({
  dirty,
  saving,
  saved,
  description,
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  description: string;
}) {
  const navigation = useNavigation();
  const [leave, setLeave] = useState<(() => void) | null>(null);
  usePreventRemove(dirty || saving, ({ data }) => {
    if (!saving) setLeave(() => () => navigation.dispatch(data.action));
  });
  useEffect(() => {
    if (saved) back();
  }, [saved]);
  const confirmation = (
    <Dialog
      visible={leave !== null}
      title="有未保存的修改"
      description={description}
      closeLabel="继续编辑"
      onClose={() => setLeave(null)}
    >
      <Button
        className="mt-5"
        variant="secondary"
        onPress={() => {
          const action = leave;
          setLeave(null);
          action?.();
        }}
      >
        放弃修改
      </Button>
    </Dialog>
  );
  return { back, confirmation };
}
