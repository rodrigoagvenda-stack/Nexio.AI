/**
 * Roda a regressão do SDR contra o ambiente de PRODUÇÃO (empresa-sombra, nunca
 * toca dado real), um cenário por chamada HTTP, cada um N vezes.
 * Só passa se passar em todas as N vezes (meta : 3 de 3).
 *
 * Uso (PowerShell):
 *   $env:CRON_SECRET="..."; $env:EVAL_BASE_URL="https://app.zaapply.com.br"
 *   npx tsx scripts/sdr-eval-remote.ts [companyId] [--repeat=3]
 */
const args = process.argv.slice(2)
const companyId = Number(args.find((a) => /^\d+$/.test(a)) ?? 30)
const repeat = Number(args.find((a) => a.startsWith('--repeat='))?.split('=')[1] ?? 3)
const base = process.env.EVAL_BASE_URL
const secret = process.env.CRON_SECRET
const TOTAL_SCENARIOS = 17 // 4 base + 13 profundos (lib/sdr/eval.ts)

if (!base || !secret) {
  console.error('Defina EVAL_BASE_URL e CRON_SECRET.')
  process.exit(1)
}

interface RemoteResult {
  passed: number
  failed: number
  checks: { ok: boolean; label: string }[]
  log: string[]
}

async function runOne(index: number): Promise<RemoteResult> {
  const res = await fetch(`${base}/api/admin/qa/sdr-eval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ companyId, deep: true, only: [index], repeat: 1 }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function main() {
  let failedScenarios = 0
  for (let i = 0; i < TOTAL_SCENARIOS; i++) {
    const runs: RemoteResult[] = []
    for (let n = 0; n < repeat; n++) {
      try {
        runs.push(await runOne(i))
      } catch (err: any) {
        runs.push({ passed: 0, failed: 1, checks: [{ ok: false, label: `erro: ${err?.message}` }], log: [] })
      }
    }
    const applicable = runs.filter((r) => r.checks.length > 0)
    if (applicable.length === 0) continue // cenário não se aplica a essa empresa
    const ok = applicable.filter((r) => r.failed === 0).length
    const label = applicable[0].checks[0].label.split(':')[0]
    console.log(`[${i}] ${ok === applicable.length ? 'PASS' : 'FAIL'} ${ok}/${applicable.length}  ${label}`)
    if (ok !== applicable.length) {
      failedScenarios++
      const bad = applicable.find((r) => r.failed > 0)!
      console.log(bad.log.join('\n'))
    }
  }
  console.log(failedScenarios === 0 ? '\nTodos os cenários passaram em todas as repetições.' : `\n${failedScenarios} cenário(s) falharam.`)
  process.exit(failedScenarios === 0 ? 0 : 1)
}

main()
