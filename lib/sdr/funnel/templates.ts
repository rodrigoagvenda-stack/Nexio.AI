/**
 * Configurações de funil prontas. Os textos aqui são os APROVADOS pelo cliente,
 * copiados palavra por palavra (não parafrasear : é o ponto do funil em código).
 */
import type { FunnelConfig, FunnelField } from './types'

const yesno = (key: string, label: string, description: string, extra: Partial<FunnelField> = {}): FunnelField => ({
  key,
  label,
  description,
  type: 'yesno',
  ...extra,
})

/** Grupo Venda (company 30). Fonte : documentos FLUXO INBOUND, PREÇOS E PLANOS, objeções e ligação, ajustados pelo Bruno. */
export const grupoVendaFunnel: FunnelConfig = {
  version: 1,
  steps: [
    {
      id: 'nome',
      question: 'Olá, tudo bem? Sou a Laura, atendente do Grupo Venda Marketing Digital. Qual o seu nome?',
      clarify: 'Qual o seu nome?',
      fields: [
        {
          key: 'nome',
          label: 'o seu nome',
          type: 'text',
          transform: 'name',
          mustAskDirectly: true,
          description:
            'Nome próprio da PESSOA, do jeito que ela disse (só o primeiro nome ou nome e sobrenome). Nunca o nome de perfil do WhatsApp, nunca o nome da empresa. Vazio se ela não disse o nome.',
        },
      ],
    },
    {
      id: 'negocio',
      question: '{nome}, qual o nome, o ramo e a cidade da sua empresa?',
      partialQuestion: 'E {faltando}?',
      fields: [
        {
          key: 'nome_empresa',
          label: 'o nome da empresa',
          type: 'text',
          required: false,
          description: 'Nome da empresa/negócio. Vazio se não disse.',
        },
        {
          key: 'ramo',
          label: 'o ramo',
          type: 'text',
          description: 'Ramo/segmento do negócio (ex: clínica odontológica, barbearia, loja de roupas).',
        },
        { key: 'cidade', label: 'a cidade', type: 'text', description: 'Cidade onde a empresa atua.' },
      ],
    },
    {
      id: 'perfil_google',
      question: 'Você possui o perfil do Google Meu Negócio criado? Se sim, me manda o link ou um print dele.',
      clarify: 'Você tem o perfil do Google Meu Negócio criado?',
      fields: [
        yesno('tem_gmb', 'o perfil do Google Meu Negócio', 'sim se tem perfil no Google Meu Negócio, nao se não tem. Vazio se não ficou claro.'),
        {
          key: 'gmb_link',
          label: 'o link do perfil',
          type: 'link_or_media',
          required: false,
          description: 'Link do perfil no Google, OU o texto "print enviado" se o lead mandou uma imagem/print do perfil. Vazio se não mandou nada.',
        },
      ],
      followUp: {
        whenField: 'tem_gmb',
        equals: 'sim',
        missingField: 'gmb_link',
        question: 'Consegue me mandar o link ou print do perfil?',
        maxAsks: 1,
      },
    },
    {
      id: 'site',
      question: 'Tem site?',
      fields: [yesno('tem_site', 'site', 'sim se tem site, nao se não tem. Vazio se não ficou claro.')],
    },
    {
      id: 'anuncios',
      question: 'Já fez anúncio no Google ou no Meta?',
      fields: [yesno('fez_anuncio', 'anúncios', 'sim se já fez anúncio pago (Google, Meta, Instagram), nao se nunca fez. Vazio se não ficou claro.')],
    },
    {
      id: 'canal',
      question: 'Hoje, você vive só de indicação e boca a boca?',
      fields: [
        yesno(
          'so_indicacao',
          'como os clientes chegam',
          'sim se vive só de indicação/boca a boca, nao se tem outros canais além da indicação. Vazio se não ficou claro.'
        ),
      ],
    },
    {
      id: 'dor',
      question: 'Quando você procura a sua empresa no Google, ela aparece ou não?',
      fields: [
        yesno(
          'aparece_google',
          'se aparece no Google',
          'sim se a empresa aparece quando procura no Google, nao se não aparece. "Não sei" ou dúvida: vazio.'
        ),
      ],
    },
    {
      id: 'decisor',
      question: 'Você que decide sobre esse tipo de investimento na empresa, ou tem mais alguém envolvido nessa parte?',
      clarify: 'Só pra confirmar: a decisão é sua ou tem mais alguém que participa dela?',
      fields: [
        yesno(
          'decisor',
          'quem decide',
          'sim se a própria pessoa decide sozinha, nao se outra pessoa decide ou participa da decisão (sócio, esposo(a), diretor). Se a resposta não deixa isso claro: vazio.',
          { mustAskDirectly: true }
        ),
      ],
    },
  ],
  // Política (Rodrigo, 2026-09-21): dar um ponto de partida na 1a pergunta, nunca repetir a mesma frase vaga
  // (o lead Marcelo saiu irritado, e 0 de 27 leads que perguntaram preço agendaram). A proposta detalhada
  // continua sendo do Bruno; na 3a pergunta a conversa passa pra ele.
  priceDisclosure: true,
  priceScripts: [
    'Depende do que você precisa: temos planos de R$ 1.125 (só o perfil no Google) até R$ 5.280 (perfil e site completo). E não é mensalidade, é pagamento único. O que você mais precisa hoje?',
    'Os três planos, sempre pagamento único: Google Meu Negócio, R$ 1.125 (perfil criado ou corrigido, categorias, fotos e 4 posts). Essencial, R$ 2.200 (o perfil mais um site de uma página e SEO local). Prime, R$ 5.280 (o perfil mais site completo de até 15 páginas e SEO local avançado). Qual faz mais sentido pra você?',
  ],
  pricePosRoteiro:
    'Depende do plano: de R$ 1.125 (só o perfil no Google) até R$ 5.280 (perfil e site completo), sempre pagamento único. O Bruno mostra na conversa qual serve pro seu caso. Quer que eu veja um horário?',
  priceHandoffAt: 3,
  priceInsistHandoff: 'Vi que isso é importante pra você decidir agora. Deixa eu já chamar o Bruno aqui no WhatsApp pra te passar certinho, um segundo.',
  objections: {
    caro: {
      kind: 'objecao',
      triggers: '"tá caro", "achei o valor alto", "não tenho esse valor agora"',
      scripts: ['Entendi, é um valor que pesa mesmo. Pra você, o principal ponto é o valor ou se faz sentido pro seu negócio agora? Posso detalhar o que está incluso.'],
    },
    sem_dinheiro: {
      kind: 'objecao',
      triggers: '"não tenho esse dinheiro agora", "não consigo pagar agora"',
      scripts: ['Sem problema, o diagnóstico gratuito não exige nenhum orçamento. Quer marcar pra ver juntos o que faria sentido pra você?'],
    },
    retorno: {
      kind: 'objecao',
      triggers: '"não sei se terei retorno imediato", "tô começando agora", "não sei se vale a pena nesse momento" (receio de que o NOSSO resultado demore ou não compense; não vale para reclamação sobre outra empresa)',
      scripts: [
        'Retorno imediato é bem relativo. Nosso trabalho é construir algo consistente, pros resultados virem ao longo do tempo, não da noite pro dia.\nSe alguém prometer retorno imediato pra você, desconfia.',
      ],
    },
    pensar: {
      kind: 'objecao',
      triggers: '"vou pensar", "vou ver", "depois te respondo"',
      scripts: ['Sem pressa, o diagnóstico é gratuito e pode te ajudar a decidir com calma. Quer agendar um horário pra ver juntos?'],
    },
    sem_tempo: {
      kind: 'objecao',
      triggers: '"não tenho tempo pra uma reunião ou call", "não tenho tempo pra isso" (falta de tempo como motivo pra não avançar; avisar que está ocupado agora e responde depois é outra coisa)',
      scripts: ['Tranquilo, posso ajustar pro horário que encaixa melhor na sua rotina. Quer sugerir um dia e horário?'],
    },
    ja_uso: {
      kind: 'objecao',
      triggers: '"já uso outro serviço", "já tenho alguém que faz isso", "já tenho agência", "tem um rapaz que faz meu anúncio" (já tem alguém fazendo, mesmo que reclame dele, por exemplo dizendo que é devagar)',
      scripts: ['Legal, é ótimo já ter algo rodando. Se quiser comparar com o que fazemos, o diagnóstico é sem compromisso. Faz sentido pra você?'],
    },
    nao_sei_se_preciso: {
      kind: 'objecao',
      triggers: '"não sei se preciso disso", "não tenho certeza se é pra mim"',
      scripts: ['Normal ter essa dúvida! O diagnóstico gratuito serve justamente pra ver juntos se faz sentido pro seu caso. Quer agendar?'],
    },
    hesitacao: {
      kind: 'objecao',
      triggers: 'hesita, fica em dúvida ou demonstra insegurança no meio das perguntas, sem recusar nem dizer que não quer',
      scripts: ['Sem problema! O diagnóstico gratuito do seu perfil já te mostra onde pode melhorar, sem compromisso nenhum. Faz sentido pra você?'],
    },
    golpe: {
      kind: 'faq',
      triggers: '"isso é golpe?", "como sei que é confiável?", "não conheço vocês", "qual a razão social?", "tem CNPJ?"',
      scripts: [
        'Super entendo sua preocupação, ainda mais hoje em dia. Nossa razão social é BZ Publicidade e Serviços Botucatu LTDA, CNPJ 47.883.706/0001-02, temos escritório físico em Botucatu-SP e Instagram oficial: @grupovenda. O Bruno, nosso CEO, já tem mais de 7 anos de mercado e mais de 200 clientes atendidos em todo o Brasil.',
      ],
    },
    mensalidade: {
      kind: 'faq',
      triggers: '"tem mensalidade?", "é só uma vez ou todo mês?"',
      scripts: ['Não tem mensalidade obrigatória! É setup único. Depois de 30 dias, você decide se quer continuar com algo mensal.'],
    },
    diferenca_planos: {
      kind: 'faq',
      triggers: '"qual a diferença do Essencial pro Prime?", "o que muda de um plano pro outro?"',
      scripts: [
        'O Essencial monta a base do zero: Google Meu Negócio completo, site one page com SEO local, e 30 dias de ativação com posts semanais.\nO Prime tem tudo isso e mais: site completo de até 15 páginas, SEO local avançado por cidade, e otimização pra buscas por IA (GEO).',
      ],
    },
    como_funciona_diagnostico: {
      kind: 'faq',
      triggers: '"como funciona o diagnóstico?", "o que é esse diagnóstico?"',
      scripts: [
        'É uma conversa com o Bruno, especialista em Google : ele analisa seu perfil e te mostra exatamente o que está travando sua presença e o que precisa ser feito.',
      ],
    },
    serve_pro_meu_negocio: {
      kind: 'faq',
      triggers: '"serve pro meu tipo de negócio?", "funciona pra minha área?"',
      scripts: ['Serve sim! Quer marcar o diagnóstico gratuito pra ver juntos como ficaria pro seu segmento?'],
    },
  },
  maxObjections: 2,
  refusalReply: 'Entendi! 😊 Se mudar de ideia, pode me chamar. Qualquer coisa tô aqui.',
  farewellReply: 'Eu que agradeço! 😊\nQualquer coisa tô aqui.',
  callOffer:
    'Sem problema! Posso te explicar rapidinho por aqui mesmo, ou já te conecto direto com o Bruno, nosso CEO e especialista em Google Meu Negócio aqui do Grupo Venda : ele mesmo te retorna. O que prefere?',
  callConfirm: 'Perfeito! Vou avisar o Bruno agora, ele deve te retornar em breve.',
  deferReply: 'Sem problema, responde com calma. Quando puder, me chama aqui.',
  closingMessage:
    'Perfeito, {nome}! O próximo passo é uma conversa de diagnóstico com o Bruno, nosso especialista em Google. Ele analisa a presença da sua empresa no Google e mostra o que está travando os resultados.',
  unknownAnswer: 'Isso o Bruno explica direitinho na reunião, olhando o seu caso específico.',
  handoff: {
    waitMessage: 'Vou chamar o Bruno aqui no WhatsApp pra continuar com você, um segundo.',
  },
}

