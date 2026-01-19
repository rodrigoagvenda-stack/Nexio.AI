import { createClient } from '@/lib/supabase/server';
import { FinanceiroContent } from '@/components/admin/FinanceiroContent';

export default async function FinanceiroPage() {
  const supabase = await createClient();

  // Buscar transações financeiras
  const { data: transacoes } = await supabase
    .from('transacoes_financeiras')
    .select(`
      *,
      company:companies(name)
    `)
    .order('created_at', { ascending: false });

  // Estatísticas
  const { data: statsData } = await supabase
    .from('transacoes_financeiras')
    .select('tipo, valor');

  const receitas = statsData
    ?.filter(t => t.tipo === 'receita')
    .reduce((sum, t) => sum + (t.valor || 0), 0) || 0;

  const despesas = statsData
    ?.filter(t => t.tipo === 'despesa')
    .reduce((sum, t) => sum + (t.valor || 0), 0) || 0;

  const saldo = receitas - despesas;

  const { count: totalTransacoes } = await supabase
    .from('transacoes_financeiras')
    .select('*', { count: 'exact', head: true });

  return (
    <FinanceiroContent
      transacoes={transacoes || []}
      stats={{
        receitas,
        despesas,
        saldo,
        total: totalTransacoes || 0,
      }}
    />
  );
}
