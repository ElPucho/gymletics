'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

const ACTION_WIDTH = 96;

type SwipeGesture = {
  pointerId: number;
  x: number;
  y: number;
  origin: number;
  offset: number;
  horizontal: boolean;
};

export function SwipeToDeleteRow({
  children,
  label,
  className,
  canDelete,
  open,
  onOpenChange,
  onDelete,
}: {
  children: ReactNode;
  label: string;
  className: string;
  canDelete: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const gesture = useRef<SwipeGesture | null>(null);
  const suppressClick = useRef(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const offset = canDelete ? dragOffset ?? (open ? -ACTION_WIDTH : 0) : 0;

  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    suppressClick.current = false;
    if (!canDelete || !event.isPrimary || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-swipe-action]')) return;
    // Mouse input keeps native caret selection; touch can swipe across the whole row.
    if (event.pointerType === 'mouse' && target.closest('input, button')) return;
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: open ? -ACTION_WIDTH : 0,
      offset: open ? -ACTION_WIDTH : 0,
      horizontal: false,
    };
  }

  function moveSwipe(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.horizontal) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      current.horizontal = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    current.offset = Math.max(-ACTION_WIDTH, Math.min(0, current.origin + dx));
    setDragOffset(current.offset);
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (current.horizontal) {
      if (!cancelled) onOpenChange(current.offset <= -ACTION_WIDTH / 2);
      setDragOffset(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  return (
    <div
      role="group"
      aria-label={canDelete ? `${label}. Desliza a la izquierda o pulsa Flecha izquierda para mostrar Eliminar.` : label}
      tabIndex={canDelete ? 0 : undefined}
      className="relative isolate rounded-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      style={{ touchAction: 'pan-y pinch-zoom' }}
      onPointerDown={startSwipe}
      onPointerMove={moveSwipe}
      onPointerUp={(event) => finishSwipe(event)}
      onPointerCancel={(event) => finishSwipe(event, true)}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        } else if (open && (event.target as HTMLElement).closest('[data-swipe-content]')) {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(false);
        }
      }}
      onKeyDown={(event) => {
        if (!canDelete || event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Escape') {
          event.preventDefault();
          onOpenChange(event.key === 'ArrowLeft');
        }
      }}
    >
      <div className="overflow-hidden rounded-[18px]">
        {canDelete ? (
          <button
            data-swipe-action
            type="button"
            aria-label={`Eliminar ${label.toLocaleLowerCase('es')}`}
            aria-hidden={!open}
            tabIndex={open ? 0 : -1}
            disabled={!open}
            className="absolute inset-y-0 right-0 flex w-24 flex-col items-center justify-center gap-1 rounded-r-[18px] bg-red-600 text-white focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
            style={{ visibility: offset < 0 ? 'visible' : 'hidden' }}
            onClick={onDelete}
          >
            <Trash2 className="size-5" aria-hidden="true" />
            <span className="text-sm font-bold">Eliminar</span>
          </button>
        ) : null}
        <div
          data-swipe-content
          className={`relative ${dragOffset === null ? 'transition-transform duration-200 ease-out motion-reduce:transition-none' : 'select-none'} ${className}`}
          style={{ transform: `translateX(${offset}px)` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
