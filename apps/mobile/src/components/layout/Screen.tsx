import { ScrollView, type ScrollViewProps, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cn } from '../../lib/cn';

type ScreenProps = ViewProps & {
  scroll?: boolean;
  scrollProps?: ScrollViewProps;
  className?: string;
};

export function Screen({ scroll = false, scrollProps, className, children, ...props }: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName="grow pb-8"
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <SafeAreaView className={cn('flex-1 bg-background', className)} edges={['top']} {...props}>
      {content}
    </SafeAreaView>
  );
}
