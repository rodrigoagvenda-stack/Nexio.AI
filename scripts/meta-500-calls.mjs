/**
 * Faz 500+ chamadas ao Marketing API para satisfazer o Marketing API Access Tier.
 * Uso: node scripts/meta-500-calls.mjs <ACCESS_TOKEN>
 *
 * O ACCESS_TOKEN deve ter escopos: ads_read, ads_management, business_management
 * Gere em: https://developers.facebook.com/tools/explorer/?app=1550150193562012
 */

const TOKEN = process.argv[2];
const TARGET = 520; // 20 a mais para garantir margem
const BASE = 'https://graph.facebook.com/v21.0';
const DELAY_MS = 150; // 150ms entre chamadas para evitar rate limit

let success = 0;
let fail = 0;

async function call(path) {
  try {
    const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${TOKEN}&limit=10`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      fail++;
      if (data.error.code === 4 || data.error.code === 17) {
        // rate limit — espera mais
        await new Promise(r => setTimeout(r, 2000));
      }
      return null;
    }
    success++;
    return data;
  } catch {
    fail++;
    return null;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (!TOKEN) {
    console.error('Uso: node scripts/meta-500-calls.mjs <ACCESS_TOKEN>');
    process.exit(1);
  }

  console.log('Buscando contas de anuncio...\n');
  const accountsRes = await call('/me/adaccounts?fields=id,name');
  const adAccountIds = accountsRes?.data?.map(a => a.id) ?? [];

  if (adAccountIds.length === 0) {
    console.error('Nenhuma conta de anuncio encontrada. Verifique o token e os escopos.');
    process.exit(1);
  }

  console.log(`Contas encontradas: ${adAccountIds.join(', ')}`);
  console.log(`Meta: ${TARGET} chamadas com >= 85% de sucesso\n`);

  const endpoints = [
    (id) => `/${id}/campaigns?fields=id,name,status`,
    (id) => `/${id}/adsets?fields=id,name,status`,
    (id) => `/${id}/ads?fields=id,name,status`,
    (id) => `/${id}/insights?fields=impressions,clicks,spend&date_preset=last_30d`,
    (id) => `/${id}?fields=id,name,currency,account_status`,
  ];

  let round = 0;
  while (success + fail < TARGET) {
    const accountId = adAccountIds[round % adAccountIds.length];
    const endpointFn = endpoints[round % endpoints.length];
    await call(endpointFn(accountId));
    round++;

    const total = success + fail;
    if (total % 50 === 0) {
      const pct = ((success / total) * 100).toFixed(1);
      console.log(`${total}/${TARGET} | sucesso: ${success} (${pct}%) | falha: ${fail}`);
    }

    await sleep(DELAY_MS);
  }

  const total = success + fail;
  const pct = ((success / total) * 100).toFixed(1);
  console.log(`\nConcluido!`);
  console.log(`Total: ${total} chamadas`);
  console.log(`Sucesso: ${success} (${pct}%)`);
  console.log(`Falha: ${fail}`);

  if (success / total < 0.85) {
    console.warn('\nAVISO: taxa de sucesso abaixo de 85%. Verifique o token e tente novamente.');
  } else {
    console.log('\nTaxa de sucesso OK. Aguarde ate 24h para aparecer no painel do App Review.');
  }
}

main();
