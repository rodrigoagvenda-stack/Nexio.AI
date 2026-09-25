'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Flag, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NICHES } from '@/lib/sdr/templates';
import type { FieldType, FunnelConfig, FunnelField, FunnelStep } from '@/lib/sdr/funnel/types';
import { CARD, Chips, INPUT, LIME, PILL3D, PILL_GREEN, Toggle } from './ui';
import { ConversaTest, type TestSeed } from './ConversaTest';
import { CLOSINGS, capitalize, clone, diffFunnel, diffPersona, getClosing, humanizeKey, objectionTitle, replaceNameInTexts, same, setClosing, slugify, stepTitle } from './funnel-model';
import type { AgentPersona } from './useSdrConfig';

type Section = 'agente' | 'perguntas' | 'preco' | 'objecoes' | 'encerramentos';

const TONES = [
  { value: 'amigável e próximo', label: 'Amigável', desc: 'Próximo e descontraído, poucos emojis' },
  { value: 'profissional e direto', label: 'Profissional', desc: 'Formal, objetivo, sem emojis' },
  { value: 'empático e acolhedor', label: 'Empático', desc: 'Caloroso, paciente, acolhedor' },
  { value: 'dinâmico e entusiasmado', label: 'Dinâmico', desc: 'Energético, animado, motivador' },
];
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'yesno', label: 'Sim ou não' },
  { value: 'link_or_media', label: 'Link ou print' },
];
const typeLabel = (t: FieldType) => FIELD_TYPES.find((x) => x.value === t)?.label ?? 'Texto';
const ordinal = (n: number) => `${n}ª`;

// ─── Peças de tela ────────────────────────────────────────────────────────────

function EditedChip() {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5B544]/[0.16] px-2.5 py-1 text-xs font-semibold text-[#8A5A00] dark:text-[#F5B544]"><span className="h-1.5 w-1.5 rounded-full bg-[#F5B544]" />Editado</span>;
}

