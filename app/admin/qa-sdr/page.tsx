'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';

const PRIMARY_BTN = { backgroundColor: '#01573C', color: '#fff', boxShadow: '0 2px 0 0 #013d2a' } as const;
const INPUT = 'rounded-xl border border-[#212121] bg-[#141414] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#01573C]';

interface Report {
  nome: string;
  passou: boolean;
  transcript: { lead: string; sdr: string }[];
  observacao: string;
}

interface Row {
  index: number;
  nome: string;
  runs: Report[];
}

// Regressão do SDR rodada do navegador, um cenário por chamada (cada um leva ~1 min).
// Só usa a empresa-sombra de teste : nunca toca em lead real. Sem segredo no navegador.
export default function QaSdrPage() {
  const [companyId, setCompanyId] = useState(30);
  const [repeat, setRepeat] = useState(3);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  async function runOne(index: number): Promise<{ reports: Report[]; total: number }> {
    const res = await fetch('/api/admin/qa/sdr-eval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, deep: true, only: [index], repeat: 1 }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || j.message || `HTTP ${res.status}`);
    }
    const j = await res.json();
    return { reports: j.reports ?? [], total: j.total ?? 0 };
  }

  async function start() {
    setRunning(true);
    setError('');
    setRows([]);
    try {
      let total = 1;
      for (let i = 0; i < total; i++) {
        const runs: Report[] = [];
        let nome = `Cenário ${i + 1}`;
        for (let n = 0; n < repeat; n++) {
          setProgress(`Cenário ${i + 1} de ${total}, rodada ${n + 1} de ${repeat}`);
          try {
            const r = await runOne(i);
            total = Math.max(total, r.total);
            if (r.reports.length === 0) break; // não se aplica a esta empresa
            runs.push(r.reports[0]);
            nome = r.reports[0].nome;
          } catch (e: any) {
            runs.push({ nome, passou: false, transcript: [], observacao: `Erro: ${e.message}` });
          }
        }
        if (runs.length > 0) setRows((prev) => [...prev, { index: i, nome, runs }]);
      }
      setProgress('Concluído');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const failedRows = rows.filter((r) => r.runs.some((x) => !x.passou));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold">QA do SDR</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roda conversas simuladas no motor real, na empresa de teste. Nenhum lead real é tocado e nenhuma mensagem sai no WhatsApp. Cada cenário
          precisa passar em todas as rodadas.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Empresa</span>
          <input type="number" className={`${INPUT} w-24`} value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))} disabled={running} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Rodadas por cenário</span>
          <input type="number" min={1} max={5} className={`${INPUT} w-24`} value={repeat} onChange={(e) => setRepeat(Number(e.target.value))} disabled={running} />
        </label>
        <button
          type="button"
          onClick={start}
          disabled={running}
          className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium disabled:opacity-50"
          style={PRIMARY_BTN}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Rodar regressão
        </button>
      </div>

      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="space-y-2">
        {rows.map((row) => {
          const ok = row.runs.filter((x) => x.passou).length;
          const allOk = ok === row.runs.length;
          return (
            <div key={row.index} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              {allOk ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
              <span className="flex-1">{row.nome}</span>
              <span className="text-xs text-muted-foreground">
                {ok} de {row.runs.length}
              </span>
            </div>
          );
        })}
      </div>

      {!running && rows.length > 0 && (
        <p className="text-sm font-medium">
          {failedRows.length === 0 ? 'Todos os cenários passaram em todas as rodadas.' : `${failedRows.length} cenário(s) com falha.`}
        </p>
      )}

      {failedRows.map((row) => {
        const bad = row.runs.find((x) => !x.passou)!;
        return (
          <div key={row.index} className="rounded-xl border border-red-500/30 p-4 text-sm">
            <p className="font-medium">{row.nome}</p>
            <p className="mt-1 text-xs text-red-400">{bad.observacao}</p>
            <div className="mt-3 space-y-2">
              {bad.transcript.map((t, i) => (
                <div key={i} className="text-xs">
                  <p className="text-muted-foreground">Lead: {t.lead}</p>
                  <p>SDR: {t.sdr}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
