/**
 * SDR v3: configuração por empresa (spec "SDR v3", seção 7). O código é um só; o comportamento de cada empresa é dado.
 * Guardada versionada em `sdr_company_configs`. Extensões em relação à spec estão marcadas com "EXTENSÃO".
 */

export type ProximaAcaoObjecao = 'aguardar' | 'voltar_qualificacao' | 'encerrar' | 'escalar'
export type ModoTexto = 'literal' | 'livre'

export interface PerguntaQualificacao {
  id: string
  /** EXTENSÃO: nome de exibição (ex.: "Quem decide"). Sem isso, a tela usa o `id` humanizado. */
  titulo?: string
  /** Texto de referência. Aceita {nome}, {segmento}, {cidade}, {ramo}, {nome_empresa}. */
  texto: string
  /** Campo de `dados` que esta pergunta preenche. */
  campo: string
  obrigatoria: boolean
  ordem: number
  /** EXTENSÃO: texto fixo usado quando a pergunta é refeita porque o lead não respondeu direito.
   * Sem isso, o motor reformula sozinho com outras palavras. */
  reformulacao?: string
  /** EXTENSÃO: dá ao extrator uma dica de como formatar o que guarda em `campo` (sem isso, texto livre). */
  campo_tipo?: 'texto' | 'sim_nao' | 'link_ou_print'
  /** EXTENSÃO: rótulo do campo principal no card "O que o agente guarda no lead". Sem isso, usa o próprio `campo`. */
  campo_label?: string
  /** EXTENSÃO: descrição do campo principal, mostrada no card. */
  campo_descricao?: string
  /** EXTENSÃO: outros dados que a mesma pergunta também preenche (ex.: "confirma decisor" junto com "nome do decisor"). */
  campos_extra?: { campo: string; label: string; tipo: 'texto' | 'sim_nao' | 'link_ou_print'; descricao?: string; opcional?: boolean }[]
  /** EXTENSÃO: trava de orçamento por resposta fechada. Quando a resposta desta pergunta (campo_tipo 'sim_nao') vem
   * "não" pela primeira vez, a conversa encerra na hora com esta frase, em vez de seguir qualificando um lead que já
   * disse que não cabe no bolso. Só dispara no turno em que o campo é preenchido com "não": nunca reabre sozinho
   * depois, mesmo que o lead volte a falar. Resposta ambígua ("não sei", "talvez") não conta como "não": fica
   * pendente, igual qualquer obrigatória. Pra perguntar orçamento sem ancorar um valor, use `valor_minimo_aceitavel`
   * em vez deste campo: pergunta aberta, só corta quando o PRÓPRIO lead diz um número. */
  encerrar_se_nao?: string
  /** EXTENSÃO: trava de orçamento sem ancoragem (achado real, Rodrigo 30/09/2026: nenhum lead que recebeu o preço
   * puxado primeiro agendou; os que disseram que não tinham dinheiro foram os que ELES MESMOS deram um número, sem
   * a empresa jogar o valor primeiro). A pergunta desta pergunta fica em aberto ("você tem orçamento reservado?"),
   * sem falar valor. Só encerra quando o próprio lead cita um número na resposta E esse número é menor que `minimo`:
   * "sim, tenho", "ainda não pensei" ou qualquer resposta sem número claro seguem o fluxo normal, nunca cortam. */
  valor_minimo_aceitavel?: { minimo: number; frase_recusa: string }
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
