'use client';

import { useMemo, useState } from 'react';
import { format, startOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  ChartNoAxesColumnIncreasing,
  Dumbbell,
  Images,
  Plus,
  Scale,
  Target,
  Trash2,
  Trophy,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DecimalWeightInput } from './decimal-weight-input';
import { EmptyState, ScreenHeader } from './shared';
import { uid } from '@/lib/gymletics/defaults';
import { estimatedOneRepMax } from '@/lib/gymletics/progression';
import { formatWeight } from '@/lib/gymletics/weight-format';
import type { GymleticsData, PhotoPose, ProgressPhoto, WorkoutSession } from '@/lib/gymletics/types';

const weightChart = {
  weight: { label: 'Peso', theme: { light: '#111111', dark: '#f5f5f5' } },
  e1rm: { label: '1RM estimado', theme: { light: '#777777', dark: '#a3a3a3' } },
} satisfies ChartConfig;
const bodyChart = {
  weight: { label: 'Peso', theme: { light: '#111111', dark: '#f5f5f5' } },
  fat: { label: '% grasa', theme: { light: '#777777', dark: '#a3a3a3' } },
  muscle: { label: '% musculatura', theme: { light: '#bbbbbb', dark: '#666666' } },
} satisfies ChartConfig;
const adherenceChart = {
  completed: { label: 'Completados', theme: { light: '#111111', dark: '#f5f5f5' } },
  missed: { label: 'Incumplidos', theme: { light: '#c8c8c8', dark: '#575757' } },
} satisfies ChartConfig;

type RangeMode = 'week' | 'month' | 'year' | 'custom';

function startForRange(mode: RangeMode, customStart: string) {
  const now = new Date();
  if (mode === 'week') return startOfWeek(now, { weekStartsOn: 1 });
  if (mode === 'month') return startOfMonth(now);
  if (mode === 'year') return startOfYear(now);
  return customStart ? new Date(`${customStart}T00:00:00`) : subDays(now, 30);
}

function sessionDate(session: WorkoutSession) {
  return new Date(`${session.date}T12:00:00`);
}

