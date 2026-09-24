import type { QuestionnaireAnswers } from './questionnaire';

// Assistente de criação do agente de vendas: 9 passos que viram as duas bases do SDR (conhecimento e objeções).
// Este módulo é puro (sem React nem banco): a tela, o servidor e os testes usam o mesmo código.

export type PriceRule = 'ask' | 'now' | 'never';
export type PriceTrial = 'none' | 'trial' | 'discount';

export interface AssistantAnswers {
  agentName: string;
  identidade: string;
  produto_contexto: string;
  nao_oferece: string;
  chegada: string;
  abordagem: string;
  proximo_passo: string;
  qualificacao: string;
  sem_perfil: string;
  priceRule: PriceRule | '';
  priceQuestion: string;
  priceValue: string;
  priceTrial: PriceTrial;
  /** "Este contato vende só o que foi descrito": trava contra citar preço de outro serviço */
  lockOtherService: boolean;
  obj_preco: string;
  obj_tempo: string;
  obj_produto: string;
  regras: string;
}

export const EMPTY_ASSISTANT: AssistantAnswers = {
  agentName: '', identidade: '', produto_contexto: '', nao_oferece: '', chegada: '',
  abordagem: '', proximo_passo: '', qualificacao: '', sem_perfil: '',
  priceRule: '', priceQuestion: '', priceValue: '', priceTrial: 'none', lockOtherService: false,
  obj_preco: '', obj_tempo: '', obj_produto: '', regras: '',
};

/** Aceita qualquer coisa (rascunho antigo, corpo de requisição) e devolve respostas completas e seguras. */
export function sanitizeAssistant(input: unknown): AssistantAnswers {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: AssistantAnswers = { ...EMPTY_ASSISTANT };
  const str = (k: keyof AssistantAnswers) => (typeof src[k] === 'string' ? (src[k] as string).slice(0, 8000) : '');
  for (const k of ['agentName', 'identidade', 'produto_contexto', 'nao_oferece', 'chegada', 'abordagem', 'proximo_passo',
    'qualificacao', 'sem_perfil', 'priceQuestion', 'priceValue', 'obj_preco', 'obj_tempo', 'obj_produto', 'regras'] as const) {
    out[k] = str(k);
  }
  out.priceRule = src.priceRule === 'ask' || src.priceRule === 'now' || src.priceRule === 'never' ? src.priceRule : '';
  out.priceTrial = src.priceTrial === 'trial' || src.priceTrial === 'discount' ? src.priceTrial : 'none';
  out.lockOtherService = src.lockOtherService === true;
  return out;
}

/* ───────── passos ───────── */

export type StepId = 'agente' | 'vende' | 'naofaz' | 'leads' | 'conduzir' | 'atender' | 'preco' | 'objecoes' | 'regras';

export interface FieldDef {
  key: keyof AssistantAnswers;
  label: string;
  kind: 'input' | 'textarea';
  placeholder: string;
  required?: boolean;
  /** exemplo de resposta bem preenchida (vem do assistente anterior) */
  example?: string;
  minChars?: number;
}

export interface StepDef {
  id: StepId;
  /** nome na lista da esquerda */
  label: string;
  title: (agent: string) => string;
  subtitle: string;
  fields: FieldDef[];
}

