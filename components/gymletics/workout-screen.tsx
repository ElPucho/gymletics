'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Flame,
  Pause,
  Play,
  SkipForward,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';
import { DecimalWeightInput } from './decimal-weight-input';
import { EditableIntegerInput } from './editable-integer-input';
import { ScreenHeader } from './shared';
import { uid } from '@/lib/gymletics/defaults';
import { recommendWeight } from '@/lib/gymletics/progression';
import { buildExerciseLog } from '@/lib/gymletics/session-builder';
import { formatWeight } from '@/lib/gymletics/weight-format';
import type {
  GymleticsData,
  RoutineDay,
  SetLog,
  WorkoutPlan,
  WorkoutSession,
} from '@/lib/gymletics/types';

function firstIncompleteExercise(session: WorkoutSession) {
  const index = session.exercises.findIndex((exercise) =>
    exercise.sets.some((set) => set.type === 'work' && !set.completed),
  );
  return index < 0 ? Math.max(0, session.exercises.length - 1) : index;
}

export function WorkoutScreen({
  data,
  plan,
  day,
  dayIndex,
  updateData,
  onDayChange,
  onFinished,
  autoStart,
  onAutoStartHandled,
}: {
  data: GymleticsData;
  plan?: WorkoutPlan;
  day?: RoutineDay;
  dayIndex: number;
  updateData: (updater: (current: GymleticsData) => GymleticsData) => void;
  onDayChange: (index: number) => void;
  onFinished: () => void;
  autoStart?: boolean;
  onAutoStartHandled?: () => void;
}) {
  const activeSession = useMemo(
    () => data.sessions.find((session) => session.status === 'active' && session.planId === plan?.id),
    [data.sessions, plan?.id],
  );
  const [exerciseIndex, setExerciseIndex] = useState(() => (activeSession ? firstIncompleteExercise(activeSession) : 0));
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [cardioMinutes, setCardioMinutes] = useState(day?.cardioMinutes ?? 0);
  const [finishMode, setFinishMode] = useState(false);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!timerRunning || timer <= 0) return;
    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          if (data.settings.vibration && 'vibrate' in navigator) navigator.vibrate([150, 80, 150]);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [data.settings.vibration, timer, timerRunning]);

  useEffect(() => {
    if (!activeSession) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((lock) => { wakeLock.current = lock; }).catch(() => undefined);
    return () => { wakeLock.current?.release().catch(() => undefined); };
  }, [activeSession?.id]);

  useEffect(() => {
    if (!autoStart || activeSession || !day?.exercises.length) return;
    startWorkout();
    onAutoStartHandled?.();
  }, [autoStart, activeSession, day?.id]);

  useEffect(() => {
    if (activeSession && exerciseIndex >= activeSession.exercises.length) setExerciseIndex(Math.max(0, activeSession.exercises.length - 1));
  }, [activeSession, exerciseIndex]);

  function startWorkout() {
    if (!plan || !day || !day.exercises.length) return;
    const session: WorkoutSession = {
      id: uid('session'),
      planId: plan.id,
      planName: plan.name,
      dayId: day.id,
      dayName: day.name,
      focus: day.focus,
      date: format(new Date(), 'yyyy-MM-dd'),
      startedAt: new Date().toISOString(),
      status: 'active',
      exercises: day.exercises.map((exercise) => buildExerciseLog(data, plan, day, exercise)),
      cardioMinutes: 0,
    };
    updateData((current) => ({ ...current, sessions: [session, ...current.sessions] }));
    setExerciseIndex(0);
    setFinishMode(false);
  }

  function updateSession(recipe: (session: WorkoutSession) => WorkoutSession) {
    if (!activeSession) return;
    updateData((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.id === activeSession.id ? recipe(session) : session),
    }));
  }

  function updateSet(setId: string, patch: Partial<SetLog>) {
    updateSession((session) => ({
      ...session,
      exercises: session.exercises.map((exercise, index) =>
        index === exerciseIndex
          ? { ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...patch } : set) }
          : exercise,
      ),
    }));
  }

  function completeSet(set: SetLog) {
    updateSet(set.id, { completed: !set.completed });
    if (!set.completed && currentPlanExercise) {
      setTimer(currentPlanExercise.restSeconds);
      setTimerRunning(currentPlanExercise.restSeconds > 0);
    }
  }

  function setRestPause(position: 0 | 1, value: number | null) {
    updateSession((session) => ({
      ...session,
      exercises: session.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        const next: [number, number] = exercise.restPause ? [...exercise.restPause] : [0, 0];
        next[position] = Math.max(0, value ?? 0);
        if (next.every((repetitions) => repetitions === 0)) {
          const updatedExercise = { ...exercise };
          delete updatedExercise.restPause;
          return updatedExercise;
        }
        return { ...exercise, restPause: next };
      }),
    }));
  }

  function goNext() {
    if (!activeSession) return;
    if (exerciseIndex < activeSession.exercises.length - 1) {
      setExerciseIndex((current) => current + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setFinishMode(true);
      setTimerRunning(false);
    }
  }

  function finishWorkout() {
    if (!activeSession || !plan) return;
    const completed: WorkoutSession = {
      ...activeSession,
      status: 'completed',
      completedAt: new Date().toISOString(),
      cardioMinutes: Math.max(0, cardioMinutes),
    };
    const nextIndex = plan.days.length ? (dayIndex + 1) % plan.days.length : 0;
    updateData((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.id === completed.id ? completed : session),
      nextDayByPlan: { ...current.nextDayByPlan, [plan.id]: nextIndex },
      calendarMarks: [
        ...current.calendarMarks.filter((mark) => mark.date !== completed.date),
        { date: completed.date, status: 'completed' },
      ],
    }));
    setFinishMode(false);
    onFinished();
  }

  function discardWorkout() {
    if (!activeSession || !window.confirm('¿Descartar este entrenamiento activo?')) return;
    updateData((current) => ({ ...current, sessions: current.sessions.filter((session) => session.id !== activeSession.id) }));
    setFinishMode(false);
  }

  if (!plan || !day) {
    return (
      <div className="pb-24">
        <ScreenHeader title="Entrenar" subtitle="Sin plan activo" />
        <div className="px-4 pt-6 text-center"><p className="text-sm text-black/50 dark:text-white/50">Crea un plan y añade al menos un día para empezar.</p></div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="pb-28">
        <ScreenHeader title="Entrenar" subtitle="Siguiente en la secuencia" />
        <div className="space-y-5 px-4 pt-5">
          <Card className="relative overflow-hidden rounded-[28px] bg-black py-6 text-white ring-0">
            <div className="absolute -right-12 -top-12 size-44 rounded-full border border-white/10" />
            <CardContent className="relative px-5">
              <Badge className="bg-white/12 text-white">{plan.name}</Badge>
              <h2 className="display-heading mt-8 text-5xl font-black leading-none tracking-[-0.06em]">{day.name.toUpperCase()}</h2>
              <p className="mt-2 text-xl font-semibold text-white/55">{day.focus || 'Entrenamiento'}</p>
              <div className="mt-6 flex gap-5 text-sm text-white/60">
                <span><strong className="text-white">{day.exercises.length}</strong> ejercicios</span>
                <span><strong className="text-white">{day.exercises.reduce((sum, item) => sum + item.sets, 0)}</strong> series</span>
                <span><strong className="text-white">{day.cardioMinutes}</strong> min</span>
              </div>
              <Button className="mt-7 h-13 w-full rounded-full bg-white text-black hover:bg-white/90" onClick={startWorkout} disabled={!day.exercises.length}>
                <Play className="fill-black" /> Comenzar ahora <ArrowRight className="ml-auto" />
              </Button>
            </CardContent>
          </Card>

          <section>
            <p className="eyebrow mb-3 px-1 dark:text-white/40">Elige otro día</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {plan.days.map((item, index) => (
                <button key={item.id} type="button" onClick={() => onDayChange(index)} className={`min-w-24 shrink-0 rounded-[18px] p-3 text-left ring-1 ${index === dayIndex ? 'bg-black text-white ring-black dark:bg-white dark:text-black dark:ring-white' : 'bg-white ring-black/7 dark:bg-[#1c1c1c] dark:ring-white/10'}`}>
                  <span className="text-[10px] font-bold opacity-45">{String(index + 1).padStart(2, '0')}</span>
                  <p className="mt-2 truncate text-sm font-extrabold">{item.name}</p>
                  <p className="mt-0.5 truncate text-[11px] opacity-50">{item.exercises.length} ejercicios</p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            {day.exercises.map((exercise, index) => {
              const recommendation = recommendWeight(data, plan.id, day.id, exercise);
              return (
                <Card key={exercise.id} className="rounded-[20px] bg-white py-3 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10">
                  <CardContent className="flex items-center gap-3 px-3">
                    <div className="grid size-9 place-items-center rounded-full bg-[#eeeeea] text-xs font-black dark:bg-white/10">{String(index + 1).padStart(2, '0')}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{exercise.name}</p><p className="mt-0.5 text-xs text-black/45 dark:text-white/45">{exercise.sets}×{exercise.reps} · {exercise.restSeconds}s</p></div>
                    <div className="text-right"><p className="text-sm font-black">{recommendation.weight ? formatWeight(recommendation.weight) : '—'} {exercise.unit === 'peso corporal' ? '' : exercise.unit}</p><p className="text-[10px] font-semibold uppercase text-black/35 dark:text-white/35">{recommendation.action === 'increase' ? 'Subir' : recommendation.action === 'decrease' ? 'Bajar' : recommendation.action === 'maintain' ? 'Mantener' : 'Calibrar'}</p></div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        </div>
      </div>
    );
  }

  const currentLog = activeSession.exercises[exerciseIndex];
  const currentPlanExercise = day.exercises.find((item) => item.id === currentLog?.planExerciseId);
  const completedExerciseCount = activeSession.exercises.filter((exercise) => exercise.sets.filter((set) => set.type === 'work').every((set) => set.completed)).length;
  const sessionProgress = activeSession.exercises.length ? Math.round((completedExerciseCount / activeSession.exercises.length) * 100) : 0;
  const workCompleted = currentLog?.sets.filter((set) => set.type === 'work').every((set) => set.completed) ?? false;

  if (finishMode) {
    const totalSets = activeSession.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0);
    return (
      <div className="min-h-dvh bg-black px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))] text-white">
        <div className="mx-auto flex min-h-[80dvh] max-w-sm flex-col justify-center">
          <div className="grid size-16 place-items-center rounded-full bg-white text-black"><Trophy className="size-7" /></div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-white/45">Entrenamiento listo</p>
          <h1 className="display-heading mt-3 text-6xl font-black leading-[0.9] tracking-[-0.065em]">BUEN<br />TRABAJO.</h1>
          <p className="mt-4 text-lg text-white/55">{activeSession.dayName} · {activeSession.focus}</p>

          <div className="mt-8 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-black">{activeSession.exercises.length}</p><p className="mt-1 text-[10px] font-bold uppercase text-white/40">Ejercicios</p></div>
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-black">{totalSets}</p><p className="mt-1 text-[10px] font-bold uppercase text-white/40">Series</p></div>
            <div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-black">{cardioMinutes}</p><p className="mt-1 text-[10px] font-bold uppercase text-white/40">Cardio</p></div>
          </div>

          <label className="mt-7 block"><span className="text-xs font-bold uppercase tracking-wider text-white/45">Minutos de cardio</span><Input type="number" inputMode="numeric" value={cardioMinutes} onChange={(event) => setCardioMinutes(Number(event.target.value))} className="mt-2 h-14 rounded-2xl border-white/15 bg-white/10 px-4 text-xl font-black text-white" /></label>
          <Button className="mt-5 h-13 rounded-full bg-white text-black hover:bg-white/90" onClick={finishWorkout}><CheckCircle2 /> Guardar sesión</Button>
          <Button variant="ghost" className="mt-2 text-white/55 hover:bg-white/10 hover:text-white" onClick={() => setFinishMode(false)}>Volver al entrenamiento</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-30 border-b border-black/6 bg-[#f4f4f1]/94 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl dark:border-white/8 dark:bg-[#111]/94">
        <div className="flex items-center justify-between gap-3">
          <Button aria-label="Descartar entrenamiento" variant="ghost" size="icon" className="rounded-full text-red-600" onClick={discardWorkout}><Trash2 /></Button>
          <div className="text-center"><p className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">{activeSession.dayName}</p><p className="text-sm font-extrabold">Ejercicio {exerciseIndex + 1} de {activeSession.exercises.length}</p></div>
          <Button aria-label="Saltar ejercicio" variant="ghost" size="icon" className="rounded-full" onClick={goNext}><SkipForward /></Button>
        </div>
        <Progress value={sessionProgress} className="mt-3"><ProgressLabel className="sr-only">Progreso</ProgressLabel><ProgressValue className="sr-only" /></Progress>
      </header>

      <div className="px-4 pt-5">
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2"><Badge variant="secondary">{currentLog.muscleGroup}</Badge><Badge variant="outline">{currentPlanExercise?.technique ?? currentLog.technique}</Badge></div>
          <h1 className="text-[34px] font-black leading-[1.02] tracking-[-0.055em]">{currentLog.exerciseName}</h1>
          {currentPlanExercise ? (
            <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-black p-3.5 text-white dark:bg-white dark:text-black">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              <div><p className="text-xs font-extrabold">Recomendación automática</p><p className="mt-1 text-xs leading-relaxed opacity-60">{recommendWeight(data, plan.id, day.id, currentPlanExercise).reason}</p></div>
            </div>
          ) : null}
        </div>

        <div className="mb-2 grid grid-cols-[34px_1fr_1fr_44px] gap-2 px-2 text-[10px] font-bold uppercase tracking-wider text-black/35 dark:text-white/35"><span>#</span><span>Peso</span><span>Reps</span><span /></div>
        <div className="space-y-2">
          {currentLog.sets.map((set) => (
            <div key={set.id} className={`grid grid-cols-[34px_1fr_1fr_44px] items-center gap-2 rounded-[18px] p-2 transition ${set.completed ? 'bg-black text-white dark:bg-white dark:text-black' : set.type === 'warmup' ? 'bg-[#deded9] dark:bg-white/10' : 'bg-white ring-1 ring-black/6 dark:bg-[#1c1c1c] dark:ring-white/10'}`}>
              <div className="grid size-8 place-items-center rounded-full text-xs font-black">{set.type === 'warmup' ? 'C' : set.index + 1}</div>
              <div className="relative"><DecimalWeightInput aria-label={`Peso serie ${set.index + 1} en kilogramos`} value={set.weight} onValueChange={(weight) => updateSet(set.id, { weight: weight ?? 0 })} className={`h-11 rounded-xl pr-8 text-center text-base font-black ${set.completed ? 'border-white/15 bg-white/10 text-white dark:border-black/15 dark:bg-black/10 dark:text-black' : 'bg-transparent'}`} /><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold opacity-45">KG</span></div>
              <EditableIntegerInput aria-label={`Repeticiones serie ${set.index + 1}`} value={set.reps} onValueChange={(reps) => updateSet(set.id, { reps: reps ?? 0 })} className={`h-11 rounded-xl text-center text-base font-black ${set.completed ? 'border-white/15 bg-white/10 text-white dark:border-black/15 dark:bg-black/10 dark:text-black' : 'bg-transparent'}`} />
              <button type="button" aria-label={set.completed ? 'Desmarcar serie' : 'Completar serie'} onClick={() => completeSet(set)} className={`grid size-10 place-items-center rounded-full transition ${set.completed ? 'bg-white text-black dark:bg-black dark:text-white' : 'bg-[#eeeeea] dark:bg-white/10'}`}>{set.completed ? <Check className="size-5" strokeWidth={3} /> : <Circle className="size-5 opacity-30" />}</button>
            </div>
          ))}
        </div>

        {workCompleted && currentLog.technique === 'rest-pause' ? (
          <Card className="mt-4 rounded-[22px] bg-[#deded9] py-4 ring-0 dark:bg-white/10">
            <CardContent className="px-4">
              <div className="flex items-center gap-2"><Flame className="size-4" /><p className="text-sm font-extrabold">Rest-pause final</p></div>
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">10 s → fallo → 10 s → fallo</p>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><EditableIntegerInput aria-label="Primer bloque rest-pause" className="h-12 rounded-xl text-center text-lg font-black" value={currentLog.restPause?.[0] ?? null} zeroAsEmpty onValueChange={(value) => setRestPause(0, value)} /><span className="text-xl font-black">+</span><EditableIntegerInput aria-label="Segundo bloque rest-pause" className="h-12 rounded-xl text-center text-lg font-black" value={currentLog.restPause?.[1] ?? null} zeroAsEmpty onValueChange={(value) => setRestPause(1, value)} /></div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          {exerciseIndex > 0 ? <Button variant="outline" className="h-12 rounded-full" onClick={() => setExerciseIndex((current) => current - 1)}><ArrowLeft /></Button> : null}
          <Button className="h-12 rounded-full" onClick={goNext}>{exerciseIndex === activeSession.exercises.length - 1 ? 'Terminar ejercicios' : 'Siguiente ejercicio'}<ChevronRight className="ml-auto" /></Button>
        </div>
      </div>

      {timer > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto w-[calc(100%-1.5rem)] max-w-[456px] rounded-[24px] bg-black p-4 text-white shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-full bg-white text-xl font-black text-black tabular-nums">{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</div>
            <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">Descanso</p><p className="truncate text-xs text-white/45">Respira y prepara la siguiente serie</p></div>
            <Button aria-label={timerRunning ? 'Pausar temporizador' : 'Continuar temporizador'} variant="outline" size="icon" className="rounded-full border-white/15 bg-white/10 text-white hover:bg-white/20" onClick={() => setTimerRunning((current) => !current)}>{timerRunning ? <Pause /> : <Play />}</Button>
            <Button aria-label="Saltar descanso" variant="outline" size="icon" className="rounded-full border-white/15 bg-white/10 text-white hover:bg-white/20" onClick={() => { setTimer(0); setTimerRunning(false); }}><SkipForward /></Button>
          </div>
          <button type="button" className="mt-3 w-full text-center text-xs font-bold text-white/45" onClick={() => { setTimer((current) => current + 30); setTimerRunning(true); }}>+ 30 segundos</button>
        </div>
      ) : null}
    </div>
  );
}
