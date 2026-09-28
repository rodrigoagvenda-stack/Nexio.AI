'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Mostra uma tela do sistema no tamanho de desenho (width x height) e encolhe
 * proporcionalmente quando o espaço é menor, para ficar idêntica em qualquer largura.
 */
export function ScaledStage({
  width,
  height,
  label,
  children,
}: {
  width: number;
  height: number;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={ref}
      className="mx-auto w-full"
      style={{ maxWidth: width, height: height * scale }}
      role="img"
      aria-label={label}
    >
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}