export const STEPS: StepDef[] = [
  {
    id: 'agente', label: 'Quem é o agente',
    title: () => 'Quem vai atender os seus leads?',
    subtitle: 'Dê um nome ao agente e descreva o papel e o tom. Agente sem nome soa passivo e genérico.',
    fields: [
      { key: 'agentName', label: 'Nome do agente', kind: 'input', placeholder: 'Ex: Laura, Ana, Carlos', required: true },
      {
        key: 'identidade', label: 'Papel e tom', kind: 'textarea', required: true, minChars: 120,
        placeholder: 'Descreva o nome, a empresa, a função e o tom do agente...',
        example: 'Você é Ana Voss, especialista comercial da Play Ads : agência de tráfego pago para e-commerces de moda.\n\nVocê não é uma assistente. Você é uma especialista que qualifica leads e agenda calls com o time.\n\nTom: direto, caloroso e consultivo. Nunca frio, nunca rude. Você acredita no produto porque viu o resultado na prática.\n\nNunca diga "posso ajudar?" : você já está ajudando.',
      },
    ],
  },
  {
    id: 'vende', label: 'O que você vende',
    title: () => 'O que você vende?',
    subtitle: 'Contexto interno: o agente usa para entender o negócio e nunca cita como está escrito.',
    fields: [{
      key: 'produto_contexto', label: 'Produto ou serviço', kind: 'textarea', required: true, minChars: 220,
      placeholder: 'Descreva com detalhe: o que inclui, preço, links, condições e diferenciais...',
      example: 'Produto: Tocli : sistema de gestão para pequenos negócios.\n\nO que inclui: controle de vendas, estoque, financeiro, emissão de nota fiscal e relatórios. Tudo integrado em um só lugar.\n\nPreço: R$49,90/mês. Sem contrato, cancela quando quiser.\n\nTeste grátis: 7 dias sem cartão de crédito.\nLink do teste: tocli.com.br/testegratis7dias\n\nDiferencial: o único do mercado que integra NF-e diretamente no fluxo de venda, sem precisar de contador para emitir.',
    }],
  },
  {
    id: 'naofaz', label: 'O que você não faz',
    title: () => 'O que você não faz?',
    subtitle: 'Evita que o agente invente aulas, descontos, planos ou funcionalidades que não existem.',
    fields: [{
      key: 'nao_oferece', label: 'O que não existe', kind: 'textarea', required: true, minChars: 120,
      placeholder: 'Liste tudo que não existe: funcionalidades, planos, descontos, condições...',
      example: 'NAO existe:\n- Plano anual ou desconto por antecipação\n- Módulo de RH ou folha de pagamento\n- Integração com marketplaces (Mercado Livre, Shopee)\n- Suporte por telefone : só chat e email\n- Garantia de resultado ou promessa de aumento de vendas\n- Versão gratuita permanente (só o teste de 7 dias)\n\nSe o lead perguntar algo que não existe, responda: "Ainda não temos isso. O que você tem hoje funciona assim: [redirecione para o que existe]."',
    }],
  },
  {
    id: 'leads', label: 'De onde vêm os leads',
    title: () => 'De onde vêm os seus leads?',
    subtitle: 'O canal e o que costumam dizer na primeira mensagem. Ajuda o agente a reconhecer o contexto.',
    fields: [{
      key: 'chegada', label: 'Como o lead chega', kind: 'textarea', placeholder: 'Descreva de onde vêm os leads e o que costumam dizer ao entrar em contato...',
      example: 'Canais de entrada:\n- 70%: anúncios no Meta (Facebook/Instagram) : já viram o produto no anúncio\n- 20%: indicação : chegam mais qualificados e diretos\n- 10%: orgânico : mais curiosos, menos urgentes\n\nPrimeiras mensagens mais comuns:\n- "Vi o anúncio, quero saber mais"\n- "Quanto custa?"\n- "Tem pra restaurante?"\n- "Oi" (lead frio : qualifique antes de avançar)',
    }],
  },
  {
    id: 'conduzir', label: 'Como conduzir a conversa',
    title: () => 'Como conduzir a conversa?',
    subtitle: 'A estratégia de abordagem e a ação final: o que o agente busca no fim.',
    fields: [
      {
        key: 'abordagem', label: 'Abordagem', kind: 'textarea', required: true, minChars: 220,
        placeholder: 'Vai na dor primeiro ou apresenta o produto direto? Descreva a estratégia...',
        example: 'Estratégia: vai na dor antes de falar de produto.\n\nNunca abra com benefícios. Primeiro entenda o cenário do lead.\n\nPerguntas de diagnóstico (use uma por vez):\n- "Hoje você controla o estoque de cabeça ou tem algum sistema?"\n- "Quando você fecha o mês, sabe exatamente quanto lucrou?"\n\nDepois que o lead expor a dor, posicione o produto como solução para aquele problema específico.',
      },
      {
        key: 'proximo_passo', label: 'Ação final', kind: 'textarea', required: true, minChars: 120,
        placeholder: 'Qual a ação final? Agendamento, teste grátis, compra... Inclua o link e o que fazer se recusar.',
        example: 'Ação final: link do teste grátis por 7 dias.\n\nCondição para oferecer: somente após qualificação completa.\n\nLink: tocli.com.br/testegratis7dias\n\nSe recusar o teste:\n"Tudo bem! Quando tiver um momento, o link fica salvo aqui."\n\nNao insista mais de uma vez.',
      },
    ],
  },
  {
    id: 'atender', label: 'Quem vale atender',
    title: () => 'Quem vale atender?',
    subtitle: 'As perguntas que qualificam o lead, em ordem, e como encerrar quando ele não tem perfil.',
    fields: [
      {
        key: 'qualificacao', label: 'Perguntas de qualificação', kind: 'textarea', required: true, minChars: 220,
        placeholder: 'Liste as perguntas em ordem, uma por mensagem, e o que descarta o lead...',
        example: 'Sequência (uma pergunta por mensagem, espere a resposta antes de avançar):\n\n1. "Qual é o seu tipo de negócio?"\n2. "Hoje você usa algum sistema para controlar as vendas?"\n3. "Você é o dono do negócio ou gerencia para outra pessoa?"\n4. "Quanto você pretende investir por mês nisso?"\n5. "Você teria como testar essa semana?"\n\nDescarta: não é o decisor, sem verba, sem prazo definido.',
      },
      {
        key: 'sem_perfil', label: 'Quando o lead não tem perfil', kind: 'textarea',
        placeholder: 'Como encerrar com elegância quando o lead não tem perfil...',
        example: 'Sem verba:\n"Entendo! Quando o negócio crescer um pouco mais, pode me chamar que avaliamos juntos."\n\nNão é o decisor:\n"Faz sentido. Quando puder trazer o dono ou sócio, me chama aqui."\n\nApós encerrar: nunca envie mais mensagens.',
      },
    ],
  },
  {
    id: 'preco', label: 'Preço',
    title: (agent) => `Quando o lead perguntar o preço, o que ${agent || 'o agente'} faz?`,
    subtitle: 'Escolha uma regra. Ela vale mesmo que o lead pergunte o valor logo na primeira mensagem.',
    fields: [],
  },
  {
    id: 'objecoes', label: 'Dúvidas e objeções',
    title: () => 'Dúvidas e objeções',
    subtitle: 'Escreva 2 ou 3 formas de o lead dizer cada coisa, com uma resposta para cada. Não decore frases: descreva a lógica.',
    fields: [
      {
        key: 'obj_preco', label: 'Preço e valor', kind: 'textarea', required: true, minChars: 220,
        placeholder: '"Tá caro", "Não tenho dinheiro", "Vou pensar": gatilhos, o que está por trás e um exemplo de resposta...',
        example: 'Gatilhos: "Ta caro" / "E muito caro" / "Nao tenho dinheiro"\nPor tras: pode ser preco mesmo, ou duvida se vale a pena.\nExemplo de resposta (adapte ao que o lead disse):\n"Entendo! Sao R$49,90 por mes, menos de R$2 por dia. Mas o teste e gratis, sem cartao."\nNunca dizer: "Entendo sua preocupacao, mas sao apenas..." : soa defensivo.',
      },
      {
        key: 'obj_tempo', label: 'Tempo, indecisão e confiança', kind: 'textarea', required: true, minChars: 220,
        placeholder: '"Preciso pensar", "Não tenho tempo", "Já uso outro", "Isso é golpe?": gatilhos e respostas...',
        example: 'Gatilhos: "Preciso pensar" / "Vou pensar" / "Deixa eu ver"\nExemplo de resposta:\n"Claro, sem pressao! O teste fica disponivel quando voce quiser."\n\nGatilhos: "Isso e golpe?" / "Voces sao confiaveis?"\nPor tras: o lead nao te conhece : precisa de prova, nao de afirmacao.\nNunca dizer: "Pode confiar, somos serios".',
      },
      {
        key: 'obj_produto', label: 'Dúvidas sobre o produto', kind: 'textarea', required: true, minChars: 220,
        placeholder: '"Tem contrato?", "É difícil de usar?", "Tem app?": a pergunta e a resposta exata...',
        example: 'Gatilhos: "Tem contrato?" / "Precisa fidelidade?"\nScript: "Nao tem contrato nenhum. E mensal, cancela quando quiser."\n\nGatilhos: "E dificil de usar?" / "Precisa de treinamento?"\nScript: "E bem simples. A maioria configura sozinho em menos de 15 minutos."',
      },
    ],
  },
  {
    id: 'regras', label: 'Regras que nunca quebra',
    title: () => 'Regras que nunca quebra',
    subtitle: 'O que o agente jamais pode fazer ou dizer. Cada regra quebrada custa uma venda.',
    fields: [{
      key: 'regras', label: 'Suas regras', kind: 'textarea', placeholder: 'Liste as regras invioláveis do seu negócio...',
      example: '1. Uma pergunta por mensagem. Nunca duas juntas.\n2. Nunca inventar funcionalidade, plano ou desconto que não existe.\n3. Máximo 3 linhas por mensagem.\n4. Nunca fingir ser humano se perguntarem diretamente se é IA.\n5. Nunca falar de concorrente.\n6. Só oferecer o link do teste após qualificação completa.',
    }],
  },
];

