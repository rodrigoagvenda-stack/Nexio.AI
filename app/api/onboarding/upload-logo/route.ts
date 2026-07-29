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

    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Imagem muito grande. Máximo 5MB' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buf = Buffer.from(bytes)

    // Validar magic bytes : rejeita arquivo malicioso com MIME falso
    const isImage = (
      (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) || // JPEG
      (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) || // PNG
      (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) || // GIF
      (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) // WebP
    )
    if (!isImage) return NextResponse.json({ error: 'Formato não permitido. Use JPG, PNG, GIF ou WebP.' }, { status: 400 })

    const ext = file.name.split('.').pop() || 'png'
    const path = `logos/${user.id}_${Date.now()}.${ext}`

    // Service client bypassa RLS do storage
    const service = createServiceClient()
    const { error } = await service.storage
      .from('company_assets')
      .upload(path, buf, { contentType: file.type, upsert: true })

    if (error) throw error

    const { data: { publicUrl } } = service.storage.from('company_assets').getPublicUrl(path)
    return NextResponse.json({ url: publicUrl })
  } catch (err: any) {
    console.error('[upload-logo]', err)
    return NextResponse.json({ error: err.message || 'Erro ao fazer upload' }, { status: 500 })
  }
}
