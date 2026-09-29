'use client';

// Tela de Conversa do SDR v3 (motor novo, decisor em código). Diferente do funil v2
// (SdrConversa/FunnelConfig): a config aqui é `CompanyConfig`, versionada em `sdr_company_configs`,
// lida e salva via /api/sdr/v3/config. Mostrada só pra empresa com company.features.sdr_v3 === true
// (ver app/(dashboard)/configuracoes/sdr/page.tsx).
//
// Escopo desta tela: as 5 seções da config que valem pra qualquer empresa v3 (persona, perguntas,
// preço, objeções, encerramentos). Ficam de fora por ora (edição só via SQL): ligação, fatos,
// nunca_prometer, regras_redator, validador, agendamento, palavras_proibidas, como_funciona.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { askConfirm } from './ConfirmHost';
import { CARD, Chips, INPUT, LIME, PILL3D, PILL_GREEN, Toggle } from './ui';
import type { CompanyConfig, ObjecaoConfig, PerguntaQualificacao, ProximaAcaoObjecao } from '@/lib/sdr/v3/config-types';

type Section = 'agente' | 'perguntas' | 'preco' | 'objecoes' | 'encerramentos';
const ACOES: { value: ProximaAcaoObjecao; label: string }[] = [
  { value: 'aguardar', label: 'Aguardar' },
  { value: 'voltar_qualificacao', label: 'Voltar pra qualificação' },
  { value: 'encerrar', label: 'Encerrar' },
  { value: 'escalar', label: 'Escalar pra pessoa' },
];

