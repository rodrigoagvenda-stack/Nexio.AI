'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, CheckCheck, Copy, CreditCard, Loader2, X, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { PLANS as PLAN_OPTIONS } from '@/lib/onboarding/model';
import { cn } from '@/lib/utils';
import { CARD, CardTitle, FIELD, LIME, StatusPill } from './cfg-ui';

interface CompanyFull {
  id: number;
  plan_type: string;
  plan_monthly_limit?: number | null;
  tokens_used?: number | null;
  tokens_limit?: number | null;
  tokens_unlimited?: boolean | null;
  is_active: boolean;
  trial_ends_at?: string | null;
  subscription_expires_at?: string | null;
  asaas_subscription_id?: string | null;
  asaas_cpf_cnpj?: string | null;
}

const PLAN_NAMES: Record<string, string> = { basic: 'Sem assinatura', trial: 'Período de teste', starter: 'Zaapply Start', pro: 'Zaapply Growth' };
const PRICES: Record<string, number> = { starter: 297, pro: 497 };
const isPaid = (t?: string) => t === 'starter' || t === 'pro';

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const day = d.getDate() === 1 ? '1º' : String(d.getDate());
  return `${day} de ${d.toLocaleDateString('pt-BR', { month: 'long' })}`;
};

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} milhões`;
  return n.toLocaleString('pt-BR');
}

export function PlanoUso() {
  const { user } = useUser();
  const searchParams = useSearchParams();

  const [company, setCompany] = useState<CompanyFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const [cpfPrompt, setCpfPrompt] = useState<string | null>(null); // plano a comprar; '_extra_tokens_' = pacote de tokens
  const [cpfInput, setCpfInput] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingCpf, setSavingCpf] = useState(false);
  const [methodPrompt, setMethodPrompt] = useState<string | null>(null);
  const [pix, setPix] = useState<{ encodedImage: string; payload: string } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  const [extraOpen, setExtraOpen] = useState(false);
  const [extraAmount, setExtraAmount] = useState(20);
  const [buyingTokens, setBuyingTokens] = useState(false);
  const plansRef = useRef<HTMLDivElement>(null);

  const fetchCompany = useCallback(async () => {
    if (!user?.company_id) return;
    const { data } = await createClient().from('companies')
      .select('id,plan_type,plan_monthly_limit,tokens_used,tokens_limit,tokens_unlimited,is_active,trial_ends_at,subscription_expires_at,asaas_subscription_id,asaas_cpf_cnpj')
      .eq('id', user.company_id).single();
    if (data) setCompany(data as CompanyFull);
    setLoading(false);
  }, [user?.company_id]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  useEffect(() => {
    const r = searchParams.get('checkout');
    if (r === 'success') toast({ variant: 'success', title: 'Assinatura ativada' });
    if (r === 'cancelled') toast({ variant: 'destructive', title: 'Pagamento cancelado' });
  }, [searchParams]);

  async function doCheckout(plan: string, billingType: 'PIX' | 'CREDIT_CARD') {
    setCheckoutLoading(plan);
    try {
      const doc = cpfInput.replace(/\D/g, '') || company?.asaas_cpf_cnpj || '';
      const res = await fetch('/api/asaas/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, cpfCnpj: doc, extraNumbers: 0, fullName: fullName || undefined, mobilePhone: phone || undefined, billingType }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.pix?.encodedImage) { setPix(d.pix); setCheckoutLoading(null); }
      else if (d.url) { window.location.href = d.url; }
      else { toast({ variant: 'success', title: d.message || 'Assinatura criada', description: 'Verifique seu email para o link de pagamento.' }); setCheckoutLoading(null); }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível gerar a cobrança', description: err?.message });
      setCheckoutLoading(null);
    }
  }

  const handleCheckout = useCallback((plan: string) => {
    if (!company?.asaas_cpf_cnpj) {
      setCpfPrompt(plan);
      setCpfInput('');
      setFullName(user?.name || '');
      setPhone('');
      return;
    }
    setMethodPrompt(plan);
  }, [company?.asaas_cpf_cnpj, user?.name]);

  // Vindo do onboarding (?pagar=starter|pro): abre o checkout já no plano escolhido, uma vez só
  const autoPayStarted = useRef(false);
  useEffect(() => {
    const plan = searchParams.get('pagar');
    if (autoPayStarted.current || loading || !company) return;
    if (plan !== 'starter' && plan !== 'pro') return;
    if (isPaid(company.plan_type)) return;
    autoPayStarted.current = true;
    handleCheckout(plan);
  }, [searchParams, loading, company, handleCheckout]);

  // Enquanto espera o pagamento, confere a cada 5s; quando cair, o painel leva ao passo final do onboarding
  const waitingPayment = !!pix || searchParams.get('expired') === 'payment';
  useEffect(() => {
    if (!waitingPayment) return;
    const timer = setInterval(() => { void fetchCompany(); }, 5000);
    return () => clearInterval(timer);
  }, [waitingPayment, fetchCompany]);
  useEffect(() => {
    if (waitingPayment && isPaid(company?.plan_type)) window.location.href = '/dashboard';
  }, [waitingPayment, company?.plan_type]);

  async function submitCpf() {
    const doc = cpfInput.replace(/\D/g, '');
    if (doc.length !== 11 && doc.length !== 14) { toast({ variant: 'destructive', title: 'CPF ou CNPJ inválido', description: 'Use 11 dígitos (CPF) ou 14 (CNPJ).' }); return; }
    setSavingCpf(true);
    try {
      const { error } = await createClient().from('companies').update({ asaas_cpf_cnpj: doc }).eq('id', company!.id);
      if (error) throw error;
      setCompany((prev) => (prev ? { ...prev, asaas_cpf_cnpj: doc } : prev));
      const pending = cpfPrompt;
      setCpfPrompt(null);
      if (pending === '_extra_tokens_') void buyExtraTokens(doc);
      else setMethodPrompt(pending);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar o documento', description: err?.message });
    } finally { setSavingCpf(false); }
  }

  function chooseMethod(billingType: 'PIX' | 'CREDIT_CARD') {
    const plan = methodPrompt;
    setMethodPrompt(null);
    if (plan) void doCheckout(plan, billingType);
  }

  async function copyPix() {
    if (!pix) return;
    try { await navigator.clipboard.writeText(pix.payload); setCopiedPix(true); setTimeout(() => setCopiedPix(false), 2000); } catch { /* sem permissão */ }
  }

  async function buyExtraTokens(knownDoc?: string) {
    if (!knownDoc && !company?.asaas_cpf_cnpj) { setCpfPrompt('_extra_tokens_'); setCpfInput(''); return; }
    setBuyingTokens(true);
    try {
      const res = await fetch('/api/asaas/extra-tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: extraAmount }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.url) window.location.href = d.url;
      else toast({ variant: 'success', title: d.message || 'Pagamento criado', description: 'Verifique seu email.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível processar a compra', description: err?.message });
    } finally { setBuyingTokens(false); }
  }

  if (loading) return <div className="flex flex-1 items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const planType = company?.plan_type || 'basic';
  const paid = isPaid(planType);
  const isTrial = planType === 'trial';
  const endIso = company?.trial_ends_at ?? company?.subscription_expires_at ?? null;
  const daysLeft = endIso ? Math.ceil((new Date(endIso).getTime() - Date.now()) / 86_400_000) : null;
  const used = company?.tokens_used ?? 0;
  const limit = company?.tokens_limit ?? company?.plan_monthly_limit ?? 0;
  const unlimited = !!company?.tokens_unlimited;
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  let planLine = 'Você ainda não tem uma assinatura.';
  if (isTrial && endIso) planLine = daysLeft != null && daysLeft > 0 ? `Termina em ${dayLabel(endIso)}. ${daysLeft === 1 ? 'Falta 1 dia' : `Faltam ${daysLeft} dias`}.` : `Terminou em ${dayLabel(endIso)}.`;
  else if (isTrial) planLine = 'Acesso de teste.';
  else if (paid) planLine = `R$ ${PRICES[planType]} por mês.${company?.subscription_expires_at ? ` Renova em ${new Date(company.subscription_expires_at).toLocaleDateString('pt-BR')}.` : ''}`;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      {searchParams.get('expired') === 'payment' && (
        <div className="rounded-[14px] border border-amber-500/30 bg-amber-500/[0.08] px-6 py-5">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Falta o pagamento do seu plano</p>
          <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">Sua conta está criada. Escolha o plano abaixo e pague por PIX ou cartão para liberar o painel.</p>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <section className={cn(CARD, 'flex flex-1 flex-col gap-5 px-[34px] py-[30px]')}>
          <div className="flex items-center justify-between">
            <CardTitle title="Seu plano" />
            <StatusPill tone={company?.is_active ? 'ok' : 'warn'}>{company?.is_active ? 'Ativo' : 'Inativo'}</StatusPill>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[34px] font-semibold leading-[42px] tracking-tight text-foreground">{PLAN_NAMES[planType] ?? PLAN_NAMES.basic}</p>
            <p className="text-base text-muted-foreground">{planLine}</p>
          </div>
          {!paid && <p className="text-[14.5px] leading-[1.55] text-muted-foreground">{isTrial ? 'Depois do teste, o acesso só continua com uma assinatura. Escolha o plano abaixo quando quiser.' : 'Escolha o plano abaixo para liberar o Zaapply.'}</p>}
          {paid ? (
            <Button variant="secondary" className="h-12 self-start px-8 text-[15px]" asChild><Link href="/ajuda?tab=chamados">Gerenciar assinatura</Link></Button>
          ) : (
            <Button className="h-12 self-start px-8 text-[15px]" onClick={() => plansRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Assinar agora</Button>
          )}
        </section>

        <section className={cn(CARD, 'flex flex-1 flex-col gap-[18px] px-[34px] py-[30px]')}>
          <CardTitle title="Uso de IA" />
          <div className="flex flex-col gap-1.5">
            <p className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[34px] font-semibold leading-[42px] tracking-tight text-foreground">{fmtTokens(used)}</span>
              <span className="text-[15px] text-muted-foreground">de tokens usados</span>
            </p>
            <p className="text-[14.5px] leading-[1.55] text-muted-foreground">
              Tokens são o que a IA consome ao responder.{' '}
              {unlimited ? 'A sua conta não tem limite, então nada é bloqueado.' : limit > 0 ? `O seu plano inclui ${fmtTokens(limit)} por mês.` : ''}
            </p>
          </div>
          {!unlimited && limit > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', pct > 90 ? 'bg-red-500' : 'bg-[#01573C] dark:bg-[#96F63C]')} style={{ width: `${pct}%` }} /></div>
              {pct > 90 && <p className="text-[13px] text-red-600 dark:text-red-400">Quase no limite. Compre tokens extras ou mude de plano.</p>}
            </div>
          )}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted px-[18px] py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-[3px]">
                <p className="text-[15px] font-semibold leading-[18px] text-foreground">Tokens extras</p>
                <p className="text-[13.5px] text-muted-foreground">Cada R$ 20 adiciona 1 milhão. PIX ou cartão.</p>
              </div>
              <Button variant="secondary" className="h-10 px-5 text-sm" onClick={() => setExtraOpen((o) => !o)}>{extraOpen ? 'Fechar' : 'Comprar'}</Button>
            </div>
            {extraOpen && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {[20, 50, 100].map((v) => (
                  <button key={v} type="button" onClick={() => setExtraAmount(v)} className={cn('rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors', extraAmount === v ? 'border-[#1E6B47] bg-accent text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
                    R$ {v} <span className="opacity-60">({v / 20} mi)</span>
                  </button>
                ))}
                <input type="number" min={20} step={10} value={extraAmount} onChange={(e) => setExtraAmount(Math.max(20, Number(e.target.value)))} aria-label="Valor em reais" className="h-9 w-24 rounded-lg border border-border bg-card px-2.5 text-center font-mono text-[13px]" />
                <Button className="ml-auto h-9 px-5 text-[13px]" onClick={() => buyExtraTokens()} disabled={buyingTokens}>{buyingTokens ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Pagar'}</Button>
              </div>
            )}
          </div>
        </section>
      </div>

      {cpfPrompt && (
        <section className={cn(CARD, 'flex flex-col gap-4 border-primary/40 px-[34px] py-6')}>
          <div className="flex items-start justify-between gap-3">
            <CardTitle title="Dados para a cobrança" hint="Pedimos o CPF ou CNPJ da empresa para emitir a cobrança." />
            <button type="button" aria-label="Fechar" onClick={() => setCpfPrompt(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {!user?.name && <input className={FIELD} placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />}
            <input className={FIELD} placeholder="WhatsApp (ex.: 11 99999-9999)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className={cn(FIELD, 'font-mono')} placeholder="CPF ou CNPJ" value={cpfInput} onChange={(e) => setCpfInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitCpf(); }} />
          </div>
          <Button className="h-[46px] self-start px-8" onClick={submitCpf} disabled={savingCpf}>{savingCpf && <Loader2 className="h-4 w-4 animate-spin" />} Continuar</Button>
        </section>
      )}

      {methodPrompt && (
        <section className={cn(CARD, 'flex flex-col gap-4 border-primary/40 px-[34px] py-6')}>
          <div className="flex items-start justify-between gap-3">
            <CardTitle title="Forma de pagamento" hint="Como você quer pagar a assinatura?" />
            <button type="button" aria-label="Fechar" onClick={() => setMethodPrompt(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" className="h-16 flex-col gap-1" onClick={() => chooseMethod('PIX')} disabled={checkoutLoading === methodPrompt}><Zap className="h-4 w-4" /> PIX</Button>
            <Button variant="secondary" className="h-16 flex-col gap-1" onClick={() => chooseMethod('CREDIT_CARD')} disabled={checkoutLoading === methodPrompt}><CreditCard className="h-4 w-4" /> Cartão</Button>
          </div>
          {checkoutLoading === methodPrompt && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando a cobrança…</p>}
        </section>
      )}

      {pix && (
        <section className={cn(CARD, 'flex flex-col items-center gap-4 border-primary/40 px-[34px] py-6')}>
          <div className="flex w-full items-start justify-between gap-3">
            <CardTitle title="Pague com PIX" hint="Escaneie o QR code ou copie o código abaixo." />
            <button type="button" aria-label="Fechar" onClick={() => setPix(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <img src={`data:image/png;base64,${pix.encodedImage}`} alt="QR code do PIX" className="h-48 w-48 rounded-lg border border-border bg-white" />
          <div className="flex w-full max-w-xl items-center gap-2">
            <input readOnly value={pix.payload} onFocus={(e) => e.target.select()} className={cn(FIELD, 'font-mono text-[11px]')} aria-label="Código PIX copia e cola" />
            <Button variant="secondary" className="h-[50px] shrink-0 px-4" onClick={copyPix} aria-label="Copiar código">{copiedPix ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}</Button>
          </div>
          <p className="text-[13px] text-muted-foreground">Assim que o pagamento for identificado, seu plano é ativado automaticamente.</p>
        </section>
      )}

      <section ref={plansRef} className={cn(CARD, 'flex scroll-mt-6 flex-col gap-[18px] px-[34px] py-[30px]')}>
        <CardTitle title="Escolha seu plano" hint="Pagamento por PIX ou cartão. Pedimos o CPF ou CNPJ da empresa para emitir a cobrança." />
        <div className="flex flex-col gap-5 md:flex-row">
          {PLAN_OPTIONS.map((p) => {
            const popular = !!p.popular;
            const current = planType === p.id;
            const short = p.id === 'starter' ? 'Start' : 'Growth';
            return (
              <div key={p.id} className={cn('flex flex-1 flex-col gap-[18px] rounded-[14px] border px-7 py-[26px]', popular ? 'border-[#1E6B47] bg-accent' : 'border-border bg-muted')}>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold tracking-[0.06em] text-muted-foreground">{p.name}</p>
                    {popular && <span className="rounded-full bg-[#96F63C] px-3 py-1 text-xs font-bold text-[#0C0C0C]">Mais popular</span>}
                  </div>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-[42px] font-semibold leading-[52px] tracking-tight text-foreground">{p.price}</span>
                    <span className="text-[15px] text-muted-foreground">/mês</span>
                  </p>
                </div>
                <ul className="flex flex-1 flex-col gap-[11px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[15px] text-foreground/90">
                      <Check className={cn('h-4 w-4 shrink-0', LIME)} strokeWidth={2.6} /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={popular ? 'default' : 'secondary'}
                  className="h-[46px] text-[15px]"
                  onClick={() => handleCheckout(p.id)}
                  disabled={current || !!checkoutLoading}
                >
                  {checkoutLoading === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {current ? 'Seu plano atual' : `Escolher ${short}`}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="text-[13.5px] text-muted-foreground">Precisa de mais números? Cada número extra de WhatsApp custa R$ 97 por mês. Fale com o suporte para incluir.</p>
      </section>
    </div>
  );
}