async function compressImage(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
  const maxSize = 1400;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export function ProgressScreen({
  data,
  updateData,
}: {
  data: GymleticsData;
  updateData: (updater: (current: GymleticsData) => GymleticsData) => void;
}) {
  const [range, setRange] = useState<RangeMode>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const exerciseNames = useMemo(() => {
    const names = new Set<string>();
    data.plans.forEach((plan) => plan.days.forEach((day) => day.exercises.forEach((exercise) => names.add(exercise.name))));
    data.sessions.forEach((session) => session.exercises.forEach((exercise) => names.add(exercise.exerciseName)));
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }, [data.plans, data.sessions]);
  const [selectedExercise, setSelectedExercise] = useState(exerciseNames[0] ?? '');
  const [metricDialogOpen, setMetricDialogOpen] = useState(false);
  const [metricDate, setMetricDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [metricWeight, setMetricWeight] = useState<number | null>(null);
  const [metricFat, setMetricFat] = useState('');
  const [metricMuscle, setMetricMuscle] = useState('');
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoDate, setPhotoDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [photoPose, setPhotoPose] = useState<PhotoPose>('frontal');
  const [photoData, setPhotoData] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');

  const filteredSessions = useMemo(() => {
    const start = startForRange(range, customStart);
    const end = range === 'custom' && customEnd ? new Date(`${customEnd}T23:59:59`) : new Date();
    return data.sessions.filter((session) => session.status === 'completed' && sessionDate(session) >= start && sessionDate(session) <= end);
  }, [customEnd, customStart, data.sessions, range]);

  const exerciseData = useMemo(
    () =>
      filteredSessions
        .flatMap((session) =>
          session.exercises
            .filter((exercise) => exercise.exerciseName === selectedExercise)
            .map((exercise) => {
              const sets = exercise.sets.filter((set) => set.completed && set.type === 'work');
              const best = sets.reduce((current, set) =>
                estimatedOneRepMax(set.weight, set.reps) > estimatedOneRepMax(current.weight, current.reps) ? set : current,
              { weight: 0, reps: 0 });
              return {
                date: session.date,
                label: format(sessionDate(session), 'dd/MM'),
                weight: sets.reduce((max, set) => Math.max(max, set.weight), 0),
                reps: sets.reduce((max, set) => Math.max(max, set.reps), 0),
                e1rm: estimatedOneRepMax(best.weight, best.reps),
                volume: sets.reduce((total, set) => total + set.weight * set.reps, 0),
              };
            }),
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [filteredSessions, selectedExercise],
  );

  const bodyData = [...data.bodyMetrics]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((metric) => ({ label: format(new Date(`${metric.date}T12:00:00`), 'dd/MM'), weight: metric.weight, fat: metric.fatPercent, muscle: metric.musclePercent }));
  const latestBody = [...data.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date))[0];
  const bodyPrevious = [...data.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date))[1];
  const photos = [...data.photos].sort((a, b) => a.date.localeCompare(b.date));
  const firstPhoto = photos.find((photo) => photo.id === compareA) ?? photos[0];
  const secondPhoto = photos.find((photo) => photo.id === compareB) ?? photos.at(-1);

  const adherenceData = Array.from({ length: 6 }, (_, reverseIndex) => {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() - (5 - reverseIndex));
    const month = format(monthDate, 'yyyy-MM');
    return {
      month: format(monthDate, 'MMM').slice(0, 3),
      completed: data.sessions.filter((session) => session.status === 'completed' && session.date.startsWith(month)).length,
      missed: data.calendarMarks.filter((mark) => mark.status === 'missed' && mark.date.startsWith(month)).length,
    };
  });

  function saveMetric() {
    if (!metricDate || metricWeight === null) return;
    updateData((current) => ({
      ...current,
      bodyMetrics: [
        ...current.bodyMetrics.filter((metric) => metric.date !== metricDate),
        { id: uid('metric'), date: metricDate, weight: metricWeight, fatPercent: Number(metricFat || 0), musclePercent: Number(metricMuscle || 0) },
      ],
    }));
    setMetricWeight(null);
    setMetricDialogOpen(false);
  }

  async function readPhoto(file?: File) {
    if (!file) return;
    setPhotoBusy(true);
    try { setPhotoData(await compressImage(file)); } finally { setPhotoBusy(false); }
  }

  function savePhoto() {
    if (!photoData) return;
    const photo: ProgressPhoto = { id: uid('photo'), date: photoDate, pose: photoPose, dataUrl: photoData };
    updateData((current) => ({ ...current, photos: [...current.photos, photo] }));
    setPhotoData('');
    setPhotoDialogOpen(false);
  }

  return (
    <div className="pb-28">
      <ScreenHeader title="Progreso" subtitle="Evolución y comparativas" />
      <div className="px-4 pt-4">
        <Tabs defaultValue="exercises">
          <TabsList className="grid h-10 w-full grid-cols-4 rounded-full bg-black/6 p-1 dark:bg-white/8">
            <TabsTrigger value="exercises" className="rounded-full text-xs">Fuerza</TabsTrigger>
            <TabsTrigger value="body" className="rounded-full text-xs">Cuerpo</TabsTrigger>
            <TabsTrigger value="photos" className="rounded-full text-xs">Fotos</TabsTrigger>
            <TabsTrigger value="adherence" className="rounded-full text-xs">Ritmo</TabsTrigger>
          </TabsList>

          <TabsContent value="exercises" className="mt-5 space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {(['week', 'month', 'year', 'custom'] as RangeMode[]).map((mode) => (
                <Button key={mode} size="sm" variant={range === mode ? 'default' : 'outline'} className="shrink-0 rounded-full" onClick={() => setRange(mode)}>{mode === 'week' ? 'Semana' : mode === 'month' ? 'Mes' : mode === 'year' ? 'Año' : 'Personalizado'}</Button>
              ))}
            </div>
            {range === 'custom' ? <div className="grid grid-cols-2 gap-2"><Input aria-label="Fecha inicial" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /><Input aria-label="Fecha final" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></div> : null}

            <Select value={selectedExercise} onValueChange={(value) => setSelectedExercise(value ?? '')}>
              <SelectTrigger className="h-12 w-full rounded-[16px] bg-white px-4 font-bold dark:bg-[#1c1c1c]"><SelectValue placeholder="Selecciona un ejercicio" /></SelectTrigger>
              <SelectContent>{exerciseNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
            </Select>

            {exerciseData.length ? (
              <>
                <section className="grid grid-cols-3 gap-2">
                  <Stat icon={Dumbbell} label="Carga máx." value={`${formatWeight(Math.max(...exerciseData.map((item) => item.weight)))} kg`} />
                  <Stat icon={Trophy} label="1RM estimado" value={`${formatWeight(Math.max(...exerciseData.map((item) => item.e1rm)))} kg`} />
                  <Stat icon={Target} label="Volumen" value={`${Math.round(exerciseData.reduce((sum, item) => sum + item.volume, 0) / 1000)}k`} />
                </section>
                <Card className="rounded-[24px] bg-white py-4 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10">
                  <CardContent className="px-2"><p className="px-3 text-sm font-extrabold">Carga y fuerza estimada</p><ChartContainer config={weightChart} className="mt-2 h-[230px] w-full"><LineChart data={exerciseData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 5" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis hide domain={['dataMin - 5', 'dataMax + 5']} /><ChartTooltip content={<ChartTooltipContent valueFormatter={(value) => typeof value === 'number' ? `${formatWeight(value)} kg` : String(value)} />} /><Line dataKey="weight" type="monotone" stroke="var(--color-weight)" strokeWidth={3} dot={{ r: 3 }} /><Line dataKey="e1rm" type="monotone" stroke="var(--color-e1rm)" strokeWidth={2} strokeDasharray="5 5" dot={false} /></LineChart></ChartContainer></CardContent>
                </Card>
                <Card className="rounded-[24px] bg-black py-5 text-white ring-0"><CardContent className="px-5"><p className="text-xs font-bold uppercase tracking-wider text-white/40">Comparación del periodo</p><div className="mt-4 flex items-end justify-between"><div><p className="text-4xl font-black tracking-[-0.05em]">{formatWeight(exerciseData.at(-1)?.weight ?? 0)} kg</p><p className="mt-1 text-sm text-white/50">Última carga registrada</p></div>{exerciseData.length > 1 ? <Badge className="bg-white text-black">{(exerciseData.at(-1)?.weight ?? 0) >= exerciseData[0].weight ? <ArrowUpRight /> : <ArrowDownRight />}{formatWeight(Math.abs((exerciseData.at(-1)?.weight ?? 0) - exerciseData[0].weight))} kg</Badge> : null}</div></CardContent></Card>
              </>
            ) : <EmptyState icon={ChartNoAxesColumnIncreasing} title="Todavía no hay registros" description="Completa este ejercicio para crear su primera gráfica comparable." />}
          </TabsContent>

          <TabsContent value="body" className="mt-5 space-y-4">
            <Button className="h-11 w-full rounded-full" onClick={() => setMetricDialogOpen(true)}><Plus /> Registrar medición</Button>
            {latestBody ? (
              <>
                <section className="grid grid-cols-3 gap-2"><Stat icon={Scale} label="Peso" value={`${formatWeight(latestBody.weight)} kg`} delta={bodyPrevious ? latestBody.weight - bodyPrevious.weight : undefined} /><Stat icon={Target} label="Grasa" value={`${latestBody.fatPercent}%`} delta={bodyPrevious ? latestBody.fatPercent - bodyPrevious.fatPercent : undefined} /><Stat icon={Dumbbell} label="Músculo" value={`${latestBody.musclePercent}%`} delta={bodyPrevious ? latestBody.musclePercent - bodyPrevious.musclePercent : undefined} /></section>
                <Card className="rounded-[24px] bg-white py-4 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="px-2"><p className="px-3 text-sm font-extrabold">Composición corporal</p><ChartContainer config={bodyChart} className="mt-3 h-[240px] w-full"><LineChart data={bodyData} margin={{ left: 0, right: 12, top: 12 }}><CartesianGrid vertical={false} strokeDasharray="3 5" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis hide /><ChartTooltip content={<ChartTooltipContent valueFormatter={(value, name) => typeof value === 'number' ? name === 'weight' ? `${formatWeight(value)} kg` : `${formatWeight(value)} %` : String(value)} />} /><Line dataKey="weight" stroke="var(--color-weight)" strokeWidth={3} dot={{ r: 3 }} /><Line dataKey="fat" stroke="var(--color-fat)" strokeWidth={2} dot={false} /><Line dataKey="muscle" stroke="var(--color-muscle)" strokeWidth={2} dot={false} /></LineChart></ChartContainer></CardContent></Card>
                <div className="space-y-2">{[...data.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date)).map((metric) => <Card key={metric.id} className="rounded-[18px] bg-white py-3 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="flex items-center gap-3 px-3"><div className="grid size-10 place-items-center rounded-full bg-black text-xs font-black text-white dark:bg-white dark:text-black">{format(new Date(`${metric.date}T12:00:00`), 'dd')}</div><div className="flex-1"><p className="text-sm font-extrabold">{formatWeight(metric.weight)} kg</p><p className="text-xs text-black/45 dark:text-white/45">Grasa {metric.fatPercent}% · Músculo {metric.musclePercent}%</p></div><Button aria-label="Eliminar medición" variant="ghost" size="icon-sm" className="text-red-600" onClick={() => updateData((current) => ({ ...current, bodyMetrics: current.bodyMetrics.filter((item) => item.id !== metric.id) }))}><Trash2 /></Button></CardContent></Card>)}</div>
              </>
            ) : <EmptyState icon={Scale} title="Registra tu punto de partida" description="Añade peso, porcentaje de grasa y porcentaje de musculatura." action={<Button onClick={() => setMetricDialogOpen(true)}>Añadir medición</Button>} />}
          </TabsContent>

          <TabsContent value="photos" className="mt-5 space-y-4">
            <Button className="h-11 w-full rounded-full" onClick={() => setPhotoDialogOpen(true)}><Camera /> Añadir fotografía</Button>
            {photos.length ? (
              <>
                <Card className="rounded-[24px] bg-black py-4 text-white ring-0"><CardContent className="px-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-white/40">Antes y después</p><p className="mt-1 text-lg font-extrabold">Comparador visual</p></div><Images className="text-white/30" /></div><div className="grid grid-cols-2 gap-2"><PhotoFrame photo={firstPhoto} /><PhotoFrame photo={secondPhoto} /></div></CardContent></Card>
                <div className="grid grid-cols-2 gap-2"><Select value={firstPhoto?.id ?? ''} onValueChange={(value) => setCompareA(value ?? '')}><SelectTrigger className="w-full"><SelectValue placeholder="Primera" /></SelectTrigger><SelectContent>{photos.map((photo) => <SelectItem key={photo.id} value={photo.id}>{photo.date} · {photo.pose}</SelectItem>)}</SelectContent></Select><Select value={secondPhoto?.id ?? ''} onValueChange={(value) => setCompareB(value ?? '')}><SelectTrigger className="w-full"><SelectValue placeholder="Segunda" /></SelectTrigger><SelectContent>{photos.map((photo) => <SelectItem key={photo.id} value={photo.id}>{photo.date} · {photo.pose}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-3 gap-2">{photos.map((photo) => <div key={photo.id} className="group relative aspect-[3/4] overflow-hidden rounded-[16px] bg-black/5"><img src={photo.dataUrl} alt={`${photo.pose} del ${photo.date}`} className="h-full w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 text-white"><p className="text-[10px] font-bold uppercase">{photo.pose}</p><p className="text-[10px] text-white/60">{photo.date}</p></div><button type="button" aria-label="Eliminar fotografía" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/70 text-white" onClick={() => updateData((current) => ({ ...current, photos: current.photos.filter((item) => item.id !== photo.id) }))}><Trash2 className="size-3.5" /></button></div>)}</div>
              </>
            ) : <EmptyState icon={Camera} title="Tu evolución visual" description="Guarda fotos frontales, laterales y de espalda. Se almacenan solo en este dispositivo." action={<Button onClick={() => setPhotoDialogOpen(true)}>Añadir foto</Button>} />}
          </TabsContent>

          <TabsContent value="adherence" className="mt-5 space-y-4">
            <section className="grid grid-cols-2 gap-2"><Stat icon={Dumbbell} label="Sesiones totales" value={String(data.sessions.filter((session) => session.status === 'completed').length)} /><Stat icon={Target} label="Incumplidas" value={String(data.calendarMarks.filter((mark) => mark.status === 'missed').length)} /></section>
            <Card className="rounded-[24px] bg-white py-4 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="px-2"><p className="px-3 text-sm font-extrabold">Frecuencia mensual</p><ChartContainer config={adherenceChart} className="mt-3 h-[240px] w-full"><BarChart data={adherenceData} margin={{ left: 4, right: 8, top: 10 }}><CartesianGrid vertical={false} strokeDasharray="3 5" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis hide allowDecimals={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="completed" fill="var(--color-completed)" radius={[6, 6, 0, 0]} /><Bar dataKey="missed" fill="var(--color-missed)" radius={[6, 6, 0, 0]} /></BarChart></ChartContainer></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={metricDialogOpen} onOpenChange={setMetricDialogOpen}><DialogContent><DialogHeader><DialogTitle>Nueva medición</DialogTitle><DialogDescription>Registra los tres datos juntos para comparar su evolución.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label htmlFor="metric-date">Fecha</Label><Input id="metric-date" type="date" className="mt-1 h-10" value={metricDate} onChange={(event) => setMetricDate(event.target.value)} /></div><div><Label htmlFor="metric-weight">Peso (kg)</Label><DecimalWeightInput id="metric-weight" className="mt-1 h-10" value={metricWeight} onValueChange={setMetricWeight} placeholder="0,00" /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="metric-fat">Grasa (%)</Label><Input id="metric-fat" type="number" inputMode="decimal" className="mt-1 h-10" value={metricFat} onChange={(event) => setMetricFat(event.target.value)} /></div><div><Label htmlFor="metric-muscle">Musculatura (%)</Label><Input id="metric-muscle" type="number" inputMode="decimal" className="mt-1 h-10" value={metricMuscle} onChange={(event) => setMetricMuscle(event.target.value)} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setMetricDialogOpen(false)}>Cancelar</Button><Button onClick={saveMetric}>Guardar</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}><DialogContent><DialogHeader><DialogTitle>Nueva fotografía</DialogTitle><DialogDescription>La imagen se comprimirá y quedará guardada únicamente en este dispositivo.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label htmlFor="photo-file">Fotografía</Label><Input id="photo-file" type="file" accept="image/*" capture="environment" className="mt-1 h-11" onChange={(event) => readPhoto(event.target.files?.[0])} /></div>{photoData ? <img src={photoData} alt="Vista previa" className="mx-auto max-h-56 rounded-2xl object-contain" /> : null}<div className="grid grid-cols-2 gap-3"><div><Label htmlFor="photo-date">Fecha</Label><Input id="photo-date" type="date" className="mt-1 h-10" value={photoDate} onChange={(event) => setPhotoDate(event.target.value)} /></div><div><Label>Postura</Label><Select value={photoPose} onValueChange={(value) => setPhotoPose(value as PhotoPose)}><SelectTrigger className="mt-1 h-10 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="frontal">Frontal</SelectItem><SelectItem value="lateral">Lateral</SelectItem><SelectItem value="espalda">Espalda</SelectItem></SelectContent></Select></div></div></div><DialogFooter><Button variant="outline" onClick={() => setPhotoDialogOpen(false)}>Cancelar</Button><Button onClick={savePhoto} disabled={!photoData || photoBusy}>{photoBusy ? 'Comprimiendo…' : 'Guardar foto'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value, delta }: { icon: typeof Dumbbell; label: string; value: string; delta?: number }) {
  return <Card className="rounded-[18px] bg-white py-3 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="px-3"><Icon className="mb-3 size-4 text-black/35 dark:text-white/35" /><p className="truncate text-lg font-black tracking-tight">{value}</p><div className="mt-1 flex items-center gap-1"><p className="truncate text-[10px] font-semibold text-black/40 dark:text-white/40">{label}</p>{delta !== undefined && delta !== 0 ? <span className={`text-[9px] font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{delta > 0 ? '+' : '−'}{Math.abs(delta).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> : null}</div></CardContent></Card>;
}

function PhotoFrame({ photo }: { photo?: ProgressPhoto }) {
  return <div className="relative aspect-[3/4] overflow-hidden rounded-[16px] bg-white/10">{photo ? <><img src={photo.dataUrl} alt={`${photo.pose} del ${photo.date}`} className="h-full w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-2 pt-8"><p className="text-[10px] font-bold uppercase">{photo.pose}</p><p className="text-[10px] text-white/55">{photo.date}</p></div></> : <div className="grid h-full place-items-center"><Camera className="text-white/25" /></div>}</div>;
}
