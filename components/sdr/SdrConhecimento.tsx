'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, RotateCcw, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { askConfirm } from './ConfirmHost';
import { toast } from '@/components/ui/use-toast';
import { AgentAssistant } from './AgentAssistant';
import { CARD, INPUT, LIME, PILL3D, PILL_GREEN } from './ui';
import { clone, same } from './funnel-model';
import type { AgentPersona } from './useSdrConfig';
import type { SdrVariables } from '@/lib/sdr/templates';

interface Topic { header: string; title: string; body: string }
type Kind = 'conhecimento' | 'objecoes';
interface Group { kind: Kind; updatedAt: string | null; topics: Topic[] }

const KIND_LABEL: Record<Kind, string> = { conhecimento: 'Sobre a empresa', objecoes: 'Objeções e dúvidas' };
const SUGGESTIONS = ['Quanto custa?', 'Como funciona?', 'Vocês atendem na minha cidade?'];
const dm = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

function variablesOf(p: AgentPersona): SdrVariables {
  return {
    nome_agente: p.nome_agente, nome_empresa: p.empresa, descricao_produto: p.produto, tom_agente: p.tom, horario: p.horario, url_empresa: p.url_empresa,
    preco: p.preco, periodo_teste: p.periodo_teste, link_teste: p.link_teste, link_playlist: p.link_playlist, link_agendamento: p.link_agendamento,
    link_catalogo: p.link_catalogo, link_pedido: p.link_pedido, endereco: p.endereco, taxa_entrega: p.taxa_entrega, tempo_entrega: p.tempo_entrega,
    area_entrega: p.area_entrega, formas_pagamento: p.formas_pagamento, valor_minimo_pedido: p.valor_minimo_pedido, pedido_tipo: p.pedido_tipo,
  } as SdrVariables;
}

interface Msg { from: 'lead' | 'agent' | 'note'; text: string }

