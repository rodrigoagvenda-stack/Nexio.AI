export async function register() {
  console.log('[Instrumentation] register() chamado')
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    import('openai').catch(() => {})

    // SDR Job Worker — processa fila persistente de mensagens
    const { startSdrWorker } = await import('@/lib/sdr/worker')
    startSdrWorker()

    const { writeHeapSnapshot } = await import('v8')
    const THRESHOLD = 3000 * 1024 * 1024 // 3000 MB
    let saved = false

    const interval = setInterval(() => {
      if (saved) return
      const { heapUsed } = process.memoryUsage()
      if (heapUsed > THRESHOLD) {
        saved = true
        clearInterval(interval)
        try {
          const file = writeHeapSnapshot(`/app/public/heap-auto-${Date.now()}.heapsnapshot`)
          console.log(`[heap-monitor] snapshot salvo: ${file} (heapUsed=${Math.round(heapUsed / 1024 / 1024)}MB)`)
        } catch (e: any) {
          console.error(`[heap-monitor] ERRO ao salvar snapshot: ${e.message}`)
        }
      }
    }, 5_000)

    interval.unref()
  }
}
