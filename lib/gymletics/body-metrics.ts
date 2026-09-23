import type { BodyMetric } from './types';

function compositionMassKg(kilograms: number | undefined, percentage: number | undefined, bodyWeight: number) {
  if (typeof kilograms === 'number' && Number.isFinite(kilograms)) return kilograms;
  if (typeof percentage === 'number' && Number.isFinite(percentage)) return bodyWeight * percentage / 100;
  return null;
}

export function bodyFatKg(metric: BodyMetric) {
  return compositionMassKg(metric.fatKg, metric.fatPercent, metric.weight);
}

export function bodyMuscleKg(metric: BodyMetric) {
  return compositionMassKg(metric.muscleKg, metric.musclePercent, metric.weight);
}
