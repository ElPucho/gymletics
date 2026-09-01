'use client';

import { useMemo, useState, type ComponentProps } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarCheck2,
  Check,
  ChevronRight,
  CircleDashed,
  Clock3,
  Dumbbell,
  Flame,
  HeartPulse,
  Moon,
  Palmtree,
  Plus,
  RotateCw,
  Stethoscope,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ManualWorkoutDialog } from './manual-workout-dialog';
import { ScreenHeader, SectionTitle } from './shared';
import { formatWeight } from '@/lib/gymletics/weight-format';
import type { CalendarStatus, GymleticsData, WorkoutSession } from '@/lib/gymletics/types';

const statuses: Array<{ value: CalendarStatus; label: string; description: string; icon: typeof Check }> = [
  { value: 'completed', label: 'Completado', description: 'Cuenta para la racha', icon: Check },
  { value: 'pending', label: 'Pendiente', description: 'Todavía debes realizarlo', icon: Clock3 },
  { value: 'rescheduled', label: 'Aplazado', description: 'Pasa a otra fecha', icon: RotateCw },
  { value: 'rest', label: 'Descanso', description: 'Descanso previsto', icon: CircleDashed },
  { value: 'vacation', label: 'Vacaciones', description: 'No rompe la racha', icon: Palmtree },
  { value: 'illness', label: 'Enfermedad', description: 'No rompe la racha', icon: Stethoscope },
  { value: 'excused', label: 'Justificado', description: 'Ausencia justificada', icon: HeartPulse },
  { value: 'missed', label: 'Incumplido', description: 'Rompe la racha', icon: X },
];

function StatusCalendarDayButton(props: ComponentProps<typeof CalendarDayButton>) {
  const status = props.modifiers.completed
    ? 'completed'
    : props.modifiers.missed
      ? 'missed'
      : props.modifiers.pending
        ? 'pending'
        : props.modifiers.rest
          ? 'rest'
          : null;

  return (
    <CalendarDayButton {...props}>
      {props.children}
      {status === 'completed' ? <i aria-hidden className="pointer-events-none absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-emerald-500" /> : null}
      {status === 'missed' ? <i aria-hidden className="pointer-events-none absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-red-500" /> : null}
      {status === 'pending' ? <i aria-hidden className="pointer-events-none absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-amber-500" /> : null}
      {status === 'rest' ? <Moon aria-hidden className="pointer-events-none absolute bottom-0.5 left-1/2 size-2.5 -translate-x-1/2 fill-current text-black/40 dark:text-white/45" /> : null}
    </CalendarDayButton>
  );
}