/** As regras que valem para todo agente e que o assistente inclui sozinho (a pessoa vê a lista no último passo). */
export const FIXED_RULES: string[] = [
  'Nunca se apresente de novo depois da primeira mensagem da conversa.',
  'Nunca repita uma pergunta de qualificação que o lead já respondeu nesta conversa.',
  'Nunca repita o mesmo argumento ou diferencial mais de uma vez: amarre a resposta ao que o lead acabou de dizer.',
  'Nunca termine uma mensagem sem dar um passo à frente (uma pergunta, a resposta a uma objeção ou o próximo passo), a não ser que o lead peça para parar.',
];

export const PRICE_OPTIONS: { id: PriceRule; title: string; desc: string; recommended?: boolean }[] = [
  { id: 'ask', title: 'Faz uma pergunta antes de falar o valor', desc: 'O agente só revela o preço depois que o lead responder a pergunta abaixo. Se ele insistir sem responder, o agente volta a perguntar uma vez e segue.', recommended: true },
  { id: 'now', title: 'Responde na hora', desc: 'Diz o valor assim que o lead perguntar.' },
  { id: 'never', title: 'Nunca fala valor, leva para uma reunião', desc: 'O preço só é dito por uma pessoa da equipe.' },
];

export const TRIAL_OPTIONS: { id: PriceTrial; label: string }[] = [
  { id: 'none', label: 'Não tem' },
  { id: 'trial', label: 'Tem teste grátis' },
  { id: 'discount', label: 'Tem desconto' },
];

