'use client';

import { useState } from 'react';

const LINE_THRESHOLD = 3;   // número de quebras de linha
const CHAR_THRESHOLD = 280; // caracteres sem quebra de linha

interface Props {
  children: React.ReactNode;
  text: string; // texto puro para calcular se é longo
}

export function ExpandableMessage({ children, text }: Props) {
  const [expanded, setExpanded] = useState(false);

  const newlines = (text.match(/\n/g) || []).length;
  const isLong = newlines >= LINE_THRESHOLD || text.length > CHAR_THRESHOLD;

  if (!isLong) return <>{children}</>;

  return (
    <div>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-[999px]' : 'max-h-[4.5rem]'
        }`}
      >
        {children}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        className="text-xs font-medium mt-1.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        {expanded ? '↑ Ler menos' : '↓ Ler mais'}
      </button>
    </div>
  );
}
