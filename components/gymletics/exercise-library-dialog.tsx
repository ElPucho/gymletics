'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createExerciseDefinition,
  exerciseDefinitionLabel,
  exerciseIdentityKey,
  normalizeExercisePart,
} from '@/lib/gymletics/exercise-library';
import type { GymleticsData, WeightUnit } from '@/lib/gymletics/types';

const units: WeightUnit[] = ['kg', 'kg/lado', 'kg/mancuerna', 'peso corporal'];

const emptyDraft = {
  name: '',
  variant: '',
  equipment: '',
  muscleGroup: '',
  unit: 'kg' as WeightUnit,
};

export function ExerciseLibraryDialog({
  data,
  updateData,
  open,
  onOpenChange,
}: {
  data: GymleticsData;
  updateData: (updater: (current: GymleticsData) => GymleticsData) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const query = normalizeExercisePart(search);
    if (!query) return data.exerciseLibrary;
    return data.exerciseLibrary.filter((exercise) => normalizeExercisePart([
      exercise.name,
      exercise.variant,
      exercise.equipment,
      exercise.muscleGroup,
      exercise.unit,
    ].join(' ')).includes(query));
  }, [data.exerciseLibrary, search]);

  function usageCount(exerciseId: string) {
    const plans = data.plans.reduce((total, plan) => total + plan.days.reduce(
      (dayTotal, day) => dayTotal + day.exercises.filter((exercise) => exercise.libraryExerciseId === exerciseId).length,
      0,
    ), 0);
    const sessions = data.sessions.reduce(
      (total, session) => total + session.exercises.filter((exercise) => exercise.libraryExerciseId === exerciseId).length,
      0,
    );
    return plans + sessions;
  }

  function saveDefinition() {
    if (!draft.name.trim()) {
      setError('Escribe el nombre del ejercicio.');
      return;
    }
    const definition = createExerciseDefinition(draft, editingId ?? undefined);
    if (data.exerciseLibrary.some((item) => item.id !== editingId && exerciseIdentityKey(item) === exerciseIdentityKey(definition))) {
      setError('Ya existe un ejercicio con el mismo nombre, variante, equipo y unidad.');
      return;
    }
    updateData((current) => {
      if (!editingId) {
        return {
          ...current,
          exerciseLibrary: [...current.exerciseLibrary, definition]
            .sort((a, b) => exerciseDefinitionLabel(a).localeCompare(exerciseDefinitionLabel(b), 'es')),
        };
      }
      const previous = current.exerciseLibrary.find((item) => item.id === editingId);
      const updated = { ...definition, createdAt: previous?.createdAt ?? definition.createdAt, updatedAt: new Date().toISOString() };
      return {
        ...current,
        exerciseLibrary: current.exerciseLibrary.map((item) => item.id === editingId ? updated : item)
          .sort((a, b) => exerciseDefinitionLabel(a).localeCompare(exerciseDefinitionLabel(b), 'es')),
        plans: current.plans.map((plan) => ({
          ...plan,
          days: plan.days.map((day) => ({
            ...day,
            exercises: day.exercises.map((exercise) => exercise.libraryExerciseId === editingId ? {
              ...exercise,
              name: updated.name,
              variant: updated.variant,
              equipment: updated.equipment,
              muscleGroup: updated.muscleGroup,
              unit: updated.unit,
            } : exercise),
          })),
        })),
        sessions: current.sessions.map((session) => ({
          ...session,
          exercises: session.exercises.map((exercise) => exercise.libraryExerciseId === editingId ? {
            ...exercise,
            exerciseName: updated.name,
            variant: updated.variant,
            equipment: updated.equipment,
            muscleGroup: updated.muscleGroup,
            unit: updated.unit,
          } : exercise),
        })),
      };
    });
    setDraft(emptyDraft);
    setEditingId(null);
    setError('');
  }

  function editDefinition(exerciseId: string) {
    const exercise = data.exerciseLibrary.find((item) => item.id === exerciseId);
    if (!exercise) return;
    setDraft({ name: exercise.name, variant: exercise.variant, equipment: exercise.equipment, muscleGroup: exercise.muscleGroup, unit: exercise.unit });
    setEditingId(exercise.id);
    setError('');
  }

  function cancelEdit() {
    setDraft(emptyDraft);
    setEditingId(null);
    setError('');
  }

  function deleteDefinition(exerciseId: string) {
    if (usageCount(exerciseId)) return;
    updateData((current) => ({
      ...current,
      exerciseLibrary: current.exerciseLibrary.filter((exercise) => exercise.id !== exerciseId),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Biblioteca de ejercicios</DialogTitle>
          <DialogDescription>Cada combinación de nombre, variante, equipo y unidad mantiene un historial independiente.</DialogDescription>
        </DialogHeader>

        <Card className="rounded-[20px] bg-black/4 py-4 ring-0 dark:bg-white/6">
          <CardContent className="space-y-3 px-4">
            <div className="flex items-center gap-2">{editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}<p className="text-sm font-extrabold">{editingId ? 'Editar definición' : 'Nueva definición'}</p>{editingId ? <Button type="button" aria-label="Cancelar edición" variant="ghost" size="icon-sm" className="ml-auto rounded-full" onClick={cancelEdit}><X /></Button> : null}</div>
            <div><Label htmlFor="library-name">Ejercicio</Label><Input id="library-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-10" placeholder="Press inclinado" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="library-variant">Variante</Label><Input id="library-variant" value={draft.variant} onChange={(event) => setDraft((current) => ({ ...current, variant: event.target.value }))} className="mt-1 h-10" placeholder="Agarre neutro" /></div>
              <div><Label htmlFor="library-equipment">Máquina/equipo</Label><Input id="library-equipment" value={draft.equipment} onChange={(event) => setDraft((current) => ({ ...current, equipment: event.target.value }))} className="mt-1 h-10" placeholder="Hammer MTS" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="library-muscle">Grupo muscular</Label><Input id="library-muscle" value={draft.muscleGroup} onChange={(event) => setDraft((current) => ({ ...current, muscleGroup: event.target.value }))} className="mt-1 h-10" placeholder="Pecho" /></div>
              <div><Label>Unidad</Label><Select value={draft.unit} onValueChange={(value) => setDraft((current) => ({ ...current, unit: value as WeightUnit }))}><SelectTrigger className="mt-1 h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{units.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
            </div>
            {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
            <Button type="button" className="h-10 w-full rounded-full" onClick={saveDefinition}>{editingId ? <Pencil /> : <Plus />}{editingId ? 'Guardar definición' : 'Añadir a la biblioteca'}</Button>
          </CardContent>
        </Card>

        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/35 dark:text-white/35" /><Input aria-label="Buscar en la biblioteca" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-full pl-9" placeholder="Buscar ejercicio, máquina o músculo" /></div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><BookOpen className="size-4" /><p className="text-sm font-extrabold">{filtered.length} ejercicios</p></div><Badge variant="outline">Sin duplicados</Badge></div>
          {filtered.map((exercise) => {
            const usages = usageCount(exercise.id);
            return (
              <Card key={exercise.id} className="rounded-[18px] bg-white py-3 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10">
                <CardContent className="flex items-center gap-3 px-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{exerciseDefinitionLabel(exercise)}</p><p className="mt-0.5 truncate text-xs text-black/45 dark:text-white/45">{exercise.equipment} · {exercise.unit} · {exercise.muscleGroup}</p></div>
                  <Badge variant="secondary">{usages} usos</Badge>
                  <Button type="button" aria-label={`Editar ${exerciseDefinitionLabel(exercise)}`} variant="ghost" size="icon-sm" onClick={() => editDefinition(exercise.id)}><Pencil /></Button>
                  <Button type="button" aria-label={`Eliminar ${exerciseDefinitionLabel(exercise)}`} variant="ghost" size="icon-sm" className="text-red-600" disabled={usages > 0} onClick={() => deleteDefinition(exercise.id)}><Trash2 /></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
