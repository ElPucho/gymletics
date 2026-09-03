'use client';

import { useMemo, useState } from 'react';
import { format, startOfMonth, startOfWeek, startOfYear, subDays } from 'date-fns';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Dumbbell,
  History,
  Layers3,
  Medal,
  Repeat2,
  Target,
  Trophy,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  exerciseHistory,
  exercisePerformancePoint,
  personalRecordPoints,
  weeklyExerciseFrequency,
  type ExercisePerformancePoint,
} from '@/lib/gymletics/analysis';
import {
  exerciseDefinitionLabel,
  exerciseLogMatchesDefinition,
  findExerciseDefinition,
} from '@/lib/gymletics/exercise-library';
import { formatWeight } from '@/lib/gymletics/weight-format';
import type { ExerciseDefinition, GymleticsData, PlanExercise, WorkoutSession } from '@/lib/gymletics/types';
import { EmptyState } from './shared';

const performanceChart = {
  weight: { label: 'Peso', theme: { light: '#111111', dark: '#f5f5f5' } },
  reps: { label: 'Repeticiones', theme: { light: '#8a8a8a', dark: '#8a8a8a' } },
} satisfies ChartConfig;

type RangeMode = 'week' | 'month' | 'year' | 'custom';
type StrengthView = 'day' | 'exercise';
type ExerciseScope = 'active-plan' | 'history';

function rangeBounds(mode: RangeMode, customStart: string, customEnd: string) {
  const end = mode === 'custom' && customEnd ? new Date(`${customEnd}T23:59:59`) : new Date();
  const start = mode === 'week'
    ? startOfWeek(end, { weekStartsOn: 1 })
    : mode === 'month'
      ? startOfMonth(end)
      : mode === 'year'
        ? startOfYear(end)
        : customStart
          ? new Date(`${customStart}T00:00:00`)
          : subDays(end, 30);
  return { start, end };
}

function inBounds(date: string, start: Date, end: Date) {
  const value = new Date(`${date}T12:00:00`);
  return value >= start && value <= end;
}

function maxValue(points: ExercisePerformancePoint[], key: 'weight' | 'maxWeight' | 'e1rm') {
  return points.reduce((max, point) => Math.max(max, point[key]), 0);
}

function totalVolume(points: ExercisePerformancePoint[]) {
  return points.reduce((total, point) => total + point.volume, 0);
}

