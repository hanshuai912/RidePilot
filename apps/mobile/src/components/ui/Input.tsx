import { TextInput, type TextInputProps } from 'react-native';

import { cn } from '../../lib/cn';

export type InputProps = TextInputProps & { className?: string };

export function Input({ className, editable = true, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        'min-h-[48px] rounded-xl border border-border bg-surface-2 px-4 text-[16px] text-primary',
        !editable && 'opacity-50',
        className,
      )}
      editable={editable}
      placeholderTextColor="#787F77"
      {...props}
    />
  );
}
