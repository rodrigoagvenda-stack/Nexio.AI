import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getCompanyId(): Promise<number | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('company_id').eq('auth_user_id', user.id).single()
  return data?.company_id ?? null
}

// GET /api/sdr/products : lista produtos da empresa
export async function GET() {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('sdr_products')
      .select('*')
      .eq('company_id', companyId)
      .order('numero')

    if (error) throw error
    return NextResponse.json({ products: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/sdr/products : cria produto
export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { numero, nome, descricao, preco, ativo } = await request.json()
    if (!numero || !nome) return NextResponse.json({ error: 'numero e nome são obrigatórios' }, { status: 400 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('sdr_products')
      .insert({ company_id: companyId, numero, nome, descricao: descricao || null, preco: preco ?? null, ativo: ativo ?? true })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ product: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT /api/sdr/products : atualiza produto (id no body)
export async function PUT(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id, numero, nome, descricao, preco, ativo } = await request.json()
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const service = createServiceClient()
    const updates: Record<string, any> = {}
    if (numero !== undefined) updates.numero = numero
    if (nome !== undefined) updates.nome = nome
    if (descricao !== undefined) updates.descricao = descricao || null
    if (preco !== undefined) updates.preco = preco ?? null
    if (ativo !== undefined) updates.ativo = ativo

    const { data, error } = await service
      .from('sdr_products')
      .update(updates)
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ product: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/sdr/products : remove produto (id no body)
export async function DELETE(request: NextRequest) {
  try {
    const companyId = await getCompanyId()
    if (!companyId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const service = createServiceClient()
    const { error } = await service
      .from('sdr_products')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
