// Onboarding: objetivos escolhidos no passo 2 e o checklist "Primeiros passos" que sai deles.
// O checklist é DERIVADO dos dados reais da empresa (WhatsApp conectado, agente criado...), nunca marcado à mão.

export type Goal = 'ai_replies' | 'crm' | 'followup' | 'calendar';
export type PlanIntent = 'starter' | 'pro';

export const GOAL_IDS: Goal[] = ['ai_replies', 'crm', 'followup', 'calendar'];
export const MAX_GOALS = 2;

export const GOALS: { id: Goal; title: string; desc: string }[] = [
  { id: 'ai_replies', title: 'Responder leads no WhatsApp com IA', desc: 'Um agente atende, qualifica e leva o lead para o próximo passo.' },
  { id: 'crm', title: 'Organizar contatos e vendas', desc: 'Todos os leads e negociações num quadro só.' },
  { id: 'followup', title: 'Fazer follow-up e recuperar quem sumiu', desc: 'Mensagens automáticas para quem parou de responder.' },
  { id: 'calendar', title: 'Agendar reuniões e reduzir faltas', desc: 'Calendário ligado e lembretes antes de cada horário.' },
];

export const PLANS: { id: PlanIntent; name: string; price: number; popular?: boolean; features: string[] }[] = [
  { id: 'starter', name: 'ZAAPPLY START', price: 297, features: ['Agente SDR com IA', 'Atendimento via chat', 'CRM Kanban', 'Métricas e relatórios', 'Anti noshow', '1 número de WhatsApp'] },
  { id: 'pro', name: 'ZAAPPLY GROWTH', price: 497, popular: true, features: ['Tudo do Start', 'Google Calendar integrado', 'Follow-up e remarketing', 'Rastreio de anúncios'] },
];

/** Guardado em companies.onboarding. Empresas antigas têm {} e não veem nada disso. */
export interface OnboardingState {
  goals?: Goal[];
  plan_intent?: PlanIntent;
  /** true depois do cadastro e até clicar em "Ir para o painel" (passo final, depois do pagamento) */
  pending_finish?: boolean;
  checklist_hidden?: boolean;
}

/** Aceita qualquer coisa e devolve no máximo 2 objetivos válidos, sem repetir. */
export function sanitizeGoals(input: unknown): Goal[] {
  if (!Array.isArray(input)) return [];
  const out: Goal[] = [];
  for (const g of input) {
    if (GOAL_IDS.includes(g as Goal) && !out.includes(g as Goal)) out.push(g as Goal);
  }
  return out.slice(0, MAX_GOALS);
}

export function sanitizePlan(input: unknown): PlanIntent | null {
  return input === 'starter' || input === 'pro' ? input : null;
}

/** Fatos reais da empresa usados para marcar cada passo como feito. */
export interface ChecklistFacts {
  whatsappConnected: boolean;
  hasAgent: boolean;
  calendarConnected: boolean;
  hasLeads: boolean;
  hasFollowUp: boolean;
}

export interface ChecklistItem {
  id: string;
  title: string;
  /** texto do card "Primeiros passos" no painel */
  desc: string;
  /** texto da lista do passo final do onboarding */
  hint: string;
  actionLabel: string;
  href: string;
  done: boolean;
}

/** A lista muda conforme o que a pessoa marcou. O primeiro item ("Criar a conta") sempre está feito. */
export function buildChecklist(goals: Goal[], f: ChecklistFacts): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: 'account', title: 'Criar a conta', desc: 'Pronto.', hint: 'Pronto.', actionLabel: '', href: '', done: true },
  ];
  if (goals.includes('ai_replies')) {
    items.push(
      { id: 'whatsapp', title: 'Conectar o WhatsApp', desc: 'Sem isso o agente não recebe nem responde mensagens.', hint: 'Em Automações, SDR, Conexões.', actionLabel: 'Conectar', href: '/configuracoes/sdr', done: f.whatsappConnected },
      { id: 'agent', title: 'Criar o agente de vendas', desc: 'O assistente faz as perguntas e monta o agente.', hint: 'O assistente faz as perguntas e monta o agente.', actionLabel: 'Começar', href: '/configuracoes/sdr', done: f.hasAgent },
    );
  }
  if (goals.includes('crm')) {
    items.push({ id: 'leads', title: 'Adicionar seus leads', desc: 'Importe uma planilha ou cadastre no CRM.', hint: 'Importe uma planilha ou cadastre no CRM.', actionLabel: 'Começar', href: '/crm', done: f.hasLeads });
  }
  if (goals.includes('followup')) {
    items.push({ id: 'followup', title: 'Criar um follow-up', desc: 'Mensagens automáticas para quem parou de responder.', hint: 'Mensagens automáticas para quem parou de responder.', actionLabel: 'Começar', href: '/configuracoes/follow', done: f.hasFollowUp });
  }
  if (goals.includes('calendar')) {
    items.push({ id: 'calendar', title: 'Ligar o Google Calendar', desc: 'Para o agente marcar reuniões direto na sua agenda.', hint: 'Para o agente marcar reuniões direto na sua agenda.', actionLabel: 'Começar', href: '/configuracoes/agenda', done: f.calendarConnected });
  }
  return items;
}

export const PAID_PLAN_TYPES = ['starter', 'start', 'pro', 'growth', 'scale'];
