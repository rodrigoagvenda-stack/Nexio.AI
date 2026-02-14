/**
 * 🔄 Database Reconnect Utility
 *
 * Detecta erros de conexão com Supabase/Postgres e tenta reconectar automaticamente.
 * Ideal para VPS/Easypanel onde conexões podem cair após inatividade.
 *
 * Uso:
 *   const data = await withDatabaseReconnect(async () => {
 *     const supabase = createClient()
 *     const { data, error } = await supabase.from('leads').select('*')
 *     if (error) throw error
 *     return data
 *   })
 */

const CONNECTION_ERROR_PATTERNS = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EPIPE',
  'fetch failed',
  'network error',
  'socket hang up',
  'connection terminated',
  'connection refused',
  'timeout',
  'abort',
  'Failed to fetch',
  'getaddrinfo',
  'connect EHOSTUNREACH',
  'read ECONNRESET',
  'Client network socket disconnected',
]

function isConnectionError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase()

  return CONNECTION_ERROR_PATTERNS.some(pattern =>
    message.includes(pattern.toLowerCase())
  )
}

interface ReconnectOptions {
  maxRetries?: number
  baseDelayMs?: number
  onRetry?: (attempt: number, error: unknown) => void
}

export async function withDatabaseReconnect<T>(
  operation: () => Promise<T>,
  options: ReconnectOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (!isConnectionError(error)) {
        throw error
      }

      if (attempt > maxRetries) {
        console.error(
          `[DB Reconnect] Falhou após ${maxRetries} tentativas:`,
          error instanceof Error ? error.message : error
        )
        throw error
      }

      const delay = baseDelayMs * attempt
      console.warn(
        `[DB Reconnect] Tentativa ${attempt}/${maxRetries} falhou. ` +
        `Reconectando em ${delay}ms...`,
        error instanceof Error ? error.message : error
      )

      if (onRetry) {
        onRetry(attempt, error)
      }

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
