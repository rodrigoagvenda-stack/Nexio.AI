import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('attendants')
    .select('id, name, email, role, active, online, created_at')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { name, email, role } = body

  if (!name || !email) {
    return NextResponse.json({ error: 'name e email são obrigatórios' }, { status: 400 })
  }

  const validRoles = ['admin', 'supervisor', 'atendente']
  const assignedRole = validRoles.includes(role) ? role : 'atendente'

  const supabase = createServiceClient()

  // Verifica se já existe usuário Supabase Auth com esse email
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
  const existingAuthUser = authUsers?.find((u) => u.email === email)

  const { data, error } = await supabase
    .from('attendants')
    .insert({
      company_id: context.companyId,
      user_id: existingAuthUser?.id ?? null,
      name,
      email,
      role: assignedRole,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Atendente com esse email já existe nesta empresa' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
