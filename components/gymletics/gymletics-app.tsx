'use client';

import { useState } from 'react';
import { Dumbbell } from 'lucide-react';

import { CalendarScreen } from './calendar-screen';
import { HomeScreen } from './home-screen';
import { PlansScreen } from './plans-screen';
import { ProgressScreen } from './progress-screen';
import { BottomNav } from './shared';
import { SettingsScreen } from './settings-screen';
import { WorkoutScreen } from './workout-screen';
import { PwaRegister } from '@/components/pwa-register';
import { useGymletics } from '@/hooks/use-gymletics';
import type { AppView } from '@/lib/gymletics/types';

export function GymleticsApp() {
  const { data, ready, saveState, updateData, activePlan, nextDay, nextDayIndex } = useGymletics();
  const [view, setView] = useState<AppView>('home');
  const [autoStart, setAutoStart] = useState(false);

  if (!ready) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#080808] text-white">
        <div className="text-center">
          <div className="mx-auto grid size-14 animate-pulse place-items-center rounded-full bg-white text-black"><Dumbbell className="size-6" /></div>
          <p className="brand-wordmark mt-4 text-sm font-black tracking-[0.15em]">GYMLETICS</p>
          <p className="mt-1 text-xs text-white/40">Preparando tus datos locales…</p>
        </div>
      </main>
    );
  }

  function changeView(next: AppView) {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectDay(index: number) {
    if (!activePlan) return;
    updateData((current) => ({
      ...current,
      nextDayByPlan: { ...current.nextDayByPlan, [activePlan.id]: index },
    }));
  }

  return (
    <main className="min-h-dvh bg-[#080808] text-white">
      <PwaRegister />
      <div className="mx-auto min-h-dvh w-full max-w-[480px] overflow-hidden bg-[#f4f4f1] text-[#101010] shadow-2xl transition-colors dark:bg-[#111] dark:text-white">
        {view === 'home' ? (
          <HomeScreen
            data={data}
            plan={activePlan}
            day={nextDay}
            saveState={saveState}
            onStart={() => { setAutoStart(true); changeView('workout'); }}
            onSettings={() => changeView('settings')}
            onProgress={() => changeView('progress')}
          />
        ) : null}
        <WorkoutScreen
          data={data}
          plan={activePlan}
          day={nextDay}
          dayIndex={nextDayIndex}
          updateData={updateData}
          onDayChange={selectDay}
          onFinished={() => changeView('home')}
          autoStart={autoStart}
          onAutoStartHandled={() => setAutoStart(false)}
          visible={view === 'workout'}
        />
        {view === 'plans' ? <PlansScreen data={data} updateData={updateData} /> : null}
        {view === 'progress' ? <ProgressScreen data={data} updateData={updateData} /> : null}
        {view === 'calendar' ? <CalendarScreen data={data} updateData={updateData} /> : null}
        {view === 'settings' ? <SettingsScreen data={data} updateData={updateData} onBack={() => changeView('home')} /> : null}
        {view !== 'settings' ? <BottomNav active={view} onChange={changeView} /> : null}
      </div>
    </main>
  );
}
