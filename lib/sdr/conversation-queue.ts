/**
 * Fila por conversa: UM turno do SDR por vez em cada conversa. Função pura (sem banco, sem rede).
 *
 * Achado ao vivo 2026-09-21 (lead Willyman): o lead escreveu enquanto o SDR ainda respondia à mensagem
 * anterior. O buffer de 30s soltou o lote novo na hora e dois turnos rodaram ao mesmo tempo na mesma
 * conversa: o orquestrador prometia "já retorno com as opções" enquanto o funil perguntava "quer que eu
 * veja um horário?", e um turno podia ler o estado antes de o outro gravar. Com a fila, o lote novo
 * espera o turno em andamento terminar (o job continua PENDING no banco e sai no ciclo seguinte, já
 * lendo o estado e a conversa atualizados).
 */
export interface QueueJob {
  company_id: number
  phone: string
}

export function conversationKey(companyId: number, phone: string): string {
  return `${companyId}:${phone}`
}

export class ConversationQueue {
  private readonly busy = new Set<string>()

  /** Reserva a conversa. false = já tem um turno rodando nela (o chamador espera o próximo ciclo). */
  tryAcquire(key: string): boolean {
    if (this.busy.has(key)) return false
    this.busy.add(key)
    return true
  }

  release(key: string): void {
    this.busy.delete(key)
  }

  isBusy(key: string): boolean {
    return this.busy.has(key)
  }

  /** Dos jobs prontos, só os que podem rodar agora: conversa livre e no máximo um por conversa. Ordem preservada. */
  pickRunnable<T extends QueueJob>(jobs: T[]): T[] {
    const seen = new Set<string>()
    const out: T[] = []
    for (const j of jobs) {
      const key = conversationKey(j.company_id, j.phone)
      if (this.busy.has(key) || seen.has(key)) continue
      seen.add(key)
      out.push(j)
    }
    return out
  }
}
