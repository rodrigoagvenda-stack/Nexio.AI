import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const limiter = rateLimit({ key: `ticket-upload:${ip}`, limit: 20, windowMs: 60 * 60 * 1000 })
  if (!limiter.success) {
    return NextResponse.json({ error: 'Muitas solicitações.' }, { status: 429 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'FormData inválido.' }, { status: 400 })

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type))
    return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG, WebP ou GIF.' }, { status: 400 })

  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5 MB.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  // Validar magic bytes : rejeita arquivo malicioso com MIME falsificado
  const isImage = (
    (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) || // JPEG
    (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) || // PNG
    (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) || // GIF
    (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) // WebP
  )
  if (!isImage)
    return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG, WebP ou GIF.' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'png'
  const filePath = `ticket-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const service = createServiceClient()
  const { error: uploadError } = await service.storage
    .from('user-uploads')
    .upload(filePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Erro ao fazer upload: ' + uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from('user-uploads').getPublicUrl(filePath)
  return NextResponse.json({ url: publicUrl })
}
