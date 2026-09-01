'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Check, Circle, Dumbbell } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DecimalWeightInput } from './decimal-weight-input';
import { EditableIntegerInput } from './editable-integer-input';
import { uid } from '@/lib/gymletics/defaults';
import { buildExerciseLog } from '@/lib/gymletics/session-builder';
import type {
  ExerciseLog,
  GymleticsData,
  RoutineDay,
  SetLog,
  WorkoutPlan,
  WorkoutSession,
} from '@/lib/gymletics/types';

interface ManualWorkoutDraft {
  date: string;
  planId: string;
  dayId: string;
  exercises: ExerciseLog[];
  cardioMinutes: number;
}

function dayForSequence(data: GymleticsData, plan?: WorkoutPlan) {
  if (!plan?.days.length) return undefined;
  const index = Math.min(Math.max(data.nextDayByPlan[plan.id] ?? 0, 0), plan.days.length - 1);
  return plan.days[index];
}

function buildDraft(
  data: GymleticsData,
  date: string,
  plan?: WorkoutPlan,
  day?: RoutineDay,
): ManualWorkoutDraft {
  return {
    date,
    planId: plan?.id ?? '',
    dayId: day?.id ?? '',
    exercises: plan && day
      ? day.exercises.map((exercise) => {
          const log = buildExerciseLog(data, plan, day, exercise);
          return {
            ...log,
            sets: log.sets.map((set) => ({ ...set, completed: true })),
          };
        })
      : [],
    cardioMinutes: day?.cardioMinutes ?? 0,
  };
}