export function StrengthProgress({ data }: { data: GymleticsData }) {
  const [range, setRange] = useState<RangeMode>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [view, setView] = useState<StrengthView>('day');
  const [exerciseScope, setExerciseScope] = useState<ExerciseScope>('active-plan');
  const activePlan = data.plans.find((plan) => plan.id === data.activePlanId) ?? data.plans[0];
  const [selectedDayId, setSelectedDayId] = useState(activePlan?.days[0]?.id ?? '');
  const displayedDay = activePlan?.days.find((day) => day.id === selectedDayId) ?? activePlan?.days[0];
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const bounds = useMemo(() => rangeBounds(range, customStart, customEnd), [customEnd, customStart, range]);

  const filteredSessions = useMemo(() => data.sessions.filter(
    (session) => session.status === 'completed' && inBounds(session.date, bounds.start, bounds.end),
  ), [bounds.end, bounds.start, data.sessions]);

  const activeDefinitions = useMemo(() => {
    const ids = new Set(activePlan?.days.flatMap((day) => day.exercises.map((exercise) => exercise.libraryExerciseId).filter(Boolean)) ?? []);
    return data.exerciseLibrary.filter((definition) => ids.has(definition.id));
  }, [activePlan, data.exerciseLibrary]);
  const historicalDefinitions = useMemo(() => {
    const ids = new Set(data.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.libraryExerciseId).filter(Boolean)));
    return data.exerciseLibrary.filter((definition) => ids.has(definition.id));
  }, [data.exerciseLibrary, data.sessions]);
  const exerciseDefinitions = exerciseScope === 'active-plan' ? activeDefinitions : historicalDefinitions;
  const displayedExerciseId = exerciseDefinitions.some((exercise) => exercise.id === selectedExerciseId)
    ? selectedExerciseId
    : exerciseDefinitions[0]?.id ?? '';
  const displayedDefinition = data.exerciseLibrary.find((exercise) => exercise.id === displayedExerciseId);

  const daySessions = useMemo(() => filteredSessions
    .filter((session) => session.planId === activePlan?.id && session.dayId === displayedDay?.id)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8), [activePlan?.id, displayedDay?.id, filteredSessions]);

  const dayExercises = useMemo(() => {
    const seen = new Set<string>();
    return (displayedDay?.exercises ?? []).flatMap((exercise) => {
      const definition = findExerciseDefinition(data.exerciseLibrary, exercise);
      const key = definition?.id ?? exercise.id;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ exercise, definition }];
    });
  }, [data.exerciseLibrary, displayedDay?.exercises]);

  const allHistory = useMemo(
    () => displayedDefinition ? exerciseHistory(data, displayedDefinition) : [],
    [data, displayedDefinition],
  );
  const visibleHistory = useMemo(
    () => allHistory.filter((point) => inBounds(point.date, bounds.start, bounds.end)),
    [allHistory, bounds.end, bounds.start],
  );
  const records = useMemo(() => personalRecordPoints(allHistory), [allHistory]);
  const bestSeries = allHistory.reduce<ExercisePerformancePoint | undefined>(
    (best, point) => !best || point.e1rm > best.e1rm ? point : best,
    undefined,
  );
  const previousBounds = useMemo(() => {
    const duration = Math.max(1, bounds.end.getTime() - bounds.start.getTime());
    const end = new Date(bounds.start.getTime() - 1);
    return { start: new Date(end.getTime() - duration), end };
  }, [bounds.end, bounds.start]);
  const previousHistory = useMemo(
    () => allHistory.filter((point) => inBounds(point.date, previousBounds.start, previousBounds.end)),
    [allHistory, previousBounds.end, previousBounds.start],
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['week', 'month', 'year', 'custom'] as RangeMode[]).map((mode) => (
          <Button key={mode} size="sm" variant={range === mode ? 'default' : 'outline'} className="shrink-0 rounded-full" onClick={() => setRange(mode)}>{mode === 'week' ? 'Semana' : mode === 'month' ? 'Mes' : mode === 'year' ? 'Año' : 'Personalizado'}</Button>
        ))}
      </div>
      {range === 'custom' ? (
        <div className="mx-auto grid w-full max-w-[324px] grid-cols-2 gap-3">
          <DateField id="strength-start-date" label="Desde" value={customStart} onChange={setCustomStart} />
          <DateField id="strength-end-date" label="Hasta" value={customEnd} onChange={setCustomEnd} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 rounded-full bg-black/6 p-1 dark:bg-white/8">
        <button type="button" aria-pressed={view === 'day'} onClick={() => setView('day')} className={`h-10 rounded-full text-xs font-bold transition ${view === 'day' ? 'bg-black text-white shadow-sm dark:bg-white dark:text-black' : 'text-black/50 dark:text-white/50'}`}>Comparar día</button>
        <button type="button" aria-pressed={view === 'exercise'} onClick={() => setView('exercise')} className={`h-10 rounded-full text-xs font-bold transition ${view === 'exercise' ? 'bg-black text-white shadow-sm dark:bg-white dark:text-black' : 'text-black/50 dark:text-white/50'}`}>Ficha de ejercicio</button>
      </div>

      {view === 'day' ? (
        <DayComparison
          planName={activePlan?.name}
          days={activePlan?.days ?? []}
          selectedDayId={displayedDay?.id ?? ''}
          onDayChange={setSelectedDayId}
          dayExercises={dayExercises}
          sessions={daySessions}
        />
      ) : (
        <ExerciseDetail
          scope={exerciseScope}
          onScopeChange={setExerciseScope}
          activePlanName={activePlan?.name}
          definitions={exerciseDefinitions}
          selectedExerciseId={displayedExerciseId}
          onExerciseChange={setSelectedExerciseId}
          definition={displayedDefinition}
          allHistory={allHistory}
          visibleHistory={visibleHistory}
          previousHistory={previousHistory}
          records={records}
          bestSeries={bestSeries}
        />
      )}
    </div>
  );
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="min-w-0"><Label htmlFor={id}>{label}</Label><div className="relative mt-1 min-w-0"><Input id={id} className="gym-date-input h-10 min-w-0 pr-9 text-sm" type="date" value={value} onChange={(event) => onChange(event.target.value)} /><CalendarDays aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-black/45 dark:text-white/45" /></div></div>
  );
}

