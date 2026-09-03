import { startOfWeek } from 'date-fns';

import { exerciseDefinitionLabel, exerciseLogMatchesDefinition } from './exercise-library';
import { estimatedOneRepMax } from './progression';
import type {
  ExerciseDefinition,
  ExerciseLog,
  GymleticsData,
  SetLog,
  WorkoutSession,
} from './types';

export interface ExercisePerformancePoint {
  sessionId: string;
  date: string;
  dayName: string;
  planName: string;
  weight: number;
  maxWeight: number;
  reps: number;
  e1rm: number;
  volume: number;
  bestSet: SetLog;
}

export function completedWorkSets(log: ExerciseLog) {
  return log.sets.filter((set) => set.type === 'work' && set.completed);
}

export function exercisePerformancePoint(
  session: WorkoutSession,
  log: ExerciseLog,
): ExercisePerformancePoint | null {
  const sets = completedWorkSets(log);
  if (!sets.length) return null;
  const bestSet = sets.reduce((best, set) => {
    const nextOneRepMax = estimatedOneRepMax(set.weight, set.reps);
    const bestOneRepMax = estimatedOneRepMax(best.weight, best.reps);
    if (nextOneRepMax !== bestOneRepMax) return nextOneRepMax > bestOneRepMax ? set : best;
    if (set.weight !== best.weight) return set.weight > best.weight ? set : best;
    return set.reps > best.reps ? set : best;
  });
  return {
    sessionId: session.id,
    date: session.date,
    dayName: session.dayName,
    planName: session.planName,
    weight: bestSet.weight,
    maxWeight: Math.max(...sets.map((set) => set.weight)),
    reps: bestSet.reps,
    e1rm: estimatedOneRepMax(bestSet.weight, bestSet.reps),
    volume: sets.reduce((total, set) => total + set.weight * set.reps, 0),
    bestSet,
  };
}

export function exerciseHistory(data: GymleticsData, definition: ExerciseDefinition) {
  return data.sessions
    .filter((session) => session.status === 'completed')
    .flatMap((session) => session.exercises
      .filter((log) => exerciseLogMatchesDefinition(log, definition))
      .map((log) => exercisePerformancePoint(session, log))
      .filter((point): point is ExercisePerformancePoint => Boolean(point)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function personalRecordPoints(points: ExercisePerformancePoint[]) {
  let best = 0;
  return points.filter((point) => {
    if (point.e1rm <= best + 0.005) return false;
    best = point.e1rm;
    return true;
  });
}

export function weeklyExerciseFrequency(points: ExercisePerformancePoint[]) {
  if (!points.length) return 0;
  const first = new Date(`${points[0].date}T12:00:00`).getTime();
  const last = new Date(`${points.at(-1)?.date ?? points[0].date}T12:00:00`).getTime();
  const weeks = Math.max(1, (last - first) / (7 * 24 * 60 * 60 * 1000) + 1);
  return points.length / weeks;
}

export function homeProgressInsight(data: GymleticsData, now = new Date()) {
  const completed = data.sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!completed.length) return 'Tu primera sesión activará el análisis de progreso.';

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekStartIso = [
    weekStart.getFullYear(),
    String(weekStart.getMonth() + 1).padStart(2, '0'),
    String(weekStart.getDate()).padStart(2, '0'),
  ].join('-');
  const histories = new Map<string, ExercisePerformancePoint[]>();

  for (const session of completed) {
    for (const log of session.exercises) {
      if (!log.libraryExerciseId) continue;
      const point = exercisePerformancePoint(session, log);
      if (!point) continue;
      histories.set(log.libraryExerciseId, [...(histories.get(log.libraryExerciseId) ?? []), point]);
    }
  }

  const improvedThisWeek = new Set<string>();
  for (const [exerciseId, points] of histories) {
    let priorBest = 0;
    let hasPriorResult = false;
    for (const point of points) {
      if (point.date >= weekStartIso && hasPriorResult && point.e1rm > priorBest + 0.005) improvedThisWeek.add(exerciseId);
      priorBest = Math.max(priorBest, point.e1rm);
      hasPriorResult = true;
    }
  }
  if (improvedThisWeek.size) {
    return `Esta semana has mejorado en ${improvedThisWeek.size} ejercicio${improvedThisWeek.size === 1 ? '' : 's'}.`;
  }

  const stalled = [...histories.entries()]
    .filter(([, points]) => points.length >= 3)
    .map(([exerciseId, points]) => ({
      exerciseId,
      priorBest: Math.max(...points.slice(0, -2).map((point) => point.e1rm)),
      recent: points.slice(-2),
    }))
    .filter(({ priorBest, recent }) => recent.every((point) => point.e1rm <= priorBest + 0.005))
    .sort((a, b) => b.recent[1].date.localeCompare(a.recent[1].date))[0];

  if (stalled) {
    const definition = data.exerciseLibrary.find((item) => item.id === stalled.exerciseId);
    if (definition) return `Llevas dos sesiones sin progresar en ${exerciseDefinitionLabel(definition)}.`;
  }

  const trainedThisWeek = completed.some((session) => session.date >= weekStartIso);
  return trainedThisWeek
    ? 'Tu rendimiento se mantiene estable esta semana.'
    : 'Aún no hay una sesión esta semana para comparar.';
}
