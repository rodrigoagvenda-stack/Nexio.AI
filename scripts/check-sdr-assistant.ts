// Verificação da lógica do assistente de criação do agente. Rodar com: npx tsx scripts/check-sdr-assistant.ts
import {
  EMPTY_ASSISTANT, FIXED_RULES, composeAnswers, composePriceRule, missingRequired, reviewChecks, reviewRows,
  sanitizeAssistant, stepChecks, triggerCount,
} from '../lib/sdr/assistant';

let fail = 0;
const t = (ok: boolean, m: string) => { console.log(ok ? 'OK  ' : 'FAIL', m); if (!ok) { fail++; process.exitCode = 1; } };

const full = {
  ...EMPTY_ASSISTANT, agentName: 'Laura', identidade: 'a'.repeat(130),
  produto_contexto: 'Serviço de marketing digital para clínicas. ' + 'x'.repeat(200),
  nao_oferece: 'NAO existe:\n- Plano anual\n- Suporte por telefone\n- Desconto por indicação\n- Garantia de resultado', chegada: '',
  abordagem: 'Vai na dor. A conversa inicial é grátis.', proximo_passo: 'Agendar reunião de 20 minutos. ' + 'y'.repeat(100),
  qualificacao: '1. Tipo de negócio 2. Quanto você pretende investir por mês? ' + 'z'.repeat(200), sem_perfil: '',
  priceRule: 'ask' as const, priceQuestion: 'Quanto você investe hoje por mês em anúncios?', priceValue: 'A partir de R$ 1.500 por mês',
  obj_preco: 'Gatilhos: "Tá caro" / "Não tenho dinheiro" / "Vou pensar"\n' + 'r'.repeat(200),
  obj_tempo: '"Preciso pensar" "Não tenho tempo" ' + 't'.repeat(200),
  obj_produto: '"Tem contrato?" / "Precisa fidelidade?" ' + 'p'.repeat(200), regras: '1. Uma pergunta por mensagem.',
};

t(missingRequired(EMPTY_ASSISTANT).length >= 9, `vazio: faltam os obrigatórios (${missingRequired(EMPTY_ASSISTANT).length})`);
t(missingRequired(full).length === 0, 'completo: nada falta');
t(missingRequired({ ...full, priceRule: '' }).some((m) => m.step === 'preco'), 'sem regra de preço: falta');
t(missingRequired({ ...full, priceRule: 'ask', priceQuestion: '' }).some((m) => m.label.includes('Pergunta')), 'ask sem pergunta: falta');
t(missingRequired({ ...full, priceRule: 'never', priceValue: '' }).length === 0, 'never não exige valor');

const c = composeAnswers(full);
t(c.precos.includes('REGRA DE PREÇO (TRAVA)') && c.precos.includes('Quanto você investe hoje') && c.precos.includes('pergunta_antes_do_preco'), 'ask vira trava com a pergunta e o rótulo do checklist');
t(c.precos.includes('nunca ofereça'), 'sem teste/desconto: proíbe oferecer');
t(composePriceRule({ ...full, priceTrial: 'trial' }).includes('teste grátis'), 'trial mencionado');
t(composePriceRule({ ...full, priceRule: 'never' }).includes('nunca diga valor'), 'never: proíbe valor');
t(c.regras.includes('REGRAS FIXAS DO ZAAPPLY') && FIXED_RULES.every((r) => c.regras.includes(r)), 'regras fixas sempre incluídas');
t(c.regras.startsWith('1. Uma pergunta por mensagem.'), 'regras do usuário vêm antes das fixas');
t(c.identidade.startsWith('Nome do agente: Laura'), 'nome vai na identidade');
t(!c.nao_oferece.includes('EXCLUSIVAMENTE'), 'sem trava por padrão');
t(composeAnswers({ ...full, lockOtherService: true }).nao_oferece.includes('EXCLUSIVAMENTE em: Serviço de marketing digital'), 'trava de outro serviço cita o produto');

const rc = reviewChecks(full);
t(rc.some((x) => x.fix === 'lockOtherService' && x.tone === 'warn'), 'revisão avisa sobre preço de outro serviço');
t(!rc.some((x) => x.title.includes('grátis')), 'menciona grátis: sem aviso de gratuidade');
t(reviewChecks({ ...full, abordagem: 'Vai na dor.', proximo_passo: 'Agendar. ' + 'y'.repeat(100) }).some((x) => x.title.includes('grátis')), 'sem menção a grátis: avisa (mesmo com "sem teste grátis" na regra de preço)');
t(reviewChecks({ ...full, qualificacao: 'Tipo de negócio e decisor ' + 'z'.repeat(200) }).some((x) => x.title.includes('verba')), 'qualificação sem verba: avisa');
const tones = reviewChecks({ ...full, qualificacao: 'sem nada ' + 'z'.repeat(200) }).map((x) => x.tone);
t(tones.includes('warn') && tones.indexOf('warn') > tones.lastIndexOf('ok'), 'na revisão os itens ok vêm antes dos avisos');
t(stepChecks('agente', { ...full, agentName: '' }).some((x) => x.tone === 'warn'), 'sem nome: aviso');
t(triggerCount('"Tá caro" / "Não tenho"') === 2 && triggerCount('só uma frase') === 1 && triggerCount('') === 0, 'contagem de gatilhos');
t(sanitizeAssistant({ priceRule: 'hack', agentName: 5, obj_preco: 'x', lockOtherService: 'sim' }).priceRule === '', 'sanitize: regra inválida vira vazio');
t(sanitizeAssistant({ agentName: 'a'.repeat(9000) }).agentName.length === 8000, 'sanitize: limita tamanho');
t(reviewRows(full)[2].value === '4 itens que ele nunca oferece', 'revisão conta itens do "não faz"');
t(!reviewRows({ ...full, identidade: 'Laura, atendente comercial. ' + 'a'.repeat(120) })[0].value.startsWith('Laura, Laura'), 'revisão não repete o nome quando a descrição já começa por ele');
t(reviewRows({ ...full, identidade: 'Atendente comercial. ' + 'a'.repeat(120) })[0].value.startsWith('Laura, Atendente'), 'revisão junta nome e papel quando a descrição não começa pelo nome');
t(reviewRows(full)[5].value === 'Pergunta antes, depois fala o valor', 'revisão resume a regra de preço');

console.log(fail ? `${fail} falhas` : 'tudo certo');