export function ManualWorkoutDialog({
  data,
  updateData,
  initialDate,
  onClose,
  onSaved,
}: {
  data: GymleticsData;
  updateData: (updater: (current: GymleticsData) => GymleticsData) => void;
  initialDate: string;
  onClose: () => void;
  onSaved: (session: WorkoutSession) => void;
}) {
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const startingDate = initialDate && initialDate <= todayIso ? initialDate : todayIso;
  const initialPlan = data.plans.find((plan) => plan.id === data.activePlanId) ?? data.plans[0];
  const initialDay = dayForSequence(data, initialPlan) ?? initialPlan?.days[0];
  const [draft, setDraft] = useState(() => buildDraft(data, startingDate, initialPlan, initialDay));
  const [error, setError] = useState('');
  const selectedPlan = data.plans.find((plan) => plan.id === draft.planId);
  const selectedDay = selectedPlan?.days.find((day) => day.id === draft.dayId);

  function selectPlan(planId: string) {
    const plan = data.plans.find((item) => item.id === planId);
    const day = dayForSequence(data, plan) ?? plan?.days[0];
    setDraft((current) => buildDraft(data, current.date, plan, day));
    setError('');
  }

  function selectDay(dayId: string) {
    const day = selectedPlan?.days.find((item) => item.id === dayId);
    setDraft((current) => buildDraft(data, current.date, selectedPlan, day));
    setError('');
  }

  function updateSet(exerciseId: string, setId: string, patch: Partial<SetLog>) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...patch } : set) }
          : exercise,
      ),
    }));
  }

  function updateRestPause(exerciseId: string, position: 0 | 1, value: number | null) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        const restPause: [number, number] = exercise.restPause ? [...exercise.restPause] : [0, 0];
        restPause[position] = Math.max(0, value ?? 0);
        if (restPause.every((repetitions) => repetitions === 0)) {
          const updatedExercise = { ...exercise };
          delete updatedExercise.restPause;
          return updatedExercise;
        }
        return { ...exercise, restPause };
      }),
    }));
  }

  function saveWorkout() {
    if (!selectedPlan || !selectedDay || !draft.date) {
      setError('Selecciona una fecha, un plan y un día de entrenamiento.');
      return;
    }
    if (draft.date > todayIso) {
      setError('La fecha del entrenamiento no puede estar en el futuro.');
      return;
    }
    const hasCompletedSet = draft.exercises.some((exercise) =>
      exercise.sets.some((set) => set.type === 'work' && set.completed),
    );
    if (!hasCompletedSet) {
      setError('Marca al menos una serie de trabajo como completada.');
      return;
    }

    const timestamp = new Date(`${draft.date}T12:00:00`).toISOString();
    const session: WorkoutSession = {
      id: uid('session'),
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      dayId: selectedDay.id,
      dayName: selectedDay.name,
      focus: selectedDay.focus,
      date: draft.date,
      startedAt: timestamp,
      completedAt: timestamp,
      status: 'completed',
      exercises: draft.exercises,
      cardioMinutes: Math.max(0, draft.cardioMinutes),
    };
    const dayIndex = selectedPlan.days.findIndex((day) => day.id === selectedDay.id);

    updateData((current) => {
      const latestPlanSession = current.sessions
        .filter((item) => item.status === 'completed' && item.planId === selectedPlan.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const shouldAdvanceSequence = !latestPlanSession || session.date >= latestPlanSession.date;
      const nextDayByPlan = shouldAdvanceSequence && selectedPlan.days.length
        ? { ...current.nextDayByPlan, [selectedPlan.id]: (dayIndex + 1) % selectedPlan.days.length }
        : current.nextDayByPlan;

      return {
        ...current,
        sessions: [session, ...current.sessions],
        nextDayByPlan,
        calendarMarks: [
          ...current.calendarMarks.filter((mark) => mark.date !== session.date),
          { date: session.date, status: 'completed' },
        ],
      };
    });
    onSaved(session);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Añadir entrenamiento realizado</DialogTitle>
          <DialogDescription>
            Elige la fecha y corrige los pesos o repeticiones. Las últimas cargas conocidas se usan como referencia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 justify-items-center gap-3">
            <div className="w-full max-w-[180px] min-w-0">
              <Label htmlFor="manual-workout-date">Fecha</Label>
              <div className="relative mt-1 min-w-0">
                <Input
                  id="manual-workout-date"
                  type="date"
                  max={todayIso}
                  className="gym-date-input h-10 min-w-0 pr-9"
                  value={draft.date}
                  onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                />
                <CalendarDays aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-black/45 dark:text-white/45" />
              </div>
            </div>
            <div className="w-full max-w-[240px] min-w-0">
              <Label htmlFor="manual-workout-plan">Plan</Label>
              <Select value={draft.planId} onValueChange={(value) => { if (value) selectPlan(value); }}>
                <SelectTrigger id="manual-workout-plan" className="mt-1 h-10 w-full min-w-0"><SelectValue placeholder="Plan">{selectedPlan?.name}</SelectValue></SelectTrigger>
                <SelectContent>{data.plans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Día de entrenamiento</Label>
            <Select value={draft.dayId} onValueChange={(value) => { if (value) selectDay(value); }}>
              <SelectTrigger className="mt-1 h-11 w-full"><SelectValue placeholder="Selecciona un día">{selectedDay ? `${selectedDay.name} · ${selectedDay.focus || 'Entrenamiento'}` : undefined}</SelectValue></SelectTrigger>
              <SelectContent>{selectedPlan?.days.map((day) => <SelectItem key={day.id} value={day.id}>{day.name} · {day.focus || 'Entrenamiento'}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {draft.exercises.length ? (
            <div className="space-y-3">
              {draft.exercises.map((exercise) => (
                <section key={exercise.id} className="rounded-[20px] bg-black/4 p-3 dark:bg-white/6">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div><p className="text-sm font-extrabold">{exercise.exerciseName}</p><p className="text-[10px] text-black/45 dark:text-white/45">{exercise.muscleGroup}</p></div>
                    <Badge variant="outline">{exercise.unit}</Badge>
                  </div>
                  <div className="mb-1 grid grid-cols-[30px_1fr_64px_36px] gap-2 px-1 text-[9px] font-bold uppercase text-black/35 dark:text-white/35"><span>#</span><span>Peso</span><span>Reps</span><span /></div>
                  <div className="space-y-1.5">
                    {exercise.sets.map((set) => (
                      <div key={set.id} className="grid grid-cols-[30px_1fr_64px_36px] items-center gap-2">
                        <span className="text-center text-[10px] font-black">{set.type === 'warmup' ? `C${set.index + 1}` : set.index + 1}</span>
                        <DecimalWeightInput
                          aria-label={`Peso de ${exercise.exerciseName}, serie ${set.index + 1}`}
                          value={set.weight}
                          onValueChange={(weight) => updateSet(exercise.id, set.id, { weight: weight ?? 0 })}
                          className="h-10 rounded-xl text-center text-sm font-black"
                        />
                        <EditableIntegerInput
                          aria-label={`Repeticiones de ${exercise.exerciseName}, serie ${set.index + 1}`}
                          value={set.reps}
                          onValueChange={(reps) => updateSet(exercise.id, set.id, { reps: reps ?? 0 })}
                          className="h-10 rounded-xl text-center text-sm font-black"
                        />
                        <button
                          type="button"
                          aria-label={set.completed ? 'Marcar serie como no realizada' : 'Marcar serie como realizada'}
                          onClick={() => updateSet(exercise.id, set.id, { completed: !set.completed })}
                          className={`grid size-9 place-items-center rounded-full ${set.completed ? 'bg-emerald-500 text-white' : 'bg-black/8 text-black/30 dark:bg-white/10 dark:text-white/30'}`}
                        >
                          {set.completed ? <Check className="size-4" strokeWidth={3} /> : <Circle className="size-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                  {exercise.technique === 'rest-pause' ? (
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-black/8 pt-3 dark:border-white/10">
                      <EditableIntegerInput aria-label={`Primer bloque rest-pause de ${exercise.exerciseName}`} value={exercise.restPause?.[0] ?? null} zeroAsEmpty onValueChange={(value) => updateRestPause(exercise.id, 0, value)} className="h-9 rounded-xl text-center font-black" />
                      <span className="text-xs font-black">RP +</span>
                      <EditableIntegerInput aria-label={`Segundo bloque rest-pause de ${exercise.exerciseName}`} value={exercise.restPause?.[1] ?? null} zeroAsEmpty onValueChange={(value) => updateRestPause(exercise.id, 1, value)} className="h-9 rounded-xl text-center font-black" />
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-black/15 p-6 text-center dark:border-white/15">
              <Dumbbell className="mx-auto mb-2 size-5 opacity-35" />
              <p className="text-sm font-semibold text-black/50 dark:text-white/50">Este día todavía no tiene ejercicios.</p>
            </div>
          )}

          <div>
            <Label htmlFor="manual-cardio">Cardio realizado (min)</Label>
            <Input id="manual-cardio" type="number" inputMode="numeric" min={0} className="mt-1 h-10" value={draft.cardioMinutes} onChange={(event) => setDraft((current) => ({ ...current, cardioMinutes: Math.max(0, Number(event.target.value)) }))} />
          </div>
          {error ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={saveWorkout} disabled={!selectedDay?.exercises.length}><Check /> Guardar como completado</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
