import { createServiceClient } from '@/lib/supabase/server'

const EXT_BY_MIMETYPE: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/ogg; codecs=opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
}

function extensionFor(mimetype: string, kind: string): string {
  const clean = mimetype.split(';')[0].trim()
  return EXT_BY_MIMETYPE[mimetype] ?? EXT_BY_MIMETYPE[clean] ?? (kind === 'document' ? 'pdf' : kind === 'audio' ? 'ogg' : kind === 'video' ? 'mp4' : 'bin')
}

/**
 * Sobe bytes de mídia recebida (áudio/imagem/documento/vídeo) pro bucket
 * `whatsapp-media` (mesmo bucket usado pelo Atendimento pra mídia enviada por humano)
 * e devolve a URL pública persistente. Best-effort: nunca lança, retorna null em falha
 * pra não derrubar o recebimento da mensagem por causa de upload.
 */
export async function persistMediaToStorage(params: {
  companyId: number
  phone: string
  bytes: Buffer
  mimetype: string
  kind: 'audio' | 'image' | 'document' | 'video'
}): Promise<string | null> {
  try {
    const supabase = createServiceClient()
    const ext = extensionFor(params.mimetype, params.kind)
    const fileName = `${params.kind}_${Date.now()}.${ext}`
    const filePath = `${params.companyId}/whatsapp/${params.phone}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(filePath, params.bytes, {
        contentType: params.mimetype || 'application/octet-stream',
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('[media-storage] upload falhou:', uploadError.message)
      return null
    }

    const { data } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath)
    return data.publicUrl
  } catch (e: any) {
    console.error('[media-storage] persistMediaToStorage erro:', e.message)
    return null
  }
}