/* ───────── composição ───────── */

const firstLine = (s: string, n = 90) => {
  const line = s.trim().split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return line.length > n ? `${line.slice(0, n - 1).trimEnd()}…` : line;
};

function trialLine(t: PriceTrial): string {
  if (t === 'trial') return '\nExiste teste grátis: pode mencionar depois de revelar o valor.';
  if (t === 'discount') return '\nExiste desconto: só ofereça se o lead pedir ou hesitar.';
  return '\nNão existe teste grátis nem desconto: nunca ofereça.';
}

/** A regra de preço vira texto com trava: o texto manda o agente conferir o checklist da conversa antes de revelar o valor. */
export function composePriceRule(a: AssistantAnswers): string {
  const q = a.priceQuestion.trim();
  const v = a.priceValue.trim();
  if (a.priceRule === 'ask') {
    return `REGRA DE PREÇO (TRAVA): só revele o valor depois que o lead responder esta pergunta: "${q}". Antes de falar qualquer valor, confira o checklist da conversa: se essa resposta ainda não foi registrada (nova_pergunta_respondida, rótulo "pergunta_antes_do_preco"), faça a pergunta primeiro, mesmo que o lead pergunte o preço direto na primeira mensagem. Se ele insistir sem responder, repita a pergunta UMA vez e siga a conversa. Depois que ele responder, diga o valor e leve para o próximo passo.\nValor a revelar: ${v}.${trialLine(a.priceTrial)}`;
  }
  if (a.priceRule === 'now') {
    return `REGRA DE PREÇO: quando o lead perguntar o valor, diga na hora.\nValor: ${v}.${trialLine(a.priceTrial)}`;
  }
  if (a.priceRule === 'never') {
    return 'REGRA DE PREÇO (TRAVA): nunca diga valor, faixa ou plano. Se o lead perguntar, explique que o preço é passado por uma pessoa da equipe e leve para o próximo passo (reunião).';
  }
  return '';
}

