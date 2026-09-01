'use client';

import { useState, type ComponentProps, type FocusEvent } from 'react';

import { Input } from '@/components/ui/input';
import { formatWeight, normalizeWeightInput, parseWeightInput } from '@/lib/gymletics/weight-format';

type DecimalWeightInputProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'pattern' | 'value' | 'defaultValue' | 'onChange'
> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
};

export function DecimalWeightInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  ...props
}: DecimalWeightInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayedValue = draft ?? (value === null ? '' : formatWeight(value));

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setDraft(value === null ? '' : formatWeight(value));
    event.currentTarget.select();
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const parsedValue = parseWeightInput(draft ?? displayedValue);
    onValueChange(parsedValue);
    setDraft(null);
    onBlur?.(event);
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      pattern="[0-9]+([,.][0-9]{0,2})?"
      autoComplete="off"
      value={displayedValue}
      onFocus={handleFocus}
      onChange={(event) => {
        const nextDraft = normalizeWeightInput(event.target.value);
        if (nextDraft === null) return;

        setDraft(nextDraft);
        onValueChange(parseWeightInput(nextDraft));
      }}
      onBlur={handleBlur}
    />
  );
}
