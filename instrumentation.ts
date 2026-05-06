export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    import('openai').catch(() => {})

    const { writeHeapSnapshot } = await import('v8')
    const THRESHOLD = 1500 * 1024 * 1024 // 1500 MB
    let saved = false

    const interval = setInterval(() => {
      if (saved) return
      const { heapUsed } = process.memoryUsage()
      if (heapUsed > THRESHOLD) {
        saved = true
        clearInterval(interval)
        const file = writeHeapSnapshot(`/app/public/heap-auto-${Date.now()}.heapsnapshot`)
        console.log(`[heap-monitor] snapshot salvo: ${file} (heapUsed=${Math.round(heapUsed / 1024 / 1024)}MB)`)
      }
    }, 30_000)

    interval.unref()
  }
}
