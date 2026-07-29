'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  TrendingUp, Zap, Clock, Users, CheckCircle2, AlertCircle, XCircle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Subscription {
  id: number;
  name: string;
  email: string;
  plan_type: string | null;
  plan_name: string | null;
  asaas_subscription_id: string | null;
  subscription_start_date: string | null;
  subscription_expires_at: string | null;
  is_active: boolean;
}

interface TokenCharge {
  id: string;
  amount: number;
  tokens_to_grant: number;
  status: 'pending' | 'confirmed' | 'overdue' | 'cancelled';
  confirmed_at: string | null;
  created_at: string;
  valid_until: string | null;
  company: { name: string } | null;
}

interface Stats {
  mrr: number;
  activeSubs: number;
  tokenRevenue: number;
  pendingAmount: number;
  pendingCount: number;
}

interface Props {
  subscriptions: Subscription[];
  tokenCharges: TokenCharge[];
  stats: Stats;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dateBR = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('pt-BR') : '-';

const tkFmt = (n: number) =>
  n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1_000}K`;

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic', trial: 'Trial', starter: 'Zaapply Start', pro: 'Zaapply Growth',
};

const PLAN_COLORS: Record<string, string> = {
  basic:   'bg-gray-100 text-gray-600',
  trial:   'bg-gray-100 text-gray-600',
  starter: 'bg-blue-100 text-blue-700',
  pro:     'bg-purple-100 text-purple-700',
};

function StatusBadge({ expires }: { expires: string | null }) {
  if (!expires) return <Badge variant="outline">Sem data</Badge>;
  const active = new Date(expires) > new Date();
  return active
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" />Ativa</span>
    : <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle className="h-3 w-3" />Expirada</span>;
}

function ChargeStatus({ status }: { status: TokenCharge['status'] }) {
  if (status === 'confirmed')
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" />Confirmado</span>;
  if (status === 'pending')
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><Clock className="h-3 w-3" />Pendente</span>;
  if (status === 'overdue')
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full"><AlertCircle className="h-3 w-3" />Vencido</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full"><XCircle className="h-3 w-3" />Cancelado</span>;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function FinanceiroContent({ subscriptions, tokenCharges, stats }: Props) {
  const [tab, setTab] = useState<'assinaturas' | 'tokens'>('assinaturas');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Assinaturas e recargas de tokens via ASAAS
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">MRR</p>
            <TrendingUp className="h-4 w-4 text-[#369E47]" />
          </div>
          <p className="text-2xl font-black text-[#369E47]">{brl(stats.mrr)}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.activeSubs} assinatura{stats.activeSubs !== 1 ? 's' : ''} ativa{stats.activeSubs !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tokens</p>
            <Zap className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black">{brl(stats.tokenRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {tokenCharges.filter(c => c.status === 'confirmed').length} recarga{tokenCharges.filter(c => c.status === 'confirmed').length !== 1 ? 's' : ''} confirmada{tokenCharges.filter(c => c.status === 'confirmed').length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendentes</p>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{brl(stats.pendingAmount)}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.pendingCount} aguardando pagamento</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receita total</p>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-black">{brl(stats.mrr + stats.tokenRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">MRR + tokens</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 border border-border rounded-xl p-1 w-fit">
        {([
          { key: 'assinaturas', label: `Assinaturas (${subscriptions.length})` },
          { key: 'tokens',      label: `Recargas de tokens (${tokenCharges.length})` },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Assinaturas */}
      {tab === 'assinaturas' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Valor/mês</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ID ASAAS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma assinatura cadastrada ainda
                  </TableCell>
                </TableRow>
              ) : subscriptions.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[s.plan_type ?? 'basic'] ?? 'bg-gray-100 text-gray-600'}`}>
                      {PLAN_LABELS[s.plan_type ?? ''] ?? s.plan_type ?? 'Desconhecido'}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-[#369E47]">
                    {brl(({ starter: 297, pro: 497 } as Record<string, number>)[s.plan_type ?? ''] ?? 0)}
                  </TableCell>
                  <TableCell className="text-sm">{dateBR(s.subscription_start_date)}</TableCell>
                  <TableCell className="text-sm">{dateBR(s.subscription_expires_at)}</TableCell>
                  <TableCell><StatusBadge expires={s.subscription_expires_at} /></TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {s.asaas_subscription_id?.slice(0, 16) ?? '-'}…
                    </code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab: Recargas de tokens */}
      {tab === 'tokens' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Solicitado em</TableHead>
                <TableHead>Confirmado em</TableHead>
                <TableHead>Válido até</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokenCharges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma recarga de tokens ainda
                  </TableCell>
                </TableRow>
              ) : tokenCharges.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-sm">
                    {c.company?.name ?? '-'}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-purple-600">
                      +{tkFmt(c.tokens_to_grant)}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold">{brl(c.amount)}</TableCell>
                  <TableCell><ChargeStatus status={c.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dateBR(c.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.confirmed_at ? dateBR(c.confirmed_at) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dateBR(c.valid_until)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
