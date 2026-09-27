/**
 * CLI do teste ao vivo (ver lib/sdr/v3/self-test-live.ts). Precisa de NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY e ENCRYPTION_KEY reais no ambiente (os mesmos do serviço `nexio` no
 * Easypanel). Sem eles, use a tela /admin/sdr-v3-teste em vez deste script.
 *
 * Uso: npx tsx scripts/test-sdr-v3-live.ts
 */
import { runV3LiveSelfTest } from '@/lib/sdr/v3/self-test-live'

async function main() {
  const { configVersion, resultados, passou } = await runV3LiveSelfTest(30)
  console.log(`config ativa: v${configVersion}\n`)
  for (const r of resultados) {
    console.log(`--- ${r.nome} ---`)
    console.log(`  lead: ${r.lead}`)
    console.log(`  sdr : ${r.sdr}`)
    console.log(`  [acao=${r.acao}, escalou=${r.escalou}, violacoes=${r.violacoes.join(',') || '-'}]`)
    console.log(`  ${r.passou ? 'OK   ' : 'FALHA'} :: esperado: ${r.esperado}\n`)
  }
  console.log(passou ? 'TODOS OK' : `${resultados.filter((x) => !x.passou).length} FALHA(S)`)
  process.exit(passou ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
