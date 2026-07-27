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
  if (!secret || !provided) {
    return NextResponse.json({ error: 'Unauthorized — passe ?secret=CRON_SECRET na URL' }, { status: 401 })
  }

  const mem = process.memoryUsage()
  const v8stats = getHeapStatistics()
  const rawSpaces = getHeapSpaceStatistics()

  // Conta módulos carregados via require.cache (CJS — Next.js ESM pode ser 0)
  const moduleCount = Object.keys(require.cache ?? {}).length
  const loadedPackages = Object.keys(require.cache ?? {})
    .filter(k => k.includes('node_modules'))
    .map(k => k.split('node_modules/').pop()?.split('/')[0] ?? k)
    .reduce((acc, pkg) => { acc[pkg] = (acc[pkg] ?? 0) + 1; return acc }, {} as Record<string, number>)

  const topPackages = Object.entries(loadedPackages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30)
    .map(([name, files]) => ({ name, files }))

  // Espacos de heap V8 — chave para identificar o culpado:
  // code_space alto = código JS compilado (googleapis, pdfjs, etc)
  // old_space alto   = objetos retidos (Maps, caches, closures)
  // large_object_space alto = buffers/arrays grandes
  const spaces = rawSpaces.map(s => ({
    name: s.space_name,
    used_mb: mb(s.space_used_size),
    size_mb: mb(s.space_size),
  }))
  const spaceMap = Object.fromEntries(rawSpaces.map(s => [
    s.space_name.replace('_space', ''),
    mb(s.space_used_size),
  ]))

  return NextResponse.json({
    uptime_s: Math.round(process.uptime()),
    // RSS = tudo que o processo usa (heap + code + stack + shared libs)
    process: {
      rss_mb: mb(mem.rss),
      heap_used_mb: mb(mem.heapUsed),
      heap_total_mb: mb(mem.heapTotal),
      external_mb: mb(mem.external),     // buffers C++ (ex: Buffer, TLS)
      array_buffers_mb: mb(mem.arrayBuffers),
    },
    // Diagnóstico rápido: old_space = leak; code_space = módulos pesados
    heap_diagnosis: {
      old_space_mb: spaceMap['old'] ?? 0,
      code_space_mb: spaceMap['code'] ?? 0,
      large_object_mb: spaceMap['large_object'] ?? 0,
      map_space_mb: spaceMap['map'] ?? 0,
      new_space_mb: spaceMap['new'] ?? 0,
      total_used_mb: mb(v8stats.used_heap_size),
      limit_mb: mb(v8stats.heap_size_limit),
      // mu próximo de 0 = GC thrash (OOM iminente)
      gc_health: {
        malloced_mb: mb(v8stats.malloced_memory),
        peak_malloced_mb: mb(v8stats.peak_malloced_memory),
        detached_contexts: v8stats.number_of_detached_contexts,
      },
    },
    spaces,
    modules: {
      total_cjs_loaded: moduleCount,
      top_packages_by_files: topPackages,
    },
  })
}
