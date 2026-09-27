'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';

const PRIMARY_BTN = { backgroundColor: '#01573C', color: '#fff', boxShadow: '0 2px 0 0 #013d2a' } as const;
const INPUT = 'rounded-xl border border-[#212121] bg-[#141414] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#01573C]';

interface CenarioResultado {
  nome: string;
  lead: string;
  sdr: string;
  acao: string;
  escalou: boolean;
  violacoes: string[];
  passou: boolean;
  esperado: string;
}

// Teste ao vivo dos 6 buracos corrigidos na auditoria do SDR v3 de 27/09/2026, contra o modelo de
// verdade (gpt-4.1), com a config real e ativa da empresa. Não cria lead, não manda WhatsApp,
// só consome token de verdade (poucos centavos por rodada).
export default function SdrV3TestePage() {
  const [companyId, setCompanyId] = useState(30);
  const [running, setRunning] = useState(false);
  const [resultados, setResultados] = useState<CenarioResultado[]>([]);
  const [configVersion, setConfigVersion] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function start() {
    setRunning(true);
    setError('');
    setResultados([]);
    try {
      const res = await fetch('/api/admin/qa/sdr-v3-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setResultados(j.resultados ?? []);
      setConfigVersion(j.configVersion ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const passou = resultados.filter((r) => r.passou).length;
  const falharam = resultados.filter((r) => !r.passou);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold">Teste ao vivo do SDR v3</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roda os cenários da auditoria de 27/09/2026 contra o modelo de verdade, com a config real e ativa da empresa. Não cria lead, não manda
          WhatsApp, não toca em conversa real. Consome token de verdade (poucos centavos por rodada).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Empresa</span>
          <input type="number" className={`${INPUT} w-24`} value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))} disabled={running} />
        </label>
        <button
          type="button"
          onClick={start}
          disabled={running}
          className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium disabled:opacity-50"
          style={PRIMARY_BTN}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Rodar teste ao vivo
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {configVersion !== null && (
        <p className="text-xs text-muted-foreground">
          Config ativa usada no teste: versão {configVersion}
        </p>
      )}

      {resultados.length > 0 && (
        <p className="text-sm font-medium">
          {falharam.length === 0 ? `Todos os ${resultados.length} cenários passaram.` : `${passou} de ${resultados.length} passaram, ${falharam.length} com falha.`}
        </p>
      )}

      <div className="space-y-3">
        {resultados.map((r, i) => (
          <div key={i} className={`rounded-xl border p-4 text-sm ${r.passou ? 'border-border' : 'border-red-500/30'}`}>
            <div className="flex items-center gap-2">
              {r.passou ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
              <span className="font-medium">{r.nome}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Esperado: {r.esperado}</p>
            {r.lead && <p className="mt-2 text-xs text-muted-foreground">Lead: {r.lead}</p>}
            <p className="mt-1 text-xs">SDR: {r.sdr}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ação={r.acao}, escalou={r.escalou ? 'sim' : 'não'}, violações={r.violacoes.join(', ') || '-'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
