import type { FunnelConfig, FunnelObjection, FunnelStep } from '@/lib/sdr/funnel/types';
import type { AgentPersona } from './useSdrConfig';

export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function humanizeKey(k: string): string {
  return capitalize(k.replace(/_/g, ' ').trim());
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

export function stepTitle(s: FunnelStep): string {
  return s.title?.trim() || humanizeKey(s.id);
}

export function objectionTitle(key: string, o?: FunnelObjection): string {
  void o;
  return humanizeKey(key);
}

/** Onde cada mensagem de encerramento mora na configuração. */
export interface ClosingDef {
  id: string;
  title: string;
  desc: string;
  fields: { key: 'refusalReply' | 'farewellReply' | 'closingMessage' | 'deferReply' | 'aboutReply' | 'unknownAnswer' | 'handoff.waitMessage' | 'callOffer' | 'callConfirm'; label: string; optional?: boolean; help?: string }[];
}

export const CLOSINGS: ClosingDef[] = [
  { id: 'refusal', title: 'Lead não quer', desc: 'Quando o lead diz que não tem interesse.', fields: [{ key: 'refusalReply', label: 'Mensagem' }] },
  { id: 'farewell', title: 'Lead se despede', desc: 'Quando o lead encerra a conversa com um agradecimento ou um tchau.', fields: [{ key: 'farewellReply', label: 'Mensagem' }] },
  { id: 'closing', title: 'Ao terminar as perguntas', desc: 'Enviada uma vez quando o roteiro termina, antes de marcar o horário. Use {nome} para o nome do lead.', fields: [{ key: 'closingMessage', label: 'Mensagem', optional: true }] },
  { id: 'defer', title: 'Lead ocupado agora', desc: 'Quando o lead avisa que está ocupado e responde depois. Vazio deixa o agente em silêncio.', fields: [{ key: 'deferReply', label: 'Mensagem', optional: true }] },
  { id: 'about', title: 'Lead não entende do que se trata', desc: 'Quando o lead pergunta quem somos ou do que se trata. Vazio usa a base de conhecimento.', fields: [{ key: 'aboutReply', label: 'Mensagem', optional: true }] },
  { id: 'unknown', title: 'Pergunta sem resposta na base', desc: 'Quando a pergunta do lead não tem resposta na base aprovada.', fields: [{ key: 'unknownAnswer', label: 'Mensagem' }] },
  { id: 'handoff', title: 'Passa para uma pessoa', desc: 'O que o lead recebe quando a conversa passa para a equipe.', fields: [{ key: 'handoff.waitMessage', label: 'Mensagem' }] },
  { id: 'call', title: 'Lead pede ligação', desc: 'Quando o lead pede para falar por telefone.', fields: [{ key: 'callOffer', label: 'Oferta', optional: true }, { key: 'callConfirm', label: 'Confirmação quando o lead aceita', optional: true }] },
];

export function getClosing(cfg: FunnelConfig, key: ClosingDef['fields'][number]['key']): string {
  if (key === 'handoff.waitMessage') return cfg.handoff?.waitMessage ?? '';
  return (cfg[key] as string | undefined) ?? '';
}

export function setClosing(cfg: FunnelConfig, key: ClosingDef['fields'][number]['key'], value: string): void {
  if (key === 'handoff.waitMessage') { cfg.handoff = { ...(cfg.handoff ?? { waitMessage: '' }), waitMessage: value }; return; }
  const optional = key === 'closingMessage' || key === 'aboutReply' || key === 'callOffer' || key === 'callConfirm';
  // Textos opcionais vazios saem da configuração; "Lead ocupado" vazio é válido e significa silêncio
  (cfg as unknown as Record<string, unknown>)[key] = optional && value === '' ? undefined : value;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Troca um nome (do agente ou de quem assume) em todos os textos do funil. */
export function replaceNameInTexts(cfg: FunnelConfig, from: string, to: string): FunnelConfig {
  const a = from.trim();
  const b = to.trim();
  if (!a || !b || a === b) return cfg;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(a)}(?![\\p{L}\\p{N}])`, 'gu');
  const sub = (t: string | undefined) => (typeof t === 'string' ? t.replace(re, b) : t);
  const next = clone(cfg);
  next.steps.forEach((s) => {
    s.question = sub(s.question) as string;
    s.clarify = sub(s.clarify);
    s.partialQuestion = sub(s.partialQuestion);
    if (s.followUp) s.followUp.question = sub(s.followUp.question) as string;
  });
  next.priceScripts = next.priceScripts.map((t) => sub(t) as string);
  next.priceInsistHandoff = sub(next.priceInsistHandoff) as string;
  next.pricePosRoteiro = sub(next.pricePosRoteiro);
  next.aboutReply = sub(next.aboutReply);
  Object.values(next.objections).forEach((o) => { o.scripts = o.scripts.map((t) => sub(t) as string); });
  next.refusalReply = sub(next.refusalReply) as string;
  next.farewellReply = sub(next.farewellReply) as string;
  next.callOffer = sub(next.callOffer);
  next.callConfirm = sub(next.callConfirm);
  next.deferReply = sub(next.deferReply);
  next.closingMessage = sub(next.closingMessage);
  next.unknownAnswer = sub(next.unknownAnswer) as string;
  next.handoff = { ...next.handoff, waitMessage: sub(next.handoff.waitMessage) as string };
  if (next.agentNames) next.agentNames = next.agentNames.map((n) => (n.trim() === a ? b : n));
  return next;
}

/** Lista, em português, o que mudou entre a versão publicada e a que está em edição. */
export function diffFunnel(a: FunnelConfig, b: FunnelConfig): string[] {
  const out: string[] = [];
  const aById = new Map(a.steps.map((s) => [s.id, s]));
  b.steps.forEach((s) => {
    const o = aById.get(s.id);
    if (!o) out.push(`Pergunta nova: ${stepTitle(s)}`);
    else if (!same(o, s)) out.push(`Pergunta alterada: ${stepTitle(s)}`);
  });
  a.steps.forEach((s) => { if (!b.steps.some((x) => x.id === s.id)) out.push(`Pergunta removida: ${stepTitle(s)}`); });
  const inBoth = (id: string) => aById.has(id) && b.steps.some((x) => x.id === id);
  if (a.steps.filter((s) => inBoth(s.id)).map((s) => s.id).join(',') !== b.steps.filter((s) => inBoth(s.id)).map((s) => s.id).join(',')) out.push('Ordem das perguntas alterada');

  if (!same([a.priceScripts, a.priceInsistHandoff, a.priceHandoffAt, a.pricePosRoteiro, a.priceDisclosure], [b.priceScripts, b.priceInsistHandoff, b.priceHandoffAt, b.pricePosRoteiro, b.priceDisclosure])) out.push('Respostas de preço');

  Object.keys(b.objections).forEach((k) => {
    if (!a.objections[k]) out.push(`Objeção ou dúvida nova: ${objectionTitle(k)}`);
    else if (!same(a.objections[k], b.objections[k])) out.push(`Objeção ou dúvida alterada: ${objectionTitle(k)}`);
  });
  Object.keys(a.objections).forEach((k) => { if (!b.objections[k]) out.push(`Objeção ou dúvida removida: ${objectionTitle(k)}`); });
  if (a.maxObjections !== b.maxObjections) out.push('Limite de objeções');

  CLOSINGS.forEach((c) => {
    if (c.fields.some((f) => getClosing(a, f.key) !== getClosing(b, f.key))) out.push(`Encerramento: ${c.title}`);
  });
  if ((a.reactions !== false) !== (b.reactions !== false)) out.push('Reação humana');
  if (!same(a.agentNames ?? [], b.agentNames ?? [])) out.push('Nomes de quem atende');
  if ((a.humanName ?? '') !== (b.humanName ?? '')) out.push('Quem assume a conversa');
  return out;
}

const PERSONA_LABEL: Partial<Record<keyof AgentPersona, string>> = {
  nome_agente: 'Nome do agente', empresa: 'Nome da empresa', produto: 'Produto ou serviço', nicho_id: 'Nicho', tom: 'Tom de voz', restricoes: 'O que nunca dizer',
};

export function diffPersona(a: AgentPersona, b: AgentPersona): string[] {
  return (Object.keys(PERSONA_LABEL) as (keyof AgentPersona)[]).filter((k) => a[k] !== b[k]).map((k) => PERSONA_LABEL[k] as string);
}
