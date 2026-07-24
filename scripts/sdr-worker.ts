/**
 * Entrypoint standalone do SDR Worker — roda em container separado (zaapply-sdr).
 * Não depende do Next.js. Apenas policia a fila sdr_jobs no Supabase.
 */
import { startSdrWorker } from '../lib/sdr/worker'

startSdrWorker()

console.log('[zaapply-sdr] Worker iniciado — aguardando jobs...')

process.on('SIGTERM', () => {
  console.log('[zaapply-sdr] SIGTERM recebido, encerrando...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[zaapply-sdr] SIGINT recebido, encerrando...')
  process.exit(0)
})