/** Junta as respostas do assistente no formato que o gerador de bases já espera. */
export function composeAnswers(a: AssistantAnswers): QuestionnaireAnswers {
  const lock = a.lockOtherService
    ? `\n\nEste contato é focado EXCLUSIVAMENTE em: ${firstLine(a.produto_contexto)}. Se perguntarem preço ou plano de qualquer outra coisa, nunca cite valor: diga que não é isso que você atende e leve a conversa de volta para o que você vende.`
    : '';
  const rules = `${a.regras.trim() ? `${a.regras.trim()}\n\n` : ''}REGRAS FIXAS DO ZAAPPLY (sempre valem):\n${FIXED_RULES.map((r) => `- ${r}`).join('\n')}`;
  return {
    identidade: `Nome do agente: ${a.agentName.trim()}\n\n${a.identidade.trim()}`,
    produto_contexto: a.produto_contexto.trim(),
    nao_oferece: `${a.nao_oferece.trim()}${lock}`,
    abordagem: a.abordagem.trim(),
    qualificacao: a.qualificacao.trim(),
    proximo_passo: a.proximo_passo.trim(),
    sem_perfil: a.sem_perfil.trim(),
    precos: composePriceRule(a),
    chegada: a.chegada.trim(),
    regras: rules,
    obj_preco: a.obj_preco.trim(),
    obj_tempo: a.obj_tempo.trim(),
    obj_produto: a.obj_produto.trim(),
  };
}

/** O que falta para poder criar (só o que o gerador exige; o resto vira aviso, não trava). */
export function missingRequired(a: AssistantAnswers): { step: StepId; label: string }[] {
  const out: { step: StepId; label: string }[] = [];
  for (const s of STEPS) {
    for (const f of s.fields) {
      if (f.required && !String(a[f.key]).trim()) out.push({ step: s.id, label: f.label });
    }
  }
  if (!a.priceRule) out.push({ step: 'preco', label: 'Regra de preço' });
  if (a.priceRule === 'ask' && !a.priceQuestion.trim()) out.push({ step: 'preco', label: 'Pergunta antes do preço' });
  if ((a.priceRule === 'ask' || a.priceRule === 'now') && !a.priceValue.trim()) out.push({ step: 'preco', label: 'Valor ou faixa' });
  return out;
}

/* ───────── conferência ───────── */

export interface Check {
  tone: 'ok' | 'warn';
  title: string;
  desc?: string;
  /** botão de correção rápida (ex.: adicionar a trava de outro serviço) */
  fix?: 'lockOtherService';
}

const FREE_RE = /gr[aá]tis|gratuit|sem custo|sem cobran|paga\b|pago\b|cobrad/i;
const BUDGET_RE = /or[cç]amento|verba|invest|prazo|urg[eê]ncia|quanto (?:voc[eê] )?(?:pretende|quer|pode|gasta)/i;

