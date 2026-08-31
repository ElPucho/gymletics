'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createDefaultData } from '@/lib/gymletics/defaults';
import { loadData, saveData } from '@/lib/gymletics/db';
import type { GymleticsData } from '@/lib/gymletics/types';

export function useGymletics() {
  const [data, setData] = useState<GymleticsData>(() => createDefaultData());
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    loadData()
      .then((stored) => {
        if (active) setData(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', data.settings.theme === 'dark');
  }, [data.settings.theme]);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      saveData(data)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, ready]);

  const updateData = useCallback(
    (updater: GymleticsData | ((current: GymleticsData) => GymleticsData)) => {
      setData((current) => (typeof updater === 'function' ? updater(current) : updater));
    },
    [],
  );

  const activePlan = useMemo(
    () => data.plans.find((plan) => plan.id === data.activePlanId) ?? data.plans[0],
    [data.activePlanId, data.plans],
  );
  const nextDayIndex = activePlan ? (data.nextDayByPlan[activePlan.id] ?? 0) % Math.max(1, activePlan.days.length) : 0;
  const nextDay = activePlan?.days[nextDayIndex];

  return {
    data,
    ready,
    saveState,
    updateData,
    activePlan,
    nextDay,
    nextDayIndex,
  };
}
