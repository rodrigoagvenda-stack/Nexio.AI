import { getHeapStatistics, getHeapSpaceStatistics } from 'v8'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mb(bytes: number) { return Math.round(bytes / 1024 / 1024) }

// Aceita secret via header Authorization ou query param ?secret=
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  const querySecret = request.nextUrl.searchParams.get('secret')
  const provided = auth === `Bearer ${secret}` || querySecret === secret
  if (secret && !provided) {
    return NextResponse.json({ error: 'Unauthorized — passe ?secret=CRON_SECRET na URL' }, { status: 401 })
  }

  const mem = process.memoryUsage()
  const v8stats = getHeapStatistics()
  const spaces = getHeapSpaceStatistics()

  // Conta módulos carregados (Node.js require cache)
  const moduleCount = Object.keys(require.cache ?? {}).length

  // Top 20 módulos por tamanho de path (proxy para módulos grandes)
  const largeModules = Object.keys(require.cache ?? {})
    .filter(k => k.includes('node_modules'))
    .map(k => {
      const mod = require.cache[k]
      // Módulos com muitas exports são geralmente maiores
      const exportCount = mod?.exports ? Object.keys(mod.exports).length : 0
      return { path: k.split('node_modules/').pop()?.split('/')[0] ?? k, exportCount }
    })
    .reduce((acc, { path, exportCount }) => {
      acc[path] = (acc[path] ?? 0) + exportCount
      return acc
    }, {} as Record<string, number>)

  const topModules = Object.entries(largeModules)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([name, count]) => ({ name, exportCount: count }))

  return NextResponse.json({
    uptime_s: Math.round(process.uptime()),
    process: {
      rss_mb: mb(mem.rss),
      heap_used_mb: mb(mem.heapUsed),
      heap_total_mb: mb(mem.heapTotal),
      external_mb: mb(mem.external),
      array_buffers_mb: mb(mem.arrayBuffers),
    },
    v8: {
      heap_size_limit_mb: mb(v8stats.heap_size_limit),
      total_heap_mb: mb(v8stats.total_heap_size),
      used_heap_mb: mb(v8stats.used_heap_size),
      malloced_memory_mb: mb(v8stats.malloced_memory),
      peak_malloced_mb: mb(v8stats.peak_malloced_memory),
      does_zap_garbage: v8stats.does_zap_garbage,
      number_of_native_contexts: v8stats.number_of_native_contexts,
      number_of_detached_contexts: v8stats.number_of_detached_contexts,
    },
    spaces: spaces.map(s => ({
      name: s.space_name,
      used_mb: mb(s.space_used_size),
      size_mb: mb(s.space_size),
      capacity_mb: mb(s.space_available_size),
    })),
    modules: {
      total_loaded: moduleCount,
      top_by_exports: topModules,
    },
  })
}
