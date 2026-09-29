'use client';

// Tela de Conversa do SDR v3 (motor novo, decisor em código). Diferente do funil v2
// (SdrConversa/FunnelConfig): a config aqui é `CompanyConfig`, versionada em `sdr_company_configs`,
// lida e salva via /api/sdr/v3/config. Mostrada só pra empresa com company.features.sdr_v3 === true.
// Layout replica, peça por peça, o padrão já validado no Paper para SdrConversa.tsx (funil v2):
// mesmo EditorHead, ListRow, Labeled/Area, aside lista + editor principal, card min-h-[640px].
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { askConfirm } from './ConfirmHost';
import { CARD, Chips, INPUT, LIME, PILL3D, PILL_GREEN, Toggle } from './ui';
import { ConversaTestV3, type TestSeedV3 } from './ConversaTestV3';
import type { CompanyConfig, ObjecaoConfig, PerguntaQualificacao, ProximaAcaoObjecao } from '@/lib/sdr/v3/config-types';

type Section = 'agente' | 'perguntas' | 'preco' | 'objecoes' | 'encerramentos';
const ordinal = (n: number) => `${n}ª`;
const ACOES: { value: ProximaAcaoObjecao; label: string }[] = [
  { value: 'aguardar', label: 'Aguardar' },
  { value: 'voltar_qualificacao', label: 'Voltar pra qualificação' },
  { value: 'encerrar', label: 'Encerrar' },
  { value: 'escalar', label: 'Escalar pra pessoa' },
];

