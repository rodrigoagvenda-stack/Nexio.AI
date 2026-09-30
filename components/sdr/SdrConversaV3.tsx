'use client';

// Tela de Conversa do SDR v3 (motor novo, decisor em código). A config é `CompanyConfig`, versionada em
// `sdr_company_configs`, lida e publicada via /api/sdr/v3/config. Mostrada só pra empresa com sdr_v3.
// As edições ficam em rascunho até "Publicar" (banner "alterações não publicadas" do Paper), então nenhuma
// edição cria versão nova sozinha.
// ATENÇÃO Tailwind 3.4: escala fracionada (h-7.5, pt-4.5, px-5.5, py-0.75...) NÃO existe e é ignorada.
// Toda medida que o Paper pede fora da escala padrão vai em px explícito ([30px], [18px]...).
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { askConfirm } from './ConfirmHost';
import { CARD, INPUT, LIME } from './ui';
import { ConversaTestV3, type TestSeedV3 } from './ConversaTestV3';
import type { CompanyConfig, ObjecaoConfig, PerguntaQualificacao, ProximaAcaoObjecao } from '@/lib/sdr/v3/config-types';

type Section = 'agente' | 'perguntas' | 'preco' | 'objecoes' | 'encerramentos';
type CampoTipo = 'texto' | 'sim_nao' | 'link_ou_print';
const ordinal = (n: number) => `${n}ª`;
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ACOES: { value: ProximaAcaoObjecao; label: string }[] = [
  { value: 'aguardar', label: 'Aguardar' },
  { value: 'voltar_qualificacao', label: 'Voltar pra qualificação' },
  { value: 'encerrar', label: 'Encerrar' },
  { value: 'escalar', label: 'Escalar pra pessoa' },
];

const humanize = (id: string) => (id.trim() ? id.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase()) : id);
const slugify = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const joinLines = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join('\n') : v ?? '');
const splitLines = (v: string) => v.split('\n').map((l) => l.trim()).filter(Boolean);
const arr = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : ['']);
const tituloDe = (p: PerguntaQualificacao) => p.titulo || humanize(p.id);

/** Lista do que mudou entre a versão publicada e o rascunho (uma linha por item, como o banner conta). */
function diffConfig(a: CompanyConfig, b: CompanyConfig): string[] {
  const out: string[] = [];
  if (!same(a.persona, b.persona)) out.push('Quem é o agente');
  if (!same(a.palavras_proibidas, b.palavras_proibidas)) out.push('O que nunca dizer');
  const pa = new Map(a.qualificacao.perguntas.map((p) => [p.id, p]));
  const pb = new Map(b.qualificacao.perguntas.map((p) => [p.id, p]));
  for (const p of b.qualificacao.perguntas) {
    const o = pa.get(p.id);
    if (!o) out.push(`Pergunta nova: ${tituloDe(p)}`);
    else if (!same(o, p)) out.push(`Pergunta: ${tituloDe(p)}`);
  }
  for (const p of a.qualificacao.perguntas) if (!pb.has(p.id)) out.push(`Pergunta removida: ${tituloDe(p)}`);
  if (!same(a.preco, b.preco)) out.push('Preço');
  const oa = new Map(a.objecoes.map((o) => [o.id, o]));
  const ob = new Map(b.objecoes.map((o) => [o.id, o]));
  for (const o of b.objecoes) {
    const x = oa.get(o.id);
    if (!x) out.push(`Objeção nova: ${o.titulo || o.id}`);
    else if (!same(x, o)) out.push(`Objeção: ${o.titulo || o.id}`);
  }
  for (const o of a.objecoes) if (!ob.has(o.id)) out.push(`Objeção removida: ${o.titulo || o.id}`);
  if (!same([a.escala, a.agradecimento_fim, a.objecao_repetida, a.encerramento_recusas, a.ligacao, a.limites], [b.escala, b.agradecimento_fim, b.objecao_repetida, b.encerramento_recusas, b.ligacao, b.limites])) out.push('Encerramentos');
  return out;
}

// ── ícones exatos do Paper ──
const TrashIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;
const FlagIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0"><path d="M5 21V4M5 4h11l-2 4 2 4H5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const ChevronRightIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

