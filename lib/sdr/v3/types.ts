/** SDR v3: tipos do pipeline do turno (spec seções 3, 4 e 8). */

export type Intencao =
  | 'social'
  | 'pede_espera'
  | 'resposta_qualificacao'
  | 'pergunta_preco'
  | 'objecao'
  | 'pergunta_fato'
  | 'quer_agendar'
  | 'escolheu_horario'
  | 'informou_email'
  | 'pede_ligacao'
  | 'pede_humano'
  | 'pergunta_se_e_robo'
  | 'recusa'
  | 'fora_do_escopo'
  | 'pede_pagamento'
  | 'outro'

export const INTENCOES: Intencao[] = [
  'social', 'pede_espera', 'resposta_qualificacao', 'pergunta_preco', 'objecao', 'pergunta_fato', 'quer_agendar',
  'escolheu_horario', 'informou_email', 'pede_ligacao', 'pede_humano', 'pergunta_se_e_robo', 'recusa',
  'fora_do_escopo', 'pede_pagamento', 'outro',
]

export type SocialTipo = 'cumprimento' | 'retribuicao_pedida' | 'agradecimento' | 'desabafo' | 'humor' | 'elogio' | 'reclamacao'
export type TomLead = 'curto_informal' | 'informal' | 'formal'

export interface Social {
  tipo: SocialTipo
  texto_do_lead: string
}

export interface Extracao {
  intencoes: Intencao[]
  social: Social | null
  objecao_id: string | null
  pergunta_fato: string | null
  /** Só o que o lead disse. Chaves: campos da qualificação + nome, segmento, cidade, email, disponibilidade, cpf_cnpj. */
  dados: Record<string, string>
  /** Data e hora escolhidas pelo lead, ISO 8601 sem fuso (ex.: 2026-09-30T14:00:00), quando escolheu horário. */
  horario_escolhido: string | null
  tom_do_lead: TomLead
  confianca: 'alta' | 'media' | 'baixa'
  resposta_automatica: boolean
}

export type Etapa = 'abertura' | 'qualificando' | 'oferta_horario' | 'confirmando' | 'agendado' | 'escalado' | 'encerrado'

export interface PerguntaFeita {
  id: string
  turno: number
  respondida: boolean
}

export interface Contadores {
  outros_seguidos: number
  baixa_confianca_seguidas: number
  horarios_ofertados: boolean
  ultimo_id_perguntado: string | null
  ligacao_oferecida: boolean
}

export interface Estado {
  etapa: Etapa
  dados: Record<string, string>
  perguntas_feitas: PerguntaFeita[]
  pedidos_de_preco: number
  recusas: number
  objecoes_respondidas: string[]
  frases_enviadas: string[]
  ultima_reacao_social_turno: number
  turno: number
  config_version: number
  contadores: Contadores
}

export type AcaoTipo =
  | 'escalar'
  | 'escalar_duvida'
  | 'responder_identidade'
  | 'responder_fora_escopo'
  | 'responder_preco'
  | 'responder_objecao'
  | 'objecao_repetida'
  | 'encerrar'
  | 'oferecer_ligacao'
  | 'responder_fato'
  | 'oferecer_horarios'
  | 'pedir_dados_agendamento'
  | 'confirmar_horario'
  | 'agendar'
  | 'aguardar'
  | 'gerar_cobranca'
  | 'agradecimento_fim'
  | 'perguntar'

export interface Acao {
  tipo: AcaoTipo
  reacao_social: boolean
  social: Social | null
  conteudo: { modo: 'literal' | 'livre'; texto: string | string[] } | null
  fatos: { id: string; texto: string }[]
  proxima_pergunta: { id: string; texto: string } | null
  tom_do_lead: TomLead
  /** Contexto extra para o redator (origem do lead, análise de perfil, palpite de nome). */
  contexto: string[]
  /** Etapa em que a conversa fica depois desta ação. */
  etapa_depois: Etapa
  /** Pede pausa/handoff depois do envio. */
  handoff?: { motivo: string }
  /** Consulta de RAG que o código precisa fazer antes do redator (só responder_fato). */
  consulta_rag?: string
  /** Bloco literal já pronto (ex.: horários do calendário, link de cobrança): o redator não altera. */
  bloco_fixo?: string
}

export const ESTADO_INICIAL = (configVersion: number): Estado => ({
  etapa: 'abertura',
  dados: {},
  perguntas_feitas: [],
  pedidos_de_preco: 0,
  recusas: 0,
  objecoes_respondidas: [],
  frases_enviadas: [],
  ultima_reacao_social_turno: 0,
  turno: 0,
  config_version: configVersion,
  contadores: { outros_seguidos: 0, baixa_confianca_seguidas: 0, horarios_ofertados: false, ultimo_id_perguntado: null, ligacao_oferecida: false },
})
