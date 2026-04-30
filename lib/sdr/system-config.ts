import { createServiceClient } from '@/lib/supabase/server'

let cache: Map<string, string> | null = null
let cacheAt = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

/**
 * Lê uma chave da tabela system_config.
 * Cache em memória de 5 min para evitar round-trips em cada mensagem.
 * Retorna null se a chave não existir ou o valor estiver vazio.
 */
export async function getSystemConfig(key: string): Promise<string | null> {
  const now = Date.now()

  if (!cache || now - cacheAt > CACHE_TTL) {
    try {
      const supabase = createServiceClient()
      const { data } = await supabase.from('system_config').select('key, value')
      cache = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
      cacheAt = now
    } catch {
      cache = cache ?? new Map()
    }
  }

  const val = cache.get(key)
  return val && val.trim() ? val.trim() : null
}

/** Invalida o cache imediatamente (chamado após salvar via admin panel) */
export function invalidateSystemConfigCache(): void {
  cache = null
  cacheAt = 0
}
