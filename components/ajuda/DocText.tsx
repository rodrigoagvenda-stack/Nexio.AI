'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Info, Lightbulb, Lock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Segment =
  | { kind: 'lines'; content: string[] }
  | { kind: 'callout'; type: 'TIP' | 'AVISO' | 'INFO' | 'ADMIN'; content: string[] };

function parseContent(text: string): Segment[] {
  const segments: Segment[] = [];
  let inCallout: string | null = null;
  let buffer: string[] = [];

  for (const line of text.split('\n')) {
    const open = line.trim().match(/^\[(TIP|AVISO|INFO|ADMIN)\]$/);
    const close = line.trim().match(/^\[\/(TIP|AVISO|INFO|ADMIN)\]$/);
    if (open && !inCallout) {
      if (buffer.length) segments.push({ kind: 'lines', content: buffer });
      buffer = [];
      inCallout = open[1];
    } else if (close && inCallout === close[1]) {
      segments.push({ kind: 'callout', type: inCallout as 'TIP' | 'AVISO' | 'INFO' | 'ADMIN', content: buffer });
      buffer = [];
      inCallout = null;
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length) segments.push({ kind: 'lines', content: buffer });
  return segments;
}

export function renderInline(str: string, highlight?: string): React.ReactNode[] {
  return str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, j) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={j} className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (highlight && part.toLowerCase().includes(highlight.toLowerCase())) {
      const idx = part.toLowerCase().indexOf(highlight.toLowerCase());
      return (
        <span key={j}>
          {part.slice(0, idx)}
          <mark className="rounded bg-primary/25 px-0.5 text-foreground">{part.slice(idx, idx + highlight.length)}</mark>
          {part.slice(idx + highlight.length)}
        </span>
      );
    }
    return <span key={j}>{part}</span>;
  });
}

const CALLOUTS = {
  TIP: { icon: Lightbulb, label: 'Dica', box: 'border-emerald-500/30 bg-emerald-500/[0.08]', title: 'text-emerald-700 dark:text-emerald-400', body: 'text-emerald-950 dark:text-emerald-100/90' },
  AVISO: { icon: AlertTriangle, label: 'Atenção', box: 'border-amber-500/30 bg-amber-500/[0.08]', title: 'text-amber-700 dark:text-amber-400', body: 'text-amber-950 dark:text-amber-100/90' },
  INFO: { icon: Info, label: 'Informação', box: 'border-blue-500/30 bg-blue-500/[0.08]', title: 'text-blue-700 dark:text-blue-400', body: 'text-blue-950 dark:text-blue-100/90' },
  ADMIN: { icon: Lock, label: 'Só administradores', box: 'border-purple-500/30 bg-purple-500/[0.08]', title: 'text-purple-700 dark:text-[#C4A0F5]', body: 'text-purple-950 dark:text-[#D5C2F5]' },
} as const;

function Callout({ type, lines, highlight }: { type: keyof typeof CALLOUTS; lines: string[]; highlight?: string }) {
  const { icon: Icon, label, box, title, body } = CALLOUTS[type];
  return (
    <div className={cn('flex items-start gap-3.5 rounded-xl border px-5 py-4', box)}>
      <Icon className={cn('mt-px h-5 w-5 shrink-0', title)} strokeWidth={2} />
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className={cn('text-sm font-semibold leading-[18px]', title)}>{label}</span>
        {lines.filter((l) => l.trim()).map((l, i) => (
          <p key={i} className={cn('text-[15px] leading-[1.55]', body)}>{renderInline(l.trim(), highlight)}</p>
        ))}
      </div>
    </div>
  );
}

type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'step'; n: string; text: string }
  | { kind: 'bullet'; text: string; indent: boolean }
  | { kind: 'sub'; text: string }
  | { kind: 'defs'; rows: { name: string; text: string }[] };

