export type ThemeMode = 'light' | 'dark';
export type WeightUnit = 'kg' | 'kg/lado' | 'kg/mancuerna' | 'peso corporal';
export type Technique =
  | 'normal'
  | 'rest-pause'
  | 'superserie'
  | 'biserie'
  | 'dropset'
  | 'al-fallo';
export type CalendarStatus =
  | 'completed'
  | 'pending'
  | 'rescheduled'
  | 'rest'
  | 'vacation'
  | 'illness'
  | 'excused'
  | 'missed';
export type PhotoPose = 'frontal' | 'lateral' | 'espalda';

export interface ExerciseDefinition {
  id: string;
  name: string;
  variant: string;
  equipment: string;
  muscleGroup: string;
  unit: WeightUnit;
  createdAt: string;
  updatedAt: string;
}

export interface PlanExercise {
  id: string;
  libraryExerciseId?: string;
  name: string;
  variant?: string;
  equipment?: string;
  muscleGroup: string;
  unit: WeightUnit;
  sets: number;
  reps: number;
  restSeconds: number;
  increment: number;
  technique: Technique;
  warmupSets: number;
  unilateral: boolean;
  supersetGroup?: string;
}

export interface RoutineDay {
  id: string;
  name: string;
  focus: string;
  exercises: PlanExercise[];
  cardioMinutes: number;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  days: RoutineDay[];
  createdAt: string;
  updatedAt: string;
}

export interface SetLog {
  id: string;
  index: number;
  type: 'warmup' | 'work';
  weight: number;
  reps: number;
  completed: boolean;
}

export interface ExerciseLog {
  id: string;
  planExerciseId: string;
  libraryExerciseId?: string;
  exerciseName: string;
  variant?: string;
  equipment?: string;
  muscleGroup: string;
  unit: WeightUnit;
  targetSets: number;
  targetReps: number;
  technique: Technique;
  sets: SetLog[];
  restPause?: [number, number];
}

export interface WorkoutSession {
  id: string;
  planId: string;
  planName: string;
  dayId: string;
  dayName: string;
  focus: string;
  date: string;
  startedAt: string;
  completedAt?: string;
  status: 'active' | 'completed' | 'discarded';
  exercises: ExerciseLog[];
  cardioMinutes: number;
}

export interface BodyMetric {
  id: string;
  date: string;
  weight: number;
  fatPercent: number;
  musclePercent: number;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  pose: PhotoPose;
  dataUrl: string;
}

export interface CalendarMark {
  date: string;
  status: CalendarStatus;
  note?: string;
}

export interface AppSettings {
  theme: ThemeMode;
  sound: boolean;
  vibration: boolean;
}

export interface GymleticsData {
  version: 2;
  exerciseLibrary: ExerciseDefinition[];
  plans: WorkoutPlan[];
  activePlanId: string;
  nextDayByPlan: Record<string, number>;
  sessions: WorkoutSession[];
  bodyMetrics: BodyMetric[];
  photos: ProgressPhoto[];
  calendarMarks: CalendarMark[];
  settings: AppSettings;
}

export type AppView = 'home' | 'workout' | 'plans' | 'progress' | 'calendar' | 'settings';

export interface ExerciseRecommendation {
  weight: number;
  action: 'initial' | 'maintain' | 'increase' | 'decrease';
  reason: string;
  lastSession?: WorkoutSession;
}
