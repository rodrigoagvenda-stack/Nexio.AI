import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const ext = file.name.split('.').pop() || 'png'
    const path = `logos/${user.id}_${Date.now()}.${ext}`
    const bytes = await file.arrayBuffer()

    // Service client bypassa RLS do storage
    const service = createServiceClient()
    const { error } = await service.storage
      .from('company-assets')
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (error) throw error

    const { data: { publicUrl } } = service.storage.from('company-assets').getPublicUrl(path)
    return NextResponse.json({ url: publicUrl })
  } catch (err: any) {
    console.error('[upload-logo]', err)
    return NextResponse.json({ error: err.message || 'Erro ao fazer upload' }, { status: 500 })
  }
}
