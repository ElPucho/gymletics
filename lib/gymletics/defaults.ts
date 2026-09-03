import type { GymleticsData, PlanExercise, RoutineDay, WorkoutPlan } from './types';
import { reconcileExerciseLibrary } from './exercise-library';

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function exercise(
  name: string,
  muscleGroup: string,
  increment: number,
  unit: PlanExercise['unit'] = 'kg',
): PlanExercise {
  return {
    id: uid('ex'),
    name,
    muscleGroup,
    unit,
    sets: 4,
    reps: 10,
    restSeconds: 60,
    increment,
    technique: 'rest-pause',
    warmupSets: 0,
    unilateral: false,
  };
}

function day(name: string, focus: string, exercises: PlanExercise[]): RoutineDay {
  return { id: uid('day'), name, focus, exercises, cardioMinutes: 20 };
}

export function createStarterPlan(): WorkoutPlan {
  const now = new Date().toISOString();
  return {
    id: uid('plan'),
    name: 'Plan inicial editable',
    createdAt: now,
    updatedAt: now,
    days: [
      day('Día 1', 'Pecho y brazos', [
        exercise('Press inclinado con barra', 'Pecho', 2.5, 'kg/lado'),
        exercise('Press vertical en máquina', 'Pecho', 5),
        exercise('Peck deck', 'Pecho', 5),
        exercise('Press inclinado con mancuernas', 'Pecho', 2.5, 'kg/mancuerna'),
        exercise('Curl en máquina', 'Bíceps', 5),
        exercise('Curl en polea', 'Bíceps', 2.5),
      ]),
      day('Día 2', 'Piernas y glúteos', [
        exercise('Extensiones de cuádriceps', 'Cuádriceps', 2.5),
        exercise('Sentadilla Hack', 'Piernas', 2.5, 'kg/lado'),
        exercise('Zancada con mancuernas', 'Piernas', 2.5, 'kg/mancuerna'),
        exercise('Femoral tumbado', 'Isquiotibiales', 2.5),
        exercise('Patada de glúteo', 'Glúteos', 5),
        exercise('Abductor', 'Glúteos', 5),
      ]),
      day('Día 3', 'Espalda y bíceps', [
        exercise('Jalones en máquina', 'Espalda', 2.5),
        exercise('Remo Hammer', 'Espalda', 2.5),
        exercise('Jalón al pecho', 'Espalda', 2.5),
        exercise('Remo con barra', 'Espalda', 2.5, 'kg/lado'),
        exercise('Elevaciones posteriores', 'Hombros', 2.5, 'kg/mancuerna'),
        exercise('Curl en polea', 'Bíceps', 2.5),
      ]),
      day('Día 4', 'Hombros y brazos', [
        exercise('Press militar en máquina', 'Hombros', 2.5),
        exercise('Elevaciones laterales', 'Hombros', 2.5, 'kg/mancuerna'),
        exercise('Elevaciones frontales', 'Hombros', 2.5, 'kg/mancuerna'),
        exercise('Press vertical en máquina', 'Pecho', 5),
        exercise('Curl concentrado', 'Bíceps', 2.5, 'kg/mancuerna'),
        exercise('Press francés', 'Tríceps', 2.5, 'kg/mancuerna'),
      ]),
    ],
  };
}

export function createDefaultData(): GymleticsData {
  const plan = createStarterPlan();
  return reconcileExerciseLibrary({
    version: 2,
    exerciseLibrary: [],
    plans: [plan],
    activePlanId: plan.id,
    nextDayByPlan: { [plan.id]: 0 },
    sessions: [],
    bodyMetrics: [],
    photos: [],
    calendarMarks: [],
    settings: { theme: 'light', sound: false, vibration: true },
  });
}