/** Conta as formas diferentes de o lead dizer a mesma objeção: gatilhos separados por barra ou mais de uma frase entre aspas. */
export function triggerCount(text: string): number {
  if (!text.trim()) return 0;
  const slashes = (text.match(/"\s*\/\s*"/g) ?? []).length;
  const quoted = (text.match(/"[^"\n]{2,}"/g) ?? []).length;
  return Math.max(slashes + 1, quoted >= 2 ? quoted : 0);
}

export function stepChecks(id: StepId, a: AssistantAnswers): Check[] {
  const agent = a.agentName.trim() || 'O agente';
  const checks: Check[] = [];
  switch (id) {
    case 'agente':
      checks.push(a.agentName.trim()
        ? { tone: 'ok', title: `${a.agentName.trim()} tem nome próprio` }
        : { tone: 'warn', title: 'O agente ainda não tem nome', desc: 'Agente sem nome soa passivo e genérico. Dê um nome, mesmo que curto.' });
      if (a.identidade.trim().length < 120) checks.push({ tone: 'warn', title: 'A descrição está curta', desc: 'Diga o papel, a empresa e o tom em algumas frases.' });
      break;
    case 'vende':
      checks.push(a.produto_contexto.trim().length >= 220
        ? { tone: 'ok', title: 'Descreve o que você vende com detalhe' }
        : { tone: 'warn', title: 'Descreva com mais detalhe', desc: 'Inclua o que está incluído, condições e diferenciais. Resposta genérica gera agente genérico.' });
      break;
    case 'naofaz':
      checks.push(a.nao_oferece.trim().length >= 60
        ? { tone: 'ok', title: 'Diz o que o agente nunca oferece' }
        : { tone: 'warn', title: 'Liste o que não existe', desc: 'Sem isso o agente pode inventar planos, descontos ou funcionalidades.' });
      break;
    case 'leads':
      checks.push(a.chegada.trim()
        ? { tone: 'ok', title: 'O agente sabe como o lead chega' }
        : { tone: 'warn', title: 'Passo opcional em branco', desc: 'Ajuda o agente a adaptar o tom ao canal de entrada.' });
      break;
    case 'conduzir': {
      checks.push({ tone: 'ok', title: 'Toda resposta termina com um passo à frente', desc: 'O Zaapply inclui essa regra sozinho.' });
      const text = `${a.abordagem} ${a.proximo_passo} ${a.produto_contexto}`;
      if (!FREE_RE.test(text)) {
        checks.push({ tone: 'warn', title: 'Não diz se a conversa inicial é grátis', desc: 'Se for grátis, dizer isso ajuda o lead a aceitar. Se for paga, evita mal-entendido.' });
      }
      break;
    }
    case 'atender':
      checks.push(BUDGET_RE.test(a.qualificacao)
        ? { tone: 'ok', title: 'Pergunta sobre verba ou prazo' }
        : { tone: 'warn', title: 'Não pergunta sobre verba nem prazo', desc: 'Sem isso o agente qualifica só por segmento e decisor, e leva lead sem orçamento até o fim.' });
      break;
    case 'preco':
      if (a.priceRule === 'ask') checks.push({ tone: 'ok', title: 'O preço só sai depois da pergunta. A regra fica travada, não só escrita.' });
      else if (a.priceRule === 'now') checks.push({ tone: 'ok', title: 'O valor sai assim que o lead perguntar', desc: 'Vale mesmo antes de qualificar o lead.' });
      else if (a.priceRule === 'never') checks.push({ tone: 'ok', title: 'Nenhum valor é dito pelo agente' });
      if (a.priceRule && a.priceRule !== 'never') {
        checks.push(a.lockOtherService
          ? { tone: 'ok', title: 'O valor vale só para o serviço que você descreveu no passo 2.' }
          : { tone: 'warn', title: 'Falta dizer o que fazer se o lead perguntar preço de outro serviço', desc: `Sem isso ${agent === 'O agente' ? 'o agente' : agent} pode citar este valor para algo que você não vende.`, fix: 'lockOtherService' });
      }
      break;
    case 'objecoes':
      for (const [k, label] of [['obj_preco', 'Preço e valor'], ['obj_tempo', 'Tempo, indecisão e confiança'], ['obj_produto', 'Dúvidas sobre o produto']] as const) {
        const text = a[k];
        if (text.trim().length < 220) checks.push({ tone: 'warn', title: `O bloco "${label}" está curto`, desc: 'Escreva 2 ou 3 formas de o lead dizer isso, com uma resposta para cada.' });
        else if (triggerCount(text) < 2) checks.push({ tone: 'warn', title: `"${label}" tem uma forma só de aparecer`, desc: 'O lead nunca diz a objeção do mesmo jeito. Acrescente outra forma.' });
        else checks.push({ tone: 'ok', title: `"${label}" cobre mais de uma forma de o lead dizer` });
      }
      break;
    case 'regras':
      checks.push({ tone: 'ok', title: 'As regras fixas do Zaapply entram sozinhas', desc: 'Veja a lista ao lado.' });
      break;
  }
  return checks;
}

/** A lista "Antes de criar" da revisão: os pontos que costumam fazer um agente errar com cliente de verdade. */
export function reviewChecks(a: AssistantAnswers): Check[] {
  const list: Check[] = [];
  list.push(a.agentName.trim() ? { tone: 'ok', title: 'O agente tem nome próprio' } : { tone: 'warn', title: 'O agente não tem nome', desc: 'Agente sem nome soa passivo e genérico.' });
  list.push({ tone: 'ok', title: 'Toda resposta termina com um passo à frente' });
  if (a.priceRule === 'ask') list.push({ tone: 'ok', title: 'Preço só depois da pergunta de verba' });
  const objs = [a.obj_preco, a.obj_tempo, a.obj_produto];
  list.push(objs.every((o) => o.trim().length >= 220 && triggerCount(o) >= 2)
    ? { tone: 'ok', title: 'Cada objeção tem mais de uma forma de aparecer' }
    : { tone: 'warn', title: 'Alguma objeção tem uma forma só de aparecer', desc: 'O lead nunca diz a objeção do mesmo jeito. Escreva 2 ou 3 formas para cada bloco.' });
  const text = `${a.abordagem} ${a.proximo_passo} ${a.produto_contexto}`;
  if (!FREE_RE.test(text)) list.push({ tone: 'warn', title: 'Não diz se a conversa inicial é grátis', desc: 'Se for grátis, dizer isso ajuda o lead a aceitar. Se for paga, evita mal-entendido.' });
  if (!BUDGET_RE.test(a.qualificacao)) list.push({ tone: 'warn', title: 'Não pergunta sobre verba nem prazo', desc: 'Sem isso o agente leva lead sem orçamento até o fim.' });
  if (a.priceRule && a.priceRule !== 'never' && !a.lockOtherService) {
    list.push({ tone: 'warn', title: 'Sem regra para preço de outro serviço', desc: `${a.agentName.trim() || 'O agente'} pode citar o valor errado para algo que você não vende.`, fix: 'lockOtherService' });
  }
  return list.sort((x, y) => (x.tone === y.tone ? 0 : x.tone === 'ok' ? -1 : 1));
}

/* ───────── revisão ───────── */

export function priceSummary(a: AssistantAnswers): string {
  return a.priceRule === 'ask' ? 'Pergunta antes, depois fala o valor'
    : a.priceRule === 'now' ? 'Responde na hora'
    : a.priceRule === 'never' ? 'Nunca fala valor, leva para uma reunião' : 'Não definido';
}

/** Nome e papel numa linha, sem repetir o nome quando a descrição já começa por ele. */
function agentSummary(a: AssistantAnswers): string {
  const name = a.agentName.trim() || 'Sem nome';
  const role = firstLine(a.identidade, 70);
  if (!role) return name;
  return role.toLowerCase().startsWith(name.toLowerCase()) ? role : `${name}, ${role}`;
}

export function reviewRows(a: AssistantAnswers): { step: StepId; label: string; value: string }[] {
  const lines = a.nao_oferece.split('\n').map((l) => l.replace(/^[-•*\d.\s]+/, '').trim()).filter((l) => l && !/^n[aã]o existe:?$/i.test(l));
  const filled = [a.obj_preco, a.obj_tempo, a.obj_produto].filter((t) => t.trim()).length;
  return [
    { step: 'agente', label: 'Quem é o agente', value: agentSummary(a) },
    { step: 'vende', label: 'O que você vende', value: firstLine(a.produto_contexto, 90) || 'Em branco' },
    { step: 'naofaz', label: 'O que você não faz', value: lines.length > 1 ? `${lines.length} itens que ele nunca oferece` : firstLine(a.nao_oferece, 90) || 'Em branco' },
    { step: 'conduzir', label: 'Como conduzir a conversa', value: firstLine(a.abordagem, 90) || 'Em branco' },
    { step: 'atender', label: 'Quem vale atender', value: firstLine(a.qualificacao, 90) || 'Em branco' },
    { step: 'preco', label: 'Preço', value: priceSummary(a) },
    { step: 'objecoes', label: 'Dúvidas e objeções', value: `${filled} de 3 blocos preenchidos` },
  ];
}
