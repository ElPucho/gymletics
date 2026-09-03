'use client';

import { useMemo, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import {
  BookOpen,
  Clock3,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createExerciseDefinition,
  exerciseDefinitionLabel,
  exerciseIdentityKey,
  normalizeExercisePart,
} from '@/lib/gymletics/exercise-library';
import type { ExerciseDefinition, GymleticsData, WeightUnit } from '@/lib/gymletics/types';
import { EmptyState, ScreenHeader } from './shared';

const units: WeightUnit[] = ['kg', 'kg/lado', 'kg/mancuerna', 'peso corporal'];
const MAX_GIF_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

type LibrarySort = 'recent' | 'alphabetical';
type ExerciseDraft = Pick<ExerciseDefinition, 'name' | 'variant' | 'equipment' | 'muscleGroup' | 'unit'> & {
  mediaDataUrl: string;
  mediaFileName: string;
};

const emptyDraft: ExerciseDraft = {
  name: '',
  variant: '',
  equipment: '',
  muscleGroup: '',
  unit: 'kg',
  mediaDataUrl: '',
  mediaFileName: '',
};

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('No se pudo leer el archivo.'));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function prepareExerciseMedia(file: File) {
  const isGif = file.type === 'image/gif' || file.name.toLocaleLowerCase('es').endsWith('.gif');
  if (!file.type.startsWith('image/') && !isGif) throw new Error('Selecciona una imagen o un GIF válido.');
  if (isGif) {
    if (file.size > MAX_GIF_BYTES) throw new Error('El GIF supera el límite de 8 MB.');
    return readDataUrl(file);
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error('La imagen supera el límite de 20 MB.');
  const source = await readDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    element.src = source;
  });
  const maxSize = 1100;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la imagen.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function lastUsedLabel(date?: string) {
  if (!date) return 'Sin entrenar';
  const parsed = new Date(`${date}T12:00:00`);
  if (isToday(parsed)) return 'Usado hoy';
  if (isYesterday(parsed)) return 'Usado ayer';
  return `Último ${format(parsed, 'dd/MM/yyyy')}`;
}

