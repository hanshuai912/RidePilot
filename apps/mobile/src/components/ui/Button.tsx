import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { cn } from '../../lib/cn';
import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand',
  secondary: 'border border-border bg-surface-2',
  ghost: 'bg-transparent',
  danger: 'bg-negative',
};

const textClasses: Record<ButtonVariant, string> = {
  primary: 'text-brand-on',
  secondary: 'text-primary',
  ghost: 'text-brand',
  danger: 'text-brand-on',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[40px] px-3',
  md: 'min-h-[48px] px-4',
  lg: 'min-h-[52px] px-5',
};

export type ButtonProps = PressableProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={cn(
        'flex-row items-center justify-center rounded-xl',
        variantClasses[variant],
        sizeClasses[size],
        isDisabled && 'opacity-50',
        className,
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#EFF0E9' : '#171913'} />
      ) : (
        <AppText className={cn('font-semibold', textClasses[variant])}>{children}</AppText>
      )}
    </Pressable>
  );
}
