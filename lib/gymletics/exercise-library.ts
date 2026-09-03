import type {
  ExerciseDefinition,
  ExerciseLog,
  GymleticsData,
  PlanExercise,
  WeightUnit,
  WorkoutSession,
} from './types';

type ExerciseIdentity = Pick<ExerciseDefinition, 'name' | 'variant' | 'equipment' | 'muscleGroup' | 'unit'>;
type StoredGymleticsData = Omit<GymleticsData, 'version' | 'exerciseLibrary'> & {
  version: 1 | 2;
  exerciseLibrary?: ExerciseDefinition[];
};

function libraryId() {
  return `library_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeExercisePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()
    .replace(/\s+/g, ' ');
}

export function inferExerciseEquipment(name: string, unit: WeightUnit) {
  const normalized = normalizeExercisePart(name);
  if (normalized.includes('hammer')) return 'Máquina Hammer';
  if (normalized.includes('hack')) return 'Máquina Hack';
  if (normalized.includes('maquina')) return 'Máquina';
  if (normalized.includes('polea') || normalized.includes('jalon')) return 'Polea';
  if (normalized.includes('mancuerna')) return 'Mancuernas';
  if (normalized.includes('barra')) return 'Barra';
  if (unit === 'peso corporal') return 'Peso corporal';
  return 'Otro';
}

export function exerciseIdentityKey(exercise: Pick<ExerciseIdentity, 'name' | 'variant' | 'equipment' | 'unit'>) {
  return [exercise.name, exercise.variant, exercise.equipment, exercise.unit]
    .map((value) => normalizeExercisePart(value))
    .join('|');
}

export function exerciseDefinitionLabel(exercise: Pick<ExerciseDefinition, 'name' | 'variant'>) {
  return exercise.variant.trim() ? `${exercise.name} — ${exercise.variant}` : exercise.name;
}

export function createExerciseDefinition(
  exercise: ExerciseIdentity,
  id = libraryId(),
): ExerciseDefinition {
  const now = new Date().toISOString();
  return {
    id,
    name: exercise.name.trim(),
    variant: exercise.variant.trim(),
    equipment: exercise.equipment.trim() || inferExerciseEquipment(exercise.name, exercise.unit),
    muscleGroup: exercise.muscleGroup.trim() || 'General',
    unit: exercise.unit,
    createdAt: now,
    updatedAt: now,
  };
}

function identityFromPlanExercise(exercise: PlanExercise): ExerciseIdentity {
  return {
    name: exercise.name.trim(),
    variant: exercise.variant?.trim() ?? '',
    equipment: exercise.equipment?.trim() || inferExerciseEquipment(exercise.name, exercise.unit),
    muscleGroup: exercise.muscleGroup.trim() || 'General',
    unit: exercise.unit,
  };
}

function identityFromLog(exercise: ExerciseLog): ExerciseIdentity {
  return {
    name: exercise.exerciseName.trim(),
    variant: exercise.variant?.trim() ?? '',
    equipment: exercise.equipment?.trim() || inferExerciseEquipment(exercise.exerciseName, exercise.unit),
    muscleGroup: exercise.muscleGroup.trim() || 'General',
    unit: exercise.unit,
  };
}

export function findExerciseDefinition(
  library: ExerciseDefinition[],
  exercise: Pick<PlanExercise, 'libraryExerciseId' | 'name' | 'variant' | 'equipment' | 'unit'>,
) {
  const linked = exercise.libraryExerciseId
    ? library.find((definition) => definition.id === exercise.libraryExerciseId)
    : undefined;
  if (linked) return linked;
  const identity = {
    name: exercise.name,
    variant: exercise.variant ?? '',
    equipment: exercise.equipment || inferExerciseEquipment(exercise.name, exercise.unit),
    unit: exercise.unit,
  };
  return library.find((definition) => exerciseIdentityKey(definition) === exerciseIdentityKey(identity));
}

export function exerciseLogMatchesDefinition(log: ExerciseLog, definition: ExerciseDefinition) {
  if (log.libraryExerciseId) return log.libraryExerciseId === definition.id;
  return exerciseIdentityKey({
    name: log.exerciseName,
    variant: log.variant ?? '',
    equipment: log.equipment || inferExerciseEquipment(log.exerciseName, log.unit),
    unit: log.unit,
  }) === exerciseIdentityKey(definition);
}

export function reconcileExerciseLibrary(value: StoredGymleticsData): GymleticsData {
  const definitions: ExerciseDefinition[] = [];
  const byKey = new Map<string, ExerciseDefinition>();
  const idAliases = new Map<string, string>();

  function register(identity: ExerciseIdentity, requestedId?: string) {
    const candidate = createExerciseDefinition(identity, requestedId || libraryId());
    const key = exerciseIdentityKey(candidate);
    const existing = byKey.get(key);
    if (existing) {
      if (requestedId) idAliases.set(requestedId, existing.id);
      return existing;
    }
    definitions.push(candidate);
    byKey.set(key, candidate);
    if (requestedId) idAliases.set(requestedId, candidate.id);
    return candidate;
  }

  for (const stored of value.exerciseLibrary ?? []) {
    const definition = register({
      name: stored.name,
      variant: stored.variant ?? '',
      equipment: stored.equipment || inferExerciseEquipment(stored.name, stored.unit),
      muscleGroup: stored.muscleGroup,
      unit: stored.unit,
    }, stored.id);
    definition.createdAt = stored.createdAt || definition.createdAt;
    definition.updatedAt = stored.updatedAt || definition.updatedAt;
    if (!definition.mediaDataUrl && stored.mediaDataUrl) {
      definition.mediaDataUrl = stored.mediaDataUrl;
      definition.mediaFileName = stored.mediaFileName;
    }
  }

  const planExerciseLinks = new Map<string, string>();
  const plans = value.plans.map((plan) => ({
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => {
        const requestedId = exercise.libraryExerciseId
          ? idAliases.get(exercise.libraryExerciseId) ?? exercise.libraryExerciseId
          : undefined;
        const linked = requestedId ? definitions.find((item) => item.id === requestedId) : undefined;
        const definition = linked ?? register(identityFromPlanExercise(exercise));
        planExerciseLinks.set(exercise.id, definition.id);
        return {
          ...exercise,
          libraryExerciseId: definition.id,
          variant: exercise.variant ?? definition.variant,
          equipment: exercise.equipment || definition.equipment,
        };
      }),
    })),
  }));

  const sessions: WorkoutSession[] = value.sessions.map((session) => ({
    ...session,
    exercises: session.exercises.map((exercise) => {
      const requestedId = exercise.libraryExerciseId
        ? idAliases.get(exercise.libraryExerciseId) ?? exercise.libraryExerciseId
        : planExerciseLinks.get(exercise.planExerciseId);
      const linked = requestedId ? definitions.find((item) => item.id === requestedId) : undefined;
      const definition = linked ?? register(identityFromLog(exercise));
      return {
        ...exercise,
        libraryExerciseId: definition.id,
        variant: exercise.variant ?? definition.variant,
        equipment: exercise.equipment || definition.equipment,
      };
    }),
  }));

  return {
    ...value,
    version: 2,
    exerciseLibrary: definitions.sort((a, b) => exerciseDefinitionLabel(a).localeCompare(exerciseDefinitionLabel(b), 'es')),
    plans,
    sessions,
  };
}

export function isStoredGymleticsData(value: unknown): value is StoredGymleticsData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredGymleticsData>;
  return (candidate.version === 1 || candidate.version === 2)
    && Array.isArray(candidate.plans)
    && Array.isArray(candidate.sessions);
}
