'use client';

import { useState, type ComponentProps, type FocusEvent } from 'react';

import { Input } from '@/components/ui/input';

type EditableIntegerInputProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'pattern' | 'value' | 'defaultValue' | 'onChange'
> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  zeroAsEmpty?: boolean;
};

function formatInteger(value: number | null, zeroAsEmpty: boolean) {
  if (value === null || !Number.isFinite(value) || (zeroAsEmpty && value === 0)) return '';
  return String(Math.max(0, Math.trunc(value)));
}

export function EditableIntegerInput({
  value,
  onValueChange,
  zeroAsEmpty = false,
  onFocus,
  onBlur,
  ...props
}: EditableIntegerInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayedValue = draft ?? formatInteger(value, zeroAsEmpty);

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setDraft(formatInteger(value, zeroAsEmpty));
    event.currentTarget.select();
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const nextValue = draft ?? displayedValue;
    onValueChange(nextValue === '' ? null : Number.parseInt(nextValue, 10));
    setDraft(null);
    onBlur?.(event);
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={displayedValue}
      onFocus={handleFocus}
      onChange={(event) => {
        const nextDraft = event.target.value;
        if (!/^\d*$/.test(nextDraft)) return;

        setDraft(nextDraft);
        onValueChange(nextDraft === '' ? null : Number.parseInt(nextDraft, 10));
      }}
      onBlur={handleBlur}
    />
  );
}
