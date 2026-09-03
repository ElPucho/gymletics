'use client';

import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  BookOpen,
  Dumbbell,
  Home,
  Layers3,
  MoreHorizontal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AppView } from '@/lib/gymletics/types';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${compact ? 'size-8' : 'size-9'} grid place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black`}>
        <Dumbbell className="size-4" strokeWidth={2.6} />
      </div>
      <span className="brand-wordmark text-[14px] font-black tracking-[0.14em]">GYMLETICS</span>
    </div>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-black/6 bg-[#f4f4f1]/92 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl dark:border-white/8 dark:bg-[#111]/92">
      <div className="flex min-h-10 items-center gap-3">
        {onBack ? (
          <Button aria-label="Volver" variant="ghost" size="icon" className="-ml-2 rounded-full" onClick={onBack}>
            <ChevronLeft className="size-5" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          {subtitle ? <p className="eyebrow dark:text-white/40">{subtitle}</p> : null}
          <h1 className="truncate text-[26px] font-black leading-tight tracking-[-0.045em]">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}

const navItems: Array<{ view: AppView; label: string; icon: LucideIcon }> = [
  { view: 'home', label: 'Inicio', icon: Home },
  { view: 'workout', label: 'Entrenar', icon: Dumbbell },
  { view: 'plans', label: 'Planes', icon: Layers3 },
  { view: 'library', label: 'Biblioteca', icon: BookOpen },
  { view: 'progress', label: 'Progreso', icon: ChartNoAxesColumnIncreasing },
  { view: 'calendar', label: 'Calendario', icon: CalendarDays },
];

export function BottomNav({ active, onChange }: { active: AppView; onChange: (view: AppView) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t border-black/8 bg-[#f8f8f5]/94 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-[#151515]/94">
      <div className="grid grid-cols-6">
        {navItems.map(({ view, label, icon: Icon }) => {
          const isActive = active === view || (view === 'workout' && active === 'workout');
          return (
            <button
              key={view}
              type="button"
              onClick={() => onChange(view)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors ${
                isActive ? 'text-black dark:text-white' : 'text-black/35 hover:text-black/70 dark:text-white/35 dark:hover:text-white/75'
              }`}
            >
              {isActive ? <span className="absolute top-0 h-0.5 w-5 rounded-full bg-black dark:bg-white" /> : null}
              <Icon className={`size-5 ${isActive ? 'fill-black/10 dark:fill-white/10' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div>
        {eyebrow ? <p className="eyebrow dark:text-white/40">{eyebrow}</p> : null}
        <h2 className="mt-0.5 text-xl font-extrabold tracking-[-0.03em]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-[24px] border border-dashed border-black/15 bg-white/45 p-7 text-center dark:border-white/15 dark:bg-white/3">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
        <Icon className="size-5" />
      </div>
      <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
      <p className="mt-1 max-w-64 text-sm leading-relaxed text-black/50 dark:text-white/50">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SaveIndicator({ state }: { state: 'saved' | 'saving' | 'error' }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider ${state === 'error' ? 'text-red-600' : 'text-black/35 dark:text-white/35'}`}>
      {state === 'saving' ? 'Guardando…' : state === 'error' ? 'Error al guardar' : 'Guardado local'}
    </span>
  );
}

export function MoreButton({ onClick, label = 'Más opciones' }: { onClick: () => void; label?: string }) {
  return (
    <Button aria-label={label} onClick={onClick} variant="ghost" size="icon" className="rounded-full">
      <MoreHorizontal className="size-5" />
    </Button>
  );
}
