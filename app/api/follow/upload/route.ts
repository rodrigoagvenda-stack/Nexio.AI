import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const service = createServiceClient()
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande. Máximo 50MB' }, { status: 400 })

    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const fileName = `${context.companyId}-${Date.now()}.${fileExt}`
    const filePath = `follow-media/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await service.storage
      .from('user-uploads')
      .upload(filePath, buffer, { contentType: file.type, cacheControl: '31536000', upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = service.storage.from('user-uploads').getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl, name: file.name, type: file.type })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
