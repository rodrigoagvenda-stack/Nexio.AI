'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import type { FieldType, FunnelConfig, FunnelField, FunnelObjection, FunnelStep } from '@/lib/sdr/funnel/types';

// Botões pill 3D do produto : #141414 (neutro) e #01573C (ação principal).
const PRIMARY_BTN = { backgroundColor: '#01573C', color: '#fff', boxShadow: '0 2px 0 0 #013d2a' } as const;
const NEUTRAL_BTN = { backgroundColor: '#141414', color: '#D8D8D8', boxShadow: '0 2px 0 0 #1F1F1F', border: '1px solid #212121' } as const;

const INPUT = 'w-full rounded-xl border border-[#212121] bg-[#141414] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#01573C]';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto livre' },
  { value: 'yesno', label: 'Sim ou não' },
  { value: 'link_or_media', label: 'Link ou imagem' },
];

interface FunnelResponse {
  companyName: string;
  active: boolean;
  config: FunnelConfig | null;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#212121] bg-[#0e0e0e] p-5">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      {hint && <p className="mt-1 mb-4 text-xs leading-relaxed text-zinc-500">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
  rows = 2,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">{label}</span>
      <textarea className={INPUT} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export default function FunilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [cfg, setCfg] = useState<FunnelConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [humanName, setHumanName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sdr/funnel');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setCfg(json.data.config);
        setDirty(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update(mutator: (c: FunnelConfig) => void) {
    setCfg((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as FunnelConfig;
      mutator(next);
      return next;
    });
    setDirty(true);
  }

  async function createFromTemplate() {
    setSaving(true);
    try {
      const res = await fetch('/api/sdr/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, humanName }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      await load();
    } catch (e: any) {
      toast({ title: e.message || 'Erro ao criar o funil', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sdr/funnel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setDirty(false);
      toast({ title: 'Funil salvo' });
    } catch (e: any) {
      toast({ title: e.message || 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(active: boolean) {
    if (dirty) {
      toast({ title: 'Salve as alterações antes de ligar ou desligar o funil', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/sdr/funnel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setData((d) => (d ? { ...d, active } : d));
      toast({ title: active ? 'Funil ligado' : 'Funil desligado' });
    } catch (e: any) {
      toast({ title: e.message || 'Erro ao alterar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // ── Empresa ainda sem funil : cria a partir do modelo ────────────────────
  if (!cfg) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-bold text-zinc-100">Funil do SDR</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          O funil conduz a conversa do começo ao fim com os textos que você aprova, palavra por palavra. A inteligência artificial só lê o que o lead
          respondeu. Isso evita pergunta repetida, pergunta dupla, resposta inventada e valor revelado sem querer.
        </p>
        <div className="mt-6 space-y-4 rounded-2xl border border-[#212121] bg-[#0e0e0e] p-5">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Nome do seu atendente virtual</span>
            <input className={INPUT} value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Ex: Laura" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Nome de quem assume as conversas quando preciso</span>
            <input className={INPUT} value={humanName} onChange={(e) => setHumanName(e.target.value)} placeholder="Ex: o Bruno" />
          </label>
          <button
            type="button"
            disabled={saving || !agentName.trim() || !humanName.trim()}
            onClick={createFromTemplate}
            className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium disabled:opacity-50"
            style={PRIMARY_BTN}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar funil a partir do modelo
          </button>
          <p className="text-xs text-zinc-500">O funil nasce desligado. Revise os textos e ligue quando estiver pronto.</p>
        </div>
      </div>
    );
  }

  const moveStep = (i: number, dir: -1 | 1) =>
    update((c) => {
      const j = i + dir;
      if (j < 0 || j >= c.steps.length) return;
      [c.steps[i], c.steps[j]] = [c.steps[j], c.steps[i]];
    });

  const addStep = () =>
    update((c) => {
      const n = c.steps.length + 1;
      const key = `dado_${n}`;
      c.steps.push({
        id: `passo_${n}`,
        question: '',
        fields: [{ key, label: 'a resposta', type: 'text', description: 'Resposta do lead a esta pergunta, resumida.' }],
      });
    });

  const addObjection = () => {
    const name = window.prompt('Nome curto da objeção ou dúvida (ex: prazo, garantia)');
    const key = slug(name ?? '');
    if (!key) return;
    update((c) => {
      if (c.objections[key]) return;
      c.objections[key] = { kind: 'faq', triggers: '', scripts: [''] };
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Funil do SDR</h1>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">
            Cada texto abaixo sai exatamente como escrito. A inteligência artificial só lê as respostas do lead, nunca escreve por você, exceto para
            responder dúvidas usando a sua base de conhecimento.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-medium disabled:opacity-40"
          style={PRIMARY_BTN}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
      </div>

      <Section
        title="Funil ligado"
        hint="Ligado, o funil conduz as conversas novas. Conversas que já estavam em andamento terminam no atendimento anterior, sem repetir perguntas."
      >
        <div className="flex items-center gap-3">
          <Switch checked={data?.active ?? false} onCheckedChange={toggleActive} disabled={saving} />
          <span className="text-sm text-zinc-300">{data?.active ? 'Ligado' : 'Desligado'}</span>
        </div>
      </Section>

      <Section
        title="Passos da conversa"
        hint="Perguntados na ordem. O último passo costuma ser quem decide. Se o lead responder vários passos de uma vez, o funil pula os já respondidos."
      >
        <div className="space-y-4">
          {cfg.steps.map((step: FunnelStep, i: number) => (
            <div key={step.id} className="rounded-xl border border-[#212121] bg-[#141414] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Passo {i + 1}</span>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Subir passo" onClick={() => moveStep(i, -1)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#212121]">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Descer passo" onClick={() => moveStep(i, 1)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#212121]">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remover passo"
                    onClick={() => update((c) => void c.steps.splice(i, 1))}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#212121] hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <Text
                  label="Pergunta (use {nome} para o nome do lead)"
                  value={step.question}
                  onChange={(v) => update((c) => void (c.steps[i].question = v))}
                />
                <Text
                  label="Se o lead não responder direito, perguntar assim (opcional)"
                  value={step.clarify ?? ''}
                  onChange={(v) => update((c) => void (c.steps[i].clarify = v || undefined))}
                />
                <div>
                  <span className="mb-1 block text-xs text-zinc-400">O que anotar da resposta</span>
                  <div className="space-y-2">
                    {step.fields.map((f: FunnelField, k: number) => (
                      <div key={f.key} className="grid gap-2 rounded-lg border border-[#212121] p-2 md:grid-cols-[1fr_140px_auto]">
                        <input
                          className={INPUT}
                          value={f.label}
                          aria-label="Nome do dado"
                          onChange={(e) => update((c) => void (c.steps[i].fields[k].label = e.target.value))}
                        />
                        <select
                          className={INPUT}
                          value={f.type}
                          aria-label="Tipo do dado"
                          onChange={(e) => update((c) => void (c.steps[i].fields[k].type = e.target.value as FieldType))}
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            checked={f.required !== false}
                            onChange={(e) => update((c) => void (c.steps[i].fields[k].required = e.target.checked))}
                          />
                          Obrigatório
                        </label>
                        <input
                          className={`${INPUT} md:col-span-3`}
                          value={f.description}
                          aria-label="Como reconhecer a resposta"
                          placeholder="Como reconhecer essa resposta"
                          onChange={(e) => update((c) => void (c.steps[i].fields[k].description = e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addStep} className="mt-4 inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm" style={NEUTRAL_BTN}>
          <Plus className="h-4 w-4" />
          Adicionar passo
        </button>
      </Section>

      <Section
        title="Quando o lead pergunta o preço"
        hint="Nunca coloque valor aqui. Na primeira pergunta sai uma destas respostas. Na segunda, o lead recebe o texto abaixo e a conversa passa para uma pessoa."
      >
        <div className="space-y-3">
          {cfg.priceScripts.map((t: string, i: number) => (
            <div key={i} className="flex gap-2">
              <div className="flex-1">
                <Text label={`Resposta ${i + 1}`} value={t} onChange={(v) => update((c) => void (c.priceScripts[i] = v))} />
              </div>
              <button
                type="button"
                aria-label="Remover resposta"
                onClick={() => update((c) => void c.priceScripts.splice(i, 1))}
                className="mt-6 h-9 rounded-lg p-2 text-zinc-400 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => update((c) => void c.priceScripts.push(''))} className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm" style={NEUTRAL_BTN}>
            <Plus className="h-4 w-4" />
            Adicionar resposta
          </button>
          <Text label="Se o lead insistir no preço" value={cfg.priceInsistHandoff} onChange={(v) => update((c) => void (c.priceInsistHandoff = v))} />
        </div>
      </Section>

      <Section
        title="Objeções e dúvidas comuns"
        hint="Cada uma tem respostas aprovadas por você, usadas uma vez cada. Objeção repetida passa para uma pessoa em vez de insistir. Dúvida comum sem resposta nova vai para a sua base de conhecimento."
      >
        <div className="space-y-4">
          {Object.entries(cfg.objections).map(([key, o]: [string, FunnelObjection]) => (
            <div key={key} className="rounded-xl border border-[#212121] bg-[#141414] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">{key.replace(/_/g, ' ')}</span>
                <button
                  type="button"
                  aria-label="Remover objeção"
                  onClick={() => update((c) => void delete c.objections[key])}
                  className="rounded-lg p-1.5 text-zinc-400 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <Text
                  label="Como o lead costuma dizer isso"
                  value={o.triggers}
                  rows={2}
                  onChange={(v) => update((c) => void (c.objections[key].triggers = v))}
                />
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-400">Tipo</span>
                  <select
                    className={INPUT}
                    value={o.kind}
                    onChange={(e) => update((c) => void (c.objections[key].kind = e.target.value as 'objecao' | 'faq'))}
                  >
                    <option value="objecao">Objeção (conta para o limite de insistência)</option>
                    <option value="faq">Dúvida comum</option>
                  </select>
                </label>
                {o.scripts.map((t, i) => (
                  <Text
                    key={i}
                    label={`Resposta ${i + 1}`}
                    value={t}
                    rows={3}
                    onChange={(v) => update((c) => void (c.objections[key].scripts[i] = v))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addObjection} className="mt-4 inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm" style={NEUTRAL_BTN}>
          <Plus className="h-4 w-4" />
          Adicionar objeção ou dúvida
        </button>
        <div className="mt-4 max-w-xs">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Quantas objeções antes de encerrar sem pressionar</span>
            <select className={INPUT} value={cfg.maxObjections} onChange={(e) => update((c) => void (c.maxObjections = Number(e.target.value)))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Encerramentos e passagem para uma pessoa">
        <div className="space-y-3">
          <Text label="Quando o lead diz que não quer" value={cfg.refusalReply} onChange={(v) => update((c) => void (c.refusalReply = v))} />
          <Text label="Quando o lead se despede" value={cfg.farewellReply} onChange={(v) => update((c) => void (c.farewellReply = v))} />
          <Text
            label="Quando a pergunta não tem resposta na sua base de conhecimento"
            value={cfg.unknownAnswer}
            onChange={(v) => update((c) => void (c.unknownAnswer = v))}
          />
          <Text
            label="Quando a conversa passa para uma pessoa"
            value={cfg.handoff.waitMessage}
            onChange={(v) => update((c) => void (c.handoff.waitMessage = v))}
          />
          <Text label="Quando o lead pede ligação: oferta (opcional)" value={cfg.callOffer ?? ''} onChange={(v) => update((c) => void (c.callOffer = v || undefined))} />
          <Text label="Quando o lead aceita a ligação: confirmação (opcional)" value={cfg.callConfirm ?? ''} onChange={(v) => update((c) => void (c.callConfirm = v || undefined))} />
        </div>
      </Section>
    </div>
  );
}
