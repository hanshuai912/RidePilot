import { Modal, Pressable, View } from 'react-native';

import { cn } from '../../lib/cn';
import { AppText } from './AppText';
import { Button } from './Button';

export function Dialog({
  visible,
  title,
  description,
  onClose,
  children,
  className,
}: {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/70 px-5">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className={cn('w-full rounded-card border border-border bg-surface p-5', className)}>
          <AppText variant="section">{title}</AppText>
          {description && <AppText className="mt-2 text-secondary">{description}</AppText>}
          {children}
          <Button className="mt-5" onPress={onClose} variant="secondary">
            关闭
          </Button>
        </View>
      </View>
    </Modal>
  );
}