// ── peças do Paper (valores exatos do JSX) ──
function PaperToggle({ on, onChange, label, static: isStatic }: { on: boolean; onChange?: (v: boolean) => void; label: string; static?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} tabIndex={isStatic ? -1 : 0} onClick={() => { if (!isStatic) onChange?.(!on); }} className={cn('flex h-[22px] w-10 shrink-0 items-center rounded-full px-[3px]', on ? 'justify-end bg-[#01573C]' : 'justify-start bg-muted-foreground/30 dark:bg-[#2A2A2A]', isStatic && 'cursor-default')}>
      <span className="size-4 rounded-full bg-white" />
    </button>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5 rounded-full bg-[#F5B544]/[0.14] px-2.5 py-[3px] text-[12.5px] font-semibold leading-4 text-[#8A5A00] dark:text-[#F5B544]"><span className="size-1.5 shrink-0 rounded-full bg-[#F5B544]" />{children}</span>;
}
function EditorHead({ eyebrow, title, badges, subtitle, actions }: { eyebrow?: string; title: React.ReactNode; badges?: React.ReactNode; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <span className="text-[13.5px] leading-[18px] text-muted-foreground">{eyebrow}</span>}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-foreground">{title}</span>
          {badges}
        </div>
        {subtitle && <span className="text-sm leading-[18px] text-muted-foreground">{subtitle}</span>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-2 text-sm font-semibold leading-[18px] text-[#DC2626] hover:underline dark:text-[#F87171]"><TrashIcon />{label}</button>;
}
function Labeled({ label, optional, help, children, htmlFor }: { label: string; optional?: boolean; help?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[15px] font-semibold leading-[18px] text-foreground">{label}{optional && <span className="text-[13px] font-normal leading-4 text-muted-foreground dark:text-[#7A7A7A]">opcional</span>}</label>
      {children}
      {help && <span className="text-[13px] leading-4 text-muted-foreground dark:text-[#7A7A7A]">{help}</span>}
    </div>
  );
}
function Area({ value, onChange, rows = 3, id, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; id?: string; placeholder?: string }) {
  return <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(INPUT, 'resize-y leading-[160%]')} />;
}
/** Caixa de texto larga do Paper (16px, 155%, padding 16/18). `edited` acende a borda âmbar de "editado". */
function PaperArea({ value, onChange, id, edited, placeholder }: { value: string; onChange: (v: string) => void; id?: string; edited?: boolean; placeholder?: string }) {
  return (
    <textarea id={id} rows={1} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      className={cn('w-full resize-none rounded-xl border bg-muted px-[18px] py-4 text-[16px] leading-[155%] text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground dark:bg-[#181818]', edited ? 'border-[#F5B544]' : 'border-border dark:border-[#2A2A2A]')} />
  );
}
const TIPO_LABEL: Record<CampoTipo, string> = { texto: 'Texto curto', sim_nao: 'Sim ou não', link_ou_print: 'Link ou print' };
function CampoCard({ label, onLabel, labelPlaceholder, tipo, onTipo, descricao, onDescricao, opcional }: {
  label: string; onLabel: (v: string) => void; labelPlaceholder?: string;
  tipo: CampoTipo; onTipo: (v: CampoTipo) => void;
  descricao: string; onDescricao: (v: string) => void;
  opcional?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3.5 dark:border-[#2A2A2A] dark:bg-[#181818]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <input aria-label="Rótulo" value={label} placeholder={labelPlaceholder} onChange={(e) => onLabel(e.target.value)} className="min-w-0 bg-transparent text-[14.5px] font-semibold leading-[18px] text-foreground outline-none placeholder:text-muted-foreground" />
          {opcional && <span className="shrink-0 text-[12.5px] leading-4 text-muted-foreground dark:text-[#7A7A7A]">opcional</span>}
        </div>
        <select aria-label="Tipo" value={tipo} onChange={(e) => onTipo(e.target.value as CampoTipo)} className="shrink-0 cursor-pointer appearance-none rounded-full bg-[#0F3D2B] px-2.5 py-[3px] text-[12.5px] font-semibold leading-4 text-[#96F63C] outline-none">
          {(['texto', 'sim_nao', 'link_ou_print'] as const).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
      </div>
      <textarea aria-label="Descrição" rows={1} value={descricao} onChange={(e) => onDescricao(e.target.value)} placeholder="O que esse dado guarda" className="resize-none bg-transparent text-[13.5px] leading-[145%] text-muted-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/70" />
    </div>
  );
}
function PerguntaRow({ num, active, obrigatoria, title, sub, onClick }: { num: number; active: boolean; obrigatoria: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined} className={cn('flex gap-3.5 text-left', active ? '-mx-0.5 rounded-xl bg-[#E4F1E9] p-2.5 dark:bg-[#12301F]' : 'px-2.5')}>
      <span className="flex shrink-0 flex-col items-center">
        <span className={cn('flex size-[30px] shrink-0 items-center justify-center rounded-full text-[13.5px] font-semibold leading-[18px]', active ? 'bg-[#01573C] text-white' : 'bg-muted text-foreground dark:bg-[#1A1A1A] dark:text-[#FAFAFA]')}>{num}</span>
        {!active && <span className="min-h-3.5 w-0.5 grow basis-0 bg-border dark:bg-[#262626]" />}
      </span>
      <span className={cn('flex min-w-0 flex-col gap-0.5', active ? 'grow basis-0' : 'pb-4')}>
        <span className="flex items-center gap-2">
          <span className={cn('text-[14.5px] font-semibold leading-[18px]', active ? 'text-[#01573C] dark:text-white' : 'text-foreground')}>{title}</span>
          {obrigatoria && <span className="size-[7px] shrink-0 rounded-full bg-[#F5B544]" />}
        </span>
        {sub && <span className={cn('text-[13px] leading-4', active ? 'text-[#01573C]/80 dark:text-[#A9C9B7]' : 'text-muted-foreground')}>{sub}</span>}
      </span>
    </button>
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

const TOM_PRESETS = [
  { value: 'amigável e próximo', label: 'Amigável', desc: 'Próximo e descontraído, poucos emojis' },
  { value: 'profissional e direto', label: 'Profissional', desc: 'Formal, objetivo, sem emojis' },
  { value: 'empático e acolhedor', label: 'Empático', desc: 'Caloroso, paciente, acolhedor' },
  { value: 'dinâmico e entusiasmado', label: 'Dinâmico', desc: 'Energético, animado, motivador' },
];

type Modelo = Omit<PerguntaQualificacao, 'ordem'>;
const BANT: Modelo[] = [
  { id: 'orcamento', titulo: 'Orçamento', campo: 'orcamento', texto: 'Você já separou um valor pra investir nisso, ou ainda não pensou?', obrigatoria: false },
  {
    id: 'decisor', titulo: 'Decisor', campo: 'decisor', texto: 'Você é quem decide sobre esse investimento, ou tem mais alguém envolvido?', obrigatoria: true,
    reformulacao: 'Você é quem decide sobre isso na empresa?',
    campo_label: 'Nome do decisor', campo_tipo: 'sim_nao', campo_descricao: 'O nome de quem decide, se for diferente de quem está respondendo.',
    campos_extra: [{ campo: 'link_do_perfil', label: 'Link do perfil', tipo: 'link_ou_print', descricao: 'O link do perfil, ou "print enviado" se o lead mandou uma imagem.', opcional: true }],
  },
  { id: 'necessidade', titulo: 'Necessidade', campo: 'necessidade', texto: 'O que pesa mais hoje: não aparecer no Google, não ter site, ou outra coisa?', obrigatoria: false },
  { id: 'prazo', titulo: 'Prazo', campo: 'prazo', texto: 'Isso é algo que quer resolver logo, ou é mais pra frente?', obrigatoria: false },
];
const SPICED: Modelo[] = [
  { id: 'situacao', titulo: 'Situação', campo: 'situacao', texto: 'Me conta rapidinho como funciona hoje: time, ferramentas, como cuida disso agora.', obrigatoria: false },
  {
    id: 'dor', titulo: 'Dor', campo: 'dor', texto: 'O que mais incomoda nisso hoje?', obrigatoria: true,
    reformulacao: 'O que tá pesando mais nisso pra você?',
    campo_label: 'Dor principal', campo_descricao: 'Resumo curto do que o lead disse ser o maior problema.',
    campos_extra: [{ campo: 'categoria_da_dor', label: 'Categoria da dor', tipo: 'texto', descricao: 'Rótulo curto pra agrupar (ex: “não aparece no Google”, “sem site”, “sem tempo”).', opcional: true }],
  },
  { id: 'impacto', titulo: 'Impacto', campo: 'impacto', texto: 'Isso custa quanto, em tempo ou dinheiro, se continuar assim?', obrigatoria: false },
  { id: 'evento_critico', titulo: 'Evento crítico', campo: 'evento_critico', texto: 'Tem algum prazo ou situação que torna isso urgente agora?', obrigatoria: false },
  { id: 'decisao', titulo: 'Decisão', campo: 'decisao', texto: 'Como funciona a decisão aí, é só você ou tem mais gente envolvida?', obrigatoria: true },
];

export function SdrConversaV3() {
  const [section, setSection] = useState<Section>('perguntas');
  const [saved, setSaved] = useState<CompanyConfig | null>(null);
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [selQ, setSelQ] = useState<string | null>(null);
  const [selPrice, setSelPrice] = useState<string>('depois');
  const [selO, setSelO] = useState<string | null>(null);
  const [objSearch, setObjSearch] = useState('');
  const [selEnc, setSelEnc] = useState('escala');
  const [seed, setSeed] = useState<TestSeedV3 | null>(null);
  const seedN = useRef(0);
  const retest = (perguntaId?: string) => { seedN.current += 1; setSeed({ n: seedN.current, perguntaId }); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sdr/v3/config');
      const json = await res.json();
      const ativa = json?.data?.ativa?.config as CompanyConfig | undefined;
      setSaved(ativa ? clone(ativa) : null);
      setConfig(ativa ? clone(ativa) : null);
      if (ativa?.qualificacao?.perguntas?.length) setSelQ([...ativa.qualificacao.perguntas].sort((a, b) => a.ordem - b.ordem)[0].id);
      if (ativa?.objecoes?.length) setSelO(ativa.objecoes[0].id);
    } catch {
      toast({ title: 'Não foi possível carregar a configuração do SDR', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const changes = useMemo(() => (saved && config ? diffConfig(saved, config) : []), [saved, config]);
  const dirty = changes.length > 0;

  // Toda edição é rascunho: só "Publicar" grava uma versão nova.
  const scheduleSave = (next: CompanyConfig, _nota?: string) => { void _nota; setConfig(next); };
  const persist = async (next: CompanyConfig, _nota?: string) => { void _nota; setConfig(next); return true; };

  async function publicar() {
    if (!config) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/sdr/v3/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, nota: `Publicou ${changes.length} ${changes.length === 1 ? 'alteração' : 'alterações'}` }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.message || json.errors?.[0] || 'Não foi possível publicar');
      setSaved(clone(config));
      toast({ title: 'Alterações publicadas', description: 'O agente já atende com a versão nova.', variant: 'success' });
      const avisos: string[] = Array.isArray(json.avisos) ? json.avisos : [];
      if (avisos.length) toast({ title: 'Pontos que deixam o agente com cara de robô', description: avisos.slice(0, 3).join(' '), variant: 'warning' });
    } catch (e) {
      toast({ title: 'Não foi possível publicar', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  }
  async function descartar() {
    if (!saved) return;
    if (!(await askConfirm('Descartar todas as alterações não publicadas?'))) return;
    const base = clone(saved);
    setConfig(base);
    setSelQ((cur) => (base.qualificacao.perguntas.some((p) => p.id === cur) ? cur : [...base.qualificacao.perguntas].sort((a, b) => a.ordem - b.ordem)[0]?.id ?? null));
    setSelO((cur) => (base.objecoes.some((o) => o.id === cur) ? cur : base.objecoes[0]?.id ?? null));
    retest();
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!config || !saved) return <div className={cn(CARD, 'px-8 py-8 text-center text-muted-foreground')}>Não achei a configuração do SDR v3 pra essa empresa.</div>;

  const perguntas = [...(config.qualificacao?.perguntas ?? [])].sort((a, b) => a.ordem - b.ordem);
  const objecoes = [...(config.objecoes ?? [])].sort((a, b) => a.prioridade - b.prioridade);
  const objFiltered = objecoes.filter((o) => !objSearch.trim() || `${o.titulo} ${o.gatilhos.join(' ')}`.toLowerCase().includes(objSearch.trim().toLowerCase()));
  const chips = [
    ['agente', 'Quem é o agente'],
    ['perguntas', perguntas.length > 0 ? `Perguntas ${perguntas.length}` : 'Perguntas'],
    ['preco', 'Preço'],
    ['objecoes', `Objeções e dúvidas ${objecoes.length}`],
    ['encerramentos', 'Encerramentos'],
  ] as const;
  const card = 'flex min-h-[640px] flex-col';
  const agentName = config.persona?.nome_agente || 'Agente';
  const humanName = config.escala?.nome_humano || config.persona?.assinatura_humano || 'uma pessoa da equipe';
  const firstQuestion = perguntas[0]?.texto?.replace(/\{nome\}/gi, '') ?? '';
  const savedPergunta = (id: string) => saved.qualificacao.perguntas.find((p) => p.id === id);

  // ── perguntas ──
  const escolherFramework = async (tipo: 'zero' | 'bant' | 'spiced') => {
    const nomeTexto = `Olá, tudo bem? Sou a ${agentName}, atendente do ${config.persona?.empresa || 'nosso time'}. Qual o seu nome?`;
    const base: Modelo[] = tipo === 'bant' ? BANT : tipo === 'spiced' ? SPICED : [];
    const novas: PerguntaQualificacao[] = [{ id: 'nome', titulo: 'Nome', campo: 'nome', texto: nomeTexto, obrigatoria: false, ordem: 1 }, ...base.map((p, i) => ({ ...clone(p), ordem: i + 2 }))];
    setConfig({ ...config, qualificacao: { perguntas: novas } });
    setSelQ(tipo === 'zero' ? null : (novas.find((p) => p.obrigatoria) ?? novas[0])?.id ?? null);
    retest(novas[0].id);
  };
  const mutarPergunta = (patch: Partial<PerguntaQualificacao>) => {
    const sel = perguntas.find((p) => p.id === selQ); if (!sel) return;
    scheduleSave({ ...config, qualificacao: { perguntas: perguntas.map((p) => (p.id === sel.id ? { ...p, ...patch } : p)) } });
  };
  const mutarCampoExtra = (i: number, patch: Partial<NonNullable<PerguntaQualificacao['campos_extra']>[number]>) => {
    const sel = perguntas.find((p) => p.id === selQ); if (!sel) return;
    mutarPergunta({ campos_extra: (sel.campos_extra ?? []).map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  };
  const removerPergunta = async () => {
    const sel = perguntas.find((p) => p.id === selQ); if (!sel) return;
    if (perguntas.length <= 1) { toast({ title: 'Precisa de pelo menos uma pergunta', variant: 'warning' }); return; }
    if (!(await askConfirm('Remover esta pergunta do roteiro?'))) return;
    const restantes = perguntas.filter((p) => p.id !== sel.id).map((p, i) => ({ ...p, ordem: i + 1 }));
    setSelQ(restantes[Math.max(0, perguntas.findIndex((p) => p.id === sel.id) - 1)]?.id ?? restantes[0]?.id ?? null);
    await persist({ ...config, qualificacao: { perguntas: restantes } });
  };
  const adicionarPergunta = async () => {
    let n = perguntas.length + 1; while (perguntas.some((p) => p.id === `pergunta_${n}`)) n++;
    const nova: PerguntaQualificacao = { id: `pergunta_${n}`, titulo: `Pergunta ${perguntas.length + 1}`, campo: `dado_${n}`, texto: '', obrigatoria: false, ordem: perguntas.length + 1 };
    setSelQ(nova.id);
    await persist({ ...config, qualificacao: { perguntas: [...perguntas, nova] } });
  };

  // ── preço ──
  const frasesAntes = config.preco?.frases_antes_qualificacao ?? [];
  const setPreco = (patch: Partial<CompanyConfig['preco']>) => scheduleSave({ ...config, preco: { ...config.preco, ...patch } });

  // ── objeções ──
  const mutarObjecao = (patch: Partial<ObjecaoConfig>) => {
    const sel = objecoes.find((o) => o.id === selO); if (!sel) return;
    scheduleSave({ ...config, objecoes: objecoes.map((o) => (o.id === sel.id ? { ...o, ...patch } : o)) });
  };
  const removerObjecao = async () => {
    const sel = objecoes.find((o) => o.id === selO); if (!sel) return;
    if (!(await askConfirm('Remover esta objeção?'))) return;
    const restantes = objecoes.filter((o) => o.id !== sel.id);
    setSelO(restantes[0]?.id ?? null);
    await persist({ ...config, objecoes: restantes });
  };
  const adicionarObjecao = async () => {
    const nome = window.prompt('Nome curto da objeção ou dúvida (ex: prazo, garantia)');
    const id = slugify(nome ?? '');
    if (!id) return;
    if (objecoes.some((o) => o.id === id)) { setSelO(id); return; }
    const nova: ObjecaoConfig = { id, titulo: nome!.trim(), gatilhos: [], modo: 'livre', resposta: [''], proxima_acao: 'aguardar', conta_como_recusa: false, prioridade: objecoes.length + 1 };
    setSelO(id);
    await persist({ ...config, objecoes: [...objecoes, nova] });
  };

  // ── encerramentos ──
  const encItems: { id: string; title: string; sub: string; get: () => string; set: (v: string) => void; rows: number }[] = [
    { id: 'escala', title: 'Chamar a pessoa', sub: config.escala?.frase || 'Sem mensagem', get: () => config.escala?.frase ?? '', set: (v) => scheduleSave({ ...config, escala: { ...config.escala, frase: v } }), rows: 4 },
    { id: 'escala_duvida', title: 'Chamar a pessoa (dúvida sem resposta)', sub: config.escala?.frase_duvida || 'Sem mensagem', get: () => config.escala?.frase_duvida ?? '', set: (v) => scheduleSave({ ...config, escala: { ...config.escala, frase_duvida: v } }), rows: 4 },
    { id: 'agradecimento', title: 'Agradecimento final', sub: config.agradecimento_fim?.frase || 'Sem mensagem', get: () => config.agradecimento_fim?.frase ?? '', set: (v) => scheduleSave({ ...config, agradecimento_fim: { frase: v } }), rows: 3 },
    { id: 'obj_repetida', title: 'Objeção repetida', sub: config.objecao_repetida?.frase || 'Sem mensagem', get: () => config.objecao_repetida?.frase ?? '', set: (v) => scheduleSave({ ...config, objecao_repetida: { frase: v } }), rows: 3 },
    { id: 'encerra_recusas', title: 'Encerramento por recusas', sub: config.encerramento_recusas?.frase || 'Sem mensagem', get: () => config.encerramento_recusas?.frase ?? '', set: (v) => scheduleSave({ ...config, encerramento_recusas: { frase: v } }), rows: 3 },
  ];
  const selEncItem = encItems.find((e) => e.id === selEnc) ?? encItems[0];

  const selPergunta = perguntas.find((p) => p.id === selQ) ?? null;
  const selPerguntaIdx = perguntas.findIndex((p) => p.id === selQ);
  const selSaved = selPergunta ? savedPergunta(selPergunta.id) : undefined;
  const selEdited = !!selPergunta && (!selSaved || !same(selSaved, selPergunta));
  const selObjecao = objecoes.find((o) => o.id === selO) ?? null;
  const selObjecaoIdx = objecoes.findIndex((o) => o.id === selO);
  const semDivisorAtivo = !perguntas.some((p) => p.id === selQ);

  return (
    <div className="flex flex-col gap-[22px]">
      {dirty && (
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-[#F5B544]/35 bg-[#F5B544]/[0.08] px-5 py-3.5 dark:border-[#3A2C10] dark:bg-[#1A1508]">
          <div className="flex items-center gap-3.5">
            <span className="size-[9px] shrink-0 rounded-full bg-[#F5B544]" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold leading-[18px] text-foreground">{changes.length} {changes.length === 1 ? 'alteração não publicada' : 'alterações não publicadas'}</span>
              <span className="text-[13.5px] leading-[18px] text-[#8A6A1F] dark:text-[#C9B27A]">O agente continua atendendo com a versão anterior até você publicar.</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setChangesOpen(true)} className="text-sm font-semibold leading-[18px] text-[#8A5A00] hover:underline dark:text-[#F5D08A]">Ver alterações</button>
            <button type="button" onClick={() => void descartar()} disabled={publishing} className="flex h-10 items-center justify-center rounded-full bg-[#141414] px-5 text-sm font-semibold leading-[18px] text-white shadow-[inset_0_1px_0_#FFFFFF14,0_3px_0_#000000] transition-transform active:translate-y-px disabled:opacity-60">Descartar</button>
            <button type="button" onClick={() => void publicar()} disabled={publishing} className="flex h-10 items-center justify-center rounded-full bg-[#01573C] px-6 text-sm font-semibold leading-[18px] text-white shadow-[inset_0_1px_0_#FFFFFF26,0_3px_0_#003526] transition-transform active:translate-y-px disabled:opacity-60">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publicar'}</button>
          </div>
        </div>
      )}

      <div role="tablist" aria-label="Partes da conversa" className="flex flex-wrap items-center gap-2">
        {chips.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)}
            className={cn('rounded-full px-4 py-2 text-sm leading-[18px] transition-colors', section === id ? 'bg-[#0F3D2B] font-semibold text-white dark:bg-[#12301F]' : 'bg-muted font-medium text-muted-foreground hover:text-foreground dark:bg-[#141414]')}>{label}</button>
        ))}
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
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
              <button type="button" onClick={() => { setSection('perguntas'); setSelQ(perguntas[0]?.id ?? null); }} className={cn('flex w-fit items-center gap-2 text-sm font-semibold hover:underline', LIME)}>Editar pergunta 1<ChevronRightIcon /></button>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-8')}>
              <EditorHead title="Quem é o agente" subtitle="Essas informações entram direto no comportamento do agente." />
              <div className="grid gap-x-5 gap-y-6 md:grid-cols-2">
                <Labeled label="Nome do agente" htmlFor="p-nome"><input id="p-nome" className={INPUT} value={config.persona?.nome_agente ?? ''} onChange={(e) => scheduleSave({ ...config, persona: { ...config.persona, nome_agente: e.target.value } })} /></Labeled>
                <Labeled label="Nome da empresa" htmlFor="p-emp"><input id="p-emp" className={INPUT} value={config.persona?.empresa ?? ''} onChange={(e) => scheduleSave({ ...config, persona: { ...config.persona, empresa: e.target.value } })} /></Labeled>
                <Labeled label="Quem assume a conversa" htmlFor="p-human" help="O nome que o agente usa ao passar o lead para uma pessoa."><input id="p-human" className={INPUT} value={config.persona?.assinatura_humano ?? ''} onChange={(e) => scheduleSave({ ...config, persona: { ...config.persona, assinatura_humano: e.target.value } })} /></Labeled>
              </div>
              <Labeled label="Tom de voz">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {TOM_PRESETS.map((t) => (
                    <button key={t.value} type="button" aria-pressed={config.persona?.tom === t.value} onClick={() => scheduleSave({ ...config, persona: { ...config.persona, tom: t.value } })} className={cn('flex flex-col gap-1 rounded-xl border px-4 py-3.5 text-left transition-colors', config.persona?.tom === t.value ? 'border-[#01573C] bg-[#E4F1E9] dark:border-[#96F63C]/50 dark:bg-[#12301F]' : 'border-border hover:bg-muted')}>
                      <span className="text-[15px] font-semibold text-foreground">{t.label}</span><span className="text-[13px] leading-[140%] text-muted-foreground">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </Labeled>
              <Labeled label="O que nunca dizer" optional htmlFor="p-restr"><Area id="p-restr" rows={3} value={joinLines(config.palavras_proibidas)} onChange={(v) => scheduleSave({ ...config, palavras_proibidas: splitLines(v) })} placeholder="Ex: não mencione preços sem entender a necessidade do cliente" /></Labeled>
            </section>
          </>
        )}

        {/* ── Perguntas ── */}
        {section === 'perguntas' && (
          perguntas.length === 0 ? (
            <div className="flex flex-1 flex-col gap-7">
              <div className="flex flex-col gap-2">
                <span className="text-2xl font-semibold leading-[30px] text-foreground">Como você quer montar as perguntas?</span>
                <span className="text-[15px] leading-[22px] text-muted-foreground">Escolha um ponto de partida. Você edita, adiciona e remove pergunta depois, do jeito que quiser.</span>
              </div>
              <div className="flex w-full flex-col gap-5 md:flex-row">
                {([
                  { tipo: 'zero' as const, nome: 'Do zero', desc: 'Monta a lista de perguntas você mesmo, sem ponto de partida.', tag: 'Lista em branco, você adiciona pergunta por pergunta.', botao: 'Começar do zero' },
                  { tipo: 'bant' as const, nome: 'BANT', desc: 'O clássico. Rápido, direto, ótimo pra qualificação de primeiro contato.', tag: 'Orçamento · Decisor · Necessidade · Prazo', botao: 'Usar BANT' },
                  { tipo: 'spiced' as const, nome: 'SPICED', desc: 'Mais fundo. Bom pra negócio de ticket mais alto ou ciclo mais longo.', tag: 'Situação · Dor · Impacto · Evento crítico · Decisão', botao: 'Usar SPICED' },
                ]).map((c) => (
                  <div key={c.tipo} className={cn('flex grow basis-0 flex-col gap-5 rounded-[14px] bg-card p-7 dark:bg-[#101010]', c.tipo === 'bant' ? 'border-[1.5px] border-[#01573C]' : 'border border-border dark:border-[#1C1C1C]')}>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-lg font-semibold leading-6 text-foreground">{c.nome}</span>
                      <span className="text-[13.5px] leading-5 text-muted-foreground dark:text-[#7A7A7A]">{c.desc}</span>
                    </div>
                    <div className="flex grow flex-col gap-2.5">
                      <span className={cn('text-[13px] leading-[18px]', c.tipo === 'bant' ? 'text-[#01573C] dark:text-[#B8D4C6]' : 'text-muted-foreground dark:text-[#5A5A5A]')}>{c.tag}</span>
                    </div>
                    <button type="button" onClick={() => void escolherFramework(c.tipo)} className={cn('flex h-11 shrink-0 items-center justify-center rounded-full text-sm leading-[18px] transition-transform active:translate-y-px', c.tipo === 'bant' ? 'bg-[#01573C] font-bold text-white shadow-[0_3px_0_#013825]' : 'border border-border bg-muted font-semibold text-foreground dark:border-[#262626] dark:bg-[#141414] dark:text-[#FAFAFA]')}>{c.botao}</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <aside className={cn(CARD, 'flex w-full shrink-0 flex-col overflow-clip xl:w-[330px]')}>
                <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-[18px]">
                  <div className="flex flex-col gap-0.5"><span className="text-[17px] font-semibold leading-[22px] text-foreground">Roteiro</span><span className="text-[13px] leading-4 text-muted-foreground">Nesta ordem</span></div>
                  <div className="flex items-center gap-2"><span className="text-[13.5px] leading-[18px] text-foreground">Ligado</span><PaperToggle on static label="Ligado" /></div>
                </div>
                <div className="flex grow flex-col px-3 pb-2 pt-1.5">
                  {perguntas.map((p, i) => (
                    <Fragment key={p.id}>
                      <PerguntaRow num={i + 1} active={p.id === selQ} obrigatoria={p.obrigatoria} title={tituloDe(p)} sub={p.texto} onClick={() => setSelQ(p.id)} />
                      {p.id === selQ && i < perguntas.length - 1 && <div className="ml-6 h-1.5 w-0.5 shrink-0 bg-border dark:bg-[#262626]" />}
                    </Fragment>
                  ))}
                  {semDivisorAtivo && <div className="ml-6 h-1.5 w-0.5 shrink-0 bg-border dark:bg-[#262626]" />}
                  <div className="flex gap-3.5 px-2.5">
                    <span className="flex shrink-0 flex-col items-center"><span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#01573C]/10 text-[#01573C] dark:bg-[#96F63C24] dark:text-[#96F63C]"><FlagIcon /></span></span>
                    <span className="flex min-w-0 flex-col gap-0.5"><span className="text-[14.5px] font-semibold leading-[18px] text-foreground">Ao terminar</span><span className="text-[13px] leading-4 text-muted-foreground">Perfeito, {'{nome}'}! O próximo…</span></span>
                  </div>
                </div>
                <button type="button" onClick={() => void adicionarPergunta()} className={cn('flex items-center justify-center gap-2 border-t border-border px-5 py-4 text-sm font-semibold leading-[18px] hover:underline dark:border-[#1C1C1C]', LIME)}><PlusIcon />Adicionar pergunta</button>
              </aside>

              <section className={cn(CARD, 'flex min-w-0 grow basis-0 flex-col gap-6 px-8 py-7', !selPergunta && 'items-center justify-center')}>
                {selPergunta ? (
                  <>
                    <EditorHead
                      eyebrow={`Pergunta ${selPerguntaIdx + 1} de ${perguntas.length}`}
                      title={<input aria-label="Nome da pergunta" value={selPergunta.titulo ?? ''} placeholder={humanize(selPergunta.id)} onChange={(e) => mutarPergunta({ titulo: e.target.value || undefined })} className="min-w-[120px] max-w-full bg-transparent text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground" />}
                      badges={<>{selPergunta.obrigatoria && <Badge>Obrigatória</Badge>}{selEdited && <Badge>Editado</Badge>}</>}
                      actions={<RemoveButton label="Remover pergunta" onClick={() => void removerPergunta()} />}
                    />
                    <div className="flex w-full items-center justify-between gap-4 rounded-[10px] border border-border bg-muted/40 px-4 py-3.5 dark:border-[#262626] dark:bg-[#161616]">
                      <div className="flex min-w-0 flex-col gap-1"><span className="text-[15px] font-semibold leading-[18px] text-foreground">Obrigatória</span><span className="text-[13px] leading-4 text-muted-foreground dark:text-[#7A7A7A]">Enquanto essa pergunta não for respondida, o agente não oferece reunião.</span></div>
                      <PaperToggle on={selPergunta.obrigatoria} onChange={(v) => mutarPergunta({ obrigatoria: v })} label="Obrigatória" />
                    </div>
                    <Labeled label="O que o agente pergunta" htmlFor="v3-texto" help="Use {nome} para o nome do lead."><PaperArea id="v3-texto" value={selPergunta.texto} edited={!selSaved || selSaved.texto !== selPergunta.texto} onChange={(v) => mutarPergunta({ texto: v })} /></Labeled>
                    <Labeled label="Se o lead não responder direito" optional htmlFor="v3-reform"><PaperArea id="v3-reform" value={selPergunta.reformulacao ?? ''} edited={!!selSaved && (selSaved.reformulacao ?? '') !== (selPergunta.reformulacao ?? '')} onChange={(v) => mutarPergunta({ reformulacao: v || undefined })} /></Labeled>
                    <div className="flex flex-col gap-3">
                      <span className="text-[15px] font-semibold leading-[18px] text-foreground">O que o agente guarda no lead</span>
                      <div className="grid gap-3 md:grid-cols-2">
                        <CampoCard
                          label={selPergunta.campo_label ?? ''} onLabel={(v) => mutarPergunta({ campo_label: v || undefined })} labelPlaceholder={humanize(selPergunta.campo)}
                          tipo={selPergunta.campo_tipo ?? 'texto'} onTipo={(v) => mutarPergunta({ campo_tipo: v === 'texto' ? undefined : v })}
                          descricao={selPergunta.campo_descricao ?? ''} onDescricao={(v) => mutarPergunta({ campo_descricao: v || undefined })}
                        />
                        {(selPergunta.campos_extra ?? []).map((c, i) => (
                          <CampoCard key={c.campo + i}
                            label={c.label} onLabel={(v) => mutarCampoExtra(i, { label: v, campo: slugify(v) || c.campo })}
                            tipo={c.tipo} onTipo={(v) => mutarCampoExtra(i, { tipo: v })}
                            descricao={c.descricao ?? ''} onDescricao={(v) => mutarCampoExtra(i, { descricao: v || undefined })}
                            opcional={!!c.opcional}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border px-[18px] py-4 dark:border-[#3A3A3A] dark:bg-[#101010]">
                      <span className="text-[15px] font-semibold leading-[18px] text-foreground">Depois, se precisar</span>
                      <span className="text-[14.5px] leading-[150%] text-foreground/90 dark:text-[#D0D0D0]">Se não responder, pergunta de novo com outras palavras antes de seguir pro próximo passo.</span>
                    </div>
                    <button type="button" onClick={() => retest(selPergunta.id)} className="flex h-[42px] shrink-0 items-center justify-center self-start rounded-full border border-[#01573C] bg-[#0F3D2B] px-[22px] text-sm font-semibold leading-[18px] text-white">Testar a partir desta pergunta</button>
                  </>
                ) : (
                  <div className="flex max-w-[360px] flex-col items-center gap-4 text-center">
                    <span className="text-[17px] font-semibold leading-[22px] text-foreground">Nenhuma pergunta ainda</span>
                    <span className="text-sm leading-[21px] text-muted-foreground dark:text-[#7A7A7A]">Clique em &quot;Adicionar pergunta&quot; pra criar a primeira. Você define o texto, se é obrigatória, e o que o agente guarda no lead.</span>
                  </div>
                )}
              </section>
            </>
          )
        )}

        {/* ── Preço ── */}
        {section === 'preco' && (
          <>
            <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
              <div className="flex flex-col gap-1 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Quando o lead pergunta o preço</h3><p className="text-[13px] leading-[150%] text-muted-foreground">Cada pergunta recebe a resposta da posição seguinte.</p></div>
              <div className="px-6 pb-3"><label className="flex items-center justify-between gap-3 rounded-[10px] bg-muted px-3.5 py-3 text-sm text-foreground dark:bg-[#181818]">Pode informar valores<PaperToggle on={!!config.preco?.pode_informar} onChange={(v) => setPreco({ pode_informar: v })} label="Pode informar valores" /></label></div>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
                {frasesAntes.map((s, i) => <ListRow key={i} active={selPrice === `antes-${i}`} title={`${ordinal(i + 1)} pergunta de preço`} sub={s} onClick={() => setSelPrice(`antes-${i}`)} />)}
                <ListRow active={selPrice === 'escalar'} title={`${ordinal(frasesAntes.length + 1)} em diante, se insistir`} sub={`Passa para ${humanName}`} onClick={() => setSelPrice('escalar')} />
                <ListRow active={selPrice === 'depois'} title="Depois das perguntas" sub={config.preco?.frase_depois_qualificacao || 'Sem resposta definida'} onClick={() => setSelPrice('depois')} />
                {config.preco?.por_escopo && <ListRow active={selPrice === 'escopo'} title="Preço por escopo" sub={config.preco.por_escopo.pergunta} onClick={() => setSelPrice('escopo')} />}
              </div>
              <div className="border-t border-border p-4"><button type="button" onClick={() => { const next = [...frasesAntes, '']; setSelPrice(`antes-${next.length - 1}`); void persist({ ...config, preco: { ...config.preco, frases_antes_qualificacao: next } }); }} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar resposta</button></div>
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
                        <button type="button" className="w-fit text-[13px] font-semibold text-destructive hover:underline" onClick={() => { const opcoes = config.preco!.por_escopo!.opcoes.filter((_, j) => j !== i); setPreco({ por_escopo: { ...config.preco!.por_escopo!, opcoes } }); }}>Remover opção</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => { const opcoes = [...(config.preco?.por_escopo?.opcoes ?? []), { valor: '', descricao: '', texto: [''] }]; setPreco({ por_escopo: { ...config.preco!.por_escopo!, opcoes } }); }} className="flex min-h-[60px] items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" />Adicionar opção</button>
                  </div>
                </>
              ) : (() => {
                const i = Number(selPrice.replace('antes-', '')) || 0;
                return (
                  <>
                    <EditorHead eyebrow={`Preço, resposta ${i + 1} de ${frasesAntes.length}`} title={`${ordinal(i + 1)} pergunta de preço`}
                      actions={<RemoveButton label="Remover resposta" onClick={() => { const next = frasesAntes.filter((_, k) => k !== i); setSelPrice('depois'); void persist({ ...config, preco: { ...config.preco, frases_antes_qualificacao: next } }); }} />} />
                    <Labeled label="O que o agente responde" htmlFor="pr" help="As quebras de linha são mantidas na mensagem."><PaperArea id="pr" value={frasesAntes[i] ?? ''} onChange={(v) => { const next = [...frasesAntes]; next[i] = v; setPreco({ frases_antes_qualificacao: next }); }} /></Labeled>
                    <div className="flex flex-col gap-3">
                      <span className="text-[15px] font-semibold leading-[18px] text-foreground">Como o agente escolhe a resposta</span>
                      <div className="grid gap-3 md:grid-cols-3">
                        {[...frasesAntes.map((_, k) => ({ when: `${ordinal(k + 1)} vez${k === 0 ? ' que pergunta' : ''}`, what: `Resposta ${k + 1}${k === i ? ' (esta)' : ''}`, on: k === i })), { when: `${ordinal(frasesAntes.length + 1)} vez em diante`, what: `Passa para ${humanName}`, on: false }].slice(0, 3).map((c, k) => (
                          <div key={k} className={cn('flex flex-col gap-1.5 rounded-xl border px-4 py-3.5', c.on ? 'border-[#01573C] bg-[#E4F1E9] dark:bg-[#12301F]' : 'border-border bg-muted/40 dark:border-[#2A2A2A] dark:bg-[#181818]')}><span className="text-[13px] leading-4 text-muted-foreground">{c.when}</span><span className="text-[14.5px] font-semibold leading-[18px] text-foreground">{c.what}</span></div>
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
                {(['objecao', 'duvida'] as const).map((kind) => {
                  const grupo = objFiltered.filter((o) => (kind === 'objecao') === o.conta_como_recusa);
                  const total = objecoes.filter((o) => (kind === 'objecao') === o.conta_como_recusa).length;
                  return (
                    <div key={kind} className="flex flex-col gap-0.5">
                      <p className="px-3.5 pb-1 pt-3 text-[13px] font-semibold text-muted-foreground">{kind === 'objecao' ? 'Objeções' : 'Dúvidas comuns'} {total}</p>
                      {grupo.map((o) => <ListRow key={o.id} active={o.id === selO} title={o.titulo || o.id} onClick={() => setSelO(o.id)} />)}
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border p-4"><button type="button" onClick={() => void adicionarObjecao()} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}><Plus className="h-4 w-4" />Adicionar objeção ou dúvida</button></div>
            </aside>
            <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
              {selObjecao ? (
                <>
                  <EditorHead eyebrow={`${selObjecao.conta_como_recusa ? 'Objeção' : 'Dúvida'} ${selObjecaoIdx + 1} de ${objecoes.length}`}
                    title={<input aria-label="Título da objeção" value={selObjecao.titulo} onChange={(e) => mutarObjecao({ titulo: e.target.value })} className="min-w-[120px] max-w-full bg-transparent text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-foreground outline-none [field-sizing:content]" />}
                    actions={<RemoveButton label="Remover" onClick={() => void removerObjecao()} />} />
                  <Labeled label="Tipo" help="Objeção conta para o limite de insistência. Dúvida comum não conta.">
                    <div className="flex w-fit items-center gap-0.5 rounded-full bg-muted p-[3px] dark:bg-[#181818]">{([[true, 'Objeção'], [false, 'Dúvida comum']] as const).map(([v, l]) => <button key={l} type="button" aria-pressed={selObjecao.conta_como_recusa === v} onClick={() => mutarObjecao({ conta_como_recusa: v })} className={cn('rounded-full px-5 py-2 text-sm leading-[18px] transition-colors', selObjecao.conta_como_recusa === v ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}>{l}</button>)}</div>
                  </Labeled>
                  <Labeled label="Modo" help="Literal copia exatamente. Livre deixa a IA adaptar o texto.">
                    <div className="flex w-fit items-center gap-0.5 rounded-full bg-muted p-[3px] dark:bg-[#181818]">{([['literal', 'Literal'], ['livre', 'Livre']] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={selObjecao.modo === v} onClick={() => mutarObjecao({ modo: v })} className={cn('rounded-full px-5 py-2 text-sm leading-[18px] transition-colors', selObjecao.modo === v ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}>{l}</button>)}</div>
                  </Labeled>
                  <Labeled label="Como o lead costuma dizer isso" htmlFor="o-t"><PaperArea id="o-t" value={joinLines(selObjecao.gatilhos)} onChange={(v) => mutarObjecao({ gatilhos: splitLines(v) })} /></Labeled>
                  {arr(selObjecao.resposta).map((sc, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-2"><label htmlFor={`o-s${i}`} className="text-[15px] font-semibold leading-[18px] text-foreground">Resposta {i + 1}</label><span className="text-[13px] leading-4 text-muted-foreground dark:text-[#7A7A7A]">{i === 0 ? 'usada uma vez por conversa' : 'usada quando o lead repete'}</span></div>
                      <PaperArea id={`o-s${i}`} value={sc} onChange={(v) => { const list = [...arr(selObjecao.resposta)]; list[i] = v; mutarObjecao({ resposta: list }); }} />
                      {arr(selObjecao.resposta).length > 1 && <button type="button" className="w-fit text-[13px] font-semibold text-destructive hover:underline" onClick={() => { const list = arr(selObjecao.resposta).filter((_, k) => k !== i); mutarObjecao({ resposta: list }); }}>Remover resposta</button>}
                    </div>
                  ))}
                  <button type="button" onClick={() => mutarObjecao({ resposta: [...arr(selObjecao.resposta), ''] })} className={cn('flex w-fit items-center gap-2 text-sm font-semibold leading-[18px] hover:underline', LIME)}><PlusIcon />Adicionar outra resposta</button>
                  <div className="grid gap-x-5 gap-y-6 md:grid-cols-2">
                    <Labeled label="Depois de responder" htmlFor="v3-obj-acao">
                      <select id="v3-obj-acao" className={INPUT} value={selObjecao.proxima_acao} onChange={(e) => mutarObjecao({ proxima_acao: e.target.value as ProximaAcaoObjecao })}>
                        {ACOES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </Labeled>
                    <Labeled label="Prioridade" htmlFor="v3-obj-prioridade" help="Quando duas objeções batem, vale a de menor número."><input id="v3-obj-prioridade" type="number" min={1} className={cn(INPUT, 'max-w-[140px]')} value={selObjecao.prioridade} onChange={(e) => mutarObjecao({ prioridade: Math.max(1, Number(e.target.value) || 1) })} /></Labeled>
                  </div>
                  <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted/40 px-[18px] py-4 dark:border-[#2A2A2A] dark:bg-[#181818]">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-semibold leading-[18px] text-foreground">Limite de objeções</span>
                      <div className="flex items-center gap-2.5">
                        <button type="button" aria-label="Diminuir" onClick={() => scheduleSave({ ...config, limites: { ...config.limites, recusas_para_encerrar: Math.max(1, (config.limites?.recusas_para_encerrar ?? 2) - 1) } })} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-base leading-5 text-foreground hover:bg-accent dark:bg-[#222222]">-</button>
                        <span className="text-base font-semibold leading-5 text-foreground">{config.limites?.recusas_para_encerrar ?? 2}</span>
                        <button type="button" aria-label="Aumentar" onClick={() => scheduleSave({ ...config, limites: { ...config.limites, recusas_para_encerrar: Math.min(6, (config.limites?.recusas_para_encerrar ?? 2) + 1) } })} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-base leading-5 text-foreground hover:bg-accent dark:bg-[#222222]">+</button>
                      </div>
                    </div>
                    <span className="text-[13.5px] leading-[150%] text-muted-foreground">Depois de {config.limites?.recusas_para_encerrar ?? 2} {(config.limites?.recusas_para_encerrar ?? 2) === 1 ? 'objeção' : 'objeções'} o agente encerra sem pressionar. Objeção repetida passa para uma pessoa em vez de insistir.</span>
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
                  <Labeled label="Recusas" htmlFor="v3-recusas"><input id="v3-recusas" type="number" min={1} className={cn(INPUT, 'max-w-[140px]')} value={config.limites?.recusas_para_encerrar ?? 2} onChange={(e) => scheduleSave({ ...config, limites: { ...config.limites, recusas_para_encerrar: Math.max(1, Number(e.target.value) || 1) } })} /></Labeled>
                </>
              ) : selEnc === 'ligacao' && config.ligacao ? (
                <>
                  <EditorHead eyebrow="Encerramento" title="Lead pede ligação" subtitle="Quando o lead pede para falar por telefone." />
                  <Labeled label="Oferta" optional htmlFor="v3-lig-oferta"><PaperArea id="v3-lig-oferta" value={config.ligacao.oferta} onChange={(v) => scheduleSave({ ...config, ligacao: { ...config.ligacao!, oferta: v } })} /></Labeled>
                  <Labeled label="Confirmação quando o lead aceita" optional htmlFor="v3-lig-conf"><PaperArea id="v3-lig-conf" value={config.ligacao.confirmacao} onChange={(v) => scheduleSave({ ...config, ligacao: { ...config.ligacao!, confirmacao: v } })} /></Labeled>
                  <Labeled label="Se já tem reunião marcada e pede ligação" optional htmlFor="v3-lig-reuniao"><PaperArea id="v3-lig-reuniao" value={config.ligacao.reuniao_e_ligacao ?? ''} onChange={(v) => scheduleSave({ ...config, ligacao: { ...config.ligacao!, reuniao_e_ligacao: v } })} /></Labeled>
                  <div className="flex flex-col gap-3"><span className="text-[15px] font-semibold leading-[18px] text-foreground">Como acontece</span>
                    <div className="grid gap-3 md:grid-cols-3">{[['1. Lead pede ligação', 'Agente envia a oferta'], ['2. Lead aceita', 'Agente envia a confirmação'], ['3. Depois', `Passa para ${humanName}`]].map(([a, b]) => <div key={a} className="flex flex-col gap-1 rounded-xl border border-border px-5 py-4"><span className="text-[13px] text-muted-foreground">{a}</span><span className="text-[15px] font-semibold text-foreground">{b}</span></div>)}</div>
                  </div>
                </>
              ) : (
                <>
                  <EditorHead eyebrow="Encerramento" title={selEncItem.title} />
                  <Labeled label="Mensagem" optional htmlFor="v3-enc"><PaperArea id="v3-enc" value={selEncItem.get()} onChange={selEncItem.set} /></Labeled>
                </>
              )}
            </section>
          </>
        )}

        {perguntas.length > 0 && <ConversaTestV3 config={config} agentName={agentName} dirty={dirty} seed={seed} />}
      </div>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Alterações não publicadas</DialogTitle><DialogDescription>O agente só usa estas mudanças depois de você publicar.</DialogDescription></DialogHeader>
          <ul className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">{changes.map((c, i) => <li key={i} className="flex items-center gap-3 rounded-lg bg-muted px-4 py-2.5 text-[15px] text-foreground"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F5B544]" />{c}</li>)}</ul>
          <DialogFooter><button type="button" onClick={() => setChangesOpen(false)} className="flex h-11 items-center justify-center rounded-full bg-[#141414] px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_#FFFFFF14,0_3px_0_#000000]">Fechar</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
