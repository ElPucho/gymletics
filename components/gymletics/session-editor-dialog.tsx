'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Check, Circle, Dumbbell, Plus, Trash2 } from 'lucide-react';

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
import { exerciseDefinitionLabel, exerciseIdentityKey, inferExerciseEquipment } from '@/lib/gymletics/exercise-library';
import { buildExerciseLog } from '@/lib/gymletics/session-builder';
import type {
  ExerciseLog,
  GymleticsData,
  PlanExercise,
  SetLog,
  WorkoutSession,
} from '@/lib/gymletics/types';

function cloneSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set })),
      ...(exercise.restPause ? { restPause: [...exercise.restPause] as [number, number] } : {}),
    })),
  };
}

function moveTimestampToDate(timestamp: string | undefined, date: string) {
  if (!timestamp) return undefined;
  const timeSeparator = timestamp.indexOf('T');
  return timeSeparator >= 0 ? `${date}${timestamp.slice(timeSeparator)}` : `${date}T12:00:00.000Z`;
}

function reindexSets(sets: SetLog[]) {
  let warmupIndex = 0;
  let workIndex = 0;
  return sets.map((set) => ({
    ...set,
    index: set.type === 'warmup' ? warmupIndex++ : workIndex++,
  }));
}

function setLabel(set: SetLog) {
  return set.type === 'warmup' ? `C${set.index + 1}` : String(set.index + 1);
}

