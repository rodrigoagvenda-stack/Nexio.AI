'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TourStep {
  id: string;
  target: string; // CSS selector do elemento
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
}

const STORAGE_KEY = 'zaapply_tour_seen';

function getSeenSteps(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

function markStepSeen(id: string) {
  const seen = getSeenSteps();
  if (!seen.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen, id]));
  }
}

export function resetTour() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useGuidedTour(steps: TourStep[]) {
  const [activeStep, setActiveStep] = useState<TourStep | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const findNextUnseen = useCallback(() => {
    const seen = getSeenSteps();
    return steps.find(s => !seen.includes(s.id)) ?? null;
  }, [steps]);

  const computePosition = useCallback((step: TourStep): TooltipPosition | null => {
    const el = document.querySelector(step.target);
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    const tooltipW = 280;
    const tooltipH = 120;
    const gap = 12;
    const placement = step.placement ?? 'bottom';

    let top = 0, left = 0;
    let arrowSide: TooltipPosition['arrowSide'] = 'top';

    if (placement === 'bottom') {
      top = rect.bottom + gap + window.scrollY;
      left = rect.left + rect.width / 2 - tooltipW / 2 + window.scrollX;
      arrowSide = 'top';
    } else if (placement === 'top') {
      top = rect.top - tooltipH - gap + window.scrollY;
      left = rect.left + rect.width / 2 - tooltipW / 2 + window.scrollX;
      arrowSide = 'bottom';
    } else if (placement === 'right') {
      top = rect.top + rect.height / 2 - tooltipH / 2 + window.scrollY;
      left = rect.right + gap + window.scrollX;
      arrowSide = 'left';
    } else {
      top = rect.top + rect.height / 2 - tooltipH / 2 + window.scrollY;
      left = rect.left - tooltipW - gap + window.scrollX;
      arrowSide = 'right';
    }

    // clamp horizontal
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));

    return { top, left, arrowSide };
  }, []);

  const show = useCallback((step: TourStep) => {
    const pos = computePosition(step);
    if (!pos) return;
    setActiveStep(step);
    setPosition(pos);
  }, [computePosition]);

  const dismiss = useCallback(() => {
    if (activeStep) markStepSeen(activeStep.id);
    setActiveStep(null);
    setPosition(null);
  }, [activeStep]);

  const next = useCallback(() => {
    if (activeStep) markStepSeen(activeStep.id);
    setActiveStep(null);
    setPosition(null);

    // Delay para DOM se estabilizar antes de procurar próximo
    setTimeout(() => {
      const nextStep = findNextUnseen();
      if (nextStep) show(nextStep);
    }, 400);
  }, [activeStep, findNextUnseen, show]);

  // Inicializar tour quando componente monta
  useEffect(() => {
    const timer = setTimeout(() => {
      const first = findNextUnseen();
      if (first) show(first);
    }, 1000);
    return () => clearTimeout(timer);
  }, [findNextUnseen, show]);

  // Recalcular posição no resize
  useEffect(() => {
    if (!activeStep) return;
    const handler = () => {
      const pos = computePosition(activeStep);
      if (pos) setPosition(pos);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [activeStep, computePosition]);

  return { activeStep, position, dismiss, next };
}

// ── Tooltip component ──────────────────────────────────────────────────────────

interface TourTooltipProps {
  step: TourStep;
  position: TooltipPosition;
  stepsTotal: number;
  stepIndex: number;
  onDismiss: () => void;
  onNext: () => void;
  isLast: boolean;
}

export function TourTooltip({ step, position, stepsTotal, stepIndex, onDismiss, onNext, isLast }: TourTooltipProps) {
  const arrowClasses: Record<TooltipPosition['arrowSide'], string> = {
    top: 'top-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-0 border-b-[6px] border-b-card',
    bottom: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-0 border-t-[6px] border-t-card',
    left: 'left-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-0 border-r-[6px] border-r-card',
    right: 'right-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-0 border-l-[6px] border-l-card',
  };

  return (
    <div
      className="fixed z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ top: position.top, left: position.left, width: 280 }}
    >
      <div className="relative bg-card border border-border rounded-2xl shadow-xl p-4">
        {/* Arrow */}
        <div className={cn('absolute w-0 h-0 border-[6px]', arrowClasses[position.arrowSide])} />

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-semibold text-foreground leading-snug">{step.title}</p>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 -mt-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{step.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {Array.from({ length: stepsTotal }).map((_, i) => (
              <div key={i} className={cn('w-1.5 h-1.5 rounded-full transition-colors', i === stepIndex ? 'bg-primary' : 'bg-border')} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDismiss} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              Pular
            </button>
            <button onClick={onNext}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary-foreground bg-primary px-2.5 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
              {isLast ? 'Entendi' : 'Próximo'}
              {!isLast && <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Provider / Wrapper ─────────────────────────────────────────────────────────

interface GuidedTourProps {
  steps: TourStep[];
}

export function GuidedTour({ steps }: GuidedTourProps) {
  const { activeStep, position, dismiss, next } = useGuidedTour(steps);

  if (!activeStep || !position) return null;

  const stepIndex = steps.findIndex(s => s.id === activeStep.id);

  return (
    <TourTooltip
      step={activeStep}
      position={position}
      stepsTotal={steps.length}
      stepIndex={stepIndex}
      onDismiss={dismiss}
      onNext={next}
      isLast={stepIndex === steps.length - 1}
    />
  );
}
