import type { ReactNode } from "react";
import { NavigationHeader } from "../../../components/layout/NavigationHeader";

export function ProfilePageHeader({
  title,
  disabled,
  onBack,
  rightAction,
}: {
  title: string;
  disabled: boolean;
  onBack: () => void;
  rightAction?: ReactNode;
}) {
  return (
    <NavigationHeader
      title={title}
      disabled={disabled}
      onBack={onBack}
      backLabel="返回我的"
      rightAction={rightAction}
    />
  );
}
