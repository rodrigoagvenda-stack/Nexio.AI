'use client';

import { useState } from 'react';

const LINE_THRESHOLD = 15;
const CHAR_THRESHOLD = 800;

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
        className="text-[11px] font-medium text-primary/70 hover:text-primary transition-colors mt-0.5"
      >
        {expanded ? 'ver menos' : '... ver mais'}
      </button>
    </div>
  );
}