function EditorHead({ eyebrow, title, edited, subtitle, actions }: { eyebrow?: string; title: React.ReactNode; edited?: boolean; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-3"><h3 className="text-[28px] font-semibold leading-8 tracking-tight text-foreground">{title}</h3>{edited && <EditedChip />}</div>
        {subtitle && <p className="text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-2 text-sm font-semibold text-destructive hover:underline"><Trash2 className="h-4 w-4" />{label}</button>;
}

function Labeled({ label, optional, help, children, htmlFor }: { label: string; optional?: boolean; help?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[15px] font-semibold text-foreground">{label}{optional && <span className="text-[13px] font-normal text-muted-foreground">opcional</span>}</label>
      {children}
      {help && <p className="text-[13px] text-muted-foreground">{help}</p>}
    </div>
  );
}

function Area({ value, onChange, edited, rows = 3, id, placeholder }: { value: string; onChange: (v: string) => void; edited?: boolean; rows?: number; id?: string; placeholder?: string }) {
  return <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(INPUT, 'resize-y leading-[160%]', edited && 'border-[#F5B544] focus:border-[#F5B544] dark:border-[#F5B544] dark:focus:border-[#F5B544]')} />;
}

function ListRow({ active, edited, title, sub, num, right, onClick }: { active: boolean; edited?: boolean; title: string; sub?: string; num?: React.ReactNode; right?: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors', active ? 'bg-[#E4F1E9] dark:bg-[#12301F]' : 'hover:bg-muted')}>
      {num !== undefined && <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold', active ? 'border-[#01573C] bg-[#01573C] text-white dark:border-[#96F63C] dark:bg-transparent dark:text-[#96F63C]' : 'border-border text-foreground')}>{num}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><span className="truncate">{title}</span>{edited && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5B544]" aria-label="Editado" />}</span>
        {sub && <span className="truncate text-[13px] text-muted-foreground">{sub}</span>}
      </span>
      {right}
    </button>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export function SdrConversa({ persona, onSavePersona, funnelActive, onFunnelActive }: {
  persona: AgentPersona;
  onSavePersona: (p: AgentPersona) => Promise<boolean>;
  funnelActive: boolean;
  onFunnelActive: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<FunnelConfig | null>(null);
  const [draft, setDraft] = useState<FunnelConfig | null>(null);
  const [pDraft, setPDraft] = useState<AgentPersona>(persona);
  const [section, setSection] = useState<Section>('agente');
  const [stepSel, setStepSel] = useState<string>('');
  const [priceSel, setPriceSel] = useState<string>('0');
  const [objSel, setObjSel] = useState<string>('');
  const [objSearch, setObjSearch] = useState('');
  const [closingSel, setClosingSel] = useState<string>('refusal');
  const [fieldsEdit, setFieldsEdit] = useState(false);
  const [moreOpts, setMoreOpts] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [seed, setSeed] = useState<TestSeed | null>(null);
  const seedN = useRef(0);
  const [create, setCreate] = useState({ agentName: persona.nome_agente, humanName: '' });
  const [creating, setCreating] = useState(false);
  const nameOnFocus = useRef('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sdr/funnel');
      const json = await res.json();
      if (json.success) {
        const cfg = (json.data.config ?? null) as FunnelConfig | null;
        setSaved(cfg);
        setDraft(cfg ? clone(cfg) : null);
        onFunnelActive(!!json.data.active);
        if (cfg) {
          setStepSel((cur) => (cfg.steps.some((s) => s.id === cur) || cur === '__end' ? cur : (cfg.steps[0]?.id ?? '')));
          setObjSel((cur) => (cfg.objections[cur] ? cur : (Object.keys(cfg.objections)[0] ?? '')));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [onFunnelActive]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPDraft(persona); }, [persona]);

  const funnelChanges = useMemo(() => (saved && draft ? diffFunnel(saved, draft) : []), [saved, draft]);
  const personaChanges = useMemo(() => diffPersona(persona, pDraft), [persona, pDraft]);
  const changes = [...personaChanges, ...funnelChanges];
  const dirty = changes.length > 0;

  function mutate(fn: (c: FunnelConfig) => void) {
    setDraft((prev) => { if (!prev) return prev; const next = clone(prev); fn(next); return next; });
  }
  const setP = (k: keyof AgentPersona, v: string) => setPDraft((p) => ({ ...p, [k]: v }));

  function retest(next?: { stepId?: string; say?: string }) {
    seedN.current += 1;
    setSeed({ n: seedN.current, ...next });
  }

  async function publish() {
    if (!draft) return;
    setPublishing(true);
    try {
      if (funnelChanges.length > 0) {
        const res = await fetch('/api/sdr/funnel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: { ...draft, agentNames: draft.agentNames?.map((n) => n.trim()).filter(Boolean) } }) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.message || 'Não foi possível publicar');
      }
      if (personaChanges.length > 0) {
        const ok = await onSavePersona(pDraft);
        if (!ok) return;
      }
      await load();
      toast({ title: 'Alterações publicadas', description: 'O agente já atende com a versão nova.', variant: 'success' });
    } catch (e) {
      toast({ title: 'Não foi possível publicar', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  }

  function discard() {
    if (!window.confirm('Descartar todas as alterações não publicadas?')) return;
    setDraft(saved ? clone(saved) : null);
    setPDraft(persona);
    retest();
  }

  async function toggleFunnel(v: boolean) {
    if (dirty) { toast({ title: 'Publique as alterações antes de ligar ou desligar o roteiro', variant: 'warning' }); return; }
    const res = await fetch('/api/sdr/funnel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: v }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) { toast({ title: json.message || 'Não foi possível alterar o roteiro', variant: 'destructive' }); return; }
    onFunnelActive(v);
    toast({ title: v ? 'Roteiro ligado' : 'Roteiro desligado', variant: 'success' });
  }

  async function createFromTemplate() {
    setCreating(true);
    try {
      const res = await fetch('/api/sdr/funnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(create) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Não foi possível criar o roteiro', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!draft || !saved) {
    return (
      <div className={cn(CARD, 'mx-auto flex w-full max-w-xl flex-col gap-5 px-8 py-8')}>
        <div className="flex flex-col gap-2"><h2 className="text-2xl font-semibold text-foreground">Roteiro da conversa</h2>
          <p className="text-[15px] leading-[160%] text-muted-foreground">O roteiro conduz a conversa do começo ao fim com os textos que você aprova, palavra por palavra. A inteligência artificial só lê o que o lead respondeu. Isso evita pergunta repetida, resposta inventada e valor revelado sem querer.</p></div>
        <Labeled label="Nome do seu atendente virtual" htmlFor="c-agent"><input id="c-agent" className={INPUT} value={create.agentName} onChange={(e) => setCreate({ ...create, agentName: e.target.value })} placeholder="Ex: Laura" /></Labeled>
        <Labeled label="Nome de quem assume as conversas quando preciso" htmlFor="c-human"><input id="c-human" className={INPUT} value={create.humanName} onChange={(e) => setCreate({ ...create, humanName: e.target.value })} placeholder="Ex: Bruno" /></Labeled>
        <button type="button" disabled={creating || !create.agentName.trim() || !create.humanName.trim()} onClick={createFromTemplate} className={cn(PILL_GREEN, 'w-fit')}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Criar roteiro a partir do modelo</button>
        <p className="text-[13px] text-muted-foreground">O roteiro nasce desligado. Revise os textos, teste e ligue quando estiver pronto.</p>
      </div>
    );
  }

  const agentName = pDraft.nome_agente || 'Agente';
  const humanName = draft.humanName || 'uma pessoa da equipe';
  const stepEdited = (s: FunnelStep) => { const o = saved.steps.find((x) => x.id === s.id); return !o || !same(o, s); };
  const selStepIdx = draft.steps.findIndex((s) => s.id === stepSel);
  const selStep = selStepIdx >= 0 ? draft.steps[selStepIdx] : null;
  const obj = draft.objections[objSel];
  const objectionKeys = Object.keys(draft.objections);
  const objFiltered = objectionKeys.filter((k) => !objSearch.trim() || `${objectionTitle(k)} ${draft.objections[k].triggers}`.toLowerCase().includes(objSearch.trim().toLowerCase()));
  const priceEdited = !same([saved.priceScripts, saved.priceInsistHandoff, saved.priceHandoffAt, saved.pricePosRoteiro, saved.priceDisclosure], [draft.priceScripts, draft.priceInsistHandoff, draft.priceHandoffAt, draft.pricePosRoteiro, draft.priceDisclosure]);
  const closing = CLOSINGS.find((c) => c.id === closingSel);
  const closingEdited = (c: (typeof CLOSINGS)[number]) => c.fields.some((f) => getClosing(saved, f.key) !== getClosing(draft, f.key));
  const firstQuestion = draft.steps[0]?.question.replace(/\{nome\}/gi, '') ?? '';
  const priceHandoffAt = draft.priceHandoffAt ?? 2;

  const chips = [
    ['agente', 'Quem é o agente'],
    ['perguntas', `Perguntas ${draft.steps.length}`],
    ['preco', 'Preço'],
    ['objecoes', `Objeções e dúvidas ${objectionKeys.length}`],
    ['encerramentos', 'Encerramentos'],
  ] as const;

  const card = 'flex min-h-[640px] flex-col';

  return (
    <div className="flex flex-col gap-6">
      {dirty && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#F5B544]/35 bg-[#F5B544]/[0.08] px-6 py-4">
          <div className="flex items-start gap-4">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#F5B544]" />
            <div className="flex flex-col gap-1"><p className="text-base font-semibold text-foreground">{changes.length} {changes.length === 1 ? 'alteração não publicada' : 'alterações não publicadas'}</p><p className="text-sm text-[#8A6A1F] dark:text-[#C9B27A]">O agente continua atendendo com a versão anterior até você publicar.</p></div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setChangesOpen(true)} className="text-sm font-semibold text-[#8A5A00] hover:underline dark:text-[#F5B544]">Ver alterações</button>
            <button type="button" onClick={discard} disabled={publishing} className={cn(PILL3D, 'h-10 px-5 text-sm')}>Descartar</button>
            <button type="button" onClick={publish} disabled={publishing} className={cn(PILL_GREEN, 'h-10 px-5 text-sm')}>{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publicar'}</button>
          </div>
        </div>
      )}

      <Chips items={chips} active={section} onChange={setSection} label="Partes da conversa" />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
        {/* ─── Quem é o agente ─── */}
        {section === 'agente' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 gap-4 p-6 xl:w-[330px]')}>
              <div className="flex flex-col gap-1"><h3 className="text-lg font-semibold text-foreground">Como o agente aparece</h3><p className="text-[13px] text-muted-foreground">A primeira mensagem que o lead recebe.</p></div>
              <div className="rounded-xl border border-border bg-muted/40 p-4 dark:border-[#1F1F1F] dark:bg-[#0F0F0F]">
                <div className="mb-3 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E4F1E9] text-base font-semibold text-[#01573C] dark:bg-[#12301F] dark:text-[#96F63C]">{agentName.charAt(0).toUpperCase()}</span><span className="flex flex-col"><span className="text-[15px] font-semibold text-foreground">{agentName}</span><span className="text-[13px] text-muted-foreground">{pDraft.empresa}</span></span></div>
                <p className="whitespace-pre-wrap rounded-xl bg-[#E4F1E9] px-4 py-3 text-[15px] leading-[150%] text-foreground dark:bg-[#12301F]">{firstQuestion || 'A primeira pergunta do roteiro aparece aqui.'}</p>
              </div>
              <p className="text-sm leading-[150%] text-muted-foreground">Essa frase vem da pergunta 1 do roteiro. Para mudar, edite a pergunta.</p>
              <button type="button" onClick={() => { setSection('perguntas'); setStepSel(draft.steps[0]?.id ?? ''); }} className={cn('w-fit text-sm font-semibold hover:underline', LIME)}>Editar pergunta 1 ›</button>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-8')}>
              <EditorHead title="Quem é o agente" subtitle="Essas informações entram direto no comportamento do agente." />
              <div className="grid gap-x-5 gap-y-6 md:grid-cols-2">
                <Labeled label="Nome do agente" htmlFor="p-nome"><input id="p-nome" className={INPUT} value={pDraft.nome_agente} onFocus={() => { nameOnFocus.current = pDraft.nome_agente; }} onChange={(e) => setP('nome_agente', e.target.value)}
                  onBlur={() => { const from = nameOnFocus.current; const to = pDraft.nome_agente; if (from && to && from !== to) mutate((c) => { const r = replaceNameInTexts(c, from, to); Object.assign(c, r); if (!c.agentNames?.some((n) => n.trim() === to)) c.agentNames = [...(c.agentNames ?? []), to]; }); }} /></Labeled>
                <Labeled label="Nome da empresa" htmlFor="p-emp"><input id="p-emp" className={INPUT} value={pDraft.empresa} onChange={(e) => setP('empresa', e.target.value)} /></Labeled>
                <Labeled label="Produto ou serviço" htmlFor="p-prod" help="O que a empresa vende. Aparece nas mensagens de acompanhamento."><input id="p-prod" className={INPUT} value={pDraft.produto} onChange={(e) => setP('produto', e.target.value)} /></Labeled>
                <Labeled label="Quem assume a conversa" htmlFor="p-human" help="O nome que o agente usa ao passar o lead para uma pessoa."><input id="p-human" className={INPUT} value={draft.humanName ?? ''} onFocus={() => { nameOnFocus.current = draft.humanName ?? ''; }} onChange={(e) => mutate((c) => { c.humanName = e.target.value; })}
                  onBlur={() => { const from = nameOnFocus.current; const to = draft.humanName ?? ''; if (from && to && from !== to) mutate((c) => { const r = replaceNameInTexts(c, from, to); Object.assign(c, r); c.humanName = to; }); }} /></Labeled>
              </div>
              <Labeled label="Nicho" htmlFor="p-nicho" help="Define o comportamento base do agente.">
                <select id="p-nicho" value={pDraft.nicho_id} onChange={(e) => setP('nicho_id', e.target.value)} className={cn(INPUT, 'h-12 py-0', !pDraft.nicho_id && 'text-muted-foreground')}>
                  <option value="">Selecione o nicho</option>
                  {NICHES.filter((n) => n.id !== 'monte-o-seu').map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
              </Labeled>
              <Labeled label="Tom de voz">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {TONES.map((t) => (
                    <button key={t.value} type="button" aria-pressed={pDraft.tom === t.value} onClick={() => setP('tom', t.value)} className={cn('flex flex-col gap-1 rounded-xl border px-4 py-3.5 text-left transition-colors', pDraft.tom === t.value ? 'border-[#01573C] bg-[#E4F1E9] dark:border-[#96F63C]/50 dark:bg-[#12301F]' : 'border-border hover:bg-muted')}>
                      <span className="text-[15px] font-semibold text-foreground">{t.label}</span><span className="text-[13px] leading-[140%] text-muted-foreground">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </Labeled>
              <Labeled label="O que nunca dizer" optional htmlFor="p-restr"><Area id="p-restr" rows={3} value={pDraft.restricoes} onChange={(v) => setP('restricoes', v)} placeholder="Ex: não mencione preços sem entender a necessidade do cliente" /></Labeled>
            </section>
          </>
        )}

        {/* ─── Perguntas ─── */}
        {section === 'perguntas' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
              <div className="flex items-start justify-between gap-3 px-6 pb-3 pt-6"><div className="flex flex-col gap-1"><h3 className="text-lg font-semibold text-foreground">Roteiro</h3><p className="text-[13px] text-muted-foreground">Nesta ordem</p></div>
                <label className="flex items-center gap-3 text-sm font-semibold text-foreground">{funnelActive ? 'Ligado' : 'Desligado'}<Toggle on={funnelActive} onChange={(v) => void toggleFunnel(v)} label="Ligar ou desligar o roteiro" /></label></div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                {draft.steps.map((s, i) => <ListRow key={s.id} num={i + 1} active={s.id === stepSel} edited={stepEdited(s)} title={stepTitle(s)} sub={s.question} onClick={() => { setStepSel(s.id); setFieldsEdit(false); }} />)}
                <ListRow active={stepSel === '__end'} num={<Flag className="h-3.5 w-3.5" />} edited={getClosing(saved, 'closingMessage') !== getClosing(draft, 'closingMessage')} title="Ao terminar" sub={draft.closingMessage || 'Sem mensagem final'} onClick={() => setStepSel('__end')} />
              </div>
              <div className="border-t border-border p-4"><button type="button" disabled={draft.steps.length >= 15} onClick={() => { let n = draft.steps.length + 1; while (draft.steps.some((s) => s.id === `passo_${n}`)) n++; const id = `passo_${n}`; mutate((c) => { c.steps.push({ id, title: `Pergunta ${c.steps.length + 1}`, question: '', fields: [{ key: `dado_${n}`, label: 'a resposta', type: 'text', description: 'Resposta do lead a esta pergunta, resumida.' }] }); }); setStepSel(id); }} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline disabled:opacity-50', LIME)}><Plus className="h-4 w-4" />Adicionar pergunta</button></div>
            </aside>

            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
              {stepSel === '__end' ? (
                <>
                  <EditorHead eyebrow="Fim do roteiro" title="Ao terminar" edited={getClosing(saved, 'closingMessage') !== getClosing(draft, 'closingMessage')} subtitle="Enviada uma vez quando as perguntas acabam, antes de marcar o horário. Use {nome} para o nome do lead." />
                  <Labeled label="Mensagem final" optional htmlFor="s-end"><Area id="s-end" rows={4} value={draft.closingMessage ?? ''} edited={getClosing(saved, 'closingMessage') !== getClosing(draft, 'closingMessage')} onChange={(v) => mutate((c) => setClosing(c, 'closingMessage', v))} /></Labeled>
                </>
              ) : selStep ? (
                <>
                  <EditorHead
                    eyebrow={`Pergunta ${selStepIdx + 1} de ${draft.steps.length}`}
                    title={<input aria-label="Nome da pergunta" value={selStep.title ?? stepTitle(selStep)} onChange={(e) => mutate((c) => { c.steps[selStepIdx].title = e.target.value; })} className="min-w-[120px] max-w-full bg-transparent [field-sizing:content] text-[28px] font-semibold leading-8 tracking-tight text-foreground outline-none" />}
                    edited={stepEdited(selStep)}
                    actions={<>
                      <button type="button" aria-label="Subir pergunta" disabled={selStepIdx === 0} onClick={() => mutate((c) => { const i = selStepIdx; [c.steps[i - 1], c.steps[i]] = [c.steps[i], c.steps[i - 1]]; })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label="Descer pergunta" disabled={selStepIdx === draft.steps.length - 1} onClick={() => mutate((c) => { const i = selStepIdx; [c.steps[i + 1], c.steps[i]] = [c.steps[i], c.steps[i + 1]]; })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"><ArrowDown className="h-4 w-4" /></button>
                      <RemoveButton label="Remover pergunta" onClick={() => { if (draft.steps.length <= 1) { toast({ title: 'O roteiro precisa de pelo menos uma pergunta', variant: 'warning' }); return; } if (!window.confirm('Remover esta pergunta do roteiro?')) return; const next = draft.steps.filter((s) => s.id !== selStep.id); mutate((c) => { c.steps = c.steps.filter((s) => s.id !== selStep.id); }); setStepSel(next[Math.max(0, selStepIdx - 1)]?.id ?? ''); }} />
                    </>}
                  />
                  <Labeled label="O que o agente pergunta" htmlFor="s-q" help="Use {nome} para o nome do lead."><Area id="s-q" rows={3} value={selStep.question} edited={stepEdited(selStep) && saved.steps.find((x) => x.id === selStep.id)?.question !== selStep.question} onChange={(v) => mutate((c) => { c.steps[selStepIdx].question = v; })} /></Labeled>
                  <Labeled label="Se o lead não responder direito" optional htmlFor="s-cl"><Area id="s-cl" rows={2} value={selStep.clarify ?? ''} onChange={(v) => mutate((c) => { c.steps[selStepIdx].clarify = v || undefined; })} /></Labeled>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between"><p className="text-[15px] font-semibold text-foreground">O que o agente guarda no lead</p><button type="button" onClick={() => setFieldsEdit((v) => !v)} className={cn('text-sm font-semibold hover:underline', LIME)}>{fieldsEdit ? 'Concluir' : 'Editar'}</button></div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {selStep.fields.map((f: FunnelField, fi) => (
                        <div key={f.key} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-5 py-4 dark:border-[#2A2A2A] dark:bg-[#141414]">
                          {fieldsEdit ? (
                            <>
                              <input aria-label="Nome do dado" className={INPUT} value={f.label} onChange={(e) => mutate((c) => { c.steps[selStepIdx].fields[fi].label = e.target.value; })} />
                              <select aria-label="Tipo do dado" className={INPUT} value={f.type} onChange={(e) => mutate((c) => { c.steps[selStepIdx].fields[fi].type = e.target.value as FieldType; })}>{FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                              <textarea aria-label="Como o agente entende esse dado" rows={2} className={INPUT} value={f.description} onChange={(e) => mutate((c) => { c.steps[selStepIdx].fields[fi].description = e.target.value; })} />
                              <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-[13px] text-muted-foreground"><input type="checkbox" checked={f.required !== false} onChange={(e) => mutate((c) => { c.steps[selStepIdx].fields[fi].required = e.target.checked ? undefined : false; })} />Obrigatório</label>
                                {selStep.fields.length > 1 && <button type="button" className="text-[13px] font-semibold text-destructive hover:underline" onClick={() => mutate((c) => { c.steps[selStepIdx].fields.splice(fi, 1); })}>Remover</button>}</div>
                            </>
                          ) : (
                            <><div className="flex items-center justify-between gap-2"><p className="text-[15px] font-semibold text-foreground">{capitalize(f.label)}</p><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', f.type === 'text' ? 'bg-muted text-muted-foreground' : 'bg-[#01573C]/10 text-[#01573C] dark:bg-[#96F63C]/[0.14] dark:text-[#96F63C]')}>{f.required === false ? `${typeLabel(f.type)}, opcional` : typeLabel(f.type)}</span></div>
                              <p className="text-sm leading-[150%] text-muted-foreground">{f.description}</p></>
                          )}
                        </div>
                      ))}
                      {fieldsEdit && <button type="button" onClick={() => mutate((c) => { const n = c.steps[selStepIdx].fields.length + 1; c.steps[selStepIdx].fields.push({ key: `${selStep.id}_${n}`.slice(0, 40), label: 'outra informação', type: 'text', description: 'O que extrair da resposta do lead.' }); })} className="flex min-h-[88px] items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" />Adicionar dado</button>}
                    </div>
                  </div>

                  {(selStep.followUp || fieldsEdit) && (
                    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border px-5 py-4">
                      <p className="text-[15px] font-semibold text-foreground">Depois, se precisar</p>
                      {selStep.followUp ? (fieldsEdit ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <select aria-label="Quando o dado" className={INPUT} value={selStep.followUp.whenField} onChange={(e) => mutate((c) => { c.steps[selStepIdx].followUp!.whenField = e.target.value; })}>{selStep.fields.map((f) => <option key={f.key} value={f.key}>{capitalize(f.label)}</option>)}</select>
                          <input aria-label="For igual a" className={INPUT} value={selStep.followUp.equals} onChange={(e) => mutate((c) => { c.steps[selStepIdx].followUp!.equals = e.target.value; })} placeholder="for igual a (ex: sim)" />
                          <select aria-label="E faltar" className={INPUT} value={selStep.followUp.missingField} onChange={(e) => mutate((c) => { c.steps[selStepIdx].followUp!.missingField = e.target.value; })}>{selStep.fields.map((f) => <option key={f.key} value={f.key}>{capitalize(f.label)}</option>)}</select>
                          <input aria-label="Vezes que pergunta" type="number" min={1} max={3} className={INPUT} value={selStep.followUp.maxAsks} onChange={(e) => mutate((c) => { c.steps[selStepIdx].followUp!.maxAsks = Math.max(1, Math.min(3, Number(e.target.value) || 1)); })} />
                          <div className="md:col-span-2"><Area rows={2} value={selStep.followUp.question} onChange={(v) => mutate((c) => { c.steps[selStepIdx].followUp!.question = v; })} /></div>
                          <button type="button" className="w-fit text-[13px] font-semibold text-destructive hover:underline" onClick={() => mutate((c) => { c.steps[selStepIdx].followUp = undefined; })}>Remover pergunta de complemento</button>
                        </div>
                      ) : (
                        <p className="text-[15px] leading-[150%] text-foreground/90">Se {selStep.fields.find((f) => f.key === selStep.followUp!.whenField)?.label ?? selStep.followUp.whenField} for {selStep.followUp.equals} e faltar {selStep.fields.find((f) => f.key === selStep.followUp!.missingField)?.label ?? selStep.followUp.missingField}, pergunta {selStep.followUp.maxAsks} {selStep.followUp.maxAsks === 1 ? 'vez' : 'vezes'}: “{selStep.followUp.question}”</p>
                      )) : (
                        <button type="button" className={cn('w-fit text-sm font-semibold hover:underline', LIME)} onClick={() => mutate((c) => { const f = c.steps[selStepIdx].fields; c.steps[selStepIdx].followUp = { whenField: f[0].key, equals: 'sim', missingField: (f[1] ?? f[0]).key, question: '', maxAsks: 1 }; })}>Adicionar pergunta de complemento</button>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <button type="button" onClick={() => setMoreOpts((v) => !v)} className="w-fit text-sm font-semibold text-muted-foreground hover:text-foreground">{moreOpts ? 'Menos opções' : 'Mais opções'}</button>
                    {moreOpts && (
                      <div className="grid gap-4 rounded-xl border border-border px-5 py-4 md:grid-cols-2">
                        <Labeled label="Vezes que pode perguntar" htmlFor="s-max" help="Depois disso, segue sem a resposta ou passa para uma pessoa."><input id="s-max" type="number" min={1} max={6} className={INPUT} value={selStep.maxAsks ?? 3} onChange={(e) => mutate((c) => { c.steps[selStepIdx].maxAsks = Math.max(1, Math.min(6, Number(e.target.value) || 3)); })} /></Labeled>
                        <Labeled label="Se o lead não responder"><label className="flex items-center gap-3 text-[15px] text-foreground"><Toggle on={!!selStep.skippable} onChange={(v) => mutate((c) => { c.steps[selStepIdx].skippable = v || undefined; })} label="Seguir sem essa resposta" />{selStep.skippable ? 'Segue sem essa resposta' : 'Passa para uma pessoa'}</label></Labeled>
                        <div className="md:col-span-2"><Labeled label="Quando só parte dos dados veio" optional htmlFor="s-part" help="Use {faltando} para o que faltou."><Area id="s-part" rows={2} value={selStep.partialQuestion ?? ''} onChange={(v) => mutate((c) => { c.steps[selStepIdx].partialQuestion = v || undefined; })} /></Labeled></div>
                      </div>
                    )}
                  </div>

                  <div><button type="button" onClick={() => retest({ stepId: selStep.id })} className={PILL_GREEN}>Testar a partir desta pergunta</button></div>
                </>
              ) : <p className="py-16 text-center text-muted-foreground">Escolha uma pergunta na lista.</p>}
            </section>
          </>
        )}

        {/* ─── Preço ─── */}
        {section === 'preco' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
              <div className="flex flex-col gap-1 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Quando o lead pergunta o preço</h3><p className="text-[13px] leading-[150%] text-muted-foreground">Cada pergunta recebe a resposta da posição seguinte.</p></div>
              <div className="px-6 pb-3"><label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground dark:bg-[#181818]">Pode informar valores<Toggle on={!!draft.priceDisclosure} onChange={(v) => mutate((c) => { c.priceDisclosure = v; })} label="Pode informar valores" /></label></div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                {draft.priceScripts.map((s, i) => <ListRow key={i} active={priceSel === String(i)} edited={priceEdited && saved.priceScripts[i] !== s} title={`${ordinal(i + 1)} pergunta de preço`} sub={s} onClick={() => setPriceSel(String(i))} />)}
                <ListRow active={priceSel === 'insist'} edited={priceEdited && saved.priceInsistHandoff !== draft.priceInsistHandoff} title={`${ordinal(draft.priceScripts.length + 1)} em diante, se insistir`} sub={`Passa para ${humanName}`} onClick={() => setPriceSel('insist')} />
                <ListRow active={priceSel === 'pos'} edited={priceEdited && saved.pricePosRoteiro !== draft.pricePosRoteiro} title="Depois das perguntas" sub={draft.pricePosRoteiro || 'Usa a resposta de preço normal'} onClick={() => setPriceSel('pos')} />
              </div>
              <div className="border-t border-border p-4"><button type="button" onClick={() => { mutate((c) => { c.priceScripts.push(''); c.priceHandoffAt = c.priceScripts.length; }); setPriceSel(String(draft.priceScripts.length)); }} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar resposta</button></div>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
              {priceSel === 'insist' ? (
                <>
                  <EditorHead eyebrow="Preço" title="Se insistir" edited={priceEdited && saved.priceInsistHandoff !== draft.priceInsistHandoff} subtitle={`Quando o lead pergunta de novo, o agente responde e passa para ${humanName}.`} />
                  <Labeled label="O que o agente responde" htmlFor="pi"><Area id="pi" rows={5} value={draft.priceInsistHandoff} edited={priceEdited && saved.priceInsistHandoff !== draft.priceInsistHandoff} onChange={(v) => mutate((c) => { c.priceInsistHandoff = v; })} /></Labeled>
                </>
              ) : priceSel === 'pos' ? (
                <>
                  <EditorHead eyebrow="Preço" title="Depois das perguntas" edited={priceEdited && saved.pricePosRoteiro !== draft.pricePosRoteiro} subtitle="Resposta usada quando o lead pergunta o preço só depois do roteiro terminar. Vazio usa a resposta normal." />
                  <Labeled label="O que o agente responde" optional htmlFor="pp"><Area id="pp" rows={5} value={draft.pricePosRoteiro ?? ''} edited={priceEdited && saved.pricePosRoteiro !== draft.pricePosRoteiro} onChange={(v) => mutate((c) => { c.pricePosRoteiro = v || undefined; })} /></Labeled>
                </>
              ) : (() => {
                const i = Math.min(Number(priceSel) || 0, draft.priceScripts.length - 1);
                const edited = priceEdited && saved.priceScripts[i] !== draft.priceScripts[i];
                return (
                  <>
                    <EditorHead eyebrow={`Preço, resposta ${i + 1} de ${draft.priceScripts.length}`} title={`${ordinal(i + 1)} pergunta de preço`} edited={edited}
                      actions={<RemoveButton label="Remover resposta" onClick={() => { if (draft.priceScripts.length <= 1) { toast({ title: 'É preciso ter pelo menos uma resposta de preço', variant: 'warning' }); return; } mutate((c) => { c.priceScripts.splice(i, 1); c.priceHandoffAt = Math.min(c.priceHandoffAt ?? c.priceScripts.length, c.priceScripts.length); }); setPriceSel('0'); }} />} />
                    <Labeled label="O que o agente responde" htmlFor="pr" help="As quebras de linha são mantidas na mensagem."><Area id="pr" rows={8} value={draft.priceScripts[i] ?? ''} edited={edited} onChange={(v) => mutate((c) => { c.priceScripts[i] = v; })} /></Labeled>
                    <div className="flex flex-col gap-3">
                      <p className="text-[15px] font-semibold text-foreground">Como o agente escolhe a resposta</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        {[...draft.priceScripts.map((_, k) => ({ when: `${ordinal(k + 1)} vez${k === 0 ? ' que pergunta' : ''}`, what: `Resposta ${k + 1}${k === i ? ' (esta)' : ''}`, on: k === i })), { when: `${ordinal(draft.priceScripts.length + 1)} vez em diante`, what: `Passa para ${humanName}`, on: false }].slice(0, 4).map((c, k) => (
                          <div key={k} className={cn('flex flex-col gap-1 rounded-xl border px-5 py-4', c.on ? 'border-[#01573C]/30 bg-[#E4F1E9] dark:border-transparent dark:bg-[#12301F]' : 'border-border')}><span className="text-[13px] text-muted-foreground">{c.when}</span><span className="text-[15px] font-semibold text-foreground">{c.what}</span></div>
                        ))}
                      </div>
                    </div>
                    <div><button type="button" onClick={() => retest({ say: 'Quanto custa?' })} className={PILL_GREEN}>Testar perguntando o preço</button></div>
                  </>
                );
              })()}
            </section>
          </>
        )}

        {/* ─── Objeções e dúvidas ─── */}
        {section === 'objecoes' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
              <div className="flex flex-col gap-3 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Objeções e dúvidas</h3>
                <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-muted px-3.5 dark:border-[#2A2A2A] dark:bg-[#181818]"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label="Buscar" placeholder="Buscar" value={objSearch} onChange={(e) => setObjSearch(e.target.value)} className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" /></div></div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                {(['objecao', 'faq'] as const).map((kind) => {
                  const keys = objFiltered.filter((k) => draft.objections[k].kind === kind);
                  return (
                    <div key={kind} className="flex flex-col gap-0.5">
                      <p className="px-3.5 pb-1 pt-3 text-[13px] font-semibold text-muted-foreground">{kind === 'objecao' ? 'Objeções' : 'Dúvidas comuns'} {objectionKeys.filter((k) => draft.objections[k].kind === kind).length}</p>
                      {keys.map((k) => <ListRow key={k} active={k === objSel} edited={!saved.objections[k] || !same(saved.objections[k], draft.objections[k])} title={objectionTitle(k)} onClick={() => setObjSel(k)} />)}
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border p-4"><button type="button" onClick={() => { const name = window.prompt('Nome curto da objeção ou dúvida (ex: prazo, garantia)'); const key = slugify(name ?? ''); if (!key) return; if (draft.objections[key]) { setObjSel(key); return; } mutate((c) => { c.objections[key] = { kind: 'faq', triggers: '', scripts: [''] }; }); setObjSel(key); }} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar objeção ou dúvida</button></div>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
              {obj ? (
                <>
                  <EditorHead eyebrow={`${obj.kind === 'objecao' ? 'Objeção' : 'Dúvida'} ${objectionKeys.indexOf(objSel) + 1} de ${objectionKeys.length}`} title={objectionTitle(objSel)} edited={!saved.objections[objSel] || !same(saved.objections[objSel], obj)}
                    actions={<RemoveButton label="Remover" onClick={() => { if (!window.confirm('Remover esta objeção ou dúvida?')) return; const rest = objectionKeys.filter((k) => k !== objSel); mutate((c) => { delete c.objections[objSel]; }); setObjSel(rest[0] ?? ''); }} />} />
                  <Labeled label="Tipo" help="Objeção conta para o limite de insistência. Dúvida comum não conta.">
                    <div className="flex w-fit items-center gap-0.5 rounded-full bg-muted p-1 dark:bg-[#141414]">{([['objecao', 'Objeção'], ['faq', 'Dúvida comum']] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={obj.kind === v} onClick={() => mutate((c) => { c.objections[objSel].kind = v; })} className={cn('rounded-full px-5 py-2 text-sm transition-colors', obj.kind === v ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}>{l}</button>)}</div>
                  </Labeled>
                  <Labeled label="Como o lead costuma dizer isso" htmlFor="o-t"><Area id="o-t" rows={2} value={obj.triggers} onChange={(v) => mutate((c) => { c.objections[objSel].triggers = v; })} /></Labeled>
                  {obj.scripts.map((sc, i) => (
                    <Labeled key={i} label={`Resposta ${i + 1}`} htmlFor={`o-s${i}`}>
                      <Area id={`o-s${i}`} rows={3} value={sc} onChange={(v) => mutate((c) => { c.objections[objSel].scripts[i] = v; })} />
                      <div className="flex items-center justify-between"><span className="text-[13px] text-muted-foreground">{i === 0 ? 'usada uma vez por conversa' : 'usada quando o lead repete'}</span>{obj.scripts.length > 1 && <button type="button" className="text-[13px] font-semibold text-destructive hover:underline" onClick={() => mutate((c) => { c.objections[objSel].scripts.splice(i, 1); })}>Remover resposta</button>}</div>
                    </Labeled>
                  ))}
                  <button type="button" onClick={() => mutate((c) => { c.objections[objSel].scripts.push(''); })} className={cn('flex w-fit items-center gap-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar outra resposta</button>
                  <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-6 py-5 dark:border-[#2A2A2A] dark:bg-[#141414]">
                    <div className="flex items-center justify-between gap-4"><p className="text-base font-semibold text-foreground">Limite de objeções</p>
                      <div className="flex items-center gap-3"><button type="button" aria-label="Diminuir" onClick={() => mutate((c) => { c.maxObjections = Math.max(1, c.maxObjections - 1); })} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-lg text-foreground hover:bg-accent dark:bg-[#1E1E1E]">-</button><span className="w-5 text-center text-base font-semibold text-foreground">{draft.maxObjections}</span><button type="button" aria-label="Aumentar" onClick={() => mutate((c) => { c.maxObjections = Math.min(6, c.maxObjections + 1); })} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-lg text-foreground hover:bg-accent dark:bg-[#1E1E1E]">+</button></div></div>
                    <p className="text-sm leading-[150%] text-muted-foreground">Depois de {draft.maxObjections} {draft.maxObjections === 1 ? 'objeção' : 'objeções'} o agente encerra sem pressionar. Objeção repetida passa para uma pessoa em vez de insistir.</p>
                  </div>
                  <div><button type="button" onClick={() => retest({ say: (obj.triggers.match(/[“"]([^”"]+)[”"]/)?.[1] ?? obj.triggers.split(',')[0] ?? '').trim() || objectionTitle(objSel) })} className={PILL_GREEN}>Testar com esta {obj.kind === 'objecao' ? 'objeção' : 'dúvida'}</button></div>
                </>
              ) : <p className="py-16 text-center text-muted-foreground">Escolha uma objeção ou dúvida na lista.</p>}
            </section>
          </>
        )}

        {/* ─── Encerramentos ─── */}
        {section === 'encerramentos' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
              <div className="flex flex-col gap-1 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Encerramentos</h3><p className="text-[13px] leading-[150%] text-muted-foreground">O que o agente diz quando a conversa sai do roteiro.</p></div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                <p className="px-3.5 pb-1 pt-2 text-[13px] font-semibold text-muted-foreground">Mensagens</p>
                {CLOSINGS.map((c) => <ListRow key={c.id} active={closingSel === c.id} edited={closingEdited(c)} title={c.title} sub={getClosing(draft, c.fields[0].key) || 'Sem mensagem'} onClick={() => setClosingSel(c.id)} />)}
                <p className="px-3.5 pb-1 pt-4 text-[13px] font-semibold text-muted-foreground">Ajustes</p>
                <ListRow active={closingSel === 'reactions'} edited={(saved.reactions !== false) !== (draft.reactions !== false)} title="Reação humana" onClick={() => setClosingSel('reactions')} right={<span className={cn('text-sm font-semibold', draft.reactions !== false ? LIME : 'text-muted-foreground')}>{draft.reactions !== false ? 'Ligada' : 'Desligada'}</span>} />
                <ListRow active={closingSel === 'names'} edited={!same(saved.agentNames ?? [], draft.agentNames ?? [])} title="Nomes de quem atende" onClick={() => setClosingSel('names')} right={<span className="max-w-[120px] truncate text-[13px] text-muted-foreground">{(draft.agentNames ?? []).join(', ')}</span>} />
              </div>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
              {closing ? (
                <>
                  <EditorHead eyebrow="Encerramento" title={closing.title} edited={closingEdited(closing)} subtitle={closing.desc} />
                  {closing.fields.map((f) => (
                    <Labeled key={f.key} label={f.label} optional={f.optional} htmlFor={`c-${f.key}`}><Area id={`c-${f.key}`} rows={f.key === 'callConfirm' ? 2 : 4} value={getClosing(draft, f.key)} edited={getClosing(saved, f.key) !== getClosing(draft, f.key)} onChange={(v) => mutate((c) => setClosing(c, f.key, v))} /></Labeled>
                  ))}
                  {closing.id === 'call' && (
                    <div className="flex flex-col gap-3"><p className="text-[15px] font-semibold text-foreground">Como acontece</p>
                      <div className="grid gap-3 md:grid-cols-3">{[['1. Lead pede ligação', 'Agente envia a oferta'], ['2. Lead aceita', 'Agente envia a confirmação'], ['3. Depois', `Passa para ${humanName}`]].map(([a, b]) => <div key={a} className="flex flex-col gap-1 rounded-xl border border-border px-5 py-4"><span className="text-[13px] text-muted-foreground">{a}</span><span className="text-[15px] font-semibold text-foreground">{b}</span></div>)}</div></div>
                  )}
                  <div><button type="button" onClick={() => retest({ say: closing.id === 'call' ? 'Pode me ligar?' : closing.id === 'refusal' ? 'Não tenho interesse' : closing.id === 'farewell' ? 'Obrigado, tchau!' : closing.id === 'defer' ? 'Estou ocupado agora, falo com você depois' : closing.id === 'about' ? 'Do que se trata?' : closing.id === 'handoff' ? 'Quero falar com uma pessoa' : closing.id === 'unknown' ? 'Vocês entregam para o exterior?' : 'Oi' })} className={PILL_GREEN}>Testar {closing.id === 'call' ? 'pedindo ligação' : 'esta mensagem'}</button></div>
                </>
              ) : closingSel === 'reactions' ? (
                <>
                  <EditorHead eyebrow="Ajuste" title="Reação humana" subtitle="Quando o lead conta algo além da resposta, o agente reage com uma frase curta antes de seguir." />
                  <label className="flex w-fit items-center gap-3 text-[15px] font-semibold text-foreground"><Toggle on={draft.reactions !== false} onChange={(v) => mutate((c) => { c.reactions = v; })} label="Reação humana" />{draft.reactions !== false ? 'Ligada' : 'Desligada'}</label>
                </>
              ) : (
                <>
                  <EditorHead eyebrow="Ajuste" title="Nomes de quem atende" subtitle="Nomes do agente e da equipe. Nunca são aceitos como o nome do lead (“Oi Bruno” é o lead falando com a gente)." />
                  <Labeled label="Nomes, separados por vírgula" htmlFor="c-names"><input id="c-names" className={INPUT} value={(draft.agentNames ?? []).join(', ')} onChange={(e) => mutate((c) => { c.agentNames = e.target.value.split(',').map((n) => n.trimStart()); })} /></Labeled>
                </>
              )}
            </section>
          </>
        )}

        <ConversaTest draft={draft} agentName={agentName} dirty={dirty} seed={seed} />
      </div>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Alterações não publicadas</DialogTitle><DialogDescription>O agente só usa estas mudanças depois de você publicar.</DialogDescription></DialogHeader>
          <ul className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">{changes.map((c, i) => <li key={i} className="flex items-center gap-3 rounded-lg bg-muted px-4 py-2.5 text-[15px] text-foreground"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5B544]" />{c}</li>)}</ul>
          <DialogFooter><button type="button" onClick={() => setChangesOpen(false)} className={PILL3D}>Fechar</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
