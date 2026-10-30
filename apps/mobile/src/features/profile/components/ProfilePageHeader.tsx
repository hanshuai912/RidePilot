import { NavigationHeader } from "../../../components/layout/NavigationHeader";

export function ProfilePageHeader({
  title,
  disabled,
  onBack,
}: {
  title: string;
  disabled: boolean;
  onBack: () => void;
}) {
  return (
    <NavigationHeader
      title={title}
      disabled={disabled}
      onBack={onBack}
      backLabel="返回我的"
    />
  );
}
