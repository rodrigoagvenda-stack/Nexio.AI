'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Roteiro de uma demonstração: `times` são os instantes (ms) em que cada passo começa.
 * Toca quando a demo aparece na tela, repete depois de `holdMs` e pausa quando sai da tela.
 * Com movimento reduzido, mostra direto o último passo.
 */
export function useTimeline(times: readonly number[], holdMs = 3200) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(times.length - 1);
      return;
    }

    let timers: ReturnType<typeof setTimeout>[] = [];
    let playing = false;

    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };

    const run = () => {
      clear();
      setStep(0);
      times.forEach((t, i) => {
        if (i > 0) timers.push(setTimeout(() => setStep(i), t));
      });
      timers.push(setTimeout(run, times[times.length - 1] + holdMs));
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !playing) {
          playing = true;
          run();
        } else if (!entry.isIntersecting && playing) {
          playing = false;
          clear();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      clear();
    };
  }, [times, holdMs]);

  return { ref, step };
}
