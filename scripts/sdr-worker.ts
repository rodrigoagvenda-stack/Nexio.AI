/**
 * Entrypoint standalone do SDR Worker — roda em container separado (zaapply-sdr).
 * Não depende do Next.js. Apenas policia a fila sdr_jobs no Supabase.
 */
import { startSdrWorker } from '../lib/sdr/worker'

startSdrWorker()

// Mantém o processo vivo — sem isso o Node sai imediatamente (interval.unref no worker)
const _keepAlive = setInterval(() => {}, 60_000)

console.log('[zaapply-sdr] Worker iniciado — aguardando jobs...')

process.on('SIGTERM', () => {
  clearInterval(_keepAlive)
  console.log('[zaapply-sdr] SIGTERM recebido, encerrando...')
  process.exit(0)
})

process.on('SIGINT', () => {
  clearInterval(_keepAlive)
  console.log('[zaapply-sdr] SIGINT recebido, encerrando...')
  process.exit(0)
})
