/**
 * Wrapper local do harness de avaliação do SDR. Lógica real em lib/sdr/eval.ts
 * (compartilhada com a rota /api/admin/qa/sdr-eval, pra rodar em produção
 * onde a service role key já existe).
 *
 * Uso: npx tsx scripts/sdr-eval.ts [companyId]
 * (companyId opcional, default 30 = Grupo Venda, usada hoje pra achar os bugs)
 */
import { runSdrEval } from '../lib/sdr/eval'

const companyId = Number(process.argv[2] ?? 30)

runSdrEval(companyId)
  .then((result) => process.exit(result.failed > 0 ? 1 : 0))
  .catch((err) => {
    console.error('[sdr-eval] erro fatal:', err)
    process.exit(1)
  })
