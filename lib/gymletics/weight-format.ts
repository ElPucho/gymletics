const WEIGHT_INPUT_PATTERN = /^\d+(?:,\d{0,2})?$/;

export function normalizeWeightInput(rawValue: string) {
  const compactValue = rawValue.replace(/\s/g, '').replace(/\./g, ',');
  if (compactValue === '') return '';

  const normalizedValue = compactValue.startsWith(',') ? `0${compactValue}` : compactValue;
  return WEIGHT_INPUT_PATTERN.test(normalizedValue) ? normalizedValue : null;
}

export function parseWeightInput(rawValue: string) {
  const normalizedValue = normalizeWeightInput(rawValue);
  if (!normalizedValue) return null;

  const parsedValue = Number(normalizedValue.replace(',', '.'));
  return Number.isFinite(parsedValue) ? Math.round(parsedValue * 100) / 100 : null;
}

export function formatWeight(value: number, options: { useGrouping?: boolean } = {}) {
  if (!Number.isFinite(value)) return '';

  const roundedValue = Math.round(Math.max(0, value) * 100) / 100;

  return roundedValue.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: options.useGrouping ?? false,
  });
}
