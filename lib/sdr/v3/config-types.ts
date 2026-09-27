/**
 * SDR v3: configuração por empresa (spec "SDR v3", seção 7). O código é um só; o comportamento de cada empresa é dado.
 * Guardada versionada em `sdr_company_configs`. Extensões em relação à spec estão marcadas com "EXTENSÃO".
 */

export type ProximaAcaoObjecao = 'aguardar' | 'voltar_qualificacao' | 'encerrar' | 'escalar'
export type ModoTexto = 'literal' | 'livre'

export interface PerguntaQualificacao {
  id: string
  /** Texto de referência. Aceita {nome}, {segmento}, {cidade}, {ramo}, {nome_empresa}. */
  texto: string
  /** Campo de `dados` que esta pergunta preenche. */
  campo: string
  obrigatoria: boolean
  ordem: number
}

export interface ObjecaoConfig {
  id: string
  titulo: string
  /** Exemplos de fala do lead, usados pelo extrator para classificar. */
  gatilhos: string[]
  modo: ModoTexto
  resposta: string | string[]
  /** EXTENSÃO: resposta alternativa quando ainda falta um dado (ex.: segmento desconhecido). */
  resposta_sem_dado?: { campo: string; resposta: string | string[] }
  proxima_acao: ProximaAcaoObjecao
  conta_como_recusa: boolean
  prioridade: number
}

/**
 * EXTENSÃO: preço decidido pelo que o lead precisa. O valor sai SEMPRE como texto fixo da config (nunca escrito pela IA).
 * Sem o escopo conhecido, o agente pergunta antes de falar valor.
 */
export interface PrecoPorEscopo {
  /** Campo de `dados` que guarda o escopo (o extrator só aceita um dos `valor` abaixo). */
  campo: string
  /** Pergunta que descobre o escopo. Uma pergunta só. */
  pergunta: string
  opcoes: { valor: string; /** como o extrator reconhece este escopo */ descricao: string; /** texto fixo do valor; cada item é um bloco */ texto: string | string[] }[]
}

export interface CompanyConfig {
  version: number
  persona: { nome_agente: string; empresa: string; tom: string; assinatura_humano: string }
  qualificacao: { perguntas: PerguntaQualificacao[] }
  objecoes: ObjecaoConfig[]
  preco: {
    pode_informar: boolean
    frases_antes_qualificacao: string[]
    frase_depois_qualificacao: string
    escalar_apos: number
    /** EXTENSÃO: só vale com pode_informar true. */
    por_escopo?: PrecoPorEscopo
  }
  /** EXTENSÃO: resposta fixa para "como funciona?". Cada item é um bloco; a pergunta de escopo (preco.por_escopo) é acrescentada no fim quando o escopo ainda não é conhecido. */
  como_funciona?: { texto: string | string[] }
  limites: {
    recusas_para_encerrar: number
    /** EXTENSÃO: máximo de frases por mensagem (regra do dono). */
    max_frases_por_mensagem?: number
  }
  escala: { frase: string; frase_duvida: string; nome_humano: string }
  identidade: { frase_robo: string; modo?: ModoTexto }
  fora_escopo: { frase: string }
  palavras_proibidas: string[]
  agendamento: { ativo: boolean; calendario_id?: string }
  /** EXTENSÃO: pedido de ligação. */
  ligacao?: {
    oferta: string
    confirmacao: string
    /** Fato da empresa (não regra geral): como funciona quando quem JÁ tem reunião marcada pergunta sobre
     * ligação (ex.: na Grupo Venda o Bruno liga direto no WhatsApp). Sem isso, só confirma a reunião existente. */
    reuniao_e_ligacao?: string
  }
  /** EXTENSÃO: resposta única ao agradecimento depois de encerrar. */
  agradecimento_fim?: { frase: string }
  /** EXTENSÃO: fatos da empresa (planos, dados, cobrança). Nesta fase ficam na config, não em `documents`. */
  fatos?: { id: string; titulo: string; texto: string; /** só entra no contexto quando o lead pergunta sobre o assunto */ so_quando_perguntado?: boolean }[]
  /** EXTENSÃO: o que dizer quando o lead traz de novo uma objeção já respondida (oferece chamar o humano). */
  objecao_repetida?: { frase: string }
  /** EXTENSÃO: encerramento depois do limite de recusas. */
  encerramento_recusas?: { frase: string }
  /** EXTENSÃO: lista que o VALIDADOR confere na saída (não vai como instrução ao redator). */
  nunca_prometer?: string[]
  /** EXTENSÃO: SÓ ESTILO (tom, tamanho, jeito de escrever). Preço, promessa e agendamento nunca ficam aqui: a validação bloqueia. */
  regras_redator?: string[]
  /** EXTENSÃO: cobrança pelo Asaas quando o lead pede pagamento. Sem isso (ou sem Asaas ativo) o pedido de pagamento escala para a pessoa. */
  cobranca?: { ativo: boolean; valor?: number; descricao?: string }
  /** EXTENSÃO: regras de negócio conferidas em código pelo validador, no lugar de prosa que a IA pode ignorar. */
  validador?: {
    terminologia?: { evitar: string; usar: string; excecao?: string }[]
    /** Nunca falar só "nosso especialista": sempre nomear `escala.nome_humano`. */
    nomear_humano?: boolean
    /** Assuntos que a empresa atende; o resto cai em `fora_escopo`. */
    escopo_permitido?: string[]
    /** V6 (fato fora da fonte) e V7 (vício de IA) começam só registrando; ligue aqui depois de medir o falso positivo. */
    bloquear_v6_v7?: boolean
  }
}

/** Acima disso a config vira contexto pesado a cada turno: o que for longo vai para o RAG. */
export const FATOS_AVISO_CHARS = 4000
export const FATOS_MAX_CHARS = 16000

export const PLACEHOLDERS_VALIDOS = ['nome', 'segmento', 'cidade', 'ramo', 'nome_empresa', 'nome_humano'] as const