// ── peças reaproveitadas do mesmo padrão visual do funil v2 (SdrConversa.tsx) ──
function Labeled({ label, optional, help, children, htmlFor }: { label: string; optional?: boolean; help?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[15px] font-semibold text-foreground">{label}{optional && <span className="text-[13px] font-normal text-muted-foreground">opcional</span>}</label>
      {children}
      {help && <p className="text-[13px] text-muted-foreground">{help}</p>}
    </div>
  );
}
function Area({ value, onChange, rows = 3, id }: { value: string; onChange: (v: string) => void; rows?: number; id?: string }) {
  return <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={cn(INPUT, 'resize-y leading-[160%]')} />;
}
function ListRow({ active, title, sub, num, onClick }: { active: boolean; title: string; sub?: string; num: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors', active ? 'bg-[#E4F1E9] dark:bg-[#12301F]' : 'hover:bg-muted')}>
      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold', active ? 'border-[#01573C] bg-[#01573C] text-white dark:border-[#96F63C] dark:bg-transparent dark:text-[#96F63C]' : 'border-border text-foreground')}>{num}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold text-foreground">{title}</span>
        {sub && <span className="truncate text-[13px] text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-2 text-sm font-semibold text-destructive hover:underline"><Trash2 className="h-4 w-4" />{label}</button>;
}
const joinLines = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join('\n') : v ?? '');
const splitLines = (v: string) => v.split('\n').map((l) => l.trim()).filter(Boolean);

const BANT: Omit<PerguntaQualificacao, 'ordem'>[] = [
  { id: 'orcamento', campo: 'orcamento', texto: 'Você já separou um valor pra investir nisso, ou ainda não pensou?', obrigatoria: false },
  { id: 'decisor', campo: 'decisor', texto: 'Você é quem decide sobre esse investimento, ou tem mais alguém envolvido?', obrigatoria: true },
  { id: 'necessidade', campo: 'necessidade', texto: 'O que pesa mais hoje pra você resolver isso?', obrigatoria: false },
  { id: 'prazo', campo: 'prazo', texto: 'Isso é algo que quer resolver logo, ou é mais pra frente?', obrigatoria: false },
];
const SPICED: Omit<PerguntaQualificacao, 'ordem'>[] = [
  { id: 'situacao', campo: 'situacao', texto: 'Me conta rapidinho como funciona hoje: time, ferramentas, como cuida disso agora.', obrigatoria: false },
  { id: 'dor', campo: 'dor', texto: 'O que mais incomoda nisso hoje?', obrigatoria: true },
  { id: 'impacto', campo: 'impacto', texto: 'Isso custa quanto, em tempo ou dinheiro, se continuar assim?', obrigatoria: false },
  { id: 'evento_critico', campo: 'evento_critico', texto: 'Tem algum prazo ou situação que torna isso urgente agora?', obrigatoria: false },
  { id: 'decisao', campo: 'decisao', texto: 'Como funciona a decisão aí, é só você ou tem mais gente envolvida?', obrigatoria: true },
];
const NOME_PADRAO: Omit<PerguntaQualificacao, 'ordem'> = { id: 'nome', campo: 'nome', texto: 'Olá, tudo bem? Qual o seu nome?', obrigatoria: false };
const TONS_RAPIDOS = ['Consultivo, direto e natural, no jeito de WhatsApp', 'Amigável e descontraído, poucos emojis', 'Formal e objetivo, sem emojis', 'Caloroso e paciente'];

export function SdrConversaV3() {
  const [section, setSection] = useState<Section>('agente');
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selQ, setSelQ] = useState<string | null>(null);
  const [selO, setSelO] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sdr/v3/config');
      const json = await res.json();
      const ativa = json?.data?.ativa?.config as CompanyConfig | undefined;
      setConfig(ativa ?? null);
      if (ativa?.qualificacao?.perguntas?.length) setSelQ(ativa.qualificacao.perguntas[0].id);
      if (ativa?.objecoes?.length) setSelO(ativa.objecoes[0].id);
    } catch {
      toast({ title: 'Não foi possível carregar a configuração do SDR', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const persist = useCallback(async (next: CompanyConfig, nota: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/sdr/v3/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: next, nota }) });
      const json = await res.json();
      if (!json.success) { toast({ title: json.message || 'Não foi possível salvar', variant: 'destructive' }); return false; }
      return true;
    } catch {
      toast({ title: 'Erro de conexão ao salvar', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);
  const scheduleSave = useCallback((next: CompanyConfig, nota: string) => {
    setConfig(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persist(next, nota); }, 900);
  }, [persist]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!config) return <div className={cn(CARD, 'px-8 py-8 text-center text-muted-foreground')}>Não achei a configuração do SDR v3 pra essa empresa.</div>;

  const perguntas = [...(config.qualificacao?.perguntas ?? [])].sort((a, b) => a.ordem - b.ordem);
  const objecoes = [...(config.objecoes ?? [])].sort((a, b) => a.prioridade - b.prioridade);
  const chips = [
    ['agente', 'Quem é o agente'],
    ['perguntas', `Perguntas ${perguntas.length}`],
    ['preco', 'Preço'],
    ['objecoes', `Objeções e dúvidas ${objecoes.length}`],
    ['encerramentos', 'Encerramentos'],
  ] as const;
  const card = 'flex min-h-[560px] flex-col';

  // ── ações: perguntas ──
  const escolherFramework = async (tipo: 'zero' | 'bant' | 'spiced') => {
    const base = tipo === 'bant' ? BANT : tipo === 'spiced' ? SPICED : [];
    const novas: PerguntaQualificacao[] = [{ ...NOME_PADRAO, ordem: 1 }, ...base.map((p, i) => ({ ...p, ordem: i + 2 }))];
    const next = { ...config, qualificacao: { perguntas: novas } };
    setConfig(next); setSelQ(novas[0]?.id ?? null);
    await persist(next, `Framework escolhido: ${tipo}`);
  };
  const mutarPergunta = (patch: Partial<PerguntaQualificacao>) => {
    const sel = perguntas.find((p) => p.id === selQ); if (!sel) return;
    const next = { ...config, qualificacao: { perguntas: perguntas.map((p) => (p.id === sel.id ? { ...p, ...patch } : p)) } };
    scheduleSave(next, `Editou pergunta "${sel.id}"`);
  };
  const removerPergunta = async () => {
    const sel = perguntas.find((p) => p.id === selQ); if (!sel) return;
    if (perguntas.length <= 1) { toast({ title: 'Precisa de pelo menos uma pergunta', variant: 'warning' }); return; }
    if (!(await askConfirm('Remover esta pergunta do roteiro?'))) return;
    const restantes = perguntas.filter((p) => p.id !== sel.id).map((p, i) => ({ ...p, ordem: i + 1 }));
    const next = { ...config, qualificacao: { perguntas: restantes } };
    setSelQ(restantes[0]?.id ?? null);
    await persist(next, `Removeu pergunta "${sel.id}"`);
  };
  const adicionarPergunta = async () => {
    let n = perguntas.length + 1; while (perguntas.some((p) => p.id === `pergunta_${n}`)) n++;
    const nova: PerguntaQualificacao = { id: `pergunta_${n}`, campo: `dado_${n}`, texto: '', obrigatoria: false, ordem: perguntas.length + 1 };
    const next = { ...config, qualificacao: { perguntas: [...perguntas, nova] } };
    setSelQ(nova.id);
    await persist(next, 'Adicionou pergunta');
  };

  // ── ações: objeções ──
  const mutarObjecao = (patch: Partial<ObjecaoConfig>) => {
    const sel = objecoes.find((o) => o.id === selO); if (!sel) return;
    const next = { ...config, objecoes: objecoes.map((o) => (o.id === sel.id ? { ...o, ...patch } : o)) };
    scheduleSave(next, `Editou objeção "${sel.id}"`);
  };
  const removerObjecao = async () => {
    const sel = objecoes.find((o) => o.id === selO); if (!sel) return;
    if (!(await askConfirm('Remover esta objeção?'))) return;
    const restantes = objecoes.filter((o) => o.id !== sel.id);
    const next = { ...config, objecoes: restantes };
    setSelO(restantes[0]?.id ?? null);
    await persist(next, `Removeu objeção "${sel.id}"`);
  };
  const adicionarObjecao = async () => {
    let n = objecoes.length + 1; while (objecoes.some((o) => o.id === `objecao_${n}`)) n++;
    const nova: ObjecaoConfig = { id: `objecao_${n}`, titulo: 'Nova objeção', gatilhos: [], modo: 'livre', resposta: '', proxima_acao: 'aguardar', conta_como_recusa: false, prioridade: objecoes.length + 1 };
    const next = { ...config, objecoes: [...objecoes, nova] };
    setSelO(nova.id);
    await persist(next, 'Adicionou objeção');
  };

  const selPergunta = perguntas.find((p) => p.id === selQ) ?? null;
  const selPerguntaIdx = perguntas.findIndex((p) => p.id === selQ);
  const selObjecao = objecoes.find((o) => o.id === selO) ?? null;
  const selObjecaoIdx = objecoes.findIndex((o) => o.id === selO);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end text-sm text-muted-foreground">
        {saving ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando…</span> : <span>Salvo</span>}
      </div>

      <Chips items={chips} active={section} onChange={setSection} label="Partes da conversa" />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
        {/* ── Quem é o agente ── */}
        {section === 'agente' && (
          <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-8')}>
            <div className="flex flex-col gap-1"><h3 className="text-lg font-semibold text-foreground">Quem é o agente</h3><p className="text-[13px] text-muted-foreground">Essas informações entram direto no comportamento do agente.</p></div>
            <div className="grid gap-x-5 gap-y-6 md:grid-cols-2">
              <Labeled label="Nome do agente" htmlFor="v3-nome-agente"><input id="v3-nome-agente" className={INPUT} value={config.persona?.nome_agente ?? ''} onChange={(e) => scheduleSave({ ...config, persona: { ...config.persona, nome_agente: e.target.value } }, 'Editou nome do agente')} /></Labeled>
              <Labeled label="Nome da empresa" htmlFor="v3-empresa"><input id="v3-empresa" className={INPUT} value={config.persona?.empresa ?? ''} onChange={(e) => scheduleSave({ ...config, persona: { ...config.persona, empresa: e.target.value } }, 'Editou empresa')} /></Labeled>
              <Labeled label="Quem assume a conversa" htmlFor="v3-humano" help="O nome que o agente usa ao passar o lead pra uma pessoa."><input id="v3-humano" className={INPUT} value={config.persona?.assinatura_humano ?? ''} onChange={(e) => scheduleSave({ ...config, persona: { ...config.persona, assinatura_humano: e.target.value } }, 'Editou quem assume')} /></Labeled>
            </div>
            <Labeled label="Tom de voz" htmlFor="v3-tom">
              <div className="flex flex-wrap gap-2">
                {TONS_RAPIDOS.map((t) => (
                  <button key={t} type="button" onClick={() => scheduleSave({ ...config, persona: { ...config.persona, tom: t } }, 'Editou tom')} className={cn('rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors', config.persona?.tom === t ? 'border-[#01573C] bg-[#E4F1E9] text-[#01573C] dark:border-[#96F63C]/50 dark:bg-[#12301F] dark:text-[#96F63C]' : 'border-border text-muted-foreground hover:bg-muted')}>{t}</button>
                ))}
              </div>
              <Area id="v3-tom" rows={2} value={config.persona?.tom ?? ''} onChange={(v) => scheduleSave({ ...config, persona: { ...config.persona, tom: v } }, 'Editou tom')} />
            </Labeled>
            <Labeled label="Como responde 'você é um robô?'" htmlFor="v3-robo"><Area id="v3-robo" rows={2} value={config.identidade?.frase_robo ?? ''} onChange={(v) => scheduleSave({ ...config, identidade: { ...config.identidade, frase_robo: v } }, 'Editou frase robô')} /></Labeled>
            <Labeled label="Fora do escopo" htmlFor="v3-fora" help="O que responder quando o assunto não é com a empresa."><Area id="v3-fora" rows={2} value={config.fora_escopo?.frase ?? ''} onChange={(v) => scheduleSave({ ...config, fora_escopo: { frase: v } }, 'Editou fora de escopo')} /></Labeled>
          </section>
        )}

        {/* ── Perguntas ── */}
        {section === 'perguntas' && (
          perguntas.length === 0 ? (
            <div className="flex flex-1 flex-col gap-6">
              <div className="flex flex-col gap-2"><h2 className="text-2xl font-semibold text-foreground">Como você quer montar as perguntas?</h2><p className="text-[15px] text-muted-foreground">Escolha um ponto de partida. Você edita, adiciona e remove pergunta depois, do jeito que quiser.</p></div>
              <div className="grid gap-5 md:grid-cols-3">
                {([
                  { tipo: 'zero' as const, nome: 'Do zero', desc: 'Monta a lista de perguntas você mesmo, sem ponto de partida.', tag: null as string | null },
                  { tipo: 'bant' as const, nome: 'BANT', desc: 'O clássico. Rápido, direto, ótimo pra qualificação de primeiro contato.', tag: 'Orçamento · Decisor · Necessidade · Prazo' },
                  { tipo: 'spiced' as const, nome: 'SPICED', desc: 'Mais fundo. Bom pra negócio de ticket mais alto ou ciclo mais longo.', tag: 'Situação · Dor · Impacto · Evento crítico · Decisão' },
                ]).map((c) => (
                  <div key={c.tipo} className={cn(CARD, 'flex flex-col gap-5 p-7', c.tipo === 'bant' && 'border-[#01573C] dark:border-[#96F63C]/50')}>
                    <div className="flex flex-col gap-1.5"><h3 className="text-lg font-semibold text-foreground">{c.nome}</h3><p className="text-[13.5px] leading-[145%] text-muted-foreground">{c.desc}</p></div>
                    <p className="flex-1 text-[13px] text-muted-foreground">{c.tag ?? ''}</p>
                    <button type="button" onClick={() => void escolherFramework(c.tipo)} className={cn(c.tipo === 'bant' ? PILL_GREEN : PILL3D, 'w-full')}>{c.tipo === 'zero' ? 'Começar do zero' : `Usar ${c.nome}`}</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
                <div className="flex flex-col gap-1 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Roteiro</h3><p className="text-[13px] text-muted-foreground">Nesta ordem</p></div>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                  {perguntas.map((p, i) => <ListRow key={p.id} num={i + 1} active={p.id === selQ} title={p.texto ? (p.texto.slice(0, 28) || p.id) : p.id} sub={p.obrigatoria ? 'Obrigatória' : undefined} onClick={() => setSelQ(p.id)} />)}
                </div>
                <div className="border-t border-border p-4"><button type="button" onClick={() => void adicionarPergunta()} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar pergunta</button></div>
              </aside>
              <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
                {selPergunta ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1.5"><p className="text-sm text-muted-foreground">Pergunta {selPerguntaIdx + 1} de {perguntas.length}</p>
                        <input aria-label="Identificador da pergunta" value={selPergunta.id} onChange={(e) => mutarPergunta({ id: e.target.value })} className="min-w-[120px] max-w-full bg-transparent [field-sizing:content] text-[26px] font-semibold leading-8 tracking-tight text-foreground outline-none" /></div>
                      <RemoveButton label="Remover pergunta" onClick={() => void removerPergunta()} />
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-5 py-4 dark:border-[#2A2A2A] dark:bg-[#161616]">
                      <div className="flex flex-col gap-1"><p className="text-[15px] font-semibold text-foreground">Obrigatória</p><p className="text-[13px] text-muted-foreground">Enquanto essa pergunta não for respondida, o agente não oferece reunião.</p></div>
                      <Toggle on={selPergunta.obrigatoria} onChange={(v) => mutarPergunta({ obrigatoria: v })} label="Obrigatória" />
                    </div>
                    <Labeled label="O que o agente pergunta" htmlFor="v3-texto" help="Use {nome} para o nome do lead."><Area id="v3-texto" rows={3} value={selPergunta.texto} onChange={(v) => mutarPergunta({ texto: v })} /></Labeled>
                    <Labeled label="Campo que guarda a resposta" htmlFor="v3-campo" help="Nome interno usado pelo motor pra saber se essa pergunta já foi respondida."><input id="v3-campo" className={INPUT} value={selPergunta.campo} onChange={(e) => mutarPergunta({ campo: e.target.value })} /></Labeled>
                  </>
                ) : <p className="py-16 text-center text-muted-foreground">Escolha uma pergunta na lista.</p>}
              </section>
            </>
          )
        )}

        {/* ── Preço ── */}
        {section === 'preco' && (
          <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-8')}>
            <div className="flex flex-col gap-1"><h3 className="text-lg font-semibold text-foreground">Preço</h3><p className="text-[13px] text-muted-foreground">Quando e como o agente pode falar de valor.</p></div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-5 py-4 dark:border-[#2A2A2A] dark:bg-[#161616]">
              <div className="flex flex-col gap-1"><p className="text-[15px] font-semibold text-foreground">Pode informar preço</p><p className="text-[13px] text-muted-foreground">Desligado, o agente nunca fala valor, só passa pra pessoa.</p></div>
              <Toggle on={config.preco?.pode_informar ?? false} onChange={(v) => scheduleSave({ ...config, preco: { ...config.preco, pode_informar: v } }, 'Editou pode informar preço')} label="Pode informar preço" />
            </div>
            <Labeled label="Frases pra antes da qualificação estar completa" htmlFor="v3-preco-antes" help="Uma frase por linha. Usada quando pedem preço cedo demais."><Area id="v3-preco-antes" rows={3} value={joinLines(config.preco?.frases_antes_qualificacao)} onChange={(v) => scheduleSave({ ...config, preco: { ...config.preco, frases_antes_qualificacao: splitLines(v) } }, 'Editou frases antes do preço')} /></Labeled>
            <Labeled label="Frase pra depois da qualificação completa" htmlFor="v3-preco-depois"><Area id="v3-preco-depois" rows={2} value={config.preco?.frase_depois_qualificacao ?? ''} onChange={(v) => scheduleSave({ ...config, preco: { ...config.preco, frase_depois_qualificacao: v } }, 'Editou frase depois do preço')} /></Labeled>
            <Labeled label="Escalar pra pessoa depois de quantos pedidos de preço" htmlFor="v3-escalar-apos"><input id="v3-escalar-apos" type="number" min={1} className={cn(INPUT, 'max-w-[140px]')} value={config.preco?.escalar_apos ?? 2} onChange={(e) => scheduleSave({ ...config, preco: { ...config.preco, escalar_apos: Math.max(1, Number(e.target.value) || 1) } }, 'Editou escalar após')} /></Labeled>

            {config.preco?.por_escopo && (
              <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border px-5 py-4">
                <p className="text-[15px] font-semibold text-foreground">Preço por escopo</p>
                <Labeled label="Campo que guarda o escopo" htmlFor="v3-escopo-campo" help="Precisa bater com o campo de alguma pergunta de qualificação.">
                  <select id="v3-escopo-campo" className={INPUT} value={config.preco.por_escopo.campo} onChange={(e) => scheduleSave({ ...config, preco: { ...config.preco, por_escopo: { ...config.preco!.por_escopo!, campo: e.target.value } } }, 'Editou campo do escopo')}>
                    {perguntas.map((p) => <option key={p.campo} value={p.campo}>{p.campo}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Pergunta que descobre o escopo" htmlFor="v3-escopo-pergunta"><Area id="v3-escopo-pergunta" rows={2} value={config.preco.por_escopo.pergunta} onChange={(v) => scheduleSave({ ...config, preco: { ...config.preco, por_escopo: { ...config.preco!.por_escopo!, pergunta: v } } }, 'Editou pergunta do escopo')} /></Labeled>
                <div className="flex flex-col gap-3">
                  {config.preco.por_escopo.opcoes.map((op, i) => (
                    <div key={op.valor || i} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-5 py-4 dark:border-[#2A2A2A] dark:bg-[#141414]">
                      <div className="grid gap-2 md:grid-cols-2">
                        <input className={INPUT} placeholder="valor (id curto)" value={op.valor} onChange={(e) => { const opcoes = [...config.preco!.por_escopo!.opcoes]; opcoes[i] = { ...op, valor: e.target.value }; scheduleSave({ ...config, preco: { ...config.preco, por_escopo: { ...config.preco!.por_escopo!, opcoes } } }, 'Editou opção de escopo'); }} />
                        <input className={INPUT} placeholder="descrição (como o extrator reconhece)" value={op.descricao} onChange={(e) => { const opcoes = [...config.preco!.por_escopo!.opcoes]; opcoes[i] = { ...op, descricao: e.target.value }; scheduleSave({ ...config, preco: { ...config.preco, por_escopo: { ...config.preco!.por_escopo!, opcoes } } }, 'Editou opção de escopo'); }} />
                      </div>
                      <Area rows={2} value={joinLines(op.texto)} onChange={(v) => { const opcoes = [...config.preco!.por_escopo!.opcoes]; opcoes[i] = { ...op, texto: splitLines(v) }; scheduleSave({ ...config, preco: { ...config.preco, por_escopo: { ...config.preco!.por_escopo!, opcoes } } }, 'Editou texto de escopo'); }} />
                      <button type="button" className="w-fit text-[13px] font-semibold text-destructive hover:underline" onClick={() => { const opcoes = config.preco!.por_escopo!.opcoes.filter((_, j) => j !== i); void persist({ ...config, preco: { ...config.preco, por_escopo: { ...config.preco!.por_escopo!, opcoes } } }, 'Removeu opção de escopo'); }}>Remover opção</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => { const opcoes = [...(config.preco?.por_escopo?.opcoes ?? []), { valor: '', descricao: '', texto: [''] }]; void persist({ ...config, preco: { ...config.preco, por_escopo: { ...config.preco!.por_escopo!, opcoes } } }, 'Adicionou opção de escopo'); }} className={cn('flex min-h-[60px] items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground')}><Plus className="h-4 w-4" />Adicionar opção</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Objeções e dúvidas ── */}
        {section === 'objecoes' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
              <div className="flex flex-col gap-1 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Objeções</h3><p className="text-[13px] text-muted-foreground">Por prioridade</p></div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                {objecoes.map((o, i) => <ListRow key={o.id} num={i + 1} active={o.id === selO} title={o.titulo || o.id} sub={o.gatilhos[0]} onClick={() => setSelO(o.id)} />)}
              </div>
              <div className="border-t border-border p-4"><button type="button" onClick={() => void adicionarObjecao()} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar objeção</button></div>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
              {selObjecao ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1.5"><p className="text-sm text-muted-foreground">Objeção {selObjecaoIdx + 1} de {objecoes.length}</p>
                      <input aria-label="Título da objeção" value={selObjecao.titulo} onChange={(e) => mutarObjecao({ titulo: e.target.value })} className="min-w-[120px] max-w-full bg-transparent [field-sizing:content] text-[26px] font-semibold leading-8 tracking-tight text-foreground outline-none" /></div>
                    <RemoveButton label="Remover objeção" onClick={() => void removerObjecao()} />
                  </div>
                  <Labeled label="Gatilhos" htmlFor="v3-obj-gatilhos" help="Exemplos de fala do lead, um por linha."><Area id="v3-obj-gatilhos" rows={3} value={joinLines(selObjecao.gatilhos)} onChange={(v) => mutarObjecao({ gatilhos: splitLines(v) })} /></Labeled>
                  <Labeled label="Resposta" htmlFor="v3-obj-resposta" help="Um bloco por linha."><Area id="v3-obj-resposta" rows={3} value={joinLines(selObjecao.resposta)} onChange={(v) => mutarObjecao({ resposta: splitLines(v) })} /></Labeled>
                  <div className="grid gap-x-5 gap-y-6 md:grid-cols-2">
                    <Labeled label="Modo" htmlFor="v3-obj-modo">
                      <select id="v3-obj-modo" className={INPUT} value={selObjecao.modo} onChange={(e) => mutarObjecao({ modo: e.target.value as 'literal' | 'livre' })}>
                        <option value="literal">Literal (copia exatamente)</option>
                        <option value="livre">Livre (a IA adapta)</option>
                      </select>
                    </Labeled>
                    <Labeled label="Depois de responder" htmlFor="v3-obj-acao">
                      <select id="v3-obj-acao" className={INPUT} value={selObjecao.proxima_acao} onChange={(e) => mutarObjecao({ proxima_acao: e.target.value as ProximaAcaoObjecao })}>
                        {ACOES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </Labeled>
                    <Labeled label="Prioridade" htmlFor="v3-obj-prioridade" help="Quando duas objeções batem, vale a de menor número."><input id="v3-obj-prioridade" type="number" min={1} className={cn(INPUT, 'max-w-[140px]')} value={selObjecao.prioridade} onChange={(e) => mutarObjecao({ prioridade: Math.max(1, Number(e.target.value) || 1) })} /></Labeled>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-5 py-4 dark:border-[#2A2A2A] dark:bg-[#161616]">
                    <div className="flex flex-col gap-1"><p className="text-[15px] font-semibold text-foreground">Conta como recusa</p><p className="text-[13px] text-muted-foreground">Se marcada, essa objeção soma pro limite de recusas que encerra a conversa.</p></div>
                    <Toggle on={selObjecao.conta_como_recusa} onChange={(v) => mutarObjecao({ conta_como_recusa: v })} label="Conta como recusa" />
                  </div>
                </>
              ) : <p className="py-16 text-center text-muted-foreground">Escolha uma objeção na lista, ou adicione uma nova.</p>}
            </section>
          </>
        )}

        {/* ── Encerramentos ── */}
        {section === 'encerramentos' && (
          <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-8')}>
            <div className="flex flex-col gap-1"><h3 className="text-lg font-semibold text-foreground">Encerramentos</h3><p className="text-[13px] text-muted-foreground">Como a conversa termina, e como o agente passa pra uma pessoa.</p></div>
            <Labeled label="Recusas até encerrar" htmlFor="v3-recusas" help="Quantas vezes o lead pode recusar antes do agente parar de insistir."><input id="v3-recusas" type="number" min={1} className={cn(INPUT, 'max-w-[140px]')} value={config.limites?.recusas_para_encerrar ?? 2} onChange={(e) => scheduleSave({ ...config, limites: { ...config.limites, recusas_para_encerrar: Math.max(1, Number(e.target.value) || 1) } }, 'Editou recusas para encerrar')} /></Labeled>
            <Labeled label="Frase pra chamar a pessoa" htmlFor="v3-escala-frase"><Area id="v3-escala-frase" rows={2} value={config.escala?.frase ?? ''} onChange={(v) => scheduleSave({ ...config, escala: { ...config.escala, frase: v } }, 'Editou frase de escalar')} /></Labeled>
            <Labeled label="Frase pra chamar a pessoa (dúvida sem resposta)" htmlFor="v3-escala-duvida"><Area id="v3-escala-duvida" rows={2} value={config.escala?.frase_duvida ?? ''} onChange={(v) => scheduleSave({ ...config, escala: { ...config.escala, frase_duvida: v } }, 'Editou frase de dúvida')} /></Labeled>
            <Labeled label="Nome de quem assume (escalonamento)" htmlFor="v3-escala-nome"><input id="v3-escala-nome" className={INPUT} value={config.escala?.nome_humano ?? ''} onChange={(e) => scheduleSave({ ...config, escala: { ...config.escala, nome_humano: e.target.value } }, 'Editou nome de quem assume')} /></Labeled>
            <Labeled label="Agradecimento final" optional htmlFor="v3-agradecimento"><Area id="v3-agradecimento" rows={2} value={config.agradecimento_fim?.frase ?? ''} onChange={(v) => scheduleSave({ ...config, agradecimento_fim: { frase: v } }, 'Editou agradecimento final')} /></Labeled>
            <Labeled label="Quando o lead repete uma objeção já respondida" optional htmlFor="v3-obj-repetida"><Area id="v3-obj-repetida" rows={2} value={config.objecao_repetida?.frase ?? ''} onChange={(v) => scheduleSave({ ...config, objecao_repetida: { frase: v } }, 'Editou objeção repetida')} /></Labeled>
            <Labeled label="Encerramento depois do limite de recusas" optional htmlFor="v3-encerra-recusas"><Area id="v3-encerra-recusas" rows={2} value={config.encerramento_recusas?.frase ?? ''} onChange={(v) => scheduleSave({ ...config, encerramento_recusas: { frase: v } }, 'Editou encerramento por recusas')} /></Labeled>
          </section>
        )}
      </div>
    </div>
  );
}
