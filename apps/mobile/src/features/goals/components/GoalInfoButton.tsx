import { useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { CircleAlert } from "lucide-react-native";
import { AppText, Dialog } from "../../../components/ui";
import { colors } from "../../../theme/colors";

export function GoalInfoButton({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看${title}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        className="h-11 w-11 items-center justify-center active:opacity-70"
      >
        <CircleAlert size={17} strokeWidth={1.8} color={colors.textSecondary} />
      </Pressable>
      {open ? (
        <Dialog
          visible
          title={title}
          onClose={() => setOpen(false)}
          closeLabel="知道了"
        >
          <ScrollView className="mt-3 max-h-80">
            <AppText className="text-secondary">{description}</AppText>
          </ScrollView>
        </Dialog>
      ) : null}
    </>
  );
}