export function SessionEditorDialog({
  data,
  session,
  updateData,
  onClose,
  onSaved,
  onDeleted,
}: {
  data: GymleticsData;
  session: WorkoutSession;
  updateData: (updater: (current: GymleticsData) => GymleticsData) => void;
  onClose: () => void;
  onSaved: (session: WorkoutSession) => void;
  onDeleted: (sessionId: string) => void;
}) {
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const [draft, setDraft] = useState(() => cloneSession(session));
  const [exerciseToAdd, setExerciseToAdd] = useState('');
  const [error, setError] = useState('');

  const exerciseLibrary = useMemo(() => {
    const unique = new Map<string, PlanExercise>();
    data.plans.forEach((plan) => plan.days.forEach((day) => day.exercises.forEach((exercise) => {
      const key = exercise.libraryExerciseId ?? exerciseIdentityKey({
        name: exercise.name,
        variant: exercise.variant ?? '',
        equipment: exercise.equipment || inferExerciseEquipment(exercise.name, exercise.unit),
        unit: exercise.unit,
      });
      if (!unique.has(key)) unique.set(key, exercise);
    })));
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [data.plans]);

  function updateExercise(exerciseId: string, recipe: (exercise: ExerciseLog) => ExerciseLog) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? recipe(exercise) : exercise),
    }));
  }

  function updateSet(exerciseId: string, setId: string, patch: Partial<SetLog>) {
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...patch } : set),
    }));
  }

  function addSet(exerciseId: string) {
    updateExercise(exerciseId, (exercise) => {
      const workingSets = exercise.sets.filter((set) => set.type === 'work');
      const reference = workingSets.at(-1);
      const set: SetLog = {
        id: uid('set'),
        index: workingSets.length,
        type: 'work',
        weight: reference?.weight ?? 0,
        reps: reference?.reps ?? exercise.targetReps,
        completed: false,
      };
      return { ...exercise, targetSets: workingSets.length + 1, sets: [...exercise.sets, set] };
    });
  }

  function removeSet(exerciseId: string, setId: string) {
    updateExercise(exerciseId, (exercise) => {
      const target = exercise.sets.find((set) => set.id === setId);
      const workingSets = exercise.sets.filter((set) => set.type === 'work');
      if (target?.type === 'work' && workingSets.length <= 1) return exercise;
      const sets = reindexSets(exercise.sets.filter((set) => set.id !== setId));
      return { ...exercise, targetSets: sets.filter((set) => set.type === 'work').length, sets };
    });
  }

  function updateRestPause(exerciseId: string, position: 0 | 1, value: number | null) {
    updateExercise(exerciseId, (exercise) => {
      const restPause: [number, number] = exercise.restPause ? [...exercise.restPause] : [0, 0];
      restPause[position] = Math.max(0, value ?? 0);
      if (restPause.every((repetitions) => repetitions === 0)) {
        const next = { ...exercise };
        delete next.restPause;
        return next;
      }
      return { ...exercise, restPause };
    });
  }

  function addExercise() {
    const exercise = exerciseLibrary.find((item) => item.id === exerciseToAdd);
    if (!exercise) return;
    if (draft.exercises.some((item) => exercise.libraryExerciseId
      ? item.libraryExerciseId === exercise.libraryExerciseId
      : item.exerciseName === exercise.name && item.unit === exercise.unit)) {
      setError('Este ejercicio y variante ya forman parte del entrenamiento.');
      return;
    }
    const sourcePlan = data.plans.find((plan) => plan.days.some((day) => day.exercises.some((item) => item.id === exercise.id)));
    const sourceDay = sourcePlan?.days.find((day) => day.exercises.some((item) => item.id === exercise.id));
    const sessionPlan = data.plans.find((plan) => plan.id === draft.planId) ?? sourcePlan ?? data.plans[0];
    const sessionDay = sessionPlan?.days.find((day) => day.id === draft.dayId) ?? sourceDay ?? sessionPlan?.days[0];
    if (!sessionPlan || !sessionDay) return;
    const log = buildExerciseLog(data, sessionPlan, sessionDay, exercise);
    setDraft((current) => ({ ...current, exercises: [...current.exercises, log] }));
    setExerciseToAdd('');
    setError('');
  }

  function removeExercise(exerciseId: string) {
    if (draft.exercises.length <= 1) return;
    setDraft((current) => ({ ...current, exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId) }));
  }

  function saveSession() {
    if (!draft.date || draft.date > todayIso) {
      setError('Selecciona una fecha válida que no esté en el futuro.');
      return;
    }
    if (!draft.exercises.some((exercise) => exercise.sets.some((set) => set.type === 'work' && set.completed))) {
      setError('Debe quedar al menos una serie de trabajo completada.');
      return;
    }

    const updated: WorkoutSession = {
      ...draft,
      startedAt: moveTimestampToDate(draft.startedAt, draft.date) ?? `${draft.date}T12:00:00.000Z`,
      completedAt: moveTimestampToDate(draft.completedAt, draft.date) ?? `${draft.date}T12:00:00.000Z`,
      cardioMinutes: Math.max(0, Number(draft.cardioMinutes) || 0),
    };
    const previousDate = session.date;

    updateData((current) => {
      const anotherOnPreviousDate = current.sessions.some(
        (item) => item.id !== session.id && item.status === 'completed' && item.date === previousDate,
      );
      const destinationMark = current.calendarMarks.find((mark) => mark.date === updated.date);
      const calendarMarks = current.calendarMarks.filter(
        (mark) => mark.date !== previousDate && mark.date !== updated.date,
      );
      if (anotherOnPreviousDate) calendarMarks.push({ date: previousDate, status: 'completed' });
      calendarMarks.push({
        date: updated.date,
        status: 'completed',
        ...(destinationMark?.note ? { note: destinationMark.note } : {}),
      });
      return {
        ...current,
        sessions: current.sessions.map((item) => item.id === updated.id ? updated : item),
        calendarMarks,
      };
    });
    onSaved(updated);
    onClose();
  }

  function deleteSession() {
    if (!window.confirm('¿Eliminar definitivamente este entrenamiento?')) return;
    updateData((current) => {
      const anotherOnDate = current.sessions.some(
        (item) => item.id !== session.id && item.status === 'completed' && item.date === session.date,
      );
      return {
        ...current,
        sessions: current.sessions.filter((item) => item.id !== session.id),
        calendarMarks: anotherOnDate
          ? current.calendarMarks
          : current.calendarMarks.filter((mark) => !(mark.date === session.date && mark.status === 'completed')),
      };
    });
    onDeleted(session.id);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar entrenamiento</DialogTitle>
          <DialogDescription>{draft.dayName} · {draft.focus}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <Label htmlFor="edit-session-date">Fecha</Label>
              <div className="relative mt-1 min-w-0">
                <Input id="edit-session-date" type="date" max={todayIso} className="gym-date-input h-10 min-w-0 pr-9" value={draft.date} onChange={(event) => { setDraft((current) => ({ ...current, date: event.target.value })); setError(''); }} />
                <CalendarDays aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-black/45 dark:text-white/45" />
              </div>
            </div>
            <div className="min-w-0">
              <Label htmlFor="edit-session-cardio">Cardio (min)</Label>
              <Input id="edit-session-cardio" type="number" inputMode="numeric" min={0} className="mt-1 h-10" value={draft.cardioMinutes} onChange={(event) => setDraft((current) => ({ ...current, cardioMinutes: Math.max(0, Number(event.target.value)) }))} />
            </div>
          </div>

          <div className="space-y-3">
            {draft.exercises.map((exercise) => (
              <section key={exercise.id} className="rounded-[20px] bg-black/4 p-3 dark:bg-white/6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-extrabold">{exerciseDefinitionLabel({ name: exercise.exerciseName, variant: exercise.variant ?? '' })}</p><p className="text-[10px] text-black/45 dark:text-white/45">{exercise.equipment} · {exercise.unit} · {exercise.muscleGroup}</p></div>
                  <Button type="button" aria-label={`Eliminar ${exercise.exerciseName}`} variant="ghost" size="icon-sm" className="shrink-0 text-red-600" disabled={draft.exercises.length <= 1} onClick={() => removeExercise(exercise.id)}><Trash2 /></Button>
                </div>

                <div className="mb-1 grid grid-cols-[28px_minmax(0,1fr)_64px_36px_28px] gap-1.5 px-1 text-[9px] font-bold uppercase text-black/35 dark:text-white/35"><span>#</span><span>Peso</span><span>Reps</span><span /><span /></div>
                <div className="space-y-1.5">
                  {exercise.sets.map((set) => (
                    <div key={set.id} className="grid grid-cols-[28px_minmax(0,1fr)_64px_36px_28px] items-center gap-1.5">
                      <span className="text-center text-[10px] font-black">{setLabel(set)}</span>
                      <DecimalWeightInput aria-label={`Peso de ${exercise.exerciseName}, serie ${set.index + 1}`} value={set.weight} onValueChange={(weight) => updateSet(exercise.id, set.id, { weight: weight ?? 0 })} className="h-10 rounded-xl text-center text-sm font-black" />
                      <EditableIntegerInput aria-label={`Repeticiones de ${exercise.exerciseName}, serie ${set.index + 1}`} value={set.reps} onValueChange={(reps) => updateSet(exercise.id, set.id, { reps: reps ?? 0 })} className="h-10 rounded-xl text-center text-sm font-black" />
                      <button type="button" aria-label={set.completed ? 'Marcar serie como no realizada' : 'Marcar serie como realizada'} onClick={() => updateSet(exercise.id, set.id, { completed: !set.completed })} className={`grid size-9 place-items-center rounded-full ${set.completed ? 'bg-emerald-500 text-white' : 'bg-black/8 text-black/30 dark:bg-white/10 dark:text-white/30'}`}>{set.completed ? <Check className="size-4" strokeWidth={3} /> : <Circle className="size-4" />}</button>
                      <Button type="button" aria-label="Eliminar serie" variant="ghost" size="icon-sm" className="size-7 text-red-600" disabled={set.type === 'work' && exercise.sets.filter((item) => item.type === 'work').length <= 1} onClick={() => removeSet(exercise.id, set.id)}><Trash2 className="size-3.5" /></Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-3 h-9 w-full rounded-full border-dashed bg-transparent" onClick={() => addSet(exercise.id)}><Plus /> Añadir serie</Button>

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

          <section className="rounded-[18px] border border-dashed border-black/15 p-3 dark:border-white/15">
            <div className="mb-2 flex items-center gap-2"><Dumbbell className="size-4" /><p className="text-sm font-extrabold">Añadir ejercicio</p></div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Select value={exerciseToAdd} onValueChange={(value) => setExerciseToAdd(value ?? '')}>
                <SelectTrigger className="h-10 min-w-0"><SelectValue placeholder="Elige de tus planes" /></SelectTrigger>
                <SelectContent>{exerciseLibrary.map((exercise) => <SelectItem key={exercise.id} value={exercise.id}>{exerciseDefinitionLabel({ name: exercise.name, variant: exercise.variant ?? '' })} · {exercise.equipment} · {exercise.unit}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" size="icon" disabled={!exerciseToAdd} onClick={addExercise}><Plus /></Button>
            </div>
          </section>

          {error ? <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="destructive" onClick={deleteSession}><Trash2 /> Eliminar</Button>
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="button" onClick={saveSession}><Check /> Guardar cambios</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
