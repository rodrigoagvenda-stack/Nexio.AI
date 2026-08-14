'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Reveal({
  children,
  className = '',
  delay = 0,
  y = 24,
  blur = 0,
  once = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  /** px de blur inicial que desfoca até 0 junto com o fade, tipo o giant-text do footer */
  blur?: number;
  /** true = revela uma vez e fica, false (padrão) = entra e sai a cada vez que cruza a tela */
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries[0].isIntersecting;
        if (inView) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : `translateY(${y}px)`,
        filter: blur ? (visible ? 'blur(0px)' : `blur(${blur}px)`) : undefined,
        transition: `opacity 0.7s ease-out ${delay}s, transform 0.7s ease-out ${delay}s${blur ? `, filter 0.7s ease-out ${delay}s` : ''}`,
      }}
    >
      {children}
    </div>
  );
}
