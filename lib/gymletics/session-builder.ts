import { uid } from './defaults';
import { recommendWeight, roundWeight } from './progression';
import type {
  ExerciseLog,
  GymleticsData,
  PlanExercise,
  RoutineDay,
  SetLog,
  WorkoutPlan,
} from './types';

export function buildExerciseLog(
  data: GymleticsData,
  plan: WorkoutPlan,
  day: RoutineDay,
  exercise: PlanExercise,
): ExerciseLog {
  const recommendation = recommendWeight(data, plan.id, day.id, exercise);
  const warmups: SetLog[] = Array.from({ length: exercise.warmupSets }, (_, index) => ({
    id: uid('set'),
    index,
    type: 'warmup',
    weight: roundWeight(recommendation.weight * (0.45 + index * 0.15)),
    reps: 20,
    completed: false,
  }));
  const sets: SetLog[] = Array.from({ length: exercise.sets }, (_, index) => ({
    id: uid('set'),
    index,
    type: 'work',
    weight: recommendation.weight,
    reps: exercise.reps,
    completed: false,
  }));

  return {
    id: uid('log'),
    planExerciseId: exercise.id,
    libraryExerciseId: exercise.libraryExerciseId,
    exerciseName: exercise.name,
    variant: exercise.variant,
    equipment: exercise.equipment,
    muscleGroup: exercise.muscleGroup,
    unit: exercise.unit,
    targetSets: exercise.sets,
    targetReps: exercise.reps,
    technique: exercise.technique,
    sets: [...warmups, ...sets],
  };
}
