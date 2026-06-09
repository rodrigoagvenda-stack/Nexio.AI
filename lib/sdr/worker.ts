import { createServiceClient } from '@/lib/supabase/server'
import { processSdrMessage } from '@/lib/sdr/engine'

const BUFFER_SECONDS = 30
const STUCK_MINUTES = 2
const POLL_INTERVAL_MS = 5_000
const MAX_PARALLEL = 3

export function startSdrWorker() {
  recoverInterruptedJobs().catch((e) =>
    console.error('[sdr-worker] recovery error:', e?.message)
  )

  const interval = setInterval(async () => {
    try {
      await processNextJobs()
    } catch (e: any) {
      console.error('[sdr-worker] poll error:', e?.message)
    }
  }, POLL_INTERVAL_MS)

  interval.unref()
  console.log('[sdr-worker] iniciado — poll a cada 5s, buffer=30s')
}

async function recoverInterruptedJobs() {
  const supabase = createServiceClient()
  const stuckBefore = new Date(Date.now() - STUCK_MINUTES * 60 * 1000).toISOString()

  const { data: stuck, error } = await supabase
    .from('sdr_jobs')
    .update({ status: 'PENDING', started_at: null })
    .eq('status', 'PROCESSING')
    .lt('started_at', stuckBefore)
    .select('id, company_id, phone')

  if (error) {
    console.error('[sdr-worker] recovery error:', error.message)
    return
  }

  if (stuck && stuck.length > 0) {
    console.log(`[sdr-worker] recovery: ${stuck.length} job(s) resetados para PENDING`,
      stuck.map((j) => `#${j.id} company=${j.company_id} phone=${j.phone}`)
    )
  }
}

async function processNextJobs() {
  const supabase = createServiceClient()
  const readyBefore = new Date(Date.now() - BUFFER_SECONDS * 1000).toISOString()

  const { data: jobs, error } = await supabase
    .from('sdr_jobs')
    .select('id, company_id, phone, attempts, max_attempts')
    .eq('status', 'PENDING')
    .lt('last_message_at', readyBefore)
    .order('last_message_at', { ascending: true })
    .limit(MAX_PARALLEL)

  if (error) {
    console.error('[sdr-worker] select error:', error.message)
    return
  }

  if (!jobs || jobs.length === 0) {
    // silencioso — log só quando encontrar jobs para não poluir
    return
  }

  console.log(`[sdr-worker] ${jobs.length} job(s) prontos para processar`)
  await Promise.all(jobs.map(processJob))
}

async function processJob(job: {
  id: number
  company_id: number
  phone: string
  attempts: number
  max_attempts: number
}) {
  const supabase = createServiceClient()

  // Optimistic lock — só processa se ainda estiver PENDING
  const { error: lockErr } = await supabase
    .from('sdr_jobs')
    .update({ status: 'PROCESSING', started_at: new Date().toISOString(), attempts: job.attempts + 1 })
    .eq('id', job.id)
    .eq('status', 'PENDING')

  if (lockErr) {
    console.warn(`[sdr-worker] job #${job.id} já foi pego por outro worker`)
    return
  }

  console.log(`[sdr-worker] job #${job.id} PROCESSING — company=${job.company_id} phone=${job.phone} attempt=${job.attempts + 1}`)

  try {
    await processSdrMessage(job.company_id, job.phone)

    await supabase
      .from('sdr_jobs')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('id', job.id)

    console.log(`[sdr-worker] job #${job.id} COMPLETED`)
  } catch (e: any) {
    const exhausted = job.attempts + 1 >= job.max_attempts
    console.error(`[sdr-worker] job #${job.id} FAILED (attempt ${job.attempts + 1}/${job.max_attempts}):`, e?.message)

    await supabase
      .from('sdr_jobs')
      .update({
        status: exhausted ? 'FAILED' : 'PENDING',
        started_at: null,
        error: e?.message ?? 'Erro desconhecido',
      })
      .eq('id', job.id)
  }
}
