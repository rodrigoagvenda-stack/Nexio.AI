import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServiceClient();

  // Buscar empresa com id=1
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', 1)
    .single();

  // Buscar todas as empresas
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .limit(10);

  return NextResponse.json({
    company_id_1: company,
    error: error?.message,
    all_companies: allCompanies,
  });
}
