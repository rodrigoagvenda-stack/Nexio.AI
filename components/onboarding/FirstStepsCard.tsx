'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import type { ChecklistItem } from '@/lib/onboarding/model';

// Card "Primeiros passos" do painel. A lista vem de /api/onboarding/checklist e cada passo é marcado
// pelos dados reais da empresa (WhatsApp conectado, agente criado...). Quando tudo termina, o card some sozinho.
const SYS = 'system-ui, sans-serif';

interface ChecklistData {
  show: boolean;
  items: ChecklistItem[];
  done: number;
  total: number;
}

export function FirstStepsCard() {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/onboarding/checklist')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.show) setData(d as ChecklistData); })
      .catch(() => { /* sem card: o painel funciona igual */ });
    return () => { alive = false; };
  }, []);

  if (!data || hidden) return null;

  const hide = async () => {
    setHidden(true);
    try {
      const res = await fetch('/api/onboarding/checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: true }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setHidden(false);
      toast({ variant: 'destructive', title: 'Não foi possível ocultar', description: 'Tente de novo em instantes.' });
    }
  };

  const firstPending = data.items.findIndex((i) => !i.done);

  return (
    <section aria-label="Primeiros passos" className="flex flex-col" style={{ gap: 10, fontFamily: SYS }}>
      <p style={{ margin: 0, color: '#A3A3A3', fontSize: 16, lineHeight: '20px' }}>Comece por aqui. Quando terminar, este cartão some.</p>
      <div className="flex flex-col overflow-hidden" style={{ maxWidth: 1040, background: '#101010', border: '1px solid #1C1C1C', borderRadius: 20 }}>
        <div className="flex items-center justify-between" style={{ padding: '24px 28px', borderBottom: '1px solid #1C1C1C' }}>
          <div className="flex flex-col flex-1" style={{ gap: 12 }}>
            <div className="flex items-center" style={{ gap: 12 }}>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 600, lineHeight: '24px' }}>Primeiros passos</div>
              <span style={{ background: '#12301F', color: '#96F63C', borderRadius: 999, padding: '3px 10px', fontSize: 13, fontWeight: 600, lineHeight: '16px' }}>
                {data.done} de {data.total}
              </span>
            </div>
            <div className="flex" style={{ gap: 6, maxWidth: 420 }} role="progressbar" aria-valuemin={0} aria-valuemax={data.total} aria-valuenow={data.done}>
              {data.items.map((i) => (
                <div key={i.id} style={{ flex: 1, height: 6, borderRadius: 3, background: i.done ? '#96F63C' : '#1C1C1C', transition: 'background .3s' }} />
              ))}
            </div>
          </div>
          <button type="button" onClick={hide} className="hover:text-white transition-colors" style={{ color: '#737373', fontSize: 14, fontWeight: 500, lineHeight: '18px' }}>
            Ocultar
          </button>
        </div>

        {data.items.map((item, idx) => {
          const current = idx === firstPending;
          return (
            <div
              key={item.id}
              className="flex items-center"
              style={{ gap: 18, padding: '20px 28px', borderBottom: idx < data.items.length - 1 ? '1px solid #1C1C1C' : 0, background: current ? '#12301F33' : 'transparent' }}
            >
              {item.done ? (
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 32, height: 32, borderRadius: 16, background: '#12301F' }}>
                  <Check size={16} strokeWidth={3} color="#96F63C" />
                </span>
              ) : (
                <span
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 32, height: 32, borderRadius: 16, border: current ? '2px solid #96F63C' : '1.5px solid #333', color: current ? '#96F63C' : '#737373', fontSize: 13, fontWeight: 700 }}
                >
                  {idx + 1}
                </span>
              )}
              <div className="flex flex-1 min-w-0 flex-col" style={{ gap: 3 }}>
                <div style={{ fontSize: 17, lineHeight: '22px', fontWeight: current ? 600 : 500, color: item.done ? '#737373' : current ? '#fff' : '#E5E5E5', textDecoration: item.done ? 'line-through 1px' : 'none' }}>
                  {item.title}
                </div>
                <div style={{ color: item.done ? '#5C5C5C' : current ? '#A3A3A3' : '#8A8A8A', fontSize: 14, lineHeight: '18px' }}>{item.desc}</div>
              </div>
              {!item.done && item.href && (
                <Link
                  href={item.href}
                  className="flex-shrink-0 transition-transform active:translate-y-0.5"
                  style={current
                    ? { display: 'flex', alignItems: 'center', height: 42, padding: '0 22px', borderRadius: 999, background: '#01573C', boxShadow: '0 3px 0 #013825', color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: '18px' }
                    : { display: 'flex', alignItems: 'center', height: 42, padding: '0 22px', borderRadius: 999, background: '#141414', border: '1px solid #262626', boxShadow: '0 3px 0 #050505', color: '#fff', fontSize: 15, fontWeight: 500, lineHeight: '18px' }}
                >
                  {item.actionLabel}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