export function ExerciseLibraryScreen({
  data,
  updateData,
}: {
  data: GymleticsData;
  updateData: (updater: (current: GymleticsData) => GymleticsData) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ExerciseDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaInputKey, setMediaInputKey] = useState(0);

  const usage = useMemo(() => {
    const stats = new Map<string, { sessionCount: number; planCount: number; lastDate?: string }>();
    for (const definition of data.exerciseLibrary) stats.set(definition.id, { sessionCount: 0, planCount: 0 });
    for (const plan of data.plans) {
      const usedInPlan = new Set(plan.days.flatMap((day) => day.exercises
        .map((exercise) => exercise.libraryExerciseId)
        .filter((exerciseId): exerciseId is string => Boolean(exerciseId))));
      for (const exerciseId of usedInPlan) {
        const current = stats.get(exerciseId);
        if (current) current.planCount += 1;
      }
    }
    for (const session of data.sessions.filter((item) => item.status === 'completed')) {
      const usedInSession = new Set(session.exercises
        .map((exercise) => exercise.libraryExerciseId)
        .filter((exerciseId): exerciseId is string => Boolean(exerciseId)));
      for (const exerciseId of usedInSession) {
        const current = stats.get(exerciseId);
        if (!current) continue;
        current.sessionCount += 1;
        if (!current.lastDate || session.date > current.lastDate) current.lastDate = session.date;
      }
    }
    return stats;
  }, [data.exerciseLibrary, data.plans, data.sessions]);

  const latestDate = useMemo(() => [...usage.values()].reduce<string | undefined>(
    (latest, item) => item.lastDate && (!latest || item.lastDate > latest) ? item.lastDate : latest,
    undefined,
  ), [usage]);

  const filtered = useMemo(() => {
    const query = normalizeExercisePart(search);
    const result = data.exerciseLibrary.filter((exercise) => !query || normalizeExercisePart([
      exercise.name,
      exercise.variant,
      exercise.equipment,
      exercise.muscleGroup,
      exercise.unit,
    ].join(' ')).includes(query));
    return result.sort((a, b) => {
      if (sort === 'recent') {
        const dateOrder = (usage.get(b.id)?.lastDate ?? '').localeCompare(usage.get(a.id)?.lastDate ?? '');
        if (dateOrder) return dateOrder;
      }
      return exerciseDefinitionLabel(a).localeCompare(exerciseDefinitionLabel(b), 'es');
    });
  }, [data.exerciseLibrary, search, sort, usage]);

  function openNew() {
    setEditingId(null);
    setDraft(emptyDraft);
    setError('');
    setMediaInputKey((value) => value + 1);
    setEditorOpen(true);
  }

  function editDefinition(exercise: ExerciseDefinition) {
    setEditingId(exercise.id);
    setDraft({
      name: exercise.name,
      variant: exercise.variant,
      equipment: exercise.equipment,
      muscleGroup: exercise.muscleGroup,
      unit: exercise.unit,
      mediaDataUrl: exercise.mediaDataUrl ?? '',
      mediaFileName: exercise.mediaFileName ?? '',
    });
    setError('');
    setMediaInputKey((value) => value + 1);
    setEditorOpen(true);
  }

  async function selectMedia(file?: File) {
    if (!file) return;
    setMediaBusy(true);
    setError('');
    try {
      const mediaDataUrl = await prepareExerciseMedia(file);
      setDraft((current) => ({ ...current, mediaDataUrl, mediaFileName: file.name }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo añadir el archivo.');
    } finally {
      setMediaBusy(false);
    }
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
    setError('');
  }

  function saveDefinition() {
    if (!draft.name.trim()) {
      setError('Escribe el nombre del ejercicio.');
      return;
    }
    const base = createExerciseDefinition(draft, editingId ?? undefined);
    const definition: ExerciseDefinition = {
      ...base,
      mediaDataUrl: draft.mediaDataUrl || undefined,
      mediaFileName: draft.mediaFileName || undefined,
    };
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
    closeEditor();
  }

  function deleteDefinition(exerciseId: string) {
    const stats = usage.get(exerciseId);
    if ((stats?.planCount ?? 0) > 0 || (stats?.sessionCount ?? 0) > 0) return;
    updateData((current) => ({
      ...current,
      exerciseLibrary: current.exerciseLibrary.filter((exercise) => exercise.id !== exerciseId),
    }));
  }

  return (
    <div className="pb-28">
      <ScreenHeader title="Biblioteca" subtitle={`${data.exerciseLibrary.length} ejercicios`} action={<Button size="sm" className="rounded-full" onClick={openNew}><Plus /> Añadir</Button>} />
      <div className="space-y-4 px-4 pt-4">
        {editorOpen ? (
          <Card className="rounded-[24px] bg-white py-4 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10">
            <CardContent className="space-y-3 px-4">
              <div className="flex items-center gap-2">{editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}<p className="text-sm font-extrabold">{editingId ? 'Editar ejercicio' : 'Nuevo ejercicio'}</p><Button type="button" aria-label="Cerrar editor" variant="ghost" size="icon-sm" className="ml-auto rounded-full" onClick={closeEditor}><X /></Button></div>

              {draft.mediaDataUrl ? <div className="h-48 w-full rounded-[18px] bg-black/5 bg-contain bg-center bg-no-repeat dark:bg-white/5" style={{ backgroundImage: `url(${draft.mediaDataUrl})` }}><span className="sr-only">Vista previa de {draft.name || 'ejercicio'}</span></div> : null}
              <div className="grid grid-cols-[1fr_auto] gap-2"><div><Label htmlFor="library-media">Imagen o GIF</Label><Input key={mediaInputKey} id="library-media" type="file" accept="image/*,.gif" className="mt-1 h-10 min-w-0" disabled={mediaBusy} onChange={(event) => void selectMedia(event.target.files?.[0])} /><p className="mt-1 text-[10px] text-black/40 dark:text-white/40">Las imágenes se comprimen. GIF animado: máximo 8 MB.</p></div>{draft.mediaDataUrl ? <Button type="button" variant="outline" size="icon" className="mt-6" aria-label="Eliminar imagen" onClick={() => setDraft((current) => ({ ...current, mediaDataUrl: '', mediaFileName: '' }))}><Trash2 /></Button> : null}</div>
              <div><Label htmlFor="library-name">Ejercicio</Label><Input id="library-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-10" placeholder="Press inclinado" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="library-variant">Variante</Label><Input id="library-variant" value={draft.variant} onChange={(event) => setDraft((current) => ({ ...current, variant: event.target.value }))} className="mt-1 h-10" placeholder="Agarre neutro" /></div>
                <div><Label htmlFor="library-equipment">Máquina/equipo</Label><Input id="library-equipment" value={draft.equipment} onChange={(event) => setDraft((current) => ({ ...current, equipment: event.target.value }))} className="mt-1 h-10" placeholder="Hammer MTS" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="library-muscle">Grupo muscular</Label><Input id="library-muscle" value={draft.muscleGroup} onChange={(event) => setDraft((current) => ({ ...current, muscleGroup: event.target.value }))} className="mt-1 h-10" placeholder="Pecho" /></div>
                <div><Label>Unidad</Label><Select value={draft.unit} onValueChange={(value) => setDraft((current) => ({ ...current, unit: value as WeightUnit }))}><SelectTrigger className="mt-1 h-10 w-full"><SelectValue>{draft.unit}</SelectValue></SelectTrigger><SelectContent>{units.map((unit) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent></Select></div>
              </div>
              {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
              <Button type="button" className="h-11 w-full rounded-full" disabled={mediaBusy} onClick={saveDefinition}>{mediaBusy ? <ImagePlus className="animate-pulse" /> : editingId ? <Pencil /> : <Plus />}{mediaBusy ? 'Preparando archivo…' : editingId ? 'Guardar cambios' : 'Añadir a la biblioteca'}</Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/35 dark:text-white/35" /><Input aria-label="Buscar en la biblioteca" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-full pl-9" placeholder="Buscar ejercicio, máquina o músculo" /></div>
        <div className="grid grid-cols-2 rounded-full bg-black/6 p-1 dark:bg-white/8"><button type="button" aria-pressed={sort === 'recent'} onClick={() => setSort('recent')} className={`h-9 rounded-full text-xs font-bold transition ${sort === 'recent' ? 'bg-black text-white shadow-sm dark:bg-white dark:text-black' : 'text-black/50 dark:text-white/50'}`}>Uso reciente</button><button type="button" aria-pressed={sort === 'alphabetical'} onClick={() => setSort('alphabetical')} className={`h-9 rounded-full text-xs font-bold transition ${sort === 'alphabetical' ? 'bg-black text-white shadow-sm dark:bg-white dark:text-black' : 'text-black/50 dark:text-white/50'}`}>Orden A–Z</button></div>

        {filtered.length ? (
          <div className="space-y-2">
            {filtered.map((exercise) => {
              const stats = usage.get(exercise.id);
              const isLatest = Boolean(stats?.lastDate && stats.lastDate === latestDate);
              const canDelete = !stats?.planCount && !stats?.sessionCount;
              return (
                <Card key={exercise.id} className={`overflow-hidden rounded-[20px] py-0 ring-black/6 dark:ring-white/10 ${isLatest ? 'bg-[#deded9] dark:bg-white/12' : 'bg-white dark:bg-[#1c1c1c]'}`}>
                  <CardContent className="flex items-center gap-3 px-3 py-3">
                    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[16px] bg-black/6 bg-cover bg-center dark:bg-white/8" style={exercise.mediaDataUrl ? { backgroundImage: `url(${exercise.mediaDataUrl})` } : undefined}>{exercise.mediaDataUrl ? <span className="sr-only">Imagen de {exerciseDefinitionLabel(exercise)}</span> : <BookOpen className="size-5 text-black/25 dark:text-white/25" />}</div>
                    <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-extrabold">{exerciseDefinitionLabel(exercise)}</p>{isLatest ? <Badge className="shrink-0 text-[9px]">Última sesión</Badge> : null}</div><p className="mt-0.5 truncate text-xs text-black/45 dark:text-white/45">{exercise.equipment} · {exercise.unit} · {exercise.muscleGroup}</p><div className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold text-black/40 dark:text-white/40"><span className="flex items-center gap-1"><Clock3 className="size-3" />{lastUsedLabel(stats?.lastDate)}</span><span>·</span><span>{stats?.sessionCount ?? 0} sesiones</span></div></div>
                    <div className="flex shrink-0 flex-col"><Button type="button" aria-label={`Editar ${exerciseDefinitionLabel(exercise)}`} variant="ghost" size="icon-sm" onClick={() => editDefinition(exercise)}><Pencil /></Button><Button type="button" aria-label={`Eliminar ${exerciseDefinitionLabel(exercise)}`} variant="ghost" size="icon-sm" className="text-red-600" disabled={!canDelete} onClick={() => deleteDefinition(exercise.id)}><Trash2 /></Button></div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : <EmptyState icon={Search} title="No hay coincidencias" description="Prueba con otro nombre, máquina o grupo muscular." />}
      </div>
    </div>
  );
}
