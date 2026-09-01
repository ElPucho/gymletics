import type {
  ExerciseLog,
  ExerciseRecommendation,
  GymleticsData,
  PlanExercise,
  WorkoutSession,
} from './types';
import { formatWeight } from './weight-format';

function workingSets(log: ExerciseLog) {
  return log.sets.filter((set) => set.type === 'work');
}

function mainWorkCompleted(log: ExerciseLog) {
  const sets = workingSets(log);
  return (
    sets.length >= log.targetSets &&
    sets.slice(0, log.targetSets).every((set) => set.completed && set.reps >= log.targetReps)
  );
}

function restPauseReached(log: ExerciseLog) {
  return Boolean(log.restPause && log.restPause[0] >= 5 && log.restPause[1] >= 5);
}

function progressionTargetReached(log: ExerciseLog) {
  return mainWorkCompleted(log) && (log.technique === 'rest-pause' ? restPauseReached(log) : true);
}

function missedTarget(log: ExerciseLog) {
  const sets = workingSets(log);
  return sets.some((set) => !set.completed || set.reps < log.targetReps);
}

function maxCompletedWeight(log: ExerciseLog) {
  return workingSets(log).reduce((max, set) => (set.completed ? Math.max(max, set.weight) : max), 0);
}

export function comparableHistory(
  data: GymleticsData,
  planId: string,
  dayId: string,
  exercise: PlanExercise,
): Array<{ session: WorkoutSession; log: ExerciseLog }> {
  const completed = data.sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  const exact = completed.flatMap((session) =>
    session.planId === planId && session.dayId === dayId
      ? session.exercises
          .filter((log) => log.planExerciseId === exercise.id)
          .map((log) => ({ session, log }))
      : [],
  );
  if (exact.length) return exact;

  return completed.flatMap((session) =>
    session.exercises
      .filter(
        (log) =>
          log.exerciseName.toLocaleLowerCase('es') === exercise.name.toLocaleLowerCase('es') &&
          log.unit === exercise.unit,
      )
      .map((log) => ({ session, log })),
  );
}

export function recommendWeight(
  data: GymleticsData,
  planId: string,
  dayId: string,
  exercise: PlanExercise,
): ExerciseRecommendation {
  const history = comparableHistory(data, planId, dayId, exercise);
  if (!history.length) {
    return {
      weight: 0,
      action: 'initial',
      reason: 'Primera referencia: elige una carga cómoda y ajústala durante la sesión.',
    };
  }

  const last = history[0];
  const lastWeight = maxCompletedWeight(last.log);
  const two = history.slice(0, 2);

  if (
    two.length === 2 &&
    two.every(({ log }) => progressionTargetReached(log))
  ) {
    return {
      weight: roundWeight(lastWeight + exercise.increment),
      action: 'increase',
      reason: exercise.technique === 'rest-pause'
        ? `Dos sesiones seguidas con el objetivo completo y rest-pause 5+5. Sube ${formatWeight(exercise.increment)} ${exercise.unit}.`
        : `Dos sesiones seguidas con todas las series objetivo. Sube ${formatWeight(exercise.increment)} ${exercise.unit}.`,
      lastSession: last.session,
    };
  }

  if (two.length === 2 && two.every(({ log }) => missedTarget(log))) {
    return {
      weight: roundWeight(Math.max(0, lastWeight - exercise.increment)),
      action: 'decrease',
      reason: `Dos sesiones seguidas por debajo del objetivo. Reduce un incremento para recuperar ejecución.`,
      lastSession: last.session,
    };
  }

  return {
    weight: lastWeight,
    action: 'maintain',
    reason: 'Mantén la última carga hasta repetir 5+5 en dos sesiones consecutivas.',
    lastSession: last.session,
  };
}

export function roundWeight(value: number) {
  return Math.round(value * 100) / 100;
}

export function estimatedOneRepMax(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  return roundWeight(weight * (1 + reps / 30));
}

export function sessionVolume(session: WorkoutSession) {
  return session.exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets
        .filter((set) => set.completed)
        .reduce((sum, set) => sum + set.weight * set.reps, 0),
    0,
  );
}
