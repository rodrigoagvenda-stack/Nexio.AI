/**
 * Tipos TypeScript gerados a partir do schema do Supabase
 * Sistema de Gestão para Igrejas
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// =============================================
// ENUMS
// =============================================

export type UserRole = 'admin' | 'pastor' | 'tesoureiro' | 'secretaria' | 'lider_ministerio'
export type IgrejaTipo = 'sede' | 'congregacao'
export type MembroStatus = 'ativo' | 'inativo' | 'visitante'
export type EstadoCivil = 'solteiro' | 'casado' | 'viuvo' | 'divorciado'
export type Sexo = 'M' | 'F'
export type MembroFuncao = 'oracao' | 'louvor' | 'pregacao' | 'som' | 'recepcao' | 'midia' | 'infantil'
export type NivelExperiencia = 'iniciante' | 'intermediario' | 'avancado'
export type EscalaStatus = 'rascunho' | 'confirmando' | 'finalizada' | 'enviada'
export type StatusConfirmacao = 'pendente' | 'confirmado' | 'recusado'
export type TipoTransacao = 'entrada' | 'saida'
export type FormaPagamento = 'dinheiro' | 'pix' | 'transferencia' | 'debito' | 'credito' | 'boleto' | 'cheque'
export type StatusLancamento = 'efetivado' | 'pendente' | 'agendado' | 'cancelado'
export type TipoConta = 'corrente' | 'poupanca' | 'caixa'
export type TipoMensagem = 'individual' | 'grupo' | 'massa'
export type StatusMensagem = 'rascunho' | 'enviando' | 'enviado' | 'falhou'
export type CategoriaPedido = 'saude' | 'familia' | 'financeiro' | 'trabalho' | 'espiritual' | 'outro'
export type StatusPedido = 'ativo' | 'respondido' | 'cancelado'
export type PrivacidadePedido = 'publico' | 'lideranca'
export type AcaoAudit = 'INSERT' | 'UPDATE' | 'DELETE'

// =============================================
// DATABASE TABLES
// =============================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      igrejas: {
        Row: Igreja
        Insert: IgrejaInsert
        Update: IgrejaUpdate
      }
      cultos_regulares: {
        Row: CultoRegular
        Insert: CultoRegularInsert
        Update: CultoRegularUpdate
      }
      membros: {
        Row: Membro
        Insert: MembroInsert
        Update: MembroUpdate
      }
      membros_funcoes: {
        Row: MembroFuncao
        Insert: MembroFuncaoInsert
        Update: MembroFuncaoUpdate
      }
      ministerios: {
        Row: Ministerio
        Insert: MinisterioInsert
        Update: MinisterioUpdate
      }
      ministerios_membros: {
        Row: MinisterioMembro
        Insert: MinisterioMembroInsert
        Update: MinisterioMembroUpdate
      }
      escalas: {
        Row: Escala
        Insert: EscalaInsert
        Update: EscalaUpdate
      }
      escalas_detalhes: {
        Row: EscalaDetalhe
        Insert: EscalaDetalheInsert
        Update: EscalaDetalheUpdate
      }
      frequencias: {
        Row: Frequencia
        Insert: FrequenciaInsert
        Update: FrequenciaUpdate
      }
      categorias_financeiras: {
        Row: CategoriaFinanceira
        Insert: CategoriaFinanceiraInsert
        Update: CategoriaFinanceiraUpdate
      }
      contas_bancarias: {
        Row: ContaBancaria
        Insert: ContaBancariaInsert
        Update: ContaBancariaUpdate
      }
      lancamentos_financeiros: {
        Row: LancamentoFinanceiro
        Insert: LancamentoFinanceiroInsert
        Update: LancamentoFinanceiroUpdate
      }
      despesas_recorrentes: {
        Row: DespesaRecorrente
        Insert: DespesaRecorrenteInsert
        Update: DespesaRecorrenteUpdate
      }
      orcamento: {
        Row: Orcamento
        Insert: OrcamentoInsert
        Update: OrcamentoUpdate
      }
      eventos: {
        Row: Evento
        Insert: EventoInsert
        Update: EventoUpdate
      }
      eventos_inscricoes: {
        Row: EventoInscricao
        Insert: EventoInscricaoInsert
        Update: EventoInscricaoUpdate
      }
      mensagens: {
        Row: Mensagem
        Insert: MensagemInsert
        Update: MensagemUpdate
      }
      pedidos_oracao: {
        Row: PedidoOracao
        Insert: PedidoOracaoInsert
        Update: PedidoOracaoUpdate
      }
      audit_logs: {
        Row: AuditLog
        Insert: AuditLogInsert
        Update: AuditLogUpdate
      }
    }
    Views: {
      vw_membros_completo: {
        Row: MembroCompleto
      }
      vw_financeiro_mensal: {
        Row: FinanceiroMensal
      }
      vw_frequencia_membros: {
        Row: FrequenciaMembro
      }
    }
    Functions: {
      buscar_membros_disponiveis: {
        Args: {
          p_funcao: string
          p_data_culto: string
          p_igreja_id: string
          p_excluir_ids?: string[]
        }
        Returns: MembroDisponivel[]
      }
      gerar_escala_automatica: {
        Args: {
          p_mes: number
          p_ano: number
          p_igreja_id: string
          p_created_by: string
        }
        Returns: string
      }
      reescalar_membro: {
        Args: {
          p_detalhe_escala_id: string
          p_funcao: string
        }
        Returns: string
      }
      estatisticas_financeiras: {
        Args: {
          p_igreja_id: string
          p_data_inicio: string
          p_data_fim: string
        }
        Returns: EstatisticasFinanceiras[]
      }
      gerar_lancamentos_recorrentes: {
        Args: {
          p_mes: number
          p_ano: number
        }
        Returns: number
      }
      calcular_frequencia_membro: {
        Args: {
          p_membro_id: string
          p_data_inicio: string
          p_data_fim: string
        }
        Returns: FrequenciaCalculada[]
      }
    }
  }
}

// =============================================
// TYPE DEFINITIONS
// =============================================

// Profile
export interface Profile {
  id: string
  email: string
  nome: string
  role: UserRole
  igreja_id: string | null
  telefone: string | null
  foto_url: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>
export type ProfileUpdate = Partial<ProfileInsert>

// Igreja
export interface Endereco {
  rua?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
}

export interface Igreja {
  id: string
  nome: string
  tipo: IgrejaTipo
  endereco: Endereco | null
  responsavel_id: string | null
  telefone: string | null
  email: string | null
  capacidade: number | null
  logo_url: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type IgrejaInsert = Omit<Igreja, 'id' | 'created_at' | 'updated_at'>
export type IgrejaUpdate = Partial<IgrejaInsert>

// Culto Regular
export interface CultoRegular {
  id: string
  igreja_id: string
  nome: string
  dia_semana: number // 0=domingo, 6=sábado
  horario: string
  tipo: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type CultoRegularInsert = Omit<CultoRegular, 'id' | 'created_at' | 'updated_at'>
export type CultoRegularUpdate = Partial<CultoRegularInsert>

// Membro
export interface MembroDisponibilidade {
  dias: number[]
  horarios: string[]
}

export interface Membro {
  id: string
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
  data_nascimento: string | null
  sexo: Sexo | null
  endereco: Endereco | null
  estado_civil: EstadoCivil | null
  foto_url: string | null
  cargo: string | null
  dizimista: boolean
  igreja_id: string
  data_batismo: string | null
  data_entrada: string
  status: MembroStatus
  disponibilidade: MembroDisponibilidade | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export type MembroInsert = Omit<Membro, 'id' | 'created_at' | 'updated_at'>
export type MembroUpdate = Partial<MembroInsert>

// Membro Função
export interface MembroFuncaoType {
  id: string
  membro_id: string
  funcao: MembroFuncao
  nivel: NivelExperiencia | null
  ativo: boolean
  created_at: string
}

export type MembroFuncaoInsert = Omit<MembroFuncaoType, 'id' | 'created_at'>
export type MembroFuncaoUpdate = Partial<MembroFuncaoInsert>

// Ministério
export interface Ministerio {
  id: string
  nome: string
  descricao: string | null
  lider_id: string | null
  igreja_id: string
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type MinisterioInsert = Omit<Ministerio, 'id' | 'created_at' | 'updated_at'>
export type MinisterioUpdate = Partial<MinisterioInsert>

// Ministério Membro
export interface MinisterioMembro {
  id: string
  ministerio_id: string
  membro_id: string
  funcao: string | null
  data_entrada: string
  ativo: boolean
  created_at: string
}

export type MinisterioMembroInsert = Omit<MinisterioMembro, 'id' | 'created_at'>
export type MinisterioMembroUpdate = Partial<MinisterioMembroInsert>

// Escala
export interface Escala {
  id: string
  mes: number
  ano: number
  igreja_id: string
  status: EscalaStatus
  pdf_url: string | null
  data_geracao: string
  data_finalizacao: string | null
  data_envio: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type EscalaInsert = Omit<Escala, 'id' | 'created_at' | 'updated_at'>
export type EscalaUpdate = Partial<EscalaInsert>

// Escala Detalhe
export interface EscalaDetalhe {
  id: string
  escala_id: string
  data_culto: string
  dia_semana: number
  horario: string
  tipo_culto: string | null
  membro_oracao_id: string | null
  membro_louvor_id: string | null
  membro_pregacao_id: string | null
  membro_som_id: string | null
  membro_recepcao_id: string | null
  membro_midia_id: string | null
  membro_infantil_id: string | null
  status_confirmacao_oracao: StatusConfirmacao
  status_confirmacao_louvor: StatusConfirmacao
  status_confirmacao_pregacao: StatusConfirmacao
  status_confirmacao_som: StatusConfirmacao
  status_confirmacao_recepcao: StatusConfirmacao
  status_confirmacao_midia: StatusConfirmacao
  status_confirmacao_infantil: StatusConfirmacao
  observacoes: string | null
  created_at: string
  updated_at: string
}

export type EscalaDetalheInsert = Omit<EscalaDetalhe, 'id' | 'created_at' | 'updated_at'>
export type EscalaDetalheUpdate = Partial<EscalaDetalheInsert>

// Frequência
export interface Frequencia {
  id: string
  membro_id: string
  igreja_id: string
  data: string
  tipo_culto: string | null
  presente: boolean
  created_by: string | null
  created_at: string
}

export type FrequenciaInsert = Omit<Frequencia, 'id' | 'created_at'>
export type FrequenciaUpdate = Partial<FrequenciaInsert>

// Categoria Financeira
export interface CategoriaFinanceira {
  id: string
  nome: string
  tipo: TipoTransacao
  cor: string
  icone: string | null
  descricao: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type CategoriaFinanceiraInsert = Omit<CategoriaFinanceira, 'id' | 'created_at' | 'updated_at'>
export type CategoriaFinanceiraUpdate = Partial<CategoriaFinanceiraInsert>

// Conta Bancária
export interface ContaBancaria {
  id: string
  nome: string
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo: TipoConta
  saldo_inicial: number
  saldo_atual: number
  igreja_id: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ContaBancariaInsert = Omit<ContaBancaria, 'id' | 'created_at' | 'updated_at'>
export type ContaBancariaUpdate = Partial<ContaBancariaInsert>

// Lançamento Financeiro
export interface LancamentoFinanceiro {
  id: string
  data: string
  tipo: TipoTransacao
  categoria_id: string
  valor: number
  forma_pagamento: FormaPagamento
  conta_bancaria_id: string | null
  igreja_id: string
  membro_id: string | null
  fornecedor: string | null
  descricao: string
  comprovante_url: string | null
  status: StatusLancamento
  data_vencimento: string | null
  data_pagamento: string | null
  parcelado: boolean
  numero_parcelas: number | null
  parcela_atual: number | null
  lancamento_pai_id: string | null
  recorrente: boolean
  conciliado: boolean
  data_conciliacao: string | null
  observacoes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type LancamentoFinanceiroInsert = Omit<LancamentoFinanceiro, 'id' | 'created_at' | 'updated_at'>
export type LancamentoFinanceiroUpdate = Partial<LancamentoFinanceiroInsert>

// Despesa Recorrente
export interface DespesaRecorrente {
  id: string
  nome: string
  categoria_id: string
  valor: number
  dia_vencimento: number
  conta_bancaria_id: string | null
  fornecedor: string | null
  igreja_id: string
  ativo: boolean
  data_inicio: string
  data_fim: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export type DespesaRecorrenteInsert = Omit<DespesaRecorrente, 'id' | 'created_at' | 'updated_at'>
export type DespesaRecorrenteUpdate = Partial<DespesaRecorrenteInsert>

// Orçamento
export interface Orcamento {
  id: string
  ano: number
  mes: number
  igreja_id: string
  categoria_id: string
  valor_previsto: number
  observacoes: string | null
  created_at: string
  updated_at: string
}

export type OrcamentoInsert = Omit<Orcamento, 'id' | 'created_at' | 'updated_at'>
export type OrcamentoUpdate = Partial<OrcamentoInsert>

// Evento
export interface Evento {
  id: string
  nome: string
  tipo: string | null
  descricao: string | null
  local: string | null
  data_inicio: string
  data_fim: string | null
  hora_inicio: string | null
  hora_fim: string | null
  responsavel_id: string | null
  igreja_id: string
  valor_inscricao: number
  capacidade: number | null
  inscricoes_abertas: boolean
  imagem_url: string | null
  created_at: string
  updated_at: string
}

export type EventoInsert = Omit<Evento, 'id' | 'created_at' | 'updated_at'>
export type EventoUpdate = Partial<EventoInsert>

// Evento Inscrição
export interface EventoInscricao {
  id: string
  evento_id: string
  membro_id: string
  data_inscricao: string
  pago: boolean
  data_pagamento: string | null
  valor_pago: number | null
  presente: boolean
  observacoes: string | null
  created_at: string
}

export type EventoInscricaoInsert = Omit<EventoInscricao, 'id' | 'created_at'>
export type EventoInscricaoUpdate = Partial<EventoInscricaoInsert>

// Mensagem
export interface MensagemSegmentacao {
  igreja_id?: string
  ministerio_id?: string
  cargo?: string
  status?: MembroStatus
  dizimista?: boolean
}

export interface Mensagem {
  id: string
  tipo: TipoMensagem
  destinatarios: string[] | null
  segmentacao: MensagemSegmentacao | null
  assunto: string | null
  mensagem: string
  status: StatusMensagem
  total_destinatarios: number | null
  total_enviados: number
  total_falhas: number
  data_envio: string | null
  enviado_por: string
  created_at: string
  updated_at: string
}

export type MensagemInsert = Omit<Mensagem, 'id' | 'created_at' | 'updated_at'>
export type MensagemUpdate = Partial<MensagemInsert>

// Pedido de Oração
export interface PedidoOracao {
  id: string
  membro_id: string
  titulo: string
  descricao: string
  categoria: CategoriaPedido | null
  status: StatusPedido
  privacidade: PrivacidadePedido
  data_pedido: string
  data_resposta: string | null
  testemunho: string | null
  created_at: string
  updated_at: string
}

export type PedidoOracaoInsert = Omit<PedidoOracao, 'id' | 'created_at' | 'updated_at'>
export type PedidoOracaoUpdate = Partial<PedidoOracaoInsert>

// Audit Log
export interface AuditLog {
  id: string
  tabela: string
  registro_id: string | null
  acao: AcaoAudit
  dados_antigos: Json | null
  dados_novos: Json | null
  usuario_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type AuditLogInsert = Omit<AuditLog, 'id' | 'created_at'>
export type AuditLogUpdate = Partial<AuditLogInsert>

// =============================================
// VIEW TYPES
// =============================================

export interface MembroCompleto extends Membro {
  igreja_nome: string
  igreja_tipo: IgrejaTipo
  funcoes: Array<{ funcao: MembroFuncao; nivel: NivelExperiencia | null }>
}

export interface FinanceiroMensal {
  igreja_id: string
  ano: number
  mes: number
  tipo: TipoTransacao
  total: number
  quantidade: number
}

export interface FrequenciaMembro {
  membro_id: string
  nome: string
  igreja_id: string
  total_presencas: number
  presencas: number
  faltas: number
  percentual_presenca: number
}

// =============================================
// FUNCTION RETURN TYPES
// =============================================

export interface MembroDisponivel {
  membro_id: string
  nome: string
  nivel: NivelExperiencia | null
  ultima_escalacao: string | null
  total_escalacoes_mes: number
}

export interface EstatisticasFinanceiras {
  total_entradas: number
  total_saidas: number
  saldo: number
  total_dizimos: number
  total_ofertas: number
  categoria_maior_gasto: string | null
  valor_maior_gasto: number | null
}

export interface FrequenciaCalculada {
  total_cultos: number
  presencas: number
  faltas: number
  percentual: number
}

// =============================================
// API RESPONSE TYPES
// =============================================

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