function toBlocks(lines: string[]): Block[] {
  const raw: Block[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('## ')) { raw.push({ kind: 'h2', text: t.slice(3) }); continue; }
    if (t.startsWith('### ')) { raw.push({ kind: 'h3', text: t.slice(4) }); continue; }
    const num = t.match(/^(\d+)\.\s+(.*)/);
    if (num) { raw.push({ kind: 'step', n: num[1], text: num[2] }); continue; }
    if (t.startsWith('• ')) { raw.push({ kind: 'bullet', text: t.slice(2), indent: line.search(/\S/) > 2 }); continue; }
    if (/^\s*-\s/.test(line)) { raw.push({ kind: 'sub', text: t.slice(1).trim() }); continue; }
    raw.push({ kind: 'para', text: t });
  }

  // "## Nome" seguido de uma única frase, em sequência, vira uma lista de definições (ex.: funções e permissões)
  const out: Block[] = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    if (b.kind === 'h2' && raw[i + 1]?.kind === 'para' && b.text.length <= 40) {
      const rows: { name: string; text: string }[] = [];
      let j = i;
      while (raw[j]?.kind === 'h2' && raw[j + 1]?.kind === 'para' && (raw[j] as { text: string }).text.length <= 40) {
        // a frase da linha não pode ser seguida de mais texto corrido antes do próximo título
        rows.push({ name: (raw[j] as { text: string }).text, text: (raw[j + 1] as { text: string }).text });
        j += 2;
      }
      if (rows.length >= 2) { out.push({ kind: 'defs', rows }); i = j - 1; continue; }
    }
    out.push(b);
  }
  return out;
}

export function DocText({ text, highlight }: { text: string; highlight?: string }) {
  const segments = useMemo(() => parseContent(text), [text]);

  return (
    <div className="flex flex-col gap-5">
      {segments.map((seg, si) => {
        if (seg.kind === 'callout') return <Callout key={si} type={seg.type} lines={seg.content} highlight={highlight} />;
        const blocks = toBlocks(seg.content);
        const nodes: React.ReactNode[] = [];
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          const key = `${si}-${i}`;
          if (b.kind === 'defs') {
            nodes.push(
              <div key={key} className="flex flex-col rounded-xl border border-border bg-card">
                {b.rows.map((r, k) => (
                  <div key={r.name} className={cn('flex flex-col gap-1 px-5 py-4', k > 0 && 'border-t border-border')}>
                    <span className="text-base font-semibold leading-5 text-foreground">{renderInline(r.name, highlight)}</span>
                    <span className="text-[15px] leading-[1.55] text-muted-foreground">{renderInline(r.text, highlight)}</span>
                  </div>
                ))}
              </div>,
            );
          } else if (b.kind === 'step') {
            // passos seguidos formam uma lista só
            const steps: { n: string; text: string }[] = [];
            let j = i;
            while (blocks[j]?.kind === 'step') { const s = blocks[j] as { n: string; text: string }; steps.push({ n: s.n, text: s.text }); j++; }
            nodes.push(
              <ol key={key} className="flex flex-col gap-3">
                {steps.map((s) => (
                  <li key={s.n} className="flex items-start gap-3.5">
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-foreground">{s.n}</span>
                    <span className="text-base leading-normal text-muted-foreground">{renderInline(s.text, highlight)}</span>
                  </li>
                ))}
              </ol>,
            );
            i = j - 1;
          } else if (b.kind === 'bullet' || b.kind === 'sub') {
            const items: { text: string; indent: boolean }[] = [];
            let j = i;
            while (blocks[j] && (blocks[j].kind === 'bullet' || blocks[j].kind === 'sub')) {
              const it = blocks[j] as { kind: string; text: string; indent?: boolean };
              items.push({ text: it.text, indent: it.kind === 'sub' || !!it.indent });
              j++;
            }
            nodes.push(
              <ul key={key} className="flex flex-col gap-2">
                {items.map((it, k) => (
                  <li key={k} className={cn('flex items-start gap-3', it.indent && 'ml-6')}>
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                    <span className="text-base leading-normal text-muted-foreground">{renderInline(it.text, highlight)}</span>
                  </li>
                ))}
              </ul>,
            );
            i = j - 1;
          } else if (b.kind === 'h2') {
            nodes.push(<h3 key={key} className="mt-2 text-lg font-semibold leading-6 text-foreground">{renderInline(b.text, highlight)}</h3>);
          } else if (b.kind === 'h3') {
            nodes.push(<h4 key={key} className="mt-1 text-base font-semibold leading-6 text-foreground">{renderInline(b.text, highlight)}</h4>);
          } else if (b.kind === 'para') {
            nodes.push(<p key={key} className="text-base leading-[1.6] text-muted-foreground">{renderInline(b.text, highlight)}</p>);
          }
        }
        return <React.Fragment key={si}>{nodes}</React.Fragment>;
      })}
    </div>
  );
}