export function CalendarScreen({
  data,
  updateData,
}: {
  data: GymleticsData;
  updateData: (updater: (current: GymleticsData) => GymleticsData) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [sessionDialog, setSessionDialog] = useState<WorkoutSession | null>(null);
  const [manualDate, setManualDate] = useState<string | null>(null);
  const iso = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedMark = data.calendarMarks.find((mark) => mark.date === iso);
  const selectedSession = data.sessions.find((session) => session.status === 'completed' && session.date === iso);
  const completedDateKeys = new Set([
    ...data.sessions.filter((session) => session.status === 'completed').map((session) => session.date),
    ...data.calendarMarks.filter((mark) => mark.status === 'completed').map((mark) => mark.date),
  ]);
  const completedDates = [...completedDateKeys].map((date) => new Date(`${date}T12:00:00`));
  const missedDates = data.calendarMarks.filter((mark) => mark.status === 'missed' && !completedDateKeys.has(mark.date)).map((mark) => new Date(`${mark.date}T12:00:00`));
  const pendingDates = data.calendarMarks.filter((mark) => mark.status === 'pending' && !completedDateKeys.has(mark.date)).map((mark) => new Date(`${mark.date}T12:00:00`));
  const restDates = data.calendarMarks.filter((mark) => mark.status === 'rest' && !completedDateKeys.has(mark.date)).map((mark) => new Date(`${mark.date}T12:00:00`));
  const excusedDates = data.calendarMarks.filter((mark) => ['vacation', 'illness', 'excused', 'rescheduled'].includes(mark.status) && !completedDateKeys.has(mark.date)).map((mark) => new Date(`${mark.date}T12:00:00`));
  const recentSessions = [...data.sessions].filter((session) => session.status === 'completed').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  const streak = useMemo(() => {
    const effectiveMarks = new Map(data.calendarMarks.map((mark) => [mark.date, mark.status]));
    data.sessions
      .filter((session) => session.status === 'completed')
      .forEach((session) => effectiveMarks.set(session.date, 'completed'));
    const marks = [...effectiveMarks.entries()]
      .map(([date, status]) => ({ date, status }))
      .filter((mark) => ['completed', 'missed'].includes(mark.status))
      .sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    for (const mark of marks) { if (mark.status === 'missed') break; count += 1; }
    return count;
  }, [data.calendarMarks, data.sessions]);

  function markDay(status: CalendarStatus) {
    if (!iso) return;
    updateData((current) => ({
      ...current,
      calendarMarks: [...current.calendarMarks.filter((mark) => mark.date !== iso), { date: iso, status }],
    }));
    setMarkDialogOpen(false);
  }

  function clearMark() {
    if (!iso) return;
    updateData((current) => ({ ...current, calendarMarks: current.calendarMarks.filter((mark) => mark.date !== iso) }));
    setMarkDialogOpen(false);
  }

  return (
    <div className="pb-28">
      <ScreenHeader title="Calendario" subtitle="Planificación y cumplimiento" action={<Button size="sm" className="rounded-full" onClick={() => setManualDate(format(new Date(), 'yyyy-MM-dd'))}><Plus /> Añadir</Button>} />
      <div className="space-y-5 px-4 pt-4">
        <section className="grid grid-cols-[1fr_1.4fr] gap-3">
          <Card className="rounded-[22px] bg-black py-4 text-white ring-0"><CardContent className="px-4"><Flame className="mb-5 size-5 text-white/45" /><p className="text-4xl font-black tracking-[-0.06em]">{streak}</p><p className="mt-1 text-xs font-semibold text-white/45">Racha actual</p></CardContent></Card>
          <Card className="rounded-[22px] bg-[#deded9] py-4 ring-0 dark:bg-white/10"><CardContent className="px-4"><CalendarCheck2 className="mb-5 size-5 text-black/45 dark:text-white/45" /><p className="text-4xl font-black tracking-[-0.06em]">{data.sessions.filter((session) => session.status === 'completed').length}</p><p className="mt-1 text-xs font-semibold text-black/45 dark:text-white/45">Entrenamientos registrados</p></CardContent></Card>
        </section>

        <Card className="rounded-[24px] bg-white py-3 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10">
          <CardContent className="px-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => { setSelectedDate(date); if (date) setMarkDialogOpen(true); }}
              locale={es}
              weekStartsOn={1}
              className="mx-auto w-full [--cell-size:42px]"
              modifiers={{ completed: completedDates, missed: missedDates, pending: pendingDates, rest: restDates, excused: excusedDates }}
              modifiersClassNames={{
                missed: '[&_button]:text-red-600',
                rest: '[&_button]:text-black/55 dark:[&_button]:text-white/55',
                excused: '[&_button]:text-black/35 dark:[&_button]:text-white/35',
              }}
              components={{ DayButton: StatusCalendarDayButton }}
            />
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-black/6 pt-3 text-[10px] font-semibold text-black/45 dark:border-white/8 dark:text-white/45"><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-emerald-500" /> Completado</span><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-amber-500" /> Pendiente</span><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-red-500" /> Incumplido</span><span className="flex items-center gap-1.5"><Moon className="size-3 fill-current" /> Descanso</span></div>
          </CardContent>
        </Card>

        <section>
          <SectionTitle eyebrow="Historial" title="Sesiones recientes" />
          {recentSessions.length ? <div className="space-y-2">{recentSessions.map((session) => <button type="button" key={session.id} onClick={() => setSessionDialog(session)} className="flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left ring-1 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black"><Dumbbell className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{session.dayName} · {session.focus}</p><p className="mt-0.5 text-xs text-black/45 dark:text-white/45">{format(new Date(`${session.date}T12:00:00`), "d 'de' MMMM", { locale: es })} · {session.exercises.length} ejercicios</p></div><ChevronRight className="size-4 text-black/25 dark:text-white/25" /></button>)}</div> : <p className="rounded-2xl border border-dashed border-black/15 p-5 text-center text-sm text-black/45 dark:border-white/15 dark:text-white/45">Las sesiones completadas aparecerán aquí.</p>}
        </section>
      </div>

      <Dialog open={markDialogOpen} onOpenChange={setMarkDialogOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{selectedDate ? format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es }) : 'Marcar día'}</DialogTitle><DialogDescription>{selectedSession ? `${selectedSession.dayName} ya está registrado como completado.` : 'Indica cómo debe contar esta fecha en tu planificación.'}</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2">{statuses.map(({ value, label, description, icon: Icon }) => <button key={value} type="button" disabled={Boolean(selectedSession && value !== 'completed')} onClick={() => markDay(value)} className={`rounded-[16px] p-3 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-30 ${selectedMark?.status === value || (value === 'completed' && selectedSession) ? 'bg-black text-white ring-black dark:bg-white dark:text-black dark:ring-white' : 'bg-white ring-black/8 hover:bg-black/3 dark:bg-white/5 dark:ring-white/10'}`}><Icon className="mb-3 size-4" /><p className="text-sm font-extrabold">{label}</p><p className="mt-0.5 text-[10px] opacity-50">{description}</p></button>)}</div><DialogFooter>{selectedMark && !selectedSession ? <Button variant="destructive" onClick={clearMark}>Quitar marca</Button> : null}<Button variant="outline" onClick={() => setMarkDialogOpen(false)}>Cerrar</Button><Button onClick={() => { setMarkDialogOpen(false); if (selectedSession) setSessionDialog(selectedSession); else if (iso) setManualDate(iso); }}><Dumbbell /> {selectedSession ? 'Ver entrenamiento' : 'Registrar entrenamiento'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(sessionDialog)} onOpenChange={(open) => { if (!open) setSessionDialog(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{sessionDialog?.dayName}</DialogTitle><DialogDescription>{sessionDialog ? `${format(new Date(`${sessionDialog.date}T12:00:00`), "d 'de' MMMM 'de' yyyy", { locale: es })} · ${sessionDialog.focus}` : ''}</DialogDescription></DialogHeader><div className="space-y-2">{sessionDialog?.exercises.map((exercise) => { const working = exercise.sets.filter((set) => set.type === 'work' && set.completed); return <div key={exercise.id} className="rounded-[16px] bg-black/4 p-3 dark:bg-white/6"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold">{exercise.exerciseName}</p><p className="mt-0.5 text-xs text-black/45 dark:text-white/45">{working.map((set) => `${formatWeight(set.weight)}×${set.reps}`).join(' · ') || 'Sin series completadas'}</p></div>{exercise.restPause ? <Badge variant="outline">RP {exercise.restPause[0]}+{exercise.restPause[1]}</Badge> : null}</div></div>; })}<div className="flex items-center justify-between rounded-[16px] bg-black p-3 text-white"><span className="text-sm font-extrabold">Cardio</span><span className="text-sm font-black">{sessionDialog?.cardioMinutes ?? 0} min</span></div></div><DialogFooter><Button onClick={() => setSessionDialog(null)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>

      {manualDate ? <ManualWorkoutDialog key={manualDate} data={data} updateData={updateData} initialDate={manualDate} onClose={() => setManualDate(null)} onSaved={setSessionDialog} /> : null}
    </div>
  );
}