function DayComparison({
  planName,
  days,
  selectedDayId,
  onDayChange,
  dayExercises,
  sessions,
}: {
  planName?: string;
  days: GymleticsData['plans'][number]['days'];
  selectedDayId: string;
  onDayChange: (id: string) => void;
  dayExercises: Array<{ exercise: PlanExercise; definition?: ExerciseDefinition }>;
  sessions: WorkoutSession[];
}) {
  if (!days.length) return <EmptyState icon={Layers3} title="El plan no tiene días" description="Añade un día y sus ejercicios para crear la comparación." />;
  return (
    <div className="space-y-4">
      <div><Label>Día de entrenamiento</Label><Select value={selectedDayId} onValueChange={(value) => onDayChange(value ?? '')}><SelectTrigger className="mt-1 h-12 w-full rounded-[16px] bg-white px-4 font-bold dark:bg-[#1c1c1c]"><SelectValue placeholder="Selecciona un día" /></SelectTrigger><SelectContent>{days.map((day) => <SelectItem key={day.id} value={day.id}>{day.name} · {day.focus || 'Entrenamiento'}</SelectItem>)}</SelectContent></Select><p className="mt-2 flex items-center gap-2 px-1 text-xs text-black/45 dark:text-white/45"><Layers3 className="size-3.5" />{planName} · {sessions.length} sesiones comparadas</p></div>

      {!sessions.length ? <EmptyState icon={ChartNoAxesColumnIncreasing} title="No hay sesiones en este periodo" description="Completa este día o amplía el rango para comparar todos sus ejercicios." /> : (
        <Card className="overflow-hidden rounded-[24px] bg-white py-0 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10">
          <CardContent className="px-0 py-0">
            <div className="border-b border-black/6 px-4 py-3 dark:border-white/8"><p className="text-sm font-extrabold">Evolución conjunta</p><p className="mt-0.5 text-xs text-black/45 dark:text-white/45">Mejor serie de cada ejercicio en las últimas 8 sesiones del periodo.</p></div>
            <div className="overflow-x-auto">
              <table className="min-w-max border-collapse text-left text-xs">
                <thead><tr className="border-b border-black/6 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:border-white/8 dark:text-white/40"><th className="sticky left-0 z-10 min-w-40 bg-white px-4 py-3 dark:bg-[#1c1c1c]">Ejercicio</th>{sessions.map((session) => <th key={session.id} className="min-w-20 px-3 py-3 text-center">{format(new Date(`${session.date}T12:00:00`), 'dd/MM')}</th>)}<th className="min-w-24 px-3 py-3 text-center">Δ 1RM</th></tr></thead>
                <tbody>{dayExercises.map(({ exercise, definition }) => {
                  const points = sessions.map((session) => {
                    const log = session.exercises.find((item) => definition ? exerciseLogMatchesDefinition(item, definition) : item.planExerciseId === exercise.id);
                    return log ? exercisePerformancePoint(session, log) : null;
                  });
                  const available = points.filter((point): point is ExercisePerformancePoint => Boolean(point));
                  const delta = available.length > 1 ? (available.at(-1)?.e1rm ?? 0) - available[0].e1rm : 0;
                  return <tr key={definition?.id ?? exercise.id} className="border-b border-black/5 last:border-0 dark:border-white/6"><th className="sticky left-0 z-10 max-w-40 bg-white px-4 py-3 align-top dark:bg-[#1c1c1c]"><p className="max-w-36 truncate font-extrabold">{definition ? exerciseDefinitionLabel(definition) : exercise.name}</p><p className="mt-0.5 max-w-36 truncate text-[10px] font-medium text-black/40 dark:text-white/40">{definition?.equipment ?? exercise.equipment} · {definition?.unit ?? exercise.unit}</p></th>{points.map((point, index) => <td key={sessions[index].id} className="px-3 py-3 text-center">{point ? <><p className="font-black">{formatWeight(point.weight)}</p><p className="text-[10px] text-black/40 dark:text-white/40">× {point.reps}</p></> : <span className="text-black/20 dark:text-white/20">—</span>}</td>)}<td className="px-3 py-3 text-center">{available.length > 1 ? <Badge variant="outline" className={delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : ''}>{delta > 0 ? <ArrowUpRight /> : delta < 0 ? <ArrowDownRight /> : <Repeat2 />}{formatWeight(Math.abs(delta))}</Badge> : <span className="text-black/25 dark:text-white/25">—</span>}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ExerciseDetail({
  scope,
  onScopeChange,
  activePlanName,
  definitions,
  selectedExerciseId,
  onExerciseChange,
  definition,
  allHistory,
  visibleHistory,
  previousHistory,
  records,
  bestSeries,
}: {
  scope: ExerciseScope;
  onScopeChange: (scope: ExerciseScope) => void;
  activePlanName?: string;
  definitions: ExerciseDefinition[];
  selectedExerciseId: string;
  onExerciseChange: (id: string) => void;
  definition?: ExerciseDefinition;
  allHistory: ExercisePerformancePoint[];
  visibleHistory: ExercisePerformancePoint[];
  previousHistory: ExercisePerformancePoint[];
  records: ExercisePerformancePoint[];
  bestSeries?: ExercisePerformancePoint;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2"><div className="grid grid-cols-2 rounded-full bg-black/6 p-1 dark:bg-white/8"><button type="button" aria-pressed={scope === 'active-plan'} onClick={() => onScopeChange('active-plan')} className={`h-9 rounded-full text-xs font-bold transition ${scope === 'active-plan' ? 'bg-black text-white shadow-sm dark:bg-white dark:text-black' : 'text-black/50 dark:text-white/50'}`}>Plan actual</button><button type="button" aria-pressed={scope === 'history'} onClick={() => onScopeChange('history')} className={`h-9 rounded-full text-xs font-bold transition ${scope === 'history' ? 'bg-black text-white shadow-sm dark:bg-white dark:text-black' : 'text-black/50 dark:text-white/50'}`}>Todo el histórico</button></div><p className="flex items-center gap-2 px-1 text-xs text-black/45 dark:text-white/45"><Layers3 className="size-3.5" />{scope === 'active-plan' ? activePlanName ?? 'Sin plan activo' : `${definitions.length} ejercicios con historial`}</p></div>

      <Select value={selectedExerciseId} onValueChange={(value) => onExerciseChange(value ?? '')}><SelectTrigger className="h-12 w-full rounded-[16px] bg-white px-4 font-bold dark:bg-[#1c1c1c]"><SelectValue placeholder="Selecciona un ejercicio" /></SelectTrigger><SelectContent>{definitions.map((exercise) => <SelectItem key={exercise.id} value={exercise.id}>{exerciseDefinitionLabel(exercise)} · {exercise.equipment} · {exercise.unit}</SelectItem>)}</SelectContent></Select>

      {!definition ? <EmptyState icon={Dumbbell} title="No hay ejercicios disponibles" description="Añade ejercicios al plan o registra una sesión para crear sus fichas." /> : !allHistory.length ? <EmptyState icon={ChartNoAxesColumnIncreasing} title="Todavía no hay registros" description="Completa este ejercicio para crear su ficha de evolución." /> : (
        <>
          <Card className="rounded-[24px] bg-black py-4 text-white ring-0"><CardContent className="px-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Ficha de ejercicio</p><h2 className="mt-1 text-2xl font-black tracking-[-0.04em]">{exerciseDefinitionLabel(definition)}</h2><p className="mt-1 text-xs text-white/50">{definition.equipment} · {definition.unit} · {definition.muscleGroup}</p></div><Dumbbell className="size-6 text-white/30" /></div></CardContent></Card>

          <section className="grid grid-cols-2 gap-2">
            <Metric icon={Dumbbell} label="Mejor peso" value={`${formatWeight(maxValue(allHistory, 'maxWeight'))} ${definition.unit}`} />
            <Metric icon={Trophy} label="Mejor serie" value={bestSeries ? `${formatWeight(bestSeries.weight)} × ${bestSeries.reps}` : '—'} />
            <Metric icon={Target} label="1RM estimado" value={`${formatWeight(maxValue(allHistory, 'e1rm'))} ${definition.unit}`} />
            <Metric icon={History} label="Frecuencia" value={`${weeklyExerciseFrequency(allHistory).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/sem`} />
          </section>

          {visibleHistory.length ? <Card className="rounded-[24px] bg-white py-4 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="px-2"><div className="px-3"><p className="text-sm font-extrabold">Peso y repeticiones</p><p className="mt-0.5 text-xs text-black/45 dark:text-white/45">Evolución dentro del periodo seleccionado</p></div><ChartContainer config={performanceChart} className="mt-2 h-[240px] w-full"><LineChart data={visibleHistory.map((point) => ({ ...point, label: format(new Date(`${point.date}T12:00:00`), 'dd/MM') }))} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 5" /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis yAxisId="weight" hide domain={['dataMin - 2', 'dataMax + 2']} /><YAxis yAxisId="reps" hide orientation="right" domain={[0, 'dataMax + 2']} /><ChartTooltip content={<ChartTooltipContent valueFormatter={(value, name) => typeof value === 'number' ? name === 'weight' ? `${formatWeight(value)} ${definition.unit}` : `${value} reps` : String(value)} />} /><Line yAxisId="weight" dataKey="weight" type="monotone" stroke="var(--color-weight)" strokeWidth={3} dot={{ r: 3 }} /><Line yAxisId="reps" dataKey="reps" type="monotone" stroke="var(--color-reps)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} /></LineChart></ChartContainer></CardContent></Card> : <EmptyState icon={ChartNoAxesColumnIncreasing} title="Sin datos en este periodo" description="Amplía el rango para ver la evolución de este ejercicio." />}

          <PeriodComparison current={visibleHistory} previous={previousHistory} unit={definition.unit} />

          <Card className="rounded-[24px] bg-white py-4 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="px-4"><div className="mb-2 flex items-center gap-2"><History className="size-4" /><p className="text-sm font-extrabold">Últimas sesiones</p></div><div className="divide-y divide-black/6 dark:divide-white/8">{[...allHistory].reverse().slice(0, 5).map((point) => <div key={point.sessionId} className="flex items-center gap-3 py-2.5"><span className="w-14 text-[10px] font-bold text-black/40 dark:text-white/40">{format(new Date(`${point.date}T12:00:00`), 'dd/MM/yy')}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">{formatWeight(point.weight)} × {point.reps}</p><p className="truncate text-[10px] text-black/40 dark:text-white/40">{point.dayName} · 1RM {formatWeight(point.e1rm)}</p></div><span className="text-xs font-black">{formatWeight(point.volume)} kg</span></div>)}</div></CardContent></Card>

          <Card className="rounded-[24px] bg-[#deded9] py-4 ring-0 dark:bg-white/10"><CardContent className="px-4"><div className="mb-2 flex items-center gap-2"><Medal className="size-4" /><p className="text-sm font-extrabold">Récords personales</p><Badge className="ml-auto">{records.length}</Badge></div><div className="space-y-2">{[...records].reverse().slice(0, 4).map((point) => <div key={point.sessionId} className="flex items-center justify-between rounded-[14px] bg-white/65 px-3 py-2 dark:bg-black/20"><div><p className="text-xs font-extrabold">{format(new Date(`${point.date}T12:00:00`), 'dd MMM yyyy')}</p><p className="text-[10px] text-black/45 dark:text-white/45">{formatWeight(point.weight)} × {point.reps}</p></div><p className="text-sm font-black">1RM {formatWeight(point.e1rm)}</p></div>)}</div></CardContent></Card>
        </>
      )}
    </div>
  );
}

function PeriodComparison({ current, previous, unit }: { current: ExercisePerformancePoint[]; previous: ExercisePerformancePoint[]; unit: string }) {
  const rows = [
    { label: 'Mejor peso', current: maxValue(current, 'maxWeight'), previous: maxValue(previous, 'maxWeight'), suffix: unit },
    { label: '1RM estimado', current: maxValue(current, 'e1rm'), previous: maxValue(previous, 'e1rm'), suffix: unit },
    { label: 'Volumen', current: totalVolume(current), previous: totalVolume(previous), suffix: 'kg' },
  ];
  return <Card className="rounded-[24px] bg-black py-4 text-white ring-0"><CardContent className="px-4"><div className="mb-3 flex items-center gap-2"><Repeat2 className="size-4" /><div><p className="text-sm font-extrabold">Comparación entre periodos</p><p className="text-[10px] text-white/45">Periodo elegido frente al anterior de igual duración</p></div></div><div className="divide-y divide-white/10">{rows.map((row) => { const delta = previous.length ? row.current - row.previous : null; return <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5"><p className="text-xs font-semibold text-white/55">{row.label}</p><div className="text-right"><p className="text-xs font-black">{formatWeight(row.current)} {row.suffix}</p><p className="text-[9px] text-white/35">{previous.length ? `antes ${formatWeight(row.previous)}` : 'sin periodo anterior'}</p></div><Badge className={`min-w-16 justify-center ${delta !== null && delta > 0 ? 'bg-emerald-500 text-black' : delta !== null && delta < 0 ? 'bg-red-500 text-white' : 'bg-white/12 text-white'}`}>{delta === null ? '—' : `${delta > 0 ? '+' : ''}${formatWeight(delta)}`}</Badge></div>; })}</div></CardContent></Card>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Dumbbell; label: string; value: string }) {
  return <Card className="rounded-[18px] bg-white py-3 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><CardContent className="px-3"><Icon className="mb-3 size-4 text-black/35 dark:text-white/35" /><p className="truncate text-lg font-black tracking-tight">{value}</p><p className="mt-1 truncate text-[10px] font-semibold text-black/40 dark:text-white/40">{label}</p></CardContent></Card>;
}
