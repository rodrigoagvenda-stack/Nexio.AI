'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, closestCorners, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent, useDroppable,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Clock, Megaphone, UserCheck, Banknote, Search, RefreshCcw, AlertTriangle } from 'lucide-react';

interface WaConv {
  id: number;
  numero_de_telefone: string;
  nome_do_contato?: string;
  ultima_mensagem?: string;
  hora_da_ultima_mensagem?: string;
  kanban_stage?: string;
  current_status?: string;
  queue_entered_at?: string;
  briefing?: Record<string, string> | null;
  value_cents?: number | null;
  ctwa_clid?: string | null;
  attribution_source?: string | null;
  current_attendant_id?: string | null;
  created_at?: string;
}

const STAGES = ['novo', 'qualificacao', 'fila', 'em_atendimento', 'negociacao', 'fechado'] as const;
type Stage = typeof STAGES[number];

const STAGE_CONFIG: Record<Stage, { label: string; color: string; icon: typeof Clock }> = {
  novo:           { label: 'Novo',           color: 'text-blue-400',    icon: Clock },
  qualificacao:   { label: 'Qualificação',   color: 'text-purple-400',  icon: Clock },
  fila:           { label: 'Fila',           color: 'text-amber-400',   icon: Clock },
  em_atendimento: { label: 'Em Atendimento', color: 'text-cyan-400',    icon: UserCheck },
  negociacao:     { label: 'Negociação',     color: 'text-orange-400',  icon: Banknote },
  fechado:        { label: 'Fechado',        color: 'text-emerald-400', icon: Clock },
};

// Live timer for queue wait time
function QueueTimer({ enteredAt, limitMinutes = 10 }: { enteredAt: string; limitMinutes?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calc = () => setElapsed(Math.floor((Date.now() - new Date(enteredAt).getTime()) / 60000));
    calc();
    const interval = setInterval(calc, 30000);
    return () => clearInterval(interval);
  }, [enteredAt]);

  const exceeded = elapsed >= limitMinutes;
  return (
    <span className={cn('text-[10px] font-semibold flex items-center gap-0.5', exceeded ? 'text-red-400' : 'text-amber-400')}>
      <Clock className="h-2.5 w-2.5" />
      {elapsed}min{exceeded ? ' ⚠' : ''}
    </span>
  );
}

function getOriginBadge(conv: WaConv) {
  if (conv.ctwa_clid) return { label: 'Meta Ads', style: 'bg-blue-500/15 text-blue-400 border-blue-500/20' };
  if (conv.attribution_source === 'google') return { label: 'Google', style: 'bg-red-500/15 text-red-400 border-red-500/20' };
  return null;
}

