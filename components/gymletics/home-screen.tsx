'use client';

import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  isWithinInterval,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowRight,
  ChevronRight,
  Dumbbell,
  Flame,
  Layers3,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { BrandMark, SaveIndicator } from './shared';
import { sessionVolume } from '@/lib/gymletics/progression';
import { formatWeight } from '@/lib/gymletics/weight-format';
import type { GymleticsData, RoutineDay, WorkoutPlan } from '@/lib/gymletics/types';

const chartConfig = { volume: { label: 'Volumen', theme: { light: '#111111', dark: '#f5f5f5' } } } satisfies ChartConfig;

function calculateStreak(data: GymleticsData) {
  const statuses = data.calendarMarks
    .filter((mark) => ['completed', 'missed'].includes(mark.status))
    .sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const mark of statuses) {
    if (mark.status === 'missed') break;
    streak += 1;
  }
  return streak;
}

export function HomeScreen({
  data,
  plan,
  day,
  saveState,
  onStart,
  onSettings,
  onProgress,
}: {
  data: GymleticsData;
  plan?: WorkoutPlan;
  day?: RoutineDay;
  saveState: 'saved' | 'saving' | 'error';
  onStart: () => void;
  onSettings: () => void;
  onProgress: () => void;
}) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekSessions = data.sessions.filter(
    (session) =>
      session.status === 'completed' &&
      isWithinInterval(new Date(`${session.date}T12:00:00`), { start: weekStart, end: weekEnd }),
  );
  const weeklyVolume = weekSessions.reduce((total, session) => total + sessionVolume(session), 0);
  const targetSessions = plan?.days.length ?? 0;
  const streak = calculateStreak(data);
  const progressData = Array.from({ length: 6 }, (_, reverseIndex) => {
    const start = startOfWeek(subWeeks(now, 5 - reverseIndex), { weekStartsOn: 1 });
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return {
      week: `S${reverseIndex + 1}`,
      volume: Math.round(
        data.sessions
          .filter(
            (session) =>
              session.status === 'completed' &&
              isWithinInterval(new Date(`${session.date}T12:00:00`), { start, end }),
          )
          .reduce((total, session) => total + sessionVolume(session), 0) / 100,
      ) / 10,
    };
  });
  const lastVolume = progressData.at(-1)?.volume ?? 0;
  const previousVolume = progressData.at(-2)?.volume ?? 0;
  const change = previousVolume > 0 ? Math.round(((lastVolume - previousVolume) / previousVolume) * 100) : 0;

  return (
    <div className="pb-24">
      <section className="relative overflow-hidden bg-[#080808] px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <div className="absolute -right-24 top-10 h-56 w-56 rounded-full border border-white/10" />
        <div className="absolute -right-10 top-24 h-32 w-32 rounded-full border border-white/10" />
        <header className="relative flex items-center justify-between">
          <BrandMark />
          <div className="flex items-center gap-2">
            <SaveIndicator state={saveState} />
            <Button
              aria-label="Abrir ajustes"
              className="size-9 rounded-full border-white/15 bg-white/10 text-white hover:bg-white/20"
              size="icon"
              variant="outline"
              onClick={onSettings}
            >
              <Settings2 className="size-4.5" />
            </Button>
          </div>
        </header>

        <div className="relative mt-9">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
            <span className="size-1.5 rounded-full bg-white" />
            {plan?.name ?? 'Crea tu primer plan'}
          </div>
          <h1 className="display-heading max-w-[390px] text-[48px] font-black leading-[0.92] tracking-[-0.055em]">
            {day?.name.toLocaleUpperCase('es') ?? 'SIN PLAN'}
            <span className="mt-2 block text-[30px] font-semibold tracking-[-0.035em] text-white/55">
              {day?.focus || 'Configura tus entrenamientos'}
            </span>
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/65">
            <span><strong className="text-white">{day?.exercises.length ?? 0}</strong> ejercicios</span>
            <span><strong className="text-white">{day?.exercises.reduce((sum, item) => sum + item.sets, 0) ?? 0}</strong> series</span>
            <span><strong className="text-white">{day?.cardioMinutes ?? 0}</strong> min cardio</span>
          </div>

          <Button
            className="mt-7 h-13 w-full rounded-full bg-white px-5 text-[15px] font-bold text-black hover:bg-white/90"
            onClick={onStart}
            disabled={!day || !day.exercises.length}
          >
            Iniciar entrenamiento
            <ArrowRight className="ml-auto size-5" />
          </Button>
        </div>
      </section>

      <div className="space-y-5 px-4 pt-5">
        <section aria-labelledby="week-heading">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <p className="eyebrow dark:text-white/40">Tu semana</p>
              <h2 id="week-heading" className="mt-0.5 text-xl font-extrabold tracking-tight">
                {format(weekStart, 'd MMM', { locale: es })} — {format(weekEnd, 'd MMM', { locale: es })}
              </h2>
            </div>
            <Badge className="h-7 gap-1.5 rounded-full bg-black px-3 text-white dark:bg-white dark:text-black">
              <Flame className="size-3.5" /> {streak} días
            </Badge>
          </div>

          <Card className="rounded-[22px] bg-white py-4 ring-black/6 shadow-[0_8px_28px_rgba(0,0,0,0.05)] dark:bg-[#1c1c1c] dark:ring-white/10">
            <CardContent className="grid grid-cols-7 gap-1 px-3">
              {weekDays.map((date) => {
                const iso = format(date, 'yyyy-MM-dd');
                const completed = data.sessions.some((session) => session.status === 'completed' && session.date === iso);
                const missed = data.calendarMarks.some((mark) => mark.date === iso && mark.status === 'missed');
                const today = isSameDay(date, now);
                return (
                  <div key={iso} className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-black/40 dark:text-white/40">{format(date, 'EEEEE', { locale: es }).toUpperCase()}</span>
                    <div className={`grid size-9 place-items-center rounded-full text-sm font-bold ${today ? 'bg-black text-white ring-4 ring-black/10 dark:bg-white dark:text-black dark:ring-white/10' : completed ? 'bg-[#deded9] text-black dark:bg-white/15 dark:text-white' : missed ? 'border border-black/20 text-black/45 line-through dark:border-white/20 dark:text-white/45' : 'text-black/50 dark:text-white/50'}`}>
                      {format(date, 'dd')}
                    </div>
                    <span className={`size-1 rounded-full ${completed || today ? 'bg-black dark:bg-white' : missed ? 'bg-red-500' : 'bg-transparent'}`} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-2 gap-3" aria-label="Resumen semanal">
          <Card className="rounded-[22px] bg-[#deded9] py-4 ring-0 dark:bg-white/12">
            <CardContent className="px-4">
              <div className="mb-6 grid size-9 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
                <Layers3 className="size-4" />
              </div>
              <p className="text-3xl font-black tracking-[-0.05em]">{weekSessions.length}/{targetSessions}</p>
              <p className="mt-1 text-xs font-semibold text-black/50 dark:text-white/50">Sesiones completadas</p>
            </CardContent>
          </Card>
          <Card className="rounded-[22px] bg-white py-4 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10">
            <CardContent className="px-4">
              <div className="mb-6 flex items-start justify-between">
                <div className="grid size-9 place-items-center rounded-full bg-[#eeeeea] dark:bg-white/10">
                  <Sparkles className="size-4" />
                </div>
                <span className="text-xs font-bold">{change >= 0 ? '+' : ''}{change}%</span>
              </div>
              <p className="text-3xl font-black tracking-[-0.05em]">{formatWeight(weeklyVolume, { useGrouping: true })} kg</p>
              <p className="mt-1 text-xs font-semibold text-black/50 dark:text-white/50">Volumen semanal</p>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-[24px] bg-white py-0 ring-black/6 shadow-[0_8px_28px_rgba(0,0,0,0.04)] dark:bg-[#1c1c1c] dark:ring-white/10">
          <CardHeader className="flex-row items-center justify-between px-4 pb-0 pt-4">
            <div>
              <p className="eyebrow dark:text-white/40">Progreso</p>
              <CardTitle className="mt-1 text-lg font-extrabold">Volumen total</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={onProgress}>
              6 semanas <ChevronRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-1">
            {data.sessions.length ? (
              <ChartContainer config={chartConfig} className="h-[150px] w-full">
                <AreaChart data={progressData} margin={{ left: 8, right: 8, top: 20 }}>
                  <defs>
                    <linearGradient id="fillHomeVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-volume)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-volume)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 5" />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Area dataKey="volume" type="monotone" fill="url(#fillHomeVolume)" stroke="var(--color-volume)" strokeWidth={2.5} dot={{ fill: '#fff', stroke: '#111', strokeWidth: 2, r: 3 }} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[150px] flex-col items-center justify-center text-center">
                <Dumbbell className="mb-2 size-5 text-black/30 dark:text-white/30" />
                <p className="text-sm font-semibold">Tu gráfica comenzará con la primera sesión</p>
                <p className="mt-1 text-xs text-black/45 dark:text-white/45">Cada serie completada cuenta.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