// ── peças idênticas ao padrão do SdrConversa.tsx (Paper) ──
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#01573C]/10 px-2.5 py-1 text-xs font-semibold text-[#01573C] dark:bg-[#96F63C]/[0.14] dark:text-[#96F63C]"><span className="h-1.5 w-1.5 rounded-full bg-[#01573C] dark:bg-[#96F63C]" />{children}</span>;
}
function EditorHead({ eyebrow, title, badge, subtitle, actions }: { eyebrow?: string; title: React.ReactNode; badge?: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-3"><h3 className="text-[28px] font-semibold leading-8 tracking-tight text-foreground">{title}</h3>{badge && <Badge>{badge}</Badge>}</div>
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
function Area({ value, onChange, rows = 3, id, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; id?: string; placeholder?: string }) {
  return <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(INPUT, 'resize-y leading-[160%]')} />;
}
const TIPO_LABEL: Record<string, string> = { texto: 'Texto', sim_nao: 'Sim ou não', link_ou_print: 'Link ou print' };
function CampoCard({ label, onLabel, labelPlaceholder, campo, onCampo, tipo, onTipo, descricao, onDescricao, opcional, onOpcional, onRemover }: {
  label: string; onLabel: (v: string) => void; labelPlaceholder?: string;
  campo: string; onCampo: (v: string) => void;
  tipo: 'texto' | 'sim_nao' | 'link_ou_print'; onTipo: (v: 'texto' | 'sim_nao' | 'link_ou_print') => void;
  descricao: string; onDescricao: (v: string) => void;
  opcional?: boolean; onOpcional?: (v: boolean) => void; onRemover?: () => void;
}) {
  return (
    <div className="flex min-w-[220px] flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3.5 dark:border-[#2A2A2A] dark:bg-[#181818]">
      <div className="flex items-center justify-between gap-2">
        <input aria-label="Rótulo" value={label} placeholder={labelPlaceholder} onChange={(e) => onLabel(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold text-foreground outline-none placeholder:text-muted-foreground" />
        <select aria-label="Tipo" value={tipo} onChange={(e) => onTipo(e.target.value as 'texto' | 'sim_nao' | 'link_ou_print')} className="shrink-0 rounded-full bg-[#0F3D2B] px-2.5 py-0.5 text-[12.5px] font-semibold text-[#96F63C] outline-none dark:bg-[#0F3D2B]">
          {(['texto', 'sim_nao', 'link_ou_print'] as const).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
      </div>
      {onOpcional && <label className="flex w-fit items-center gap-1.5 text-[12.5px] text-muted-foreground"><input type="checkbox" checked={!!opcional} onChange={(e) => onOpcional(e.target.checked)} />opcional</label>}
      <input aria-label="Campo (chave interna)" value={campo} onChange={(e) => onCampo(e.target.value)} className="rounded-lg bg-transparent text-[13px] text-muted-foreground outline-none" />
      <textarea aria-label="Descrição" rows={2} value={descricao} onChange={(e) => onDescricao(e.target.value)} placeholder="O que esse dado guarda" className="resize-y bg-transparent text-[13.5px] leading-[145%] text-muted-foreground outline-none placeholder:text-muted-foreground/70" />
      {onRemover && <button type="button" onClick={onRemover} className="w-fit text-[12.5px] font-semibold text-destructive hover:underline">Remover</button>}
    </div>
  );
}
function ListRow({ active, title, sub, num, right, onClick }: { active: boolean; title: string; sub?: string; num?: React.ReactNode; right?: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors', active ? 'bg-[#E4F1E9] dark:bg-[#12301F]' : 'hover:bg-muted')}>
      {num !== undefined && <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold', active ? 'border-[#01573C] bg-[#01573C] text-white dark:border-[#96F63C] dark:bg-transparent dark:text-[#96F63C]' : 'border-border text-foreground')}>{num}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold text-foreground">{title}</span>
        {sub && <span className="truncate text-[13px] text-muted-foreground">{sub}</span>}
      </span>
      {right}
    </button>
  );
}
const joinLines = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join('\n') : v ?? '');
const splitLines = (v: string) => v.split('\n').map((l) => l.trim()).filter(Boolean);
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : ['']);

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
const TOM_PRESETS = [
  { value: 'amigável e próximo', label: 'Amigável', desc: 'Próximo e descontraído, poucos emojis' },
  { value: 'profissional e direto', label: 'Profissional', desc: 'Formal, objetivo, sem emojis' },
  { value: 'empático e acolhedor', label: 'Empático', desc: 'Caloroso, paciente, acolhedor' },
  { value: 'dinâmico e entusiasmado', label: 'Dinâmico', desc: 'Energético, animado, motivador' },
];

export function SdrConversaV3() {
  const [section, setSection] = useState<Section>('agente');
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selQ, setSelQ] = useState<string | null>(null);
  const [selPrice, setSelPrice] = useState<string>('depois');
  const [selO, setSelO] = useState<string | null>(null);
  const [objSearch, setObjSearch] = useState('');
  const [selEnc, setSelEnc] = useState('escala');
  const [seed, setSeed] = useState<TestSeedV3 | null>(null);
  const seedN = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retest = (perguntaId?: string) => { seedN.current += 1; setSeed({ n: seedN.current, perguntaId }); };

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
  const objFiltered = objecoes.filter((o) => !objSearch.trim() || `${o.titulo} ${o.gatilhos.join(' ')}`.toLowerCase().includes(objSearch.trim().toLowerCase()));
  const chips = [
    ['agente', 'Quem é o agente'],
    ['perguntas', `Perguntas ${perguntas.length}`],
    ['preco', 'Preço'],
    ['objecoes', `Objeções e dúvidas ${objecoes.length}`],
    ['encerramentos', 'Encerramentos'],
  ] as const;
  const card = 'flex min-h-[640px] flex-col';
  const agentName = config.persona?.nome_agente || 'Agente';
  const humanName = config.escala?.nome_humano || config.persona?.assinatura_humano || 'uma pessoa da equipe';
  const firstQuestion = perguntas[0]?.texto?.replace(/\{nome\}/gi, '') ?? '';

  // ── perguntas ──
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
  const mutarCampoExtra = (i: number, patch: Partial<NonNullable<PerguntaQualificacao['campos_extra']>[number]>) => {
    const sel = perguntas.find((p) => p.id === selQ); if (!sel) return;
    const campos_extra = (sel.campos_extra ?? []).map((c, k) => (k === i ? { ...c, ...patch } : c));
    mutarPergunta({ campos_extra });
  };
  const adicionarCampoExtra = () => {
    const sel = perguntas.find((p) => p.id === selQ); if (!sel) return;
    let n = (sel.campos_extra?.length ?? 0) + 1;
    while (sel.campos_extra?.some((c) => c.campo === `${sel.campo}_extra_${n}`)) n++;
    const novo = { campo: `${sel.campo}_extra_${n}`, label: 'Novo dado', tipo: 'texto' as const };
    mutarPergunta({ campos_extra: [...(sel.campos_extra ?? []), novo] });
  };
  const removerCampoExtra = (i: number) => {
    const sel = perguntas.find((p) => p.id === selQ); if (!sel) return;
    mutarPergunta({ campos_extra: (sel.campos_extra ?? []).filter((_, k) => k !== i) });
  };
  const removerPergunta = async () => {
    const sel = perguntas.find((p) => p.id === selQ); if (!sel) return;
    if (perguntas.length <= 1) { toast({ title: 'Precisa de pelo menos uma pergunta', variant: 'warning' }); return; }
    if (!(await askConfirm('Remover esta pergunta do roteiro?'))) return;
    const restantes = perguntas.filter((p) => p.id !== sel.id).map((p, i) => ({ ...p, ordem: i + 1 }));
    setSelQ(restantes[Math.max(0, perguntas.findIndex((p) => p.id === sel.id) - 1)]?.id ?? restantes[0]?.id ?? null);
    await persist({ ...config, qualificacao: { perguntas: restantes } }, `Removeu pergunta "${sel.id}"`);
  };
  const adicionarPergunta = async () => {
    let n = perguntas.length + 1; while (perguntas.some((p) => p.id === `pergunta_${n}`)) n++;
    const nova: PerguntaQualificacao = { id: `pergunta_${n}`, campo: `dado_${n}`, texto: '', obrigatoria: false, ordem: perguntas.length + 1 };
    setSelQ(nova.id);
    await persist({ ...config, qualificacao: { perguntas: [...perguntas, nova] } }, 'Adicionou pergunta');
  };

  // ── preço ──
  const frasesAntes = config.preco?.frases_antes_qualificacao ?? [];
  const setPreco = (patch: Partial<CompanyConfig['preco']>) => scheduleSave({ ...config, preco: { ...config.preco, ...patch } }, 'Editou preço');

  // ── objeções ──
  const mutarObjecao = (patch: Partial<ObjecaoConfig>) => {
    const sel = objecoes.find((o) => o.id === selO); if (!sel) return;
    scheduleSave({ ...config, objecoes: objecoes.map((o) => (o.id === sel.id ? { ...o, ...patch } : o)) }, `Editou objeção "${sel.id}"`);
  };
  const removerObjecao = async () => {
    const sel = objecoes.find((o) => o.id === selO); if (!sel) return;
    if (!(await askConfirm('Remover esta objeção?'))) return;
    const restantes = objecoes.filter((o) => o.id !== sel.id);
    setSelO(restantes[0]?.id ?? null);
    await persist({ ...config, objecoes: restantes }, `Removeu objeção "${sel.id}"`);
  };
  const adicionarObjecao = async () => {
    const nome = window.prompt('Nome curto da objeção ou dúvida (ex: prazo, garantia)');
    const id = (nome ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!id) return;
    if (objecoes.some((o) => o.id === id)) { setSelO(id); return; }
    const nova: ObjecaoConfig = { id, titulo: nome!.trim(), gatilhos: [], modo: 'livre', resposta: [''], proxima_acao: 'aguardar', conta_como_recusa: false, prioridade: objecoes.length + 1 };
    setSelO(id);
    await persist({ ...config, objecoes: [...objecoes, nova] }, 'Adicionou objeção');
  };

  // ── encerramentos ──
  const encItems: { id: string; title: string; sub: string; get: () => string; set: (v: string) => void; rows: number }[] = [
    { id: 'escala', title: 'Chamar a pessoa', sub: config.escala?.frase || 'Sem mensagem', get: () => config.escala?.frase ?? '', set: (v) => scheduleSave({ ...config, escala: { ...config.escala, frase: v } }, 'Editou frase de escalar'), rows: 4 },
    { id: 'escala_duvida', title: 'Chamar a pessoa (dúvida sem resposta)', sub: config.escala?.frase_duvida || 'Sem mensagem', get: () => config.escala?.frase_duvida ?? '', set: (v) => scheduleSave({ ...config, escala: { ...config.escala, frase_duvida: v } }, 'Editou frase de dúvida'), rows: 4 },
    { id: 'agradecimento', title: 'Agradecimento final', sub: config.agradecimento_fim?.frase || 'Sem mensagem', get: () => config.agradecimento_fim?.frase ?? '', set: (v) => scheduleSave({ ...config, agradecimento_fim: { frase: v } }, 'Editou agradecimento final'), rows: 3 },
    { id: 'obj_repetida', title: 'Objeção repetida', sub: config.objecao_repetida?.frase || 'Sem mensagem', get: () => config.objecao_repetida?.frase ?? '', set: (v) => scheduleSave({ ...config, objecao_repetida: { frase: v } }, 'Editou objeção repetida'), rows: 3 },
    { id: 'encerra_recusas', title: 'Encerramento por recusas', sub: config.encerramento_recusas?.frase || 'Sem mensagem', get: () => config.encerramento_recusas?.frase ?? '', set: (v) => scheduleSave({ ...config, encerramento_recusas: { frase: v } }, 'Editou encerramento por recusas'), rows: 3 },
  ];
  const selEncItem = encItems.find((e) => e.id === selEnc) ?? encItems[0];

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
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 gap-4 p-6 xl:w-[330px]')}>
              <div className="flex flex-col gap-1"><h3 className="text-lg font-semibold text-foreground">Como o agente aparece</h3><p className="text-[13px] text-muted-foreground">A primeira mensagem que o lead recebe.</p></div>
              <div className="rounded-xl border border-border bg-muted/40 p-4 dark:border-[#1F1F1F] dark:bg-[#0F0F0F]">
                <div className="mb-3 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E4F1E9] text-base font-semibold text-[#01573C] dark:bg-[#12301F] dark:text-[#96F63C]">{agentName.charAt(0).toUpperCase()}</span><span className="flex flex-col"><span className="text-[15px] font-semibold text-foreground">{agentName}</span><span className="text-[13px] text-muted-foreground">{config.persona?.empresa}</span></span></div>
                <p className="whitespace-pre-wrap rounded-xl bg-[#E4F1E9] px-4 py-3 text-[15px] leading-[150%] text-foreground dark:bg-[#12301F]">{firstQuestion || 'A primeira pergunta do roteiro aparece aqui.'}</p>
              </div>
              <p className="text-sm leading-[150%] text-muted-foreground">Essa frase vem da pergunta 1 do roteiro. Para mudar, edite a pergunta.</p>
              <button type="button" onClick={() => { setSection('perguntas'); setSelQ(perguntas[0]?.id ?? null); }} className={cn('w-fit text-sm font-semibold hover:underline', LIME)}>Editar pergunta 1 ›</button>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-8')}>
              <EditorHead title="Quem é o agente" subtitle="Essas informações entram direto no comportamento do agente." />
              <div className="grid gap-x-5 gap-y-6 md:grid-cols-2">
                <Labeled label="Nome do agente" htmlFor="p-nome"><input id="p-nome" className={INPUT} value={config.persona?.nome_agente ?? ''} onChange={(e) => scheduleSave({ ...config, persona: { ...config.persona, nome_agente: e.target.value } }, 'Editou nome do agente')} /></Labeled>
                <Labeled label="Nome da empresa" htmlFor="p-emp"><input id="p-emp" className={INPUT} value={config.persona?.empresa ?? ''} onChange={(e) => scheduleSave({ ...config, persona: { ...config.persona, empresa: e.target.value } }, 'Editou empresa')} /></Labeled>
                <Labeled label="Quem assume a conversa" htmlFor="p-human" help="O nome que o agente usa ao passar o lead para uma pessoa."><input id="p-human" className={INPUT} value={config.persona?.assinatura_humano ?? ''} onChange={(e) => scheduleSave({ ...config, persona: { ...config.persona, assinatura_humano: e.target.value } }, 'Editou quem assume')} /></Labeled>
              </div>
              <Labeled label="Tom de voz">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {TOM_PRESETS.map((t) => (
                    <button key={t.value} type="button" aria-pressed={config.persona?.tom === t.value} onClick={() => scheduleSave({ ...config, persona: { ...config.persona, tom: t.value } }, 'Editou tom')} className={cn('flex flex-col gap-1 rounded-xl border px-4 py-3.5 text-left transition-colors', config.persona?.tom === t.value ? 'border-[#01573C] bg-[#E4F1E9] dark:border-[#96F63C]/50 dark:bg-[#12301F]' : 'border-border hover:bg-muted')}>
                      <span className="text-[15px] font-semibold text-foreground">{t.label}</span><span className="text-[13px] leading-[140%] text-muted-foreground">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </Labeled>
              <Labeled label="O que nunca dizer" optional htmlFor="p-restr"><Area id="p-restr" rows={3} value={joinLines(config.palavras_proibidas)} onChange={(v) => scheduleSave({ ...config, palavras_proibidas: splitLines(v) }, 'Editou palavras proibidas')} placeholder="Ex: não mencione preços sem entender a necessidade do cliente" /></Labeled>
            </section>
          </>
        )}

        {/* ── Perguntas ── */}
        {section === 'perguntas' && (
          perguntas.length === 0 ? (
            <div className="flex flex-1 flex-col gap-6">
              <div className="flex flex-col gap-2"><h2 className="text-2xl font-semibold text-foreground">Como você quer montar as perguntas?</h2><p className="text-[15px] text-muted-foreground">Escolha um ponto de partida. Você edita, adiciona e remove pergunta depois, do jeito que quiser.</p></div>
              <div className="grid gap-5 md:grid-cols-3">
                {([
                  { tipo: 'zero' as const, nome: 'Do zero', desc: 'Monta a lista de perguntas você mesmo, sem ponto de partida.', tag: 'Lista em branco, você adiciona pergunta por pergunta.' },
                  { tipo: 'bant' as const, nome: 'BANT', desc: 'O clássico. Rápido, direto, ótimo pra qualificação de primeiro contato.', tag: 'Orçamento · Decisor · Necessidade · Prazo' },
                  { tipo: 'spiced' as const, nome: 'SPICED', desc: 'Mais fundo. Bom pra negócio de ticket mais alto ou ciclo mais longo.', tag: 'Situação · Dor · Impacto · Evento crítico · Decisão' },
                ]).map((c) => (
                  <div key={c.tipo} className={cn(CARD, 'flex flex-col gap-5 p-7', c.tipo === 'bant' && 'border-[1.5px] border-[#01573C] dark:border-[#96F63C]/50')}>
                    <div className="flex flex-col gap-1.5"><h3 className="text-lg font-semibold text-foreground">{c.nome}</h3><p className="text-[13.5px] leading-[145%] text-muted-foreground">{c.desc}</p></div>
                    <p className="flex-1 text-[13px] text-muted-foreground">{c.tag}</p>
                    <button type="button" onClick={() => void escolherFramework(c.tipo)} className={cn(c.tipo === 'bant' ? PILL_GREEN : PILL3D, 'w-full', c.tipo === 'bant' && 'font-bold')}>{c.tipo === 'zero' ? 'Começar do zero' : `Usar ${c.nome}`}</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
                <div className="flex flex-col gap-1 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Roteiro</h3><p className="text-[13px] text-muted-foreground">Nesta ordem</p></div>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                  {perguntas.map((p, i) => <ListRow key={p.id} num={i + 1} active={p.id === selQ} title={p.texto ? (p.texto.slice(0, 40) || p.id) : p.id} sub={p.obrigatoria ? 'Obrigatória' : undefined} onClick={() => setSelQ(p.id)} />)}
                </div>
                <div className="border-t border-border p-4"><button type="button" onClick={() => void adicionarPergunta()} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar pergunta</button></div>
              </aside>
              <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
                {selPergunta ? (
                  <>
                    <EditorHead
                      eyebrow={`Pergunta ${selPerguntaIdx + 1} de ${perguntas.length}`}
                      title={<input aria-label="Identificador da pergunta" value={selPergunta.id} onChange={(e) => mutarPergunta({ id: e.target.value })} className="min-w-[120px] max-w-full bg-transparent [field-sizing:content] text-[28px] font-semibold leading-8 tracking-tight text-foreground outline-none" />}
                      badge={selPergunta.obrigatoria ? 'Obrigatória' : undefined}
                      actions={<RemoveButton label="Remover pergunta" onClick={() => void removerPergunta()} />}
                    />
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-5 py-4 dark:border-[#2A2A2A] dark:bg-[#161616]">
                      <div className="flex flex-col gap-1"><p className="text-[15px] font-semibold text-foreground">Obrigatória</p><p className="text-[13px] text-muted-foreground">Enquanto essa pergunta não for respondida, o agente não oferece reunião.</p></div>
                      <Toggle on={selPergunta.obrigatoria} onChange={(v) => mutarPergunta({ obrigatoria: v })} label="Obrigatória" />
                    </div>
                    <Labeled label="O que o agente pergunta" htmlFor="v3-texto" help="Use {nome} para o nome do lead."><Area id="v3-texto" rows={3} value={selPergunta.texto} onChange={(v) => mutarPergunta({ texto: v })} /></Labeled>
                    <Labeled label="Se o lead não responder direito" optional htmlFor="v3-reform" help="Usada quando a pergunta precisa ser refeita. Vazio: o agente reformula sozinho."><Area id="v3-reform" rows={2} value={selPergunta.reformulacao ?? ''} onChange={(v) => mutarPergunta({ reformulacao: v || undefined })} /></Labeled>
                    <div className="flex flex-col gap-3">
                      <p className="text-[15px] font-semibold text-foreground">O que o agente guarda no lead</p>
                      <div className="flex flex-wrap gap-3">
                        <CampoCard
                          label={selPergunta.campo_label ?? ''} onLabel={(v) => mutarPergunta({ campo_label: v || undefined })} labelPlaceholder={selPergunta.campo}
                          campo={selPergunta.campo} onCampo={(v) => mutarPergunta({ campo: v })}
                          tipo={selPergunta.campo_tipo ?? 'texto'} onTipo={(v) => mutarPergunta({ campo_tipo: v === 'texto' ? undefined : v })}
                          descricao={selPergunta.campo_descricao ?? ''} onDescricao={(v) => mutarPergunta({ campo_descricao: v || undefined })}
                        />
                        {(selPergunta.campos_extra ?? []).map((c, i) => (
                          <CampoCard key={i}
                            label={c.label} onLabel={(v) => mutarCampoExtra(i, { label: v })}
                            campo={c.campo} onCampo={(v) => mutarCampoExtra(i, { campo: v })}
                            tipo={c.tipo} onTipo={(v) => mutarCampoExtra(i, { tipo: v })}
                            descricao={c.descricao ?? ''} onDescricao={(v) => mutarCampoExtra(i, { descricao: v || undefined })}
                            opcional={!!c.opcional} onOpcional={(v) => mutarCampoExtra(i, { opcional: v || undefined })}
                            onRemover={() => removerCampoExtra(i)}
                          />
                        ))}
                        <button type="button" onClick={() => adicionarCampoExtra()} className="flex min-w-[220px] flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" />Adicionar dado</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border px-4.5 py-4">
                      <p className="text-[15px] font-semibold text-foreground">Depois, se precisar</p>
                      <p className="text-[14.5px] leading-[150%] text-foreground/90">Se não responder, pergunta de novo com outras palavras antes de seguir pro próximo passo.</p>
                    </div>
                    <div><button type="button" onClick={() => retest(selPergunta.id)} className={PILL_GREEN}>Testar a partir desta pergunta</button></div>
                  </>
                ) : <p className="py-16 text-center text-muted-foreground">Escolha uma pergunta na lista.</p>}
              </section>
            </>
          )
        )}

        {/* ── Preço ── */}
        {section === 'preco' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
              <div className="flex flex-col gap-1 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Quando o lead pergunta o preço</h3><p className="text-[13px] leading-[150%] text-muted-foreground">Cada pergunta recebe a resposta da posição seguinte.</p></div>
              <div className="px-6 pb-3"><label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground dark:bg-[#181818]">Pode informar valores<Toggle on={!!config.preco?.pode_informar} onChange={(v) => setPreco({ pode_informar: v })} label="Pode informar valores" /></label></div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                {frasesAntes.map((s, i) => <ListRow key={i} active={selPrice === `antes-${i}`} title={`${ordinal(i + 1)} pergunta de preço`} sub={s} onClick={() => setSelPrice(`antes-${i}`)} />)}
                <ListRow active={selPrice === 'escalar'} title={`${ordinal(frasesAntes.length + 1)} em diante, se insistir`} sub={`Passa para ${humanName}`} onClick={() => setSelPrice('escalar')} />
                <ListRow active={selPrice === 'depois'} title="Depois das perguntas" sub={config.preco?.frase_depois_qualificacao || 'Sem resposta definida'} onClick={() => setSelPrice('depois')} />
                {config.preco?.por_escopo && <ListRow active={selPrice === 'escopo'} title="Preço por escopo" sub={config.preco.por_escopo.pergunta} onClick={() => setSelPrice('escopo')} />}
              </div>
              <div className="border-t border-border p-4"><button type="button" onClick={() => { const next = [...frasesAntes, '']; setSelPrice(`antes-${next.length - 1}`); void persist({ ...config, preco: { ...config.preco, frases_antes_qualificacao: next } }, 'Adicionou resposta de preço'); }} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar resposta</button></div>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
              {selPrice === 'depois' ? (
                <>
                  <EditorHead eyebrow="Preço" title="Depois da qualificação completa" subtitle="Resposta usada quando a qualificação já terminou." />
                  <Labeled label="O que o agente responde" htmlFor="pp"><Area id="pp" rows={5} value={config.preco?.frase_depois_qualificacao ?? ''} onChange={(v) => setPreco({ frase_depois_qualificacao: v })} /></Labeled>
                </>
              ) : selPrice === 'escalar' ? (
                <>
                  <EditorHead eyebrow="Preço" title="Escalar para a pessoa" subtitle={`Quantas vezes o lead pode perguntar o preço antes de passar para ${humanName}.`} />
                  <Labeled label="Vezes que pergunta antes de escalar" htmlFor="pe"><input id="pe" type="number" min={1} className={cn(INPUT, 'max-w-[140px]')} value={config.preco?.escalar_apos ?? 2} onChange={(e) => setPreco({ escalar_apos: Math.max(1, Number(e.target.value) || 1) })} /></Labeled>
                </>
              ) : selPrice === 'escopo' && config.preco?.por_escopo ? (
                <>
                  <EditorHead eyebrow="Preço" title="Preço por escopo" subtitle="O valor sai sempre do texto fixo abaixo, nunca escrito pela IA." />
                  <Labeled label="Campo que guarda o escopo" htmlFor="v3-escopo-campo" help="Precisa bater com o campo de alguma pergunta de qualificação.">
                    <select id="v3-escopo-campo" className={INPUT} value={config.preco.por_escopo.campo} onChange={(e) => setPreco({ por_escopo: { ...config.preco!.por_escopo!, campo: e.target.value } })}>
                      {perguntas.map((p) => <option key={p.campo} value={p.campo}>{p.campo}</option>)}
                    </select>
                  </Labeled>
                  <Labeled label="Pergunta que descobre o escopo" htmlFor="v3-escopo-pergunta"><Area id="v3-escopo-pergunta" rows={2} value={config.preco.por_escopo.pergunta} onChange={(v) => setPreco({ por_escopo: { ...config.preco!.por_escopo!, pergunta: v } })} /></Labeled>
                  <div className="flex flex-col gap-3">
                    {config.preco.por_escopo.opcoes.map((op, i) => (
                      <div key={op.valor || i} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-5 py-4 dark:border-[#2A2A2A] dark:bg-[#141414]">
                        <div className="grid gap-2 md:grid-cols-2">
                          <input className={INPUT} placeholder="valor (id curto)" value={op.valor} onChange={(e) => { const opcoes = [...config.preco!.por_escopo!.opcoes]; opcoes[i] = { ...op, valor: e.target.value }; setPreco({ por_escopo: { ...config.preco!.por_escopo!, opcoes } }); }} />
                          <input className={INPUT} placeholder="descrição (como o extrator reconhece)" value={op.descricao} onChange={(e) => { const opcoes = [...config.preco!.por_escopo!.opcoes]; opcoes[i] = { ...op, descricao: e.target.value }; setPreco({ por_escopo: { ...config.preco!.por_escopo!, opcoes } }); }} />
                        </div>
                        <Area rows={2} value={joinLines(op.texto)} onChange={(v) => { const opcoes = [...config.preco!.por_escopo!.opcoes]; opcoes[i] = { ...op, texto: splitLines(v) }; setPreco({ por_escopo: { ...config.preco!.por_escopo!, opcoes } }); }} />
                        <button type="button" className="w-fit text-[13px] font-semibold text-destructive hover:underline" onClick={() => { const opcoes = config.preco!.por_escopo!.opcoes.filter((_, j) => j !== i); void persist({ ...config, preco: { ...config.preco, por_escopo: { ...config.preco!.por_escopo!, opcoes } } }, 'Removeu opção de escopo'); }}>Remover opção</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => { const opcoes = [...(config.preco?.por_escopo?.opcoes ?? []), { valor: '', descricao: '', texto: [''] }]; void persist({ ...config, preco: { ...config.preco, por_escopo: { ...config.preco!.por_escopo!, opcoes } } }, 'Adicionou opção de escopo'); }} className={cn('flex min-h-[60px] items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground')}><Plus className="h-4 w-4" />Adicionar opção</button>
                  </div>
                </>
              ) : (() => {
                const i = Number(selPrice.replace('antes-', '')) || 0;
                return (
                  <>
                    <EditorHead eyebrow={`Preço, resposta ${i + 1} de ${frasesAntes.length}`} title={`${ordinal(i + 1)} pergunta de preço`}
                      actions={<RemoveButton label="Remover resposta" onClick={() => { const next = frasesAntes.filter((_, k) => k !== i); setSelPrice('depois'); void persist({ ...config, preco: { ...config.preco, frases_antes_qualificacao: next } }, 'Removeu resposta de preço'); }} />} />
                    <Labeled label="O que o agente responde" htmlFor="pr" help="As quebras de linha são mantidas na mensagem."><Area id="pr" rows={8} value={frasesAntes[i] ?? ''} onChange={(v) => { const next = [...frasesAntes]; next[i] = v; setPreco({ frases_antes_qualificacao: next }); }} /></Labeled>
                    <div className="flex flex-col gap-3">
                      <p className="text-[15px] font-semibold text-foreground">Como o agente escolhe a resposta</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        {[...frasesAntes.map((_, k) => ({ when: `${ordinal(k + 1)} vez${k === 0 ? ' que pergunta' : ''}`, what: `Resposta ${k + 1}${k === i ? ' (esta)' : ''}`, on: k === i })), { when: `${ordinal(frasesAntes.length + 1)} vez em diante`, what: `Passa para ${humanName}`, on: false }].slice(0, 4).map((c, k) => (
                          <div key={k} className={cn('flex flex-col gap-1 rounded-xl border px-5 py-4', c.on ? 'border-[#01573C]/30 bg-[#E4F1E9] dark:border-transparent dark:bg-[#12301F]' : 'border-border')}><span className="text-[13px] text-muted-foreground">{c.when}</span><span className="text-[15px] font-semibold text-foreground">{c.what}</span></div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>
          </>
        )}

        {/* ── Objeções e dúvidas ── */}
        {section === 'objecoes' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
              <div className="flex flex-col gap-3 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Objeções e dúvidas</h3>
                <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-muted px-3.5 dark:border-[#2A2A2A] dark:bg-[#181818]"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label="Buscar" placeholder="Buscar" value={objSearch} onChange={(e) => setObjSearch(e.target.value)} className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" /></div></div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                {objFiltered.map((o) => <ListRow key={o.id} active={o.id === selO} title={o.titulo || o.id} sub={o.gatilhos[0]} onClick={() => setSelO(o.id)} />)}
              </div>
              <div className="border-t border-border p-4"><button type="button" onClick={() => void adicionarObjecao()} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar objeção ou dúvida</button></div>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
              {selObjecao ? (
                <>
                  <EditorHead eyebrow={`Objeção ${selObjecaoIdx + 1} de ${objecoes.length}`}
                    title={<input aria-label="Título da objeção" value={selObjecao.titulo} onChange={(e) => mutarObjecao({ titulo: e.target.value })} className="min-w-[120px] max-w-full bg-transparent [field-sizing:content] text-[28px] font-semibold leading-8 tracking-tight text-foreground outline-none" />}
                    actions={<RemoveButton label="Remover" onClick={() => void removerObjecao()} />} />
                  <Labeled label="Modo" help="Literal copia exatamente. Livre deixa a IA adaptar o texto.">
                    <div className="flex w-fit items-center gap-0.5 rounded-full bg-muted p-1 dark:bg-[#141414]">{([['literal', 'Literal'], ['livre', 'Livre']] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={selObjecao.modo === v} onClick={() => mutarObjecao({ modo: v })} className={cn('rounded-full px-5 py-2 text-sm transition-colors', selObjecao.modo === v ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}>{l}</button>)}</div>
                  </Labeled>
                  <Labeled label="Como o lead costuma dizer isso" htmlFor="o-t"><Area id="o-t" rows={2} value={joinLines(selObjecao.gatilhos)} onChange={(v) => mutarObjecao({ gatilhos: splitLines(v) })} /></Labeled>
                  {arr(selObjecao.resposta).map((sc, i) => (
                    <Labeled key={i} label={`Resposta ${i + 1}`} htmlFor={`o-s${i}`}>
                      <Area id={`o-s${i}`} rows={3} value={sc} onChange={(v) => { const list = [...arr(selObjecao.resposta)]; list[i] = v; mutarObjecao({ resposta: list }); }} />
                      <div className="flex items-center justify-between"><span className="text-[13px] text-muted-foreground">{i === 0 ? 'usada uma vez por conversa' : 'usada quando o lead repete'}</span>{arr(selObjecao.resposta).length > 1 && <button type="button" className="text-[13px] font-semibold text-destructive hover:underline" onClick={() => { const list = arr(selObjecao.resposta).filter((_, k) => k !== i); mutarObjecao({ resposta: list }); }}>Remover resposta</button>}</div>
                    </Labeled>
                  ))}
                  <button type="button" onClick={() => mutarObjecao({ resposta: [...arr(selObjecao.resposta), ''] })} className={cn('flex w-fit items-center gap-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar outra resposta</button>
                  <div className="grid gap-x-5 gap-y-6 md:grid-cols-2">
                    <Labeled label="Depois de responder" htmlFor="v3-obj-acao">
                      <select id="v3-obj-acao" className={INPUT} value={selObjecao.proxima_acao} onChange={(e) => mutarObjecao({ proxima_acao: e.target.value as ProximaAcaoObjecao })}>
                        {ACOES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </Labeled>
                    <Labeled label="Prioridade" htmlFor="v3-obj-prioridade" help="Quando duas objeções batem, vale a de menor número."><input id="v3-obj-prioridade" type="number" min={1} className={cn(INPUT, 'max-w-[140px]')} value={selObjecao.prioridade} onChange={(e) => mutarObjecao({ prioridade: Math.max(1, Number(e.target.value) || 1) })} /></Labeled>
                  </div>
                  <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-6 py-5 dark:border-[#2A2A2A] dark:bg-[#141414]">
                    <div className="flex items-center justify-between gap-4"><p className="text-base font-semibold text-foreground">Conta como recusa</p><Toggle on={selObjecao.conta_como_recusa} onChange={(v) => mutarObjecao({ conta_como_recusa: v })} label="Conta como recusa" /></div>
                    <p className="text-sm leading-[150%] text-muted-foreground">Se marcada, essa objeção soma para o limite de recusas que encerra a conversa.</p>
                  </div>
                </>
              ) : <p className="py-16 text-center text-muted-foreground">Escolha uma objeção ou dúvida na lista.</p>}
            </section>
          </>
        )}

        {/* ── Encerramentos ── */}
        {section === 'encerramentos' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
              <div className="flex flex-col gap-1 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Encerramentos</h3><p className="text-[13px] leading-[150%] text-muted-foreground">O que o agente diz quando a conversa sai do roteiro.</p></div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                <p className="px-3.5 pb-1 pt-3 text-[13px] font-semibold text-muted-foreground">Mensagens</p>
                {config.ligacao && <ListRow active={selEnc === 'ligacao'} title="Lead pede ligação" sub={config.ligacao.oferta} onClick={() => setSelEnc('ligacao')} />}
                {encItems.map((it) => <ListRow key={it.id} active={selEnc === it.id} title={it.title} sub={it.sub} onClick={() => setSelEnc(it.id)} />)}
                <p className="px-3.5 pb-1 pt-4 text-[13px] font-semibold text-muted-foreground">Ajustes</p>
                <ListRow active={selEnc === 'recusas'} title="Recusas até encerrar" onClick={() => setSelEnc('recusas')} right={<span className="text-sm font-semibold text-muted-foreground">{config.limites?.recusas_para_encerrar ?? 2}</span>} />
              </div>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
              {selEnc === 'recusas' ? (
                <>
                  <EditorHead eyebrow="Ajuste" title="Recusas até encerrar" subtitle="Quantas vezes o lead pode recusar antes do agente parar de insistir." />
                  <Labeled label="Recusas" htmlFor="v3-recusas"><input id="v3-recusas" type="number" min={1} className={cn(INPUT, 'max-w-[140px]')} value={config.limites?.recusas_para_encerrar ?? 2} onChange={(e) => scheduleSave({ ...config, limites: { ...config.limites, recusas_para_encerrar: Math.max(1, Number(e.target.value) || 1) } }, 'Editou recusas para encerrar')} /></Labeled>
                </>
              ) : selEnc === 'ligacao' && config.ligacao ? (
                <>
                  <EditorHead eyebrow="Encerramento" title="Lead pede ligação" subtitle="Quando o lead pede para falar por telefone." />
                  <Labeled label="Oferta" optional htmlFor="v3-lig-oferta"><Area id="v3-lig-oferta" rows={3} value={config.ligacao.oferta} onChange={(v) => scheduleSave({ ...config, ligacao: { ...config.ligacao!, oferta: v } }, 'Editou oferta de ligação')} /></Labeled>
                  <Labeled label="Confirmação quando o lead aceita" optional htmlFor="v3-lig-conf"><Area id="v3-lig-conf" rows={2} value={config.ligacao.confirmacao} onChange={(v) => scheduleSave({ ...config, ligacao: { ...config.ligacao!, confirmacao: v } }, 'Editou confirmação de ligação')} /></Labeled>
                  <Labeled label="Se já tem reunião marcada e pede ligação" optional htmlFor="v3-lig-reuniao"><Area id="v3-lig-reuniao" rows={2} value={config.ligacao.reuniao_e_ligacao ?? ''} onChange={(v) => scheduleSave({ ...config, ligacao: { ...config.ligacao!, reuniao_e_ligacao: v } }, 'Editou reunião e ligação')} /></Labeled>
                  <div className="flex flex-col gap-3"><p className="text-[15px] font-semibold text-foreground">Como acontece</p>
                    <div className="grid gap-3 md:grid-cols-3">{[['1. Lead pede ligação', 'Agente envia a oferta'], ['2. Lead aceita', 'Agente envia a confirmação'], ['3. Depois', `Passa para ${humanName}`]].map(([a, b]) => <div key={a} className="flex flex-col gap-1 rounded-xl border border-border px-5 py-4"><span className="text-[13px] text-muted-foreground">{a}</span><span className="text-[15px] font-semibold text-foreground">{b}</span></div>)}</div>
                  </div>
                </>
              ) : (
                <>
                  <EditorHead eyebrow="Encerramento" title={selEncItem.title} />
                  <Labeled label="Mensagem" optional htmlFor="v3-enc"><Area id="v3-enc" rows={selEncItem.rows} value={selEncItem.get()} onChange={selEncItem.set} /></Labeled>
                </>
              )}
            </section>
          </>
        )}

        <ConversaTestV3 config={config} agentName={agentName} seed={seed} />
      </div>
    </div>
  );
}
