import { Text, type TextProps } from 'react-native';

import { cn } from '../../lib/cn';

type TextVariant = 'display' | 'title' | 'section' | 'card' | 'body' | 'caption' | 'label';

const variantClasses: Record<TextVariant, string> = {
  display: 'text-[32px] font-semibold leading-[38px]',
  title: 'text-[24px] font-semibold leading-[30px]',
  section: 'text-[20px] font-semibold leading-[26px]',
  card: 'text-[17px] font-semibold leading-[22px]',
  body: 'text-[16px] leading-[24px]',
  caption: 'text-[13px] leading-[18px]',
  label: 'text-[12px] font-medium leading-[16px]',
};

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  muted?: boolean;
  className?: string;
};

export function AppText({ variant = 'body', muted = false, className, ...props }: AppTextProps) {
  return (
    <Text
      className={cn(variantClasses[variant], muted ? 'text-muted' : 'text-primary', className)}
      {...props}
    />
  );
}
