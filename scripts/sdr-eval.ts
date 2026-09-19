/**
 * Wrapper local do harness de avaliação do SDR. Lógica real em lib/sdr/eval.ts
 * (compartilhada com a rota /api/admin/qa/sdr-eval, pra rodar em produção
 * onde a service role key já existe).
 *
 * Uso: npx tsx --env-file=.env.local scripts/sdr-eval.ts [companyId] [--deep] [--repeat=N]
 *   companyId  opcional, default 30 (Grupo Venda)
 *   --deep     inclui os cenários multi-turno de regressão estrutural
 *   --repeat=N roda cada cenário N vezes e só passa se passar em todas (meta : 3)
 */
import { runSdrEval } from '../lib/sdr/eval'

const args = process.argv.slice(2)
const companyId = Number(args.find((a) => /^\d+$/.test(a)) ?? 30)
const deep = args.includes('--deep')
const repeat = Number(args.find((a) => a.startsWith('--repeat='))?.split('=')[1] ?? 1)

runSdrEval(companyId, { deep, repeat })
  .then((result) => {
    console.log(result.log.join('\n'))
    process.exit(result.failed > 0 ? 1 : 0)
  })
  .catch((err) => {
    console.error('[sdr-eval] erro fatal:', err)
    process.exit(1)
  })