/**
 * Modelo genérico pra empresa nova : o cliente (ou o wizard) troca os textos.
 * Serve de ponto de partida, nunca vai pro ar sem o cliente revisar.
 */
export function genericFunnelTemplate(p: { agentName: string; companyName: string; humanName: string }): FunnelConfig {
  return {
    version: 1,
    steps: [
      {
        id: 'nome',
        question: `Olá, tudo bem? Sou ${p.agentName}, atendente da ${p.companyName}. Qual o seu nome?`,
        clarify: 'Qual o seu nome?',
        fields: [
          {
            key: 'nome',
            label: 'o seu nome',
            type: 'text',
            transform: 'name',
            mustAskDirectly: true,
            description: 'Nome próprio da PESSOA, do jeito que ela disse. Nunca o nome de perfil do WhatsApp nem o da empresa. Vazio se ela não disse.',
          },
        ],
      },
      {
        id: 'necessidade',
        question: '{nome}, o que você está buscando resolver hoje?',
        fields: [
          {
            key: 'necessidade',
            label: 'o que você busca resolver',
            type: 'text',
            description: 'O que o lead quer resolver ou contratar, com as palavras dele, resumido.',
          },
        ],
      },
      {
        id: 'decisor',
        question: 'Você que decide sobre isso, ou tem mais alguém envolvido?',
        clarify: 'Só pra confirmar: a decisão é sua ou tem mais alguém que participa dela?',
        fields: [
          yesno(
            'decisor',
            'quem decide',
            'sim se a própria pessoa decide sozinha, nao se outra pessoa decide ou participa. Se não ficou claro: vazio.',
            { mustAskDirectly: true }
          ),
        ],
      },
    ],
    priceScripts: [`Os valores ${p.humanName} passa certinho na conversa, já adaptado pro seu caso.`],
    priceHandoffAt: 2,
    priceInsistHandoff: `Vi que isso é importante pra você. Deixa eu já chamar ${p.humanName} aqui no WhatsApp pra te passar certinho, um segundo.`,
    objections: {},
    maxObjections: 2,
    refusalReply: 'Entendi! Se mudar de ideia, pode me chamar. Qualquer coisa tô aqui.',
    farewellReply: 'Eu que agradeço! Qualquer coisa tô aqui.',
    deferReply: 'Sem problema, responde com calma. Quando puder, me chama aqui.',
    unknownAnswer: `Isso ${p.humanName} explica direitinho na conversa, olhando o seu caso.`,
    handoff: { waitMessage: `Vou chamar ${p.humanName} aqui no WhatsApp pra continuar com você, um segundo.` },
  }
}
