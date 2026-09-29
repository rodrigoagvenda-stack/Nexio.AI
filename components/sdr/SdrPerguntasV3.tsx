'use client';

// Tela de Perguntas do SDR v3 (motor novo, com decisor em código). Diferente do funil v2
// (SdrConversa/FunnelConfig): aqui a config é `CompanyConfig`, versionada em `sdr_company_configs`,
// lida e salva via /api/sdr/v3/config. Mostrada só pra empresa com company.features.sdr_v3 === true.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { askConfirm } from './ConfirmHost';
import { CARD, INPUT, LIME, PILL3D, PILL_GREEN, Toggle } from './ui';

type PerguntaQualificacao = {
  id: string;
  texto: string;
  campo: string;
  obrigatoria: boolean;
  ordem: number;
};

// Só a fatia da CompanyConfig que essa tela lê/edita. O resto (persona, preço, objeções...) viaja
// junto intacto a cada save, porque a API espera o objeto inteiro.
type CompanyConfig = Record<string, unknown> & {
  version: number;
  qualificacao: { perguntas: PerguntaQualificacao[] };
};

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

export function SdrPerguntasV3() {
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sdr/v3/config');
      const json = await res.json();
      const ativa = json?.data?.ativa?.config as CompanyConfig | undefined;
      setConfig(ativa ?? null);
      if (ativa?.qualificacao?.perguntas?.length) setSelId(ativa.qualificacao.perguntas[0].id);
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
      const res = await fetch('/api/sdr/v3/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: next, nota }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ title: json.message || 'Não foi possível salvar', variant: 'destructive' });
        return false;
      }
      return true;
    } catch {
      toast({ title: 'Erro de conexão ao salvar', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // Autosave com debounce curto pra edição de texto; ações estruturais (add/remove/toggle) salvam na hora.
  const scheduleSave = useCallback((next: CompanyConfig, nota: string) => {
    setConfig(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persist(next, nota); }, 900);
  }, [persist]);

  const escolherFramework = useCallback(async (tipo: 'zero' | 'bant' | 'spiced') => {
    if (!config) return;
    const base = tipo === 'bant' ? BANT : tipo === 'spiced' ? SPICED : [];
    const perguntas: PerguntaQualificacao[] = [{ ...NOME_PADRAO, ordem: 1 }, ...base.map((p, i) => ({ ...p, ordem: i + 2 }))];
    const next: CompanyConfig = { ...config, qualificacao: { perguntas } };
    setConfig(next);
    setSelId(perguntas[0]?.id ?? null);
    await persist(next, `Framework escolhido: ${tipo}`);
  }, [config, persist]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!config) {
    return <div className={cn(CARD, 'px-8 py-8 text-center text-muted-foreground')}>Não achei a configuração do SDR v3 pra essa empresa.</div>;
  }

  const perguntas = [...(config.qualificacao?.perguntas ?? [])].sort((a, b) => a.ordem - b.ordem);
  const sel = perguntas.find((p) => p.id === selId) ?? null;
  const selIdx = perguntas.findIndex((p) => p.id === selId);

  const mutarPergunta = (patch: Partial<PerguntaQualificacao>) => {
    if (!sel) return;
    const next: CompanyConfig = {
      ...config,
      qualificacao: { perguntas: perguntas.map((p) => (p.id === sel.id ? { ...p, ...patch } : p)) },
    };
    scheduleSave(next, `Editou pergunta "${sel.id}"`);
  };

  const removerPergunta = async () => {
    if (!sel) return;
    if (perguntas.length <= 1) { toast({ title: 'Precisa de pelo menos uma pergunta', variant: 'warning' }); return; }
    if (!(await askConfirm('Remover esta pergunta do roteiro?'))) return;
    const restantes = perguntas.filter((p) => p.id !== sel.id).map((p, i) => ({ ...p, ordem: i + 1 }));
    const next: CompanyConfig = { ...config, qualificacao: { perguntas: restantes } };
    setSelId(restantes[Math.max(0, selIdx - 1)]?.id ?? null);
    await persist(next, `Removeu pergunta "${sel.id}"`);
  };

  const adicionarPergunta = async () => {
    let n = perguntas.length + 1;
    while (perguntas.some((p) => p.id === `pergunta_${n}`)) n++;
    const nova: PerguntaQualificacao = { id: `pergunta_${n}`, campo: `dado_${n}`, texto: '', obrigatoria: false, ordem: perguntas.length + 1 };
    const next: CompanyConfig = { ...config, qualificacao: { perguntas: [...perguntas, nova] } };
    setSelId(nova.id);
    await persist(next, 'Adicionou pergunta');
  };

  // ── Estado inicial: escolher framework ──
  if (perguntas.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-foreground">Como você quer montar as perguntas?</h2>
          <p className="text-[15px] text-muted-foreground">Escolha um ponto de partida. Você edita, adiciona e remove pergunta depois, do jeito que quiser.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {([
            { tipo: 'zero' as const, nome: 'Do zero', desc: 'Monta a lista de perguntas você mesmo, sem ponto de partida.', tag: null },
            { tipo: 'bant' as const, nome: 'BANT', desc: 'O clássico. Rápido, direto, ótimo pra qualificação de primeiro contato.', tag: 'Orçamento · Decisor · Necessidade · Prazo' },
            { tipo: 'spiced' as const, nome: 'SPICED', desc: 'Mais fundo. Bom pra negócio de ticket mais alto ou ciclo mais longo.', tag: 'Situação · Dor · Impacto · Evento crítico · Decisão' },
          ]).map((c) => (
            <div key={c.tipo} className={cn(CARD, 'flex flex-col gap-5 p-7', c.tipo === 'bant' && 'border-[#01573C] dark:border-[#96F63C]/50')}>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold text-foreground">{c.nome}</h3>
                <p className="text-[13.5px] leading-[145%] text-muted-foreground">{c.desc}</p>
              </div>
              {c.tag && <p className="flex-1 text-[13px] text-muted-foreground">{c.tag}</p>}
              {!c.tag && <div className="flex-1" />}
              <button type="button" onClick={() => void escolherFramework(c.tipo)} className={cn(c.tipo === 'bant' ? PILL_GREEN : PILL3D, 'w-full')}>
                {c.tipo === 'zero' ? 'Começar do zero' : `Usar ${c.nome}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const card = 'flex min-h-[560px] flex-col';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end text-sm text-muted-foreground">
        {saving ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando…</span> : <span>Salvo</span>}
      </div>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
        <aside className={cn(CARD, card, 'w-full shrink-0 xl:w-[330px]')}>
          <div className="flex flex-col gap-1 px-6 pb-3 pt-6"><h3 className="text-lg font-semibold text-foreground">Roteiro</h3><p className="text-[13px] text-muted-foreground">Nesta ordem</p></div>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
            {perguntas.map((p, i) => <ListRow key={p.id} num={i + 1} active={p.id === selId} title={p.texto ? p.texto.slice(0, 28) || p.id : p.id} sub={p.obrigatoria ? 'Obrigatória' : undefined} onClick={() => setSelId(p.id)} />)}
          </div>
          <div className="border-t border-border p-4">
            <button type="button" onClick={() => void adicionarPergunta()} className={cn('flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold hover:underline', LIME)}>
              <Plus className="h-4 w-4" />Adicionar pergunta
            </button>
          </div>
        </aside>

        <section className={cn(CARD, card, 'min-w-0 flex-1 gap-6 px-8 py-7')}>
          {sel ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm text-muted-foreground">Pergunta {selIdx + 1} de {perguntas.length}</p>
                  <input
                    aria-label="Identificador da pergunta"
                    value={sel.id}
                    onChange={(e) => mutarPergunta({ id: e.target.value })}
                    className="min-w-[120px] max-w-full bg-transparent [field-sizing:content] text-[26px] font-semibold leading-8 tracking-tight text-foreground outline-none"
                  />
                </div>
                <button type="button" onClick={() => void removerPergunta()} className="flex items-center gap-2 text-sm font-semibold text-destructive hover:underline"><Trash2 className="h-4 w-4" />Remover pergunta</button>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-5 py-4 dark:border-[#2A2A2A] dark:bg-[#161616]">
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-semibold text-foreground">Obrigatória</p>
                  <p className="text-[13px] text-muted-foreground">Enquanto essa pergunta não for respondida, o agente não oferece reunião.</p>
                </div>
                <Toggle on={sel.obrigatoria} onChange={(v) => mutarPergunta({ obrigatoria: v })} label="Obrigatória" />
              </div>

              <Labeled label="O que o agente pergunta" htmlFor="v3-texto" help="Use {nome} para o nome do lead.">
                <Area id="v3-texto" rows={3} value={sel.texto} onChange={(v) => mutarPergunta({ texto: v })} />
              </Labeled>

              <Labeled label="Campo que guarda a resposta" htmlFor="v3-campo" help="Nome interno usado pelo motor pra saber se essa pergunta já foi respondida.">
                <input id="v3-campo" className={INPUT} value={sel.campo} onChange={(e) => mutarPergunta({ campo: e.target.value })} />
              </Labeled>
            </>
          ) : (
            <p className="py-16 text-center text-muted-foreground">Escolha uma pergunta na lista.</p>
          )}
        </section>
      </div>
    </div>
  );
}