function fmtValue(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function getInitials(s: string) {
  return (s ?? '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Sortable card inside DnD context
function ConvCard({ conv, onClick }: { conv: WaConv; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: conv.id,
    data: { type: 'conv', conv },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
  };

  const stage = (conv.kanban_stage ?? 'novo') as Stage;
  const inQueue = stage === 'fila';
  const queueExceeded = inQueue && conv.queue_entered_at
    ? Math.floor((Date.now() - new Date(conv.queue_entered_at).getTime()) / 60000) >= 10
    : false;

  const originBadge = getOriginBadge(conv);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'p-3 rounded-xl border bg-card cursor-grab active:cursor-grabbing transition-colors mb-2',
        queueExceeded ? 'border-red-500/50 bg-red-500/5' : 'border-border hover:border-primary/30'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
          {getInitials(conv.nome_do_contato || conv.numero_de_telefone)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {conv.nome_do_contato || conv.numero_de_telefone}
          </p>
          {conv.nome_do_contato && (
            <p className="text-[10px] text-muted-foreground font-mono">{conv.numero_de_telefone}</p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mt-2">
        {originBadge && (
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', originBadge.style)}>
            {originBadge.label}
          </span>
        )}
        {inQueue && conv.queue_entered_at && (
          <QueueTimer enteredAt={conv.queue_entered_at} />
        )}
      </div>

      {/* Briefing preview */}
      {conv.briefing && Object.keys(conv.briefing).length > 0 && (
        <div className="mt-2 p-2 rounded-lg bg-muted/50 text-[10px] text-muted-foreground space-y-0.5">
          {Object.entries(conv.briefing).slice(0, 3).map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <span className="font-medium shrink-0">{k}:</span>
              <span className="truncate">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Last message snippet */}
      {conv.ultima_mensagem && !conv.briefing && (
        <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2">{conv.ultima_mensagem}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/50">
        {conv.value_cents && conv.value_cents > 0 ? (
          <span className="text-[10px] font-semibold text-emerald-400">{fmtValue(conv.value_cents)}</span>
        ) : (
          <span />
        )}
        {conv.hora_da_ultima_mensagem && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(conv.hora_da_ultima_mensagem).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({ stage, cards, onCardClick }: { stage: Stage; cards: WaConv[]; onCardClick: (c: WaConv) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${stage}`,
    data: { type: 'column', stage },
  });

  const cfg = STAGE_CONFIG[stage];
  const Icon = cfg.icon;

  const totalValue = cards.reduce((s, c) => s + (c.value_cents ?? 0), 0);

  return (
    <div className="w-[280px] flex-shrink-0 flex flex-col h-[calc(100dvh-220px)]">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon className={cn('h-4 w-4', cfg.color)} />
        <span className="font-semibold text-sm">{cfg.label}</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{cards.length}</span>
        {totalValue > 0 && (
          <>
            <span className="text-muted-foreground/30 text-xs">·</span>
            <span className="text-xs text-muted-foreground tabular-nums">{fmtValue(totalValue)}</span>
          </>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl px-1 overflow-y-auto transition-all duration-150',
          isOver ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'bg-transparent'
        )}
      >
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(conv => (
            <ConvCard key={conv.id} conv={conv} onClick={() => onCardClick(conv)} />
          ))}
        </SortableContext>
        {cards.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-20 border border-dashed border-border/40 rounded-xl">
            <p className="text-xs text-muted-foreground/50">Sem conversas</p>
          </div>
        )}
        <div className="min-h-[40px]" />
      </div>
    </div>
  );
}

// Modal to capture value when closing a deal
function CloseDealModal({
  open,
  conv,
  onClose,
  onConfirm,
}: {
  open: boolean;
  conv: WaConv | null;
  onClose: () => void;
  onConfirm: (valueCents: number) => void;
}) {
  const [raw, setRaw] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setRaw('');
  }, [open]);

  const handleConfirm = () => {
    const n = parseFloat(raw.replace(',', '.'));
    if (!n || n <= 0) {
      toast({ title: 'Valor obrigatório', variant: 'destructive' });
      return;
    }
    onConfirm(Math.round(n * 100));
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Valor do fechamento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Informe o valor para registrar a conversão de <strong>{conv?.nome_do_contato || conv?.numero_de_telefone}</strong> no Meta Ads.
        </p>
        <div className="space-y-2">
          <Label className="text-xs">Valor (R$)</Label>
          <Input
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder="Ex: 1500,00"
            className="h-11 text-lg font-mono"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            Fechar negócio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ConversasKanbanPage() {
  const router = useRouter();
  const [byStage, setByStage] = useState<Record<Stage, WaConv[]>>({
    novo: [], qualificacao: [], fila: [], em_atendimento: [], negociacao: [], fechado: [],
  });
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const [search, setSearch] = useState('');
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [closeDealModal, setCloseDealModal] = useState<{ open: boolean; conv: WaConv | null; targetStage: Stage }>({
    open: false, conv: null, targetStage: 'fechado',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchKanban = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/conversations/kanban');
      const data = await res.json();
      if (data.migration_pending) {
        setMigrationPending(true);
        return;
      }
      if (data.byStage) {
        setByStage(data.byStage as Record<Stage, WaConv[]>);
      }
    } catch {
      toast({ title: 'Erro ao carregar kanban', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKanban();
  }, [fetchKanban]);

  const filteredByStage = Object.fromEntries(
    STAGES.map(stage => [
      stage,
      (byStage[stage] ?? []).filter(c =>
        !search ||
        c.nome_do_contato?.toLowerCase().includes(search.toLowerCase()) ||
        c.numero_de_telefone.includes(search)
      ),
    ])
  ) as Record<Stage, WaConv[]>;

  const activeDragConv = draggingId
    ? STAGES.flatMap(s => byStage[s] ?? []).find(c => c.id === draggingId)
    : null;

  const handleDragStart = (e: DragStartEvent) => setDraggingId(e.active.id as number);

  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = e;
    if (!over) return;

    const convId = active.id as number;
    const allConvs = STAGES.flatMap(s => byStage[s] ?? []);
    const conv = allConvs.find(c => c.id === convId);
    if (!conv) return;

    let targetStage: Stage | null = null;
    if (String(over.id).startsWith('col-')) {
      targetStage = String(over.id).replace('col-', '') as Stage;
    } else {
      const targetConv = allConvs.find(c => c.id === over.id);
      if (targetConv) targetStage = (targetConv.kanban_stage ?? 'novo') as Stage;
    }

    if (!targetStage || targetStage === (conv.kanban_stage ?? 'novo')) return;

    if (targetStage === 'fechado') {
      setCloseDealModal({ open: true, conv, targetStage });
      return;
    }

    await moveConv(conv, targetStage);
  };

  const moveConv = async (conv: WaConv, stage: Stage, valueCents?: number) => {
    const oldStage = (conv.kanban_stage ?? 'novo') as Stage;

    // Optimistic update
    setByStage(prev => {
      const updated = { ...prev };
      updated[oldStage] = updated[oldStage].filter(c => c.id !== conv.id);
      updated[stage] = [{ ...conv, kanban_stage: stage, value_cents: valueCents ?? conv.value_cents }, ...updated[stage]];
      return updated;
    });

    try {
      const body: any = { stage };
      if (valueCents) body.value_cents = valueCents;

      const res = await fetch(`/api/conversations/${conv.id}/kanban`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erro ao mover');
      }

      toast({ title: `Movido para "${STAGE_CONFIG[stage].label}"` });
    } catch (err: any) {
      // Revert
      setByStage(prev => {
        const updated = { ...prev };
        updated[stage] = updated[stage].filter(c => c.id !== conv.id);
        updated[oldStage] = [conv, ...updated[oldStage]];
        return updated;
      });
      toast({ title: err.message || 'Erro ao mover', variant: 'destructive' });
    }
  };

  const handleCloseDeal = async (valueCents: number) => {
    const { conv, targetStage } = closeDealModal;
    if (!conv) return;
    setCloseDealModal(m => ({ ...m, open: false }));
    await moveConv(conv, targetStage, valueCents);
  };

  if (migrationPending) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-amber-400" />
        </div>
        <div>
          <p className="font-semibold text-sm">Migration pendente</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            O kanban de conversas requer novas colunas no banco. Execute a migration <code className="bg-muted px-1 rounded">20260812000000_prd_zaapply_fase1.sql</code> no Supabase.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchKanban}>
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kanban WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {STAGES.flatMap(s => byStage[s] ?? []).length} conversas ativas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted border-border w-48"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchKanban} disabled={loading}>
            <RefreshCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {STAGES.map(s => (
            <div key={s} className="w-[280px] flex-shrink-0 space-y-2">
              <div className="h-7 bg-muted/50 animate-pulse rounded-lg" />
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted/30 animate-pulse rounded-xl" />)}
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="relative">
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4" style={{ minWidth: 'min-content' }}>
                {STAGES.map(stage => (
                  <Column
                    key={stage}
                    stage={stage}
                    cards={filteredByStage[stage] ?? []}
                    onCardClick={conv => router.push(`/atendimento?conv=${conv.id}`)}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
          </div>

          <DragOverlay>
            {activeDragConv ? (
              <div className="p-3 rounded-xl border border-primary/30 bg-card shadow-xl w-[270px] rotate-1 opacity-90">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {getInitials(activeDragConv.nome_do_contato || activeDragConv.numero_de_telefone)}
                  </div>
                  <p className="font-medium text-sm truncate">{activeDragConv.nome_do_contato || activeDragConv.numero_de_telefone}</p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <CloseDealModal
        open={closeDealModal.open}
        conv={closeDealModal.conv}
        onClose={() => setCloseDealModal(m => ({ ...m, open: false }))}
        onConfirm={handleCloseDeal}
      />
    </div>
  );
}
