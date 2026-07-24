export async function register() {
  console.log('[Instrumentation] register() chamado')
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sentry em try/catch — falha aqui NUNCA pode impedir o worker de subir
    try {
      await import('./sentry.server.config')
    } catch (e: any) {
      console.warn('[Instrumentation] Sentry init falhou (não crítico):', e?.message)
    }

    import('openai').catch(() => {})

    // SDR Job Worker — processa fila persistente de mensagens.
    // Desabilitado quando DISABLE_SDR_WORKER=true (roda no container zaapply-sdr separado).
    if (process.env.DISABLE_SDR_WORKER !== 'true') {
      try {
        const { startSdrWorker } = await import('@/lib/sdr/worker')
        startSdrWorker()
      } catch (e: any) {
        console.error('[Instrumentation] ERRO CRÍTICO ao iniciar SDR worker:', e?.message)
      }
    } else {
      console.log('[Instrumentation] SDR worker desabilitado — rodando em container separado')
    }

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
