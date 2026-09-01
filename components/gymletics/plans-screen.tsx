'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Dumbbell,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DecimalWeightInput } from './decimal-weight-input';
import { ScreenHeader, SectionTitle } from './shared';
import { uid } from '@/lib/gymletics/defaults';
import type {
  GymleticsData,
  PlanExercise,
  RoutineDay,
  Technique,
  WeightUnit,
  WorkoutPlan,
} from '@/lib/gymletics/types';

const units: WeightUnit[] = ['kg', 'kg/lado', 'kg/mancuerna', 'peso corporal'];
const techniques: Array<{ value: Technique; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'rest-pause', label: 'Rest-pause' },
  { value: 'superserie', label: 'Superserie' },
  { value: 'biserie', label: 'Biserie' },
  { value: 'dropset', label: 'Dropset' },
  { value: 'al-fallo', label: 'Al fallo' },
];

type ExerciseDraft = Omit<PlanExercise, 'id'>;
const emptyExercise: ExerciseDraft = {
  name: '',
  muscleGroup: '',
  unit: 'kg',
  sets: 4,
  reps: 10,
  restSeconds: 60,
  increment: 2.5,
  technique: 'rest-pause',
  warmupSets: 0,
  unilateral: false,
};

export function PlansScreen({
  data,
  updateData,
}: {
  data: GymleticsData;
  updateData: (updater: (current: GymleticsData) => GymleticsData) => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(data.activePlanId);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [dayName, setDayName] = useState('');
  const [dayFocus, setDayFocus] = useState('');
  const [cardioMinutes, setCardioMinutes] = useState(20);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [exerciseDraft, setExerciseDraft] = useState<ExerciseDraft>(emptyExercise);

  const plan = data.plans.find((item) => item.id === selectedPlanId) ?? data.plans[0];
  const day = plan?.days.find((item) => item.id === selectedDayId) ?? plan?.days[0];

  const totalExercises = useMemo(
    () => plan?.days.reduce((total, item) => total + item.exercises.length, 0) ?? 0,
    [plan],
  );

  function updatePlan(recipe: (current: WorkoutPlan) => WorkoutPlan) {
    if (!plan) return;
    updateData((current) => ({
      ...current,
      plans: current.plans.map((item) =>
        item.id === plan.id ? { ...recipe(item), updatedAt: new Date().toISOString() } : item,
      ),
    }));
  }

  function openNewPlan() {
    setEditingPlanId(null);
    setPlanName('');
    setPlanDialogOpen(true);
  }

  function openEditPlan() {
    if (!plan) return;
    setEditingPlanId(plan.id);
    setPlanName(plan.name);
    setPlanDialogOpen(true);
  }

  function closePlanDialog() {
    setPlanDialogOpen(false);
    setEditingPlanId(null);
    setPlanName('');
  }

  function savePlan() {
    const name = planName.trim();
    if (!name) return;
    if (editingPlanId) {
      updateData((current) => ({
        ...current,
        plans: current.plans.map((item) => item.id === editingPlanId
          ? { ...item, name, updatedAt: new Date().toISOString() }
          : item),
      }));
      closePlanDialog();
      return;
    }

    const now = new Date().toISOString();
    const firstDay: RoutineDay = { id: uid('day'), name: 'Día 1', focus: '', exercises: [], cardioMinutes: 20 };
    const next: WorkoutPlan = { id: uid('plan'), name, days: [firstDay], createdAt: now, updatedAt: now };
    updateData((current) => ({
      ...current,
      plans: [...current.plans, next],
      activePlanId: current.plans.some((item) => item.id === current.activePlanId) ? current.activePlanId : next.id,
      nextDayByPlan: { ...current.nextDayByPlan, [next.id]: 0 },
    }));
    setSelectedPlanId(next.id);
    setSelectedDayId(firstDay.id);
    closePlanDialog();
  }

  function duplicatePlan() {
    if (!plan) return;
    const idMap = new Map<string, string>();
    const days = plan.days.map((item) => {
      const dayId = uid('day');
      idMap.set(item.id, dayId);
      return {
        ...item,
        id: dayId,
        exercises: item.exercises.map((exercise) => ({ ...exercise, id: uid('ex') })),
      };
    });
    const now = new Date().toISOString();
    const copy: WorkoutPlan = { ...plan, id: uid('plan'), name: `${plan.name} — copia`, days, createdAt: now, updatedAt: now };
    updateData((current) => ({
      ...current,
      plans: [...current.plans, copy],
      nextDayByPlan: { ...current.nextDayByPlan, [copy.id]: 0 },
    }));
    setSelectedPlanId(copy.id);
    setSelectedDayId(copy.days[0]?.id ?? '');
  }

  function activatePlan() {
    if (!plan) return;
    updateData((current) => ({ ...current, activePlanId: plan.id }));
  }

  function deletePlan() {
    const planToDelete = data.plans.find((item) => item.id === deletePlanId);
    if (!planToDelete) {
      setDeletePlanId(null);
      return;
    }
    const remaining = data.plans.filter((item) => item.id !== planToDelete.id);
    updateData((current) => ({
      ...current,
      plans: current.plans.filter((item) => item.id !== planToDelete.id),
      activePlanId: current.activePlanId === planToDelete.id ? (remaining[0]?.id ?? '') : current.activePlanId,
      nextDayByPlan: Object.fromEntries(
        Object.entries(current.nextDayByPlan).filter(([planId]) => planId !== planToDelete.id),
      ),
    }));
    setSelectedPlanId(remaining[0]?.id ?? '');
    setSelectedDayId(remaining[0]?.days[0]?.id ?? '');
    setDeletePlanId(null);
  }

  function openNewDay() {
    setEditingDayId(null);
    setDayName(`Día ${(plan?.days.length ?? 0) + 1}`);
    setDayFocus('');
    setCardioMinutes(20);
    setDayDialogOpen(true);
  }

  function openEditDay() {
    if (!day) return;
    setEditingDayId(day.id);
    setDayName(day.name);
    setDayFocus(day.focus);
    setCardioMinutes(day.cardioMinutes);
    setDayDialogOpen(true);
  }

  function saveDay() {
    if (!dayName.trim()) return;
    if (editingDayId) {
      updatePlan((current) => ({
        ...current,
        days: current.days.map((item) =>
          item.id === editingDayId
            ? { ...item, name: dayName.trim(), focus: dayFocus.trim(), cardioMinutes }
            : item,
        ),
      }));
    } else {
      const next: RoutineDay = {
        id: uid('day'),
        name: dayName.trim(),
        focus: dayFocus.trim(),
        cardioMinutes,
        exercises: [],
      };
      updatePlan((current) => ({ ...current, days: [...current.days, next] }));
      setSelectedDayId(next.id);
    }
    setDayDialogOpen(false);
  }

  function duplicateDay() {
    if (!day) return;
    const copy: RoutineDay = {
      ...day,
      id: uid('day'),
      name: `${day.name} copia`,
      exercises: day.exercises.map((item) => ({ ...item, id: uid('ex') })),
    };
    updatePlan((current) => ({ ...current, days: [...current.days, copy] }));
    setSelectedDayId(copy.id);
  }

  function deleteDay() {
    if (!day || !plan || plan.days.length <= 1) return;
    if (!window.confirm(`¿Eliminar ${day.name}?`)) return;
    const index = plan.days.findIndex((item) => item.id === day.id);
    const fallback = plan.days[index === 0 ? 1 : index - 1];
    updatePlan((current) => ({ ...current, days: current.days.filter((item) => item.id !== day.id) }));
    setSelectedDayId(fallback?.id ?? '');
  }

  function openNewExercise() {
    setEditingExerciseId(null);
    setExerciseDraft(emptyExercise);
    setExerciseDialogOpen(true);
  }

  function openEditExercise(exercise: PlanExercise) {
    const { id: _id, ...draft } = exercise;
    setEditingExerciseId(exercise.id);
    setExerciseDraft(draft);
    setExerciseDialogOpen(true);
  }

  function saveExercise() {
    if (!day || !exerciseDraft.name.trim()) return;
    const normalized = {
      ...exerciseDraft,
      name: exerciseDraft.name.trim(),
      muscleGroup: exerciseDraft.muscleGroup.trim() || 'General',
      sets: Math.max(1, exerciseDraft.sets),
      reps: Math.max(1, exerciseDraft.reps),
      restSeconds: Math.max(0, exerciseDraft.restSeconds),
      increment: Math.max(0, exerciseDraft.increment),
      warmupSets: Math.max(0, exerciseDraft.warmupSets),
    };
    updatePlan((current) => ({
      ...current,
      days: current.days.map((item) => {
        if (item.id !== day.id) return item;
        if (editingExerciseId) {
          return {
            ...item,
            exercises: item.exercises.map((exercise) =>
              exercise.id === editingExerciseId ? { ...normalized, id: exercise.id } : exercise,
            ),
          };
        }
        return { ...item, exercises: [...item.exercises, { ...normalized, id: uid('ex') }] };
      }),
    }));
    setExerciseDialogOpen(false);
  }

  function moveExercise(id: string, direction: -1 | 1) {
    if (!day) return;
    const index = day.exercises.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= day.exercises.length) return;
    updatePlan((current) => ({
      ...current,
      days: current.days.map((item) => {
        if (item.id !== day.id) return item;
        const exercises = [...item.exercises];
        [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
        return { ...item, exercises };
      }),
    }));
  }

  function duplicateExercise(exercise: PlanExercise) {
    if (!day) return;
    updatePlan((current) => ({
      ...current,
      days: current.days.map((item) =>
        item.id === day.id
          ? { ...item, exercises: [...item.exercises, { ...exercise, id: uid('ex'), name: `${exercise.name} copia` }] }
          : item,
      ),
    }));
  }

  function deleteExercise(id: string) {
    if (!day) return;
    updatePlan((current) => ({
      ...current,
      days: current.days.map((item) =>
        item.id === day.id ? { ...item, exercises: item.exercises.filter((exercise) => exercise.id !== id) } : item,
      ),
    }));
  }

  return (
    <div className="pb-28">
      <ScreenHeader
        title="Planes"
        subtitle={`${data.plans.length} guardado${data.plans.length === 1 ? '' : 's'}`}
        action={<Button size="sm" className="rounded-full" onClick={openNewPlan}><Plus /> Plan</Button>}
      />

      <div className="space-y-6 px-4 pt-4">
        {plan ? (
          <>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {data.plans.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedPlanId(item.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${item.id === plan.id ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-black/55 ring-1 ring-black/8 dark:bg-white/8 dark:text-white/55 dark:ring-white/10'}`}
            >
              {item.name}
            </button>
          ))}
        </div>

        <Card className="rounded-[24px] bg-[#0b0b0b] py-5 text-white ring-0">
          <CardContent className="px-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  {data.activePlanId === plan.id ? <Badge className="bg-white text-black"><Check /> Activo</Badge> : null}
                  <span className="text-xs font-semibold text-white/45">{plan.days.length} días · {totalExercises} ejercicios</span>
                </div>
                <h2 className="text-2xl font-black tracking-[-0.04em]">{plan.name}</h2>
              </div>
              <Dumbbell className="size-7 text-white/25" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {data.activePlanId !== plan.id ? <Button className="rounded-full bg-white text-black hover:bg-white/90" onClick={activatePlan}>Activar plan</Button> : <Button className="rounded-full bg-white/12 text-white hover:bg-white/20" disabled>Plan activo</Button>}
              <Button variant="outline" className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/10" onClick={openEditPlan}><Pencil /> Editar</Button>
              <Button variant="outline" className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/10" onClick={duplicatePlan}><Copy /> Duplicar</Button>
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-3 rounded-full px-2 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => setDeletePlanId(plan.id)}><Trash2 /> Eliminar plan</Button>
          </CardContent>
        </Card>

        <section>
          <SectionTitle
            eyebrow="Secuencia"
            title="Días del plan"
            action={<Button variant="outline" size="sm" className="rounded-full" onClick={openNewDay}><Plus /> Añadir</Button>}
          />
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {plan.days.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelectedDayId(item.id)}
                className={`min-w-24 shrink-0 rounded-[18px] p-3 text-left ring-1 transition ${item.id === day?.id ? 'bg-black text-white ring-black dark:bg-white dark:text-black dark:ring-white' : 'bg-white ring-black/7 dark:bg-[#1c1c1c] dark:ring-white/10'}`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-widest ${item.id === day?.id ? 'text-white/45 dark:text-black/45' : 'text-black/35 dark:text-white/35'}`}>{index + 1}</span>
                <p className="mt-2 truncate text-sm font-extrabold">{item.name}</p>
                <p className={`mt-0.5 truncate text-[11px] ${item.id === day?.id ? 'text-white/55 dark:text-black/55' : 'text-black/45 dark:text-white/45'}`}>{item.exercises.length} ejercicios</p>
              </button>
            ))}
          </div>
        </section>

        {day ? (
          <section>
            <div className="mb-3 flex items-start justify-between px-1">
              <div>
                <p className="eyebrow dark:text-white/40">{day.cardioMinutes} min de cardio</p>
                <h2 className="mt-0.5 text-2xl font-black tracking-[-0.04em]">{day.name}</h2>
                <p className="mt-0.5 text-sm text-black/45 dark:text-white/45">{day.focus || 'Sin enfoque indicado'}</p>
              </div>
              <div className="flex">
                <Button aria-label="Editar día" variant="ghost" size="icon" className="rounded-full" onClick={openEditDay}><Pencil /></Button>
                <Button aria-label="Duplicar día" variant="ghost" size="icon" className="rounded-full" onClick={duplicateDay}><Copy /></Button>
                <Button aria-label="Eliminar día" variant="ghost" size="icon" className="rounded-full text-red-600" onClick={deleteDay} disabled={plan.days.length <= 1}><Trash2 /></Button>
              </div>
            </div>

            <div className="space-y-2.5">
              {day.exercises.map((exercise, index) => (
                <Card key={exercise.id} className="rounded-[20px] bg-white py-3 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10">
                  <CardContent className="flex items-center gap-3 px-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eeeeea] text-xs font-black dark:bg-white/10">{String(index + 1).padStart(2, '0')}</div>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEditExercise(exercise)}>
                      <p className="truncate text-sm font-extrabold">{exercise.name}</p>
                      <p className="mt-0.5 truncate text-xs text-black/45 dark:text-white/45">{exercise.sets}×{exercise.reps} · {exercise.restSeconds}s · {techniques.find((item) => item.value === exercise.technique)?.label}</p>
                    </button>
                    <div className="flex items-center">
                      <div className="flex flex-col">
                        <button type="button" aria-label="Subir ejercicio" onClick={() => moveExercise(exercise.id, -1)} disabled={index === 0} className="grid size-6 place-items-center disabled:opacity-20"><ChevronUp className="size-3.5" /></button>
                        <button type="button" aria-label="Bajar ejercicio" onClick={() => moveExercise(exercise.id, 1)} disabled={index === day.exercises.length - 1} className="grid size-6 place-items-center disabled:opacity-20"><ChevronDown className="size-3.5" /></button>
                      </div>
                      <Button aria-label="Duplicar ejercicio" variant="ghost" size="icon-sm" onClick={() => duplicateExercise(exercise)}><Copy /></Button>
                      <Button aria-label="Eliminar ejercicio" variant="ghost" size="icon-sm" className="text-red-600" onClick={() => deleteExercise(exercise.id)}><Trash2 /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" className="h-12 w-full rounded-[18px] border-dashed bg-transparent" onClick={openNewExercise}><Plus /> Añadir ejercicio</Button>
            </div>
          </section>
        ) : null}
          </>
        ) : (
          <Card className="rounded-[24px] border-dashed bg-white py-8 ring-black/8 dark:bg-[#1c1c1c] dark:ring-white/10">
            <CardContent className="px-6 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black"><Dumbbell className="size-5" /></div>
              <h2 className="mt-4 text-xl font-black tracking-tight">No tienes planes guardados</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-black/50 dark:text-white/50">Crea un plan y añade los días y ejercicios que quieras. Tus entrenamientos anteriores siguen en el historial.</p>
              <Button className="mt-5 rounded-full" onClick={openNewPlan}><Plus /> Crear plan</Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={planDialogOpen} onOpenChange={(open) => { if (!open) closePlanDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlanId ? 'Editar plan' : 'Nuevo plan'}</DialogTitle>
            <DialogDescription>{editingPlanId ? 'Cambia el nombre del plan. Sus días, ejercicios e historial se conservarán.' : 'Crea una secuencia nueva. Después podrás añadir todos los días que quieras.'}</DialogDescription>
          </DialogHeader>
          <div><Label htmlFor="plan-name">Nombre</Label><Input id="plan-name" className="mt-1 h-11" value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Plan de hipertrofia" /></div>
          <DialogFooter><Button variant="outline" onClick={closePlanDialog}>Cancelar</Button><Button onClick={savePlan} disabled={!planName.trim()}>{editingPlanId ? 'Guardar cambios' : 'Crear plan'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletePlanId)} onOpenChange={(open) => { if (!open) setDeletePlanId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán el plan, sus días y su configuración. Los entrenamientos ya registrados se conservarán en el historial.{data.plans.length === 1 ? ' Después podrás crear un plan nuevo.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deletePlan}><Trash2 /> Eliminar definitivamente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingDayId ? 'Editar día' : 'Añadir día'}</DialogTitle><DialogDescription>El orden de las tarjetas será el orden de la secuencia.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="day-name">Nombre</Label><Input id="day-name" className="mt-1 h-10" value={dayName} onChange={(event) => setDayName(event.target.value)} /></div>
            <div><Label htmlFor="day-focus">Enfoque</Label><Input id="day-focus" className="mt-1 h-10" value={dayFocus} onChange={(event) => setDayFocus(event.target.value)} placeholder="Pecho y bíceps" /></div>
            <div><Label htmlFor="day-cardio">Cardio final (min)</Label><Input id="day-cardio" type="number" className="mt-1 h-10" value={cardioMinutes} onChange={(event) => setCardioMinutes(Number(event.target.value))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDayDialogOpen(false)}>Cancelar</Button><Button onClick={saveDay}>Guardar día</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exerciseDialogOpen} onOpenChange={setExerciseDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingExerciseId ? 'Editar ejercicio' : 'Añadir ejercicio'}</DialogTitle><DialogDescription>Configura la progresión y el registro de este ejercicio.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="exercise-name">Nombre</Label><Input id="exercise-name" className="mt-1 h-10" value={exerciseDraft.name} onChange={(event) => setExerciseDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Press inclinado con barra" /></div>
            <div><Label htmlFor="muscle-group">Grupo muscular</Label><Input id="muscle-group" className="mt-1 h-10" value={exerciseDraft.muscleGroup} onChange={(event) => setExerciseDraft((current) => ({ ...current, muscleGroup: event.target.value }))} placeholder="Pecho" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unidad</Label><Select value={exerciseDraft.unit} onValueChange={(value) => setExerciseDraft((current) => ({ ...current, unit: value as WeightUnit }))}><SelectTrigger className="mt-1 h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{units.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
              <div><Label htmlFor="increment">Incremento</Label><DecimalWeightInput id="increment" className="mt-1 h-10" value={exerciseDraft.increment} onValueChange={(increment) => setExerciseDraft((current) => ({ ...current, increment: increment ?? 0 }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label htmlFor="sets">Series</Label><Input id="sets" type="number" className="mt-1 h-10" value={exerciseDraft.sets} onChange={(event) => setExerciseDraft((current) => ({ ...current, sets: Number(event.target.value) }))} /></div>
              <div><Label htmlFor="reps">Reps</Label><Input id="reps" type="number" className="mt-1 h-10" value={exerciseDraft.reps} onChange={(event) => setExerciseDraft((current) => ({ ...current, reps: Number(event.target.value) }))} /></div>
              <div><Label htmlFor="rest">Descanso</Label><Input id="rest" type="number" className="mt-1 h-10" value={exerciseDraft.restSeconds} onChange={(event) => setExerciseDraft((current) => ({ ...current, restSeconds: Number(event.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Técnica</Label><Select value={exerciseDraft.technique} onValueChange={(value) => setExerciseDraft((current) => ({ ...current, technique: value as Technique }))}><SelectTrigger className="mt-1 h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{techniques.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label htmlFor="warmup">Calentamiento</Label><Input id="warmup" type="number" className="mt-1 h-10" value={exerciseDraft.warmupSets} onChange={(event) => setExerciseDraft((current) => ({ ...current, warmupSets: Number(event.target.value) }))} /></div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-black/4 p-3 dark:bg-white/6"><Label htmlFor="unilateral" className="block"><span className="block text-sm font-semibold">Ejercicio unilateral</span><span className="text-xs font-normal text-black/45 dark:text-white/45">Registra el peso por lado o miembro</span></Label><Switch id="unilateral" checked={exerciseDraft.unilateral} onCheckedChange={(checked) => setExerciseDraft((current) => ({ ...current, unilateral: checked }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setExerciseDialogOpen(false)}>Cancelar</Button><Button onClick={saveExercise}>Guardar ejercicio</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