function AskPanel({ agent }: { agent: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { from: 'lead', text }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/sdr/knowledge/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Não foi possível testar agora.');
      setMsgs((m) => [...m, j.answer ? { from: 'agent', text: j.answer } : { from: 'note', text: `A ${agent} não achou isso na base. Numa conversa real, ela passaria para uma pessoa da equipe.` }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: 'note', text: e instanceof Error ? e.message : 'Não foi possível testar agora.' }]);
    } finally { setBusy(false); }
  }

  return (
    <aside className={cn(CARD, 'flex min-h-0 w-full shrink-0 flex-col xl:h-full xl:w-[380px]')}>
      <div className="flex flex-col gap-2 border-b border-border px-6 py-5"><h3 className="text-xl font-semibold text-foreground">Pergunte à {agent}</h3><p className="text-[15px] leading-[150%] text-muted-foreground">Veja como ela responde com o que está na base. Nada é enviado a clientes.</p></div>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-4"><p className="text-[13px] text-muted-foreground">Experimente perguntar</p>
        <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">{s}</button>)}</div></div>
      <div className="flex min-h-[200px] flex-1 flex-col justify-end gap-3 overflow-y-auto px-6 py-5" aria-live="polite">
        {msgs.map((m, i) => m.from === 'note' ? <p key={i} className="self-center rounded-full bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">{m.text}</p>
          : m.from === 'agent' ? <div key={i} className="max-w-[92%] self-start rounded-xl rounded-tl-sm bg-[#E4F1E9] px-4 py-3 dark:bg-[#12301F]"><p className="mb-1 text-xs font-semibold text-[#01573C] dark:text-[#96F63C]">{agent}</p><p className="whitespace-pre-wrap text-[15px] leading-[150%] text-foreground">{m.text}</p></div>
          : <div key={i} className="max-w-[92%] self-end rounded-xl rounded-tr-sm bg-muted px-4 py-3 text-[15px] leading-[150%] text-foreground dark:bg-[#1E1E1E]">{m.text}</div>)}
        {busy && <p className="self-start px-2 text-sm text-muted-foreground">{agent} está procurando na base…</p>}
        <div ref={end} />
      </div>
      <form className="flex items-center gap-3 border-t border-border px-5 py-4" onSubmit={(e) => { e.preventDefault(); void ask(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escreva como o lead" aria-label="Pergunta do lead" className="h-11 min-w-0 flex-1 rounded-full border border-border bg-muted px-5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground dark:border-[#2A2A2A] dark:bg-[#181818]" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#01573C] text-white shadow-[inset_0_1px_0_#FFFFFF26,0_3px_0_#003526] disabled:opacity-60"><Send className="h-[18px] w-[18px]" /></button>
      </form>
      <div className="flex items-center justify-between border-t border-border px-6 py-3.5 text-sm text-muted-foreground"><button type="button" onClick={() => setMsgs([])} className="flex items-center gap-2 hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" />Reiniciar conversa</button><span>Testa a base publicada</span></div>
    </aside>
  );
}

export function SdrConhecimento({ persona, flowId, agentActive, onReload }: { persona: AgentPersona; flowId: string | null; agentActive: boolean; onReload: () => Promise<void> }) {
  const agent = persona.nome_agente || 'agente';
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [draft, setDraft] = useState<Group[] | null>(null);
  const [kind, setKind] = useState<Kind>('conhecimento');
  const [sel, setSel] = useState(0);
  const [saving, setSaving] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const holder = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  // Em tela larga, a base ocupa a altura que sobra (sem estourar a página); em tela estreita, empilha
  useEffect(() => {
    const fit = () => {
      const el = holder.current;
      if (!el || window.innerWidth < 1280) { setHeight(undefined); return; }
      setHeight(Math.max(560, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 24)));
    };
    fit();
    const t = setTimeout(fit, 300);
    window.addEventListener('resize', fit);
    return () => { window.removeEventListener('resize', fit); clearTimeout(t); };
  }, [groups]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sdr/knowledge');
      if (!res.ok) throw new Error();
      const j = await res.json();
      const sentence = (s: string) => (s === s.toUpperCase() && s !== s.toLowerCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);
      const g = ((j.groups ?? []) as Group[]).map((x) => ({ ...x, topics: x.topics.map((t) => ({ ...t, title: sentence(t.title) })) }));
      setGroups(g);
      setDraft(clone(g));
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (failed) return <p className="py-16 text-center text-muted-foreground">Não foi possível carregar a base agora. Tente de novo em instantes.</p>;
  if (!groups || !draft) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const g = draft.find((x) => x.kind === kind);
  const saved = groups.find((x) => x.kind === kind);
  const topics = g?.topics ?? [];
  const topic = topics[Math.min(sel, topics.length - 1)];
  const idx = Math.min(sel, Math.max(0, topics.length - 1));
  const PER_PAGE = 7;
  const pages = Math.max(1, Math.ceil(topics.length / PER_PAGE));
  const curPage = Math.min(page, pages - 1);
  const visible = topics.map((t, i) => ({ t, i })).slice(curPage * PER_PAGE, (curPage + 1) * PER_PAGE);
  const isEdited = (i: number) => { const o = saved?.topics.find((_, k) => k === i); return !o || !same(o, topics[i]); };
  const total = groups.reduce((n, x) => n + x.topics.length, 0);
  const dirtyGroup = !same(saved?.topics ?? [], topics);

  const upd = (fn: (t: Topic[]) => void) => setDraft((d) => d && d.map((x) => { if (x.kind !== kind) return x; const t = clone(x.topics); fn(t); return { ...x, topics: t }; }));

  async function persist(next: Topic[]) {
    setSaving(true);
    try {
      const res = await fetch('/api/sdr/knowledge', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, topics: next }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Não foi possível salvar');
      await load();
      toast({ title: 'Base atualizada', description: `A ${agent} já responde com o texto novo.`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Não foi possível salvar', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  const empty = total === 0;

  return (
    <div ref={holder} style={{ height }} className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
      <aside className={cn(CARD, 'flex min-h-[560px] w-full shrink-0 flex-col xl:h-full xl:min-h-0 xl:w-[360px]')}>
        <div className="flex flex-col gap-2 px-6 pb-3 pt-6"><h3 className="text-xl font-semibold text-foreground">O que a {agent} sabe</h3><p className="text-[15px] leading-[150%] text-muted-foreground">Textos que ela consulta para responder o lead. Se a resposta não estiver aqui, ela passa a conversa para uma pessoa.</p></div>
        <div className="flex flex-col gap-1 px-4 pb-2">
          {(['conhecimento', 'objecoes'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setSel(0); setPage(0); }} className={cn('flex items-center justify-between rounded-xl px-3.5 py-3 text-left text-[15px] transition-colors', kind === k ? 'bg-[#E4F1E9] font-semibold dark:bg-[#12301F]' : 'hover:bg-muted')}><span className="text-foreground">{KIND_LABEL[k]}</span><span className="tabular-nums text-muted-foreground">{groups.find((x) => x.kind === k)?.topics.length ?? 0}</span></button>
          ))}
        </div>
        <div className="mx-6 my-2 border-t border-border" />
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-4 pb-3">
          {visible.map(({ t, i }) => (
            <button key={i} type="button" aria-current={i === idx ? 'true' : undefined} onClick={() => setSel(i)} className={cn('flex flex-col gap-0.5 rounded-xl px-3.5 py-3 text-left transition-colors', i === idx ? 'bg-[#E4F1E9] dark:bg-[#12301F]' : 'hover:bg-muted')}>
              <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><span className="truncate">{t.title}</span>{isEdited(i) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5B544]" aria-label="Editado" />}</span>
              <span className="truncate text-[13px] text-muted-foreground">{t.body.split('\n')[0]}</span>
            </button>
          ))}
          {topics.length === 0 && <p className="px-3.5 py-4 text-sm text-muted-foreground">Nada aqui ainda.</p>}
        </div>
        {topics.length > PER_PAGE && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
            <span>{curPage * PER_PAGE + 1} a {Math.min((curPage + 1) * PER_PAGE, topics.length)} de {topics.length}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={curPage === 0} onClick={() => setPage(curPage - 1)} className="rounded-full bg-muted px-3.5 py-1.5 font-medium transition-colors enabled:hover:text-foreground disabled:opacity-50">Anterior</button>
              <button type="button" disabled={curPage >= pages - 1} onClick={() => setPage(curPage + 1)} className="rounded-full bg-muted px-3.5 py-1.5 font-semibold text-foreground transition-colors enabled:hover:bg-accent disabled:opacity-50">Próxima</button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 p-4">
          <button type="button" disabled={!flowId} onClick={() => { upd((t) => { t.push({ header: '', title: 'Novo assunto', body: '' }); }); setSel(topics.length); setPage(Math.floor(topics.length / PER_PAGE)); }} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-[#01573C] hover:bg-muted disabled:opacity-50 dark:text-[#96F63C]"><Plus className="h-4 w-4" />Adicionar assunto</button>
          <button type="button" disabled={!flowId} onClick={() => setAssistantOpen(true)} className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"><Sparkles className="h-4 w-4" />{empty ? 'Criar a base com o assistente' : 'Refazer a base com o assistente'}</button>
        </div>
      </aside>

      <section className={cn(CARD, 'flex min-h-[560px] min-w-0 flex-1 flex-col gap-6 px-9 py-8 xl:h-full xl:min-h-0')}>
        {empty && !dirtyGroup ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-4">
            <h3 className="text-[28px] font-semibold tracking-tight text-foreground">A base da {agent} está vazia</h3>
            <p className="max-w-xl text-[15px] leading-[160%] text-muted-foreground">Sem base, o agente não tem o que consultar e passa quase toda pergunta para uma pessoa. O assistente monta os textos com você em poucos passos.</p>
            <button type="button" disabled={!flowId} onClick={() => setAssistantOpen(true)} className={PILL_GREEN}><Sparkles className="h-4 w-4" />Criar a base com o assistente</button>
            {!flowId && <p className="text-sm text-amber-600 dark:text-[#F5B544]">Salve a configuração do agente na aba Conversa antes de criar a base.</p>}
          </div>
        ) : topic ? (
          <>
            <div className="flex flex-col gap-2">
              <input aria-label="Nome do assunto" value={topic.title} onChange={(e) => upd((t) => { t[idx].title = e.target.value; })} className="w-full bg-transparent text-[28px] font-semibold leading-8 tracking-tight text-foreground outline-none" />
              <p className="text-[15px] text-muted-foreground">A {agent} usa este texto quando o lead pergunta sobre este assunto.</p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5">
              <label htmlFor="kn-body" className="text-lg font-semibold text-foreground">O que está escrito</label>
              <textarea id="kn-body" rows={10} value={topic.body} onChange={(e) => upd((t) => { t[idx].body = e.target.value; })} className={cn(INPUT, 'min-h-[180px] flex-1 resize-none text-base leading-[170%]', isEdited(idx) && 'border-[#F5B544] focus:border-[#F5B544] dark:border-[#F5B544] dark:focus:border-[#F5B544]')} />
              {saved?.updatedAt && <p className="text-sm text-muted-foreground">Última alteração em {dm(saved.updatedAt)}</p>}
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-3">
              <button type="button" disabled={saving || !dirtyGroup || topics.some((t) => !t.title.trim())} onClick={() => void persist(topics)} className={PILL_GREEN}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar alterações'}</button>
              <button type="button" disabled={!dirtyGroup || saving} onClick={() => { setDraft(clone(groups)); }} className={PILL3D}>Descartar</button>
              <button type="button" disabled={saving || topics.length <= 1} onClick={async () => { if (!(await askConfirm(`Remover o assunto "${topic.title}"? A ${agent} deixa de saber isso.`))) return; const next = topics.filter((_, i) => i !== idx); setSel(0); void persist(next); }} className="ml-auto text-sm font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-[#F0736D]">Remover assunto</button>
            </div>
          </>
        ) : <p className="py-16 text-center text-muted-foreground">Escolha um assunto na lista.</p>}
      </section>

      <AskPanel agent={agent} />

      <AgentAssistant
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        flowId={flowId}
        variables={variablesOf(persona)}
        agentActive={agentActive}
        hasExistingBase={!empty}
        onAgentName={() => undefined}
        onBuilt={() => { void load(); void onReload(); }}
        onCreated={() => setAssistantOpen(false)}
      />
    </div>
  );
}
