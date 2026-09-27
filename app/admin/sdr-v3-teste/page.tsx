'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';

const PRIMARY_BTN = { backgroundColor: '#01573C', color: '#fff', boxShadow: '0 2px 0 0 #013d2a' } as const;
const DANGER_BTN = { backgroundColor: '#B42318', color: '#fff', boxShadow: '0 2px 0 0 #7a1710' } as const;
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

interface PassoResultado {
  passo: string;
  lead: string;
  sdr: string;
  acao: string;
  ok: boolean;
  detalhe: string;
}

// Teste ao vivo dos buracos corrigidos na auditoria do SDR v3 de 27/09/2026, contra o modelo de
// verdade (gpt-4.1), com a config real e ativa da empresa. Não cria lead, não manda WhatsApp,
// só consome token de verdade (poucos centavos por rodada).
export default function SdrV3TestePage() {
  const [companyId, setCompanyId] = useState(30);
  const [running, setRunning] = useState(false);
  const [resultados, setResultados] = useState<CenarioResultado[]>([]);
  const [configVersion, setConfigVersion] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [runningCal, setRunningCal] = useState(false);
  const [passos, setPassos] = useState<PassoResultado[]>([]);
  const [errorCal, setErrorCal] = useState('');

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

  async function startCalendarReal() {
    if (!confirm('Isso cria e cancela uma reunião de teste de VERDADE no Google Calendar da empresa. Confirma?')) return;
    setRunningCal(true);
    setErrorCal('');
    setPassos([]);
    try {
      const res = await fetch('/api/admin/qa/sdr-v3-calendar-real', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setPassos(j.passos ?? []);
    } catch (e: any) {
      setErrorCal(e.message);
    } finally {
      setRunningCal(false);
    }
  }

  const passou = resultados.filter((r) => r.passou).length;
  const falharam = resultados.filter((r) => !r.passou);
  const passosOk = passos.filter((p) => p.ok).length;
  const passosFalharam = passos.filter((p) => !p.ok);

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
          <input type="number" className={`${INPUT} w-24`} value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))} disabled={running || runningCal} />
        </label>
        <button
          type="button"
          onClick={start}
          disabled={running || runningCal}
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

      <div className="mt-10 space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="text-base font-semibold">Teste real com o Calendar (cria e cancela evento de verdade)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Diferente do teste acima, este cria um lead de teste (&quot;TESTE CLAUDE (apagar)&quot;), agenda uma reunião de VERDADE no Google
              Calendar da empresa, simula um imprevisto, remarca (cancela o evento antigo e cria o novo, de verdade) e testa o pedido de ligação.
              No final apaga o lead, a conversa e cancela o evento que sobrar. Não deixa nada pra trás, mas mexe na agenda real por alguns segundos.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={startCalendarReal}
          disabled={running || runningCal}
          className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium disabled:opacity-50"
          style={DANGER_BTN}
        >
          {runningCal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Rodar teste real com o Calendar
        </button>

        {errorCal && <p className="text-sm text-red-400">{errorCal}</p>}

        {passos.length > 0 && (
          <p className="text-sm font-medium">
            {passosFalharam.length === 0 ? `Todos os ${passos.length} passos passaram.` : `${passosOk} de ${passos.length} passaram, ${passosFalharam.length} com falha.`}
          </p>
        )}

        <div className="space-y-3">
          {passos.map((p, i) => (
            <div key={i} className={`rounded-xl border p-4 text-sm ${p.ok ? 'border-border' : 'border-red-500/30'}`}>
              <div className="flex items-center gap-2">
                {p.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                <span className="font-medium">{p.passo}</span>
              </div>
              {p.lead && <p className="mt-2 text-xs text-muted-foreground">Lead: {p.lead}</p>}
              {p.sdr && <p className="mt-1 text-xs">SDR: {p.sdr}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{p.acao !== '-' ? `ação=${p.acao} · ` : ''}{p.detalhe}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
