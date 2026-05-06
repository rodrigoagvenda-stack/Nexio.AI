export async function register() {
  console.log('[Instrumentation] register() chamado')
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    import('openai').catch(() => {})

    const { writeHeapSnapshot } = await import('v8')
    const THRESHOLD = 500 * 1024 * 1024 // 500 MB — confirmar que writeHeapSnapshot funciona
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
