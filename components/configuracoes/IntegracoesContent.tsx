'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { CheckCircle2, Loader2, Zap, X, CheckCheck, Copy, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoogleStatus { connected: boolean; email: string | null }

// Google Calendar e integrações de pagamento (Mercado Pago, Kiwify, Asaas).
// Continuam aqui até a aba Conexões do SDR assumir estas configurações.
export function IntegracoesContent() {
  const { user } = useUser();
  const company = user?.company_id ? { id: user.company_id } : null;

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  // Payment integrations
  const [paymentIntegrations, setPaymentIntegrations] = useState<{ platform: string; active: boolean }[]>([]);
  const [mpFormOpen, setMpFormOpen] = useState(false);
  const [kiwifyFormOpen, setKiwifyFormOpen] = useState(false);
  const [asaasFormOpen, setAsaasFormOpen] = useState(false);
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpSecretKey, setMpSecretKey] = useState('');
  const [kiwifyToken, setKiwifyToken] = useState('');
  const [asaasAccessToken, setAsaasAccessToken] = useState('');
  const [asaasWebhookToken, setAsaasWebhookToken] = useState('');
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<string | null>(null);
  const [copiedAsaasUrl, setCopiedAsaasUrl] = useState(false);
  const [copiedKiwifyUrl, setCopiedKiwifyUrl] = useState(false);
  const [asaasLogs, setAsaasLogs] = useState<any[] | null>(null);
  const [loadingAsaasLogs, setLoadingAsaasLogs] = useState(false);

  useEffect(() => {
    fetch('/api/google/status').then(r => r.ok ? r.json() : null).then(d => { if (d) setGoogleStatus(d); setGoogleLoading(false); }).catch(() => setGoogleLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/payment-integrations').then(r => r.ok ? r.json() : null).then(d => { if (d) setPaymentIntegrations(d.integrations ?? []); }).catch(() => {});
  }, []);

  const handleGoogleDisconnect = async () => {
    setDisconnectingGoogle(true);
    await fetch('/api/google/status', { method: 'DELETE' }).catch(() => {});
    setGoogleStatus({ connected: false, email: null });
    toast({ title: 'Google Calendar desconectado' });
    setDisconnectingGoogle(false);
  };

  const handlePaymentSave = async (platform: string, config: Record<string, string>) => {
    setSavingPlatform(platform);
    try {
      const res = await fetch('/api/payment-integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform, config }) });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? 'Erro ao salvar', variant: 'destructive' }); return; }
      setPaymentIntegrations(prev => {
        const filtered = prev.filter(i => i.platform !== platform);
        return [...filtered, { platform, active: true }];
      });
      if (platform === 'mercadopago') setMpFormOpen(false);
      if (platform === 'kiwify') setKiwifyFormOpen(false);
      if (platform === 'asaas') setAsaasFormOpen(false);
      const platformName = platform === 'mercadopago' ? 'Mercado Pago' : platform === 'kiwify' ? 'Kiwify' : 'Asaas';
      toast({ title: `${platformName} configurado com sucesso!` });
    } catch { toast({ title: 'Erro de conexão', variant: 'destructive' }); }
    finally { setSavingPlatform(null); }
  };

  const handlePaymentDisconnect = async (platform: string) => {
    setDisconnectingPlatform(platform);
    try {
      await fetch('/api/payment-integrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform }) });
      setPaymentIntegrations(prev => prev.filter(i => i.platform !== platform));
      const platformName = platform === 'mercadopago' ? 'Mercado Pago' : platform === 'kiwify' ? 'Kiwify' : 'Asaas';
      toast({ title: `${platformName} desconectado` });
    } catch { toast({ title: 'Erro ao desconectar', variant: 'destructive' }); }
    finally { setDisconnectingPlatform(null); }
  };

  return (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-border flex items-center justify-center mt-0.5 p-1 overflow-hidden shrink-0">
                  <img src="/logos/google-calendar.svg?v=4" className="w-full h-full object-contain" alt="Google Calendar" />
                </div>
                <div>
                  <p className="font-semibold">Google Calendar</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Conecte sua agenda para agendamentos automáticos pelo agente SDR
                  </p>
                  {googleLoading && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Verificando…</p>}
                  {!googleLoading && googleStatus?.connected && (
                    <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{googleStatus.email}</p>
                  )}
                  {!googleLoading && !googleStatus?.connected && (
                    <p className="text-xs text-muted-foreground mt-2">Não conectado</p>
                  )}
                </div>
              </div>

              {!googleLoading && (
                googleStatus?.connected ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGoogleDisconnect}
                    disabled={disconnectingGoogle}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0 self-start sm:self-auto"
                  >
                    {disconnectingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Desconectar</>}
                  </Button>
                ) : (
                  <a
                    href="/api/google/auth"
                    className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#dadce0] text-[#3c4043] text-sm font-medium shadow-sm hover:shadow-md transition-shadow select-none"
                    style={{ fontFamily: "'Google Sans', Roboto, sans-serif" }}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Conectar com Google
                  </a>
                )
              )}
            </div>
          </div>

          {/* ── MERCADO PAGO ─────────────────────────────────── */}
          {(() => {
            const connected = paymentIntegrations.some(i => i.platform === 'mercadopago' && i.active);
            return (
              <div className={cn('p-5 rounded-2xl border bg-card flex items-start justify-between gap-4 transition-colors', connected ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-border')}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#009EE3]/10 flex items-center justify-center shrink-0 p-1 overflow-hidden">
                    <img src="/logos/mercadopago.svg?v=4" className="w-full h-full object-contain" alt="Mercado Pago" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">Mercado Pago</p>
                      {connected && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium"><CheckCircle2 className="h-2.5 w-2.5" />Ativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Receba notificações automáticas de pagamento confirmado</p>
                    {!connected && mpFormOpen && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <Label className="text-xs">Access Token</Label>
                          <Input value={mpAccessToken} onChange={e => setMpAccessToken(e.target.value)} placeholder="APP_USR-..." className="h-8 text-xs mt-1 font-mono" />
                        </div>
                        <div>
                          <Label className="text-xs">Chave Secreta do Webhook</Label>
                          <Input value={mpSecretKey} onChange={e => setMpSecretKey(e.target.value)} placeholder="Chave gerada no painel MP" className="h-8 text-xs mt-1 font-mono" />
                        </div>
                        <p className="text-[10px] text-muted-foreground/70">Obtenha em Suas integrações → Notificações → Webhooks no painel do Mercado Pago.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {connected ? (
                    <Button variant="ghost" size="sm" onClick={() => handlePaymentDisconnect('mercadopago')} disabled={disconnectingPlatform === 'mercadopago'} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      {disconnectingPlatform === 'mercadopago' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Desconectar</>}
                    </Button>
                  ) : mpFormOpen ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setMpFormOpen(false)} className="text-muted-foreground">Cancelar</Button>
                      <Button size="sm" onClick={() => handlePaymentSave('mercadopago', { access_token: mpAccessToken, secret_key: mpSecretKey })} disabled={!mpAccessToken || !mpSecretKey || savingPlatform === 'mercadopago'}>
                        {savingPlatform === 'mercadopago' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setMpFormOpen(true)}>Configurar</Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── KIWIFY ───────────────────────────────────────── */}
          {(() => {
            const connected = paymentIntegrations.some(i => i.platform === 'kiwify' && i.active);
            return (
              <div className={cn('p-5 rounded-2xl border bg-card flex items-start justify-between gap-4 transition-colors', connected ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-border')}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#2db56f]/10 flex items-center justify-center shrink-0 p-1 overflow-hidden">
                    <img src="/logos/kiwify.svg?v=3" className="w-full h-full object-contain" alt="Kiwify" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">Kiwify</p>
                      {connected && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium"><CheckCircle2 className="h-2.5 w-2.5" />Ativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Detecta compras confirmadas de infoprodutos automaticamente</p>
                    {!connected && kiwifyFormOpen && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <Label className="text-xs">URL do Webhook (cole no painel Kiwify)</Label>
                          <div className="flex items-center gap-1 mt-1">
                            <Input readOnly value={company ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/payment/${company.id}/kiwify` : ''} className="h-8 text-xs font-mono bg-muted/30 cursor-text select-all" />
                            <button
                              type="button"
                              onClick={() => {
                                if (!company) return;
                                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/payment/${company.id}/kiwify`);
                                setCopiedKiwifyUrl(true);
                                setTimeout(() => setCopiedKiwifyUrl(false), 2000);
                              }}
                              className="h-8 w-8 flex items-center justify-center shrink-0 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                              {copiedKiwifyUrl ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">Cole essa URL em Apps → Webhooks no painel da Kiwify ao criar o webhook.</p>
                        </div>
                        <div>
                          <Label className="text-xs">Token de Verificação</Label>
                          <Input value={kiwifyToken} onChange={e => setKiwifyToken(e.target.value)} placeholder="Token gerado automaticamente pela Kiwify" className="h-8 text-xs mt-1 font-mono" />
                          <p className="text-[10px] text-muted-foreground/70 mt-1">Após criar o webhook na Kiwify, copie o token gerado e cole aqui.</p>
                        </div>
                      </div>
                    )}
                    {connected && (
                      <div className="mt-2">
                        <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Input readOnly value={company ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/payment/${company.id}/kiwify` : ''} className="h-7 text-[11px] font-mono bg-muted/20 cursor-text select-all" />
                          <button
                            type="button"
                            onClick={() => {
                              if (!company) return;
                              navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/payment/${company.id}/kiwify`);
                              setCopiedKiwifyUrl(true);
                              setTimeout(() => setCopiedKiwifyUrl(false), 2000);
                            }}
                            className="h-7 w-7 flex items-center justify-center shrink-0 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            {copiedKiwifyUrl ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {connected ? (
                    <Button variant="ghost" size="sm" onClick={() => handlePaymentDisconnect('kiwify')} disabled={disconnectingPlatform === 'kiwify'} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      {disconnectingPlatform === 'kiwify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Desconectar</>}
                    </Button>
                  ) : kiwifyFormOpen ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setKiwifyFormOpen(false)} className="text-muted-foreground">Cancelar</Button>
                      <Button size="sm" onClick={() => handlePaymentSave('kiwify', { token: kiwifyToken })} disabled={!kiwifyToken || savingPlatform === 'kiwify'}>
                        {savingPlatform === 'kiwify' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setKiwifyFormOpen(true)}>Configurar</Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── ASAAS ────────────────────────────────────────── */}
          {(() => {
            const connected = paymentIntegrations.some(i => i.platform === 'asaas' && i.active);
            return (
              <div className={cn('p-5 rounded-2xl border bg-card flex items-start justify-between gap-4 transition-colors', connected ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-border')}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#0030B9]/10 flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
                    <img src="/logos/asaas.svg?v=2" className="w-full h-full object-contain" alt="Asaas" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">Asaas</p>
                      {connected && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium"><CheckCircle2 className="h-2.5 w-2.5" />Ativo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Dispare sequências em pagamento confirmado, boleto gerado ou vencido</p>
                    {!connected && asaasFormOpen && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <Label className="text-xs">URL do Webhook (cole no painel Asaas)</Label>
                          <div className="flex items-center gap-1 mt-1">
                            <Input readOnly value={company ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/payment/${company.id}/asaas` : ''} className="h-8 text-xs font-mono bg-muted/30 cursor-text select-all" />
                            <button
                              type="button"
                              onClick={() => {
                                if (!company) return;
                                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/payment/${company.id}/asaas`);
                                setCopiedAsaasUrl(true);
                                setTimeout(() => setCopiedAsaasUrl(false), 2000);
                              }}
                              className="h-8 w-8 flex items-center justify-center shrink-0 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                              {copiedAsaasUrl ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">Cole essa URL em Menu → Integrações → Configurar Webhook no painel do Asaas.</p>
                        </div>
                        <div>
                          <Label className="text-xs">Chave de API Asaas</Label>
                          <Input value={asaasAccessToken} onChange={e => setAsaasAccessToken(e.target.value)} placeholder="$aact_prod_..." className="h-8 text-xs mt-1 font-mono" />
                        </div>
                        <div>
                          <Label className="text-xs">Token do Webhook</Label>
                          <Input value={asaasWebhookToken} onChange={e => setAsaasWebhookToken(e.target.value)} placeholder="Token gerado no painel Asaas" className="h-8 text-xs mt-1 font-mono" />
                        </div>
                        <p className="text-[10px] text-muted-foreground/70">Chave de API em Menu → Integrações → Chaves de API. Token do Webhook em Menu → Integrações → Configurar Webhook.</p>
                      </div>
                    )}
                    {connected && (
                      <div className="mt-2 space-y-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                          <div className="flex items-center gap-1 mt-1">
                            <Input readOnly value={company ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/payment/${company.id}/asaas` : ''} className="h-7 text-[11px] font-mono bg-muted/20 cursor-text select-all" />
                            <button
                              type="button"
                              onClick={() => {
                                if (!company) return;
                                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/payment/${company.id}/asaas`);
                                setCopiedAsaasUrl(true);
                                setTimeout(() => setCopiedAsaasUrl(false), 2000);
                              }}
                              className="h-7 w-7 flex items-center justify-center shrink-0 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                              {copiedAsaasUrl ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                            </button>
                          </div>
                        </div>
                        {/* Histórico de eventos do webhook */}
                        <div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (asaasLogs !== null) { setAsaasLogs(null); return; }
                              setLoadingAsaasLogs(true);
                              try {
                                const r = await fetch('/api/payment-integrations/events?platform=asaas');
                                const d = await r.json();
                                setAsaasLogs(d.events ?? []);
                              } catch { setAsaasLogs([]); } finally { setLoadingAsaasLogs(false); }
                            }}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {loadingAsaasLogs ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronRight className={cn('h-3 w-3 transition-transform', asaasLogs !== null && 'rotate-90')} />}
                            Histórico de eventos ({asaasLogs !== null ? asaasLogs.length : '?'})
                          </button>
                          {asaasLogs !== null && (
                            <div className="mt-2 space-y-1 max-h-64 overflow-y-auto pr-1">
                              {asaasLogs.length === 0 && (
                                <p className="text-[11px] text-muted-foreground/60 italic">Nenhum evento recebido ainda. Gere um boleto no Asaas e aguarde.</p>
                              )}
                              {asaasLogs.map((ev, i) => {
                                const statusColor = ev.status === 'ok' ? 'text-emerald-400' : ev.status === 'ignorado' ? 'text-yellow-400' : ev.status === 'sem_sequencia' ? 'text-orange-400' : 'text-red-400';
                                const statusLabel = ev.status === 'ok' ? 'Enviado' : ev.status === 'ignorado' ? 'Ignorado' : ev.status === 'sem_sequencia' ? 'Sem sequência' : 'Erro';
                                const date = ev.ts ? new Date(ev.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                                return (
                                  <div key={i} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[11px]">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={cn('font-semibold', statusColor)}>{statusLabel}</span>
                                      <span className="text-muted-foreground/60">{date}</span>
                                    </div>
                                    {ev.eventoEntrada && <div className="text-muted-foreground mt-0.5">Gatilho: <span className="font-mono">{ev.eventoEntrada}</span></div>}
                                    {ev.email && <div className="text-muted-foreground">Email: {ev.email}</div>}
                                    {ev.telefone && <div className="text-muted-foreground">Telefone: {ev.telefone}</div>}
                                    {ev.mensagens_enviadas != null && <div className="text-muted-foreground">Mensagens: {ev.mensagens_enviadas}</div>}
                                    {ev.erro && <div className="text-red-400 mt-0.5">{ev.erro}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {connected ? (
                    <Button variant="ghost" size="sm" onClick={() => handlePaymentDisconnect('asaas')} disabled={disconnectingPlatform === 'asaas'} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      {disconnectingPlatform === 'asaas' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Desconectar</>}
                    </Button>
                  ) : asaasFormOpen ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setAsaasFormOpen(false)} className="text-muted-foreground">Cancelar</Button>
                      <Button size="sm" onClick={() => handlePaymentSave('asaas', { access_token: asaasAccessToken, webhook_token: asaasWebhookToken })} disabled={!asaasAccessToken || !asaasWebhookToken || savingPlatform === 'asaas'}>
                        {savingPlatform === 'asaas' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setAsaasFormOpen(true)}>Configurar</Button>
                  )}
                </div>
              </div>
            );
          })()}


          <div className="p-5 rounded-2xl border border-dashed border-border/50 flex items-center gap-4 opacity-50 select-none">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Mais integrações em breve</p>
              <p className="text-xs text-muted-foreground">Novas integrações chegando em breve</p>
            </div>
          </div>
        </div>
  );
}
