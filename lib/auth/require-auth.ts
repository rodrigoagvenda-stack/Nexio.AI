import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export type AuthContext = {
  userId: string;
  companyId: number;
  role: 'admin' | 'manager' | 'sdr' | 'closer' | 'sdr_closer' | 'company_admin' | 'company_user';
};

export type AdminContext = {
  userId: string;
  adminRole: 'super_admin' | 'admin' | 'support';
};

// Para rotas do dashboard — garante usuário autenticado e retorna company_id
export async function requireAuth(request: NextRequest): Promise<
  { context: AuthContext; error: null } | { context: null; error: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      context: null,
      error: NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 }),
    };
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('company_id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!dbUser || !dbUser.is_active) {
    return {
      context: null,
      error: NextResponse.json({ success: false, message: 'Usuário não encontrado ou inativo' }, { status: 403 }),
    };
  }

  return {
    context: {
      userId: user.id,
      companyId: dbUser.company_id,
      role: (dbUser.role as AuthContext['role']) || 'company_user',
    },
    error: null,
  };
}

// Para rotas admin — garante que é admin ativo
export async function requireAdmin(request: NextRequest): Promise<
  { context: AdminContext; error: null } | { context: null; error: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      context: null,
      error: NextResponse.json({ success: false, message: 'Não autorizado' }, { status: 401 }),
    };
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!adminUser) {
    return {
      context: null,
      error: NextResponse.json({ success: false, message: 'Acesso negado' }, { status: 403 }),
    };
  }

  return {
    context: {
      userId: user.id,
      adminRole: adminUser.role as AdminContext['adminRole'],
    },
    error: null,
  };
}

// Valida que o company_id da request pertence ao usuário logado
export function validateCompanyAccess(requestedCompanyId: number, authCompanyId: number): NextResponse | null {
  if (requestedCompanyId !== authCompanyId) {
    return NextResponse.json({ success: false, message: 'Acesso negado a esta empresa' }, { status: 403 });
  }
  return null;
}
